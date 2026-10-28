---
layout: insight
title: "AI Agent Memory as a Tool: Long-Term Memory Without Prompt Stuffing"
permalink: /en/insights/ai/building-iassist/09-memory-as-a-tool/
date: 2026-10-28
part: 9
series: "Building iAssist"
category: AI Development
tags: [Agent Memory, Long-Term Memory, LLM Memory, Context Engineering, Tool Calling, Session Persistence, Coding Agents]
description: "How iAssist gives an AI agent long-term memory: curated facts instead of logs, recall as a tool with a living table of contents, and importing Claude Code history."
---

# AI Agent Memory as a Tool: Long-Term Memory Without Prompt Stuffing

*Logs are not memory. Curated facts are, and the model should ask for them when it needs them.*

{% include iassist-series-nav.html %}

## Two Different Things Called "Memory"

When people say an agent "remembers", they usually mean one of two things:

1. **History**: the conversation can be saved, closed and resumed later.
2. **Learning**: the agent knows things across *all* conversations, like "this user prefers tabs" or "we decided not to use CoreData in this project".

iAssist built both, and confused them once along the way. That mistake shaped the final design, so it's worth telling.

## Step 1: A Durable, Neutral Conversation Log

The first goal was simple: never lose a conversation. Every session is saved automatically as two files:

```text
~/Library/Application Support/iAssist/sessions/
  <id>.jsonl        ← one neutral AgentMessage per line, appended as the turn runs
  <id>.meta.json    ← title, timestamps, model, working folder
```

JSON Lines suits this well: appending a message means appending a line, and a crash loses at most the line being written. Because the messages use the neutral model from Part 3, a session can be resumed with a different provider than it was recorded with.

The **History** window lists all sessions, lets you resume one, and later learned to show a **recap** of what a session did before you open it. Each session also remembers its working folder, so resuming restores the right directory, not just the right messages.

## Step 2: Importing Claude Code History

Many developers already have months of context in Claude Code. iAssist notices when the folder you open has Claude Code history and offers to import it:

```text
feat(inspector): notice when the working folder already has Claude Code history
feat(inspector): preview + import Claude Code context from the banner
perf(inspector): lazy "head" preview for large Claude Code contexts
```

The import was harder than expected. A real session was 10 MB and froze the preview, which is why the preview now reads only the head of the file. And as Part 7 described, Claude Code stores the tool calls of one turn as separate lines, so imported histories go through the tool-pairing repair before they can be sent to a model.

A separate package, `iAssistClaudeImport`, also imports Claude Code's *memory*: `CLAUDE.md` files and memory folders, with an import ledger so the same item is never imported twice.

## Step 3: The Mistake, and the Re-Scope

An early `iAssistMemory` package stored saved contexts, which meant whole conversations. A few days later it was deleted as orphaned, because History already did that job better.

Then it came back with a different purpose:

```text
feat(memory): re-scope iAssistMemory as the curated learning memory (not logs)
```

The insight: **a transcript is not knowledge**. A 200-message session might contain three facts worth keeping. Memory should store those three facts, not the 200 messages.

## The Shape of a Memory Fact

```swift
struct MemoryFact {
    let id: UUID
    let name: String        // stable kebab-case slug, e.g. "prefers-tabs"; the identity
    let summary: String     // one line, for recall and for the table of contents
    let kind: Kind          // .user | .feedback | .project | .reference
    let body: String        // the durable statement itself
    let related: [String]   // [[links]] to other facts
    let createdAt: Date
    let updatedAt: Date
}
```

Two rules keep memory clean:

- **Upsert by name.** Saving a fact with an existing name *replaces* it. Re-learning a topic supersedes the old version instead of creating duplicates that contradict each other.
- **One JSON file per fact.** Memory is a folder you can open, read, edit and back up. Nothing is hidden in a database.

## Writing Memory: Distillation

How do facts get created? After a turn (when memory is enabled), a model call **distills** it: what in this exchange is a durable fact about the user or project? Most turns produce nothing, which is the point.

A **Memory window** lets you browse every fact and switch memory on or off. You can see exactly what the agent believes about you.

## Reading Memory: Injection vs. Tool

The obvious way to use memory is **injection**: before each turn, guess what's relevant and add it to the prompt. iAssist's plan rejected that as the default:

> "Always-on, costs tokens every turn even when memory is irrelevant, and *we* decide relevance, not the model."

Instead, memory is a **tool**, `recall_memory`, that the model calls when it decides it needs to know something. That is dynamic, pay-per-use, and the model is in control.

## The Cold-Start Problem and the Living Table of Contents

Tool-based memory has one weakness: **the model can't call a tool for something it doesn't know exists**. If it has no idea you have a "prefers-tabs" fact, it won't look it up.

The fix is the most elegant idea in the memory design. The tool's *description* is generated each time and contains a **table of contents** of current memory: just names and one-line summaries.

```swift
public var spec: AgentToolSpec {
    let toc = (try? store.all())?
        .sorted { $0.updatedAt > $1.updatedAt }
        .prefix(50)
        .map { "  • \($0.name) — \($0.summary)" }
        .joined(separator: "\n") ?? ""
    return AgentToolSpec(
        name: "recall_memory",
        description: """
        Look up something from your durable memory of THIS user and project. \
        Call this BEFORE assuming or asking, whenever the task touches a topic below.
        You currently remember (call to read the full detail of any):
        \(toc.isEmpty ? "  (nothing yet)" : toc)
        """,
        inputSchemaJSON: ...
    )
}
```

The model always sees the cheap index, so it never forgets that memory exists or what's in it. It fetches the full body only when needed. This beats both pure injection (which pushes every body every turn) and pure tool use (which forgets memory exists).

## Teaching the Model *When* to Recall

A tool the model never calls is dead weight. The plan calls the description "the single highest-leverage lever for correct timing" and recommends an explicit trigger list:

```text
Call recall_memory WHEN:
  • the user refers to the past — "like last time", "the usual", "as we discussed"
  • you are about to ASSUME a preference or a project convention — check first
  • the task touches any topic in the list below
Do NOT call it for general programming knowledge, or for anything you can read
from the code/git right now.
```

The "Do NOT" line matters as much as the "WHEN". Over-calling memory makes it slow and noisy, which teaches users to switch it off.

## Memory You Can Watch

Because recall is a tool call, every lookup appears in the transcript and in the agent tree. You literally see the agent consult its memory, and which fact it read. Injection hides that. For a tool that claims to be inspectable, this visibility is the whole point.

The current implementation keeps recall **opt-in** and **host-side**: the app provides the tool, isolated from the core loop, so the loop itself stays unaware of memory. A model-driven `remember` tool for writing facts is the planned next step.

## Key Takeaways

- Separate history (resume a conversation) from memory (durable facts across conversations).
- Store curated facts, not transcripts, and upsert them by a stable name.
- Prefer memory as a tool over prompt injection; let the model decide when it needs it.
- Solve cold start with a live table of contents in the tool's description.
- Write explicit "call this when" and "do not call this when" rules.

In Part 10 we leave the terminal behind: the Mac app Parto, MCP servers, and rendering answers as rich documents.

{% include iassist-series-nav.html %}
