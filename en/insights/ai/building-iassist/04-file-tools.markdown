---
layout: insight
title: "AI Agent Tool Use: Sandboxed File Read, Edit, Grep and Glob"
permalink: /en/insights/ai/building-iassist/04-file-tools/
date: 2026-10-28
part: 4
category: AI Development
tags: [AI Agent Tools, Tool Use, Function Calling, Agent Sandbox, Human-in-the-Loop, Coding Agents, Swift]
description: "How to design tools for an AI coding agent: a workspace sandbox, diffs before every edit, capability flags and error messages written for the LLM to self-correct."
series: "Building iAssist"
---

# AI Agent Tool Use: Sandboxed File Read, Edit, Grep and Glob

*Reading, searching and editing code inside a sandbox, with error messages written for the model*

{% include iassist-series-nav.html %}

## Models Are Not Malicious, They Are Literal

Show a model a file with line numbers, and it may paste those line numbers straight back into its next edit. Tell it "not found", and it will guess blindly and try again. Give it a tool that reads `glob .` as "nothing", and it will walk in circles.

None of this is a sign of a bad model. A model takes your tools exactly at their word, so building tools for one means thinking hard about what those words say.

To the model, a tool is just a name, a description and a JSON schema for its arguments. To iAssist, it is a small Swift type:

```swift
public protocol AgentTool: Sendable {
    var spec: AgentToolSpec { get }              // name, description, input schema
    var capability: ToolCapability? { get }      // what this tool lets the agent do
    func run(argumentsJSON: String) async throws -> String
}
```

The `capability` property is required and has no default, so every tool must declare what it grants: `.readFiles`, `.searchFiles`, `.editFiles`, `.runShell`, `.webSearch`, `.delegate` or `.askUser`. Part 7 builds the system prompt from these, which means the prompt can never promise the model a power it doesn't have.

## Five Iterations, and One Tool We Took Back

The file tools arrived in a deliberate sequence, visible in the commit log as "iter 1/5" to "iter 5/5":

| Iteration | Tool | What it does |
|---|---|---|
| 1 | Workspace + `/add-dir` | Defines which directories the agent may touch |
| 2 | `edit_file` | Exact string replacement, with a colored diff in the permission prompt |
| 3 | `grep` | Regex search across file contents |
| 4 | `glob` | Find files by pattern |
| 5 | Bash allow-list + `write_file` diff | Safe read-only commands run without asking; new files show a diff too |

Before these, the agent had `read_file` and `write_file`. A `list_dir` tool was added and reverted the same day, because `glob` already covered it. Fewer, sharper tools make small models choose better.

## A Sandbox That Canonicalizes First

Every file tool resolves paths through a shared `Workspace`, which holds the allowed directories with the launch directory first:

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

Paths are **canonicalized** (symlinks and `..` resolved) before any comparison. On macOS, `/var` and `/private/var` are the same place, so comparing raw strings would let paths slip through or wrongly refuse them.

The allow-list is also **live**: `/add-dir ../shared-lib` adds a directory mid-session, and the system prompt reflects it on the very next turn. A refused path comes back as a plain message, `refused: '/etc/hosts' is outside the allowed directory`, which the model reads and adapts to.

## Approve What You See, Not a Description of It

`edit_file` works like Claude Code's Edit tool: find an exact `old_string`, replace it with `new_string`. It refuses when the match is missing, or appears several times without `replace_all`.

Before writing, it asks for permission and shows a **colored diff** of the change, and `write_file` got the same treatment for new files. This is the core of human-in-the-loop design: the person approves a concrete, inspectable change, not the agent's summary of what it intends.

## Error Messages Written for the Model

One of the most effective improvements to coding accuracy had nothing to do with a better model. It was better error messages.

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

The behaviour doesn't change, since the edit is still refused. Only the message does, yet the model now usually fixes its mistake on the next try instead of the third.

The same thinking covers `read_file`, which shows line numbers (`12→ let x = 1`) so the model can refer to specific lines, and the case where the model asks for a tool that doesn't exist:

```swift
guard let tool = tools[call.name] else {
    // Name what IS available and tell the model not to retry.
    ...
}
```

That one came from a real bug. A resumed conversation referenced an MCP tool that wasn't connected any more, and the model kept calling it. Listing the available tools and saying "don't retry" ended the loop.

## One-Line Fixes, Whole Classes of Failure

The commit log is full of tiny fixes that each removed an entire category of problem:

```text
fix(read_file): actionable message for a directory or missing path
fix(glob): treat '.' / './' as 'list everything here'
fix(tools): glob matches directories, not just files
fix(core): stop large write_file truncating at the output-token limit
```

Each one came from watching a real session go wrong. If you build tools for agents, this is the job: read transcripts, find where the model took you literally, and fix the tool.

## Silently Truncated Output Looks Complete

A single `grep` across a large repo can produce megabytes of text and swallow the whole context window in one call. So the loop caps every tool result at 120,000 characters and tells the model how much was omitted:

```swift
static func capToolOutput(_ output: String, maxChars: Int = 120_000) -> String {
    guard output.count > maxChars else { return output }
    let omitted = output.count - maxChars
    // keep the head, then add a note saying how many characters were cut
    ...
}
```

The note is the important part. Without it, the model sees what looks like complete output and draws wrong conclusions from it.

## Asking the User Is a Tool Too

One tool doesn't touch files at all. `ask_user` lets the model put a question to the human mid-task: "Which of these two config files is the real one?"

It also needed a leash. The system prompt was later tuned to **investigate vague requests before asking**, so "fix the build" means run the build first, not reply "which build?". `ask_user` is for real ambiguity, not a way to avoid work.

## Key Takeaways

- Make every tool declare its capability, so the prompt can be derived from reality.
- Resolve all paths through one canonicalizing sandbox with a live allow-list.
- Show diffs before writes; humans should approve concrete changes.
- Write error messages for the model, and when you cap output, say what was cut.

Files are the easy part, because a sandbox can contain them. Part 5 hands the agent a shell, which can delete your home directory, push to production or send your SSH key to a server, and shows the security holes we found in our own defences.

{% include iassist-series-nav.html %}
