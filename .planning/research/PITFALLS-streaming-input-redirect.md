# Domain Pitfalls: Streaming Input Redirection

**Domain:** Adding streaming input redirection to existing Vibe Mode chat app
**Researched:** 2026-02-04
**Confidence:** HIGH (based on codebase analysis of existing patterns)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Dual Input Source State Desynchronization

**What goes wrong:** When input can come from both the main chat input (`chatState.inputValue`) AND the taskboard input (`codeAgentTaskboardState.inputValue`), state can become desynchronized. User types in one input while the other still has stale content, leading to:
- Wrong content being sent to AI
- Attachments from one source being sent with text from another
- UI showing inconsistent state between the two inputs

**Why it happens:** The existing codebase has two separate state stores:
- `chatState` in `/src/lib/stores/chat-state.svelte.ts` (lines 317-329)
- `codeAgentTaskboardState` in `/src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts` (lines 34-36)

Both have their own `inputValue` and `attachments` state. When adding redirection, developers often forget to clear/sync both.

**Consequences:**
- Messages sent with wrong content
- Attachments duplicated or lost
- User confusion about which input is "active"

**Prevention:**
1. Create a single source of truth for "active input source" state
2. Implement a clear handoff protocol when switching input sources
3. Clear the non-active input when redirection occurs
4. Add derived state that shows which input is currently authoritative

**Detection (warning signs):**
- Tests pass individually but fail when run together
- Intermittent "wrong message sent" bug reports
- Attachments appearing/disappearing unexpectedly

**Phase to address:** Phase 1 (Foundation) - Must establish input source authority pattern before any redirection logic

---

### Pitfall 2: Stream Abort Race Condition on Input Redirect

**What goes wrong:** When redirecting input while a stream is in progress, the abort signal may not properly cancel the existing stream before the new message is sent. This causes:
- Two concurrent streams fighting for the same message array
- `chat.messages` being corrupted with interleaved content
- `onFinish` callback firing for the wrong stream

**Why it happens:** The existing code uses `AbortController` patterns (see `chat-state.svelte.ts` lines 198-255) but these are designed for suggestions/title generation, not for the main chat stream. The `chat.stop()` method (line 900) is synchronous but the actual stream termination is asynchronous.

**Consequences:**
- Corrupted message history
- Duplicate assistant messages
- `persistedMessagesState` containing garbage data
- App crash from invalid state

**Prevention:**
1. Implement a "stream lock" that prevents new messages until current stream fully terminates
2. Use the existing `isStreaming` and `isSubmitted` derived states (lines 447-448) as guards
3. Add a `waitForStreamComplete()` helper similar to `#waitForChatCompletion()` in taskboard state (lines 488-508)
4. Queue redirected input instead of sending immediately if stream is active

**Detection (warning signs):**
- `[DynamicChatTransport] Abort signal received` logs appearing unexpectedly
- Message array length changing erratically
- `onFinish` callback logging wrong message counts

**Phase to address:** Phase 2 (Core Redirection) - Must be solved before implementing any redirection that can interrupt streams

---

### Pitfall 3: Attachment Upload Timing Mismatch

**What goes wrong:** When redirecting input with attachments, the attachment upload to sandbox may not complete before the message is sent. The existing code has two paths:
1. Direct upload when sandbox exists (`taskboard-input.svelte` lines 81-110)
2. Pending queue when sandbox not initialized (`addPendingAttachments` line 86)

Redirection adds a third timing scenario: attachments from chat input being redirected to taskboard flow.

**Why it happens:** The `chatState.attachments` use a different upload mechanism than `codeAgentTaskboardState.attachments`. Chat attachments are converted to message parts inline (`convertAttachmentsToMessageParts` at line 729-732), while taskboard attachments are uploaded to sandbox filesystem.

**Consequences:**
- Attachments silently dropped
- Error toast "taskboard_error_attachment_upload_failed" with no recovery
- Partial attachment state (some uploaded, some not)

**Prevention:**
1. Unify attachment handling into a single service that knows about both paths
2. Implement attachment transfer protocol that converts between formats
3. Add explicit "attachment ready" state before allowing send
4. Use the existing `loadingAttachmentIds` pattern (line 205) to block sends during transfer

**Detection (warning signs):**
- `chatState.loadingAttachmentIds.size === 0` check passing but attachments missing
- `workspacePath` being undefined when attachments exist
- Toast errors appearing after successful-looking sends

**Phase to address:** Phase 2 (Core Redirection) - Must handle before any attachment-bearing redirects

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 4: Event Emitter Listener Leak on Redirect

**What goes wrong:** The taskboard uses event emitters (`emitter.on(EventNames.CHAT_FINISHED, ...)` at line 410) to coordinate with chat completion. When input is redirected mid-execution, listeners may not be properly cleaned up, causing:
- Multiple handlers firing for single events
- Memory leaks from accumulated listeners
- Stale closures capturing old state

**Why it happens:** The cleanup pattern (`offChatFinished()` at line 472) is in a `finally` block, but redirection may bypass the normal execution flow.

**Prevention:**
1. Use WeakRef or explicit listener tracking for redirect scenarios
2. Implement a "redirect cleanup" phase that runs before any redirection
3. Add listener count assertions in development mode
4. Consider using Svelte's `$effect` cleanup pattern instead of manual event management

**Detection (warning signs):**
- `[TaskBoard] CHAT_FINISHED event received` logging multiple times
- Memory usage growing over session lifetime
- `#taskResolve` being non-null when it should be null

**Phase to address:** Phase 3 (Integration) - Can be addressed during integration testing

---

### Pitfall 5: Persisted State Hydration Race

**What goes wrong:** The `PersistedState` pattern uses async hydration (`isHydrated` checks at lines 113, 134, 165). When redirecting input immediately after tab creation or reload, the persisted state may not be hydrated yet, causing:
- Redirected input being lost
- Default values overwriting redirected content
- Inconsistent state between UI and storage

**Why it happens:** The hydration check interval (lines 260-276) runs every 50ms with a 5-second timeout. Redirection logic may execute before hydration completes.

**Prevention:**
1. Add explicit hydration wait before any redirection
2. Use the existing `syncPersistedStatesToChat()` pattern (lines 295-303) as a template
3. Queue redirections until `persistedChatParamsState.isHydrated` is true
4. Add hydration status to redirect precondition checks

**Detection (warning signs):**
- Redirected content appearing then disappearing
- `[ChatState] Applied Vibe default model` log appearing after redirect
- Storage showing different content than UI

**Phase to address:** Phase 1 (Foundation) - Must be considered in initial architecture

---

### Pitfall 6: Taskboard Status State Machine Violation

**What goes wrong:** The taskboard has a state machine with states: `idle`, `running`, `waiting_to_stop`, `waiting_for_chat` (line 30). Redirection may put the state machine in an invalid state by:
- Setting `running` when chat is already streaming
- Transitioning from `waiting_for_chat` without proper resolution
- Leaving `currentExecutingTaskId` set after redirect cancellation

**Why it happens:** The state machine transitions are spread across multiple methods (`startAutoExecution`, `#executeLoop`, `#executeTask`) and assume linear execution flow.

**Prevention:**
1. Centralize state machine transitions into a single method
2. Add state transition validation (assert valid from->to pairs)
3. Implement a "reset to idle" method that properly cleans up all related state
4. Add state machine diagram to documentation

**Detection (warning signs):**
- `buttonText` derived state showing wrong label
- `canStart` being true when it shouldn't be
- Tasks stuck in `in_progress` status

**Phase to address:** Phase 2 (Core Redirection) - Must be addressed when implementing redirect triggers

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 7: Input Focus Loss on Redirect

**What goes wrong:** When redirecting input, focus may jump unexpectedly between the chat input and taskboard input, causing:
- User typing going to wrong input
- Keyboard shortcuts triggering on wrong element
- Accessibility issues with screen readers

**Why it happens:** Both inputs have `focusInput()` logic that runs on various events (visibility change, window focus, session change). Redirection may trigger these focus handlers.

**Prevention:**
1. Add a "redirect in progress" flag that suppresses auto-focus
2. Explicitly manage focus as part of redirect flow
3. Use `requestAnimationFrame` to ensure DOM is stable before focus change

**Detection (warning signs):**
- User complaints about "cursor jumping"
- Keyboard shortcut `sendMessage` firing on wrong input
- `document.activeElement` not matching expected input

**Phase to address:** Phase 3 (Integration) - Polish item for UX refinement

---

### Pitfall 8: Composition Event Handling During Redirect

**What goes wrong:** The existing code has IME composition handling (`compositionEndTime` at line 48 in chat-input-box.svelte) to prevent accidental sends during Chinese/Japanese input. Redirection during composition may:
- Send partial composed text
- Lose composition state
- Trigger double-send on composition end

**Why it happens:** Composition events are input-element-specific. Redirecting to a different input element loses the composition context.

**Prevention:**
1. Check `isComposing` state before any redirect
2. Wait for composition to complete before redirecting
3. Transfer composition state if possible, or cancel gracefully

**Detection (warning signs):**
- Garbled text in messages when using IME
- `isInCompositionCooldown()` returning unexpected values
- Mac users reporting send issues more than Windows users

**Phase to address:** Phase 3 (Integration) - Internationalization polish

---

### Pitfall 9: Repeat Count State Confusion

**What goes wrong:** The taskboard has a `repeatCount` state (line 36) that determines how many times a task executes. When redirecting from chat input (which has no repeat concept), the repeat count may:
- Use stale value from previous task
- Default to unexpected value
- Cause task to run multiple times unintentionally

**Why it happens:** `repeatCount` is initialized to 1 but persists across task additions. Redirect logic may not reset it.

**Prevention:**
1. Always reset `repeatCount` to 1 when redirecting from chat input
2. Make repeat count explicit in redirect payload
3. Add UI indication of current repeat count during redirect

**Detection (warning signs):**
- Tasks running more times than expected
- `executedCount` not matching user expectation
- Confusion in task completion notifications

**Phase to address:** Phase 2 (Core Redirection) - Part of redirect payload design

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Input source authority | Dual state desync (#1) | Single source of truth pattern |
| Stream interruption | Abort race condition (#2) | Stream lock + queue pattern |
| Attachment handling | Upload timing (#3) | Unified attachment service |
| Event coordination | Listener leak (#4) | Explicit cleanup protocol |
| State persistence | Hydration race (#5) | Hydration wait guards |
| Taskboard integration | State machine violation (#6) | Centralized transitions |
| UX polish | Focus management (#7) | Redirect-aware focus |
| i18n support | Composition handling (#8) | Composition state checks |
| Task configuration | Repeat count (#9) | Explicit reset on redirect |

## Integration Pitfalls with Existing System

### Existing Pattern: AbortController for Background Tasks

The codebase already uses AbortController for suggestions and title generation (lines 198-255 in chat-state.svelte.ts). **Do not** create a separate abort mechanism for redirects - extend the existing pattern.

### Existing Pattern: Event-Based Coordination

The taskboard uses `emitter.emit(EventNames.CHAT_FINISHED, ...)` for coordination. **Do** use this pattern for redirect events rather than creating new coordination mechanisms.

### Existing Pattern: Derived State Guards

The codebase uses derived states like `sendMessageEnabled`, `canStart`, `isStreaming` as guards. **Do** add new derived states for redirect eligibility rather than inline checks.

### Existing Pattern: Match Expression for State Handling

The codebase uses `ts-pattern` match expressions for state-dependent logic (e.g., `startAutoExecution` at lines 313-344). **Do** follow this pattern for redirect state handling.

## Sources

- Codebase analysis: `/src/lib/stores/chat-state.svelte.ts`
- Codebase analysis: `/src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts`
- Codebase analysis: `/src/lib/transport/dynamic-chat-transport.ts`
- Codebase analysis: `/src/routes/(with-sidebar)/chat/components/chat-input/chat-input-box.svelte`
- Codebase analysis: `/src/lib/components/buss/taskboard/taskboard-input.svelte`
- [OpenAI Community: Apps SDK state management flaws](https://community.openai.com/t/apps-sdk-state-management-flaws/1371808)
- [OpenAI Community: Handling aborted tool calls](https://community.openai.com/t/how-to-safely-handle-aborted-tool-calls-when-using-openai-conversations-api/1372554)
- [Vercel AI SDK: Stream Text](https://ai-sdk.dev/cookbook/rsc/stream-text)
