# 302-AI-Studio: Chat Enhancements

## What This Is

302-AI-Studio is an Electron desktop AI chat application with multi-provider support and Vibe Mode (Claude Code sandbox integration). This project focuses on improving the chat experience with intelligent context management.

## Core Value

Efficient AI conversations through smart context compression — users get coherent responses without hitting token limits or losing conversation history.

## Current Milestone: v1.3 Streaming Text Animation

**Goal:** Smooth fade-in animation for streaming AI responses — text flows in gracefully instead of appearing character-by-character.

**Target features:**
- Per-chunk opacity fade animation during streaming
- Fast transition (~150-200ms) for subtle, non-distracting effect
- Applies to all streaming contexts (regular chat, Code Agent)

## Previous State (v1.2 Shipped)

**Shipped:** 2026-02-06

Auto context compression is now live:
- Configurable message limit N in preferences (default: 20, range 5-100)
- Rolling summary of messages beyond N (200-500 chars)
- Summary auto-updates after each AI response when threshold exceeded
- Visual banner shows compressed message count with expandable summary view
- Code Agent and private chat modes exempt (full context preserved)

**Technical Implementation:**
- `applyContextCompression()` utility filters messages and augments system prompt
- All 4 chat endpoints (302ai, openai, anthropic, gemini) apply compression
- `shouldApplyCompression` derived property handles exemption logic
- AbortController pattern prevents race conditions in summary generation
- Collapsible banner component using bits-ui Collapsible pattern

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
- ✓ INPUT-01: Detect streaming state in Vibe Mode — v1.1
- ✓ INPUT-02: Redirect input to taskboard when streaming — v1.1
- ✓ INPUT-03: Upload attachments to sandbox workspace — v1.1
- ✓ INPUT-04: Reference attachment paths in task content — v1.1
- ✓ INPUT-05: Show toast notification after task added — v1.1
- ✓ INPUT-06: Clear input and attachments after adding — v1.1
- ✓ COMP-01: Configurable message limit N in chat settings — v1.2
- ✓ COMP-02: Summarize messages beyond N into 200-500 char rolling summary — v1.2
- ✓ COMP-03: Summary automatically injected as context when sending to AI — v1.2
- ✓ COMP-04: Summary auto-updated when message count exceeds threshold — v1.2
- ✓ UI-01: Visual indicator when compression is active — v1.2
- ✓ UI-02: Count of compressed messages displayed — v1.2
- ✓ UI-03: Message limit N configurable in preferences settings — v1.2
- ✓ UI-04: Expand option to view summary text — v1.2
- ✓ EXEMPT-01: Code Agent mode preserves full message context — v1.2
- ✓ EXEMPT-02: Private chat mode preserves full message context — v1.2

### Active

- [ ] ANIM-01: Streaming text chunks fade in with opacity animation
- [ ] ANIM-02: Animation duration ~150-200ms per chunk
- [ ] ANIM-03: Animation applies to all streaming contexts (chat, Code Agent)

### Out of Scope

- Visual hints on input box during streaming — toast is sufficient feedback
- Extending Task type with attachment metadata — use path references instead
- Confirmation dialog before adding — keep interaction fast
- Token-based compression triggers — fixed message count is simpler
- Background/continuous summarization — on-send is sufficient
- Per-model compression settings — fixed N is sufficient for v1

## Context

**Technical Environment:**
- Electron 38.1.0 desktop app with SvelteKit 5 frontend
- Hono.js backend server (localhost:8089) for AI streaming
- Vercel AI SDK (v6.0.1) with provider SDKs (Anthropic, OpenAI, Google)
- Reactive state management via Svelte 5 runes (singleton stores)

**Relevant Files (v1.2):**
- `src/lib/stores/chat-state.svelte.ts` - Chat state with compression accessors and shouldApplyCompression
- `src/lib/stores/preferences-settings.state.svelte.ts` - Compression settings (enabled, limit)
- `electron/main/server/router.ts` - Chat endpoints with applyContextCompression integration
- `electron/main/server/utils.ts` - applyContextCompression utility function
- `src/lib/api/context-summary-generation.ts` - Frontend API wrapper for summary generation
- `src/routes/(with-sidebar)/chat/components/message/compression-banner.svelte` - UI banner component

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Three-phase architecture: Backend → Transport → Frontend | Matches natural data flow; isolates layers for debugging | ✓ Good |
| SafeClose pattern with try-catch-finally | Guarantees controller.close() in all paths | ✓ Good |
| [DONE] marker in ClaudeCodeProcessor | AI SDK SSE parser requires it for onFinish | ✓ Good |
| AbortController for title generation | Matches existing suggestions pattern | ✓ Good |
| DEBUG_TRANSPORT conditional logging | Avoids production overhead | ✓ Good |
| Compression enabled by default, 20-message threshold | Sensible defaults; users can adjust | ✓ Good |
| shouldApplyCompression exemption order | Clear precedence: global > per-thread > Code Agent > private | ✓ Good |
| Reuse titleGenerationModel for summaries | No new settings needed; fast, cheap model | ✓ Good |
| Summary generation awaited in onFinish | State consistency; matches title generation pattern | ✓ Good |
| Compression AFTER template resolution | User prompt templates need full message history | ✓ Good |
| Summary prepended to system prompt | Works with all providers; clean injection point | ✓ Good |

---
*Last updated: 2026-02-12 after v1.3 milestone started*
