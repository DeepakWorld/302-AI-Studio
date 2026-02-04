# 302-AI-Studio: Vibe Mode Enhancements

## What This Is

302-AI-Studio is an Electron desktop AI chat application with Vibe Mode (Claude Code sandbox integration). This project focuses on improving the Vibe Mode workflow by allowing users to add tasks to the taskboard while the AI is still streaming output.

## Core Value

Users can capture task ideas immediately without waiting for AI output to complete — input during streaming goes directly to the taskboard.

## Current Milestone: v1.1 Streaming Input to Taskboard

**Goal:** When AI is streaming in Vibe Mode, redirect chat input to taskboard instead of queuing messages.

**Target features:**
- Auto-detect streaming state and redirect input to taskboard
- Upload attachments to sandbox and reference paths in task content
- Show toast notification confirming task was added
- Clear input after adding to taskboard

## Previous Milestone (v1.0 Shipped)

**Shipped:** 2026-02-04

All streaming contexts now have instant completion detection:
- Chat message streaming via Hono.js backend
- Code Agent streaming output in terminal and file operations
- MCP tool invocation streaming output
- All AI providers (OpenAI, Anthropic, Google, 302AI)

**Technical Implementation:**
- SafeClose pattern guarantees stream closure in all code paths
- [DONE] marker emission triggers AI SDK onFinish callback
- Transport layer debug logging for stream lifecycle validation
- AbortController pattern prevents race conditions in async operations

## Requirements

### Validated

- ✓ BACK-01: ReadableStream closes properly via controller.close() — v1.0
- ✓ BACK-02: Error events handled with proper cleanup — v1.0
- ✓ BACK-03: Stream completion signals include [DONE] marker — v1.0
- ✓ BACK-04: All AI providers send proper completion events — v1.0
- ✓ TRANS-01: Finish event detection logs at transport layer — v1.0
- ✓ TRANS-02: SSE protocol validation confirms [DONE] delivery — v1.0
- ✓ TRANS-03: Connection close events forwarded to frontend — v1.0
- ✓ FRONT-01: Race conditions fixed in onFinish callback — v1.0
- ✓ FRONT-02: Loading spinner clears <100ms — v1.0
- ✓ FRONT-03: Chat input enables immediately — v1.0
- ✓ FRONT-04: Fix applies to all streaming contexts — v1.0

### Active

- [ ] INPUT-01: Detect streaming state in Vibe Mode
- [ ] INPUT-02: Redirect input to taskboard when streaming
- [ ] INPUT-03: Upload attachments to sandbox workspace
- [ ] INPUT-04: Reference attachment paths in task content
- [ ] INPUT-05: Show toast notification after task added
- [ ] INPUT-06: Clear input and attachments after adding

### Out of Scope

- Visual hints on input box during streaming — toast is sufficient feedback
- Extending Task type with attachment metadata — use path references instead
- Confirmation dialog before adding — keep interaction fast
- Changes to non-Vibe-Mode chat behavior — only affects Vibe Mode streaming

## Context

**Technical Environment:**
- Electron 38.1.0 desktop app with SvelteKit 5 frontend
- Hono.js backend server (localhost:8089) for AI streaming
- Vercel AI SDK (v6.0.1) with provider SDKs (Anthropic, OpenAI, Google)
- Reactive state management via Svelte 5 runes (singleton stores)

**Relevant Files:**
- `src/lib/stores/chat-state.svelte.ts` - Chat state with streaming detection
- `src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts` - Taskboard state
- `src/lib/stores/code-agent/code-agent-state.svelte.ts` - Vibe Mode state
- `src/lib/components/buss/chat/chat-input/` - Chat input components
- `src/lib/api/taskboard/` - Taskboard API layer

**Existing Patterns:**
- Taskboard already has `addTaskFromInput()` method
- Attachments upload to sandbox via existing upload flow
- Toast notifications via existing toast system

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Three-phase architecture: Backend → Transport → Frontend | Matches natural data flow; isolates layers for debugging | ✓ Good |
| SafeClose pattern with try-catch-finally | Guarantees controller.close() in all paths | ✓ Good |
| [DONE] marker in ClaudeCodeProcessor | AI SDK SSE parser requires it for onFinish | ✓ Good |
| AbortController for title generation | Matches existing suggestions pattern | ✓ Good |
| DEBUG_TRANSPORT conditional logging | Avoids production overhead | ✓ Good |

---
*Last updated: 2026-02-04 after v1.1 milestone start*
