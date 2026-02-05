# Feature Research: Context Compression

**Domain:** AI Chat Application - Context Window Management
**Researched:** 2026-02-05
**Confidence:** HIGH

## Summary

Context compression in AI chat applications is a well-established pattern with clear industry consensus on core behavior: keep recent messages verbatim, summarize older ones into a rolling summary, and inject that summary as context for the AI. The feature landscape divides cleanly into table stakes (what users expect from any compression system), differentiators (what makes one implementation better than another), and anti-features (common requests that degrade the experience). 302-AI-Studio's planned approach -- fixed message count N, rolling summary via fast model, on-send timing -- aligns with the most successful production patterns.

The existing codebase provides strong foundations: `incrementalSummary` on `ThreadParams` already tracks rolling summaries for title generation, the `/generate-title` endpoint pattern is directly reusable, and the `onFinish` callback already orchestrates post-completion tasks.

## Table Stakes

Features users expect from any context compression system. Missing any of these makes the feature feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Dependency | Notes |
|---------|--------------|------------|------------|-------|
| **Configurable message limit N** | Users need control over how much recent context to preserve. No single default works for all use cases (quick Q&A vs deep technical discussion). | LOW | `PreferencesSettingsState` in preferences store | Default of 20 is reasonable. Range 4-100. Must be per-thread or global with per-thread override. |
| **Rolling summary of older messages** | Core mechanism. Users expect compressed messages to be *summarized*, not silently dropped. Dropping context without summarization is data loss, not compression. | MEDIUM | `/generate-summary` endpoint on Hono backend; title generation model | Summary replaces N+ messages for the AI but originals persist in storage. 200-500 chars per the project spec. |
| **Incremental summary updates** | Each new conversation turn should update the existing summary, not re-summarize all compressed messages from scratch. Full re-summarization is O(n) per turn and causes redundant API calls. | MEDIUM | Previous summary state on `ThreadParams` (pattern exists: `incrementalSummary`) | Feed previous summary + newly compressed messages to model. Same incremental pattern as title generation. |
| **Recent messages preserved verbatim** | Messages within the N-message window must be sent to the AI exactly as-is. Users expect the AI to "remember" recent exchanges with full fidelity. | LOW | Message slicing logic in `sendMessage` | Last N messages sent verbatim. Everything before N goes into summary. |
| **Summary injected as system context** | The rolling summary must be prepended to the AI request so the model has conversation history context. Without injection, compression = amnesia. | LOW | Transport layer `body()` function; system prompt composition | Inject as system message prefix: `[Previous conversation summary: ...]`. |
| **Code Agent exemption** | Code Agent (Vibe Mode) requires full context for accurate code operations. Compressing context for code tasks causes incorrect file references, lost state, and broken workflows. | LOW | `codeAgentState.enabled` check (already used for branching logic) | Bypass all compression when Code Agent is active. Clear requirement from project spec. |
| **Original messages still accessible** | Users must be able to scroll back and see all original messages. Compression affects what the AI sees, not what the user sees in the UI. | LOW | `persistedMessagesState` remains unchanged; UI renders all messages | Messages are never deleted. Compression only affects the payload sent to the backend. |
| **Visual indicator of compression state** | Users need to know compression is active and how many messages are compressed. Without visibility, users cannot understand why the AI "forgot" something. | LOW | Small UI component in chat message list area | Badge or inline text: "12 earlier messages summarized" or similar. |

## Differentiators

Features that elevate the compression experience beyond basic functionality. Not expected, but valued.

| Feature | Value Proposition | Complexity | Dependency | Notes |
|---------|-------------------|------------|------------|-------|
| **Expand/collapse compressed messages** | Users can tap to see what the summary covers -- builds trust. Industry pattern: collapsed earlier messages with "Show more" affordance. | MEDIUM | UI component; expand state per thread | Not expanding individual messages, but showing a summary banner that can expand to show the full summary text and/or list which messages were compressed. |
| **Summary preview on hover/click** | Users can inspect the actual summary text the AI will receive. Transparency builds trust in the compression quality. | LOW | Tooltip or popover on the compression indicator | Show the 200-500 char summary. Users can verify accuracy. |
| **Compression happens on-send** | Summary generation occurs when user sends a new message, not continuously in the background. This means the latest AI response is always fully available before compression. | MEDIUM | Integration into `sendMessage` or `onFinish` flow | On-send timing avoids wasted API calls for conversations that never continue. The project spec already mandates this timing. |
| **Pinned/protected messages** | Certain critical messages (e.g., user's initial instructions, key decisions) are never compressed away. They remain verbatim regardless of position relative to N. | HIGH | Per-message metadata flag; modified message filtering logic | Hybrid approach from research: "pinned" or "key" messages preserved in original form while messages between key points get compressed. Industry best practice but adds UX complexity. |
| **Per-thread compression toggle** | Some threads are short-lived Q&A (compression unnecessary), others are long research sessions (compression essential). Per-thread override lets users choose. | MEDIUM | Thread-level setting in `ThreadParams`; per-thread settings UI | Global default with per-thread override. Some threads may need full context always (e.g., legal analysis). |
| **Summary quality indicator** | Show confidence/quality of the generated summary. If the summary seems degraded (detected by drift over many rounds), warn the user. | HIGH | Summary quality scoring (likely needs separate LLM call or heuristic) | Addresses "context drift" -- the known risk of rolling summaries degrading over many compression rounds. |
| **Compression statistics** | Show users: "X messages compressed, Y tokens saved, Z% reduction." Communicates tangible value. | LOW | Token counting or character counting of original vs compressed | Token counting per-provider is hard. Character-based estimate is simpler and sufficient for display. |

## Anti-Features

Features to deliberately NOT build. These are commonly requested or seem logical but degrade the experience based on research and domain analysis.

| Anti-Feature | Why It Seems Good | Why It Is Harmful | What to Do Instead |
|--------------|-------------------|-------------------|-------------------|
| **Token-based compression threshold** | "Compress when approaching token limit" sounds precise and optimal. | Token counting requires model-specific libraries (tiktoken for OpenAI, different for Anthropic/Google). No single library covers all four providers. Adds complexity, dependency bloat (~2MB for tiktoken alone), and maintenance burden for marginal UX improvement. Users do not think in tokens. | Use fixed message count. Users understand "keep last 20 messages" intuitively. Message count is provider-agnostic and predictable. Project spec already chose this approach. |
| **Automatic background summarization** | "Summarize continuously so it's ready when needed" sounds proactive. | Wastes API calls and credits. Most conversations never get long enough to need compression. Background processing adds latency, cost, and complexity (cancellation, stale summaries). Creates race conditions if user sends while summarization is in-flight. | Summarize on-send (or in onFinish). Only compress when actually needed, at the moment it matters. Project spec already chose this timing. |
| **Full re-summarization each time** | "Re-summarize all compressed messages for accuracy" sounds thorough. | Summarization cost grows linearly with conversation length. At 100+ compressed messages, re-summarization is expensive and slow. Research shows this is the most common performance anti-pattern. Redundant re-summarization was flagged by Factory.ai as a significant limitation. | Incremental summarization: feed previous summary + newly compressed messages to model. Only process the delta. Project spec already chose this approach. |
| **Compressing Code Agent context** | "Apply compression universally" seems consistent. | Code Agent needs full context for accurate file references, terminal state, workspace understanding. Compressing away earlier file operations causes the AI to re-read files it already processed, suggest changes to wrong locations, or lose track of the project structure. | Exempt Code Agent entirely. The project spec already mandates this. Code Agent conversations have different cost/context tradeoffs. |
| **Invisible compression (no user awareness)** | "Just handle it silently" seems user-friendly. | When the AI "forgets" something the user mentioned 30 messages ago, and the user has no idea why, trust erodes. Users blame the AI model, not the hidden compression. Silent compression is the top complaint in chat apps that implement it. | Always show a visual indicator. Make compression visible and understandable. Let users inspect the summary if they want to verify. |
| **Automatic summary-only mode (hiding original messages)** | "Replace old messages with summary in the UI" saves vertical space. | Users lose access to their conversation history. They cannot copy earlier code blocks, reference specific instructions, or verify what was actually said. This is UX hostile. | Keep all messages visible in the UI. Compression only affects the AI payload, never the displayed messages. Add optional visual dimming of compressed messages at most. |
| **User-editable summaries** | "Let users fix bad summaries" sounds empowering. | Creates a text editing task mid-conversation. Users do not want to be editors of AI-generated summaries. The summary format is optimized for AI consumption, not human reading. Editing a summary is error-prone and the edits may not improve AI comprehension. | If summary quality is poor, let users regenerate it (one click). Or let them adjust the threshold N to keep more messages verbatim. |
| **Multi-level memory hierarchy (MemGPT-style)** | "Separate working memory, episodic memory, semantic memory" sounds sophisticated. | Massively overengineered for a chat app. Adds architectural complexity (3+ storage tiers, retrieval logic, paging system) for minimal UX benefit. MemGPT patterns are designed for autonomous agents, not human-supervised chat. | Single rolling summary is sufficient. It covers the use case completely. If future needs arise, can add retrieval-augmented memory later as a separate feature. |
| **Compression that modifies stored messages** | "Replace old messages with summary in storage" saves disk space. | Destructive. Users lose original data permanently. Cannot undo compression. Cannot export full conversation history. Violates data integrity expectations. | Store compression state (summary, count) as separate metadata. Original messages remain untouched in `persistedMessagesState`. |

## Feature Dependencies

```
Configurable Message Limit N (setting)
    |
    +---> Rolling Summary Generation (backend endpoint)
    |         |
    |         +---> Incremental Summary Updates (previous summary + delta)
    |         |         |
    |         |         +---> Summary Quality (over many rounds, drift risk)
    |         |
    |         +---> Title Generation Model (reuse existing config)
    |
    +---> Summary Injection into AI Request (transport layer)
    |         |
    |         +---> Code Agent Exemption (bypass when Vibe Mode active)
    |
    +---> Visual Compression Indicator (UI)
              |
              +---> Expand/View Summary (UI detail)
              |
              +---> Summary Preview on Hover (UI transparency)
```

### Critical Path

1. **Configurable limit N** - Foundation. Everything depends on knowing where to split.
2. **Rolling summary generation** - Core mechanism. Requires backend endpoint.
3. **Summary injection** - Makes compression functional. Without injection, summary is unused.
4. **Visual indicator** - Makes compression visible. Without it, users are confused when AI "forgets."
5. **Expand/view** - Builds trust. Users can verify what was compressed.

### Dependency on Existing Features

| Existing Feature | How Compression Depends on It |
|-----------------|-------------------------------|
| **Title generation model config** | Reuse same fast model for summarization. `preferencesSettings.titleGenerationModel` provides the model selection. |
| **`/generate-title` endpoint** | Architectural pattern. New `/generate-summary` endpoint mirrors its structure exactly. |
| **`incrementalSummary` on ThreadParams** | Precedent. Proves the storage pattern works. New `contextSummary` field follows same approach. |
| **`onFinish` callback chain** | Integration point. Compression triggers after title generation, before suggestions. |
| **`persistedChatParamsState`** | Storage mechanism. Thread-level compression state persisted alongside other thread params. |
| **`codeAgentState.enabled`** | Exemption gate. Already used to branch behavior in `sendMessage`. |
| **System prompt composition** | Injection point. Summary prepended to existing system prompt in transport body. |

## MVP Recommendation

### Must Ship (Phase 1)

These features constitute the minimum viable compression feature:

1. **Configurable message limit N** in preferences (default: 20, range: 4-100)
2. **Rolling summary generation** via new `/generate-summary` backend endpoint
3. **Incremental summary updates** feeding previous summary + new messages
4. **Summary injection** into AI request as system prompt prefix
5. **Code Agent exemption** bypassing compression in Vibe Mode
6. **Visual indicator** showing "N messages summarized" in chat
7. **Expand to view summary** showing the actual summary text on click

### Defer to Post-MVP

- **Pinned/protected messages**: Adds significant UX complexity (how to pin? per-message UI? undo?). The fixed N-message window already protects recent messages, which is sufficient.
- **Per-thread compression toggle**: Start with global setting. Add per-thread if users request it.
- **Summary quality indicator**: Requires additional research into detection heuristics. Rolling summaries are generally good enough for 50-100 rounds before drift becomes noticeable.
- **Compression statistics**: Nice-to-have polish. Low complexity but not essential for functionality.

## Sources

### Industry Research (Verified)
- [Context Window Management Strategies - GetMaxim.ai](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) - Hierarchical summarization patterns, embedding-based compression
- [Compressing Context - Factory.ai](https://factory.ai/news/compressing-context) - Structured vs unstructured summarization, incremental vs full re-summarization tradeoffs
- [Evaluating Context Compression - Factory.ai](https://factory.ai/news/evaluating-compression) - 36,000+ messages analyzed, compression approaches compared
- [LLM Chat History Summarization Guide - Mem0.ai](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) - Rolling summary patterns, hybrid approaches
- [Context Window Management - OneUpTime](https://oneuptime.com/blog/post/2026-01-30-context-window-management/view) - SlidingWindowManager pattern, summary_target_tokens
- [Context Window Overflow Fix - Redis](https://redis.io/blog/context-window-overflow/) - Effective vs claimed context windows, 60-70% usable
- [KVzip Memory Compression - TechXplore](https://techxplore.com/news/2025-11-ai-tech-compress-llm-chatbot.html) - 3-4x compression with maintained accuracy

### UX Patterns (Verified)
- [Chat-Native App UX Best Practices - Skywork.ai](https://skywork.ai/blog/chat-native-app-ux-best-practices/) - Visual separation, streaming indicators, progressive disclosure
- [Expanding Conversational UI - LukeW](https://www.lukew.com/ff/entry.asp?2018=) - Collapse/expand patterns for chat message management
- [TypingMind Context Length Limit](https://docs.typingmind.com/chat-models-settings/context-length-limit) - User-configurable message count limiting, preserving system message
- [LibreChat Memory Configuration](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/memory) - tokenLimit, messageWindowSize configuration patterns

### Anti-Pattern Research (Verified)
- [Incremental Summarization - ArXiv](https://arxiv.org/html/2510.06677) - Full vs incremental summarization comparison, production results
- [Don't Let Your AI Agent Forget - Medium](https://techwithibrahim.medium.com/dont-let-your-ai-agent-forget-smarter-strategies-for-summarizing-message-history-a2d5284539f1) - Rolling summary as "rolling snowball," context drift risk
- [Efficient Context Management - JetBrains Research](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) - Context folding, minimize tokens per task not per request

### Codebase Verification (HIGH Confidence)
- `src/lib/stores/chat-state.svelte.ts` - Verified `onFinish` callback, `sendMessage` flow, Code Agent branching
- `electron/main/server/router.ts` - Verified `/generate-title` endpoint pattern with multi-provider support
- `src/lib/api/title-generation.ts` - Verified API call pattern, abort support, fallback chain
- `src/shared/types.ts` - Verified `ThreadParams.incrementalSummary` exists as direct precedent
- `src/lib/stores/preferences-settings.state.svelte.ts` - Verified settings pattern and title model configuration

## Confidence: HIGH

**Reasoning:** Context compression is a well-understood domain with strong industry consensus. The planned approach (fixed N, rolling summary, incremental updates, on-send timing) matches the most successful production patterns. The existing codebase has direct precedent for every aspect of the implementation (incremental summarization for titles, fast model configuration, onFinish orchestration, thread-level state persistence). All feature categorizations are informed by both industry research and codebase-verified implementation feasibility.

---
*Context compression feature research for: 302-AI-Studio v1.2*
*Researched: 2026-02-05*
