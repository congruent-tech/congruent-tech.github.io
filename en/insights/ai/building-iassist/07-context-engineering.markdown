---
layout: insight
title: "Context Engineering for Coding Agents: Prompts, Budgets, Compaction"
permalink: /en/insights/ai/building-iassist/07-context-engineering/
date: 2026-10-28
part: 7
category: AI Development
tags: [Context Engineering, Context Window, Context Compaction, System Prompt, Prompt Engineering, Token Budget, Coding Agents]
description: "Context engineering in practice: capability-derived system prompts, honest token budgets, context compaction at safe boundaries and repairing tool_use/tool_result pairs."
series: "Building iAssist"
---

# Context Engineering for Coding Agents: Prompts, Budgets, Compaction

*Everything the model knows is in one array. Here's how iAssist keeps that array honest, small and valid.*

{% include iassist-series-nav.html %}

## Context Is the Whole Game

A session started inside Xcode's `DerivedData/Build/Products` folder. The agent ran `find` over the whole home directory, timed out twice, retried the same search, and kept insisting "no source here". The model wasn't the problem. Nothing in what it could see told it that it was standing in build output, or what to do about a search that times out.

A model sees two things: the system prompt and the message history. Nothing else. "Context engineering" is the craft of deciding what goes into those two, in what shape, and what gets removed when space runs out.

iAssist treats this as a first-class product feature. A `/context` command shows **exactly** what the model sees, byte for byte, including the system prompt, and many of the bugs in this article were found by simply looking.

## A System Prompt Made of Parts

The system prompt is not one big string. It's an ordered list of titled sections, with runtime facts injected into {% raw %}`{{placeholder}}`{% endraw %} slots:

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

It follows the established shape of a coding-agent prompt: **role, environment, tool policy, engineering workflow, output style, session snapshot**. The code says it aims for the "right altitude": specific enough to steer behaviour, general enough not to be brittle.

The environment section holds real values gathered at startup: allowed directories, platform, OS version, today's date, and a one-line git summary (branch plus number of changed files). The directories are read **live** on every turn, so `/add-dir` takes effect immediately.

## A Prompt That Can't Overpromise

Part 4 had every tool declare a capability. The prompt is built from those declarations, so it can never promise something that isn't there:

```swift
public static func iAssist(_ env: PromptEnvironment,
                           capabilities: Set<ToolCapability>) -> String
```

The "Using tools" section shows why this matters. An agent with write and shell tools is told to just call them, because the user approves each action anyway. A **read-only** agent is told the truth:

```text
You can read and search within these directories, but you have no tools to
modify files or run commands. When a task needs writing a file or running
something, don't pretend and don't keep searching for a way in — say so
plainly and tell the user exactly what to do.
```

That single paragraph removed a whole family of loops where a read-only model hunted for a write tool it didn't have.

The prompt also deliberately leaves something out: a tool catalog. Providers already send each tool's name, description and schema as a structured array, and that array is correct per agent. The root agent's includes `spawn_agent`, and a sub-agent's does not. Listing tools in prose as well would duplicate that, and could **lie to a sub-agent** about a tool it lacks.

## Prompt Lines Come From Real Sessions

Several paragraphs in the prompt carry a comment naming the session that produced them. The `DerivedData` disaster is one. The prompt now says: keep searches inside your directories, narrow a search that times out instead of repeating it, and if the working directory is clearly build output, say so once and suggest `/add-dir`.

Another rule came from vague requests like "what's going on here?". The agent should **investigate first** with read-only tools and then answer, asking only if things are still unclear after looking.

## Unknown Is Not Zero

Every model has a context limit, and hitting it means the provider rejects the request and the turn is lost. So iAssist checks **before** each model call, under two honesty rules:

> **1. Measure when you can.** Providers report the real token count of what was just sent. Anchor on that and estimate only what's been added since.
>
> **2. Unknown is not zero.** A local Ollama model or Apple's on-device model has no window we can look up. That's reported to the user, never silently treated as "plenty of room".

```swift
public enum ContextBudget: Sendable, Equatable {
    case known(Int)
    case unknown(reason: String)   // shown to the user: what's missing, what to do
}
```

When there's no measurement yet, the estimate is deliberately conservative: 3.5 characters per token instead of the usual 4, because code and JSON are denser than English. The asymmetry justifies it. Over-estimating trips the guard a bit early, which is harmless, while under-estimating loses a turn.

The reading becomes a pressure level: `ok`, `warning` (75% full by default), `critical` (90%), or `unknown`. The loop reports it only when it **changes**, so a long run doesn't repeat the same warning every iteration.

## Compaction Has One Sharp Edge

When pressure is critical and auto-compaction is enabled, the oldest part of the conversation is folded into a summary. The catch is that providers require every assistant tool call to be **immediately followed** by its tool result. Cut the history in the wrong place and the next request fails with HTTP 400 because of an orphaned result.

So the compactor is split into pure, testable steps:

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

Two choices here are worth stealing:

- **Refusing is the safe failure.** If there's no clean user-turn boundary, the compactor returns `nil`. A broken window is worse than a large one.
- **The summary is merged into the first kept user message**, not inserted as a separate message. A separate message would either start with an assistant turn or put two user turns side by side, shapes some providers reject.

## Repairing Histories From Elsewhere

The live loop always pairs tool calls with results, but histories also come from disk, from resumed sessions and from imported Claude Code sessions. One real 10 MB imported session had **33** split tool batches, because Claude Code writes several tool calls of one turn as separate lines, then all the results in one line.

`MessagePairing.repaired(_:)` runs at the send boundary and on import:

1. **Coalesce** consecutive tool-call messages into one, keeping the real results.
2. Make sure each call id has exactly one result; insert a stub only for a truly missing one.
3. Drop orphan results.

It's idempotent: on a clean history it changes nothing.

## Watching the Window Fill

In the Mac app, a context window view shows the history growing in real time: the system prompt at the top, then every message, tool call and result as it's appended. After a compaction, the loop sends a "reseed" event and the view replaces its contents instead of appending, because the context was *replaced*, not extended.

## Key Takeaways

- Build the system prompt from sections, derived from the agent's real capabilities, and tell a limited agent what it can't do.
- Measure token usage when the provider reports it; treat "unknown" as a state, not as zero.
- Compact only at clean user-turn boundaries, and refuse when there is none.
- Repair tool-call pairing at the send boundary for any history you didn't produce live.

Until now, the model has chosen every next step. But some tasks have a known shape, and letting the model improvise it wastes tokens. Part 8 hands the steering wheel to the code, and shows what happened when a critic was asked to judge an answer without seeing the evidence.

{% include iassist-series-nav.html %}
