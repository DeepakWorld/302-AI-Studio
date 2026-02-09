# Architecture Research: Context Compression

**Domain:** AI Chat Application with Context Compression
**Researched:** 2026-02-05
**Confidence:** HIGH (verified from codebase analysis -- all integration points traced through source)

## Summary

Context compression integrates naturally with the existing architecture by following the established title generation pattern. The key insight: **title generation already implements incremental summarization** via `incrementalSummary` stored in `ThreadParmas`, with a `/generate-title` backend endpoint that accepts `previousSummary` and returns updated `{title, summary}`. Context compression extends this same pattern by adding a rolling summary that is prepended to messages before AI provider calls to reduce token usage. The primary integration points are (1) the `ThreadParmas` data model for storage, (2) the router.ts endpoints for message preparation, (3) the `onFinish` callback for summary updates, and (4) a new backend endpoint for summary generation.

---

## System Architecture: Current vs. With Compression

### Current Message Flow (Simplified)

```
User Input
    |
    v
chatState.sendMessage()
    |
    v
chat.sendMessage({ text, body: { model, apiKey } })
    |
    v
DynamicChatTransport.sendMessages()
    |-- api: /chat/{provider}  (resolved dynamically)
    |-- body: { temperature, maxTokens, systemPrompt, ... }
    |-- messages: ALL ChatMessage[] from persistedMessagesState
    |
    v
Hono Router: POST /chat/{provider}
    |-- Parses: RouterRequestBody
    |-- Converts: convertToModelMessages(messages)
    |-- Creates: LanguageModel client
    |-- Calls: Agent.stream({ messages: convertedMessages })
    |
    v
AI Provider receives FULL message history
    |
    v
Response streams back through:
    Hono -> DynamicChatTransport -> Chat instance -> UI
    |
    v
onFinish():
    |-- persistedMessagesState.current = messages
    |-- Title generation (async, non-blocking)
    |-- Suggestions generation (async, non-blocking)
```

### With Compression (Changes Marked)

```
User Input
    |
    v
chatState.sendMessage()
    |
    v
chat.sendMessage({ text, body: { model, apiKey } })
    |
    v
DynamicChatTransport.sendMessages()
    |-- api: /chat/{provider}
    |-- body: { ..., contextSummary, compressionThreshold }   ** NEW FIELDS **
    |-- messages: ALL ChatMessage[] (unchanged at transport layer)
    |
    v
Hono Router: POST /chat/{provider}
    |-- Parses: RouterRequestBody (with new optional fields)
    |-- ** NEW: If contextSummary exists, prepare compressed message set **
    |--   1. Prepend summary as system context or first message
    |--   2. Only send recent N messages (after last summarized point)
    |-- Converts: convertToModelMessages(compressedMessages)
    |-- Creates: LanguageModel client
    |-- Calls: Agent.stream({ messages: convertedMessages })
    |
    v
AI Provider receives SUMMARY + RECENT messages (fewer tokens)
    |
    v
Response streams back (unchanged)
    |
    v
onFinish():
    |-- persistedMessagesState.current = messages (unchanged)
    |-- Title generation (unchanged)
    |-- ** NEW: Context summary update (async, non-blocking) **
    |--   |-- Check threshold: enough new messages since last summary?
    |--   |-- Call generateContextSummary()
    |--   |-- Update persistedChatParamsState.current.contextSummary
    |-- Suggestions generation (unchanged)
```

---

## Integration Points (Detailed)

### 1. ThreadParmas Interface (src/shared/types.ts, line 130)

**Current:**
```typescript
export interface ThreadParmas {
  id: string;
  title: string;
  temperature: number | null;
  // ... 15+ existing fields
  incrementalSummary?: string;  // line 152 - already exists for title gen
  clearScreenMessageId?: string;
}
```

**Change:** Add 3 optional fields:
```typescript
export interface ThreadParmas {
  // ... all existing fields unchanged

  /** Rolling context summary for compression - separate from title summary */
  contextSummary?: string;
  /** ID of the last message included in the context summary */
  contextSummaryMessageId?: string;
  /** Per-thread compression toggle (default follows global setting) */
  compressionEnabled?: boolean;
}
```

**Why separate from `incrementalSummary`:**
- Title generation summary (`incrementalSummary`) is optimized for brevity (10-20 words/characters)
- Context compression summary needs to be longer and preserve conversation nuances
- Different update frequencies: title on every message, compression only when threshold hit
- Independent control: user may want titles but not compression, or vice versa

**Impact:** LOW -- Adding optional fields is fully backward compatible. PersistedState will ignore missing fields on hydration.

---

### 2. ChatState Getters/Setters (src/lib/stores/chat-state.svelte.ts, ~line 431)

**Current pattern (see line 431-437 for `clearScreenMessageId`):**
```typescript
get clearScreenMessageId(): string | undefined {
  return persistedChatParamsState.current.clearScreenMessageId;
}
set clearScreenMessageId(value: string | undefined) {
  persistedChatParamsState.current.clearScreenMessageId = value;
}
```

**Change:** Add matching getters/setters:
```typescript
get contextSummary(): string | undefined {
  return persistedChatParamsState.current.contextSummary;
}
set contextSummary(value: string | undefined) {
  persistedChatParamsState.current.contextSummary = value;
}

get contextSummaryMessageId(): string | undefined {
  return persistedChatParamsState.current.contextSummaryMessageId;
}
set contextSummaryMessageId(value: string | undefined) {
  persistedChatParamsState.current.contextSummaryMessageId = value;
}

get compressionEnabled(): boolean {
  return persistedChatParamsState.current.compressionEnabled ?? false;
}
set compressionEnabled(value: boolean) {
  persistedChatParamsState.current.compressionEnabled = value;
}
```

**Impact:** LOW -- Following exact existing pattern.

---

### 3. DynamicChatTransport Body (src/lib/stores/chat-state.svelte.ts, line 1496-1553)

**Current:**
```typescript
body: () => {
  return {
    baseUrl: ...,
    temperature: ...,
    systemPrompt: ...,
    threadId,
    sessionId,
    // ... 15+ fields
  };
}
```

**Change:** Add 2 fields to the return object:
```typescript
body: () => {
  return {
    // ... all existing fields unchanged

    // Context compression (NEW)
    contextSummary: persistedChatParamsState.current.contextSummary,
    contextSummaryMessageId: persistedChatParamsState.current.contextSummaryMessageId,
  };
}
```

**Impact:** LOW -- Adding optional fields. Transport sends these with every request; backend ignores them if compression not enabled.

---

### 4. RouterRequestBody Type (electron/main/server/router.ts, line 43)

**Current:**
```typescript
export type RouterRequestBody = {
  baseUrl?: string;
  model?: string;
  // ... 20+ fields
  messages: UIMessage[];
  threadId: string;
};
```

**Change:** Add optional compression fields:
```typescript
export type RouterRequestBody = {
  // ... all existing fields

  /** Rolling context summary to prepend to messages */
  contextSummary?: string;
  /** Last message ID included in the summary (for truncation) */
  contextSummaryMessageId?: string;
};
```

**Impact:** LOW -- Type extension only.

---

### 5. Router Chat Endpoints (electron/main/server/router.ts, line 178+)

**Current pattern (302ai endpoint, line 178-416):**
```typescript
app.post("/chat/302ai", async (c) => {
  const { baseUrl, model, apiKey, messages, ... } = await c.req.json<...>();

  // ... provider setup
  // ... MCP tools setup
  // ... user prompt template resolution

  const convertedMessages = await convertToModelMessages(
    enhanceMessagesWithFeedback(resolvedMessages)
  );

  const baseConfig = {
    model: wrapModel,
    messages: convertedMessages,
    ...(systemPrompt && { system: systemPrompt }),
  };

  // ... Agent.stream() call
});
```

**Change:** Add message compression logic before `convertToModelMessages`:
```typescript
app.post("/chat/302ai", async (c) => {
  const { ..., contextSummary, contextSummaryMessageId } = await c.req.json<...>();

  // ... existing provider setup (unchanged)
  // ... existing MCP tools setup (unchanged)
  // ... existing user prompt template resolution (unchanged)

  // NEW: Apply context compression
  let messagesToConvert = resolvedMessages;
  let effectiveSystemPrompt = systemPrompt;

  if (contextSummary && contextSummaryMessageId) {
    const { compressedMessages, augmentedSystemPrompt } = applyContextCompression(
      resolvedMessages,
      contextSummary,
      contextSummaryMessageId,
      systemPrompt,
    );
    messagesToConvert = compressedMessages;
    effectiveSystemPrompt = augmentedSystemPrompt;
  }

  const convertedMessages = await convertToModelMessages(
    enhanceMessagesWithFeedback(messagesToConvert)
  );

  // ... rest unchanged, but use effectiveSystemPrompt instead of systemPrompt
});
```

**Must apply to all 4 provider endpoints:** `/chat/302ai`, `/chat/openai`, `/chat/anthropic`, `/chat/gemini`. Consider extracting into shared helper.

**Impact:** MEDIUM -- Core logic change. Must be careful not to break existing message flow. Extract into utility function to avoid code duplication across 4 endpoints.

---

### 6. onFinish Callback (src/lib/stores/chat-state.svelte.ts, line 1559-1934)

**Current relevant section (title generation, line 1709-1818):**
```typescript
onFinish: async ({ messages }) => {
  // ... message metadata updates (line 1559-1616)
  // ... code agent handling (line 1618-1647)
  // ... persist messages (line 1654)

  // Title generation (line 1709-1818)
  const titleTiming = preferencesSettings.titleGenerationTiming;
  // ...
  if (shouldGenerateTitle && titleModel) {
    const titleAbortSignal = chatState.createTitleAbortController();
    const result = await generateTitle(..., titleAbortSignal);
    if (result) {
      persistedChatParamsState.current.title = result.title;
      persistedChatParamsState.current.incrementalSummary = result.summary;
    }
  }

  // Suggestions generation (line 1829-1928)
  // ... async, non-blocking
}
```

**Change:** Add context summary update between title generation and suggestions:
```typescript
onFinish: async ({ messages }) => {
  // ... all existing logic unchanged

  // Title generation (existing, unchanged)
  // ...

  // Context summary update (NEW - between title and suggestions)
  if (preferencesSettings.contextCompressionEnabled) {
    const lastMessage = messages[messages.length - 1];
    const lastSummaryId = persistedChatParamsState.current.contextSummaryMessageId;
    const messagesSinceSummary = getMessageCountSince(messages, lastSummaryId);

    if (shouldUpdateContextSummary(messagesSinceSummary)) {
      const summaryAbortSignal = chatState.createSummaryAbortController();
      generateContextSummary(
        messages,
        chatState.selectedModel,
        chatState.currentProvider,
        serverPort,
        persistedChatParamsState.current.contextSummary,
        summaryAbortSignal,
      )
        .then((result) => {
          if (!summaryAbortSignal.aborted && !chatState.isStreaming) {
            persistedChatParamsState.current.contextSummary = result.summary;
            persistedChatParamsState.current.contextSummaryMessageId = lastMessage.id;
            persistedChatParamsState.flush();
          }
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            console.error("[ContextSummary] Failed:", error);
          }
        });
    }
  }

  // Suggestions generation (existing, unchanged)
  // ...
}
```

**Impact:** MEDIUM -- Adding async logic to onFinish. Must follow exact same patterns as title generation (AbortController, abort checks, flush).

---

### 7. New Backend Endpoint (electron/main/server/router.ts)

**Existing pattern:** `/generate-title` (line 942-1088)

**New endpoint:** `/generate-context-summary`
```typescript
app.post("/generate-context-summary", async (c) => {
  const {
    messages,
    model,
    apiKey,
    baseUrl,
    providerType,
    previousSummary,
  } = await c.req.json<{
    messages: UIMessage[];
    model: string;
    apiKey?: string;
    baseUrl?: string;
    providerType: ModelProvider["apiType"];
    previousSummary?: string;
  }>();

  // Create language model (same provider switch as /generate-title)
  let languageModel;
  switch (providerType) { /* same as existing */ }

  const conversationText = messages.map(msg => {
    const role = msg.role === "user" ? "User" : "Assistant";
    const text = msg.parts.filter(p => p.type === "text").map(p => p.text).join(" ");
    return `${role}: ${text}`;
  }).join("\n");

  let prompt: string;
  if (!previousSummary) {
    prompt = `Summarize this conversation preserving key topics, decisions, and context:
${conversationText}
Return ONLY a JSON: {"summary": "your summary here"}`;
  } else {
    prompt = `Update this summary with the new conversation:
Previous: ${previousSummary}
New messages:
${conversationText}
Return ONLY a JSON: {"summary": "updated summary here"}`;
  }

  const { text } = await generateText({ model: languageModel, prompt });
  // Parse and return (follow /generate-title error handling pattern)
});
```

**Impact:** LOW -- New endpoint, follows existing `/generate-title` pattern exactly.

---

### 8. Frontend API Wrapper (NEW: src/lib/api/context-summary.ts)

**Existing pattern:** `src/lib/api/title-generation.ts`

```typescript
// src/lib/api/context-summary.ts
export async function generateContextSummary(
  messages: ChatMessage[],
  model: Model,
  provider: ModelProvider | undefined,
  serverPort: number,
  previousSummary?: string,
  signal?: AbortSignal,
): Promise<{ summary: string } | null> {
  const response = await fetch(`http://localhost:${serverPort}/generate-context-summary`, {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      model: model.id,
      apiKey: provider?.apiKey,
      baseUrl: provider?.baseUrl,
      providerType: provider?.apiType || "openai",
      previousSummary,
    }),
  });
  // ... error handling, JSON parsing (follow title-generation.ts pattern)
}
```

**Impact:** LOW -- New file following existing pattern.

---

## New Components Required

| Component | Location | Purpose | Pattern Source |
|-----------|----------|---------|---------------|
| `context-summary.ts` | `src/lib/api/` | Frontend API wrapper | `title-generation.ts` |
| `/generate-context-summary` | `router.ts` | Backend endpoint | `/generate-title` |
| `applyContextCompression()` | `router.ts` or `utils.ts` | Message truncation logic | New, but simple |
| AbortController for summary | `chat-state.svelte.ts` | Cancel pending summary | Title generation AbortController |

### Optional UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `compression-indicator.svelte` | `src/lib/components/buss/chat/` | Shows when compression is active |
| Compression toggle | Preferences settings | Enable/disable per-thread or globally |

---

## Data Flow: Context Compression in Detail

### Step-by-Step: Message Send with Compression

```
1. User types message, clicks Send
   |
2. chatState.sendMessage() fires
   |
3. chat.sendMessage({ text, body }) where body includes:
   {
     model: "gpt-4o",
     apiKey: "...",
     contextSummary: "User discussed X, Y, Z. Key decision: ...",
     contextSummaryMessageId: "abc123",  // last summarized msg
     // ... all other existing fields
   }
   |
4. DynamicChatTransport POSTs to /chat/302ai
   Body includes all messages[] AND contextSummary
   |
5. Router receives request, destructures contextSummary
   |
6. IF contextSummary && contextSummaryMessageId:
   |
   +-- a. Find index of contextSummaryMessageId in messages
   |      (messages after this point are "recent", before are "summarized")
   |
   +-- b. Create compressed message set:
   |      - Prepend summary to systemPrompt (or as system message)
   |      - Keep only messages AFTER contextSummaryMessageId
   |
   +-- c. Example: 50 messages -> summary + 10 recent messages
   |
7. ELSE (no summary): Send ALL messages as before
   |
8. convertToModelMessages(compressedOrFullMessages)
   |
9. Agent.stream({ messages: converted }) -> AI provider
   |
10. AI sees: [system: "Previous context: ..."] + [recent messages]
    Instead of: [all 50 messages]
```

### Step-by-Step: Summary Update After Response

```
1. AI response completes, onFinish() fires
   |
2. Existing logic runs:
   - Persist messages
   - Update title (if needed)
   |
3. NEW: Check compression threshold
   |
   +-- Count messages since last summary:
   |   lastSummaryIdx = messages.findIndex(m => m.id === contextSummaryMessageId)
   |   messagesSince = messages.length - lastSummaryIdx - 1
   |
   +-- IF messagesSince >= THRESHOLD (e.g., 10 message pairs):
       |
       +-- Determine which messages to summarize:
       |   newMessages = messages from lastSummaryIdx+1 to latest
       |
       +-- Call generateContextSummary():
       |   POST /generate-context-summary
       |   Body: { messages: newMessages, previousSummary, model, ... }
       |
       +-- On success (async, non-blocking):
           persistedChatParamsState.current.contextSummary = result.summary
           persistedChatParamsState.current.contextSummaryMessageId = latestMsg.id
           persistedChatParamsState.flush()
```

---

## Architecture Decision: Where to Truncate Messages

### Option A: Frontend Truncation (in DynamicChatTransport)
**How:** Transport sends only recent messages + summary
**Pro:** Less data over the wire
**Con:** Backend loses access to full history; breaks user prompt template resolution; complex transport modification

### Option B: Backend Truncation (in router.ts) -- RECOMMENDED
**How:** Transport sends everything; router truncates before AI call
**Pro:** Simpler transport (no change to message sending); backend has full context for prompt resolution; clean separation
**Con:** Slightly more data sent to local Hono server (negligible, it is localhost)

**Decision: Option B.** Backend truncation is simpler, maintains existing patterns, and avoids modifying the transport layer. Since Hono runs on localhost, the extra data transfer is negligible.

---

## Architecture Decision: Summary Storage Location

### Option A: In ThreadParmas (alongside incrementalSummary)
**Pro:** Simple, follows existing pattern, persisted automatically
**Con:** Larger ThreadParmas object (but only by ~2KB)

### Option B: Separate storage key (e.g., `app-context-summary:{threadId}`)
**Pro:** Clean separation from thread params
**Con:** Extra storage key to manage, extra hydration, must clean up on thread delete

**Decision: Option A.** ThreadParmas already stores `incrementalSummary`. Adding `contextSummary` to the same location follows the established pattern and avoids separate lifecycle management.

---

## Architecture Decision: Summary vs System Prompt Integration

### Option A: Prepend to System Prompt
**How:** `system: "[Summary]\n\n[User's system prompt]"`
**Pro:** Works with all providers; clean single injection point
**Con:** Mixes user's custom system prompt with auto-generated content

### Option B: Inject as First Message
**How:** `messages: [{ role: "system", content: "[Summary]" }, ...recentMessages]`
**Pro:** Separate from user's system prompt
**Con:** Some providers handle system messages differently

### Option C: Inject as User/Assistant Pair -- RECOMMENDED
**How:** `messages: [{ role: "user", content: "Context: [Summary]" }, { role: "assistant", content: "Understood." }, ...recentMessages]`
**Pro:** Works universally across all providers; doesn't interfere with system prompt
**Con:** Uses 2 extra message slots

**Decision: Option A for simplicity, with Option C as fallback.** Prepending to system prompt is the cleanest approach for the initial implementation. If provider-specific issues arise, Option C provides a universal fallback. The `applyContextCompression()` utility should support both modes.

---

## Suggested Build Order

### Phase 1: Data Model & Storage (Foundation)
- Extend `ThreadParmas` with `contextSummary`, `contextSummaryMessageId`, `compressionEnabled`
- Add getters/setters in `ChatState`
- Add global compression setting in `preferencesSettings`
- Verify PersistedState correctly handles the new optional fields (no migration needed since optional)

**Rationale:** Data model must exist before any feature code. LOW risk, no runtime changes.

### Phase 2: Backend Summarization Endpoint
- Create `/generate-context-summary` endpoint in `router.ts`
- Design compression-focused prompt (must preserve decisions, names, context -- not just topics)
- Create `src/lib/api/context-summary.ts` API wrapper
- Add `AbortController` management to `ChatState` for summary generation

**Rationale:** Backend must exist before frontend can generate summaries. Can be tested independently.

### Phase 3: Message Compression in Router
- Add `contextSummary` and `contextSummaryMessageId` to `RouterRequestBody`
- Implement `applyContextCompression()` utility in `router.ts` utils
- Add compression logic to all 4 chat endpoints (`/chat/302ai`, `/chat/openai`, `/chat/anthropic`, `/chat/gemini`)
- Pass compression fields through `DynamicChatTransport.body()`

**Rationale:** Core feature that actually reduces tokens. Depends on Phase 1 (fields to read) but not Phase 2 (can use hardcoded summary for testing).

### Phase 4: Automatic Summary Updates
- Add threshold-based summary generation to `onFinish` callback
- Implement `shouldUpdateContextSummary()` logic
- Wire up AbortController cancellation (cancel summary if user sends new message)
- Ensure summary persists correctly via `flush()`

**Rationale:** Completes the feedback loop. Depends on Phases 1-3.

### Phase 5: UI Indicators & Settings
- Add compression toggle to preferences settings
- Create compression status indicator in chat UI
- Optional: summary viewer/editor for debugging
- Optional: per-thread compression toggle

**Rationale:** Polish and user control. Can be deferred if core works well.

---

## Patterns to Follow

### Pattern 1: Async Non-Blocking Generation (from title-generation, line 1740-1803)
```typescript
// Don't await -- fire and forget with abort handling
const abortSignal = chatState.createSummaryAbortController();
generateContextSummary(...)
  .then((result) => {
    if (!abortSignal.aborted && !chatState.isStreaming) {
      // Safe to update state
    }
  })
  .catch((error) => {
    if (error.name !== "AbortError") {
      console.error("[ContextSummary] Failed:", error);
    }
  });
```

### Pattern 2: PersistedState Flush After Batch Updates (line 1825)
```typescript
// After updating multiple fields, flush to ensure persistence
persistedChatParamsState.current.contextSummary = result.summary;
persistedChatParamsState.current.contextSummaryMessageId = lastMessage.id;
persistedChatParamsState.flush();  // Force immediate persist
```

### Pattern 3: Provider-Agnostic Model Creation (from /generate-title, line 963-1000)
```typescript
// Reuse the existing switch statement for creating language models
let languageModel;
switch (providerType) {
  case "302ai": { /* ... */ break; }
  case "openai": { /* ... */ break; }
  case "anthropic": { /* ... */ break; }
  case "gemini": { /* ... */ break; }
  default: return c.json({ error: "Invalid provider type" }, 400);
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying messages Array In-Place in Frontend
**What:** `chatState.messages.splice(0, summarizedCount)` to remove old messages
**Why bad:** Messages array is reactive via `$state`. Mutation triggers re-renders. Persisted messages would lose history. Message deletion is permanent.
**Instead:** Keep full message history in storage. Only truncate in router before AI call.

### Anti-Pattern 2: Blocking Chat on Summary Generation
**What:** `await generateContextSummary(...)` in the critical path before `sendMessage` returns
**Why bad:** Summary generation takes 2-5 seconds. User would be unable to interact.
**Instead:** Generate summary asynchronously in `onFinish`, exactly like title generation.

### Anti-Pattern 3: Compressing Every Message Exchange
**What:** Update summary after every single AI response
**Why bad:** Expensive (extra API call per message), race conditions with rapid messages, diminishing returns for short conversations.
**Instead:** Threshold-based updates (e.g., every 10 message pairs or ~8000 estimated tokens).

### Anti-Pattern 4: Storing Summary in Messages Array
**What:** Inserting a synthetic "summary" message into `persistedMessagesState`
**Why bad:** Breaks message replay, confuses message indexing, shows in UI as real message, hard to update.
**Instead:** Store in `ThreadParmas` as metadata. Inject server-side before AI call only.

### Anti-Pattern 5: Sharing Summary Between Title and Compression
**What:** Reusing `incrementalSummary` for both title generation and context compression
**Why bad:** Title summaries are 10-20 words. Context summaries need 200-500 words. Different optimization goals. Changing one breaks the other.
**Instead:** Separate fields: `incrementalSummary` (title) and `contextSummary` (compression).

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Summary loses critical context | MEDIUM | HIGH | Include explicit "preserve: names, decisions, numbers" in prompt; keep recent messages uncompressed |
| Summary generation costs add up | MEDIUM | MEDIUM | Threshold-based updates (not per-message); use small/cheap model for summarization |
| Race condition: summary update vs new message | LOW | MEDIUM | AbortController cancels pending summary when new message sent (title gen pattern) |
| Backward compatibility: old threads without fields | LOW | LOW | All new fields are optional with sensible defaults |
| Multiple provider endpoints need same change | MEDIUM | LOW | Extract `applyContextCompression()` utility; apply to all 4 endpoints |
| Summary gets stale if thread inactive then resumed | LOW | LOW | Re-summarize on first message after long gap (check timestamp delta) |

---

## Branch Point Considerations

The codebase supports branching conversations (`createBranch`, `createBranchAndSend` in chat-state.svelte.ts lines 1180-1349). When branching:

- **contextSummary should be cloned to the branch** (it reflects history up to the branch point)
- **contextSummaryMessageId should be cloned too** (same reason)
- Existing `createBranch` clones thread params via `clone()`, so new fields automatically included

This requires no special handling -- the `clone(persistedChatParamsState.current)` pattern already copies all ThreadParmas fields.

---

## Thread Deletion Impact

`ThreadStorage.deleteThread()` (line 59-73) removes:
- `app-thread:{threadId}` (contains ThreadParmas, includes our new fields)
- `app-chat-messages:{threadId}`

Since contextSummary lives inside ThreadParmas, it is automatically cleaned up on thread deletion. No extra cleanup needed.

---

## Confidence: HIGH

**Rationale:**
1. Every integration point was verified directly from source code (not assumed)
2. The `incrementalSummary` pattern proves this architecture works at this exact codebase
3. All 4 provider endpoints follow identical patterns, so compression logic can be applied uniformly
4. The `onFinish` callback already handles 3 async tasks (persist, title, suggestions) -- adding a 4th is established pattern
5. ThreadParmas extension with optional fields has zero migration risk
6. No architectural changes needed -- only extensions to existing structures

The main uncertainty is **prompt engineering quality** for the context summary -- what to include, how much detail to preserve, how to handle multi-topic conversations. This is a tuning concern, not an architectural one, and can be iterated after the integration is working.

---

## Sources

- **ThreadParmas definition:** `/home/ai/code/buss/302-AI-Studio-SV/src/shared/types.ts` line 130-155
- **ChatState class:** `/home/ai/code/buss/302-AI-Studio-SV/src/lib/stores/chat-state.svelte.ts` (1936 lines)
- **DynamicChatTransport:** `/home/ai/code/buss/302-AI-Studio-SV/src/lib/transport/dynamic-chat-transport.ts`
- **Hono router:** `/home/ai/code/buss/302-AI-Studio-SV/electron/main/server/router.ts` (1891 lines)
- **Title generation API:** `/home/ai/code/buss/302-AI-Studio-SV/src/lib/api/title-generation.ts`
- **ThreadStorage:** `/home/ai/code/buss/302-AI-Studio-SV/electron/main/services/storage-service/thread-storage.ts`
- **PersistedState:** `/home/ai/code/buss/302-AI-Studio-SV/src/lib/hooks/persisted-state.svelte.ts`
- **ThreadsState store:** `/home/ai/code/buss/302-AI-Studio-SV/src/lib/stores/threads-state.svelte.ts`
