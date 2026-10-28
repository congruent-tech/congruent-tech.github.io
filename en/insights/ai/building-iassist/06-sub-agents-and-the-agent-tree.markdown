---
layout: insight
title: "Building iAssist, Part 6: Sub-Agents and the Live Agent Tree"
permalink: /en/insights/ai/building-iassist/06-sub-agents-and-the-agent-tree/
date: 2026-10-28
part: 6
category: AI Development
tags: [AI, Swift, Multi-Agent, Coding Agents, SwiftUI, Data Structures]
description: "How iAssist delegates sub-tasks to child agents with isolated context, why only the conclusion comes back, and how the agent tree is recorded and drawn."
---

# Building iAssist, Part 6: Sub-Agents and the Live Agent Tree

*"Release execution, retain conclusion": delegating work without flooding the context*

{% include iassist-series-nav.html %}

## The Problem Sub-Agents Solve

Remember the key fact from Part 2: the whole message history is the context, and it is resent on every iteration. Now imagine the user asks, "Find out how authentication works in this repo, then add rate limiting."

The research part might read 30 files. All of that text lands in the conversation and stays there for the rest of the session. It costs tokens on every following turn, and it buries the important parts under noise.

A **sub-agent** fixes this. The main agent hands a self-contained task to a fresh child agent. The child does the heavy reading in its own private transcript and returns only a short answer. The parent's context grows by one paragraph instead of 30 files.

## The Spawn Tool

In iAssist, delegation is just another tool, `spawn_agent`. Its description tells the model when to use it:

```text
Delegate a self-contained sub-task to a fresh sub-agent that has its own
isolated context. Blocks until the sub-agent finishes and returns only its
final answer (not its internal work). Use this to keep your own context
small when a sub-task involves a lot of reading or steps.
```

The implementation is short:

```swift
public func run(argumentsJSON: String) async throws -> String {
    guard depth < maxDepth else {
        throw SpawnError.depthLimitReached(maxDepth: maxDepth)
    }
    let task = try Self.parseTask(from: argumentsJSON)

    let child = await makeChild(task, depth + 1)
    let result = try await child.run(userMessage: task)

    if let reason = result.haltReason {
        throw SpawnError.childHalted(reason: reason, summary: result.finalText)
    }
    return result.finalText
    // `child` has no surviving strong reference past this point → ARC frees
    // it and its transcript. Only `finalText` escapes into the parent.
}
```

Three design decisions are packed into these lines.

## Decision 1: Blocking, Not Fire-and-Forget

The parent `await`s the child. Because the loop awaits every tool call, the parent is parked until the child finishes. It literally cannot write its answer based on half-finished work.

Background agents are attractive, but they bring hard questions: what happens if the parent finishes first? Who merges the results? A later design document explores background tasks for the Mac app, but the core deliberately started with the simple, correct version.

## Decision 2: Only the Conclusion Survives

The child is a local value inside `run`. When `run` returns, nothing holds a reference to it, so Swift's ARC frees it **and its entire transcript**. Only `finalText` crosses back into the parent.

The project journal sums it up in four words: *release execution, retain conclusion*. Memory use stays flat no matter how much work the children do.

## Decision 3: A Depth Guard

Without a limit, a child could spawn a child that spawns a child. Each level costs tokens and time, and runaway trees are a real failure mode with small models.

`maxDepth` defaults to 1: the root agent (depth 0) may spawn children, but a child is refused if it tries to spawn its own. The tree is at most two levels deep. And because the spawn tool is simply not given to children, a child's tool list doesn't even mention it. The system prompt (Part 7) never lists tools in prose for the same reason: it could lie to a sub-agent about a tool it doesn't have.

## When a Child Gives Up

An early bug showed why outcomes from Part 2 matter. A child hit its step limit and returned "I reached my step limit…". The parent read that text as a finished answer and built on it.

Now a halted child **throws**. The loop turns the error into a tool result marked `isError: true`, which is a signal the parent already knows how to react to. The child's own explanation rides along:

```swift
case .childHalted(let reason, let summary):
    return """
    the sub-agent did NOT finish the task — it \(reason.shortDescription). \
    Do not treat its report as a completed result. It said: \(summary)
    """
```

The parent can retry, split the task further, or tell the user honestly.

## Recording the Tree

Since children are freed immediately, how can a UI show what they did? iAssist keeps a separate, cheap ledger: the `AgentActivityRecorder`, a Swift actor that records "who spawned whom" during a turn.

```swift
public struct AgentNode: Sendable, Codable, Identifiable {
    public let id: AgentID
    public let parentID: AgentID?
    public let label: String       // user message for the root, task for a child
    public var status: AgentStatus // .running, .finished, .failed
    // final answer or failure reason; never a transcript
}
```

It stores only display-worthy facts: a label, a status, a short result. The expensive transcripts are still released. The recorder is fed from the existing event streams; nothing in it reaches into `CognitiveLoop`.

## A Generic Tree, Then a Layout

The ledger becomes a `Tree<AgentNode>`. The tree type lives in its own tiny package, `TreeModel`, and knows nothing about agents:

```swift
public struct Tree<A: Sendable>: Sendable {
    public let value: A
    public let children: [Tree<A>]
}
```

It is immutable (you build a new tree to express change), and it gets `map`, `nodeCount`, `depth` and `preorder` traversal. Keeping it generic means it can represent a process tree or a file tree just as well.

In the terminal, `/tree` renders it with branch connectors after each turn:

```text
✓ Find how auth works, then add rate limiting → Added a token-bucket limiter…
├─ ✓ Map the authentication flow in Sources/Auth → JWT issued in AuthService…
└─ ✓ List every HTTP route that needs limiting → 7 routes under /api/v1…
```

A second package, `TreeLayout`, implements the classic **Reingold–Tilford** algorithm, which positions tree nodes so subtrees don't overlap and parents sit centered above their children. This powers the graphical tree view.

## From Snapshot to Live Inspector

In the terminal, the tree is a snapshot after the turn, because spawning blocks. The next step was a live view. The `iAssistInspector` package started as a SwiftUI window that shows the agent tree **while it runs**: nodes appear as children are spawned and turn green or red as they finish.

That inspector grew into the Mac app, Parto (Part 10). It began as a debugging tool and became the product, because watching agents work turned out to be the feature people valued most.

## Telling the User Who Needs Them

Once several agents and windows could run at the same time, a new problem appeared: which one is waiting for me? A later round of "agent-view triage" added:

- a **dock badge** when an agent needs input (for example, a permission prompt)
- short **summaries** per agent node
- an **agents count**, so you see at a glance how much is running

## Key Takeaways

- Delegate heavy, self-contained work to sub-agents to keep the main context small.
- Return only the conclusion; let the child and its transcript be freed.
- Guard the depth, and don't hand children tools they shouldn't use.
- A child that gave up must surface as an error, not as an answer.
- Record a cheap ledger for the UI, separate from the expensive transcripts.

In Part 7 we look at the context itself: how the system prompt is assembled, how tokens are budgeted, and how a long conversation is compacted without breaking it.

{% include iassist-series-nav.html %}
