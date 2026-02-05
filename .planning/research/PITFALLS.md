# Pitfalls Research: Context Compression

**Project:** 302-AI-Studio Context Compression
**Researched:** 2026-02-05
**Mode:** Pitfall analysis for adding context compression to existing chat system
**Confidence:** HIGH

## Summary

The highest-risk pitfalls when adding context compression to this codebase are: (1) race conditions with the existing title generation and suggestions systems that share the same `onFinish` callback, (2) summary quality degradation over long conversations where rolling summaries compound information loss, and (3) subtle breakage of existing features (message branching, regeneration, clear screen, Code Agent exemption) that assume all messages are always present and unmodified. Most of these risks stem from integrating a new async pipeline into an already-complex `onFinish` orchestration flow that is ~350 lines long.

---

## Critical Pitfalls

These mistakes cause rewrites, data corruption, or user-visible broken behavior.

### Pitfall 1: Race Condition Between Compression, Title Generation, and Suggestions in onFinish

**Risk:** The `onFinish` callback in `chat-state.svelte.ts` (lines 1559-1934) already orchestrates three sequential/parallel async operations: persisting messages, generating titles, and generating suggestions. Adding a fourth (compression) creates a timing minefield. Specifically:

- Title generation already reads `persistedChatParamsState.current.incrementalSummary` and writes back to it.
- Compression would read/write `contextSummary` and `compressedMessageCount` on the same `persistedChatParamsState.current` object.
- Both title and compression trigger `persistedChatParamsState.flush()` after their work.
- If the user sends a new message while compression is still running, `cancelPendingTitle()` exists but no `cancelPendingCompression()` exists yet. The running compression could overwrite state after a new message cycle has started.
- Suggestions generation (non-blocking, `.then()` chain) updates `chat.messages` and `persistedMessagesState.current` -- if compression also modifies message visibility or metadata at the same time, messages can become inconsistent.

**Warning Signs:**
- Intermittent loss of title updates (title generation completes but compression overwrites the flush).
- `incrementalSummary` going stale or being reset unexpectedly.
- Console errors about messages not found when suggestions try to update a message that compression has marked as compressed.
- State desync between `chat.messages` and `persistedMessagesState.current` after rapid message sends.

**Prevention:**
- Follow the exact AbortController pattern already used for title generation: create `compressionAbortController` in ChatState, call `cancelPendingCompression()` at the start of `sendMessage()` and `regenerateMessage()`.
- Run compression AFTER title generation completes (sequential, not parallel) since title generation needs the latest messages and compression would alter what messages are visible. The title generation block ends around line 1818 -- compression should go between title generation and the suggestions block.
- Use a single `persistedChatParamsState.flush()` call at the end of onFinish rather than multiple intermediate flushes. Currently there is one flush at line 1825 -- ensure compression writes happen before this single flush, not after with their own flush.
- Add a generation counter or lock flag (`compressionInProgress`) to prevent stale compression results from being applied if a new conversation turn has started.

**Phase:** Phase 1 (core implementation) -- this is architectural, must be designed correctly from the start.

---

### Pitfall 2: Rolling Summary Quality Degradation (Compounding Information Loss)

**Risk:** Each compression cycle takes the previous summary + recent messages and produces a new summary. Over many cycles, this is essentially a game of telephone -- small information losses compound. Research consistently identifies this as the primary failure mode of rolling summarization:

- A 10-turn conversation summarized once may lose 10-15% of relevant detail.
- By the 5th compression cycle (50+ turns), the summary can drift significantly from the original conversation's key details.
- Critical details that seemed minor at the time of compression (a user preference, a code variable name, a constraint mentioned early) get dropped because the summarization model optimizes for "what happened recently" not "what might matter later."
- The summary may capture "what happened" but lose "where we are" -- the current state of the task, what has been tried and failed, what remains to do.

This is especially dangerous in a multi-provider chat app where different models produce summaries of varying quality. A user who configured `gpt-4o-mini` for title/compression will get different summary quality than one using `claude-haiku`.

**Warning Signs:**
- AI responses after compression start asking questions the user already answered earlier.
- AI forgets constraints or preferences mentioned in the first few messages.
- Users notice the AI "lost context" after long conversations and manually re-state information.
- Summary text grows monotonically or, conversely, gets shorter with each cycle (both indicate the summarizer is not properly integrating old and new information).

**Prevention:**
- Include explicit instructions in the summarization prompt to preserve: (1) user-stated constraints and preferences, (2) key decisions made, (3) unresolved items still pending, (4) technical details like names/IDs/paths that are likely to be referenced again.
- Set a minimum summary length floor (not just max length) -- e.g., summary must be at least 200 chars. A summary that is too short has definitely lost critical information.
- Always keep the FIRST user message uncompressed (it contains the original intent) and the most recent N messages verbatim. The summary covers only the middle.
- Consider a "summary + key facts" format where the prompt returns both a narrative summary and a list of extracted key facts. Key facts are less prone to summarization drift.
- Add a compression quality test during development: take a 50-message conversation, compress it down to summary + 5 messages, then ask the model a question that requires information from the compressed portion. If it cannot answer, the summary prompt needs improvement.

**Phase:** Phase 1 (prompt engineering) and Phase 2 (testing/validation) -- the prompt quality determines the entire feature's value.

---

### Pitfall 3: Breaking Existing Features That Assume Full Message History

**Risk:** Multiple existing features traverse or depend on the full message array. Context compression changes what messages are sent to the AI, and if not carefully isolated, can break these features:

1. **Message branching** (`createBranch`, `createBranchAndSend` at lines 1180-1349): Slices `this.messages` up to a target message ID. If compressed messages are removed from the array, branching from an early message will produce a branch missing the compressed context.

2. **Regeneration** (`regenerateMessage` at lines 824-891): Finds messages by ID to determine what to remove and re-send. If compressed messages are hidden, regenerating an early assistant response would send incomplete context.

3. **Clear screen** (`clearScreen`, `restoreClearScreen`, `visibleMessages` at lines 464-488): Already uses a message visibility layer with `clearScreenMessageId`. Compression adds a SECOND visibility layer. These two systems could conflict -- e.g., user clears screen past the compression boundary, then restores, and sees a confusing gap.

4. **Message editing** (`updateMessage` at line 927): User edits a message that is in the "compressed" range. The edit succeeds locally but the AI never sees it because it is behind the compression boundary.

5. **Tool call rerun** (`rerunToolCall` at lines 1024-1068): Slices messages up to a tool call and re-sends. If the tool call was in compressed messages, this breaks entirely.

**Warning Signs:**
- Branches created from mid-conversation are missing context that was in the compressed range.
- Regenerating early messages produces responses that ignore the original conversation context.
- Users edit a message and the AI ignores the edit on the next turn.
- Clear screen + compression together produces confusing message visibility states.

**Prevention:**
- NEVER remove messages from `persistedMessagesState.current` or `chat.messages`. Compression should ONLY affect what is sent to the AI backend, not what is stored or displayed.
- Implement compression as a "message filtering" step that happens in the transport layer (`DynamicChatTransport`) or the backend endpoint, not by mutating the message array.
- Specifically: when building the request body for the AI, replace compressed messages with the summary as a system message, but keep all messages intact in local state.
- This aligns with the STACK.md decision to inject summary via system prompt -- messages stay intact, only the API call is modified.
- Test every existing message operation (branch, regenerate, edit, delete, rerun tool, clear screen) with compressed threads to verify they still work.

**Phase:** Phase 1 (architecture) -- must be a core design constraint: compression is a TRANSPORT concern, not a STATE concern.

---

### Pitfall 4: Title Generation and Compression Summary Diverging

**Risk:** The codebase already has `incrementalSummary` on `ThreadParams` (line 152 in types.ts) used exclusively for title generation. The STACK.md proposes adding a separate `contextSummary` field. These two summary fields serve different purposes but are generated from the same conversation and potentially by the same model:

- `incrementalSummary`: Used to generate better titles incrementally. Short, topic-focused.
- `contextSummary`: Used to maintain conversation context for the AI. Detailed, preserves facts.

If both are generated independently, they will diverge -- the title summary says the conversation is about "Python async debugging" while the context summary describes it as "migrating a Flask app to FastAPI." This is not just wasteful (two LLM calls for overlapping work), it can confuse the system:

- Title generation uses `incrementalSummary` as previous context to generate the next title. If it is short and lossy, titles become generic over time.
- Context compression uses `contextSummary` for AI continuation. If it drifts from what the title says, users see a disconnect between the thread title and the AI's understanding.

**Warning Signs:**
- Thread title no longer matches the actual conversation topic after many turns.
- Two separate LLM calls being made for closely related summarization tasks.
- The two summary fields on `ThreadParams` storing contradictory characterizations of the same conversation.

**Prevention:**
- Consider generating BOTH title and context summary from a single LLM call. The compression prompt can return `{ summary, title }` -- if the user has "everyTime" title generation enabled, this eliminates a redundant API call.
- At minimum, feed the `contextSummary` as input to the title generation prompt (if compression has run, the context summary already captures the conversation state -- use it instead of `incrementalSummary`).
- Alternatively, promote `incrementalSummary` to serve both purposes by making it more detailed. Currently the title generation prompt says "generate a concise title and summary" with 10-20 words/characters. This is far too short for context compression. If the summary were 200-500 chars, it could serve both needs.
- Design the data model so that there is ONE source of truth for "what this conversation is about," not two competing fields.

**Phase:** Phase 1 (data model design) -- decide before writing code whether to unify or separate.

---

## Medium Pitfalls

These mistakes cause delays, user confusion, or technical debt requiring non-trivial fixes.

### Pitfall 5: Storage Migration for Existing Threads Missing contextSummary

**Risk:** Adding optional fields (`contextSummary`, `compressedMessageCount`, `lastCompressionMessageId`) to `ThreadParams` is backward-compatible at the TypeScript level, but existing threads in `@302ai/unstorage` have no these fields. The `PersistedState` system hydrates stored data directly into `persistedChatParamsState.current`. If code assumes `contextSummary` is a string (e.g., `.length`, `.trim()`, string concatenation) without checking for `undefined`, it will throw on every existing thread.

The migration system exists (`migration-utils.ts`) but uses `_version` tracking. The `persistedChatParamsState` is keyed per-thread (`app-thread:${threadId}`), meaning migration must run for EVERY stored thread, not just once globally.

**Warning Signs:**
- TypeError: Cannot read properties of undefined (reading 'length') on app startup with existing threads.
- Compression logic silently skips because it checks `if (contextSummary)` and existing threads have `undefined`.
- Migration runs on one thread but not others (if migration is triggered on hydration, it only runs for the currently-loaded thread).

**Prevention:**
- Always use optional chaining and nullish coalescing when reading compression fields: `persistedChatParamsState.current.contextSummary ?? ""`.
- Do NOT rely on migration to add defaults -- `PersistedState` loads whatever was stored. Instead, make all compression logic defensive against `undefined` values.
- Test with a thread created BEFORE compression is implemented. Open it, send a message, verify compression triggers correctly on the first qualifying turn.
- If using the migration system, ensure it runs at the storage-service level (electron main process) where it can iterate over all stored threads, not at the renderer level where it only processes the current thread.

**Phase:** Phase 1 (implementation) -- every field access must be defensive from the start.

---

### Pitfall 6: Compression Threshold Too Low or Too High

**Risk:** The STACK.md proposes a default threshold of 20 messages. This is a critical UX parameter:

- **Too low (5-10 messages):** Compression fires on the 3rd conversation turn (user + assistant = 2 messages per turn). Users barely started talking and already get compressed. The summary is necessarily thin because there is little to summarize. Quality drops because the model has too little context to write a meaningful summary.
- **Too high (50+ messages):** Users hit token limits before compression ever fires. The feature provides no benefit. On models with 8K-16K context windows, 50 messages may already exceed the limit.
- **Message count vs. actual token usage mismatch:** A message count of 20 could be 2K tokens (short Q&A) or 40K tokens (code-heavy conversation with large snippets). Fixed message count ignores actual token pressure.

Research indicates: "Narrow gaps trigger frequent compression, causing higher summarization overhead and frequent prompt cache invalidation. Wide gaps reduce compression frequency but risk aggressive truncation."

**Warning Signs:**
- Users report compression firing too early in conversations.
- Users report hitting context window limits despite compression being "enabled."
- Compression fires after every single message exchange (threshold too low relative to actual message count).
- Compression never fires in normal conversations (threshold too high).

**Prevention:**
- Default threshold of 20 messages is reasonable as a starting point. This is approximately 10 conversation turns.
- Make the threshold configurable with clear UI labels: "Compress after N messages" with a slider (range: 6-50, step: 2).
- Consider a TWO-threshold approach (fill line / drain line): compress when messages exceed 20, retain last 10 uncompressed. This prevents re-compression on every subsequent message.
- In the future, consider adding a token-based check as a secondary trigger (but not for Phase 1 -- message count is sufficient per STACK.md).
- Document to users that the threshold applies to total messages including system/assistant messages, not just user turns.

**Phase:** Phase 1 (settings) and Phase 2 (tuning based on user feedback).

---

### Pitfall 7: Code Agent Exemption Not Comprehensive

**Risk:** The project specifies "Code Agent exempt" from compression. The current codebase uses `codeAgentState.enabled` to branch behavior in multiple places. But Code Agent exemption for compression needs to be checked at EVERY point where compression logic executes:

1. In `onFinish` -- should not trigger compression generation.
2. In the transport `body()` -- should not inject context summary.
3. In settings UI -- may want to hide/disable compression settings when Code Agent is the default mode.
4. In branching -- if a branch is created from a compressed chat thread and opened in Code Agent mode, the `contextSummary` from chat mode should not be injected into Code Agent requests.

The risk is missing one of these checkpoints, causing:
- Compression triggering for Code Agent conversations (wasteful LLM calls, potentially confusing summaries).
- Context summary being injected into Code Agent requests where the sandbox-based context system handles memory differently.
- Code Agent seeing a stale chat-mode summary when switching modes mid-thread.

**Warning Signs:**
- LLM summarization calls appearing in console when in Code Agent mode.
- Code Agent responses referencing conversation context that was in a chat-mode summary.
- Unexpected API calls to `/generate-summary` when using Code Agent.

**Prevention:**
- Create a single boolean helper: `const isCompressionEligible = compressionEnabled && !codeAgentState.enabled;` -- use it everywhere.
- Add this check at the transport level (before injecting summary) AND the onFinish level (before triggering compression).
- Write a unit test that verifies compression does NOT fire when `codeAgentState.enabled` is true.
- If a thread switches from chat to Code Agent mode mid-conversation, do NOT clear the contextSummary (it may be useful if they switch back), but do NOT inject it into Code Agent requests.

**Phase:** Phase 1 (implementation) -- must be consistently applied from the start.

---

### Pitfall 8: System Prompt Injection Conflicts with User-Configured System Prompts

**Risk:** The STACK.md proposes injecting the context summary as a prefix to the system prompt:
```
[Previous conversation summary: ${contextSummary}]\n\n${userSystemPrompt}
```

The current system prompt is already complex -- it is resolved from templates with variable substitution (`resolvePrompt()` in the transport body). Problems arise:

- Users who set their own system prompts may find them altered in unexpected ways. The summary prefix could confuse models about their role ("You are a Python expert" gets prefixed with "Previous conversation summary: user asked about JavaScript...").
- Some models have limited system prompt processing. Prefixing a long summary to an already-long system prompt can exceed system prompt limits on certain providers.
- The summary text is LLM-generated and could contain prompt injection content (e.g., if a user message contained adversarial text, the summary might reproduce it, and it ends up in the system prompt where it has higher authority).

**Warning Signs:**
- AI responses ignoring the user's custom system prompt after compression kicks in.
- Model behavior changing unexpectedly after the first compression cycle.
- Summary text containing instructions that override the user's system prompt intent.

**Prevention:**
- Inject the summary as a SEPARATE system message, not as a prefix to the user's system prompt. The Vercel AI SDK and all major providers support multiple system-level messages or a conversation context format.
- If prefixing is the chosen approach, clearly delimit it: wrap in explicit XML-style tags like `<conversation_context>...</conversation_context>` so models can distinguish it from the actual system prompt.
- Sanitize the summary output: strip any instruction-like patterns (e.g., lines starting with "You are," "Act as," "Ignore previous") before injecting.
- Test with a custom system prompt set: verify the AI still follows the system prompt instructions after compression.
- Consider making the injection point configurable: prefix vs. suffix vs. separate message.

**Phase:** Phase 1 (transport layer) -- the injection mechanism must be carefully designed.

---

### Pitfall 9: Compression Firing During Active Streaming or Submitted State

**Risk:** The `onFinish` callback fires after streaming completes, but there is a window where the user can send a new message very quickly. If compression starts (an async LLM call) and the user immediately sends a new message:

- The new `sendMessage()` calls `cancelPendingTitle()` and `cancelPendingSuggestions()`, but not `cancelPendingCompression()` (unless we add it).
- The compression LLM call completes and writes results to `persistedChatParamsState.current`.
- The new message's `onFinish` runs, reads potentially stale compression state, and triggers ANOTHER compression.
- Two compression results race to update the same fields.

This mirrors the existing title generation race condition pattern, but compression is MORE dangerous because:
- Compression affects what context the AI receives on the NEXT message.
- If a stale compression result writes an outdated summary, the very next AI response could be based on wrong context.

**Warning Signs:**
- Console logs showing compression completing after a new stream has started.
- `contextSummary` content not matching the latest conversation state.
- Double compression triggers in quick succession.

**Prevention:**
- Mirror the title generation pattern exactly: add `compressionAbortController` to ChatState, add `cancelPendingCompression()` method, call it in `sendMessage()` and `regenerateMessage()`.
- Add state guard: `if (abortSignal.aborted || chatState.isStreaming || chatState.isSubmitted) return;` before writing results (same pattern as title generation at line 1786).
- Compression should be the LAST async operation in onFinish, after title generation and before suggestions. This minimizes the window where it can conflict.

**Phase:** Phase 1 (core implementation) -- must match existing abort patterns.

---

## Low Pitfalls

These are annoyances or minor issues that are easily fixable once detected.

### Pitfall 10: Confusing UI for Compressed State

**Risk:** Users may not understand why their conversation looks different after compression. If compressed messages are visually hidden or collapsed, users might think messages were deleted. If they are shown normally but the AI "forgot" them, users blame the AI, not the compression.

**Warning Signs:**
- User reports of "missing messages" that are actually compressed.
- Confusion about why the AI seems to have less context than the visible conversation implies.

**Prevention:**
- Show a clear visual indicator when compression is active: "N earlier messages summarized" with an expand option.
- Do NOT hide compressed messages by default. Keep them visible in the UI. Compression only affects what is SENT to the AI, not what is DISPLAYED to the user.
- Consider a subtle visual divider line between "summarized" and "active" messages, with a tooltip explaining compression.
- Make it obvious in the UI that this is a client-side optimization, not a destructive action.

**Phase:** Phase 2 (UI polish) -- core logic works without this, but UX suffers.

---

### Pitfall 11: Summary Prompt Language Mismatch

**Risk:** The title generation prompt already handles multilingual conversations with "Use the SAME LANGUAGE as the main language in the conversation." The compression summary prompt needs the same treatment, but with higher stakes -- a summary in the wrong language injected into a system prompt can confuse the model:

- User writes in Chinese, summary generated in English (model default), AI switches to English.
- Mixed-language conversations produce summaries that blend languages unpredictably.

**Warning Signs:**
- AI response language changes after compression fires.
- Summary contains a mix of languages that confuses the model.

**Prevention:**
- Copy the language instruction from the title generation prompt: "Use the SAME LANGUAGE as the main language in the conversation."
- Add an explicit `language` parameter to the summary generation request (the transport body already passes `language: generalSettings.language`).
- Test with Chinese, English, and mixed-language conversations.

**Phase:** Phase 1 (prompt engineering) -- easy to get right if done from the start.

---

### Pitfall 12: Private/Incognito Chat Compression Persistence

**Risk:** The app supports private/incognito chat (`isPrivateChatActive`). If compression stores a `contextSummary` in the thread params, private chat content leaks into persistent storage via the summary, even if the original messages are expected to be ephemeral.

**Warning Signs:**
- Private chat content appearing in thread params storage after the session.
- Summary text containing sensitive information from a private conversation.

**Prevention:**
- Check `isPrivateChatActive` before triggering compression. If private chat is active, skip compression entirely (same as Code Agent exemption).
- Add this to the `isCompressionEligible` check: `!persistedChatParamsState.current.isPrivateChatActive`.
- Audit what happens to `persistedChatParamsState` when private chat mode is toggled. If private chat threads are cleaned up on close, ensure `contextSummary` is also cleaned.

**Phase:** Phase 1 (implementation) -- simple check, but easy to forget.

---

### Pitfall 13: Compression Summary Exceeding Useful Length

**Risk:** The STACK.md proposes `contextSummaryMaxLength: 500` characters. If the summary exceeds this, it needs truncation. But truncation of a summary can produce incoherent text. If the summary is too short, it loses critical information. The optimal length depends on conversation complexity.

**Warning Signs:**
- Truncated summaries ending mid-sentence.
- Very short summaries that do not capture conversation state.
- Summary taking up a significant portion of the model's context window, defeating the purpose.

**Prevention:**
- Include a max length instruction in the prompt itself: "Limit your summary to approximately 500 characters."
- Do NOT hard-truncate the result. If the model returns more, accept it but log a warning. Hard truncation produces broken text.
- The 500 character default (~125 tokens) is quite short. Consider 1000-2000 characters as a more practical default for conversations that merit compression.
- Make this configurable, but label it clearly: "Summary length (characters)" with guidance text.

**Phase:** Phase 1 (settings and prompt) -- straightforward but impacts quality.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Priority |
|-------------|---------------|------------|----------|
| Backend endpoint | Provider-specific response format quirks | Mirror `/generate-title` error handling and JSON parsing (including thinking-tag stripping) | High |
| ThreadParams extension | Existing threads missing new fields | Defensive `?? ""` everywhere, not migration-dependent | High |
| onFinish integration | Race condition with title/suggestions | AbortController pattern, sequential ordering after title gen | Critical |
| Transport body injection | System prompt conflict | Use delimited format or separate system message | High |
| Settings UI | Feature discoverability | Place near existing title generation settings | Low |
| Code Agent exemption | Missing a code path | Single `isCompressionEligible` check used everywhere | Medium |
| Private chat | Summary persists private content | Add to eligibility check | Medium |
| Summary quality | Compounding degradation over time | Strong prompt, always preserve first message, test with long conversations | High |
| Message visibility | Users confused about compressed state | Visual indicator, keep messages in UI | Medium |
| Branching from compressed threads | Branch missing compressed context | Never mutate message array, compression is transport-only | High |

---

## Sources

- [Factory.ai: Compressing Context](https://factory.ai/news/compressing-context) -- comprehensive analysis of context compression strategies and pitfalls for AI agents
- [Factory.ai: Evaluating Context Compression](https://factory.ai/news/evaluating-compression) -- compression evaluation methodology and metrics
- [James Howard: Context Degradation Syndrome](https://jameshoward.us/2024/11/26/context-degradation-syndrome-when-large-language-models-lose-the-plot/) -- analysis of how LLMs lose coherence over long conversations
- [mem0.ai: LLM Chat History Summarization Guide](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) -- practical guide for implementing chat history summarization
- [Getmaxim: Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/) -- strategies for managing context in chatbots
- [dbreunig: How Long Contexts Fail](https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html) -- practical failure modes of long context windows
- [Anthropic: Automatic Context Compaction Cookbook](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction) -- Anthropic's official guide to context compaction
- [Zed Editor Discussion: Automatic Context Compression with Configurable Threshold](https://github.com/zed-industries/zed/discussions/32614) -- real-world threshold configuration discussion
- [Goose: Smart Context Management](https://block.github.io/goose/docs/guides/sessions/smart-context-management/) -- threshold-based compaction with auto-compact at 80% token limit
- [OpenAI Community: Collapse & expand inside chat to improve UX](https://community.openai.com/t/collapse-expand-inside-chat-to-improve-ux/1077126) -- UX patterns for compressed chat content
- Codebase analysis: `chat-state.svelte.ts` (1935 lines), `router.ts` (1087+ lines), `types.ts`, `title-generation.ts`, `migration-utils.ts`

## Confidence: HIGH

**Reasoning:**
- All pitfalls verified against actual codebase patterns (read and analyzed `chat-state.svelte.ts`, `router.ts`, `types.ts`, `title-generation.ts`, `migration-utils.ts`)
- Race condition risks confirmed by reading actual `onFinish` callback flow (350+ lines of sequential/parallel async operations)
- Existing patterns (title generation AbortController, `incrementalSummary`, Code Agent exemption) provide high-confidence templates for what works and what can go wrong
- Research sources corroborate domain-general pitfalls (summary degradation, threshold tuning, UX confusion) with multiple independent sources
- Every pitfall maps to a specific code location or interaction in the existing codebase
