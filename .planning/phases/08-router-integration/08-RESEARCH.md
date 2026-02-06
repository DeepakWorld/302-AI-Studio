# Phase 8: Router Integration - Research

**Researched:** 2026-02-06
**Domain:** Chat transport body, Hono router endpoints, onFinish callback -- wiring context compression into the message send/receive pipeline
**Confidence:** HIGH

## Summary

Phase 8 wires together everything built in Phase 6 (data model) and Phase 7 (backend endpoint). There are four concrete integration points: (1) pass `contextSummary` and `compressedMessageCount` from the frontend transport `body()` to the backend, (2) in each of the 4 chat router endpoints, prepend the summary to the system prompt and filter out old messages, (3) trigger summary generation in the `onFinish` callback when message count exceeds the threshold, and (4) persist the updated summary with proper AbortController handling.

All four modifications follow patterns already established in the codebase. The `body()` function already sends 20+ fields -- adding 2 more is trivial. The router endpoints all use `systemPrompt` identically -- a shared utility function avoids duplication. The `onFinish` callback already runs title generation and suggestions generation asynchronously -- context summary generation slots in the same way. The AbortController lifecycle was fully implemented in Phase 7.

**Primary recommendation:** Implement backend-side message truncation (router receives all messages, filters before AI call) and prepend the summary to `systemPrompt`. Do NOT modify the transport layer for message filtering -- keep it simple and consistent with the established architecture.

## Standard Stack

No new libraries needed. All work uses existing project infrastructure.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | 6.0.1 | `convertToModelMessages`, `Agent`, `generateText` | Already used by all chat endpoints and summarization endpoint |
| `hono` | 4.9.10 | Backend routing | All endpoints already here |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `generateContextSummary` (Phase 7) | N/A | Frontend API wrapper for summary generation | Called in onFinish when threshold exceeded |

**Installation:** None needed -- all dependencies exist.

## Architecture Patterns

### Pattern 1: Transport Body Extension

**What:** Add `contextSummary` and `compressedMessageCount` to the `body()` function in the `DynamicChatTransport` configuration.

**Where:** `src/lib/stores/chat-state.svelte.ts` lines 1559-1633, inside the `body: () => { ... }` closure.

**How it works now:** The `body()` function returns an object with 20+ fields (baseUrl, temperature, systemPrompt, threadId, etc.). This object is sent as the POST body to each chat endpoint. Every chat endpoint destructures the fields it needs.

**Change:** Add 2 optional fields. When `shouldApplyCompression` is true, include the summary and count. When false, omit them (undefined fields are not sent).

```typescript
// In body: () => { return { ... } }
// Add after existing fields:

// Context compression: only send when compression is active
...(chatState.shouldApplyCompression && chatState.contextSummary && {
	contextSummary: chatState.contextSummary,
	compressedMessageCount: chatState.compressedMessageCount,
}),
```

**Confidence:** HIGH -- verified from `chat-state.svelte.ts` lines 1559-1633.

### Pattern 2: Backend Message Truncation (Router-Side)

**What:** In each chat endpoint, if `contextSummary` is present, (a) prepend it to `systemPrompt` and (b) filter messages to only include those after the compressed region.

**Architecture decision from prior research:** Backend truncation (Option B) is preferred over frontend truncation because:
- The backend already has access to full message history for user prompt template resolution
- Transport layer stays simple (no message manipulation)
- Localhost transfer overhead is negligible
- Clean separation of concerns

**How message filtering works:**

The `compressedMessageCount` field tells the router how many messages from the start are "compressed" (summarized). The router slices messages: `messages.slice(compressedMessageCount)` to get only the recent, uncompressed messages.

Why `compressedMessageCount` (not `lastCompressionMessageId`): Index-based slicing is simpler and more reliable than ID-based lookup in the router. The frontend knows the count; the router just needs to slice. This avoids the risk of ID not being found in the messages array (e.g., if messages were edited or deleted).

**Shared utility to add to `electron/main/server/utils.ts`:**

```typescript
export function applyContextCompression(
	messages: UIMessage[],
	systemPrompt: string | undefined,
	contextSummary: string,
	compressedMessageCount: number,
): { messages: UIMessage[]; systemPrompt: string } {
	// Slice messages: keep only uncompressed (recent) messages
	const recentMessages = compressedMessageCount > 0
		? messages.slice(compressedMessageCount)
		: messages;

	// Prepend summary to system prompt
	const summaryPrefix = `[Context from earlier conversation]\n${contextSummary}\n\n[End of earlier context]\n\n`;
	const augmentedSystemPrompt = systemPrompt
		? summaryPrefix + systemPrompt
		: summaryPrefix.trim();

	return { messages: recentMessages, systemPrompt: augmentedSystemPrompt };
}
```

**Apply to each endpoint:**

```typescript
// In /chat/302ai (and /chat/openai, /chat/anthropic, /chat/gemini):
const { ..., contextSummary, compressedMessageCount } = await c.req.json<...>();

// After existing message resolution, before convertToModelMessages:
let messagesToConvert = resolvedMessages;
let effectiveSystemPrompt = systemPrompt;

if (contextSummary && compressedMessageCount && compressedMessageCount > 0) {
	const compressed = applyContextCompression(
		resolvedMessages, systemPrompt, contextSummary, compressedMessageCount,
	);
	messagesToConvert = compressed.messages;
	effectiveSystemPrompt = compressed.systemPrompt;
}

const convertedMessages = await convertToModelMessages(
	enhanceMessagesWithFeedback(messagesToConvert),
);
// Use effectiveSystemPrompt instead of systemPrompt in Agent/streamText config
```

**Confidence:** HIGH -- verified pattern from router.ts lines 178-940 (all 4 endpoints follow identical structure).

### Pattern 3: Summary Injection as System Prompt Prefix

**What:** Prepend the context summary to the `systemPrompt` field.

**Why this works:** All 4 chat endpoints use `systemPrompt` in two places:
1. Non-streaming path: `{ system: systemPrompt }` (AI SDK `generateText`/`streamText`)
2. Streaming path: `{ instructions: systemPrompt }` (AI SDK `Agent`)

Both accept a string. Prepending to the string works for both paths without changing the endpoint structure.

**Format:**
```
[Context from earlier conversation]
{summary text here}

[End of earlier context]

{user's original system prompt, if any}
```

The bracketed markers help the AI distinguish injected context from the user's explicit system prompt. This avoids the AI confusing the summary with instructions.

**Confidence:** HIGH -- verified from router.ts. `systemPrompt` is used as `system:` (line 347, 512, 687, 861) and `instructions:` (line 375, 553, 728, 902).

### Pattern 4: onFinish Summary Generation (Async, Non-Blocking)

**What:** After AI response completes, check if message count exceeds threshold and trigger summary generation.

**Where:** `src/lib/stores/chat-state.svelte.ts` inside the `onFinish` callback (lines 1638-2013). Add the new block AFTER title generation (line ~1897) and BEFORE suggestions generation (line ~1908).

**Existing pattern to follow (title generation, lines 1819-1882):**
```typescript
// Title generation pattern:
if (shouldGenerateTitle && titleModel) {
	const titleAbortSignal = chatState.createTitleAbortController();
	try {
		const result = await generateTitle(..., titleAbortSignal);
		if (titleAbortSignal.aborted || chatState.isStreaming || chatState.isSubmitted) {
			console.log("[Title] Skipped: request was aborted or new stream in progress");
		} else if (result) {
			persistedChatParamsState.current.title = result.title;
			// ...
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			console.log("[Title] Generation cancelled");
		} else {
			console.error("Failed to generate title:", error);
		}
	}
}
```

**New context summary block (follows same pattern):**
```typescript
// Context summary generation -- after title, before suggestions
if (chatState.shouldApplyCompression) {
	const compressionLimit = preferencesSettings.contextCompressionLimit;
	const totalMessages = messages.length;

	// Threshold check: only generate summary when total messages exceed limit
	if (totalMessages > compressionLimit) {
		const summaryModel = preferencesSettings.titleGenerationModel; // Reuse title model
		if (summaryModel) {
			const summaryAbortSignal = chatState.createSummaryAbortController();
			try {
				const provider = persistedProviderState.current.find(
					(p) => p.id === summaryModel.providerId,
				);
				const serverPort = window.app?.serverPort ?? 8089;
				const previousSummary = chatState.contextSummary;

				// Determine which messages to send for summarization:
				// - If no previous summary: send messages from start to (total - limit + buffer)
				// - If previous summary: send only NEW messages since last compression
				const existingCompressedCount = chatState.compressedMessageCount ?? 0;
				const messagesToCompress = existingCompressedCount > 0
					? messages.slice(existingCompressedCount, totalMessages - compressionLimit + existingCompressedCount)
					: messages.slice(0, totalMessages - compressionLimit);

				if (messagesToCompress.length >= 2) { // Need at least 1 pair
					let fallbackConfig;
					if (!provider && chatState.selectedModel && chatState.currentProvider) {
						fallbackConfig = {
							model: chatState.selectedModel,
							provider: chatState.currentProvider,
						};
					}

					const result = await generateContextSummary(
						messagesToCompress,
						summaryModel,
						provider,
						serverPort,
						previousSummary,
						generalSettings.language,
						fallbackConfig,
						summaryAbortSignal,
					);

					if (summaryAbortSignal.aborted || chatState.isStreaming || chatState.isSubmitted) {
						console.log("[ContextSummary] Skipped: aborted or new stream in progress");
					} else if (result) {
						const newCompressedCount = existingCompressedCount + messagesToCompress.length;
						const lastCompressedMsg = messages[newCompressedCount - 1];
						chatState.contextSummary = result;
						chatState.compressedMessageCount = newCompressedCount;
						chatState.lastCompressionMessageId = lastCompressedMsg?.id;
						persistedChatParamsState.flush();
						console.log(
							`[ContextSummary] Updated: ${newCompressedCount} messages compressed`,
						);
					}
				}
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					console.log("[ContextSummary] Generation cancelled");
				} else {
					console.error("[ContextSummary] Failed:", error);
				}
			}
		}
	}
}
```

**Key design decisions in this pattern:**
1. **Threshold check:** `totalMessages > compressionLimit` -- only compress when there are MORE messages than the limit
2. **Keep `compressionLimit` recent messages uncompressed** -- these go to the AI as actual messages
3. **Incremental compression:** If `compressedMessageCount` exists, only send the NEW messages since last compression (avoids re-summarizing everything)
4. **Minimum pair check:** Need at least 2 messages (1 user + 1 assistant) to be worth compressing
5. **Await (not fire-and-forget):** Title generation is `await`ed before suggestions. Summary generation should also be `await`ed to ensure state is consistent before suggestions run.

**Confidence:** HIGH -- pattern directly matches title generation in the same callback.

### Pattern 5: RouterRequestBody Type Extension

**What:** Add optional `contextSummary` and `compressedMessageCount` to the `RouterRequestBody` type.

**Where:** `electron/main/server/router.ts` line 43-76.

```typescript
export type RouterRequestBody = {
	// ... all existing fields ...
	/** Rolling context summary for compressed earlier messages */
	contextSummary?: string;
	/** Number of messages from start that are compressed into the summary */
	compressedMessageCount?: number;
};
```

**Confidence:** HIGH -- simple type extension.

### Anti-Patterns to Avoid

- **Modifying messages in the frontend before sending:** NEVER splice/filter `chat.messages` or `persistedMessagesState`. All messages must remain in storage. Truncation is router-side only.
- **Blocking sendMessage on summary generation:** Summary generation happens in `onFinish`, NEVER in the send path.
- **Generating summary on every message:** Only when `totalMessages > compressionLimit`.
- **Sending summary to the `/generate-context-summary` endpoint from the router:** The router chat endpoints only compress messages for the AI call. Summary generation is triggered from the frontend `onFinish` callback, NOT from the backend.
- **Using fire-and-forget for summary generation:** Although suggestions use `.then()` (fire-and-forget), summary generation should be `await`ed because subsequent logic (like suggestions) may read the updated `compressedMessageCount`. Title generation is also awaited.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Summary generation | Custom LLM call in router | `generateContextSummary()` from Phase 7 API wrapper | Already handles AbortController, fallback model, error handling |
| System prompt prepending | Inline string concatenation in each endpoint | Shared `applyContextCompression()` utility | 4 endpoints need identical logic; utility avoids duplication |
| AbortController lifecycle | New AbortController management | `chatState.createSummaryAbortController()` from Phase 7 | Already implemented and wired into sendMessage/regenerateMessage cancellation |
| Threshold checking | Complex logic with message IDs | Simple `messages.length > compressionLimit` | Count-based is simpler and more reliable than ID-based |

**Key insight:** Phase 7 built all the infrastructure. Phase 8 is purely about wiring -- connecting existing pieces at 4 specific integration points.

## Common Pitfalls

### Pitfall 1: Code Agent Endpoint Gets Compression
**What goes wrong:** The `/chat/302ai-code-agent` endpoint receives `contextSummary` and applies compression, but Code Agent needs full context.
**Why it happens:** The `body()` function sends the same fields to all endpoints.
**How to avoid:** The `shouldApplyCompression` derived property already returns `false` when Code Agent is enabled (Phase 6). The body only includes compression fields when `shouldApplyCompression` is true. Additionally, the router should only apply compression when `contextSummary` is present in the request body (defensive check).
**Warning signs:** Code Agent responses losing context from earlier messages.

### Pitfall 2: User Prompt Template Resolution Breaking
**What goes wrong:** The router's `chatParametersService.resolvePrevUserMsgsByUserPromptTemp()` processes messages BEFORE compression is applied, but compression removes old messages.
**Why it happens:** User prompt template resolution happens BEFORE the AI call, using the full message array.
**How to avoid:** Apply compression AFTER user prompt template resolution. The flow must be: (1) resolve user prompt templates (needs full messages), (2) apply compression (filter messages), (3) convert to model messages.
**Warning signs:** User prompt templates referencing old messages not being resolved correctly.

### Pitfall 3: Race Condition Between Summary and Suggestions
**What goes wrong:** Summary generation and suggestions generation both run in onFinish. If summary updates `compressedMessageCount` while suggestions is reading messages, state becomes inconsistent.
**Why it happens:** Both are async operations modifying shared state.
**How to avoid:** Await summary generation before starting suggestions generation. This matches the existing pattern where title generation is awaited before suggestions starts.
**Warning signs:** Suggestions referencing compressed messages that the AI won't see.

### Pitfall 4: Summary Persisted But Count Not Updated (or Vice Versa)
**What goes wrong:** `contextSummary` is updated but `compressedMessageCount` is not, or the other way around. On next request, the router applies wrong compression.
**Why it happens:** If an error or abort happens between the two state updates.
**How to avoid:** Update all three fields (`contextSummary`, `compressedMessageCount`, `lastCompressionMessageId`) atomically before calling `flush()`. Never flush between individual field updates.
**Warning signs:** AI receiving wrong number of messages; summary not matching actual compressed messages.

### Pitfall 5: systemPrompt is undefined
**What goes wrong:** When user has no custom system prompt (`systemPrompt` is `undefined`), prepending the summary creates a string like `"[Context from earlier conversation]\n...undefined"`.
**Why it happens:** String concatenation with undefined.
**How to avoid:** The `applyContextCompression` utility must handle `systemPrompt` being `undefined` or empty. When no user system prompt, the summary becomes the entire system prompt.
**Warning signs:** AI seeing "undefined" in its system prompt.

### Pitfall 6: Compressing Messages With Attachments
**What goes wrong:** Messages with file attachments (images, documents) are compressed into a text-only summary, losing visual/file context.
**Why it happens:** The summarization prompt only extracts text parts from messages.
**How to avoid:** This is acceptable behavior for the initial implementation. The summary captures the conversation text. The recent uncompressed messages still include their attachments. This is a known limitation, not a bug.
**Warning signs:** AI not remembering details from images in compressed messages (expected, documented limitation).

## Code Examples

### Example 1: Transport Body Extension (chat-state.svelte.ts)

```typescript
// Source: chat-state.svelte.ts body: () => { return { ... } }
// Add after the existing workspacePath field (around line 1631):

// Context compression fields (only sent when compression is active)
...(chatState.shouldApplyCompression && chatState.contextSummary && {
	contextSummary: chatState.contextSummary,
	compressedMessageCount: chatState.compressedMessageCount ?? 0,
}),
```

### Example 2: Shared Compression Utility (utils.ts)

```typescript
// Source: electron/main/server/utils.ts (new export)
import type { UIMessage } from "ai";

/**
 * Apply context compression to messages and system prompt.
 * Removes old messages that are covered by the summary, and prepends
 * the summary to the system prompt.
 *
 * @param messages Full message array from the client
 * @param systemPrompt User's system prompt (may be undefined)
 * @param contextSummary The rolling context summary text
 * @param compressedMessageCount Number of messages from start that are compressed
 * @returns Object with filtered messages and augmented system prompt
 */
export function applyContextCompression(
	messages: UIMessage[],
	systemPrompt: string | undefined,
	contextSummary: string,
	compressedMessageCount: number,
): { messages: UIMessage[]; systemPrompt: string } {
	// Keep only uncompressed (recent) messages
	const recentMessages =
		compressedMessageCount > 0 && compressedMessageCount < messages.length
			? messages.slice(compressedMessageCount)
			: messages;

	// Build augmented system prompt
	const summaryBlock = `[Context from earlier conversation]\n${contextSummary}\n[End of earlier context]`;
	const augmentedSystemPrompt = systemPrompt
		? `${summaryBlock}\n\n${systemPrompt}`
		: summaryBlock;

	return { messages: recentMessages, systemPrompt: augmentedSystemPrompt };
}
```

### Example 3: Router Endpoint Integration (router.ts)

```typescript
// Source: Pattern from /chat/302ai endpoint (router.ts line 178+)
// Apply to all 4 endpoints: 302ai, openai, anthropic, gemini

// Destructure new fields from request:
const { ..., contextSummary, compressedMessageCount } = await c.req.json<...>();

// AFTER user prompt template resolution, BEFORE convertToModelMessages:
let messagesToConvert = resolvedMessages;
let effectiveSystemPrompt = systemPrompt;

if (contextSummary && compressedMessageCount && compressedMessageCount > 0) {
	const result = applyContextCompression(
		resolvedMessages,
		systemPrompt,
		contextSummary,
		compressedMessageCount,
	);
	messagesToConvert = result.messages;
	effectiveSystemPrompt = result.systemPrompt;
}

// Then use messagesToConvert and effectiveSystemPrompt:
const convertedMessages = await convertToModelMessages(
	enhanceMessagesWithFeedback(messagesToConvert),
);

// For non-streaming:
const streamTextOptions = {
	...baseConfig,
	...(effectiveSystemPrompt && { system: effectiveSystemPrompt }),
};

// For streaming (Agent):
const agentConfig = {
	...baseConfig,
	...(effectiveSystemPrompt && { instructions: effectiveSystemPrompt }),
};
```

### Example 4: onFinish Summary Trigger (chat-state.svelte.ts)

```typescript
// Source: Pattern from title generation in onFinish (chat-state.svelte.ts line 1819+)
// Add AFTER title generation block, BEFORE suggestions block

// Context summary auto-update
if (chatState.shouldApplyCompression) {
	const compressionLimit = preferencesSettings.contextCompressionLimit;
	const totalMessages = messages.length;

	if (totalMessages > compressionLimit) {
		const summaryModel = preferencesSettings.titleGenerationModel;
		if (summaryModel) {
			const summaryAbortSignal = chatState.createSummaryAbortController();
			try {
				const provider = persistedProviderState.current.find(
					(p) => p.id === summaryModel.providerId,
				);
				const serverPort = window.app?.serverPort ?? 8089;

				// Calculate which messages to compress
				const existingCompressed = chatState.compressedMessageCount ?? 0;
				// Messages to newly compress: from last compressed point to keep-recent boundary
				const keepRecentCount = Math.min(compressionLimit, totalMessages);
				const newCompressionEnd = totalMessages - keepRecentCount;

				// Only compress if there are new messages to compress beyond existing
				if (newCompressionEnd > existingCompressed) {
					const messagesToCompress = messages.slice(existingCompressed, newCompressionEnd);

					if (messagesToCompress.length >= 2) {
						let fallbackConfig: FallbackModelConfig | undefined;
						if (!provider && chatState.selectedModel && chatState.currentProvider) {
							fallbackConfig = {
								model: chatState.selectedModel,
								provider: chatState.currentProvider,
							};
						}

						const summaryResult = await generateContextSummary(
							messagesToCompress,
							summaryModel,
							provider,
							serverPort,
							chatState.contextSummary,
							generalSettings.language,
							fallbackConfig,
							summaryAbortSignal,
						);

						if (
							summaryAbortSignal.aborted ||
							chatState.isStreaming ||
							chatState.isSubmitted
						) {
							console.log("[ContextSummary] Skipped: aborted or stream in progress");
						} else if (summaryResult) {
							chatState.contextSummary = summaryResult;
							chatState.compressedMessageCount = newCompressionEnd;
							chatState.lastCompressionMessageId = messages[newCompressionEnd - 1]?.id;
							persistedChatParamsState.flush();
							console.log(
								`[ContextSummary] Updated: ${newCompressionEnd} messages compressed`,
							);
						}
					}
				}
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					console.log("[ContextSummary] Generation cancelled");
				} else {
					console.error("[ContextSummary] Failed:", error);
				}
			}
		}
	}
}
```

## Transport Layer Architecture

### How DynamicChatTransport Works

```
User sends message
    |
    v
chatState.sendMessage() -> chat.sendMessage({ text, body: { model, apiKey } })
    |
    v
Chat instance (from @ai-sdk/svelte) calls transport.sendMessages()
    |
    v
DynamicChatTransport.sendMessages():
    1. Resolves API URL via api() function (dynamic per provider)
    2. Resolves body via body() function (returns all chat params)
    3. Merges per-call body (model, apiKey) with transport-level body
    4. POSTs to http://localhost:{port}/chat/{provider}
    5. Request body = { ...body(), ...perCallBody, messages: ALL_MESSAGES }
    |
    v
Response is processed through custom ReadableStream in constructor
    (handles errors, metadata events, [DONE] marker)
```

**Key insight:** The `body()` function is called fresh on every send. It reads current state reactively. Adding fields to the return object is the standard way to pass new data to the backend.

**The messages sent are ALL messages in `chat.messages`.** The transport does NOT filter messages. The backend receives the full history.

### How systemPrompt Flows

```
Frontend:
    body: () => ({
        systemPrompt: resolvePrompt(chatParameters.systemPromptContent, {...}).content,
        // ... other fields
    })
    |
    v
Backend (each chat endpoint):
    const { systemPrompt } = await c.req.json<...>();
    |
    +-- Non-streaming: { system: systemPrompt }      (generateText/streamText)
    +-- Streaming:     { instructions: systemPrompt } (Agent)
```

## onFinish Callback Analysis

### Current Structure (lines 1638-2013)

```
onFinish: async ({ messages, isAbort, isDisconnect, isError }) => {
    // 1. Metadata updates (lines 1640-1666) -- ALWAYS runs
    //    - Save userPromptTemplate to last user message metadata
    //    - Save systemPrompt to last assistant message metadata

    // 2. Code Agent handling (lines 1697-1710) -- conditional
    //    - Merge result metadata for Code Agent responses

    // 3. Event emission (lines 1718-1731) -- ALWAYS runs
    //    - Emit CHAT_FINISHED event

    // 4. Persist messages (line 1733)
    //    persistedMessagesState.current = messages;

    // 5. Plugin hooks (lines 1738-1786) -- ALWAYS runs
    //    - executeAfterSendMessageHook

    // 6. Title generation (lines 1788-1897) -- conditional, AWAITED
    //    - Checks timing setting
    //    - Uses AbortController
    //    - Updates persistedChatParamsState

    // 7. Update timestamp + flush (lines 1899-1906)
    //    persistedChatParamsState.current.updatedAt = new Date();
    //    persistedChatParamsState.flush();
    //    broadcastService.broadcastToAll("thread-list-updated", {});

    // === INSERT CONTEXT SUMMARY GENERATION HERE ===
    // (After title, before suggestions. Must be AWAITED.)

    // 8. Suggestions generation (lines 1908-2006) -- conditional, NOT awaited
    //    - Uses .then() fire-and-forget pattern
    //    - Uses AbortController
}
```

**Insertion point:** Between step 7 (flush/broadcast) and step 8 (suggestions).

Why after the flush: The flush at step 7 saves the title update. Summary generation may take 2-5 seconds. If we put summary before the flush, the title update would be delayed. By putting it after, the title is persisted immediately, and the summary triggers its own flush on completion.

Why before suggestions: Suggestions don't depend on the summary, but maintaining logical order (persist -> title -> summary -> suggestions) keeps the code readable and ensures all state mutations complete before the non-blocking suggestions fire.

**Whether to await or fire-and-forget:** The summary generation should be `try/catch`-wrapped with `await`, matching the title generation pattern. This ensures:
- Errors are properly caught
- The abort check happens synchronously after the await
- State updates are sequential, not interleaved

## Summary Injection Strategy

**Approach:** Prepend summary to `systemPrompt` as a clearly delimited block.

**Format:**
```
[Context from earlier conversation]
{rolling summary text, 200-500 chars}
[End of earlier context]

{user's original system prompt, if any}
```

**Why prepend to systemPrompt (not a separate message):**
1. Works with all 4 providers identically (openai, anthropic, gemini, 302ai)
2. AI SDK passes `system`/`instructions` as a dedicated parameter to the model
3. Does not consume message slots
4. Clean injection point -- one change per endpoint
5. Prior research recommended this (Option A, with Option C as fallback if needed)

**Edge cases:**
- No user systemPrompt: summary becomes the entire system prompt
- No contextSummary: endpoint behavior unchanged (existing systemPrompt or undefined)
- Both empty: no system prompt (existing behavior)

## Message Filtering Strategy

**Approach:** Backend-side filtering in each chat endpoint.

**Logic:**
```
if (contextSummary && compressedMessageCount > 0) {
    filteredMessages = messages.slice(compressedMessageCount);
} else {
    filteredMessages = messages; // unchanged
}
```

**Why count-based (not ID-based):**
- The count directly maps to `Array.slice()` -- no search needed
- IDs could be missing if messages were edited/deleted
- The frontend already tracks `compressedMessageCount` (Phase 6)
- Count is always monotonically increasing

**Why applied AFTER user prompt template resolution:**
The `chatParametersService.resolvePrevUserMsgsByUserPromptTemp()` in the router needs access to the full message array. It resolves template variables in previous user messages. Compression must happen AFTER this resolution to avoid breaking template variable substitution.

**Order in each endpoint:**
1. Parse request body (existing)
2. Resolve user prompt templates (existing -- needs full messages)
3. Apply context compression (NEW -- filters messages, augments systemPrompt)
4. Convert to model messages (existing -- now receives filtered messages)
5. Build agent/stream config (existing -- uses augmented systemPrompt)

## Key Files to Modify

| File | Change | Lines Affected |
|------|--------|----------------|
| `src/lib/stores/chat-state.svelte.ts` | Add compression fields to `body()` return; add summary generation to `onFinish` | body: ~1631; onFinish: ~1907 |
| `electron/main/server/router.ts` | Add `contextSummary`/`compressedMessageCount` to `RouterRequestBody`; destructure and apply in 4 chat endpoints | type: ~43; endpoints: ~178, ~418, ~593, ~768 |
| `electron/main/server/utils.ts` | Add `applyContextCompression()` utility function | New export, end of file |

### Files NOT Modified

| File | Reason |
|------|--------|
| `src/lib/transport/dynamic-chat-transport.ts` | Transport layer stays unchanged. Body extension is in chat-state, not transport. |
| `src/lib/api/context-summary-generation.ts` | Already complete from Phase 7. |
| `src/shared/types.ts` | ThreadParmas already has all fields from Phase 6. |
| `src/lib/stores/preferences-settings.state.svelte.ts` | Already has compression settings from Phase 6. |
| `electron/main/server/router.ts` /generate-context-summary | Already complete from Phase 7. |

## Open Questions

1. **Summary generation model:** The research recommends reusing `titleGenerationModel` for summary generation. This is the simplest approach (no new setting needed). However, if the title model is `null` (user hasn't configured it), summary generation silently skips. Should we fall back to `chatState.selectedModel` as the summary model? **Recommendation:** Yes, fall back to current chat model, matching the existing title generation fallback pattern (see `fallbackConfig` in onFinish title block).

2. **Compression limit as message count vs. pair count:** `contextCompressionLimit` is 20 (messages, not pairs). Since user+assistant = 1 pair = 2 messages, 20 messages = ~10 conversation turns. Is this the right unit? **Recommendation:** Keep as message count for simplicity. The user-facing setting can label it as "messages" and the number is intuitive enough.

3. **Re-summarization on thread resume:** If a thread has been inactive for days and the user sends a new message, the existing summary may be stale. Should we force a re-summarization? **Recommendation:** No, defer to a later phase. The existing summary is still valid context. New messages will trigger incremental updates naturally.

4. **Interaction with clearScreen:** When `clearScreenMessageId` is set, should compression consider the clear-screen boundary? **Recommendation:** No. `clearScreen` is a UI-only feature (hides messages visually). Compression is transport-layer (what the AI sees). They are independent. The AI should still benefit from the full summary even if the user has "cleared" their screen.

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Transport body extension | HIGH | Verified from chat-state.svelte.ts -- adding fields to body() is a 2-line change |
| Router endpoint modification | HIGH | All 4 endpoints follow identical structure. Shared utility eliminates duplication risk. |
| onFinish integration | HIGH | Title generation provides exact pattern to follow. AbortController already exists. |
| Message filtering logic | HIGH | Simple array slice, verified the count-based approach avoids ID lookup failures |
| System prompt injection | HIGH | All endpoints use systemPrompt identically in both streaming and non-streaming paths |

## Sources

### Primary (HIGH confidence)
- `src/lib/stores/chat-state.svelte.ts` -- Full Chat instance, body(), onFinish callback
- `electron/main/server/router.ts` -- All 4 chat endpoints, /generate-context-summary
- `src/lib/transport/dynamic-chat-transport.ts` -- Transport layer architecture
- `electron/main/server/utils.ts` -- Existing utilities, appendPromptToSystemMessage pattern
- `src/lib/api/context-summary-generation.ts` -- Phase 7 API wrapper
- `.planning/research/ARCHITECTURE-context-compression.md` -- Prior architecture research

### Secondary (MEDIUM confidence)
- `.planning/phases/07-backend-summarization/07-VERIFICATION.md` -- Phase 7 completion verification
- `.planning/phases/06-foundation/06-RESEARCH.md` -- Phase 6 data model decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies
- Architecture: HIGH -- all patterns verified from source code, prior research confirms approach
- Pitfalls: HIGH -- identified from direct code analysis of message flow and state management

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days -- stable patterns, no external dependencies changing)
