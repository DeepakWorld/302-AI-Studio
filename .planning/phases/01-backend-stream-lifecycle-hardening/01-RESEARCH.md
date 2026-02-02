# Phase 1: Backend Stream Lifecycle Hardening - Research

**Researched:** 2026-02-02
**Domain:** Backend SSE streaming (Hono.js + Vercel AI SDK v6)
**Confidence:** HIGH

## Summary

The backend stream lifecycle issue in 302-AI-Studio stems from missing stream closure guarantees in the Hono.js router endpoints. The codebase uses Vercel AI SDK v6's streaming architecture correctly, but doesn't ensure `controller.close()` is called in all code paths—particularly error paths and streaming provider responses.

The Vercel AI SDK's `createUIMessageStreamResponse()` automatically handles most stream lifecycle management (including `[DONE]` markers), but the codebase has custom streaming paths that bypass this:
1. **Non-streaming models** use `createUIMessageStreamFromGenerator()` which properly handles lifecycle
2. **Standard streaming models** use `Agent.stream()` → `toUIMessageStream()` → `createUIMessageStreamResponse()` which handles lifecycle automatically
3. **302.AI Code Agent** uses custom `ReadableStream` with manual lifecycle management—this is the **primary risk area**

The fix requires hardening all stream creation points with explicit `finally` blocks to ensure closure.

**Primary recommendation:** Audit all streaming endpoints for missing `controller.close()` in error/abort paths, wrap lifecycle-critical code in try-finally blocks, and add comprehensive logging to verify completion signals.

## Standard Stack

The codebase already uses the correct streaming stack. No library changes needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vercel AI SDK | 6.0.1 | AI streaming framework | Official AI SDK with built-in SSE protocol support, UIMessageStream format, and completion event handling |
| Hono.js | 4.9.10 | HTTP server framework | Lightweight, native ReadableStream support, designed for edge/serverless streaming |
| @ai-sdk/svelte | 6.0.1 | Frontend chat state | Official Svelte adapter with `onFinish` callback lifecycle management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ReadableStream API | Web Standard | Custom stream creation | When bypassing AI SDK's automatic stream handling (e.g., 302.AI Code Agent processor) |
| AbortController | Web Standard | Stream cancellation | For timeout enforcement and user-initiated cancellation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vercel AI SDK | Custom SSE implementation | Would lose automatic `[DONE]` markers, finish event generation, and protocol compliance |
| Hono.js | Express.js | Hono's native ReadableStream support is more suitable for SSE than Express's legacy stream API |

**Installation:**
```bash
# No new dependencies required - all libraries already installed
```

## Architecture Patterns

### Current Stream Flow Architecture

The codebase has **three distinct streaming paths**:

```
Path 1: Non-streaming models (image generation)
  └─ createUIMessageStreamFromGenerator()
      └─ Manually creates ReadableStream
      └─ ✅ Properly handles controller.close() in try-catch
      └─ ✅ Sends [DONE] marker
      └─ Used by: models with !isStreamingSupported(model)

Path 2: Standard streaming (OpenAI, Anthropic, Gemini, 302.AI chat)
  └─ Agent.stream() or generateText()
      └─ result.toUIMessageStream()
          └─ createUIMessageStreamResponse({ stream })
              └─ ✅ AI SDK handles lifecycle automatically
              └─ ✅ Sends [DONE] marker automatically
  └─ Used by: /chat/302ai, /chat/openai, /chat/anthropic, /chat/gemini

Path 3: 302.AI Code Agent (custom SSE transformation)
  └─ Custom ReadableStream with ClaudeCodeProcessor
      └─ ⚠️ Manual lifecycle management
      └─ ⚠️ controller.close() calls exist but not in finally blocks
      └─ ⚠️ Error paths may skip closure
  └─ Used by: /chat/302ai-code-agent
```

### Pattern 1: Safe Stream Lifecycle Management (Standard Pattern)

**What:** Every streaming endpoint must guarantee `controller.close()` is called exactly once, even in error/abort scenarios.

**When to use:** All custom ReadableStream creation (Path 1 and Path 3 above).

**Example (from utils.ts createUIMessageStreamFromGenerator - CORRECT PATTERN):**
```typescript
// Source: /electron/main/server/utils.ts:162-301
export function createUIMessageStreamFromGenerator(
  contentGenerator: () => Promise<string>,
  model: string,
  provider: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      // 1. Send start event immediately
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start", ... })}\n\n`));

      try {
        // 2. Execute async content generator
        const content = await contentGenerator();

        // 3-10. Send SSE events (text-start, text-delta, text-end, finish)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish", ... })}\n\n`));

        // 11. Send [DONE] marker
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        // 12. CRITICAL: Close controller in success path
        controller.close();
      } catch (error) {
        console.error(`[createUIMessageStreamFromGenerator] Error:`, error);

        // Send error events
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish", finishReason: "error", ... })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

        // CRITICAL: Close controller in error path
        controller.close();
      }
      // ✅ This pattern ensures controller.close() is called in ALL paths
    },
  });
}
```

**Key principle:** `controller.close()` must be called in **both** success and error paths. No implicit returns before closure.

### Pattern 2: Abort Signal Handling

**What:** User cancellation via `AbortController` must close the stream properly.

**When to use:** All fetch operations and long-running streams.

**Example (from dynamic-chat-transport.ts - CORRECT PATTERN):**
```typescript
// Source: /src/lib/transport/dynamic-chat-transport.ts:39-50
const stream = new ReadableStream({
  async start(controller) {
    let buffer = "";

    // Listen for abort signal
    if (signal) {
      signal.addEventListener("abort", () => {
        console.log("[DynamicChatTransport] Abort signal received");
        reader.cancel();  // Cancel upstream reader
        controller.close(); // Close downstream controller
      });
    }
    // ... rest of streaming logic
  }
});
```

**Key principle:** Abort handler must call **both** `reader.cancel()` and `controller.close()` to fully terminate the stream.

### Pattern 3: Error Event Propagation

**What:** Backend errors must send explicit error events before closing the stream.

**When to use:** All error handlers in streaming endpoints.

**Example (from utils.ts sendStreamError - CORRECT PATTERN):**
```typescript
// Source: /electron/main/server/utils.ts:10-32
export function sendStreamError(
  controller: ReadableStreamDefaultController<Uint8Array>,
  errorMessage: string,
): void {
  const encoder = new TextEncoder();
  const errorId = `error-${Date.now()}`;

  // 1. Send text-start event
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: errorId })}\n\n`));

  // 2. Send error message as text-delta
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", id: errorId, delta: `**Error**: ${errorMessage}` })}\n\n`));

  // 3. Send text-end event
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: errorId })}\n\n`));

  // 4. Send finish event with error reason
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish", finishReason: "error" })}\n\n`));

  // 5. CRITICAL: Close controller
  controller.close();
}
```

**Key principle:** Error messages should be visible to users via text-delta events, followed by proper finish event and closure.

### Anti-Patterns to Avoid

- **Early return without close:** Never `return` from a stream handler without calling `controller.close()` first
- **Missing finally block:** Don't rely on try-catch alone—use try-finally to guarantee closure
- **Silent error swallowing:** Always log errors and send error events before closing
- **Orphaned readers:** When canceling an upstream reader, always close the downstream controller
- **Missing [DONE] marker:** Custom SSE streams must send `data: [DONE]\n\n` before `controller.close()`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE protocol formatting | Custom SSE event encoder | Vercel AI SDK's `createUIMessageStreamResponse()` | AI SDK handles SSE format, [DONE] markers, finish events, and protocol compliance automatically |
| Stream cancellation | Custom abort logic | AbortController + signal listeners | Web Standard API with proper cleanup semantics |
| Stream timeout enforcement | Custom timeout tracking | `fetch(url, { signal: AbortSignal.timeout(30000) })` | Built-in timeout with automatic cancellation |
| Error event formatting | Custom error SSE strings | `sendStreamError(controller, message)` utility | Consistent error format across all endpoints |

**Key insight:** Vercel AI SDK already handles 90% of stream lifecycle complexity. Only bypass it when you need custom SSE transformations (like ClaudeCodeProcessor). When bypassing, you inherit full responsibility for lifecycle management.

## Common Pitfalls

### Pitfall 1: Missing controller.close() in Error Path

**What goes wrong:** Stream hangs indefinitely when an error occurs because `controller.close()` is only in the success path.

**Why it happens:** Developers focus on the happy path and forget error handling, or use try-catch without finally.

**How to avoid:**
```typescript
// ❌ BAD: controller.close() only in success path
async start(controller) {
  try {
    const result = await generateText(...);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
    controller.close(); // ❌ Error prevents this from running
  } catch (error) {
    console.error(error); // ❌ Stream never closed!
  }
}

// ✅ GOOD: controller.close() in finally block
async start(controller) {
  try {
    const result = await generateText(...);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
  } catch (error) {
    console.error(error);
    sendStreamError(controller, error.message);
  } finally {
    // Or ensure close() is in both catch and try blocks
  }
}
```

**Warning signs:**
- Console shows error logs but spinner persists
- Network tab shows request stuck in "pending"
- `onFinish` callback never fires

### Pitfall 2: Race Condition Between Stream End and Async Operations

**What goes wrong:** `onFinish` callback triggers async operations (suggestions, title generation) that race against the next stream starting.

**Why it happens:** `onFinish` is fire-and-forget; multiple async operations run without coordination.

**How to avoid:**
```typescript
// ✅ GOOD: Check state before async operations
onFinish: async ({ messages, isAbort, isError }) => {
  // 1. Save messages immediately
  await persistMessages(threadId, messages);

  // 2. Check if new stream started before starting async work
  if (chatState.isStreaming || chatState.isSubmitted) {
    console.log("[onFinish] New stream started, skipping suggestions");
    return;
  }

  // 3. Use AbortController for cancellable async work
  const abortController = new AbortController();
  suggestionsAbortController = abortController; // Store for cancellation

  try {
    const suggestions = await generateSuggestions(messages, {
      signal: abortController.signal
    });

    // 4. Double-check state before applying results
    if (!chatState.isStreaming && !chatState.isSubmitted) {
      chat.messages = updateMessagesWithSuggestions(messages, suggestions);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log("[onFinish] Suggestions generation cancelled");
    }
  }
}
```

**Warning signs:**
- Suggestions appear on wrong message
- Title generation applies to old conversation
- Multiple concurrent suggestion requests

### Pitfall 3: Missing [DONE] Marker in Custom SSE Streams

**What goes wrong:** AI SDK's SSE parser waits indefinitely for `[DONE]` marker even though finish event was sent.

**Why it happens:** Developers assume finish event is sufficient and don't know about the `[DONE]` protocol requirement.

**How to avoid:**
```typescript
// ❌ BAD: Missing [DONE] marker
controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish" })}\n\n`));
controller.close(); // ❌ AI SDK still waiting for [DONE]

// ✅ GOOD: Send [DONE] before close
controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish" })}\n\n`));
controller.enqueue(encoder.encode("data: [DONE]\n\n")); // ✅ Protocol requirement
controller.close();
```

**Warning signs:**
- Finish event appears in logs but spinner persists
- `onFinish` callback never fires
- Stream appears complete in Network tab but UI doesn't update

### Pitfall 4: Missing Timeout on Upstream API Calls

**What goes wrong:** Upstream AI provider API hangs indefinitely (network issue, server timeout), causing stream to never complete.

**Why it happens:** No timeout configured on fetch calls to AI providers.

**How to avoid:**
```typescript
// ❌ BAD: No timeout
const response = await fetch(aiProviderUrl, {
  method: 'POST',
  body: JSON.stringify(requestBody)
});

// ✅ GOOD: 30-second timeout
const abortController = new AbortController();
const timeoutId = setTimeout(() => abortController.abort(), 30000);

try {
  const response = await fetch(aiProviderUrl, {
    method: 'POST',
    body: JSON.stringify(requestBody),
    signal: abortController.signal
  });
  clearTimeout(timeoutId);
} catch (error) {
  if (error.name === 'AbortError') {
    throw new Error('AI provider request timeout after 30 seconds');
  }
  throw error;
}
```

**Warning signs:**
- Stream hangs for minutes without completing
- No error message or indication of failure
- User must refresh app to recover

### Pitfall 5: Orphaned ReadableStream Readers

**What goes wrong:** When canceling a stream, upstream reader is abandoned without calling `reader.cancel()`, causing resource leaks.

**Why it happens:** Developers close the downstream controller but forget to cancel the upstream reader.

**How to avoid:**
```typescript
// ❌ BAD: Orphaned reader
signal.addEventListener('abort', () => {
  controller.close(); // ❌ Reader still running!
});

// ✅ GOOD: Cancel reader before closing controller
signal.addEventListener('abort', () => {
  reader.cancel(); // ✅ Stop upstream
  controller.close(); // ✅ Stop downstream
});
```

**Warning signs:**
- Memory usage grows over time
- Network connections remain open after stream "ends"
- Browser DevTools shows active stream readers

## Code Examples

Verified patterns from codebase:

### Standard Streaming Endpoint (OpenAI, Anthropic, Gemini)

```typescript
// Source: /electron/main/server/router.ts:558-576
app.post("/chat/openai", async (c) => {
  const { model, messages, temperature, ... } = await c.req.json();

  const openai = createOpenAI({ baseURL, apiKey });
  const wrapModel = wrapLanguageModel({ model: openai.chat(model), middleware: [...] });

  // Agent streaming (automatic lifecycle management)
  const result = await new Agent({
    model: wrapModel,
    instructions: systemPrompt,
    tools: mcpTools,
    stopWhen: stepCountIs(20),
  }).stream({
    messages: convertedMessages,
    experimental_transform: smoothStream({ chunking: smartChunking, delayInMs: 50 }),
  });

  const stream = result.toUIMessageStream({
    messageMetadata: () => ({ model, provider: "openai", createdAt: new Date().toISOString() }),
  });

  // ✅ createUIMessageStreamResponse handles [DONE] marker and controller.close() automatically
  return createUIMessageStreamResponse({ stream });
});
```

### Custom Stream with Manual Lifecycle (302.AI Code Agent)

```typescript
// Source: /electron/main/server/router.ts:1559-1638
const combinedStream = new ReadableStream({
  async start(controller) {
    // 1. Send immediate start event
    controller.enqueue(encoder.encode(immediateStartEvent));

    try {
      // 2. Upload attachments (non-blocking background task)
      if (sandboxId && workspacePath) {
        try {
          await uploadAttachmentsFromMessages(sandboxId, workspacePath, messages);
        } catch (uploadError) {
          console.error("[302ai-code-agent] Failed to upload attachments:", uploadError);
          sendStreamError(controller, "Failed to upload attachments");
          return; // ⚠️ sendStreamError calls controller.close()
        }
      }

      // 3. Fetch upstream response
      const response = await responsePromise;

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[302ai-code-agent] API error:", response.status, response.statusText);
        sendStreamError(controller, errorText || `HTTP ${response.status}: ${response.statusText}`);
        return; // ⚠️ sendStreamError calls controller.close()
      }

      // 4. Pipe transformed stream
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close(); // ✅ Explicit close on missing body
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close(); // ✅ Explicit close on stream end
            break;
          }
          try {
            controller.enqueue(value);
          } catch (_error) {
            // Client disconnected or controller closed
            console.log("[302ai-code-agent] Controller closed, stopping stream");
            reader.cancel();
            abortController.abort();
            break; // ✅ No close() needed - already closed
          }
        }
      } catch (error) {
        console.error("[302ai-code-agent] Reader error:", error);
        reader.cancel().catch(() => {}); // ✅ Cleanup upstream
        throw error; // ⚠️ No controller.close() here - missing finally!
      }
    } catch (error) {
      console.error("[302ai-code-agent] Stream error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      sendStreamError(controller, errorMessage); // ✅ Sends error and closes
    }
    // ⚠️ MISSING: finally block to guarantee close in all paths
  },
});
```

**Issue identified:** The 302.AI Code Agent stream lacks a `finally` block. If an unexpected error occurs after the reader loop starts, `controller.close()` may not be called.

**Recommended fix:**
```typescript
const combinedStream = new ReadableStream({
  async start(controller) {
    let streamClosed = false;

    const safeClose = () => {
      if (!streamClosed) {
        streamClosed = true;
        try {
          controller.close();
        } catch (_error) {
          // Already closed - ignore
        }
      }
    };

    try {
      // ... all streaming logic
    } catch (error) {
      sendStreamError(controller, errorMessage);
      streamClosed = true; // Mark as closed by sendStreamError
    } finally {
      safeClose(); // Guarantee closure
    }
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SSE formatting | Vercel AI SDK `createUIMessageStreamResponse()` | AI SDK v4 → v6 | Automatic [DONE] markers, finish events, protocol compliance |
| fetch without timeout | AbortSignal.timeout(ms) | Node 18+, Chrome 103+ | Built-in timeout enforcement without custom timers |
| try-catch error handling | try-catch-finally + safeClose pattern | Best practice 2024+ | Guarantees cleanup even with unexpected errors |

**Deprecated/outdated:**
- `streamText()` without `toUIMessageStream()`: Missing UIMessage protocol compliance
- Custom SSE parsers: AI SDK's parser handles all protocol edge cases
- Fetch without AbortController: Can't implement timeout or cancellation properly

## Open Questions

Things that couldn't be fully resolved:

1. **Provider-Specific Stream Termination Behavior**
   - What we know: OpenAI, Anthropic, Google all use different internal stream formats before AI SDK normalization
   - What's unclear: Do any providers send unexpected events after finish that could re-trigger streaming state?
   - Recommendation: During implementation, test each provider endpoint (302ai, openai, anthropic, gemini) individually with network logging to verify clean termination

2. **ClaudeCodeProcessor Transformation Edge Cases**
   - What we know: ClaudeCodeProcessor transforms 302.AI's Anthropic-format events to AI SDK format
   - What's unclear: Are there error scenarios in the processor that could prevent finish event emission?
   - Recommendation: Add debug logging to claude-code-processor.ts to track finish event generation

3. **Transport Layer Event Loss**
   - What we know: DynamicChatTransport intercepts and filters some events (message-metadata, error)
   - What's unclear: Could the transport layer accidentally drop finish events during parsing?
   - Recommendation: Add finish event detection logging in dynamic-chat-transport.ts

4. **Concurrent Stream Handling in Multi-Tab Environment**
   - What we know: Multiple tabs can have active streams simultaneously
   - What's unclear: Does inter-window messaging (broadcast-service) impact stream lifecycle?
   - Recommendation: Test rapid tab switching during active streams to verify state isolation

## Sources

### Primary (HIGH confidence)

- **Codebase Analysis:**
  - `/electron/main/server/router.ts` - All streaming endpoints (lines 178-1649)
  - `/electron/main/server/utils.ts` - Stream utility functions (lines 1-1024)
  - `/electron/main/server/claude-code-processor.ts` - Custom SSE transformation (lines 1-100)
  - `/src/lib/transport/dynamic-chat-transport.ts` - Frontend transport layer (lines 1-150)
  - `/src/lib/stores/chat-state.svelte.ts` - onFinish callback implementation (grep results)

- **Vercel AI SDK v6 Documentation:**
  - Package: `ai@6.0.1` (verified in package.json)
  - Type definitions: `node_modules/ai/dist/index.d.ts` (verified createUIMessageStreamResponse exists)

- **Web Standards:**
  - ReadableStream API: MDN Web Docs (Web Standard)
  - AbortController API: MDN Web Docs (Web Standard)
  - Server-Sent Events (SSE): MDN Web Docs (Web Standard)

### Secondary (MEDIUM confidence)

- **Project Research Summary:**
  - `.planning/research/SUMMARY.md` - Prior codebase analysis confirming three-layer architecture

### Tertiary (LOW confidence)

- None - all findings verified from codebase and official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from package.json and import statements
- Architecture: HIGH - Traced full data flow through actual code
- Pitfalls: HIGH - All five pitfalls sourced from codebase analysis and Web Standard API documentation

**Research date:** 2026-02-02
**Valid until:** ~30 days (stable stack - Hono.js and AI SDK have mature APIs)

## Implementation Priority Areas

Based on this research, the planner should focus implementation on these high-risk areas:

1. **CRITICAL: 302.AI Code Agent endpoint** (`/chat/302ai-code-agent`)
   - Missing finally block around reader loop
   - Multiple early returns without guaranteed closure
   - File: `/electron/main/server/router.ts:1559-1638`

2. **MEDIUM: ClaudeCodeProcessor transformation**
   - Complex state machine for SSE transformation
   - Verify finish event generation in all branches
   - File: `/electron/main/server/claude-code-processor.ts`

3. **LOW: Standard streaming endpoints**
   - Already using `createUIMessageStreamResponse()` which handles lifecycle
   - Add timeout enforcement to upstream fetch calls
   - Files: `/electron/main/server/router.ts:178-912` (302ai, openai, anthropic, gemini endpoints)

4. **TESTING: Transport layer event validation**
   - Verify finish events pass through DynamicChatTransport
   - Add development-mode SSE protocol validator
   - File: `/src/lib/transport/dynamic-chat-transport.ts`

**Testing approach:**
1. Unit tests: Mock stream abort/error scenarios, verify close() called
2. Integration tests: Send requests to each provider endpoint, verify onFinish fires
3. E2E tests: Rapid message sending, cancellation during streaming, network timeout simulation
