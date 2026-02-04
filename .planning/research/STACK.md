# Stack Research: Stream Completion Detection

**Domain:** AI Streaming Response Management (Vercel AI SDK v6 + Hono.js + SSE)
**Researched:** 2026-02-02
**Confidence:** HIGH
**Bug Context:** UI loading spinner persists after AI model completes response generation

## Executive Summary

Stream completion detection in modern AI applications requires multi-layered signal coordination across three critical layers:

1. **Backend (Hono.js):** Explicitly signal stream end with `data: [DONE]` marker to prevent unbounded SSE streams
2. **Transport (Vercel AI SDK v6):** Leverage `UIMessageChunk` events to detect individual content blocks finishing (text-end, reasoning-end, etc.) and the final stream completion via `finish` event
3. **Frontend (SvelteKit):** Hook into AI SDK's `onFinish` callback with proper completion flags (`isAbort`, `isDisconnect`, `isError`) to clear loading state

**The core issue in your codebase:** The frontend's `onFinish` callback properly exists (line 1529 in chat-state.svelte.ts), but backend streams may not be signaling completion explicitly, causing the UI to remain in a loading state waiting for closure signals that never arrive.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vercel AI SDK | 6.0.1 | Streaming text generation with multi-provider support | Official standard for AI streaming in 2025/2026. Uses `createUIMessageStreamResponse()` and `toUIMessageStream()` for normalized streaming across Anthropic, OpenAI, Google. Handles stream lifecycle via `UIMessageChunk` events. |
| Hono.js | 4.9.10 | Lightweight backend server for streaming responses | Minimal overhead, native ReadableStream support, proper backpressure handling via `controller.close()`. Works well with Node.js streaming semantics. |
| Server-Sent Events (SSE) | HTTP protocol | Transport layer for unidirectional streaming | Native browser support via EventSource API, simple line-delimited format, automatic reconnection capabilities. AI SDK v6 standardizes on `x-vercel-ai-ui-message-stream: v1` header with SSE format. |
| ReadableStream API | Web Standard | Native stream implementation | Browser and Node.js standard, backpressure support via controller, clean closure semantics with `controller.close()`. AI SDK v6 natively produces `ReadableStream<UIMessageChunk>`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ai-sdk/svelte | 6.0.1 | Chat state management in SvelteKit | Use for frontend `onFinish` callbacks and stream completion detection. Provides `Chat` class with proper lifecycle hooks. |
| @ai-sdk/anthropic | 3.0.0 | Anthropic provider SDK | When using Claude models. Streams raw tokens via AI SDK. |
| @ai-sdk/openai | 3.0.0 | OpenAI provider SDK | When using GPT models. Stream format is standardized via AI SDK wrapper. |
| @ai-sdk/google | 3.0.0 | Google Generative AI provider | When using Gemini models. Handles provider-specific streaming quirks. |

### Development Tools / Patterns

| Tool/Pattern | Purpose | Notes |
|------|---------|-------|
| HTTP `Content-Type: text/event-stream` header | SSE protocol negotiation | **Critical:** Must be set on Hono response to enable browser SSE parsing |
| HTTP `x-vercel-ai-ui-message-stream: v1` header | AI SDK v6 format specification | Signals that response uses Vercel's normalized stream protocol with events like `text-delta`, `text-end`, `finish` |
| HTTP `Cache-Control: no-cache` header | Prevents caching SSE streams | SSE requires streaming, not cached responses |
| HTTP `Connection: keep-alive` header | Persistent connection semantics | Tells client/proxies to keep connection alive during long streams |

## Installation

```bash
# Core (already in your package.json)
pnpm install ai@6.0.1
pnpm install @ai-sdk/anthropic@3.0.0
pnpm install @ai-sdk/openai@3.0.0
pnpm install @ai-sdk/google@3.0.0
pnpm install @ai-sdk/svelte@6.0.1
pnpm install hono@4.9.10

# No additional dependencies needed — streaming is native to modern Node.js and browsers
```

## Stream Completion Protocol

### 1. Backend Stream Termination (Hono.js)

**Pattern:** Explicitly close ReadableStream when content generation completes

```typescript
// electron/main/server/router.ts - Example pattern

const combinedStream = new ReadableStream({
	async start(controller) {
		// ... send start event

		try {
			const response = await fetch(apiEndpoint, ...);
			const reader = response.body?.getReader();

			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					// CRITICAL: Signal stream end to browser SSE parser
					// Without this, UI waits indefinitely
					controller.enqueue(encoder.encode("data: [DONE]\n\n"));
					controller.close(); // Closes the ReadableStream
					break;
				}
				controller.enqueue(value);
			}
		} catch (error) {
			controller.error(error); // Propagates error to frontend
		}
	}
});

return new Response(combinedStream, {
	status: 200,
	headers: {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
		"x-vercel-ai-ui-message-stream": "v1",
	}
});
```

**Why this works:**
- `controller.close()` signals EOF to browser SSE parser
- `data: [DONE]` acts as fallback marker for SSE protocol
- Both signals ensure frontend doesn't wait forever
- Backpressure handled automatically by ReadableStream implementation

### 2. Transport Layer Stream Protocol (Vercel AI SDK v6)

**Pattern:** `createUIMessageStreamResponse()` handles stream formatting

```typescript
// Backend uses this to wrap model result
const result = await new Agent(agentConfig).stream({...});
const stream = result.toUIMessageStream({
	messageMetadata: () => ({
		model,
		provider: "anthropic",
		createdAt: new Date().toISOString(),
	}),
});

return createUIMessageStreamResponse({ stream });
```

**What the browser receives (SSE format):**

```
data: {"type":"start","messageId":"msg_..."}

data: {"type":"text-start","id":"msg_..."}
data: {"type":"text-delta","id":"msg_...","delta":"Hello"}
data: {"type":"text-delta","id":"msg_...","delta":" world"}
data: {"type":"text-end","id":"msg_..."}  // Individual text block complete

data: {"type":"finish"}  // Stream finish event (ALL content complete)

data: [DONE]  // SSE protocol completion marker
```

**Completion signals:**
- `text-end`: One text segment finished, but stream may continue (reasoning, tool calls)
- `finish`: ALL content finished — this is what triggers `onFinish` callback
- `[DONE]`: Browser SSE parser sees this and closes connection

### 3. Frontend Stream Consumption (SvelteKit)

**Pattern:** Use `onFinish` callback with proper completion flags

```typescript
// src/lib/stores/chat-state.svelte.ts (existing implementation)

const chat = new Chat({
	api: getApiUrl(),
	transport: new DynamicChatTransport({...}),
	onFinish: async ({ messages, isAbort, isDisconnect, isError }) => {
		// CRITICAL: Check completion state before clearing loading
		console.log("[onFinish]", {
			isAbort,        // User canceled
			isDisconnect,   // Network lost
			isError,        // API error occurred
			messageCount: messages.length
		});

		// Only clear loading if stream completed normally
		if (!isAbort && !isDisconnect && !isError) {
			// Stream completed successfully
			loadingState = false;
		} else if (isError) {
			// Error occurred - show error UI
			showErrorNotification();
			loadingState = false;
		} else if (isAbort || isDisconnect) {
			// User canceled or connection lost
			loadingState = false;
		}

		// Persist message with metadata
		await persistMessage(messages[messages.length - 1]);
	}
});
```

**Key flags:**
- `isAbort: true` → User clicked stop button (AbortSignal triggered)
- `isDisconnect: true` → Network connection lost mid-stream
- `isError: true` → API returned error or streaming failed
- All three `false` → Normal stream completion ✓

## Critical Implementation Details

### Stream Completion Detection in AI SDK v6

The Vercel AI SDK v6 emits these events in order:

| Event | Meaning | Action |
|-------|---------|--------|
| `start` | Stream begins | Show loading state |
| `text-start` | Text content begins | Initialize text block |
| `text-delta` | Token arrived | Append to text |
| `text-end` | Text block complete | May continue if reasoning/tools follow |
| `finish` | **ALL content complete** | Clear loading, persist message |
| `[DONE]` | HTTP transport complete | Browser SSE parser closes connection |

**The bug pattern:** If backend doesn't send `controller.close()` or `[DONE]`, the browser SSE parser waits for more data indefinitely, keeping the UI in loading state even though `finish` event arrived.

### Frontend Detection Patterns

```typescript
// Pattern 1: Hook into onFinish (simplest, recommended)
const chat = new Chat({
	onFinish: async ({ messages, isAbort, isDisconnect, isError }) => {
		if (!isAbort && !isDisconnect && !isError) {
			isLoading = false;
		}
	}
});

// Pattern 2: Monitor UIMessageChunk stream directly (advanced)
const stream = await transport.sendMessages({...});
const reader = stream.getReader();

while (true) {
	const { done, value } = await reader.read();
	if (done) {
		// Stream exhausted — all chunks consumed
		isLoading = false;
		break;
	}

	if (value.type === "finish") {
		// Content generation complete
		isLoading = false;
	}
}

// Pattern 3: Combine with abort signal (full control)
const abortController = new AbortController();

const chat = new Chat({
	onFinish: async ({ messages, isAbort, isDisconnect, isError }) => {
		isLoading = false;
	}
});

// User clicks stop → triggers abort
abortController.abort();  // isAbort: true in onFinish
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative | Why Not Default |
|-------------|-------------|-------------------------|-----------------|
| `onFinish` callback | Manual stream monitoring | Fine-grained control over all chunk types | Adds complexity; SDK already handles aggregation |
| Explicit `[DONE]` marker | Implicit controller.close() | Defensive programming; extra clarity | Redundant if ReadableStream closes properly |
| SSE format | WebSocket | Real-time bidirectional messaging needed | Higher overhead; SSE sufficient for server→client |
| `finish` event | `text-end` event | Detecting individual text blocks | Premature; may have reasoning/tool calls after text |
| Native ReadableStream | Custom stream wrapper | Non-standard requirements | Avoid reinventing; use standard APIs |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Long polling HTTP | High latency, client hammering, poor UX | SSE for server→client; WebSocket if bidirectional |
| Checking `messages.length` to detect completion | Messages may arrive out of order or be updated in parallel | Use `onFinish` callback flag: `isError`, `isAbort`, `isDisconnect` |
| Manually implementing `data: [DONE]` parsing | Error-prone; AI SDK handles this | Let `createUIMessageStreamResponse()` handle protocol |
| Timeout-based completion (setTimeout → isLoading = false) | Brittle; works until network is slow then breaks users | Proper stream completion signals instead |
| Storing `responseText` to detect completion | Incomplete; doesn't account for tool calls, reasoning | Use structured `onFinish` → persisted messages |

## Stack Patterns by Variant

### For Non-Streaming Models (Image Generation, etc.)

**If model doesn't support streaming:**
- Use `generateText()` instead of `streamText()`
- Wrap in `createUIMessageStreamFromGenerator()` for normalized response
- Backend still sends SSE with `finish` event for UI consistency

```typescript
if (!isStreamingSupported(model)) {
	const stream = createUIMessageStreamFromGenerator(
		async () => {
			const result = await generateText(streamTextOptions);
			return result.text || "";
		},
		model,
		"provider"
	);
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"x-vercel-ai-ui-message-stream": "v1",
		}
	});
}
```

### For Multi-Provider Consistency

Your codebase already does this correctly (router.ts):
- Each provider (/chat/openai, /chat/anthropic, /chat/gemini, /chat/302ai) returns same SSE format
- Frontend transport layer (DynamicChatTransport) treats all as equivalent
- Enables provider switching without UI code changes

### For Tool/Function Calling

Tool calls also emit through SSE:
```
data: {"type":"tool-input-start","toolCallId":"...","toolName":"..."}
data: {"type":"tool-input-delta","toolCallId":"...","inputTextDelta":"..."}
data: {"type":"tool-input-available","toolCallId":"...","input":{...}}
data: {"type":"tool-output-available","toolCallId":"...","output":{...}}
data: {"type":"finish"}  // Tools complete, finish still signals end
```

Still triggers `onFinish` callback with all messages including tool results.

## Version Compatibility

| Package | Version | Compatibility | Notes |
|---------|---------|----------------|-------|
| ai | 6.0.1 | ✓ Fully tested | Latest version, uses `createUIMessageStreamResponse()`, supports `toUIMessageStream()` |
| @ai-sdk/anthropic | 3.0.0 | ✓ Compatible | Works with AI SDK 6 |
| @ai-sdk/openai | 3.0.0 | ✓ Compatible | Works with AI SDK 6 |
| @ai-sdk/google | 3.0.0 | ✓ Compatible | Works with AI SDK 6 |
| @ai-sdk/svelte | 6.0.1 | ✓ Must match ai version | Dependent on ai package version |
| hono | 4.9.10 | ✓ No conflicts | Independent; no AI SDK dependency |
| Node.js ReadableStream | Native (ES2021+) | ✓ Universal | Built-in, no package required |

**Compatibility notes:**
- AI SDK v6 is NOT backward compatible with v5 — if upgrading, must update all @ai-sdk/* packages simultaneously
- `createUIMessageStreamResponse()` only exists in AI SDK v6+ (added late 2025)
- `toUIMessageStream()` new in AI SDK v6
- Your current stack (ai@6.0.1) is correct version

## Root Cause Analysis for Your Bug

**Symptom:** UI loading spinner continues after model response completes

**Investigation checklist:**

1. ✓ **Backend sends `finish` event?**
   - Search logs for `"type":"finish"` in stream output
   - If missing: Model streaming didn't complete or wasn't wrapped with `toUIMessageStream()`

2. ✓ **Backend sends `[DONE]` marker?**
   - Search logs for `data: [DONE]`
   - If missing: ReadableStream never closed; browser SSE parser still waiting
   - **Fix:** Add `controller.enqueue(encoder.encode("data: [DONE]\n\n"))` before `controller.close()`

3. ✓ **Backend calls `controller.close()`?**
   - ReadableStream must explicitly close to signal EOF
   - If missing: **Browser never gets closed signal; UI stays loading**
   - **Fix:** Ensure `controller.close()` called when reader gets `done: true`

4. ✓ **Frontend `onFinish` fires?**
   - Enable console logging: `console.log("[onFinish] called with:", { isAbort, isDisconnect, isError })`
   - If never fires: Backend didn't send `finish` event
   - If fires with error flags: Check API response, network issues

5. ✓ **Frontend clears `isLoading` state?**
   - Check `chat-state.svelte.ts` line ~1529
   - Verify `onFinish` callback sets `isLoading = false`
   - If no callback, UI never gets completion signal

## Sources

- [AI SDK 6 Blog - Vercel](https://vercel.com/blog/ai-sdk-6) — Overview of v6 features and improvements
- [AI SDK UI: Stream Protocol - Official Docs](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) — Complete SSE event specification and `finish` semantics
- [AI SDK UI: createUIMessageStreamResponse - Official Docs](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream-response) — API for wrapping streams with metadata
- [AI SDK Core: streamText - Official Docs](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) — Provider-agnostic streaming with lifecycle
- [Getting Started: Svelte - Official Docs](https://ai-sdk.dev/docs/getting-started/svelte) — Chat state management and `onFinish` patterns
- [Hono Streaming Helper - Official Docs](https://hono.dev/docs/helpers/streaming) — ReadableStream and SSE implementation patterns

---

**Stack research for:** Vercel AI SDK v6 + Hono.js stream completion detection
**Researched:** 2026-02-02
**Next step:** Implement stream completion detection in backend and validate frontend `onFinish` wiring
