---
layout: insight
title: "Agentic Workflows in Swift: The Evaluator-Optimizer Pattern"
permalink: /en/insights/ai/building-iassist/08-workflows-evaluator-optimizer/
date: 2026-10-28
part: 8
series: "Building iAssist"
category: AI Development
tags: [Agentic Workflows, Evaluator-Optimizer, LLM-as-a-Judge, Agent Orchestration, Prompt Chaining, Routing, Swift Generics]
description: "Agents vs. workflows: type-safe workflow combinators in Swift (chain, parallel, router, refine) and a generate-critique-revise loop where the critic judges real tool evidence."
---

# Agentic Workflows in Swift: The Evaluator-Optimizer Pattern

*When the model shouldn't decide the next step: type-safe workflows, and a critic that judges evidence, not prose*

{% include iassist-series-nav.html %}

## Agents vs. Workflows

Anthropic's guidance on building effective agents draws a useful line:

- In an **agent**, the model decides the next step. It picks tools, reads results and chooses what to do next.
- In a **workflow**, the code decides the next step. The model does the work inside each step, but the path is fixed by the program.

Everything in Parts 2 to 7 was an agent. That's the right choice for open-ended tasks like "fix this bug". But some tasks have a known shape: draft, review, revise. Letting the model improvise that shape wastes tokens and makes results less predictable. iAssist's workflow engine expresses those shapes in code.

## One Abstraction: A Typed Step

The whole engine is built on a single protocol:

```swift
public protocol WorkflowStep<Input, Output>: Sendable {
    associatedtype Input: Sendable
    associatedtype Output: Sendable

    var label: String { get }   // a short label for the dataflow view
    func run(_ input: Input, _ context: WorkflowContext) async throws -> Output
}
```

A step turns a typed input into a typed output. Steps compose, and the compiler checks the composition:

```swift
/// Chain: this step's `Output` feeds `next`'s `Input`.
/// It only compiles when the types line up.
func then<Next: WorkflowStep>(_ next: Next) -> Chain<Self, Next>
    where Next.Input == Output
```

Pipelines can carry strings, structured findings or numbers, not only text. If you connect a step producing `[Finding]` to one expecting `String`, the code doesn't compile. Mistakes that would be runtime surprises in a dynamic framework are caught by the type checker.

## The Five Building Blocks

The core ships five combinators, which map onto the common workflow patterns:

| Combinator | Pattern | What it does |
|---|---|---|
| `AgentStep` | Leaf | Runs a real agent: `String → String` |
| `Transform` | Conversion | Converts between types, e.g. parse an agent's JSON into a struct |
| `Chain` | Prompt chaining | Output of one step feeds the next |
| `Parallel` | Fan-out / fan-in | Runs branches at the same time, then joins the results |
| `Router` | Routing | Classifies the input and runs only the matching branch |
| `Refine` | Evaluator-optimizer | Generate, evaluate, repeat until it passes |

Every step reports start, finish and failure events as it runs, through `runReporting`. Because combinators emit their own node, a UI can draw the actual **composition** as a tree: `a.then(b).then(c)` shows up as `Chain(Chain(a, b), c)`.

## Refine: Generate, Critique, Revise

The most useful pattern in practice is `Refine`, Anthropic's **evaluator-optimizer**. In the Mac app it's a toggle: switch it on, and each request runs as a workflow instead of a single agent.

One round looks like this:

<div class="mermaid">
flowchart LR
  T[Task] --> G[Generate: agent with all tools]
  G --> E[Evaluate: tool-less critic]
  E -->|PASS| A[Answer]
  E -->|REVISE + feedback| G
</div>

1. **Generate**: a full agent with all tools does the task. Its tool calls and results are captured as **evidence**.
2. **Evaluate**: a separate critic, with **no tools**, reviews the answer.
3. If the critic says PASS, the answer is returned. Otherwise its feedback goes into the next generate round, until a round budget runs out.

## The Critic Must See the Evidence

The first version of the critic only saw the task and the final answer. It failed in a predictable way: it judged the **prose**. A terse but correct answer ("Built and ran, output is Hello World") got sent back for "not showing the output". A confident but wrong answer could pass.

The fix was to give the critic the generate round's actual tool transcript:

```text
fix(workflow): give the critic the generate round's tool EVIDENCE
```

The critic's system prompt now says exactly how to treat it:

```text
You are a strict reviewer judging whether a candidate fully and correctly
completed a task. You don't do the work yourself — you judge what was done.

You are given the TASK, the EVIDENCE, and the candidate's ANSWER. The EVIDENCE
is the candidate's ACTUAL tool calls and their results — a real execution
transcript captured by the system, not a claim the candidate is making.
Trust it as ground truth.

Judge against the EVIDENCE, not the prose.
```

This is the key idea of the whole pattern. An LLM judging another LLM's text is weak. An LLM judging a **real execution transcript** (did the build actually succeed? did the test actually run?) is much stronger. It's also why "verification" becomes the strategic theme of Part 11.

## Not Every Question Is a Failure

Another bug: the generator sometimes correctly asked a clarifying question ("Which of the two targets should I build?"). The critic treated that as an incomplete answer and demanded a revision, wasting a whole round.

```text
fix(workflow): critic PASSes a legitimate clarifying question (no wasted round)
```

A good evaluator knows when the right answer is a question.

## Keeping the Conversation Clean

A refine turn may run three generate rounds and three critiques. None of that belongs in the conversation history. Like sub-agents in Part 6, only the **final, clean prompt → answer pair** is saved. The rounds are shown in the agent tree and in a dedicated **Flow panel**, but they don't pollute future turns.

## Bugs That Only Workflows Find

Running the same agent several times in a row exposed state that leaked between runs:

```text
fix(workflow): stop persistent-shell cwd leaking across rounds
```

Round 2 started in whatever directory round 1 had `cd`'d into. Each round now gets a clean, anchored working directory. And the context window view had to learn to show round contexts in **temporal order**, so you can follow what each round saw.

## Turn Strategies: One Harness, Two Shapes

As the workflow became a real feature, the code that started a turn grew two near-copies: one for a normal agent turn, one for a refine turn. The refactor lifted both into values of one protocol:

```swift
// AgentTurn  = "run one agent (it may spawn sub-agents); persist the transcript".
// RefineTurn = "run an agent, review it against its evidence, repeat until a
//              critic passes it or the round budget runs out".
public struct RefineTurn: TurnStrategy {
    public let rounds: Int
    public let criticPrompt: String   // injectable evaluation policy
}
```

This layer moved from the app into `iAssistCore`, so any host (GUI, terminal, a headless test harness) can run either kind of turn. It reports progress through a neutral observer: the core says "a refine round produced this verdict", and the host decides whether that's a badge, a panel or a log line.

## Workflow Explorer: Dogfooding the Engine

To make sure the abstraction stands on its own, a separate SwiftUI app, **Workflow Explorer**, builds all five patterns from the same combinators and animates the resulting graph live from the event stream.

Its benchmark is a small IT help desk: 12 support tickets with known correct categories. Each pattern processes the same ticket ("The VPN keeps dropping every few minutes"):

| Pattern | Result |
|---|---|
| Transform | `[Network] The VPN keeps dropping…` |
| Chain | classify → resolve → format |
| Parallel | `category=Network · priority=High · system=VPN` |
| Router | routes to NetOps; scores 11/12 over the batch |
| Refine | draft → SLA check → adds "escalate to NetworkOps" |

The Router honestly gets one ticket wrong: ticket 12 mentions both "password" and "VPN", and first-match ordering sends it to the wrong team. Every leaf is deterministic, so runs are reproducible, and the benchmark shows the limits of simple logic as clearly as its strengths.

## Key Takeaways

- Use agents for open-ended tasks and workflows for tasks with a known shape.
- Make workflow steps typed, so the compiler checks how they connect.
- In evaluator-optimizer loops, let the critic judge real execution evidence, not the answer's wording.
- Accept a legitimate clarifying question as a valid outcome.
- Keep workflow rounds out of the conversation history; save only the clean result.

In Part 9 we give the agent a long-term memory, and explain why we made memory a tool instead of stuffing it into every prompt.

{% include iassist-series-nav.html %}
