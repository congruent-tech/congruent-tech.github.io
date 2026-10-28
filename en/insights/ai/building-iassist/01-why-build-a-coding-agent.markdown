---
layout: insight
title: "Building iAssist, Part 1: Why We Built Our Own Coding Agent in Swift"
permalink: /en/insights/ai/building-iassist/01-why-build-a-coding-agent/
date: 2026-10-28
part: 1
category: AI Development
tags: [AI, Swift, Coding Agents, LLM Tools, macOS, Architecture]
description: "The story behind iAssist: how studying coding agents turned into a native Swift agent with a runnable REPL, a SwiftUI inspector and a Mac app called Parto."
---

# Building iAssist, Part 1: Why We Built Our Own Coding Agent in Swift

*How a research question ("how do coding agents actually work?") became a native Swift agent, a Mac app, and an 11-part series*

{% include iassist-series-nav.html %}

## The Question That Started It

Tools like Claude Code changed how we write software. You describe a task, and the agent reads files, runs commands, edits code and reports back. From the outside it feels like magic. From the inside, we suspected, it had to be a fairly small set of ideas repeated carefully.

We wanted to know exactly which ideas. Not from blog posts, but by building one. iAssist is the result: a coding agent written from scratch in Swift, first as a terminal REPL, later as a native macOS app called **Parto**.

This series walks through how iAssist was developed, step by step, following the real git history. Every article focuses on one idea that turned out to matter, with the code that implements it.

## Phase 0: Study First (September 2025)

The project started as a research phase. We read and compared open-source agents and their documentation:

- **aider** — a mature terminal pair-programmer with strong git integration
- **goose** — an extensible agent with a plugin model
- **claw-code** and the **Claude Agent SDK** — to understand the tool-loop contracts
- **Swift Talk episode 480** by objc.io — a ~200-line single-file coding agent in Swift

That last one was the most useful. It proved that the core of a coding agent fits on a few screens. Its loop ends when the model's response contains zero tool calls. That one observation became the backbone of iAssist.

We also wrote down how Claude Code *behaves*: how it asks for permission, how it shows what it is doing, how it keeps sub-tasks out of the main conversation. Those behaviours became our acceptance criteria.

## Phase 1: The 75-Step Plan We Didn't Follow

The first plan was ambitious: 75 steps across five phases and 15+ weeks, from "Foundation" to "Advanced Cognitive Architecture". We also drafted a leaner, protocol-oriented V2.

The tension between the two plans is a lesson in itself. The big plan described *what* a finished product might look like. The lean plan described *the smallest thing that could actually run*. Only the second one shipped.

> **Lesson:** For agent work, a runnable 200-line loop teaches you more in a day than a 75-step plan teaches you in a month.

## Phase 2: A Clean Start (June 2026)

In June 2026 the repository's `.git` folder was corrupted after a volume copy: missing blobs, a broken tree object at `HEAD`. Instead of fighting it, we recovered with a fresh `git init`, committed each Swift package as a clean baseline in dependency order, and kept the old history as a backup.

From there, the pace changed. On a single day, the first commits landed:

```text
feat(TreeModel): generic immutable Tree<A> with traversal helpers
feat(TreeLayout): Reingold-Tilford layout over TreeModel
feat(iAssistCore): agent stack — cognitive loop, tools, providers, activity tree
feat(iAssistConsole): main program — runnable REPL with live agent tree
refactor: introduce Agent protocol, promote RunResult to top-level
feat: add permission-gated bash tool
```

By the end of that week iAssist could read, search and edit files, run shell commands behind a permission prompt, and delegate work to sub-agents. It ran against a small local model (`qwen2.5:3b` via Ollama on an M1) and against Anthropic's API.

## The Architecture at a Glance

iAssist is a set of Swift packages, each with one job. The core has **zero external dependencies** and talks to model APIs with plain `URLSession`.

| Package | Responsibility |
|---|---|
| `iAssistCore` | The agent loop, tools, providers, prompts, context management, workflows |
| `iAssistConsole` | The terminal REPL: line editor, slash commands, spinner, permission prompts |
| `iAssistInspector` | The SwiftUI Mac app (later named Parto) |
| `iAssistMCP` | Model Context Protocol servers exposed as agent tools |
| `iAssistMemory` | Curated, durable memory facts |
| `iAssistMetrics` | Token usage and cost tracking with SwiftData |
| `iAssistSync` | CloudKit groundwork for syncing history between devices |
| `TreeModel` / `TreeLayout` | A generic tree and its layout, used for the agent tree view |
| `iAssistRender` / `iAssistShaping` | Rendering answers as rich markdown and HTML |

Today the project has around 240 commits and roughly 26,000 lines of Swift across 16 packages.

<div class="mermaid">
flowchart LR
  User --> Console[iAssistConsole / Parto app]
  Console --> Core[iAssistCore]
  Core --> Loop[CognitiveLoop]
  Loop --> Provider[Provider: Ollama / Anthropic / Apple]
  Loop --> Tools[Tools: files, shell, spawn, web, MCP]
  Core --> Memory[iAssistMemory]
  Core --> Metrics[iAssistMetrics]
</div>

## The Style Rule Behind the Code

One rule shaped every refactor, written down early in the project journal:

> "High levels read like a story, low levels hold detail; abstract only what's stable."

You will see it throughout the series. The top of a file reads like a description of the idea. The mechanics live in small named helpers below. Protocols are introduced only once a concept has stopped changing, not before.

Here is how that looks in the console's main loop, simplified:

```swift
func converseWithUser() async {
    while let input = await readUserInput() {
        if isSlashCommand(input) {
            await handleSlashCommand(input)
            continue
        }
        await takeTurn(input)
    }
}
```

Anyone can read this and understand what the program does. The details of reading input, parsing commands and running a turn are one click away.

## What Makes an Agent Different From a Chatbot

The rest of the series is built on one distinction. A chatbot takes a message and returns text. An agent takes a message and may *act* before it answers:

1. It sends the conversation to a model.
2. The model either answers, or asks to use a tool.
3. The agent runs the tool and sends the result back.
4. Repeat until the model answers.

Everything else, from permissions to memory to sub-agents, exists to make that loop **safe, observable and affordable**. Those three words are a good summary of what we learned.

## What This Series Covers

1. **Why we built it** (this article)
2. **The cognitive loop**: the 20-line idea and the guards that make it reliable
3. **Protocols and providers**: one seam for Ollama, Anthropic and Apple's on-device model
4. **File tools**: reading, searching and editing code inside a sandbox
5. **Shell safety**: a risk-tiered policy that learns what you trust
6. **Sub-agents**: delegating work without polluting the context
7. **Context engineering**: system prompts, token budgets and compaction
8. **Workflows**: when code, not the model, decides the next step
9. **Memory**: curated facts the model looks up only when needed
10. **The Mac app**: Parto, MCP servers and rich answer rendering
11. **Sync, strategy and lessons learned**

## Key Takeaways

- The core of a coding agent is small. Its reliability is not.
- Start from a runnable loop and grow it, not from a 75-step plan.
- Keep a zero-dependency core so every front-end (terminal, GUI, tests) shares one engine.
- Let high-level code read like a story; push detail down.

In Part 2 we open up the heart of iAssist: the `CognitiveLoop`, and the five guards that keep it from spinning forever.

{% include iassist-series-nav.html %}
