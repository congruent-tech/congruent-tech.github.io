---
layout: insight
title: "Building iAssist, Part 4: Giving the Agent Hands with File Tools"
permalink: /en/insights/ai/building-iassist/04-file-tools/
date: 2026-10-28
part: 4
category: AI Development
tags: [AI, Swift, Coding Agents, Tool Use, Sandboxing]
description: "How iAssist's read, write, edit, grep and glob tools work: a workspace sandbox, diffs before every change, and error messages written for the model."
---

# Building iAssist, Part 4: Giving the Agent Hands with File Tools

*Reading, searching and editing code inside a sandbox, with error messages written for the model*

{% include iassist-series-nav.html %}

## A Tool Is Three Things

To the model, a tool is just a name, a description and a JSON schema for its arguments. To iAssist, a tool is a small Swift type:

```swift
public protocol AgentTool: Sendable {
    var spec: AgentToolSpec { get }              // name, description, input schema
    var capability: ToolCapability? { get }      // what this tool lets the agent do
    func run(argumentsJSON: String) async throws -> String
}
```

The `capability` property is required, with no default. Every tool has to declare explicitly what it grants: `.readFiles`, `.searchFiles`, `.editFiles`, `.runShell`, `.webSearch`, `.delegate` or `.askUser`. As we'll see in Part 7, the system prompt is built from these capabilities, so the prompt can never promise the model a power it doesn't have.

## The Toolset, Built in Five Iterations

The file tools were added in a deliberate sequence, visible in the commit log as "iter 1/5" to "iter 5/5":

| Iteration | Tool | What it does |
|---|---|---|
| 1 | Workspace + `/add-dir` | Defines which directories the agent may touch |
| 2 | `edit_file` | Exact string replacement, with a colored diff in the permission prompt |
| 3 | `grep` | Regex search across file contents |
| 4 | `glob` | Find files by pattern |
| 5 | Bash allow-list + `write_file` diff | Safe read-only commands run without asking; new files show a diff too |

Before these, the agent had `read_file` and `write_file`. A `list_dir` tool was added and reverted the same day, because `glob` covered it. Fewer, sharper tools make small models choose better.

## The Workspace: A Sandbox With an Allow-List

Every file tool resolves paths through a shared `Workspace`. It holds the allowed directories, with the launch directory first:

```swift
public final class Workspace: @unchecked Sendable {
    private var roots: [URL]

    /// The primary directory — where relative paths resolve and bash runs.
    public var primary: URL { roots[0] }

    public func resolve(_ path: String) throws -> URL {
        // canonicalize, then refuse anything outside every allowed root
        ...
        throw FileToolError.outsideSandbox(path)
    }
}
```

Two details matter:

- **Paths are canonicalized** (symlinks and `..` resolved) before comparison. On macOS, `/var` and `/private/var` are the same place. Comparing raw strings would let paths slip through or wrongly refuse them.
- **The allow-list is live.** `/add-dir ../shared-lib` adds a directory mid-session, and the system prompt reflects it on the very next turn.

A refused path returns a plain message, `refused: '/etc/hosts' is outside the allowed directory`, which the model reads and adapts to.

## Edits the User Can See

`edit_file` works like Claude Code's Edit tool: find an exact `old_string`, replace it with `new_string`. It refuses when the match is missing, or appears several times without `replace_all`.

Before writing, it asks for permission and shows a **colored diff** of the change. The user approves what they see, not a description of it. `write_file` got the same treatment for new files.

This is the core of human-in-the-loop design: the person approves a concrete, inspectable change.

## Error Messages Written for the Model

The most effective improvement to coding accuracy wasn't a better model. It was better error messages.

When `edit_file` can't find `old_string`, a bare "not found" makes the model guess blindly. iAssist diagnoses the most likely cause instead:

```swift
static func diagnoseMiss(old: String, in file: String) -> String {
    // 1. Did the model paste read_file's "N→" line-number prefixes into old_string?
    let deprefixed = stripLineNumberPrefixes(old)
    if deprefixed != old, file.contains(deprefixed) {
        return "it looks like old_string includes read_file's \"N→\" line-number prefixes — drop them"
    }
    // 2. A whitespace / indentation-only difference (tabs vs spaces, extra indent)?
    if let line = firstConsecutiveMatch(of: trimmedLines(old), in: trimmedLines(file)) {
        return "it matches EXCEPT for whitespace/indentation near line \(line + 1)"
    }
    // 3. Point at the closest real line so the model can see the actual text.
    if let (number, text) = closestLine(to: deprefixed, in: file) {
        return "it must match the file exactly. Closest line is \(number): \(text)"
    }
    return "it must match the file exactly"
}
```

The behaviour doesn't change (the edit is still refused), only the message. But the model now usually fixes its mistake on the next try instead of the third.

The same thinking applies to `read_file`, which shows line numbers (`12→ let x = 1`) so the model can refer to specific lines, and to the case where the model asks for a tool that doesn't exist:

```swift
guard let tool = tools[call.name] else {
    // Name what IS available and tell the model not to retry.
    ...
}
```

This came from a real bug. A resumed conversation referenced an MCP tool that wasn't connected any more. The model kept calling it. Listing the available tools and saying "don't retry" ended the loop.

## Small Fixes That Made a Big Difference

The commit log is full of one-line fixes that each removed a whole class of failures:

```text
fix(read_file): actionable message for a directory or missing path
fix(glob): treat '.' / './' as 'list everything here'
fix(tools): glob matches directories, not just files
fix(core): stop large write_file truncating at the output-token limit
```

Each one came from watching a real session go wrong. Models are not malicious, they are literal. A tool that reads `glob .` as "nothing" will send a model in circles.

## Capping Tool Output

A single `grep` across a large repo can produce megabytes of text. That would consume the whole context window in one call. The loop caps every tool result (at 120,000 characters) and tells the model how much was omitted:

```swift
static func capToolOutput(_ output: String, maxChars: Int = 120_000) -> String {
    guard output.count > maxChars else { return output }
    let omitted = output.count - maxChars
    // keep the head, then add a note saying how many characters were cut
    ...
}
```

The note matters. Silently truncated output looks complete, and the model will draw wrong conclusions from it.

## Asking the User Is a Tool Too

One tool doesn't touch files: `ask_user`. It lets the model put a question to the human mid-task, for example "Which of these two config files is the real one?"

Later the system prompt was tuned to **investigate vague requests before asking**. If the user says "fix the build", the agent should run the build first, not ask "which build?". `ask_user` is for real ambiguity, not a way to avoid work.

## Key Takeaways

- Make every tool declare its capability explicitly, so the prompt can be derived from reality.
- Resolve all paths through one canonicalizing sandbox with a live allow-list.
- Show diffs before writes; humans should approve concrete changes.
- Write error messages for the model: name the likely cause and the fix.
- Cap tool output and say what was cut.

In Part 5 we tackle the most powerful and dangerous tool of all: the shell.

{% include iassist-series-nav.html %}
