# Stack Research: Context Compression

**Project:** 302-AI-Studio Context Compression
**Researched:** 2026-02-05
**Mode:** Stack additions for milestone
**Confidence:** HIGH

## Summary

Context compression for this project requires **zero new dependencies**. The existing stack provides everything needed: Vercel AI SDK for message handling, the title generation endpoint pattern for fast-model summarization, Svelte 5 stores for state management, and `@302ai/unstorage` for persistence. The implementation follows the established title generation pattern which already performs incremental summarization with a configurable fast model via `generateText()`.

## No New Dependencies Needed

The existing stack fully supports context compression:

| Existing Capability | Version | How It Serves Context Compression |
|---------------------|---------|-----------------------------------|
| **Vercel AI SDK** | 6.0.1 | `UIMessage` type, `convertToModelMessages()` for message transformation, `generateText()` for summary generation |
| **Hono.js backend** | 4.9.10 | Add `/generate-summary` endpoint following `/generate-title` pattern |
| **Title generation model** | (configurable) | Already configurable fast model (gpt-4o-mini default) for summarization |
| **`ThreadParams` type** | - | Extend with `contextSummary`, `compressedMessageCount` fields |
| **`ChatMessage` metadata** | - | Already supports arbitrary metadata for tracking compressed state |
| **`PreferencesSettingsState`** | - | Extend with compression-related settings |
| **`PersistedState`** | - | Thread-level and global settings persistence via `@302ai/unstorage` |
| **Multi-provider support** | - | 302ai, openai, anthropic, gemini all handled identically in `/generate-title`, same pattern for `/generate-summary` |

## Stack Decisions

### Decision 1: Reuse Title Generation Model Configuration

**Choice:** Use existing `titleGenerationModel` setting from `PreferencesSettingsState` for compression summarization, or allow a separate model override.

**Rationale:**
- Title generation already solves the same problem: use a fast/cheap model for auxiliary AI tasks
- User has already configured their preferred fast model (with fallback to `gpt-4o-mini`)
- Fallback chain already implemented: configured model -> current chat model -> gpt-4o-mini
- Avoid settings sprawl unless users specifically need different models for summarization vs titles

**Integration:**
- `preferencesSettings.titleGenerationModel` provides the model (existing)
- New setting `contextCompressionModel` can optionally override (defaults to title model)
- Same provider resolution code reused

### Decision 2: Follow Title Generation Backend Pattern

**Choice:** Create `/generate-summary` Hono endpoint mirroring `/generate-title` structure in `electron/main/server/router.ts`.

**Rationale:**
- Proven pattern: title generation works reliably with all four providers
- Handles provider switching via `switch(providerType)` already in place
- Includes retry with fallback model logic
- AbortController support for cancellation already plumbed through
- Same `createOpenAI`/`createAnthropic`/`createGoogleGenerativeAI`/`createAI302` factory functions

**Integration:**
- New endpoint at `app.post("/generate-summary", async (c) => { ... })` in `router.ts`
- Accepts: `{ messages: UIMessage[], model, apiKey, baseUrl, providerType, previousSummary }`
- Returns: `{ summary: string, compressedCount: number }`
- Frontend calls via `fetch(`http://localhost:${serverPort}/generate-summary`, ...)` -- identical to `generateTitleRequest()`

### Decision 3: Extend ThreadParams for Compression State

**Choice:** Add compression fields to existing `ThreadParams` interface in `src/shared/types.ts`.

**Rationale:**
- Thread-level state already persisted via `persistedChatParamsState` using `PersistedState<ThreadParams>`
- No new storage mechanism needed -- `@302ai/unstorage` handles it
- Natural place for per-thread compression data
- Pattern matches `incrementalSummary` already on `ThreadParams` (used by title generation)

**Integration:**
```typescript
// Extend src/shared/types.ts ThreadParams:
export interface ThreadParmas {
  // ... existing fields ...

  /** Rolling summary of compressed messages */
  contextSummary?: string;
  /** Number of messages compressed into the summary */
  compressedMessageCount?: number;
  /** ID of the last message included in compression */
  lastCompressionMessageId?: string;
}
```

### Decision 4: Extend PreferencesSettingsState for Global Settings

**Choice:** Add compression settings to existing `PreferencesSettingsState` in `src/lib/stores/preferences-settings.state.svelte.ts`.

**Rationale:**
- Settings pattern well established (title generation timing, suggestions count, stream speed, etc.)
- PersistedState migration support handles adding new fields gracefully (defaults applied)
- UI settings components follow consistent patterns in `src/routes/(settings-page)/settings/(center)/preferences-settings/`

**Integration:**
```typescript
// Extend PreferencesSettingsState:
export interface PreferencesSettingsState {
  // ... existing fields ...

  contextCompressionEnabled: boolean;   // default: false (opt-in initially)
  contextCompressionThreshold: number;  // default: 20 (compress after N messages)
  contextSummaryMaxLength: number;      // default: 500 (chars for summary)
}
```

### Decision 5: Compression Applied in onFinish Callback

**Choice:** Trigger compression check in the `onFinish` callback of the `Chat` instance, same location as title generation.

**Rationale:**
- `onFinish` already orchestrates post-completion tasks: title generation, suggestions, persisting messages
- Compression is another post-completion task -- runs after response completes, before next send
- Non-blocking pattern already established with title generation (AbortController, background execution)
- Messages are fully available and persisted at this point

**Integration:**
```typescript
// In chat-state.svelte.ts onFinish callback (after title generation section):
if (compressionEnabled && messages.length > threshold && !codeAgentEnabled) {
  const abortSignal = chatState.createCompressionAbortController();
  generateSummary(messagesToCompress, compressionModel, provider, serverPort, previousSummary, abortSignal)
    .then((result) => {
      if (!abortSignal.aborted) {
        persistedChatParamsState.current.contextSummary = result.summary;
        persistedChatParamsState.current.compressedMessageCount = result.compressedCount;
      }
    });
}
```

### Decision 6: System Prompt Injection for Summary Context

**Choice:** Inject the rolling summary as a system message prefix when sending to backend.

**Rationale:**
- System prompt already composed in `DynamicChatTransport.body()` function
- Pattern exists: `systemPrompt` is resolved from templates with variable substitution
- Summary becomes another input to system prompt construction
- Backend endpoints all support `systemPrompt` field in request body

**Integration:**
```typescript
// In DynamicChatTransport body():
systemPrompt: (() => {
  let prompt = resolvedSystemPrompt || "";
  if (contextSummary && !codeAgentEnabled) {
    prompt = `[Previous conversation summary: ${contextSummary}]\n\n${prompt}`;
  }
  return prompt || undefined;
})(),
```

### Decision 7: No Token Counting Library

**Choice:** Use message count threshold, not token count.

**Rationale:**
- Token counting requires model-specific libraries (tiktoken for OpenAI, different for Anthropic/Google)
- No single library covers all four providers reliably
- Message count is simpler, predictable, and sufficient for the UX goal
- Users understand "keep last 20 messages" better than "keep 8000 tokens"
- Title generation uses message-based approach (not token-based) and works well
- Can always add token counting later as an enhancement

**What's NOT added:**
- `tiktoken` (~2MB, OpenAI-specific)
- `@anthropic-ai/tokenizer` (Anthropic-specific)
- Any custom tokenizer

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| **tiktoken for token counting** | Complexity vs value. Message count achieves same UX goal. Token counting is model-specific and would need multiple libraries for multi-provider support. |
| **Separate compression model setting** | Premature complexity. Title generation model serves the same purpose (fast, cheap auxiliary model). Can add later if users request it. |
| **Store compressed messages in separate storage key** | Complicates data model. Thread already has messages + params. Adding a third storage key per thread introduces sync issues. |
| **Real-time streaming compression (compress during response)** | Overkill. Batch compression in onFinish is simpler and the summary is only needed on the *next* send. |
| **AI SDK `experimental_prepareRequestBody`** | Would require significant refactor of the transport layer. Current system prompt injection approach integrates cleanly with existing code. |
| **LangChain memory/summarization modules** | Heavy dependency (~50+ transitive packages) for a focused feature. Existing AI SDK + backend pattern is lighter and already proven. |
| **Client-side summarization** | Not possible -- need LLM to generate summary. Must go through backend like title generation. |
| **Middleware approach in Hono** | Could add as middleware, but endpoint approach matches existing patterns and is more explicit. |

## Implementation Notes

### What Requires Backend Changes (router.ts)

1. **New endpoint**: `app.post("/generate-summary", ...)` in `electron/main/server/router.ts`
2. **Prompt engineering**: Summary generation prompt similar in complexity to title prompt
3. **Same provider resolution**: Reuse `switch(providerType)` pattern from `/generate-title`

### What Requires Frontend Changes

1. **Settings UI**: Add compression toggle, threshold slider, max length in preferences page
2. **Chat UI indicator**: Small badge/text showing "N messages compressed" near message list
3. **Expand/view original**: Button to expand compressed messages (they remain in `persistedMessagesState`)
4. **onFinish logic**: Add compression trigger after title generation block
5. **Transport body**: Inject summary into system prompt when compression is active

### What Requires Type Changes

1. **`ThreadParams`** in `src/shared/types.ts`: Add `contextSummary`, `compressedMessageCount`, `lastCompressionMessageId`
2. **`PreferencesSettingsState`** in `src/lib/stores/preferences-settings.state.svelte.ts`: Add compression settings
3. **No ChatMessage type changes needed** -- messages themselves are unchanged, just filtered before sending

### What Requires i18n Changes

New keys in `messages/en.json` and `messages/zh.json`:
- Context compression toggle label
- Threshold setting label and description
- Summary length setting label
- Compressed message count indicator text
- Expand/view original text

## Files to Modify

| File | Changes | Risk |
|------|---------|------|
| `electron/main/server/router.ts` | Add `/generate-summary` endpoint | Low -- additive, follows existing pattern |
| `src/shared/types.ts` | Extend `ThreadParams` with 3 optional fields | Low -- backward compatible |
| `src/lib/stores/preferences-settings.state.svelte.ts` | Add 3 compression settings with defaults | Low -- PersistedState handles defaults |
| `src/lib/stores/chat-state.svelte.ts` | Add compression logic in onFinish, modify transport body | Medium -- core file, careful integration needed |
| `src/lib/api/summary-generation.ts` | New file mirroring `title-generation.ts` | Low -- new file, no existing code modified |
| `src/routes/(settings-page)/settings/(center)/preferences-settings/` | Add compression settings UI | Low -- additive settings UI |
| `messages/en.json`, `messages/zh.json` | Add i18n keys | Low -- additive |

## Confidence: HIGH

**Reasoning:**
- All required capabilities verified by reading actual codebase files
- Title generation pattern is proven and directly applicable (same architecture)
- Zero new dependencies eliminates version compatibility concerns
- Follows established patterns throughout the codebase
- Similar feature (incremental title/summary generation) already implemented and working
- ThreadParams already has `incrementalSummary` field demonstrating the pattern

**Verification sources:**
- `package.json`: Confirmed AI SDK v6.0.1, Hono v4.9.10, all provider SDKs
- `router.ts` (1891 lines): Verified `/generate-title` pattern at line 942 with multi-provider support
- `preferences-settings.state.svelte.ts`: Confirmed settings pattern with defaults
- `chat-state.svelte.ts` (1935 lines): Verified transport layer body(), onFinish() callback, and message handling
- `src/shared/types.ts`: Confirmed `ThreadParams.incrementalSummary` exists -- direct precedent
- `src/lib/api/title-generation.ts`: Verified API call pattern with abort support and fallback chain
- `src/lib/types/chat.ts`: Confirmed `ChatMessage` = `UIMessage<MessageMetadata, ...>` -- metadata extensible
