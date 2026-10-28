---
layout: insight
title: "Building iAssist, Part 2: The Cognitive Loop at the Heart of an Agent"
permalink: /en/insights/ai/building-iassist/02-the-cognitive-loop/
date: 2026-10-28
part: 2
category: AI Development
tags: [AI, Swift, Coding Agents, Agent Loop, Concurrency]
description: "How iAssist's CognitiveLoop works: send history, run tools, repeat, and the guards that stop it from looping forever or failing silently."
---

# Building iAssist, Part 2: The Cognitive Loop at the Heart of an Agent

*The 20-line idea every coding agent shares, and the guards that make it trustworthy*

{% include iassist-series-nav.html %}

## The Idea in Three Steps

Every coding agent, from Claude Code to a 200-line demo, runs the same cycle. iAssist calls it the `CognitiveLoop`, and its file opens with the whole idea:

```swift
// 1. Send the whole message history to the provider (the LLM).
// 2. If the model replies with plain text → we're done. Return it.
// 3. If the model asks to use tools → run them, append the results to the
//    history, and go back to step 1.
```

The model has no memory between calls. The **entire message array is the context**, and every iteration resends it in full. That single fact explains most of the engineering that follows: context limits, compaction, sub-agents and memory all exist because of it.

## The Minimal Version

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

This is what we had working on day one, against a 3-billion-parameter model on a laptop. It worked. It also failed in interesting ways within the first hour.

## Failure 1: The Loop That Never Ends

Small models get stuck. The classic case: the model calls `glob .`, gets a file list, then calls `glob .` again, and again. The loop never ends because the model never answers.

iAssist tracks a **signature** of each tool batch. If the same batch repeats three times, the loop stops with an explanation instead of an error:

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

Notice the message. It names the most likely real cause, which is usually "I don't have a tool for this". Often a model asked to write a file with only read-only tools will loop exactly like this.

There is also a plain step budget (`maxIterations`, default 20). Hitting it ends the run with a summary, not a crash, so the steps already taken stay in the context.

## Failure 2: The Silent Truncation

One bug took a while to understand. Asking the agent to write a large file failed with "missing required argument: content". The model kept retrying the same call until the repeat guard fired.

The real cause: the output-token limit was hardcoded to 4,096. The model ran out of tokens *in the middle of the tool call*, so `write_file` arrived as `{"path": "…"}` with no content.

Two fixes followed. The limit became per-model (up to 128K for capable models). And the provider now reports when a reply was truncated, so the loop stops honestly on the **first** turn:

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

Early on, a graceful stop returned the apology text as the final answer. A parent agent (see Part 6) couldn't tell "I finished" from "I gave up". So every result now carries an **outcome**:

```swift
return RunResult(
    agentID: id, finalText: summary,
    iterations: iteration, toolCallsExecuted: toolCallsExecuted,
    messages: messages,
    outcome: .halted(reason)   // .repeatedAction, .outputLimit, .cancelled, ...
)
```

The summary explains the halt to a human. The `reason` explains it to code.

## Failure 4: Stopping Without Breaking Things

Users need a stop button (in iAssist, `Esc`). But stopping an agent is subtle:

- A tool that is **already running** is allowed to finish. Killing a file write or a `git commit` halfway is how repositories get corrupted.
- Tools that **haven't started** are skipped, but each still gets a result message: "Not run — you stopped the turn before this started."
- The final message leads with what the agent **already did**, because written files and executed commands survive the stop.

The "every call gets a result" rule matters because providers reject a transcript where a tool call has no matching result. We will meet this rule again in Part 7.

## Observability: The Event Stream

A loop you can't see is a loop you can't trust. Every `CognitiveLoop` exposes an `AsyncStream<LoopEvent>`:

```swift
public let events: AsyncStream<LoopEvent>
// .iterationStarted, .toolStarted, .toolExecuted, .narrated,
// .modelResponded(usage:duration:), .contextPressure, .finished, .failed ...
```

The terminal UI uses it for the live spinner ("reading Package.swift…"), the Mac app uses it for the agent tree, and the metrics package uses it for token counts.

One contract makes this robust: **every run emits exactly one terminal event and then closes the stream**. A `defer` guarantees it on every exit path:

```swift
defer { continuation.finish() }
```

Without this, an observer waiting on a stream that never finishes would hang forever, and keep the loop alive in memory.

## Honest Metrics

The loop measures throughput (tokens per second) by timing **only the model call**. Tool execution and the time a human spends reading a permission prompt are excluded, otherwise the number would measure your reading speed, not the model.

And it only records a sample when the provider reports real token usage. An estimate is never shown as a measurement. This "never pretend" rule shows up again and again in iAssist.

## Concurrency: Why `Sendable` Matters

`CognitiveLoop` is a `final class` marked `Sendable`: all stored properties are immutable. Each `run` builds its own local history and returns it. This means one loop can be handed across tasks and actors safely, which becomes essential once a parent agent spawns child loops.

## Key Takeaways

- The agent loop is simple; the guards around it are the product.
- Detect non-progress (identical tool batches) and stop with a useful explanation.
- Treat truncation, cancellation and step limits as **outcomes**, not exceptions.
- Expose a live event stream with a strict "exactly one terminal event" contract.
- Measure only what you really measured.

In Part 3 we look at the seams that let the same loop talk to a local Ollama model, Anthropic's API and Apple's on-device model without changing a line of loop code.

{% include iassist-series-nav.html %}
