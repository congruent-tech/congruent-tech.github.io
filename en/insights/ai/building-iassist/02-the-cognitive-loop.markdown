---
layout: insight
title: "The Agentic Loop Explained: Tool Calling in a Coding Agent"
permalink: /en/insights/ai/building-iassist/02-the-cognitive-loop/
date: 2026-10-28
part: 2
category: AI Development
tags: [Agentic Loop, Tool Calling, Function Calling, AI Agent Architecture, Agent Reliability, Swift Concurrency, LLM Agents]
description: "How an agentic loop works: send history, call tools, repeat. Swift code plus the guards that stop infinite tool-call loops, output truncation and silent failures."
series: "Building iAssist"
---

# The Agentic Loop Explained: Tool Calling in a Coding Agent

*The 20-line idea every coding agent shares, and the guards that make it trustworthy*

{% include iassist-series-nav.html %}

## It Worked on Day One. Then It Called `glob .` Forever.

Every coding agent, from Claude Code to a 200-line demo, runs the same cycle. iAssist calls it the `CognitiveLoop`, and its source file opens with the whole idea:

```swift
// 1. Send the whole message history to the provider (the LLM).
// 2. If the model replies with plain text → we're done. Return it.
// 3. If the model asks to use tools → run them, append the results to the
//    history, and go back to step 1.
```

The model has no memory between calls. The **entire message array is the context**, and every iteration resends it in full. Keep that fact in mind, because context limits, compaction, sub-agents and memory all exist because of it.

Stripped of everything else, the loop is short:

```swift
while true {
    let reply = try await provider.send(messages: messages, tools: toolSpecs)

    switch reply.response {
    case .text(let text):
        messages.append(AgentMessage(role: .assistant, content: .text(text)))
        return RunResult(finalText: text, messages: messages)

    case .toolCalls(let calls):
        messages.append(AgentMessage(role: .assistant, content: .toolCalls(calls)))
        for call in calls {
            let (output, isError) = await execute(call)
            messages.append(AgentMessage(
                role: .tool,
                content: .toolResult(callId: call.id, output: output, isError: isError)))
        }
    }
}
```

We had this working on day one, against a 3-billion-parameter model on a laptop. It worked. Within the first hour, it was also failing in interesting ways. The rest of this article is those failures, because the guards they forced are what turn a demo into a tool.

## Failure 1: The Loop That Never Ends

Small models get stuck. The classic case: the model calls `glob .`, gets a file list, then calls `glob .` again, and again. It never answers, so the loop never ends.

iAssist now tracks a **signature** of each tool batch. When the same batch repeats three times, the loop stops and explains itself instead of throwing an error:

```swift
let signature = calls.map { "\($0.name)(\($0.argumentsJSON))" }.joined(separator: ";")
if signature == lastCallSignature {
    identicalRepeats += 1
} else {
    lastCallSignature = signature
    identicalRepeats = 1
}

if identicalRepeats >= maxIdenticalRepeats {
    return stopGracefully("""
    I repeated the same action (\(brief)) \(identicalRepeats) times without \
    making progress, so I stopped. This usually means I don't have a tool for \
    this task or the approach is wrong — tell me how you'd like to proceed.
    """, reason: .repeatedAction)
}
```

Read that message again, because it does more than report a stop. It names the most likely real cause: a model asked to write a file with only read-only tools will often loop exactly like this.

Behind it sits a plain step budget (`maxIterations`, default 20). Hitting it ends the run with a summary rather than a crash, so the steps already taken stay in the context.

## Failure 2: The Silent Truncation

This one took a while to understand. Asking the agent to write a large file failed with "missing required argument: content", and the model kept retrying the same call until the repeat guard fired. The model clearly knew the argument was required, so why did it keep leaving it out?

It didn't. The output-token limit was hardcoded to 4,096, and the model was running out of tokens *in the middle of the tool call*. `write_file` arrived as `{"path": "…"}` with the content cut off.

The limit became per-model (up to 128K for capable models), and the provider now reports when a reply was truncated, so the loop stops honestly on the **first** turn:

```swift
if reply.truncated {
    return stopGracefully("""
    My response hit the model's output-token limit before I could finish, \
    so the tool call I was building was cut off. I stopped rather than run \
    a broken call. Ask me to produce it in smaller pieces and I'll continue.
    """, reason: .outputLimit)
}
```

> **Lesson:** When an agent fails, the most valuable thing it can do is say *why* in words a human can act on.

## Failure 3: Halts That Look Like Answers

Early on, a graceful stop returned its apology as the final answer. A parent agent (see Part 6) couldn't tell "I finished" from "I gave up". So every result now carries an **outcome**:

```swift
return RunResult(
    agentID: id, finalText: summary,
    iterations: iteration, toolCallsExecuted: toolCallsExecuted,
    messages: messages,
    outcome: .halted(reason)   // .repeatedAction, .outputLimit, .cancelled, ...
)
```

The summary explains the halt to a human. The `reason` explains it to code.

## Failure 4: The Stop Button Can Corrupt Your Repo

Users need a stop button (in iAssist, `Esc`), but stopping an agent is subtler than killing a task:

- A tool that is **already running** is allowed to finish. Killing a file write or a `git commit` halfway is how repositories get corrupted.
- Tools that **haven't started** are skipped, but each still gets a result message: "Not run — you stopped the turn before this started."
- The final message leads with what the agent **already did**, because written files and executed commands survive the stop.

That "every call gets a result" rule exists because providers reject a transcript where a tool call has no matching result. It comes back to bite us in Part 7.

## A Loop You Can't See Is a Loop You Can't Trust

Every `CognitiveLoop` exposes an `AsyncStream<LoopEvent>`:

```swift
public let events: AsyncStream<LoopEvent>
// .iterationStarted, .toolStarted, .toolExecuted, .narrated,
// .modelResponded(usage:duration:), .contextPressure, .finished, .failed ...
```

The terminal UI turns those events into its live spinner ("reading Package.swift…"), the Mac app into the agent tree, and the metrics package into token counts.

One contract keeps all of this robust: **every run emits exactly one terminal event and then closes the stream**. A `defer` guarantees it on every exit path:

```swift
defer { continuation.finish() }
```

Without it, an observer waiting on an unfinished stream would hang forever and keep the loop alive in memory.

## Your Reading Speed Is Not a Model Metric

The loop measures throughput (tokens per second) by timing **only the model call**. Tool execution and the time a human spends reading a permission prompt are excluded, otherwise the number would measure your reading speed, not the model.

It also records a sample only when the provider reports real token usage, so an estimate is never shown as a measurement. This "never pretend" rule shows up again and again in iAssist.

## Why `Sendable` Matters

`CognitiveLoop` is a `final class` marked `Sendable`: all stored properties are immutable, and each `run` builds its own local history and returns it. One loop can be handed safely across tasks and actors, which becomes essential the moment a parent agent spawns child loops.

## Key Takeaways

- The agent loop is simple; the guards around it are the product.
- Treat non-progress, truncation, cancellation and step limits as **outcomes** that explain themselves, not as exceptions.
- Expose a live event stream with a strict "exactly one terminal event" contract.
- Measure only what you really measured.

So far the loop has one model behind it. Part 3 asks how the same loop can talk to a local Ollama model, Anthropic's API and Apple's on-device model, which has no tool-calling API at all, without changing a line of loop code.

{% include iassist-series-nav.html %}
