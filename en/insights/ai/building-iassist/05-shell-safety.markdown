---
layout: insight
title: "Securing an AI Agent's Shell: Command Risk Tiers and Permissions"
permalink: /en/insights/ai/building-iassist/05-shell-safety/
date: 2026-10-28
part: 5
category: AI Development
tags: [AI Agent Security, Agent Sandbox, Shell Permissions, Human-in-the-Loop, Prompt Injection, Coding Agents, Swift]
description: "Sandboxing shell access for an AI coding agent: risk-tiered command classification, safe permission learning and the real prompt-exfiltration bypasses we fixed."
series: "Building iAssist"
---

# Securing an AI Agent's Shell: Command Risk Tiers and Permissions

*Risk tiers, learned permissions, and the security holes we found in our own classifier*

{% include iassist-series-nav.html %}

## Two Quote Marks Away From `/etc/passwd`

`cat /etc/passwd` asked for permission, exactly as designed. `cat "/etc/passwd"` ran immediately, with no prompt at all. The only difference was a pair of quote marks.

A shell is the most useful tool a coding agent has, and the most dangerous. With it, the agent can build, test, run git and install packages. It can also delete your home directory, push to production or send your SSH key to a server.

Ask for approval on every command and the agent is unusable. Ask on none and it's dangerous. iAssist uses a **graduated approval model**, the same idea Claude Code uses: reads are less sensitive than writes, and writes are less sensitive than dangerous actions.

## Four Risk Tiers

The policy file opens with the whole model:

```swift
//   read       → always runs, no prompt (ls, cat, grep, git status …)
//   write      → asks in Manual mode; auto-approved in Auto mode
//                (mkdir, mv, npm install, swift build, git commit …)
//   dangerous  → always asks, even in Auto mode (rm -rf, sudo, git push,
//                pipe to a shell, anything touching outside the workspace)
//   blocked    → refused outright (rm -rf /, fork bombs, dd to a device …)
```

Classification is a pure function, which makes it easy to test exhaustively:

```swift
public static func risk(of command: String, workspace: Workspace) -> CommandRisk {
    if isDangerous(command) { return .dangerous }
    if isReadOnly(command) { return .read }
    return .write
}
```

The order is the design. *Dangerous* is checked first and *write* is the default, so anything the classifier doesn't positively recognize as safe lands in a tier that asks.

The code is honest about its limits: "Classification is heuristic — a shell is impossible to parse perfectly — so the per-command prompt remains the real backstop."

## What It Takes to Run Without Asking

A command auto-runs only if **all** of these hold:

- it is a single program from an allow-list (`ls`, `cat`, `grep`, `git status`, `git log`, `git diff`, …)
- it contains no shell operators: no pipes, redirects, `;`, `&&`, backticks or `$(…)`
- it contains no `$`, backtick or backslash at all
- no argument points outside the workspace (`/…`, `~`, `..`), even inside quotes

That list is longer than it used to be, and every rule on it closed a real hole.

## The Holes We Found

A review of the classifier ended in one commit that closed four bypasses at once. Its message reads like a security advisory, because that's what it is:

```text
fix(security): close ShellPolicy command-classifier bypasses

- Read-tier exfiltration: cat "/etc/passwd", cat $HOME/.ssh/id_rsa, and
  sort -o "/tmp/out" classified READ and auto-ran with NO prompt.
- env removed from the read-only allowlist (it is an exec primitive).
- Whitespace/tab evasion of the dangerous + blocked markers
  (rm\t-rf, rm  -rf, rm   -rf  /) closed by normalising all whitespace.
- Learned-pattern privilege jump: a dangerous command is no longer learnable.
```

These are the mistakes anyone writing a shell policy will make, so they're worth walking through.

### 1. Quotes and variables hide paths

The out-of-workspace check looked for arguments starting with `/`. In `cat "/etc/passwd"` the argument starts with a quote, and `cat $HOME/.ssh/id_rsa` doesn't contain a leading slash at all. Both walked straight past.

The fix strips quotes before checking, and treats **any** variable expansion as unsafe:

```swift
// Variable expansion, command substitution, and escapes can resolve to a
// path or program the substring checks below can't see, so a command
// carrying them is NEVER auto-read — it drops to ASK.
for hazard in ["$", "`", "\\"] where trimmed.contains(hazard) { return false }
```

### 2. Some "read" programs execute things

`env` looks harmless, since it prints environment variables. But `env some-program` *runs* `some-program`. It is an execution primitive wearing a read-only costume, and it came off the allow-list.

### 3. Whitespace evades string matching

The dangerous marker `"rm -rf"` didn't match `rm⇥-rf` (with a tab) or `rm  -rf` (two spaces). One extra keystroke was enough to dodge it, so all whitespace is now normalized before matching:

```swift
// Match against a whitespace-normalised form so tabs / extra spaces can't
// evade the markers (`rm⇥-rf`, `rm  -rf` both become `rm -rf`).
let lowered = normalizedForMatching(command)
```

### 4. "Always allow" can over-grant

The subtlest of the four needs its own section.

## When "Always Allow" Means More Than You Approved

When the user approves a command, they can choose **allow once** or **always allow**. "Always" learns a pattern and saves it to `.iassist/permissions.json`, so it survives restarts:

```swift
// `git commit -m "x"` → `git commit *`
// `npm install lodash` → `npm install *`
// `ls`                 → `ls *`
public static func pattern(for command: String) -> String
```

The danger is generalizing too far. Approve `git push origin main` once with "always", and the learned pattern `git push *` will later auto-approve `git push --force`. Approve `chmod 644 file`, and you've learned `chmod *`, which covers `chmod -R 777 /`.

So two kinds of commands can **never** be learned:

```swift
public static func learnablePattern(for command: String) -> String? {
    if isCompound(command) || isDangerous(command) { return nil }
    return pattern(for: command)
}
```

- **Dangerous commands** always ask, no matter what you approved before.
- **Compound commands** are excluded because `cd x && rm -rf y` would reduce to `cd *`, a rule that whitelists far more than the user saw.

When `learnablePattern` returns `nil`, the UI simply doesn't offer "always allow".

## A Shell That Remembers `cd`

The first bash tool started a new process per command, so `cd src` followed by `ls` listed the wrong directory, and `export` did nothing.

iAssist moved to a **persistent shell**, one long-lived `zsh` per session, behind a transport protocol:

```swift
/// The byte channel to a long-lived shell.
public protocol ShellTransport: Sendable {
    func start(onOutput: @escaping @Sendable (Data) -> Void,
               onExit: @escaping @Sendable () -> Void) throws
    func send(_ text: String)
    func interrupt()
    func terminate()
}
```

Today's transport uses pipes, not a terminal, so interactive programs like `vim` don't work. A real pseudo-terminal (PTY) is planned as just another `ShellTransport`, with everything else reused.

Persistence solved one problem and created new ones:

```text
fix(shell): anchored cwd policy + deterministic teardown + lifecycle readout
fix(workflow): stop persistent-shell cwd leaking across rounds
fix(bash): out-of-workspace reads no longer auto-run
```

Once the shell remembers `cd`, an agent that wanders outside the workspace takes all its later "relative" commands with it. The working directory is now anchored and checked, and each shell is torn down deterministically when its session ends.

## Auto Mode With a Veto Window

Approving every `swift build` by hand gets tiring. The Mac app's **Auto** mode shows write-tier actions in the permission prompt with a **countdown**, and approves them unless you click "deny". Dangerous commands still always ask, in every mode.

This lives at the prompter layer rather than in the shell policy, because that is the one place that also sees file edits. A comment in the policy warns future maintainers not to get clever:

> "Do NOT wire the footer mode into `.auto` below: that path auto-approves writes SILENTLY (no prompt, no countdown), bypassing the GUI's veto window."

## Key Takeaways

- Use risk tiers, and make "ask" the default for anything not positively known to be safe.
- Treat quotes, variables, escapes and whitespace as attack surface; normalize before matching.
- Never learn permissions for dangerous or compound commands.
- Give the human a veto window, even in auto mode.

An agent with tools can now do real work, and that creates a new problem. Reading 30 files to answer one question leaves 30 files' worth of text in the conversation for the rest of the session. Part 6 is about how an agent gets that work done without having to remember any of it.

{% include iassist-series-nav.html %}
