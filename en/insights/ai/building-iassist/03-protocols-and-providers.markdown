---
layout: insight
title: "LLM Provider Abstraction: Ollama, Anthropic and Apple Models in Swift"
permalink: /en/insights/ai/building-iassist/03-protocols-and-providers/
date: 2026-10-28
part: 3
category: AI Development
tags: [LLM Provider Abstraction, Ollama, Local LLM, Anthropic API, Apple Foundation Models, Tool Calling, Protocol-Oriented Programming, Swift]
description: "One Swift protocol runs the same AI agent on local LLMs via Ollama, the Anthropic API and Apple Foundation Models, incl. tool calling for text-only models."
series: "Building iAssist"
---

# LLM Provider Abstraction: Ollama, Anthropic and Apple Models in Swift

*One method, three very different models, zero changes to the agent loop*

{% include iassist-series-nav.html %}

## An Agent Loop on a Model With No Tools

Apple's on-device model has no tool-calling API. You hand it instructions and a prompt, and it hands you back text. iAssist's agent loop runs on it anyway, along with a local Ollama model and Anthropic's cloud API, and the loop has no idea which one it is talking to.

That matters because a coding agent depends on things that change constantly: models, APIs, pricing, UIs. If the loop knows about any of them directly, every change ripples through the whole codebase. iAssist's answer is a few small protocols, each introduced only after the concept behind it had stopped changing. The project journal states the rule: *abstract only what's stable*.

## The Entire Contract Is One Method

Here is everything the agent loop asks of a language model:

```swift
public protocol AgentProvider: Sendable {
    func send(messages: [AgentMessage], tools: [AgentToolSpec]) async throws -> AgentReply
}
```

The loop sends a neutral message history and a list of tool specifications. It gets back a neutral reply: either text or a list of tool calls, plus optional token usage, optional "narration" text and a truncation flag. Everything provider-specific lives behind that method, and the loop has never had to change when a new backend arrived.

The messages are just as neutral:

```swift
public struct AgentMessage {
    public let role: Role          // .user, .assistant, .tool
    public let content: Content    // .text, .toolCalls([ToolCall]), .toolResult(callId:output:isError:)
}
```

This shape turned out to be worth more than we expected. It is what gets saved to disk, what gets imported from other tools, and what the context inspector shows. One shape, everywhere.

## Backend 1: Small Local Models Are Excellent Teachers

The first provider talked to `/chat/completions`, the OpenAI-compatible endpoint offered by **Ollama**, **LM Studio** and **llama.cpp**. That meant iAssist ran fully offline from day one, with `qwen2.5:3b` on an M1 MacBook.

A weak model is a gift during development, because it fails early and visibly. Most of the loop guards from Part 2 were discovered this way.

## Backend 2: Anthropic, and the Shape of a Transcript

Anthropic's Messages API showed us that "neutral" still needs translation. iAssist stores one `.tool` message per tool result, but Anthropic expects all the results of one assistant turn in a *single* user message. So the provider merges them on the way out:

```text
fix(anthropic): batch tool results into one user turn; roomier cloud output
```

The API is stricter still: every tool call needs its result immediately after it, or you get an HTTP 400. The live loop always pairs them correctly, but imported or compacted histories might not, which led to a repair step at the send boundary (Part 7).

The neutral model stays iAssist's truth, and each provider is an **adapter** that translates it into the backend's native shape.

## Backend 3: Teaching a Text-Only Model to Call Tools

Now back to Apple's on-device Foundation Model (macOS 26+). Rather than special-case it, iAssist added a reusable adapter for any model that can only do text:

```swift
/// The one thing a text-only model must do: complete a prompt, given instructions, as text.
public protocol TextModelBackend: Sendable {
    func complete(instructions: String, prompt: String) async throws -> String
}
```

A `PromptToolBridge` does the translation:

- tools → a description inside the instructions
- message history → a flat transcript
- the model's text reply → a neutral tool call, if it asked for one

`TextModeProvider<Backend>` glues the two into an `AgentProvider`. Adding the Apple model cost one small conformance, and any future text-only model costs the same.

The code stays honest about what this buys you, in a comment worth quoting:

> "A SMALL (~3B) on-device model — good for chat and light tasks, not a substitute for Claude or a strong local Llama at multi-step, tool-heavy coding."

## Two Windows, Two Models

Users switch models with `/model` in the terminal or a toggle in the Mac app. A single `ProviderSelector` builds every provider, so the terminal and the GUI can never drift apart in how they configure models:

```swift
public enum ProviderKind: String, CaseIterable {
    case anthropic, local, apple
}
```

Later, each conversation got its **own** provider configuration, so two Mac windows can talk to two different models at once: Claude for the hard work, a local model for quick questions.

## Features That Wrap Instead of Modify

When every provider has the same one-method shape, cross-cutting features can wrap it instead of changing it. Token metering is the clearest example:

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

The core reports *facts* (timestamp, model id, tokens) and never learns about prices or storage. The `iAssistMetrics` package (SwiftData) turns those facts into a cost dashboard. Local and on-device calls are priced as free, which we only got right after a bug had been charging them at Anthropic's rates:

```text
fix(metrics): price on-device/local turns as free, not at Anthropic rates
```

A debug "wire tap" works the same way: `/debug` shows the raw traffic to and from the model, which is invaluable when a provider rejects a request.

## The Same Trick, One Level Up

Anything that *is* an agent conforms to its own small protocol:

```swift
public protocol Agent: Sendable {
    var id: AgentID { get }
    var events: AsyncStream<LoopEvent> { get }
    func run(messages: [AgentMessage]) async throws -> RunResult
}
```

The spawn tool and the console hold `any Agent`, not the concrete `CognitiveLoop`, so agents with different behaviour could arrive later without touching their callers.

## Why Protocols, Not a Base Class?

The journal answers this directly: protocols plus composition avoid the fragile base class problem. A `MeteredProvider` doesn't inherit from `AnthropicProvider`. It *contains* any provider. Features stack like Lego instead of forming a deep hierarchy where changing the parent breaks the children.

## For Agents, Predictable Beats Creative

One small default says a lot. Sampling temperature became configurable, with a **low default**, because an agent that reads files and calls tools has no use for creativity in its tool choices. On small models, the lower temperature noticeably reduced random ones.

## Key Takeaways

- Keep the model contract tiny: one `send` method, neutral in and neutral out.
- Treat each backend as an adapter, and build reusable bridges (like text-mode tool calling) instead of special cases.
- Add cross-cutting features like metering as decorators around the protocol.
- Introduce a protocol when the concept is stable, not before.

The agent can now think on any model. It still can't touch anything. Part 4 gives it hands, and discovers that the biggest lever on tool quality is the wording of its error messages.

{% include iassist-series-nav.html %}
