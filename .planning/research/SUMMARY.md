# Research Summary: Context Compression

**Project:** 302-AI-Studio v1.2
**Domain:** Auto Context Compression
**Researched:** 2026-02-05
**Confidence:** HIGH

---

## Executive Summary

Context compression for 302-AI-Studio requires **zero new dependencies**. The existing stack provides everything needed: the title generation pattern (`/generate-title` endpoint, incremental summarization via `incrementalSummary`, fast model configuration) is directly reusable for context compression. The implementation follows proven codebase patterns: add a `/generate-context-summary` backend endpoint mirroring `/generate-title`, extend `ThreadParmas` with `contextSummary` fields (following the `incrementalSummary` precedent), trigger compression in the `onFinish` callback after title generation, and inject the summary via system prompt prefix in the transport layer. Message count threshold (default: 20) is the right approach over token counting, which would require model-specific libraries for multi-provider support.

The recommended approach is message-count-based compression where messages beyond the threshold are summarized incrementally. The AI receives summary + recent N messages instead of the full history. Original messages remain in storage and UI -- compression is purely a transport optimization. Code Agent and private chat are exempt since they require full context or have privacy constraints.

The critical risks are: (1) race conditions with the existing title/suggestions async pipeline in `onFinish` -- mitigated by following the AbortController pattern already established, (2) summary quality degradation over many compression cycles -- mitigated by strong prompts that preserve decisions/constraints/key facts and always keeping the first user message uncompressed, and (3) breaking existing features (branching, regeneration, clear screen) that assume full message history -- mitigated by making compression a transport-only concern that never mutates the message array.

---

## Key Findings

### Stack (No Additions Needed)

The existing stack fully supports context compression without new dependencies:

- **Vercel AI SDK 6.0.1**: `UIMessage` type, `convertToModelMessages()`, `generateText()` for summary generation
- **Hono.js 4.9.10**: Add `/generate-context-summary` endpoint following `/generate-title` pattern exactly
- **Title generation model**: Reuse `preferencesSettings.titleGenerationModel` (fast model like gpt-4o-mini) for summarization
- **ThreadParmas type**: Extend with `contextSummary`, `contextSummaryMessageId` -- follows `incrementalSummary` precedent
- **PersistedState**: Thread-level persistence via `@302ai/unstorage` handles new optional fields automatically

**Key stack decision**: Use message count threshold, not token counting. Token counting requires tiktoken (OpenAI-specific) or provider-specific libraries, adding ~2MB+ dependencies and maintenance burden for marginal UX improvement. Users understand "keep last 20 messages" better than "keep 8000 tokens."

### Features

**Must have (table stakes):**
- Configurable message limit N (default: 20, range: 4-100) -- users need control over how much context to preserve
- Rolling summary of older messages -- core mechanism, not silent dropping
- Incremental summary updates -- feed previous summary + new messages, not full re-summarization each time
- Summary injection into AI request as system prompt prefix
- Code Agent exemption -- Vibe Mode requires full context for file operations
- Visual indicator showing "N messages summarized" in chat
- Original messages remain accessible in UI -- compression affects AI payload only

**Should have (differentiators):**
- Expand/collapse to view actual summary text -- builds user trust
- Summary preview on hover -- transparency about what AI sees
- Per-thread compression toggle -- some conversations need full context always

**Defer (v2+):**
- Pinned/protected messages that never compress -- adds significant UX complexity
- Summary quality indicator -- requires additional research into detection heuristics
- Token-based secondary threshold -- message count is sufficient for Phase 1

**Anti-features to avoid:**
- Token-based compression threshold (requires multi-library dependency mess)
- Automatic background summarization (wastes API calls, race conditions)
- Full re-summarization each time (O(n) cost growth)
- Modifying stored messages (destructive, breaks data integrity)
- User-editable summaries (wrong abstraction level)

### Architecture

Context compression integrates via the established title generation pattern. The key insight: **title generation already implements incremental summarization** via `incrementalSummary` stored in `ThreadParmas`. Context compression extends this same pattern.

**Major components:**
1. **ThreadParmas extension** (src/shared/types.ts) -- Add `contextSummary`, `contextSummaryMessageId`, `compressionEnabled` as optional fields
2. **Backend endpoint** (electron/main/server/router.ts) -- New `/generate-context-summary` endpoint mirroring `/generate-title` structure
3. **Message compression utility** (router.ts) -- `applyContextCompression()` function prepends summary to system prompt and filters messages sent to AI
4. **Frontend API wrapper** (src/lib/api/context-summary.ts) -- New file following title-generation.ts pattern
5. **onFinish integration** (chat-state.svelte.ts) -- Threshold-based compression trigger after title generation, with AbortController

**Critical architecture decision**: Backend truncation in router.ts, not frontend. Transport sends all messages, router truncates before AI call. This maintains existing patterns, keeps transport simple, and backend retains full context for prompt resolution.

**Summary storage**: In ThreadParmas alongside `incrementalSummary`, not a separate storage key. Follows existing pattern, avoids lifecycle management complexity.

### Critical Pitfalls

1. **Race conditions in onFinish** -- The callback already orchestrates 3 async operations (persist, title, suggestions). Adding compression creates timing risks. **Mitigation**: Follow exact AbortController pattern from title generation, run compression sequentially AFTER title generation completes, use single `flush()` at end.

2. **Summary quality degradation** -- Rolling summaries compound information loss over many cycles (telephone game effect). By 5th compression cycle, critical early details can drift. **Mitigation**: Strong prompts preserving constraints/decisions/key facts, minimum summary length floor, always keep first user message uncompressed.

3. **Breaking existing features** -- Branching, regeneration, clear screen, message editing all assume full message history. **Mitigation**: NEVER remove messages from storage or `chat.messages`. Compression is a TRANSPORT concern only -- filter in router before AI call, not by mutating state.

4. **Code Agent exemption gaps** -- Must check `codeAgentState.enabled` at EVERY code path: onFinish, transport body injection, settings UI. **Mitigation**: Single `isCompressionEligible` boolean helper used everywhere.

5. **System prompt injection conflicts** -- Summary prefix could confuse models about their role, conflict with user's custom system prompts. **Mitigation**: Use delimited format `<conversation_context>...</conversation_context>` or separate system message approach.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Data Model
**Rationale:** Data model must exist before any feature code. Zero runtime changes, all backward compatible.
**Delivers:** Storage schema ready for compression state
**Addresses:**
- Extend `ThreadParmas` with `contextSummary`, `contextSummaryMessageId`, `compressionEnabled`
- Add getters/setters in `ChatState` (following `clearScreenMessageId` pattern)
- Add compression settings to `PreferencesSettingsState` with defaults
**Avoids:** Storage migration pitfall -- all fields are optional, PersistedState handles missing fields gracefully
**Risk:** LOW

### Phase 2: Backend Summarization Endpoint
**Rationale:** Backend must exist before frontend can generate summaries. Can be tested independently.
**Delivers:** Working `/generate-context-summary` endpoint with multi-provider support
**Implements:**
- New endpoint in `router.ts` mirroring `/generate-title` exactly
- Compression-focused prompt design (preserve decisions, names, context)
- `src/lib/api/context-summary.ts` API wrapper
- AbortController management in ChatState
**Uses:** Title generation model config, existing provider switch pattern
**Risk:** LOW -- proven pattern, additive only

### Phase 3: Message Compression in Router
**Rationale:** Core feature that actually reduces tokens. Depends on Phase 1 fields.
**Delivers:** AI receives compressed context instead of full history
**Implements:**
- `applyContextCompression()` utility in router.ts
- Compression logic added to all 4 chat endpoints (`/chat/302ai`, `/chat/openai`, `/chat/anthropic`, `/chat/gemini`)
- Transport body passes compression fields
- System prompt injection with proper delimiting
**Avoids:** System prompt conflict pitfall via delimited injection, breaking existing features via transport-only filtering
**Risk:** MEDIUM -- touches core chat flow, extract to utility to avoid duplication

### Phase 4: Automatic Summary Updates
**Rationale:** Completes the feedback loop. Depends on Phases 1-3.
**Delivers:** Compression that updates automatically without user intervention
**Implements:**
- Threshold-based summary generation in `onFinish` callback
- `shouldUpdateContextSummary()` logic with configurable threshold
- AbortController cancellation when user sends new message
- State guards matching title generation pattern
- Code Agent and private chat exemptions
**Avoids:** Race condition pitfall via AbortController pattern, sequential ordering after title gen
**Risk:** MEDIUM -- async integration in complex callback

### Phase 5: UI Indicators & Settings
**Rationale:** Polish and user control. Can ship without, but UX suffers.
**Delivers:** User visibility and configuration
**Implements:**
- Compression toggle in preferences settings (near title generation settings)
- Threshold slider (range: 6-50, step: 2)
- Compression status indicator in chat UI ("12 earlier messages summarized")
- Expand to view summary text
- Optional: per-thread compression toggle
**Avoids:** Confusing UI pitfall via clear visual indicators
**Risk:** LOW -- additive UI components

### Phase Ordering Rationale

- **Phases 1-2 are foundational**: Data model and backend endpoint have no dependencies, can be built in parallel, and enable testing before frontend integration.
- **Phase 3 before Phase 4**: Message compression (what the AI sees) must work before automatic updates (when compression triggers). Allows manual testing of compression quality before automation.
- **Phase 5 last**: Core functionality works without UI polish. Settings and indicators are enhancement layer.
- **This order avoids pitfalls**: Data model first (no storage migration needed), backend second (isolated testing), router third (careful integration), onFinish fourth (follows established patterns), UI last (lowest risk).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** System prompt injection approach needs validation with different providers. Test Anthropic's claude models specifically since they handle system prompts differently.
- **Phase 4:** Threshold tuning may need iteration based on real-world usage. 20 messages is starting point, not final answer.

Phases with standard patterns (skip research-phase):
- **Phase 1:** ThreadParmas extension is trivial, direct precedent exists (`incrementalSummary`).
- **Phase 2:** `/generate-title` endpoint is the exact template, copy-paste-modify pattern.
- **Phase 5:** Standard Svelte UI components, follows existing preferences settings pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies, all capabilities verified in codebase. `incrementalSummary` pattern proves approach works. |
| Features | HIGH | Strong industry consensus on table stakes. Anti-features well-documented across multiple sources. |
| Architecture | HIGH | Every integration point verified from source code. Title generation pattern is exact template. |
| Pitfalls | HIGH | All pitfalls mapped to specific code locations. Race conditions verified by reading 350-line onFinish callback. |

**Overall confidence:** HIGH

### Gaps to Address

- **Prompt engineering quality**: The summarization prompt will need iteration. Initial prompt should preserve decisions/constraints/key facts, but optimal wording requires testing. Plan for 2-3 prompt revision cycles.
- **Threshold tuning**: 20-message default is educated guess. May need adjustment based on user feedback. Consider A/B testing different defaults.
- **Provider-specific behaviors**: Anthropic models may handle system prompt prefixes differently than OpenAI/Gemini. Test edge cases during Phase 3.
- **Summary length optimization**: 500 characters may be too short for complex conversations. 1000-2000 characters more practical. Make configurable and observe usage.

---

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** (verified source code):
  - `chat-state.svelte.ts` (1935 lines) -- onFinish callback, sendMessage flow, title generation pattern
  - `router.ts` (1891 lines) -- /generate-title endpoint, multi-provider support, request handling
  - `types.ts` -- ThreadParmas.incrementalSummary precedent
  - `title-generation.ts` -- API call pattern with abort support
  - `preferences-settings.state.svelte.ts` -- settings pattern and model configuration

### Secondary (MEDIUM confidence)
- [Factory.ai: Compressing Context](https://factory.ai/news/compressing-context) -- incremental vs full re-summarization tradeoffs
- [Factory.ai: Evaluating Compression](https://factory.ai/news/evaluating-compression) -- 36,000+ messages analyzed
- [Mem0.ai: LLM Chat History Summarization](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) -- rolling summary patterns
- [GetMaxim: Context Window Management](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) -- hierarchical summarization
- [Anthropic Cookbook: Context Compaction](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction) -- official guidance

### Tertiary (LOW confidence)
- [Zed Editor Discussion](https://github.com/zed-industries/zed/discussions/32614) -- threshold configuration discussion, user preferences data
- [OpenAI Community: Chat UX](https://community.openai.com/t/collapse-expand-inside-chat-to-improve-ux/1077126) -- UI patterns for compressed content

---
*Research completed: 2026-02-05*
*Ready for requirements definition: yes*
