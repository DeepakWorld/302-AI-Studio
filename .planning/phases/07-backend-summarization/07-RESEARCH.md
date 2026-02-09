# Phase 7: Backend Summarization - Research

**Researched:** 2026-02-06
**Domain:** Hono.js backend endpoint + frontend API wrapper for rolling context summarization
**Confidence:** HIGH

## Summary

Phase 7 adds a `/generate-context-summary` backend endpoint and a frontend API wrapper that generates rolling 200-500 character summaries from message history. The endpoint mirrors the existing `/generate-title` endpoint pattern exactly: same multi-provider model creation switch, same `generateText()` call, same JSON response parsing with thinking-tag stripping, same error handling. The frontend API wrapper mirrors `title-generation.ts` with AbortController support and fallback model logic.

The "rolling summary" concept means: each call receives the previous summary (if any) + newly compressed messages, and produces an updated summary that incorporates both. This is identical to how `/generate-title` already handles incremental title updates via `previousSummary` parameter.

Phase 6 has been verified complete: `ThreadParmas` has `contextSummary`, `compressedMessageCount`, `lastCompressionMessageId`, and `compressionEnabled` fields. `ChatState` exposes them via getters/setters. `PreferencesSettingsState` has `contextCompressionEnabled` (default true) and `contextCompressionLimit` (default 20, clamped 5-100). `shouldApplyCompression` derived property correctly exempts Code Agent and private chat modes.

**Primary recommendation:** Create `/generate-context-summary` endpoint and `context-summary-generation.ts` API wrapper by directly copying and adapting the `/generate-title` endpoint and `title-generation.ts` patterns. The only novel work is the summarization prompt template.

## Standard Stack

No new libraries needed. Everything uses existing project dependencies.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | 6.0.1 | `generateText()` for non-streaming summary generation | Already used by `/generate-title`, all chat endpoints |
| `hono` | 4.9.10 | Backend endpoint routing | Already serves all API endpoints |
| `@ai-sdk/openai` | 3.0.0 | OpenAI provider for model creation | Already used in `/generate-title` |
| `@ai-sdk/anthropic` | 3.0.0 | Anthropic provider for model creation | Already used in `/generate-title` |
| `@ai-sdk/google` | 3.0.0 | Google provider for model creation | Already used in `/generate-title` |
| `@ai-sdk/openai-compatible` | (workspace) | 302AI provider for model creation | Already used in `/generate-title` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@302ai/ai-sdk` | (workspace) | 302AI-specific AI SDK provider | For 302ai providerType in model switch |

**Installation:** None needed -- all dependencies already in project.

## Architecture Patterns

### Pattern 1: Title Generation Endpoint (to mirror exactly)

**What:** The `/generate-title` endpoint at router.ts line 942-1088 is the direct template for `/generate-context-summary`.

**Structure:**
1. Parse request body: `messages`, `model`, `apiKey`, `baseUrl`, `providerType`, `previousSummary`
2. Switch on `providerType` to create `languageModel` (302ai/openai/anthropic/gemini)
3. Convert messages to conversation text string
4. Build prompt (different for first generation vs incremental update)
5. Call `generateText({ model: languageModel, prompt })`
6. Strip thinking tags from response
7. Parse JSON response with fallback handling
8. Return `c.json({ summary })` or `c.json({ error }, 500)`

**Key detail:** The `/generate-title` endpoint uses `createOpenAICompatible` (not `createAI302`) for the 302ai case. This is important to match.

### Pattern 2: Frontend API Wrapper (title-generation.ts pattern)

**What:** `src/lib/api/title-generation.ts` provides the exact pattern for the new `context-summary-generation.ts`.

**Structure:**
1. Define request/response interfaces
2. Inner `generateContextSummaryRequest()` function that calls `fetch()` with `signal` for AbortController
3. Outer `generateContextSummary()` function with fallback model retry logic
4. AbortSignal check between primary and fallback attempt
5. Return typed result or null on failure

### Pattern 3: AbortController Management (from ChatState)

**What:** ChatState manages AbortControllers for title and suggestions generation. Context summary needs the same pattern.

**Structure:**
```typescript
// Private field
private summaryAbortController: AbortController | null = null;

// Cancel method
cancelPendingSummary() {
    if (this.summaryAbortController) {
        this.summaryAbortController.abort();
        this.summaryAbortController = null;
    }
}

// Create method
createSummaryAbortController(): AbortSignal {
    this.cancelPendingSummary();
    this.summaryAbortController = new AbortController();
    return this.summaryAbortController.signal;
}
```

### Anti-Patterns to Avoid
- **Streaming for summary generation:** Use `generateText()` not `streamText()`. Summary is a batch operation, not user-facing streaming.
- **Blocking on summary:** Summary generation happens in `onFinish` asynchronously (Phase 8 concern), never in the critical send path.
- **Overcomplicating the prompt:** The prompt should be simple and direct. Overly complex prompts cause model confusion, especially with smaller/faster models.

## Key Files to Modify/Create

### New Files
| File | Purpose |
|------|---------|
| `src/lib/api/context-summary-generation.ts` | Frontend API wrapper with AbortController support and fallback model |

### Files to Modify
| File | Change |
|------|--------|
| `electron/main/server/router.ts` | Add `/generate-context-summary` POST endpoint (after `/generate-title`) |
| `src/lib/stores/chat-state.svelte.ts` | Add summaryAbortController, cancelPendingSummary(), createSummaryAbortController() |

### Files NOT Modified in This Phase
| File | Reason |
|------|--------|
| `src/shared/types.ts` | ThreadParmas already has all compression fields (Phase 6) |
| `src/lib/stores/preferences-settings.state.svelte.ts` | Already has compression settings (Phase 6) |
| Router chat endpoints (`/chat/302ai`, etc.) | Summary injection into AI requests is Phase 8 |
| `DynamicChatTransport` body | Passing summary to backend is Phase 8 |
| `onFinish` callback | Triggering summary generation is Phase 8 |

## Existing /generate-title Pattern (to mirror)

### Backend Endpoint (router.ts:942-1088)

**Request body:**
```typescript
{
    messages: UIMessage[];
    model: string;
    apiKey?: string;
    baseUrl?: string;
    providerType: ModelProvider["apiType"]; // "302ai" | "openai" | "anthropic" | "gemini"
    previousSummary?: string;
    isFirstGeneration?: boolean;
}
```

**Response body:**
```typescript
{ title: string; summary: string }
// or on error:
{ error: string } // with status 400 or 500
```

**Key implementation details from router.ts:**
1. Message text extraction: `msg.parts.filter(p => p.type === "text").map(p => p.text).join(" ")`
2. Conversation text format: `"User: [text]\nAssistant: [text]\n..."`
3. Provider model creation uses `createOpenAICompatible` for 302ai (NOT `createAI302`)
4. Prompt returns JSON: `{"title": "...", "summary": "..."}`
5. Response parsing strips thinking tags: `/<(think|thinking|reason|reasoning)>[\s\S]*?<\/\1>/gi`
6. Response parsing handles markdown code blocks: strips ``` wrappers
7. Fallback on parse failure: uses raw text

### Frontend API Wrapper (title-generation.ts)

**Key aspects:**
1. Inner function `generateTitleRequest()` handles single attempt with `signal?: AbortSignal`
2. Outer function `generateTitle()` orchestrates: try primary model -> check abort -> wait 500ms -> try fallback model
3. Fallback model comes from either `fallbackConfig` (current chat model) or hardcoded `gpt-4o-mini`
4. If fallback model equals primary model, returns null immediately
5. Returns `null` (not throws) on total failure -- caller handles gracefully

## Proposed /generate-context-summary Endpoint

### Request Body
```typescript
{
    messages: UIMessage[];           // Messages to summarize
    model: string;                   // Model ID
    apiKey?: string;                 // Provider API key
    baseUrl?: string;                // Provider base URL
    providerType: ModelProvider["apiType"]; // Provider type
    previousSummary?: string;        // Existing rolling summary to update
    language?: string;               // User's language preference (zh/en)
}
```

### Response Body
```typescript
{ summary: string }
// or on error:
{ error: string } // with status 400 or 500
```

### Prompt Template

**First generation (no previousSummary):**
```
Summarize the following conversation into a concise context summary (200-500 characters). Preserve:
- Key topics and decisions made
- Important facts, names, numbers, and dates mentioned
- User preferences and requirements stated
- Any ongoing tasks or action items

Conversation:
${conversationText}

Requirements:
- Use the SAME LANGUAGE as the main language in the conversation
- Keep between 200-500 characters
- Focus on information that would be useful context for continuing the conversation
- Do not include pleasantries or greetings

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{"summary": "your summary here"}
```

**Incremental update (has previousSummary):**
```
Update the following context summary with new conversation messages. The updated summary should be 200-500 characters and incorporate the new information while preserving important context from the previous summary.

Previous Summary: ${previousSummary}

New Messages:
${conversationText}

Requirements:
- Use the SAME LANGUAGE as the main language in the conversation
- Keep between 200-500 characters
- Preserve key facts, decisions, and context from the previous summary
- Add new important information from the latest messages
- Remove outdated or superseded information
- Focus on information useful for continuing the conversation

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks):
{"summary": "your updated summary here"}
```

### Why 200-500 Characters
- 200 chars minimum ensures enough context is preserved to be useful
- 500 chars maximum keeps the summary compact (roughly 100-150 tokens)
- For Chinese text, this translates to approximately 100-250 Chinese characters (very information-dense)
- The summary will be injected into the system prompt (Phase 8), so it must be compact

## Rolling Summary Logic

The rolling summary is an **incremental update** pattern, identical to how title generation already works:

1. **First compression:** No `previousSummary` exists. Send all messages beyond threshold N to the endpoint. Get back initial summary.
2. **Subsequent compressions:** `previousSummary` exists. Send only the NEW messages (since last compression) + the previous summary. Get back UPDATED summary that incorporates both.
3. **The endpoint itself does NOT need to know about thresholds or message counts.** It just takes messages + optional previous summary and returns a summary. The caller (Phase 8) determines WHICH messages to send and WHEN.

**What the endpoint receives (examples):**

First time (20+ messages, no prior summary):
```json
{
    "messages": [/* messages 1-15 that are being compressed */],
    "previousSummary": null,
    "model": "gpt-4o-mini",
    "providerType": "302ai"
}
```

Second time (35+ messages, has prior summary):
```json
{
    "messages": [/* messages 16-30 that are newly being compressed */],
    "previousSummary": "User discussed building a React dashboard. Key requirements: dark mode, responsive layout, data fetching with SWR. Decided on Tailwind CSS for styling.",
    "model": "gpt-4o-mini",
    "providerType": "302ai"
}
```

## Implementation Patterns

### 1. Provider Model Creation (copy from /generate-title)

The provider switch is identical across `/generate-title`, `/generate-suggestions`, `/decompose-tasks`. Copy the same switch block:

```typescript
let languageModel;
switch (providerType) {
    case "302ai": {
        const openai = createOpenAICompatible({
            name: "302.AI",
            baseURL: baseUrl || "https://api.openai.com/v1",
            apiKey: apiKey || "",
        });
        languageModel = openai.chatModel(model);
        break;
    }
    case "openai": {
        const openai = createOpenAI({
            baseURL: baseUrl || "https://api.openai.com/v1",
            apiKey: apiKey || "",
        });
        languageModel = openai.chat(model);
        break;
    }
    case "anthropic": {
        const anthropic = createAnthropic({
            baseURL: baseUrl || "https://api.anthropic.com/v1",
            apiKey: apiKey || "",
        });
        languageModel = anthropic.chat(model);
        break;
    }
    case "gemini": {
        const google = createGoogleGenerativeAI({
            baseURL: baseUrl || "https://generativelanguage.googleapis.com/v1beta",
            apiKey: apiKey || "",
        });
        languageModel = google.chat(model);
        break;
    }
    default:
        return c.json({ error: "Invalid provider type" }, 400);
}
```

### 2. Response Parsing (copy from /generate-title)

```typescript
let jsonStr = text.trim();

// Strip thinking blocks
jsonStr = jsonStr.replace(/<(think|thinking|reason|reasoning)>[\s\S]*?<\/\1>/gi, "");
jsonStr = jsonStr.replace(/^<(think|thinking|reason|reasoning)>[\s\S]*?(?=\{)/i, "");
jsonStr = jsonStr.replace(/^<(think|thinking|reason|reasoning)>[\s\S]*/i, "");
jsonStr = jsonStr.trim();

// Remove markdown code blocks
if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
}

const parsed = JSON.parse(jsonStr);
summary = parsed.summary || "";
```

### 3. Frontend API Wrapper Pattern

```typescript
// context-summary-generation.ts -- mirrors title-generation.ts

export interface GenerateContextSummaryRequest {
    messages: ChatMessage[];
    model: string;
    apiKey?: string;
    baseUrl?: string;
    providerType: "302ai" | "openai" | "anthropic" | "gemini";
    previousSummary?: string;
    language?: string;
}

export interface GenerateContextSummaryResponse {
    summary: string;
}

async function generateContextSummaryRequest(
    messages: ChatMessage[],
    modelId: string,
    provider: ModelProvider | undefined,
    serverPort: number,
    previousSummary?: string,
    language?: string,
    signal?: AbortSignal,
): Promise<string> {
    const response = await fetch(`http://localhost:${serverPort}/generate-context-summary`, {
        signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            messages,
            model: modelId,
            apiKey: provider?.apiKey,
            baseUrl: provider?.baseUrl,
            providerType: provider?.apiType || "openai",
            previousSummary,
            language,
        } satisfies GenerateContextSummaryRequest),
    });

    if (!response.ok) {
        throw new Error(`Failed to generate context summary: ${response.statusText}`);
    }

    const data: GenerateContextSummaryResponse = await response.json();
    return data.summary || "";
}

// Outer function with fallback logic (mirrors generateTitle)
export async function generateContextSummary(
    messages: ChatMessage[],
    model: Model,
    provider: ModelProvider | undefined,
    serverPort?: number,
    previousSummary?: string,
    language?: string,
    fallbackConfig?: FallbackModelConfig,
    signal?: AbortSignal,
): Promise<string | null> {
    const port = serverPort ?? 8089;
    try {
        return await generateContextSummaryRequest(
            messages, model.id, provider, port, previousSummary, language, signal,
        );
    } catch (error) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        // Fallback retry logic (same as title-generation.ts)
        // ...
    }
}
```

### 4. AbortController in ChatState

Add alongside existing `titleAbortController` and `suggestionsAbortController`:

```typescript
private summaryAbortController: AbortController | null = null;

cancelPendingSummary() {
    if (this.summaryAbortController) {
        this.summaryAbortController.abort();
        this.summaryAbortController = null;
        console.log("[ContextSummary] Cancelled pending summary generation");
    }
}

createSummaryAbortController(): AbortSignal {
    this.cancelPendingSummary();
    this.summaryAbortController = new AbortController();
    return this.summaryAbortController.signal;
}
```

Also update `sendMessage()` and `regenerateMessage()` to call `this.cancelPendingSummary()` at the start, matching how they already call `this.cancelPendingSuggestions()` and `this.cancelPendingTitle()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-provider model creation | Custom provider factory | Copy the switch(providerType) block from /generate-title | Proven pattern, handles all 4 providers identically |
| Response JSON parsing with thinking-tag handling | Custom parser | Copy the strip-thinking + parse-json pattern from /generate-title | Handles edge cases (unclosed tags, markdown blocks, DeepSeek think tags) |
| AbortController lifecycle | Custom abort management | Follow existing title/suggestions AbortController pattern in ChatState | Thread-safe, handles race conditions |
| Fallback model retry | Custom retry logic | Copy from title-generation.ts outer function | Handles abort between retries, same model detection |

## Common Pitfalls

### Pitfall 1: Prompt Returns Non-JSON
**What goes wrong:** Smaller/faster models sometimes return conversational text instead of JSON.
**Why it happens:** Model follows instructions inconsistently, especially with less capable models like gpt-4o-mini.
**How to avoid:** Include explicit "Return ONLY a valid JSON object" instruction. Add fallback: if JSON parse fails, use the raw text as the summary (stripping thinking tags). This is exactly what /generate-title does.
**Warning signs:** Inconsistent summary quality; empty summaries being stored.

### Pitfall 2: Summary Exceeds Character Limit
**What goes wrong:** Model generates summaries longer than 500 characters despite instructions.
**Why it happens:** Models treat character limits as suggestions, not constraints.
**How to avoid:** Server-side truncation after generation. If `summary.length > 500`, truncate at last sentence boundary before 500 chars. Alternatively, accept that the limit is approximate -- the 200-500 range is guidance for the model, not a hard constraint.
**Warning signs:** Very long summaries inflating system prompt size.

### Pitfall 3: Summary Loses Critical Context on Update
**What goes wrong:** Incremental update drops important context from previous summary.
**Why it happens:** The model over-prioritizes new messages and under-weights previous summary content.
**How to avoid:** Prompt must explicitly say "Preserve key facts, decisions, and context from the previous summary." Include specific categories: names, numbers, decisions, requirements.
**Warning signs:** Users notice AI "forgetting" earlier decisions after compression.

### Pitfall 4: Language Mismatch
**What goes wrong:** Summary generated in English for a Chinese conversation, or vice versa.
**Why it happens:** Model defaults to English unless explicitly told otherwise.
**How to avoid:** Include "Use the SAME LANGUAGE as the main language in the conversation" in prompt. Pass `language` parameter to endpoint for additional guidance.
**Warning signs:** Mixed-language summaries.

### Pitfall 5: AbortController Not Cancelled on New Send
**What goes wrong:** Stale summary result overwrites correct state after user sends new message.
**Why it happens:** Summary generation completes after user already started a new conversation turn.
**How to avoid:** Cancel pending summary in `sendMessage()` and `regenerateMessage()`. Check `abortSignal.aborted` AND `chatState.isStreaming` before updating state. Exact same guards as title generation uses.
**Warning signs:** Summary jumps back to older state after being updated.

## Code Examples

### Complete /generate-context-summary Endpoint
```typescript
// Source: Adapted from /generate-title at router.ts:942-1088
app.post("/generate-context-summary", async (c) => {
    const { messages, model, apiKey, baseUrl, providerType, previousSummary, language } =
        await c.req.json<{
            messages: UIMessage[];
            model: string;
            apiKey?: string;
            baseUrl?: string;
            providerType: ModelProvider["apiType"];
            previousSummary?: string;
            language?: string;
        }>();

    // Provider model creation (same switch as /generate-title)
    let languageModel;
    switch (providerType) {
        case "302ai": {
            const openai = createOpenAICompatible({
                name: "302.AI",
                baseURL: baseUrl || "https://api.openai.com/v1",
                apiKey: apiKey || "",
            });
            languageModel = openai.chatModel(model);
            break;
        }
        case "openai": { /* same pattern */ break; }
        case "anthropic": { /* same pattern */ break; }
        case "gemini": { /* same pattern */ break; }
        default:
            return c.json({ error: "Invalid provider type" }, 400);
    }

    // Convert messages to text
    const conversationText = messages
        .map((msg) => {
            const role = msg.role === "user" ? "User" : "Assistant";
            const textParts = msg.parts.filter((part) => part.type === "text");
            const text = textParts.map((part) => ("text" in part ? part.text : "")).join(" ");
            return `${role}: ${text}`;
        })
        .join("\n");

    try {
        let prompt: string;
        if (!previousSummary) {
            prompt = `Summarize the following conversation...`; // See prompt template above
        } else {
            prompt = `Update the following context summary...`; // See prompt template above
        }

        const { text } = await generateText({ model: languageModel, prompt });

        // Parse response (same pattern as /generate-title)
        let summary = "";
        try {
            let jsonStr = text.trim();
            // Strip thinking blocks, markdown, parse JSON
            // ...
            const parsed = JSON.parse(jsonStr);
            summary = parsed.summary || "";
        } catch {
            // Fallback: use raw text as summary
            let fallbackText = text.trim();
            // Strip thinking tags
            fallbackText = fallbackText.replace(/<(think|thinking|reason|reasoning)>[\s\S]*?<\/\1>/gi, "");
            fallbackText = fallbackText.replace(/<(think|thinking|reason|reasoning)>[\s\S]*/gi, "");
            summary = fallbackText.trim().slice(0, 500);
        }

        return c.json({ summary });
    } catch (error) {
        console.error("Context summary generation error:", error);
        return c.json({ error: "Failed to generate context summary" }, 500);
    }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Send all messages to AI | Compress older messages into summary | Phase 7-8 (this work) | Reduces token usage for long conversations |

This is a straightforward application of the "rolling summary" pattern that has been standard in LLM applications since 2023. The Vercel AI SDK does not provide built-in summarization -- it is left to the application layer, which is what we are implementing.

## Open Questions

1. **Summary length enforcement**
   - What we know: We ask for 200-500 chars in the prompt. Models may not comply exactly.
   - What's unclear: Should we enforce server-side truncation or accept approximate compliance?
   - Recommendation: Accept approximate compliance. If summary exceeds 600 chars, truncate at last sentence boundary. Log if this happens frequently.

2. **Model recommendation for summarization**
   - What we know: Uses `titleGenerationModel` from preferences (defaults to `sessionState.latestUsedModel` if null). Title gen has gpt-4o-mini as hardcoded fallback.
   - What's unclear: Whether context summary should also use titleGenerationModel or have its own setting.
   - Recommendation: Use titleGenerationModel (same setting). This is the user's chosen "fast/cheap auxiliary model." Adding a separate setting is premature complexity. Can be added in COMP-POLISH phases if needed.

3. **Message text extraction for tool calls and file parts**
   - What we know: Current title generation only extracts text parts. Messages may also contain tool calls, file references, etc.
   - What's unclear: Should tool call results be included in the conversation text sent for summarization?
   - Recommendation: Only extract text parts (matching title generation). Tool call content is often verbose/technical and would inflate the summarization input. The key conversational context is in user/assistant text.

## Sources

### Primary (HIGH confidence)
- `electron/main/server/router.ts` lines 942-1088 -- `/generate-title` endpoint (direct template)
- `src/lib/api/title-generation.ts` -- Frontend API wrapper (direct template)
- `src/lib/api/suggestions-generation.ts` -- Alternative simpler API wrapper pattern
- `src/lib/stores/chat-state.svelte.ts` lines 194-255 -- AbortController management pattern
- `src/shared/types.ts` lines 130-163 -- ThreadParmas with compression fields (Phase 6)
- `src/lib/stores/preferences-settings.state.svelte.ts` -- Compression settings (Phase 6)
- `.planning/phases/06-foundation/06-VERIFICATION.md` -- Phase 6 verification (all fields confirmed)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE-context-compression.md` -- Architecture decisions from planning phase
- `.planning/research/STACK-context-compression.md` -- Stack decisions from planning phase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Zero new dependencies, all existing libraries verified in codebase
- Architecture: HIGH -- Direct copy of proven /generate-title pattern verified in source
- Pitfalls: HIGH -- Derived from actual /generate-title implementation edge cases and response parsing code
- Prompt template: MEDIUM -- Prompt engineering is inherently iterative; initial template based on best practices but may need tuning

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- no external dependencies to version-track)
