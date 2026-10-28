---
layout: insight
title: "Building iAssist, Part 7: Context Engineering — Prompts, Budgets and Compaction"
permalink: /en/insights/ai/building-iassist/07-context-engineering/
date: 2026-10-28
part: 7
category: AI Development
tags: [AI, Swift, Context Engineering, Prompt Engineering, LLM Tools]
description: "How iAssist builds its system prompt from capability-derived sections, measures context pressure honestly, and compacts long conversations without breaking them."
---

# Building iAssist, Part 7: Context Engineering — Prompts, Budgets and Compaction

*Everything the model knows is in one array. Here's how iAssist keeps that array honest, small and valid.*

{% include iassist-series-nav.html %}

## Context Is the Whole Game

A model sees two things: the system prompt and the message history. Nothing else. "Context engineering" is the craft of deciding what goes into those two, in what shape, and what gets removed when space runs out.

iAssist treats context as a first-class product feature. There's even a `/context` command that shows **exactly** what the model sees, byte for byte, including the system prompt. Many bugs in this article were found by simply looking.

## Part 1: The System Prompt as Composable Sections

The system prompt is not one big string. It's an ordered list of titled sections, with runtime facts injected into `{{placeholder}}` slots:

```swift
public struct PromptSection: Sendable, Equatable {
    public let title: String?   // nil → a bare preamble with no header
    public let body: String
}

public struct Prompt: Sendable, Equatable {
    public private(set) var sections: [PromptSection]
    // render(filling: ["cwd": ..., "today": ...]) → one string
}
```

iAssist's prompt follows the established shape of a coding-agent prompt: **role, environment, tool policy, engineering workflow, output style, session snapshot**. The code says it aims for the "right altitude": specific enough to steer behaviour, general enough not to be brittle.

The environment section contains real values, gathered at startup: allowed directories, platform, OS version, today's date, and a one-line git summary (branch plus number of changed files). The directories are read **live** on every turn, so `/add-dir` is reflected immediately.

## Derive the Prompt From Real Capabilities

Remember from Part 4 that every tool declares a capability. The prompt is built from those, so it can never promise something that isn't there:

```swift
public static func iAssist(_ env: PromptEnvironment,
                           capabilities: Set<ToolCapability>) -> String
```

The clearest example is the "Using tools" section. An agent with write and shell tools is told to just call them, because the user approves each action anyway. A **read-only** agent is told the truth:

```text
You can read and search within these directories, but you have no tools to
modify files or run commands. When a task needs writing a file or running
something, don't pretend and don't keep searching for a way in — say so
plainly and tell the user exactly what to do.
```

This single paragraph removed a whole family of loops where a read-only model hunted for a write tool it didn't have.

## What's Deliberately Missing: A Tool Catalog

The prompt doesn't list tools. Providers already send each tool's name, description and schema as a structured array, and that array is correct per agent: the root agent's includes `spawn_agent`, a sub-agent's does not. Listing tools in prose as well would duplicate that and could **lie to a sub-agent** about a tool it lacks.

## Prompt Lines Come From Real Sessions

Several paragraphs in the prompt have a comment explaining which session produced them. One example: a session started inside Xcode's `DerivedData/Build/Products` folder. The agent ran `find` over the whole home directory, timed out twice, retried the same search, and kept saying "no source here".

The prompt now says: keep searches inside your directories, narrow a search that times out instead of repeating it, and if the working directory is clearly build output, say so once and suggest `/add-dir`.

Another rule: when a request is vague ("what's going on here?"), **investigate first** with read-only tools, then answer. Ask only when it is still unclear after looking.

## Part 2: Knowing How Full the Window Is

Every model has a context limit. Hitting it means the provider rejects the request and the turn is lost. iAssist checks **before** each model call.

Two honesty rules govern the budget code:

> **1. Measure when you can.** Providers report the real token count of what was just sent. Anchor on that and estimate only what's been added since.
>
> **2. Unknown is not zero.** A local Ollama model or Apple's on-device model has no window we can look up. That's reported to the user, never silently treated as "plenty of room".

```swift
public enum ContextBudget: Sendable, Equatable {
    case known(Int)
    case unknown(reason: String)   // shown to the user: what's missing, what to do
}
```

When there's no measurement yet, a deliberately conservative estimate is used: 3.5 characters per token instead of the usual 4, because code and JSON are denser than English. Over-estimating trips the guard a bit early, which is harmless. Under-estimating loses a turn.

The reading becomes a pressure level: `ok`, `warning` (75% full by default), `critical` (90%), or `unknown`. The loop reports it only when it **changes**, so a long run doesn't repeat the same warning every iteration.

## Part 3: Compaction That Doesn't Break the Transcript

When pressure is critical and auto-compaction is enabled, the oldest part of the conversation is folded into a summary. This sounds simple. It has one sharp edge.

Providers require that every assistant tool call is **immediately followed** by its tool result. Cut the history in the wrong place and the next request fails with HTTP 400 because of an orphaned result. So the compactor is split into pure, testable steps:

```swift
// plan(_:keepRecent:)   — PURE. Decides where to cut. No network.
// apply(_:to:summary:)  — PURE. Builds the new array from a plan + summary.
// compact(...)          — thin async glue that asks the provider to summarize.

public static func plan(_ messages: [AgentMessage], keepRecent: Int) -> Plan? {
    guard keepRecent > 0, messages.count > keepRecent else { return nil }
    var dropCount = messages.count - keepRecent
    // Advance to the next clean user turn so the kept tail is a valid start.
    while dropCount < messages.count && !isCleanStart(messages[dropCount]) {
        dropCount += 1
    }
    guard dropCount < messages.count else { return nil }   // no safe cut → refuse
    return Plan(dropCount: dropCount, keptCount: messages.count - dropCount)
}
```

Two details are worth copying:

- **Refusing is the safe failure.** If there's no clean user-turn boundary, the compactor returns `nil`. A broken window is worse than a large one.
- **The summary is merged into the first kept user message**, not inserted as a separate message. A separate message would either start with an assistant turn or put two user turns side by side, shapes some providers reject.

## Part 4: Repairing Histories From Elsewhere

The live loop always pairs tool calls with results. But histories also come from disk, from resumed sessions and from imported Claude Code sessions. One real 10 MB imported session had **33** split tool batches: Claude Code writes several tool calls of one turn as separate lines, then all results in one line.

`MessagePairing.repaired(_:)` runs at the send boundary and on import:

1. **Coalesce** consecutive tool-call messages into one, keeping the real results.
2. Make sure each call id has exactly one result; insert a stub only for a truly missing one.
3. Drop orphan results.

It's idempotent: on a clean history it changes nothing.

## The Live Context Window

In the Mac app, a context window view shows the history growing in real time: the system prompt at the top, then every message, tool call and result as it's appended. After a compaction, the loop sends a "reseed" event and the view replaces its contents instead of appending, because the context was *replaced*, not extended.

## Key Takeaways

- Build the system prompt from sections, and derive them from the agent's real capabilities.
- Tell a limited agent what it can't do; it stops looking for a way in.
- Measure token usage when the provider reports it; treat "unknown" as a state, not as zero.
- Compact only at clean user-turn boundaries, and refuse when there is none.
- Repair tool-call pairing at the send boundary for any history you didn't produce live.

In Part 8 we move from agents that decide their own next step to workflows where the code decides, starting with a generate–critique–revise loop.

{% include iassist-series-nav.html %}
