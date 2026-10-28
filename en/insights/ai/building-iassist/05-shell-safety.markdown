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

## The Most Useful, Most Dangerous Tool

With a shell, a coding agent can build, test, run git and install packages. It can also delete your home directory, push to production or send your SSH key to a server.

Asking for approval on every command makes the agent unusable. Asking on none makes it dangerous. iAssist uses a **graduated approval model**, the same idea Claude Code uses: reads are less sensitive than writes, and writes are less sensitive than dangerous actions.

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

Note the order. *Dangerous* is checked first, and *write* is the default. Anything the classifier doesn't positively recognize as safe falls into a tier that asks.

The code is honest about its limits: "Classification is heuristic — a shell is impossible to parse perfectly — so the per-command prompt remains the real backstop."

## What Counts as "Read-Only"

A command is auto-run only if **all** of these hold:

- it is a single program from an allow-list (`ls`, `cat`, `grep`, `git status`, `git log`, `git diff`, …)
- it contains no shell operators: no pipes, redirects, `;`, `&&`, backticks or `$(…)`
- it contains no `$`, backtick or backslash at all
- no argument points outside the workspace (`/…`, `~`, `..`), even inside quotes

That list is longer than it was at first. Each rule closed a real hole.

## The Holes We Found

After a review of the classifier, one commit closed four bypasses at once. Its message reads like a security advisory:

```text
fix(security): close ShellPolicy command-classifier bypasses

- Read-tier exfiltration: cat "/etc/passwd", cat $HOME/.ssh/id_rsa, and
  sort -o "/tmp/out" classified READ and auto-ran with NO prompt.
- env removed from the read-only allowlist (it is an exec primitive).
- Whitespace/tab evasion of the dangerous + blocked markers
  (rm\t-rf, rm  -rf, rm   -rf  /) closed by normalising all whitespace.
- Learned-pattern privilege jump: a dangerous command is no longer learnable.
```

Each deserves a closer look, because these are mistakes anyone writing a shell policy will make.

### 1. Quotes and variables hide paths

The out-of-workspace check looked for arguments starting with `/`. So `cat /etc/passwd` asked, but `cat "/etc/passwd"` didn't, because the argument started with a quote. And `cat $HOME/.ssh/id_rsa` didn't start with `/` at all.

The fix strips quotes before checking, and treats **any** variable expansion as unsafe:

```swift
// Variable expansion, command substitution, and escapes can resolve to a
// path or program the substring checks below can't see, so a command
// carrying them is NEVER auto-read — it drops to ASK.
for hazard in ["$", "`", "\\"] where trimmed.contains(hazard) { return false }
```

### 2. Some "read" programs execute things

`env` looks harmless: it prints environment variables. But `env some-program` *runs* `some-program`. It is an execution primitive and was removed from the allow-list.

### 3. Whitespace evades string matching

The dangerous marker `"rm -rf"` didn't match `rm⇥-rf` (with a tab) or `rm  -rf` (two spaces). The fix normalizes all whitespace before matching:

```swift
// Match against a whitespace-normalised form so tabs / extra spaces can't
// evade the markers (`rm⇥-rf`, `rm  -rf` both become `rm -rf`).
let lowered = normalizedForMatching(command)
```

### 4. "Always allow" can over-grant

This is the subtlest one, and it needs its own section.

## Learning Permissions Without Over-Granting

When the user approves a command, they can choose **allow once** or **always allow**. "Always" learns a pattern and saves it to `.iassist/permissions.json`, so it survives restarts:

```swift
// `git commit -m "x"` → `git commit *`
// `npm install lodash` → `npm install *`
// `ls`                 → `ls *`
public static func pattern(for command: String) -> String
```

The danger is generalizing too far. If you approve `git push origin main` once with "always", the learned pattern `git push *` would later auto-approve `git push --force`. Approving `chmod 644 file` would learn `chmod *`, which covers `chmod -R 777 /`.

So two kinds of commands can **never** be learned:

```swift
public static func learnablePattern(for command: String) -> String? {
    if isCompound(command) || isDangerous(command) { return nil }
    return pattern(for: command)
}
```

- **Dangerous commands**: they always ask, no matter what you approved before.
- **Compound commands**: `cd x && rm -rf y` would reduce to `cd *`, a rule that whitelists far more than the user saw.

When `learnablePattern` returns `nil`, the UI simply doesn't offer "always allow".

## A Shell That Remembers `cd`

The first bash tool started a new process per command. That meant `cd src` followed by `ls` listed the wrong directory, and `export` did nothing.

iAssist moved to a **persistent shell**: one long-lived `zsh` per session, so `cd` and `export` persist. It sits behind a transport protocol:

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

A persistent shell brought new bugs, and fixing them shaped the design:

```text
fix(shell): anchored cwd policy + deterministic teardown + lifecycle readout
fix(workflow): stop persistent-shell cwd leaking across rounds
fix(bash): out-of-workspace reads no longer auto-run
```

If the agent `cd`s outside the workspace, later "relative" commands would run there. The working directory is now anchored and checked, and each shell is torn down deterministically when its session ends.

## Auto Mode With a Veto Window

Manual approval for every `swift build` gets tiring. The Mac app has an **Auto** mode: write-tier actions show the permission prompt with a **countdown** and approve automatically unless you click "deny".

This is deliberately implemented at the prompter layer, not in the shell policy, because that is the one place that also sees file edits. The policy comment warns future maintainers:

> "Do NOT wire the footer mode into `.auto` below: that path auto-approves writes SILENTLY (no prompt, no countdown), bypassing the GUI's veto window."

Dangerous commands still always ask, in every mode.

## Key Takeaways

- Use risk tiers, and make "ask" the default for anything not positively known to be safe.
- Treat quotes, variables, escapes and whitespace as attack surface; normalize before matching.
- Never learn permissions for dangerous or compound commands.
- Persistent shells need an anchored working directory and deterministic teardown.
- Give the human a veto window, even in auto mode.

In Part 6 we look at how one agent delegates work to another without filling its own context with the details.

{% include iassist-series-nav.html %}
