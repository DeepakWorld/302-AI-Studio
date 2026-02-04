# Research Summary: Streaming Input to Taskboard

**Project:** 302-AI-Studio v1.1
**Domain:** Vibe Mode Input Redirection During AI Streaming
**Researched:** 2026-02-04
**Confidence:** HIGH

---

## Executive Summary

The streaming input redirection feature allows users to add tasks to the taskboard while AI is streaming output in Vibe Mode. Research confirms this is a **low-medium complexity feature** requiring **no new dependencies** — all infrastructure exists in the codebase.

**Key finding:** This is primarily an orchestration feature. The existing `chatState.isStreaming`, `codeAgentTaskboardState.addTaskFromInput()`, and `svelte-sonner` toast system provide all required capabilities.

---

## Key Findings

### Stack (No Additions Needed)

All required APIs already exist:
- **Streaming detection:** `chatState.isStreaming` (Vercel AI SDK v6)
- **Task addition:** `codeAgentTaskboardState.addTaskFromInput()`
- **Attachment upload:** `uploadAttachments()` in taskboard API
- **Toast notifications:** `svelte-sonner` v1.0.5

**Integration point:** `handleSendMessage()` in `chat-input-box.svelte` (line 134)

### Features

**Table Stakes:**
- Input remains active during streaming
- Automatic task creation from input
- Toast notification confirming action
- Input cleared after adding
- Attachment handling (upload to sandbox, reference path)

**Differentiators:**
- Seamless mode transition (same input box)
- Undo capability in toast
- Task count badge during streaming

**Anti-Features (avoid):**
- Separate "queue input" UI
- Modal confirmation dialog
- Blocking attachment upload

### Architecture

**Data Flow:**
```
User types → chatState.inputValue
User presses Enter → handleSendMessage()
  → Check shouldRedirectToTaskboard
  → If streaming in Vibe Mode:
      → Upload attachments to sandbox
      → Add task via codeAgentTaskboardState
      → Show toast notification
      → Clear chat input
```

**New derived state needed:**
```typescript
shouldRedirectToTaskboard = $derived(
  codeAgentState.enabled &&
  codeAgentState.inCodeAgentMode &&
  (chatState.isStreaming || chatState.isSubmitted)
);
```

### Critical Pitfalls

1. **Dual input state desync** — Chat and taskboard have separate `inputValue` states
2. **Stream abort race condition** — Redirecting while stream active can corrupt messages
3. **Attachment upload timing** — Chat attachments use different upload path than taskboard

**Prevention:** Create `addTaskFromChatInput(content, attachments)` method that handles transfer cleanly.

---

## Implications for Roadmap

### Recommended Phase Structure

**Phase 1: Core Redirection** (Low complexity)
- Add `shouldRedirectToTaskboard` derived state
- Add `addTaskFromChatInput()` method to taskboard state
- Modify `handleSendMessage()` to check redirection
- Show toast notification
- Clear input after adding

**Phase 2: Attachment Handling** (Medium complexity)
- Transfer chat attachments to taskboard
- Upload to sandbox if initialized
- Reference paths in task content
- Handle pending attachment queue

### Phase Ordering Rationale

1. Core redirection first — provides immediate value
2. Attachment handling second — builds on core but has edge cases

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Stack | HIGH | All APIs verified in codebase |
| Features | HIGH | Established pattern in Claude Code, Cursor |
| Architecture | HIGH | Direct codebase analysis |
| Pitfalls | HIGH | Identified from existing state patterns |

---

## i18n Keys to Add

```json
{
  "taskboard_task_added": "Task added to taskboard",
  "taskboard_task_added_with_attachments": "Task added with {count} attachment(s)"
}
```

---

## Sources

- `/src/lib/stores/chat-state.svelte.ts` — Streaming state
- `/src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts` — Taskboard state
- `/src/routes/(with-sidebar)/chat/components/chat-input/chat-input-box.svelte` — Input component
- `/src/lib/api/taskboard/index.ts` — Upload API
- Claude Code GitHub issues — UX patterns

---

*Research completed: 2026-02-04*
*Ready for requirements definition: yes*
