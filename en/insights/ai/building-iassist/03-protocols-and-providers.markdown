---
layout: insight
title: "Building iAssist, Part 3: Protocols and the Provider Seam"
permalink: /en/insights/ai/building-iassist/03-protocols-and-providers/
date: 2026-10-28
part: 3
category: AI Development
tags: [AI, Swift, Protocol-Oriented Programming, Ollama, Anthropic, Apple Intelligence]
description: "How one small Swift protocol lets iAssist run the same agent loop against a local Ollama model, Anthropic's API and Apple's on-device model."
---

# Building iAssist, Part 3: Protocols and the Provider Seam

*One method, three very different models, zero changes to the agent loop*

{% include iassist-series-nav.html %}

## Why Seams Matter in an Agent

A coding agent depends on things that change constantly: models, APIs, pricing, UIs. If the loop knows about any of them directly, every change ripples through the whole codebase.

iAssist solves this with a few small protocols, each introduced only once the concept behind it had stopped changing. The project journal states the rule: *abstract only what's stable*.

## The Provider Protocol: One Method

The entire contract between the agent loop and a language model is this:

```swift
public protocol AgentProvider: Sendable {
    func send(messages: [AgentMessage], tools: [AgentToolSpec]) async throws -> AgentReply
}
```

The loop sends a neutral message history and a list of tool specifications. It gets back a neutral reply: either text, or a list of tool calls, plus optional token usage, optional "narration" text and a truncation flag.

Everything provider-specific lives behind this method. The loop has never had to change when a new backend was added.

## The Neutral Message Model

The messages themselves are provider-neutral too:

```swift
public struct AgentMessage {
    public let role: Role          // .user, .assistant, .tool
    public let content: Content    // .text, .toolCalls([ToolCall]), .toolResult(callId:output:isError:)
}
```

This neutral model became more valuable than expected. It is what gets saved to disk, what gets imported from other tools, and what the context inspector shows. One shape, everywhere.

## Backend 1: Local Models Through an OpenAI-Compatible API

The first provider talked to `/chat/completions`, the OpenAI-compatible endpoint offered by **Ollama**, **LM Studio** and **llama.cpp**. That meant iAssist ran fully offline from day one, with `qwen2.5:3b` on an M1 MacBook.

Small local models are excellent teachers. They fail early and visibly, which is how most of the loop guards from Part 2 were discovered.

## Backend 2: Anthropic, and the Shape of a Transcript

Adding Anthropic's Messages API revealed that "neutral" needs translation. Two examples from the commit history:

**Tool results must be batched.** iAssist stores one `.tool` message per tool result. Anthropic expects all results of one assistant turn in a *single* user message. The provider merges them on the way out:

```text
fix(anthropic): batch tool results into one user turn; roomier cloud output
```

**Every tool call needs a result, immediately after it.** Otherwise the API returns HTTP 400. The live loop always pairs them correctly, but imported or compacted histories might not. That led to a repair step at the send boundary, covered in Part 7.

The lesson: the neutral model is iAssist's truth, and each provider is an **adapter** that translates it into the backend's native shape.

## Backend 3: Apple's On-Device Model, Which Has No Tools API

Apple's on-device Foundation Model (macOS 26+) is interesting because it has **no native tool-calling API**. You give it instructions and a prompt, and you get text back.

Instead of special-casing it, iAssist added a reusable adapter for any text-only model:

```swift
/// The one thing a text-only model must do: complete a prompt, given instructions, as text.
public protocol TextModelBackend: Sendable {
    func complete(instructions: String, prompt: String) async throws -> String
}
```

A `PromptToolBridge` does the translation work:

- tools → a description inside the instructions
- message history → a flat transcript
- the model's text reply → a neutral tool call, if it asked for one

`TextModeProvider<Backend>` glues the two into an `AgentProvider`. Adding the Apple model cost one small conformance. Any future text-only model costs the same.

The code is honest about scope, in a comment worth quoting:

> "A SMALL (~3B) on-device model — good for chat and light tasks, not a substitute for Claude or a strong local Llama at multi-step, tool-heavy coding."

## Choosing a Provider at Runtime

Users switch models with `/model` in the terminal or a toggle in the Mac app. A single `ProviderSelector` builds every provider, so the terminal and the GUI can never drift apart in how they configure models:

```swift
public enum ProviderKind: String, CaseIterable {
    case anthropic, local, apple
}
```

Later, each conversation got its **own** provider configuration. Two Mac windows can talk to two different models at the same time: one to Claude for hard work, one to a local model for quick questions.

## Decorators: Adding Features Without Touching Providers

Because every provider has the same one-method shape, cross-cutting features wrap it instead of modifying it. Token metering is the clearest example:

```swift
// MeteredProvider wraps ANY provider and reports each call's facts
// (model, tokens, duration) to a recorder outside the core.
let provider = MeteredProvider(
    wrapping: anthropic,
    recorder: usageRecorder,
    providerName: "anthropic",
    modelId: modelId,
    modelLabel: "Opus · Anthropic · effort High",
    effort: "high"
)
```

The core reports *facts* (timestamp, model id, tokens). It never learns about prices or storage. The `iAssistMetrics` package (SwiftData) turns those facts into a cost dashboard. Local and on-device calls are priced as free, a detail that was itself a bug fix:

```text
fix(metrics): price on-device/local turns as free, not at Anthropic rates
```

A debug "wire tap" works the same way: `/debug` shows the raw traffic to and from the model, which is invaluable when a provider rejects a request.

## The Agent Protocol

The same idea applies one level up. Anything that *is* an agent conforms to:

```swift
public protocol Agent: Sendable {
    var id: AgentID { get }
    var events: AsyncStream<LoopEvent> { get }
    func run(messages: [AgentMessage]) async throws -> RunResult
}
```

The spawn tool and the console hold `any Agent`, not the concrete `CognitiveLoop`. That made it possible to build agents with different behaviour later, without touching their callers.

## Why Protocols, Not a Base Class?

The journal answers this directly: protocols plus composition avoid the fragile base class problem. A `MeteredProvider` doesn't inherit from `AnthropicProvider`. It *contains* any provider. Features stack like Lego instead of forming a deep hierarchy where changing the parent breaks the children.

## A Small but Telling Default: Temperature

One more provider detail: sampling temperature became configurable, with a **low default**. For a coding agent that reads files and calls tools, predictable beats creative. A low temperature noticeably reduced random tool choices on small models.

## Key Takeaways

- Keep the model contract tiny: one `send` method, neutral in and neutral out.
- Treat each backend as an adapter that translates the neutral model into its native shape.
- Build reusable bridges (like text-mode tool calling) instead of special cases.
- Add cross-cutting features like metering as decorators around the protocol.
- Introduce a protocol when the concept is stable, not before.

In Part 4 we give the agent its hands: file tools that read, search and edit code, safely inside a workspace.

{% include iassist-series-nav.html %}
