# Stack Research: Streaming Input to Taskboard (v1.1)

**Domain:** Input Redirection During AI Streaming
**Researched:** 2026-02-04
**Confidence:** HIGH
**Milestone:** v1.1 - Streaming Input to Taskboard

## Executive Summary

This feature requires **NO new dependencies**. The existing stack provides all necessary capabilities for streaming input redirection to taskboard. The implementation is purely a state coordination and UI flow change.

**Key finding:** All required APIs already exist in the codebase:
- Streaming detection via `chatState.isStreaming` (Vercel AI SDK v6)
- Taskboard task addition via `codeAgentTaskboardState.addTaskFromInput()`
- Attachment upload via `uploadAttachments()` API
- Toast notifications via `svelte-sonner`

## Recommended Stack

### Core Technologies (Already In Use)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| SvelteKit | 2.39.1 | Frontend framework | Already in use |
| Svelte 5 | 5.38.10 | Reactive UI with runes (`$state`, `$derived`) | Already in use |
| TypeScript | 5.9.2 | Type safety | Already in use |
| Vercel AI SDK | 6.0.1 | Chat streaming with status detection | Already in use |
| @ai-sdk/svelte | 4.0.1 | `Chat` class with `status` property | Already in use |
| svelte-sonner | 1.0.5 | Toast notifications | Already in use |

### Supporting Libraries (Already In Use)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | 5.1.5 | Generate unique task IDs | Task creation |
| ts-pattern | 5.9.0 | Pattern matching for flow control | Conditional logic |
| mitt | 3.0.1 | Event emitter (if needed) | Cross-component events |

## Stack Additions Required

**NONE.**

All required capabilities exist in the current stack. No new packages needed.

## Integration Points

### 1. Streaming State Detection

**Location:** `src/lib/stores/chat-state.svelte.ts` (line 447-449)

```typescript
// Already available - derived from Vercel AI SDK Chat status
isStreaming = $derived(chat.status === "streaming");
isSubmitted = $derived(chat.status === "submitted");
isReady = $derived(chat.status === "ready");
```

**Usage for feature:**
```typescript
// Check if input should redirect to taskboard
const shouldRedirectToTaskboard = codeAgentState.enabled &&
  (chatState.isStreaming || chatState.isSubmitted);
```

### 2. Vibe Mode Detection

**Location:** `src/lib/stores/code-agent/code-agent-state.svelte.ts`

```typescript
// Already available
codeAgentState.enabled  // boolean - true when in Vibe Mode
```

### 3. Taskboard Task Addition

**Location:** `src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts` (line 114-131)

```typescript
// Already available - adds task from input state
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

### 4. Attachment Upload

**Location:** `src/lib/api/taskboard/index.ts` (line 206-237)

```typescript
// Already available - uploads attachments to sandbox
export async function uploadAttachments(
  sandboxId: string,
  cwd: string,
  attachments: Attachment[],
): Promise<{ isOk: boolean }> {
  // Uploads to .302ai/attachments/ directory in sandbox
}
```

**Attachment path pattern:** `.302ai/attachments/{filename}`

### 5. Toast Notifications

**Location:** Throughout codebase via `svelte-sonner`

```typescript
import { toast } from "svelte-sonner";

// Success notification
toast.success(m.taskboard_task_added());  // i18n message key to add

// With action button (existing pattern)
toast.info(m.toast_no_provider_configured(), {
  action: {
    label: m.text_button_go_to_settings(),
    onClick: () => handleGoToModelSettings(),
  },
});
```

### 6. Input State Management

**Location:** `src/lib/stores/chat-state.svelte.ts`

```typescript
// Chat input state (source)
chatState.inputValue      // string
chatState.attachments     // AttachmentFile[]

// Taskboard input state (destination)
codeAgentTaskboardState.inputValue      // string
codeAgentTaskboardState.attachments     // AttachmentFile[]
```

## Implementation Approach

The feature is a **state coordination change**, not a technology addition:

### Flow Diagram

```
User types in chat input during streaming
         ↓
Check: codeAgentState.enabled && (chatState.isStreaming || chatState.isSubmitted)
         ↓
    [YES]                              [NO]
      ↓                                  ↓
Upload attachments to sandbox      Normal chat flow
      ↓
Copy input to taskboard state
      ↓
Call addTaskFromInput()
      ↓
Show toast notification
      ↓
Clear chat input
```

### Key Integration Point

**File:** `src/routes/(with-sidebar)/chat/components/chat-input/chat-input-box.svelte`

**Function:** `handleSendMessage()` (line 134-189)

This is where the redirection logic should be added, before the existing send flow.

## What NOT to Add

| Library | Why Not |
|---------|---------|
| Additional state management (Zustand, Redux) | Svelte 5 runes are sufficient |
| Event bus library (beyond mitt) | Direct state coordination is cleaner |
| Animation library | Toast already handles feedback animation |
| Form validation library | Simple input redirection doesn't need validation |
| Debounce/throttle library | `es-toolkit` already available if needed |
| Queue library | Single task addition doesn't need queuing |

## Alternatives Considered

| Approach | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Direct state coordination | ✓ | Event-based (mitt) | Adds indirection; state is already reactive |
| Toast notification | ✓ | Visual input box change | Toast is sufficient; less UI complexity |
| Immediate task addition | ✓ | Queue then batch add | Unnecessary complexity for single task |
| Path reference in task | ✓ | Embed attachment data | Task content is text; paths are cleaner |

## Version Compatibility

| Package | Version | Compatibility | Notes |
|---------|---------|---------------|-------|
| ai | 6.0.1 | ✓ Verified | `chat.status` property available |
| @ai-sdk/svelte | 4.0.1 | ✓ Verified | `Chat` class with status |
| svelte-sonner | 1.0.5 | ✓ Verified | Toast API stable |
| svelte | 5.38.10 | ✓ Verified | Runes (`$state`, `$derived`) work |

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Streaming detection | HIGH | Verified in `chat-state.svelte.ts` line 447 |
| Taskboard API | HIGH | Verified in `code-agent-taskboard-state.svelte.ts` |
| Attachment upload | HIGH | Verified in `src/lib/api/taskboard/index.ts` |
| Toast system | HIGH | Verified usage throughout codebase |
| No new deps needed | HIGH | All capabilities exist |

## i18n Keys to Add

New message keys needed in `messages/en.json` and `messages/zh.json`:

```json
{
  "taskboard_task_added": "Task added to taskboard",
  "taskboard_task_added_with_attachments": "Task added with {count} attachment(s)"
}
```

## Sources

- `/home/ai/code/buss/302-AI-Studio-SV/src/lib/stores/chat-state.svelte.ts` - Streaming state (line 447-449)
- `/home/ai/code/buss/302-AI-Studio-SV/src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts` - Taskboard state
- `/home/ai/code/buss/302-AI-Studio-SV/src/lib/api/taskboard/index.ts` - Upload API
- `/home/ai/code/buss/302-AI-Studio-SV/src/routes/(with-sidebar)/chat/components/chat-input/chat-input-box.svelte` - Input component
- `/home/ai/code/buss/302-AI-Studio-SV/package.json` - Dependency versions

---

**Stack research for:** v1.1 Streaming Input to Taskboard
**Researched:** 2026-02-04
**Next step:** Implement input redirection in `handleSendMessage()` function
