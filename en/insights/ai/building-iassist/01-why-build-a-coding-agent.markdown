---
layout: insight
title: "How to Build an AI Coding Agent in Swift: The iAssist Story"
permalink: /en/insights/ai/building-iassist/01-why-build-a-coding-agent/
date: 2026-10-28
part: 1
category: AI Development
tags: [AI Coding Agent, How to Build an AI Agent, Agent Architecture, Agent Harness, LLM Agents, Swift, macOS, Claude Code]
description: "How we built iAssist, an AI coding agent in Swift: agent architecture, harness design and lessons from studying Claude Code, aider and goose. Part 1 of 11."
series: "Building iAssist"
---

# How to Build an AI Coding Agent in Swift: The iAssist Story

*How a research question ("how do coding agents actually work?") became a native Swift agent, a Mac app, and an 11-part series*

{% include iassist-series-nav.html %}

## The Magic Trick Fits on a Few Screens

You describe a task. The agent reads your files, runs commands, edits the code and reports back. From the outside, tools like Claude Code feel like magic. From the inside, we suspected, there had to be a fairly small set of ideas repeated very carefully.

The best way to find out which ideas was to build one. iAssist is what came out of that: a coding agent written from scratch in Swift, first as a terminal REPL and later as a native macOS app called **Parto**.

This series follows the real git history, wrong turns included. Each article takes one idea that turned out to matter and shows the code behind it.

## Before Writing Code, We Read Everyone Else's

The project began in September 2025 as pure research, reading and comparing open-source agents and their documentation:

- **aider** — a mature terminal pair-programmer with strong git integration
- **goose** — an extensible agent with a plugin model
- **claw-code** and the **Claude Agent SDK** — to understand the tool-loop contracts
- **Swift Talk episode 480** by objc.io — a ~200-line single-file coding agent in Swift

The smallest of these taught us the most. That Swift Talk episode proved the core of a coding agent fits on a few screens, and its loop ends the moment the model's response contains zero tool calls. That one observation became the backbone of iAssist.

We also wrote down how Claude Code *behaves*: how it asks for permission, how it shows what it is doing, how it keeps sub-tasks out of the main conversation. Those notes became our acceptance criteria.

## The 75-Step Plan We Didn't Follow

Then came the grand plan: 75 steps across five phases and 15+ weeks, running from "Foundation" to "Advanced Cognitive Architecture". Next to it we drafted a leaner, protocol-oriented V2.

The big plan described what a finished product might look like. The lean plan described the smallest thing that could actually run. Only one of them shipped.

> **Lesson:** For agent work, a runnable 200-line loop teaches you more in a day than a 75-step plan teaches you in a month.

## A Corrupted Repo and a Very Good Day

In June 2026 a volume copy corrupted the repository's `.git` folder: missing blobs, and a broken tree object at `HEAD`. We didn't fight it. A fresh `git init`, each Swift package committed as a clean baseline in dependency order, the old history kept as a backup, and we moved on.

From there, the pace changed. These commits all landed on a single day:

```text
feat(TreeModel): generic immutable Tree<A> with traversal helpers
feat(TreeLayout): Reingold-Tilford layout over TreeModel
feat(iAssistCore): agent stack — cognitive loop, tools, providers, activity tree
feat(iAssistConsole): main program — runnable REPL with live agent tree
refactor: introduce Agent protocol, promote RunResult to top-level
feat: add permission-gated bash tool
```

By the end of that week iAssist could read, search and edit files, run shell commands behind a permission prompt, and delegate work to sub-agents. It ran against Anthropic's API, and against a small local model (`qwen2.5:3b` via Ollama) on an M1.

## Sixteen Packages, Zero Dependencies in the Core

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

Today that adds up to around 240 commits and roughly 26,000 lines of Swift across 16 packages.

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

One sentence, written early in the project journal, shaped every refactor that followed:

> "High levels read like a story, low levels hold detail; abstract only what's stable."

The top of a file reads like a description of the idea, while the mechanics sit in small named helpers below it. Protocols only appear once a concept has stopped changing. Here is the console's main loop, simplified:

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

You can read that without knowing Swift and still know what the program does.

## What Makes an Agent Different From a Chatbot

A chatbot takes a message and returns text. An agent takes a message and may *act* before it answers:

1. It sends the conversation to a model.
2. The model either answers, or asks to use a tool.
3. The agent runs the tool and sends the result back.
4. Repeat until the model answers.

That's the whole trick. Everything else, from permissions to memory to sub-agents, exists to make that loop **safe, observable and affordable**. If you remember three words from this series, make it those.

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

The loop really is about 20 lines. Within an hour of running it for the first time, it had already started failing in interesting ways. Part 2 is about those failures, and the guards they forced us to build.

{% include iassist-series-nav.html %}
