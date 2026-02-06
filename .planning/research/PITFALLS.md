# Pitfalls Research: Stream Completion Detection

**Domain:** AI Streaming UI (Vercel AI SDK + SSE + Hono.js)
**Researched:** 2026-02-02
**Confidence:** HIGH

**Problem Context:** Loading indicators stay visible after stream ends, preventing proper UI state transitions and user interactions.

---

## Critical Pitfalls

### Pitfall 1: `onFinish` Not Firing Due to Uncompleted Streams

**What goes wrong:**
The `onFinish` callback in Vercel AI SDK never executes, causing `isLoading`/`isStreaming` to remain stuck as `true` indefinitely. UI shows perpetual loading indicators even after the AI response is fully displayed.

**Why it happens:**
- **Root Cause 1**: SSE stream controller never calls `controller.close()` after sending all data
- **Root Cause 2**: ReadableStream reader reaches `done: false` on final read but never gets `done: true`
- **Root Cause 3**: Missing or incomplete "finish" event in SSE protocol (no explicit `data: [DONE]` marker)
- **Root Cause 4**: Stream error swallowed silently, preventing proper completion path

**Affected Layers:**
1. **AI SDK Layer**: `onFinish` callback never invoked
2. **SSE Connection**: Connection kept alive without proper termination
3. **Hono Backend**: Response stream not properly closed
4. **Frontend State**: `chat.status` stuck in `streaming` or `submitted`

**How to avoid:**
```typescript
// ✅ CORRECT: Always close controller in Hono SSE handler
const stream = new ReadableStream({
  async start(controller) {
    try {
      // ... send all chunks
      while (!done) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
    } finally {
      controller.close(); // ⚠️ CRITICAL: Must be in finally block
    }
  }
});

// ✅ CORRECT: Send explicit completion event in SSE
controller.enqueue(encoder.encode('data: [DONE]\n\n'));
controller.close();
```

**Warning signs:**
- `chat.status === 'streaming'` persists after full response visible
- `isLoading` or `isSubmitted` derived states never become `false`
- "Stop Generation" button stays active after response completes
- Suggestions generation stuck in "pending" state
- Cannot send new messages (send button disabled)

**Prevention strategy:**
1. **Mandatory**: Wrap `controller.close()` in `finally` block
2. **Mandatory**: Send explicit `[DONE]` marker before closing stream
3. **Test**: Verify `onFinish` fires with timeout assertion (max 5s after last chunk)
4. **Monitor**: Add `console.log` in `onFinish` during development
5. **Fallback**: Implement client-side timeout (30s) to force completion

**Phase to address:** Phase 1 (Core Stream Infrastructure)

---

### Pitfall 2: Race Condition Between Stream End and UI State Updates

**What goes wrong:**
The stream completes and `onFinish` fires, but UI state updates (clearing input, enabling buttons, generating suggestions) happen **before** the stream closure is fully processed. Results in:
- Suggestions request sent while stream still "active" → conflict/rejection
- User sends new message before previous completes → messages out of order
- Loading state flickers: `false → true → false` rapidly

**Why it happens:**
- **Root Cause**: `onFinish` is fire-and-forget, not awaited by AI SDK
- Multiple async operations (persist messages, generate title, generate suggestions) race against each other
- Frontend reactive state (`$derived`) updates before backend confirms completion
- AbortController for previous request not cancelled before starting new operation

**Affected Layers:**
1. **AI SDK Layer**: `onFinish` callback executes asynchronously
2. **Frontend State**: Svelte reactivity triggers before persistence completes
3. **UI Components**: Button enable/disable states race with stream status

**How to avoid:**
```typescript
// ❌ WRONG: Starting new operation immediately in onFinish
onFinish: async ({ messages }) => {
  persistedMessagesState.current = messages;
  generateSuggestions(messages); // ⚠️ Races with stream cleanup
}

// ✅ CORRECT: Cancel pending operations and wait for state stabilization
onFinish: async ({ messages }) => {
  // 1. Cancel any pending operations
  chatState.cancelPendingSuggestions();

  // 2. Update state and persist
  persistedMessagesState.current = messages;

  // 3. Wait for stream status to settle
  await new Promise(resolve => setTimeout(resolve, 0));

  // 4. Check if new stream started
  if (chatState.isStreaming || chatState.isSubmitted) {
    console.log('[Suggestions] Skipped: new stream in progress');
    return;
  }

  // 5. Now safe to start async operations
  generateSuggestions(messages, abortSignal);
}
```

**Warning signs:**
- Console errors: "AbortError: The operation was aborted"
- Suggestions appear for wrong message
- Input clears but send button stays disabled
- Messages arrive out of order in UI
- Network tab shows concurrent overlapping requests

**Prevention strategy:**
1. **Mandatory**: Implement AbortController for all post-stream operations
2. **Mandatory**: Check `isStreaming`/`isSubmitted` before starting async work
3. **Best Practice**: Use microtask delay (`setTimeout(fn, 0)`) for state stabilization
4. **Pattern**: Cancel-then-start pattern for suggestions/title generation
5. **Test**: Rapid-fire message sending to expose race conditions

**Phase to address:** Phase 1 (Core Stream Infrastructure)

---

### Pitfall 3: Stream Error Silent Failures

**What goes wrong:**
Stream encounters an error (network timeout, API rate limit, malformed SSE chunk) but error is caught and swallowed without:
- Calling `controller.error()` or `controller.close()`
- Firing `onError` callback
- Setting error state in UI

Result: Stream hangs indefinitely with no indication of failure. User sees "AI is typing..." forever.

**Why it happens:**
- **Root Cause 1**: `try-catch` block in stream handler logs error but doesn't propagate
- **Root Cause 2**: Network timeout doesn't abort the stream (no timeout configured)
- **Root Cause 3**: Malformed JSON in SSE chunk causes parse error, stream continues
- **Root Cause 4**: `onError` callback not configured in AI SDK Chat instance

**Affected Layers:**
1. **Hono Backend**: Stream error handler missing or incomplete
2. **SSE Transport**: Error chunk not sent to client
3. **AI SDK Layer**: `onError` not configured or not firing
4. **Frontend State**: No error state set, loading persists

**How to avoid:**
```typescript
// ✅ CORRECT: Comprehensive error handling in Hono
const stream = new ReadableStream({
  async start(controller) {
    try {
      // ... streaming logic
    } catch (error) {
      console.error('[Stream] Error:', error);

      // Send error event to client
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'error',
        errorText: errorMessage
      })}\n\n`));

      // Close stream
      controller.close(); // ⚠️ CRITICAL
    }
  }
});

// ✅ CORRECT: Configure onError in AI SDK
const chat = new Chat({
  // ...
  onError: (error) => {
    console.error('[Chat onError]', error);
    chatState.handleChatError(error);
    // ⚠️ CRITICAL: Error callback must update UI state
  }
});

// ✅ CORRECT: Implement timeout in fetch
const abortController = new AbortController();
const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30s timeout

try {
  const response = await fetch(url, {
    signal: abortController.signal,
    // ...
  });
} finally {
  clearTimeout(timeoutId);
}
```

**Warning signs:**
- Stream stuck with no progress for >30 seconds
- Console shows error but UI still shows loading
- Network tab shows request "pending" indefinitely
- No error notification shown to user
- Browser memory usage grows (stream objects not garbage collected)

**Prevention strategy:**
1. **Mandatory**: Always call `controller.close()` in error path
2. **Mandatory**: Send error SSE event before closing
3. **Mandatory**: Implement 30-second fetch timeout with AbortController
4. **Mandatory**: Configure `onError` callback in Chat instance
5. **Test**: Simulate network failures (disconnect, slow 3G, timeout)
6. **Monitor**: Track stream duration metrics, alert on >30s streams

**Phase to address:** Phase 1 (Core Stream Infrastructure)

---

### Pitfall 4: Missing `[DONE]` Marker in SSE Protocol

**What goes wrong:**
Backend sends all response chunks and closes the HTTP connection, but never sends an explicit `data: [DONE]` event. Vercel AI SDK's stream parser waits indefinitely for the done marker, never firing `onFinish`.

**Why it happens:**
- **Root Cause 1**: Using `createUIMessageStreamResponse()` without understanding its protocol requirements
- **Root Cause 2**: Custom SSE implementation doesn't match Vercel AI SDK's expected format
- **Root Cause 3**: Stream closed by network timeout/disconnect before done marker sent
- **Root Cause 4**: Agent loop (`stopWhen: stepCountIs(20)`) terminates abruptly without cleanup

**Affected Layers:**
1. **Hono Backend**: Missing done event in SSE stream
2. **AI SDK Protocol**: Stream parser stuck waiting for completion marker
3. **Frontend State**: `onFinish` never called

**How to avoid:**
```typescript
// ❌ WRONG: Just closing the stream
const stream = result.toUIMessageStream({
  messageMetadata: () => ({ model, provider })
});
return createUIMessageStreamResponse({ stream }); // Missing done marker

// ✅ CORRECT: Let AI SDK handle protocol automatically
const result = await new Agent(config).stream({ messages });
const stream = result.toUIMessageStream({
  messageMetadata: () => ({ model, provider })
});
// ✅ createUIMessageStreamResponse adds [DONE] automatically
return createUIMessageStreamResponse({ stream });

// ✅ CORRECT: Manual stream must send done event
const stream = new ReadableStream({
  async start(controller) {
    // Send start event
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'start',
      messageId: id
    })}\n\n`));

    // Send content chunks...

    // ⚠️ CRITICAL: Send finish event
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'finish',
      messageId: id,
      finishReason: 'stop'
    })}\n\n`));

    controller.close();
  }
});
```

**Warning signs:**
- `onFinish` never logs (add test log to verify)
- Stream appears complete in Network tab (status 200, no pending) but UI still loading
- No `data: [DONE]` visible in SSE response payload
- `chat.messages` updated but `chat.status` stuck at "streaming"

**Prevention strategy:**
1. **Prefer**: Use AI SDK's `createUIMessageStreamResponse()` instead of manual SSE
2. **If Manual**: Strictly follow Vercel AI SDK's UI Message Stream protocol
3. **Test**: Inspect Network tab → Messages → verify `[DONE]` marker present
4. **Validate**: Add integration test asserting `onFinish` fires within 5s
5. **Document**: Add code comments explaining protocol requirements

**Phase to address:** Phase 1 (Core Stream Infrastructure)

---

### Pitfall 5: Hono StreamSSE Callback Never Resolving

**What goes wrong:**
Using Hono's `streamSSE()` helper, the callback function never resolves (returns a promise that hangs), causing Hono to keep the connection open indefinitely. Even though all data is sent, the HTTP response never completes from the server's perspective.

**Why it happens:**
- **Root Cause**: Hono's `streamSSE` requires callback to return/resolve for stream to close
- Callback contains infinite loop or `setInterval` without cleanup
- Using `stream.sleep(Infinity)` to keep connection alive
- No mechanism to signal completion (e.g., event emitter)

**Affected Layers:**
1. **Hono Backend**: HTTP response never completes
2. **SSE Connection**: Client sees connection as "open" even after data ends
3. **AI SDK Layer**: Never receives connection close event

**How to avoid:**
```typescript
// ❌ WRONG: Callback never returns
return streamSSE(c, async (stream) => {
  await stream.writeSSE({ data: 'hello' });
  // ⚠️ Never returns - connection stays open forever
  await stream.sleep(Infinity);
});

// ✅ CORRECT: Return after all data sent
return streamSSE(c, async (stream) => {
  await stream.writeSSE({ data: 'hello' });
  await stream.writeSSE({ event: 'complete', data: 'done' });
  // ✅ Function returns, Hono closes connection
});

// ✅ CORRECT: For our use case, use custom Response instead
// We control stream lifecycle explicitly
const stream = new ReadableStream({
  async start(controller) {
    // ... send data
    controller.close(); // We control closure
  }
});

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
});
```

**Warning signs:**
- Hono server logs show request never completes
- Node.js process memory grows (unclosed streams accumulate)
- Browser Network tab shows request stuck in "pending" state forever
- Server can't shutdown cleanly (hanging requests)

**Prevention strategy:**
1. **Current Architecture**: We use manual `ReadableStream`, not `streamSSE()` - safe
2. **If Switching**: Document that callback MUST return to close stream
3. **Pattern**: For long-lived SSE, use EventEmitter + cleanup logic
4. **Test**: Verify server request completes (Hono logs, metrics)

**Phase to address:** Already mitigated (not using `streamSSE()`)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| No timeout on fetch | Simpler code | Streams hang forever on network issues | Never - always add 30s timeout |
| Skip `controller.close()` in try | Fewer lines | Memory leaks, hanging streams | Never - use finally block |
| No AbortController for suggestions | Faster initial implementation | Race conditions, wrong suggestions | Never - always implement cancellation |
| Assume `onFinish` always fires | No defensive checks | Silent failures in production | Never - add fallback timeout |
| Log error without UI update | Easier debugging | User sees perpetual loading | Never - error state must update UI |
| Trust stream `done` property alone | Simple loop | Misses edge cases (early termination) | MVP only - add explicit done marker |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Vercel AI SDK** | Not configuring `onError` callback | Always set `onError` in Chat constructor, update error state |
| **Hono.js streaming** | Forgetting `controller.close()` in error path | Use try-finally, always close in finally block |
| **SSE Protocol** | Missing `data: [DONE]` marker | Use `createUIMessageStreamResponse()` or add manual marker |
| **Agent loop** | No cleanup on `stopWhen` trigger | Add cleanup logic before returning from agent |
| **ReadableStream** | Not checking `done` property | Always check `done`, break loop when true |
| **302.AI Claude Code** | Assuming result metadata in message body | Extract from `message-metadata` SSE event separately |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **No stream timeout** | Request hangs forever | 30s fetch timeout + AbortController | First network hiccup |
| **Unbounded AbortController creation** | Memory leak (controllers not GC'd) | Reuse/clear controller per message | After 100+ messages |
| **Suggestions during stream** | Race condition, wrong suggestions | Check `isStreaming` before generating | Fast users, rapid messages |
| **No stream cleanup on abort** | Backend keeps processing after user stops | Listen to `signal.addEventListener('abort')` | User spam-clicks stop |
| **Missing `reader.cancel()` on disconnect** | Server resources not freed | Call `reader.cancel()` in abort handler | Concurrent users >50 |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Stream completion:** `controller.close()` called ✓ BUT not in `finally` block → error path leaks
- [ ] **Done marker:** Response ends ✓ BUT no `data: [DONE]` sent → `onFinish` never fires
- [ ] **Error handling:** `try-catch` present ✓ BUT doesn't call `controller.error()` → stream hangs
- [ ] **Timeout configured:** `AbortController` created ✓ BUT timeout never calls `.abort()` → no-op
- [ ] **onFinish callback:** Defined ✓ BUT not checking `isStreaming` before async work → race condition
- [ ] **Suggestions cancellation:** `AbortController` stored ✓ BUT not cancelled before new message → conflict
- [ ] **Client disconnect:** Abort listener added ✓ BUT doesn't call `reader.cancel()` → backend leak

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Stream hangs (no close)** | LOW | 1. Add client-side 30s timeout 2. Force `onFinish` trigger 3. Reset UI state |
| **Race condition (suggestions)** | LOW | 1. Abort existing request 2. Clear suggestions state 3. Retry after state settles |
| **Missing `[DONE]` marker** | MEDIUM | 1. Add protocol validator middleware 2. Fallback to connection close detection 3. Refactor to use `createUIMessageStreamResponse()` |
| **onError not firing** | MEDIUM | 1. Add transport-level error interceptor 2. Implement heartbeat timeout 3. Manual error state management |
| **Hono stream never closes** | HIGH | 1. Restart server to clear hanging connections 2. Refactor from `streamSSE()` to manual `ReadableStream` 3. Add connection max-age limit |
| **Memory leak (unclosed streams)** | HIGH | 1. Restart server 2. Audit all stream creation points 3. Add finally blocks 4. Implement stream registry for tracking |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| **onFinish not firing** | Phase 1 | Integration test: assert `onFinish` called within 5s of last chunk |
| **Race condition (state updates)** | Phase 1 | Unit test: rapid message sending, verify no suggestion conflicts |
| **Stream error silent failure** | Phase 1 | E2E test: simulate network disconnect, verify error UI shown |
| **Missing [DONE] marker** | Phase 1 | Protocol test: inspect SSE payload, assert `[DONE]` present |
| **Hono callback never resolving** | N/A (already mitigated) | Regression test: ensure we never switch to `streamSSE()` |
| **No timeout on fetch** | Phase 1 | Unit test: mock delayed response >30s, verify timeout triggered |
| **AbortController not cancelled** | Phase 1 | Unit test: send message, verify previous abort called |
| **Controller not closed in error path** | Phase 1 | Integration test: force backend error, verify stream closes |

---

## Layer-Specific Issues

### AI SDK Layer
- **Issue**: `onFinish` is fire-and-forget (not awaited)
- **Impact**: Race conditions with subsequent operations
- **Fix**: Implement cancellation pattern, check state before async work

### Hono Backend Layer
- **Issue**: Missing `finally` blocks in stream handlers
- **Impact**: Streams leak on error, memory grows
- **Fix**: Wrap all `controller.close()` in finally blocks

### SSE Protocol Layer
- **Issue**: Incomplete protocol implementation (missing events)
- **Impact**: Client parser stuck waiting for completion
- **Fix**: Use `createUIMessageStreamResponse()` or strictly follow protocol

### Frontend State Layer
- **Issue**: Reactive state updates before stream confirmed closed
- **Impact**: UI flickers, buttons enabled prematurely
- **Fix**: Add microtask delay, check `isStreaming` before UI updates

### UI Components Layer
- **Issue**: Derived states (`sendMessageEnabled`) don't account for stream lag
- **Impact**: User can spam send button during stream
- **Fix**: Add explicit `!isStreaming && !isSubmitted` checks

---

## Sources

### Vercel AI SDK Issues
- [onFinish callback not executing - Latenode Community](https://community.latenode.com/t/onfinish-callback-not-executing-after-completion-in-vercel-ai-usecompletion-hook/37092)
- [Is onFinish Fire-and-Forget? - Vercel Community](https://community.vercel.com/t/is-onfinish-fire-and-forget/30552)
- [Vercel AI SDK Streaming Response Stuck in Loop - GitHub Issue #4141](https://github.com/vercel/ai/issues/4141)
- [useObject hook's isLoading remains true - GitHub Issue #2130](https://github.com/vercel/ai/issues/2130)
- [Troubleshooting: Streaming Not Working When Deployed - AI SDK Docs](https://ai-sdk.dev/docs/troubleshooting/streaming-not-working-when-deployed)

### SSE and Stream Completion
- [Using server-sent events - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Using readable streams - MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)
- [Node Streams constructed from Web Streams not emitting 'end' event - GitHub nodejs/node #46149](https://github.com/nodejs/node/issues/46149)

### Hono.js Streaming
- [Streaming Helper - Hono Docs](https://hono.dev/docs/helpers/streaming)
- [Hono with Server Sent Events - Yanael.io](https://yanael.io/articles/hono-sse/)
- [Hono streams immediately closes connection - GitHub Issue #2050](https://github.com/honojs/hono/issues/2050)
- [streamSSE callback needs to never resolve - GitHub Discussion #1355](https://github.com/orgs/honojs/discussions/1355)
- [Stream should not be closed automatically - GitHub Issue #2993](https://github.com/honojs/hono/issues/2993)

### Codebase Analysis
- `/electron/main/server/router.ts` - Hono streaming implementation
- `/src/lib/stores/chat-state.svelte.ts` - Chat state management with `onFinish`
- `/src/lib/transport/dynamic-chat-transport.ts` - Custom SSE transport layer

---

*Pitfalls research for: AI Streaming UI - Stream Completion Detection*
*Researched: 2026-02-02*
*Confidence: HIGH (Codebase analysis + Web research + Documentation)*
