# Phase 2: Transport Layer Event Validation - Research

**Researched:** 2026-02-03
**Domain:** Frontend SSE transport layer (Vercel AI SDK v6 + DynamicChatTransport)
**Confidence:** HIGH

## Summary

Phase 2 focuses on validating that the transport layer (`DynamicChatTransport`) correctly forwards all completion events from the backend to the frontend. The transport layer sits between the Hono.js backend (localhost:8089) and the AI SDK's `Chat` class, intercepting and transforming SSE events.

The current `DynamicChatTransport` implementation already handles abort signals and intercepts specific events (`message-metadata`, `error`), but lacks debug logging for finish event detection and [DONE] marker validation. The AI SDK's `parseJsonEventStream` function handles the `[DONE]` marker by simply returning (not enqueueing), which means the stream ends when the underlying ReadableStream closes.

The fix requires adding conditional debug logging to track finish events and [DONE] markers through the transport layer, plus connection close event detection. This is primarily a debugging/observability enhancement rather than a functional change.

**Primary recommendation:** Add debug-mode logging to `DynamicChatTransport` to track `finish` events, `[DONE]` markers, and connection close events for stream lifecycle validation.

## Standard Stack

The codebase already uses the correct stack. No library changes needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vercel AI SDK | 6.0.1 | AI streaming framework | Official AI SDK with built-in SSE protocol, UIMessageStream format, and `Chat` class |
| @ai-sdk/provider-utils | (bundled) | SSE parsing | `parseJsonEventStream` handles `[DONE]` marker and JSON event parsing |
| eventsource-parser | (bundled) | SSE event parsing | Standard EventSource protocol parser used by AI SDK |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ReadableStream API | Web Standard | Stream transformation | Custom fetch wrapper in DynamicChatTransport |
| TextDecoder/TextEncoder | Web Standard | Binary/text conversion | SSE chunk processing |
| AbortController | Web Standard | Stream cancellation | User-initiated abort handling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom SSE parsing | AI SDK's DefaultChatTransport | Would lose ability to intercept/transform events like `message-metadata` |
| Console.log debugging | Structured logging library | Console.log is sufficient for debug mode; no need for production logging overhead |

**Installation:**
```bash
# No new dependencies required - all libraries already installed
```

## Architecture Patterns

### Current Transport Layer Flow

```
Frontend Chat Class
    │
    ▼
DynamicChatTransport.sendMessages()
    │
    ▼
Custom fetch wrapper (intercepts response)
    │
    ▼
ReadableStream transformation
    │  ├─ Intercepts: message-metadata (stores in pendingResultMetadata)
    │  ├─ Intercepts: error (converts to text-delta for UI display)
    │  └─ Passes through: all other events (text-delta, finish, [DONE], etc.)
    │
    ▼
AI SDK's DefaultChatTransport.processResponseStream()
    │
    ▼
parseJsonEventStream (from @ai-sdk/provider-utils)
    │  ├─ Handles: [DONE] marker (returns without enqueueing)
    │  └─ Parses: JSON events via uiMessageChunkSchema
    │
    ▼
Chat class onFinish callback
```

### Pattern 1: Debug Mode Logging for Event Validation

**What:** Conditional logging that tracks critical stream events when debug mode is enabled.

**When to use:** Development and debugging scenarios where stream lifecycle needs validation.

**Example:**
```typescript
// Source: Recommended pattern for DynamicChatTransport
const DEBUG_TRANSPORT = import.meta.env.DEV || localStorage.getItem('DEBUG_TRANSPORT') === 'true';

// In the stream transformation loop:
for (const line of lines) {
  // Log finish events for debugging
  if (DEBUG_TRANSPORT && line.includes('"type":"finish"')) {
    console.log('[DynamicChatTransport] Finish event received:', line);
  }

  // Log [DONE] marker for debugging
  if (DEBUG_TRANSPORT && line.includes('[DONE]')) {
    console.log('[DynamicChatTransport] [DONE] marker received');
  }

  // ... existing event handling
}
```

### Pattern 2: Connection Close Event Detection

**What:** Detect when the underlying ReadableStream closes and log it for debugging.

**When to use:** Validating that streams terminate properly after [DONE] marker.

**Example:**
```typescript
// Source: Recommended pattern for stream close detection
const stream = new ReadableStream({
  async start(controller) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (DEBUG_TRANSPORT) {
            console.log('[DynamicChatTransport] Stream reader done, connection closed');
          }
          // Flush remaining buffer
          if (buffer) {
            controller.enqueue(encoder.encode(buffer));
          }
          controller.close();
          break;
        }
        // ... process chunks
      }
    } catch (error) {
      if (DEBUG_TRANSPORT) {
        console.error('[DynamicChatTransport] Stream error:', error);
      }
      controller.error(error);
    }
  },
});
```

### Pattern 3: SSE Protocol Validation

**What:** Validate that SSE events conform to expected format before forwarding.

**When to use:** Debug mode to catch malformed events that could cause parsing failures.

**Example:**
```typescript
// Source: Recommended validation pattern
function validateSSELine(line: string): boolean {
  if (!line.startsWith('data: ')) return false;
  const jsonStr = line.substring(6).trim();
  if (jsonStr === '[DONE]') return true;
  try {
    const parsed = JSON.parse(jsonStr);
    return typeof parsed.type === 'string';
  } catch {
    return false;
  }
}

// In stream processing:
if (DEBUG_TRANSPORT && !validateSSELine(line)) {
  console.warn('[DynamicChatTransport] Invalid SSE line:', line);
}
```

### Anti-Patterns to Avoid

- **Always-on logging:** Don't log every event in production; use conditional debug mode
- **Blocking validation:** Don't add synchronous validation that could slow down streaming
- **Swallowing events:** Don't filter out events without explicit intent; pass through by default
- **Missing [DONE] forwarding:** The [DONE] marker must reach the AI SDK's parser for proper stream termination

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE event parsing | Custom SSE parser | AI SDK's `parseJsonEventStream` | Handles edge cases, [DONE] marker, and schema validation |
| Stream termination detection | Custom close detection | ReadableStream `done` flag | Web Standard API with proper semantics |
| Event schema validation | Custom type checking | AI SDK's `uiMessageChunkSchema` | Zod schema with all event types defined |
| Debug logging framework | Custom logger | `console.log` with conditional flag | Simple, no dependencies, sufficient for debug mode |

**Key insight:** The AI SDK already handles SSE parsing correctly. The transport layer's job is to intercept specific events (like `message-metadata`) and pass everything else through unchanged. Debug logging should observe, not modify, the stream.

## Common Pitfalls

### Pitfall 1: Filtering Out [DONE] Marker

**What goes wrong:** Transport layer accidentally filters out the `[DONE]` marker, causing the AI SDK to wait indefinitely for stream end.

**Why it happens:** Developer adds event filtering logic that doesn't account for the special `[DONE]` marker format.

**How to avoid:**
```typescript
// BAD: Filters out non-JSON lines including [DONE]
if (!line.startsWith('data: {')) {
  continue; // Skips [DONE]!
}

// GOOD: Explicitly handle [DONE] marker
if (line === 'data: [DONE]' || line.includes('[DONE]')) {
  controller.enqueue(encoder.encode(line + "\n"));
  continue;
}
```

**Warning signs:**
- `onFinish` callback never fires
- Stream appears complete but UI shows loading state
- Network tab shows request completed but app hangs

### Pitfall 2: Missing Finish Event in Rapid Message Succession

**What goes wrong:** When user sends multiple messages rapidly, finish events from earlier streams get lost or mixed with later streams.

**Why it happens:** Race condition between stream cleanup and new stream initialization.

**How to avoid:**
```typescript
// GOOD: Track stream identity with unique IDs
const streamId = `stream-${Date.now()}`;
if (DEBUG_TRANSPORT) {
  console.log(`[DynamicChatTransport] Stream ${streamId} started`);
}

// In finish event handler:
if (DEBUG_TRANSPORT && line.includes('"type":"finish"')) {
  console.log(`[DynamicChatTransport] Stream ${streamId} finish event received`);
}
```

**Warning signs:**
- Intermittent loading spinner persistence
- `onFinish` fires for wrong message
- Console shows finish events but UI doesn't update

### Pitfall 3: Buffer Truncation Losing Events

**What goes wrong:** SSE events split across chunk boundaries get truncated, losing finish events.

**Why it happens:** Buffer handling doesn't properly accumulate partial lines.

**How to avoid:**
```typescript
// GOOD: Current implementation correctly handles partial lines
const lines = buffer.split("\n");
buffer = lines.pop() || ""; // Keep incomplete line in buffer

// Verify buffer is flushed on stream end
if (done) {
  if (buffer) {
    controller.enqueue(encoder.encode(buffer));
  }
  controller.close();
}
```

**Warning signs:**
- Truncated JSON in console logs
- Parse errors for valid events
- Events missing closing braces

### Pitfall 4: Abort Signal Not Properly Forwarded

**What goes wrong:** User cancels stream but backend continues processing, wasting resources.

**Why it happens:** Abort signal listener doesn't cancel the upstream reader.

**How to avoid:**
```typescript
// GOOD: Current implementation correctly handles abort
if (signal) {
  signal.addEventListener("abort", () => {
    console.log("[DynamicChatTransport] Abort signal received");
    reader.cancel();  // Cancel upstream
    controller.close(); // Close downstream
  });
}
```

**Warning signs:**
- Backend logs continue after user cancels
- Memory usage grows with cancelled streams
- Network connections remain open

## Code Examples

Verified patterns from codebase and AI SDK:

### Current DynamicChatTransport Event Handling

```typescript
// Source: /src/lib/transport/dynamic-chat-transport.ts:69-93
for (const line of lines) {
  // Handle message-metadata event (from 302.AI Claude Code result)
  if (line.includes('"type":"message-metadata"')) {
    try {
      const jsonStr = line.replace(/^data: /, "").trim();
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        if (data.type === "message-metadata" && data.metadata) {
          console.log("[DynamicChatTransport] Captured result metadata:", data.metadata);
          pendingResultMetadata = data.metadata as ResultMetadata;
          continue; // Don't forward this event
        }
      }
    } catch (e) {
      console.error("[DynamicChatTransport] Failed to parse message-metadata:", e);
    }
  }

  // Handle error event (convert to text-delta for UI display)
  if (line.includes('"type":"error"')) {
    // ... error handling
    continue;
  }

  // Forward all other events unchanged
  controller.enqueue(encoder.encode(line + "\n"));
}
```

### AI SDK's [DONE] Marker Handling

```typescript
// Source: node_modules/@ai-sdk/provider-utils/dist/index.mjs:2071-2085
function parseJsonEventStream({ stream, schema }) {
  return stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .pipeThrough(
      new TransformStream({
        async transform({ data }, controller) {
          if (data === "[DONE]") {
            return; // Simply return, don't enqueue - stream ends naturally
          }
          controller.enqueue(await safeParseJSON({ text: data, schema }));
        }
      })
    );
}
```

### AI SDK's Finish Event Schema

```typescript
// Source: node_modules/ai/dist/index.mjs:4408-4419
z7.strictObject({
  type: z7.literal("finish"),
  finishReason: z7.enum([
    "stop",
    "length",
    "content-filter",
    "tool-calls",
    "error",
    "other"
  ]).optional(),
  messageMetadata: z7.unknown().optional()
})
```

### Recommended Debug Logging Addition

```typescript
// Source: Recommended addition to DynamicChatTransport
const DEBUG_TRANSPORT = import.meta.env.DEV;

// Add to stream processing loop:
for (const line of lines) {
  // TRANS-01: Finish event detection logging
  if (DEBUG_TRANSPORT && line.includes('"type":"finish"')) {
    console.log('[DynamicChatTransport] FINISH event detected:', {
      timestamp: new Date().toISOString(),
      line: line.substring(0, 200) // Truncate for readability
    });
  }

  // TRANS-02: [DONE] marker validation
  if (line.includes('[DONE]')) {
    if (DEBUG_TRANSPORT) {
      console.log('[DynamicChatTransport] [DONE] marker received');
    }
    controller.enqueue(encoder.encode(line + "\n"));
    continue;
  }

  // ... existing event handling
}

// TRANS-03: Connection close detection (in stream done handler)
if (done) {
  if (DEBUG_TRANSPORT) {
    console.log('[DynamicChatTransport] Stream connection closed');
  }
  // ... existing close handling
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom SSE parsing | AI SDK's `parseJsonEventStream` | AI SDK v4+ | Standardized event handling, automatic [DONE] detection |
| Manual stream lifecycle | `DefaultChatTransport` base class | AI SDK v6 | Automatic stream management, proper cleanup |
| Polling for completion | SSE with finish events | AI SDK v3+ | Real-time completion detection |

**Deprecated/outdated:**
- Manual `EventSource` API: Replaced by `fetch` + `ReadableStream` for better control
- Custom finish detection: AI SDK's `onFinish` callback handles this automatically
- `streamText` without `toUIMessageStream`: Missing UIMessage protocol compliance

## Open Questions

Things that couldn't be fully resolved:

1. **Debug Mode Toggle Mechanism**
   - What we know: `import.meta.env.DEV` works for development builds
   - What's unclear: Should there be a runtime toggle (localStorage, URL param)?
   - Recommendation: Use `import.meta.env.DEV || localStorage.getItem('DEBUG_TRANSPORT') === 'true'`

2. **Log Verbosity Levels**
   - What we know: Need to log finish events and [DONE] markers
   - What's unclear: Should we log every event type or just critical ones?
   - Recommendation: Start with finish/[DONE]/close events only; expand if needed

3. **Performance Impact of Debug Logging**
   - What we know: String operations and console.log have overhead
   - What's unclear: Impact on rapid message succession scenarios
   - Recommendation: Use conditional checks before any string processing

## Sources

### Primary (HIGH confidence)

- **Codebase Analysis:**
  - `/src/lib/transport/dynamic-chat-transport.ts` - Current transport implementation (169 lines)
  - `/electron/main/server/router.ts` - Backend streaming endpoints (1890 lines)
  - `/electron/main/server/claude-code-processor.ts` - SSE transformation (952 lines)
  - `/src/lib/stores/chat-state.svelte.ts` - onFinish callback usage (lines 1529-1665)

- **AI SDK Source Code:**
  - `node_modules/ai/dist/index.mjs` - DefaultChatTransport, Chat class, UIMessageStream schema
  - `node_modules/@ai-sdk/provider-utils/dist/index.mjs` - parseJsonEventStream implementation

- **Official Documentation:**
  - [AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) - SSE event types, [DONE] marker

### Secondary (MEDIUM confidence)

- **Phase 1 Research:**
  - `.planning/phases/01-backend-stream-lifecycle-hardening/01-RESEARCH.md` - Backend stream lifecycle patterns
  - `.planning/phases/01-backend-stream-lifecycle-hardening/01-VERIFICATION.md` - Confirmed backend emits [DONE] markers

### Tertiary (LOW confidence)

- None - all findings verified from codebase and official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from package.json and AI SDK source code
- Architecture: HIGH - Traced full data flow through actual code
- Pitfalls: HIGH - All pitfalls sourced from codebase analysis and AI SDK implementation

**Research date:** 2026-02-03
**Valid until:** ~30 days (stable stack - AI SDK v6 has mature transport layer)

## Implementation Priority Areas

Based on this research, the planner should focus implementation on:

1. **TRANS-01: Finish Event Detection Logging**
   - Add conditional logging when `"type":"finish"` is detected
   - File: `/src/lib/transport/dynamic-chat-transport.ts`
   - Location: Inside the `for (const line of lines)` loop

2. **TRANS-02: [DONE] Marker Validation**
   - Add conditional logging when `[DONE]` marker is received
   - Ensure [DONE] is forwarded to downstream (not filtered)
   - File: `/src/lib/transport/dynamic-chat-transport.ts`

3. **TRANS-03: Connection Close Detection**
   - Add logging when `reader.read()` returns `done: true`
   - File: `/src/lib/transport/dynamic-chat-transport.ts`
   - Location: In the `if (done)` block

**Testing approach:**
1. Manual testing: Enable debug mode, send messages, verify logs show finish/[DONE]/close sequence
2. Rapid succession test: Send 3+ messages quickly, verify all completion events logged
3. Network tab validation: Compare SSE events in DevTools with transport layer logs
