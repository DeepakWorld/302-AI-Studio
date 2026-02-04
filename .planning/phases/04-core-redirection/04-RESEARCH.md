# Phase 4: Core Redirection - Research

**Researched:** 2026-02-04
**Domain:** Svelte 5 State Management / Chat Input Redirection
**Confidence:** HIGH

## Summary

This phase implements the core redirection feature that allows users to add tasks to the taskboard while AI is streaming in Vibe Mode. Research confirms this is a **low complexity feature** requiring **no new dependencies** - all infrastructure exists in the codebase.

The implementation involves three key modifications:
1. Adding a derived state `shouldRedirectToTaskboard` to detect when redirection should occur
2. Adding a method `addTaskFromChatInput()` to the taskboard state for clean input transfer
3. Modifying `handleSendMessage()` in chat-input-box.svelte to check redirection before sending

**Primary recommendation:** Implement redirection logic at the `handleSendMessage()` level in chat-input-box.svelte, using existing taskboard state methods and toast notifications.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 5 | 5.38.10 | Reactive state with runes | Project standard, `$derived` for computed state |
| svelte-sonner | 1.0.5 | Toast notifications | Already used throughout codebase |
| nanoid | (bundled) | Task ID generation | Already used in taskboard state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ts-pattern | (bundled) | Pattern matching | Already used in taskboard state for status matching |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Derived state | Manual check in handler | Derived is cleaner, reactive, testable |
| Toast notification | Modal dialog | Toast is non-blocking, matches UX pattern |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/stores/
├── chat-state.svelte.ts           # isStreaming, isSubmitted states
├── code-agent/
│   ├── code-agent-state.svelte.ts # enabled, inCodeAgentMode states
│   └── code-agent-taskboard-state.svelte.ts  # ADD: addTaskFromChatInput()
```

### Pattern 1: Derived State for Redirection Detection
**What:** Use `$derived` to compute when redirection should occur
**When to use:** When multiple conditions must be checked reactively
**Example:**
```typescript
// Source: Existing pattern in code-agent-state.svelte.ts line 72-73
// isFreshTab = $derived(!chatState.hasMessages);
// inCodeAgentMode = $derived(!this.isFreshTab && this.enabled);

// New derived state for redirection
shouldRedirectToTaskboard = $derived(
  codeAgentState.enabled &&
  codeAgentState.inCodeAgentMode &&
  (chatState.isStreaming || chatState.isSubmitted)
);
```

### Pattern 2: State Transfer Method
**What:** Dedicated method to transfer chat input to taskboard
**When to use:** When moving data between state stores with cleanup
**Example:**
```typescript
// Source: Pattern from addTaskFromInput() in code-agent-taskboard-state.svelte.ts line 114-131
addTaskFromChatInput(content: string, attachments: AttachmentFile[]): void {
  if (content.trim()) {
    const newTask: Task = {
      id: nanoid(),
      content: content.trim(),
      status: "pending",
      number: 1,
      executedCount: 0,
    };
    const updatedTasklist = [...this.tasklist, newTask];
    this.updateTasklist(updatedTasklist);
  }
  // Note: Attachments handled in Phase 5
}
```

### Pattern 3: Toast Notification with i18n
**What:** Show toast confirmation using paraglide messages
**When to use:** User feedback for async operations
**Example:**
```typescript
// Source: Pattern from chat-state.svelte.ts line 1149
import { toast } from "svelte-sonner";
import { m } from "$lib/paraglide/messages.js";

toast.success(m.taskboard_task_added());
```

### Anti-Patterns to Avoid
- **Modifying chatState.sendMessage():** Keep redirection logic in UI layer (chat-input-box.svelte)
- **Blocking attachment upload:** Phase 4 focuses on text-only; attachments are Phase 5
- **Modal confirmation:** Use non-blocking toast, not modal dialog

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task ID generation | Custom UUID | `nanoid()` | Already used in taskboard, consistent IDs |
| Toast notifications | Custom notification system | `svelte-sonner` | Already integrated, styled |
| i18n messages | Hardcoded strings | `m.taskboard_*()` | Existing pattern, supports zh/en |
| Streaming detection | Manual status check | `chatState.isStreaming` | Already computed from chat.status |

**Key insight:** All required infrastructure exists. This is purely an orchestration feature connecting existing capabilities.

## Common Pitfalls

### Pitfall 1: Dual Input State Desync
**What goes wrong:** Chat and taskboard have separate `inputValue` states that can get out of sync
**Why it happens:** Forgetting to clear chat input after adding to taskboard
**How to avoid:** Always clear `chatState.inputValue` and `chatState.attachments` after successful task addition
**Warning signs:** Input remains after task is added, duplicate tasks created

### Pitfall 2: Checking Wrong Streaming State
**What goes wrong:** Using only `isStreaming` misses the `submitted` state before streaming starts
**Why it happens:** AI SDK has `submitted` -> `streaming` -> `ready` lifecycle
**How to avoid:** Check both `chatState.isStreaming || chatState.isSubmitted`
**Warning signs:** Redirection doesn't trigger immediately after user sends message

### Pitfall 3: Redirection in Fresh Tab
**What goes wrong:** Attempting to redirect when no sandbox exists yet
**Why it happens:** `inCodeAgentMode` is false for fresh tabs (no messages yet)
**How to avoid:** Use `codeAgentState.inCodeAgentMode` which already checks `!isFreshTab && enabled`
**Warning signs:** Redirection triggers on first message in new Vibe session

### Pitfall 4: Missing sendMessageEnabled Check
**What goes wrong:** Redirection bypasses validation that normal send uses
**Why it happens:** Forgetting that `handleSendMessage()` already checks `sendMessageEnabled`
**How to avoid:** Add redirection check AFTER `sendMessageEnabled` check passes
**Warning signs:** Empty tasks added, tasks added without model selected

## Code Examples

Verified patterns from codebase analysis:

### Checking Streaming State
```typescript
// Source: chat-state.svelte.ts line 447-450
isStreaming = $derived(chat.status === "streaming");
isSubmitted = $derived(chat.status === "submitted");
isReady = $derived(chat.status === "ready");
isError = $derived(chat.status === "error");
```

### Adding Task to Taskboard
```typescript
// Source: code-agent-taskboard-state.svelte.ts line 114-131
addTaskFromInput() {
  if (this.inputValue.trim() || this.attachments.length > 0) {
    if (this.inputValue.trim()) {
      const newTask: Task = {
        id: nanoid(),
        content: this.inputValue.trim(),
        status: "pending",
        number: Math.min(99, Math.max(1, Number.parseInt(`${this.repeatCount}`, 10) || 1)),
        executedCount: 0,
      };
      const updatedTasklist = [...this.tasklist, newTask];
      this.updateTasklist(updatedTasklist);
    }
    this.inputValue = "";
    this.attachments = [];
    this.repeatCount = 1;
  }
}
```

### Toast Notification Pattern
```typescript
// Source: chat-state.svelte.ts line 1149
toast.success(m.toast_title_generation_success());

// Source: code-agent-taskboard-state.svelte.ts line 223
toast.error(m.taskboard_error_attachment_upload_failed());
```

### handleSendMessage Integration Point
```typescript
// Source: chat-input-box.svelte line 134-189
async function handleSendMessage() {
  // Line 136-138: Early return if not enabled
  if (!chatState.sendMessageEnabled) {
    return;
  }

  // Line 140-182: Pattern matching for validation
  const fn = () =>
    match({
      isEmpty: chatState.inputValue.trim() === "" && chatState.attachments.length === 0,
      noProviders: !hasConfiguredProviders(),
      noModel: chatState.selectedModel === null,
    })
    // ... validation cases ...
    .otherwise(() => {
      // THIS IS WHERE REDIRECTION CHECK SHOULD GO
      // Before calling chatState.sendMessage()
      if (chatState.hasMessages) {
        chatState.sendMessage();
      } else {
        document.startViewTransition(() => chatState.sendMessage());
      }
    });

  // Line 184-188: Code agent flow handling
  if (codeAgentState.enabled && codeAgentState.isFreshTab) {
    await codeAgentSendMessageButtonState.handleCodeAgentFlow(fn);
  } else {
    fn();
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte stores | Svelte 5 runes (`$state`, `$derived`) | Svelte 5 | Use class-based state with runes |
| Manual reactivity | `$derived` computed state | Svelte 5 | Automatic dependency tracking |

**Deprecated/outdated:**
- Svelte 4 stores: Project uses Svelte 5 runes exclusively

## Open Questions

Things that couldn't be fully resolved:

1. **Attachment handling during redirection**
   - What we know: Chat attachments use different upload path than taskboard
   - What's unclear: Exact transfer mechanism for attachments
   - Recommendation: Defer to Phase 5 (Attachment Handling), focus on text-only in Phase 4

## Sources

### Primary (HIGH confidence)
- `/src/lib/stores/chat-state.svelte.ts` - Streaming state, input management
- `/src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts` - Task addition patterns
- `/src/lib/stores/code-agent/code-agent-state.svelte.ts` - Mode detection patterns
- `/src/routes/(with-sidebar)/chat/components/chat-input/chat-input-box.svelte` - Integration point

### Secondary (MEDIUM confidence)
- `/messages/en.json`, `/messages/zh.json` - Existing i18n patterns for taskboard

### Tertiary (LOW confidence)
- None - all findings verified from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All APIs verified in codebase
- Architecture: HIGH - Direct codebase analysis, existing patterns
- Pitfalls: HIGH - Identified from existing state patterns and lifecycle

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (30 days - stable patterns)
