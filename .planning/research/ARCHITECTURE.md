# Architecture Research: Streaming Completion Flow

**Domain:** AI Chat UI with SSE streaming completion detection
**Researched:** 2026-02-02
**Confidence:** HIGH (verified from codebase patterns, Vercel AI SDK v6 integration)

## Executive Summary

The 302-AI-Studio streaming completion flow uses Vercel AI SDK v6 with Hono.js backend and Server-Sent Events (SSE). The flow is **fully functional with proper completion signaling**, but completion detection depends on three layers correctly emitting and receiving finish events:

1. **Backend**: AI SDK `toUIMessageStream()` → SSE `finish` + `[DONE]` events
2. **Transport**: `DynamicChatTransport` passes SSE unchanged to consumer
3. **Frontend**: `Chat.sendMessage()` + `onFinish()` callback processes completion

The common failure mode: **UI state (spinner) doesn't clear because `onFinish()` isn't called** — usually because the finish event is malformed, missing, or the stream closes before it's processed.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Svelte)                                │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │ UI State: chat.status (ready → submitted → streaming → ready)   │     │
│  │ Spinner: isStreaming, isSubmitted ($derived from chat.status)   │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                  ↑                                        │
│                                  │                                        │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │ @ai-sdk/svelte: Chat class instance                             │     │
│  │ - sendMessage() → POST to /chat/[provider]                      │     │
│  │ - messages: ChatMessage[] ($state)                              │     │
│  │ - status: "ready" | "submitted" | "streaming" | "error"        │     │
│  │ - onFinish(result) callback: processes completion               │     │
│  │ - transport: DynamicChatTransport                               │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                  ↑                                        │
│                                  │ SSE stream from Hono                   │
├──────────────────────────────────────────────────────────────────────────┤
│                  TRANSPORT LAYER: DynamicChatTransport                    │
├──────────────────────────────────────────────────────────────────────────┤
│  Custom fetch interceptor that:                                           │
│  1. Reads raw SSE stream from response.body                              │
│  2. Buffers and parses SSE "data: {...}" lines                           │
│  3. Filters message-metadata events → stores in pendingResultMetadata     │
│  4. Converts error events to text-delta for UI display                    │
│  5. Passes all other events unchanged to AI SDK consumer                  │
│  6. Closes stream on abort signal or stream end                          │
│  └────────────────────────────────────────────────────────────────────────┘
│                                  ↑                                        │
│                                  │ Raw HTTP response stream               │
├──────────────────────────────────────────────────────────────────────────┤
│                    BACKEND: Hono.js (localhost:8089)                      │
├──────────────────────────────────────────────────────────────────────────┤
│  POST /chat/[provider] (OpenAI, Anthropic, Gemini, 302AI)                │
│                                  │                                        │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │ 1. Create LanguageModel (AI SDK provider client)                │     │
│  │ 2. Call: new Agent(config).stream(...)                          │     │
│  │    OR: generateText(config) for non-streaming models             │     │
│  │ 3. Get result.toUIMessageStream()                               │     │
│  │    - Converts AI SDK stream to SSE events                        │     │
│  │    - Emits: start, text-start, text-delta, text-end, finish    │     │
│  │    - Final event: [DONE] marker                                  │     │
│  │ 4. Return Response with SSE headers                             │     │
│  │    - Content-Type: text/event-stream                             │     │
│  │    - Cache-Control: no-cache                                     │     │
│  │    - Connection: keep-alive                                      │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                  ↑                                        │
│                   AI SDK streamText() / stream()                          │
│                                  ↑                                        │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │ AI Provider API (OpenAI, Anthropic, Google, 302AI)              │     │
│  │ Streams: text chunks via HTTP SSE                               │     │
│  └─────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries & Completion Responsibilities

| Layer | Component | Completion Signal Responsibility | How It Works |
|-------|-----------|----------------------------------|--------------|
| **Frontend** | `chatState`, `chat` (Chat class) | Detect `onFinish()` call, clear spinner | Chat SDK calls `onFinish({ messages, isAbort, isError })` when finish event received |
| **Frontend** | `chatState.isStreaming` | Show/hide spinner via `$derived` | Computed from `chat.status === "streaming"` |
| **Transport** | `DynamicChatTransport.fetch()` | Pass SSE events to AI SDK | Read stream line-by-line, forward events, intercept metadata events only |
| **Backend** | `createUIMessageStreamFromGenerator()` | Emit SSE `finish` + `[DONE]` | Send all 10 SSE event types (start, text-start, text-delta, text-end, finish-step, message-metadata, finish, [DONE]) |
| **Backend** | `Agent.stream().toUIMessageStream()` | Format AI SDK stream as SSE | AI SDK Vercel v6 handles this automatically |
| **Backend** | Language Model Client | Emit `GenerateTextResult` | Receives from AI provider, AI SDK shapes into UIMessageStream |
| **Provider API** | OpenAI/Anthropic/Google | Emit final SSE stream-end | HTTP connection closes or sends final chunk |

---

## Complete Data Flow: Streaming Completion Signal

### Path 1: Normal Streaming (Agent-based, most common)

```
1. Frontend: chat.sendMessage(input)
   ↓
2. Transport: HTTP POST /chat/openai
   ├─ DynamicChatTransport.fetch() hooks response.body
   ├─ Awaits response (opens HTTP stream)
   ↓
3. Backend: app.post("/chat/openai", ...) → new Agent().stream()
   ├─ AI SDK creates LanguageModel client
   ├─ Calls agent.stream({messages})
   ├─ AI provider sends streaming SSE
   ↓
4. Backend: result.toUIMessageStream()
   ├─ Converts AI SDK stream to SSE format
   ├─ Emits: "data: {\"type\":\"start\"}\n\n"
   ├─ Emits: "data: {\"type\":\"text-start\"}\n\n"
   ├─ Emits: "data: {\"type\":\"text-delta\",\"delta\":\"hello\"}\n\n"  [repeats]
   ├─ Emits: "data: {\"type\":\"text-end\"}\n\n"
   ├─ Emits: "data: {\"type\":\"finish\",\"finishReason\":\"stop\"}\n\n"  ← CRITICAL
   └─ Emits: "data: [DONE]\n\n"
   ↓
5. Transport: DynamicChatTransport.fetch()
   ├─ Reader reads all chunks until done=true
   ├─ Decoder converts bytes → string
   ├─ Parses lines, skips message-metadata lines
   ├─ Enqueues all events (including "finish") to ReadableStream
   ├─ controller.close() when stream ends
   ↓
6. Frontend: Chat SDK @ai-sdk/svelte
   ├─ DefaultTransport consumer reads SSE events
   ├─ Parses each "data: {...}" line
   ├─ Accumulates message parts
   ├─ On "finish" event: constructs final ChatMessage
   ├─ Calls onFinish({ messages, isAbort: false, isError: false })
   ↓
7. Frontend: onFinish callback (chatState.ts line 1529)
   ├─ chat.status becomes "ready"
   ├─ isStreaming $derived becomes false
   ├─ Spinner hides
   ├─ persistedMessagesState updated
   ├─ Generates title (if enabled)
   └─ Generates suggestions (async, non-blocking)
```

### Path 2: Non-Streaming Models (Image generation, some specialized models)

```
1-2. Same as Path 1, but:

3. Backend: isStreamingSupported(model) returns false
   ├─ Skip Agent.stream()
   ├─ Call: generateText(config) instead
   ├─ Returns: { text: "..." }
   ↓
4. Backend: createUIMessageStreamFromGenerator(async () => result.text)
   ├─ Creates ReadableStream
   ├─ Enqueues: "start" event
   ├─ Awaits contentGenerator() async
   ├─ Enqueues: "text-start"
   ├─ Enqueues: "text-delta" (full content, not streamed)
   ├─ Enqueues: "text-end"
   ├─ Enqueues: "finish-step"
   ├─ Enqueues: "message-metadata"
   ├─ Enqueues: "finish" event ← CRITICAL
   └─ Enqueues: "[DONE]"
   ↓
5-7. Same as Path 1 (AI SDK processes identical SSE format)
```

### Path 3: Error Flow (Completion with error flag)

```
1-3. Same as Path 1 or 2, but error occurs...

4. Backend Error Handler:
   ├─ Catches error in Agent.stream() or generateText()
   ├─ Calls: sendStreamError(controller, errorMessage)
   │  └─ Sends: "text-start", "text-delta" (error), "text-end"
   │  └─ Sends: "finish" with finishReason: "error"
   │  └─ Sends: "[DONE]"
   ├─ OR error in ReadableStream.start() catch block
   └─ Ends stream
   ↓
5-7. Frontend: onFinish called with isError: true
   ├─ Spinner hides
   ├─ Error displayed (either from text-delta or error handler)
   └─ chatState.lastError set for retry UI
```

### Path 4: Abort/Disconnect (Spinner should hide)

```
1-3. Same as Path 1...

5. User clicks "Stop" or closes tab during streaming:
   ├─ Transport: abort signal triggered
   ├─ reader.cancel() called
   ├─ controller.close() called
   ↓
6. Frontend: AI SDK detects stream closure
   ├─ Constructs partial ChatMessage from buffered data
   ├─ Calls onFinish({ ..., isAbort: true, isError: false })
   ↓
7. Frontend: onFinish callback
   ├─ chat.status → "ready"
   ├─ isStreaming → false
   └─ Spinner hides (partial response visible)
```

---

## Critical Architecture Points: Why Spinners Stick

### 1. **Finish Event Must Include Both Type and FinishReason**

**Correct:**
```json
{"type": "finish", "finishReason": "stop", "messageMetadata": {...}}
```

**Broken (spinner won't clear):**
```json
{"type": "finish"}
{"finishReason": "stop"}
{"finish": {"finishReason": "stop"}}
```

**Why:** Vercel AI SDK's SSE parser specifically checks for the `finish` event type. If malformed, the stream closes without triggering `onFinish()`.

### 2. **[DONE] Marker Optional But Recommended**

The `[DONE]` marker (`data: [DONE]\n\n`) is a **hint** that stream is ending, not a completion signal.

**Correct flow:**
```
emit: "finish" event
emit: "[DONE]" marker
stream ends (controller.close())
→ onFinish() called
```

**Broken flow (still works but fragile):**
```
emit: "finish" event
stream ends WITHOUT [DONE]
→ onFinish() called (but relies on HTTP end, not explicit marker)
```

### 3. **Stream Must Close After Finish Event**

If the ReadableStream doesn't close (`controller.close()`), the AI SDK thinks streaming is ongoing even after finish event.

**Correct:**
```typescript
controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish", ... })}\n\n`));
controller.close();  // ← REQUIRED
```

**Broken:**
```typescript
controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish", ... })}\n\n`));
// Missing: controller.close()
```

### 4. **SSE Line Parsing is Strict**

Each event **must** be on its own line with `\n\n` separator:

**Correct:**
```
data: {"type":"start"}\n\n
data: {"type":"text-delta","delta":"hello"}\n\n
data: {"type":"finish","finishReason":"stop"}\n\n
```

**Broken (spinner won't hide):**
```
data: {"type":"start"}\ndata: {"type":"text-delta","delta":"hello"}\n\n
data: {"type":"finish","finishReason":"stop"}  [missing second \n]
```

**Why:** The transport's line-by-line parser (`buffer.split("\n")`) won't recognize malformed events. They get dropped or passed as garbage to the AI SDK.

---

## Streaming Completion Patterns: When to Check

### Investigation Order

1. **Verify Backend Emits Finish Events**
   ```typescript
   // In /chat/[provider] endpoints
   const stream = result.toUIMessageStream({...});
   // If using createUIMessageStreamFromGenerator, check all 10 events are emitted
   console.log("Sending finish event");
   ```
   **Check:** Server logs show "finish" event? HTTP response has `text/event-stream` header?

2. **Verify Transport Receives Finish Events**
   ```typescript
   // In DynamicChatTransport.fetch()
   for (const line of lines) {
       if (line.includes('"type":"finish"')) {
           console.log("Received finish event:", line);
       }
       controller.enqueue(encoder.encode(line + "\n"));
   }
   ```
   **Check:** Browser console shows "Received finish event"? Line is complete JSON?

3. **Verify AI SDK Processes Finish Events**
   - No direct logging in @ai-sdk/svelte (closed library)
   - **Indirect check:** Does `onFinish()` get called? Add log at start of onFinish callback
   ```typescript
   onFinish: async (result) => {
       console.log("[DEBUG] onFinish called with:", result.isAbort, result.isError);
   }
   ```

4. **Check UI State Reflects Completion**
   ```svelte
   <div>{chatState.isStreaming ? "Loading..." : "Ready"}</div>
   ```
   **Check:** Does isStreaming change to false? (Should be automatic if onFinish called)

---

## Integration Points That Break Completion

### Point 1: Hono Response Headers

**Must have:**
```typescript
return new Response(stream, {
    status: 200,
    headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "x-vercel-ai-ui-message-stream": "v1",
    },
});
```

**If missing:** Browser may buffer stream or interpret as non-streaming. AI SDK won't start consuming events.

### Point 2: Stream Encoder/Decoder

**Correct:**
```typescript
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Backend
controller.enqueue(encoder.encode(`data: ${JSON.stringify({...})}\n\n`));

// Transport
const chunk = decoder.decode(value, { stream: true });
```

**If wrong:** Byte-string mismatches, multi-byte chars corrupted, JSON parse fails.

### Point 3: Error Event Handling

**Transport properly converts error events to text:**
```typescript
if (line.includes('"type":"error"')) {
    const data = JSON.parse(line.replace(/^data: /, ""));
    // Convert to text-delta so user sees error in message
    controller.enqueue(...text-start...);
    controller.enqueue(...text-delta with error...);
    controller.enqueue(...text-end...);
}
```

**If missing:** Errors shown as raw JSON, not user-readable. May block finish event processing.

### Point 4: Abort Signal Handling

**Transport listens for abort:**
```typescript
if (signal) {
    signal.addEventListener("abort", () => {
        reader.cancel();
        controller.close();
    });
}
```

**If missing:** Can't stop streaming. User clicks "Stop" but spinner keeps spinning.

---

## Data Flow: Completion Propagation

```
[Backend Finish Event]
    type: "finish"
    finishReason: "stop" | "error" | "length" | "tool-calls"
    ↓
[SSE Encoding]
    Uint8Array: "data: {\"type\":\"finish\",\"finishReason\":\"stop\"}\n\n"
    ↓
[HTTP Response Stream]
    Network: SSE chunk delivered to browser
    ↓
[Transport Layer]
    Line parsing: splits by "\n"
    Event detection: checks for "finish" type
    Forwarding: enqueues line as-is to AI SDK consumer
    ↓
[AI SDK Consumer]
    SSE parser: deserializes JSON
    State machine: switches from "streaming" to "finishing"
    Message construction: finalizes ChatMessage
    Callback: invokes onFinish(result)
    ↓
[UI State Update]
    Svelte 5 reactivity: chat.status → "ready"
    Derived: isStreaming → false
    Components: spinner hidden, enable input
```

---

## Scaling Considerations

| Scale | Completion Challenge | Mitigation |
|-------|----------------------|-----------|
| Single user, local dev | Stream might close before finish event sent | Ensure controller.close() called in all code paths (including error catch) |
| Multiple concurrent streams | Finish events cross-stream (user sees wrong finish event) | Ensure unique message IDs in events, transport tracks per-request state |
| High-latency network | Finish event arrives late, UI delays | Add explicit timeout to isStreaming (defensive programming) |
| Proxy/CDN buffer stream | Finish event held in proxy buffer, doesn't reach browser | Ensure `Connection: keep-alive` and `Cache-Control: no-cache` headers |
| Large AI responses (>1MB) | Stream chunks out of order, finish event lost | Maintain message ID tracking, validate finish event sequence |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Emitting Finish But Not Closing Controller

**What people do:**
```typescript
controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish" })}\n\n`));
// Forgot to close!
```

**Why it's wrong:** ReadableStream waits for more data. Browser socket hangs. Timeout occurs. onFinish never called. Spinner visible indefinitely.

**Do this instead:**
```typescript
controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`));
controller.enqueue(encoder.encode("data: [DONE]\n\n"));
controller.close();
```

### Anti-Pattern 2: Checking isStreaming With Direct Status Access

**What people do:**
```typescript
// BAD: Directly accessing chat.status
if (chat.status === "streaming") showSpinner();
```

**Why it's wrong:** chat.status is internal AI SDK state. Better to use derived:

**Do this instead:**
```svelte
{#if chatState.isStreaming}
  <Spinner />
{/if}
```

where `isStreaming = $derived(chat.status === "streaming");`

### Anti-Pattern 3: Ignoring Transport Layer Events

**What people do:**
```typescript
// Don't intercept transport completely
// Just add your custom fetch without understanding AI SDK expectations
const customFetch = async (input, init) => {
    const response = await fetch(input, init);
    // Return response directly without processing streaming
    return response;
};
```

**Why it's wrong:** You're bypassing necessary SSE parsing, decoder setup, line parsing logic.

**Do this instead:**
```typescript
// Use DynamicChatTransport which:
// 1. Reads response.body as stream
// 2. Parses SSE line-by-line
// 3. Validates JSON
// 4. Passes to AI SDK consumer
transport: new DynamicChatTransport<ChatMessage>({...})
```

### Anti-Pattern 4: Calling onFinish Manually

**What people do:**
```typescript
const stream = result.toUIMessageStream({...});
// Then try to call onFinish yourself
chatState.onFinish(...);
```

**Why it's wrong:** AI SDK already calls onFinish when it detects finish event. You'll call it twice, double-process messages.

**Do this instead:**
```typescript
onFinish: async (result) => {
    // Let AI SDK call this automatically
    // Just react to the result
    console.log("Finished with", result.messages.length, "messages");
}
```

---

## Recommended Project Structure

```
electron/main/server/
├── router.ts                 # Main Hono app with /chat/[provider] endpoints
│   ├─ POST /chat/openai      # Uses Agent.stream() → toUIMessageStream()
│   ├─ POST /chat/anthropic
│   ├─ POST /chat/gemini
│   └─ POST /chat/302ai-code-agent  # Special: custom fetch transform
├── utils.ts                  # Helper functions
│   ├─ createUIMessageStreamFromGenerator()  # For non-streaming models
│   ├─ sendStreamError()                     # Error event helper
│   └─ isStreamingSupported()                # Model filtering
├── claude-code-processor.ts  # Transform 302AI code agent stream (special case)
└── citations-processor.ts    # Transform 302AI citations stream (special case)

src/lib/transport/
├── dynamic-chat-transport.ts # SSE parser + AI SDK adapter
│   ├─ Custom fetch interceptor
│   ├─ Line-by-line SSE parsing
│   ├─ Message-metadata extraction
│   └─ Error event conversion
└── f-chat-transport.ts       # Fallback transport (if needed)

src/lib/stores/
├── chat-state.svelte.ts      # Chat UI state (isStreaming, sendMessage, onFinish)
│   ├─ chat: Chat instance (from @ai-sdk/svelte)
│   ├─ chatState.sendMessage()
│   └─ onFinish() callback
└── ...other stores
```

---

## Key Findings

1. **Completion Flow is Correct in 302-AI-Studio**
   - Backend properly emits finish events (verified in router.ts)
   - Transport correctly passes SSE events (verified in dynamic-chat-transport.ts)
   - Frontend properly processes completion (verified in onFinish callback)

2. **Spinner Visibility Depends on Three Things:**
   - `chat.status` changes from "streaming" to "ready"
   - `isStreaming` derived computed correctly (as `chat.status === "streaming"`)
   - `onFinish()` callback actually called (requires finish event received)

3. **Most Likely Root Cause of Stuck Spinner:**
   - Backend not emitting finish event (check console logs in server)
   - Transport not passing finish event (check browser DevTools Network tab)
   - Finish event malformed (missing finishReason field, invalid JSON)
   - Stream not closing (controller.close() missing)
   - onFinish callback not called (no console.log at start of onFinish)

4. **Completion Signals Pass Through Three Boundaries:**
   - **Backend → Frontend:** SSE HTTP stream (finish event + [DONE])
   - **Transport → AI SDK:** ReadableStream<Uint8Array> (finish event in stream)
   - **AI SDK → Component:** onFinish() callback (isAbort, isError flags)

---

## Sources

- **Codebase Architecture**: Verified from `/electron/main/server/router.ts` (AI SDK integration), `/src/lib/transport/dynamic-chat-transport.ts` (SSE parsing), `/src/lib/stores/chat-state.svelte.ts` (UI state management)
- **AI SDK Patterns**: Vercel AI SDK v6 (`ai` 6.0.1, `@ai-sdk/svelte`) imported and used directly, patterns follow official documentation
- **SSE Format**: Confirmed from `createUIMessageStreamFromGenerator()` implementation, follows server-sent-events specification (WHATWG standard)
- **Streaming Completion Detection**: Reverse-engineered from onFinish callback behavior in existing codebase

---

*Architecture research for: Vercel AI SDK v6 + Hono.js streaming completion detection*
*Investigated: 2026-02-02*
