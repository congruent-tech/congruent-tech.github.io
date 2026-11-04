---
layout: insight
title: "Sub-Agents and Multi-Agent Delegation: Context Isolation in Practice"
permalink: /en/insights/ai/building-iassist/06-sub-agents-and-the-agent-tree/
date: 2026-10-28
part: 6
category: AI Development
tags: [Sub-Agents, Multi-Agent Systems, Agent Orchestration, Context Isolation, Agent Observability, SwiftUI, Coding Agents]
description: "How a coding agent delegates to sub-agents with isolated context windows, returns only the conclusion, guards depth and visualizes the multi-agent tree in SwiftUI."
series: "Building iAssist"
---

# Sub-Agents and Multi-Agent Delegation: Context Isolation in Practice

*"Release execution, retain conclusion": delegating work without flooding the context*

{% include iassist-series-nav.html %}

## Thirty Files In, One Paragraph Out

Remember the key fact from Part 2: the whole message history is the context, and it is resent on every iteration. Now imagine the user asks, "Find out how authentication works in this repo, then add rate limiting."

The research might read 30 files. All of that text lands in the conversation and stays there for the rest of the session, costing tokens on every following turn and burying the important parts under noise.

A **sub-agent** fixes this. The main agent hands a self-contained task to a fresh child, which does the heavy reading in its own private transcript and returns a short answer. The parent's context grows by one paragraph instead of 30 files.

## Delegation Is Just Another Tool

In iAssist the mechanism is a tool called `spawn_agent`, and its description tells the model when to reach for it:

```text
Delegate a self-contained sub-task to a fresh sub-agent that has its own
isolated context. Blocks until the sub-agent finishes and returns only its
final answer (not its internal work). Use this to keep your own context
small when a sub-task involves a lot of reading or steps.
```

The implementation is short, and almost every line is a design decision:

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

## The Parent Waits

The parent `await`s the child. Since the loop awaits every tool call, the parent stays parked until the child finishes, and it literally cannot write its answer based on half-finished work.

Background agents are attractive, but they bring hard questions: what happens if the parent finishes first? Who merges the results? A later design document explores background tasks for the Mac app, but the core deliberately started with the simple, correct version.

## Only the Conclusion Survives

The child is a local value inside `run`. When `run` returns, nothing holds a reference to it, so Swift's ARC frees it **and its entire transcript**. Only `finalText` crosses back into the parent.

The project journal sums it up in four words: *release execution, retain conclusion*. Memory use stays flat no matter how much work the children do.

## Children Can't Have Children

Without a limit, a child could spawn a child that spawns a child. Each level costs tokens and time, and runaway trees are a real failure mode with small models.

`maxDepth` defaults to 1: the root agent (depth 0) may spawn children, but a child that tries to spawn its own is refused, so the tree is at most two levels deep. The spawn tool isn't even given to children, so a child's tool list doesn't mention it. The system prompt (Part 7) never lists tools in prose for the same reason, since that could lie to a sub-agent about a tool it doesn't have.

## When a Child Gives Up, the Parent Must Know

An early bug showed why the outcomes from Part 2 matter. A child hit its step limit and returned "I reached my step limit…". The parent read that as a finished answer and built on it.

Now a halted child **throws**. The loop turns the error into a tool result marked `isError: true`, a signal the parent already knows how to react to, and the child's own explanation rides along:

```swift
case .childHalted(let reason, let summary):
    return """
    the sub-agent did NOT finish the task — it \(reason.shortDescription). \
    Do not treat its report as a completed result. It said: \(summary)
    """
```

The parent can retry, split the task further, or tell the user honestly.

## How Do You Show Work That No Longer Exists?

Children are freed immediately, so how can a UI show what they did? iAssist keeps a separate, cheap ledger: the `AgentActivityRecorder`, a Swift actor that records who spawned whom during a turn.

```swift
public struct AgentNode: Sendable, Codable, Identifiable {
    public let id: AgentID
    public let parentID: AgentID?
    public let label: String       // user message for the root, task for a child
    public var status: AgentStatus // .running, .finished, .failed
    // final answer or failure reason; never a transcript
}
```

It stores only display-worthy facts: a label, a status, a short result. The expensive transcripts are still released, and because the recorder is fed from the existing event streams, nothing in it reaches into `CognitiveLoop`.

## A Generic Tree, Then a Layout

The ledger becomes a `Tree<AgentNode>`. The tree type lives in its own tiny package, `TreeModel`, and knows nothing about agents:

```swift
public struct Tree<A: Sendable>: Sendable {
    public let value: A
    public let children: [Tree<A>]
}
```

It is immutable (you build a new tree to express change) and comes with `map`, `nodeCount`, `depth` and `preorder` traversal. Being generic, it could represent a process tree or a file tree just as well.

In the terminal, `/tree` renders it with branch connectors after each turn:

```text
✓ Find how auth works, then add rate limiting → Added a token-bucket limiter…
├─ ✓ Map the authentication flow in Sources/Auth → JWT issued in AuthService…
└─ ✓ List every HTTP route that needs limiting → 7 routes under /api/v1…
```

A second package, `TreeLayout`, powers the graphical view with the classic **Reingold–Tilford** algorithm, which positions nodes so subtrees don't overlap and parents sit centered above their children.

## The Debugging Window That Became the Product

In the terminal the tree is a snapshot after the turn, because spawning blocks. A live view was the obvious next step. The `iAssistInspector` package started as a SwiftUI window that shows the agent tree **while it runs**: nodes appear as children are spawned and turn green or red as they finish.

That window grew into the Mac app, Parto (Part 10). What began as a debugging tool became the product, because watching agents work turned out to be a feature in its own right.

## Which Agent Is Waiting for Me?

Once several agents and windows could run at the same time, that question became a real one. A later round of "agent-view triage" answered it with:

- a **dock badge** when an agent needs input (for example, a permission prompt)
- short **summaries** per agent node
- an **agents count**, so you see at a glance how much is running

## Key Takeaways

- Delegate heavy, self-contained work to keep the main context small, and let the child and its transcript be freed.
- Guard the depth, and don't hand children tools they shouldn't use.
- A child that gave up must surface as an error, not as an answer.
- Keep a cheap ledger for the UI, separate from the expensive transcripts.

Sub-agents buy time, but they don't stop the main conversation from growing. Eventually the window fills up, and cutting a transcript in the wrong place gets your next request rejected outright. Part 7 is about keeping that one array honest, small and valid.

{% include iassist-series-nav.html %}
