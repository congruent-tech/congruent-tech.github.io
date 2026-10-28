---
layout: insight
title: "Local-First Sync, Agent Verification and Lessons from Building an AI Agent"
permalink: /en/insights/ai/building-iassist/11-sync-strategy-and-lessons/
date: 2026-10-28
part: 11
series: "Building iAssist"
category: AI Development
tags: [Local-First, CloudKit Sync, Hybrid Logical Clock, Open-Weight Models, Agent Verification, AI Agent Reliability, Lessons Learned]
description: "CloudKit sync with tombstones and hybrid logical clocks, why verification on your own toolchain is the real edge for open-weight coding agents, and 10 lessons from iAssist."
---

# Local-First Sync, Agent Verification and Lessons from Building an AI Agent

*The last part: syncing history across devices, the strategy behind Parto, and what we would tell anyone building an agent*

{% include iassist-series-nav.html %}

## Syncing Conversations Between Devices

Once Parto stored every conversation (Part 9), the next request was obvious: see the same history on another Mac, and eventually on an iPhone. The `iAssistSync` package mirrors conversation history to the user's **private CloudKit database**.

One design invariant governs everything:

> The local store is the **source of truth**. Sync only mirrors it.

Each conversation becomes one CloudKit record, named by the conversation's id. The log travels as an opaque `CKAsset`, the exact bytes on disk with no decoding or re-encoding. Title, timestamps and metadata are separate fields.

That sounds simple. Two data-loss bugs showed it isn't.

## Bug 1: Deletes That Destroy Newer Edits

The first version deleted the cloud record when you deleted a conversation. Picture two Macs: you delete a conversation on one, while the other has just added a message to it. The plain delete wins and the new message is lost.

The fix: a delete is a **tombstone**, a record with a `deletedAt` timestamp and no log. It goes through the same conflict rules as an edit:

- A tombstone deletes locally **only if it is strictly newer** than the local edit.
- Otherwise the edit wins and is pushed again, bringing the conversation back.
- Tombstones are saved locally too, so a stale edit from another device can't bring back a conversation you deliberately deleted.
- Tombstones are purged after 30 days, or immediately when a newer edit resurrects the conversation.

## Bug 2: "Same Second" Is Not "Same Time"

Conflicts are resolved by **last writer wins**. But what if two devices edit within the same second? The first fix broke the tie by comparing content hashes. A second adversarial review re-opened the bug with one sentence: *hash magnitude is not recency*. The tie was broken consistently, but not correctly. An older edit could beat a newer one.

The real fix is a **Hybrid Logical Clock** (HLC) per conversation. An HLC combines wall-clock time with a logical counter, so it moves forward even when two events share a timestamp, or when device clocks disagree slightly. Conflicts are now ordered by:

```text
OrderingKey = (hlc, isLive, contentHash)
  1. the hybrid logical clock (recency)
  2. a live edit beats a tombstone with the same HLC
  3. a content-hash tiebreak only for genuinely concurrent edits
```

How do you know it's right? The package includes a seeded **convergence simulation**: 120 random seeds, each with 2–3 replicas with skewed clocks, driving the real push/apply logic. It asserts that all devices end up identical *and* that the most recent edit wins. It fails under the old hash tiebreak and passes under the HLC. In total, 71 tests cover the sync logic.

The honest status: the merge logic is proven in tests, but the CloudKit transport still needs validation on two real devices with a live container. Fakes can test the algorithm, not the network.

## The iPhone Idea, Critically Examined

The proposal for an iPhone version was ambitious: the phone as a thin shell that queues work into CloudKit, and an idle Mac "in the corner of your eye" picks it up and runs it.

A critical analysis concluded that the goal is sound but two pieces don't work as specified:

- **Idle auto-claim** (any free Mac takes the job) was replaced by explicit ownership and approval by a present human. An agent with shell access shouldn't start work nobody is watching.
- **Using an iCloud Drive folder as the working directory** was replaced by binding the job to a local folder on the Mac when it's claimed.

There was also a deeper issue. A work queue makes the cloud an authoritative upstream, which turns the local-first invariant on its head. Claiming a job needs compare-and-swap semantics ("set status to processing only if it's still pending"), not last-writer-wins. The resulting roadmap starts small: first harden Mac-to-Mac sync, then a **read-only** iPhone viewer, and only then a queue.

## The Strategy: Verification, Not Speed

A Mac coding agent competes with very well-funded tools. Why would anyone use Parto? A strategy analysis tested three theses on their own:

- **Speed through self-hosted open-weight models.** Renting GPUs doesn't beat buying tokens for one developer. The best open coding models are huge and need multi-GPU servers.
- **Workflows on cheap, fast models.** Others already ship parallel agents, and combinators are easy to copy.
- **User-owned context and memory.** Valuable, but memory is quickly becoming a commodity.

None holds up alone. The intersection does:

> A native Mac coding cockpit that runs cheap, fast, open-weight candidates, **verifies every one against your real local toolchain** (compile, type-check, test, lint), ranks them by real execution results, and shows the whole process as an inspectable, reproducible artifact you own.

The key point is reliability. Per-step reliability compounds: an agent that is 90% reliable per step succeeds only about 59% of the time over five steps. Weaker models make each step less reliable, so adding more steps makes things *worse*, unless something catches the failures. A verifier that runs your real tests catches them. A cloud service doesn't have your toolchain. That's the one claim a local app can make that a cloud tool structurally can't.

This connects directly to Part 8: the critic got good only when it judged **real execution evidence**. Verification is the same idea, scaled up into a product.

## Auditing Ourselves

In July 2026 a structured audit reviewed the codebase (the loop, security, tests, UX) with adversarial critics checking the conclusions. It found real problems, and fixing them became the August "loop resilience" work:

- A failed turn used to **discard its whole transcript**, while its file edits stayed on disk. The conversation was silently out of sync with the filesystem. Turns now preserve their work on failure and report an honest outcome.
- The loop couldn't be **stopped**. Now `Esc` stops it cleanly (Part 2).
- Compaction counted **messages**, not tokens, and could only run after a turn. It moved into the loop, measured in tokens (Part 7).
- A local-model request had **no timeout set**, so slow generation was cut off by the 60-second default.

The audit also corrected itself: one supposed gap (tool-call pairing after compaction) turned out to be already handled and fully tested. A good review says what's fine, not only what's broken.

## Ten Lessons From Building iAssist

1. **The loop is small; the guards are the product.** Non-progress detection, truncation handling and honest outcomes matter more than the loop itself.
2. **Never pretend.** Unknown context windows, estimated tokens and failed sub-agents must be reported as such.
3. **Write error messages for the model.** Naming the likely cause halves the number of retries.
4. **Context is the scarcest resource.** Sub-agents, compaction and tool-based memory all exist to protect it.
5. **Derive the prompt from reality.** Build it from the agent's real capabilities, and tell a limited agent what it can't do.
6. **Treat everything the model produces as untrusted.** Shell commands, HTML and paths alike.
7. **Default to asking.** Learn permissions narrowly, never for dangerous or compound commands.
8. **Keep the core UI-free.** One engine served a terminal, a Mac app, a workflow explorer and test harnesses.
9. **Review adversarially, then review the review.** Several of the most serious bugs were found by a second pass that doubted the first.
10. **Judge evidence, not prose.** For critics, for verifiers and for ourselves.

## Where iAssist Goes Next

The open items are clear: streaming responses, so long local generations aren't a blank screen; model-driven memory writes; a real terminal (PTY) for interactive programs; signed distribution through TestFlight; and above all, the **local verifier** that turns Parto's strategy into a feature.

If you're building agents for the Apple platform, or want help bringing an AI agent into your own product, we'd be glad to [talk](/en/contact-us/). Congruent Tech builds exactly this kind of software in Berlin.

{% include iassist-series-nav.html %}
