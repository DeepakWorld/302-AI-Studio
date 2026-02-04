# Feature Landscape: Streaming Input Redirection to Taskboard

**Domain:** AI Chat Application - Vibe Mode Input Redirection
**Researched:** 2026-02-04
**Focus:** Streaming input redirection from chat to taskboard

## Context

This research focuses on the streaming input redirection feature for 302-AI-Studio's Vibe Mode. When AI is actively streaming a response, user input in the chat box should be redirected to the taskboard as a queued task instead of being blocked or lost.

**Existing Features (Already Built):**
- Vibe Mode with Claude Code sandbox
- Taskboard with manual task input (`taskboard-input.svelte`)
- AI task decomposition
- File attachment upload to sandbox
- Toast notifications via `svelte-sonner`

---

## Table Stakes

Features users expect. Missing = feature feels incomplete or broken.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Input field remains active during streaming** | Users expect to type ahead while AI works (established pattern in Claude Code, Cursor) | Low | `chatState.isStreaming` | Currently input is disabled during streaming |
| **Visual indicator of redirection mode** | Users must know their input goes to taskboard, not chat | Low | None | Placeholder text change, subtle UI shift |
| **Automatic task creation from input** | Core feature - input becomes task | Medium | `codeAgentTaskboardState.addTaskFromInput()` | Reuse existing taskboard input logic |
| **Input cleared after task added** | Standard form behavior | Low | None | Already implemented in taskboard |
| **Toast notification confirming action** | User needs feedback that input was redirected | Low | `svelte-sonner` | "Task added to queue" message |
| **Attachment handling during redirection** | Files should upload to sandbox and reference in task | Medium | `uploadAttachments()`, sandbox API | Must handle sandbox not-yet-initialized case |
| **Keyboard shortcut works (Enter to add)** | Consistent with normal send behavior | Low | `shortcutSettings` | Reuse existing shortcut infrastructure |

### Table Stakes Rationale

The "queue next message" pattern is established in AI coding assistants:
- **Claude Code VSCode Extension**: Allows typing in "Queue next message" field while Claude processes
- **Cursor IDE**: Maintains input availability during generation
- **Windsurf**: Similar queue-ahead pattern

Users familiar with these tools expect input to remain functional during AI streaming.

---

## Differentiators

Features that set this implementation apart. Not expected, but add significant value.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Seamless mode transition** | No jarring UI change - same input box, different destination | Medium | State management | Better than showing separate input |
| **Attachment preview in toast** | Show what files were uploaded with task | Low | Toast customization | Confirms file handling worked |
| **Undo capability** | Allow removing just-added task from toast action | Medium | Task deletion API | "Undo" button in toast notification |
| **Task count badge** | Show pending task count near input during streaming | Low | `codeAgentTaskboardState.tasklist` | Visual queue depth indicator |
| **Smart placeholder text** | Context-aware placeholder: "Add task to queue..." | Low | Derived state | Guides user behavior |
| **Repeat count preservation** | Remember repeat count setting between redirected inputs | Low | State persistence | Convenience for batch operations |
| **Pending attachments queue** | Handle attachments when sandbox not yet initialized | Medium | `pendingAttachments` state | Already partially implemented |

### Differentiator Rationale

The seamless transition is key - users shouldn't feel like they're using a "degraded mode" during streaming. The input should feel natural and continuous.

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Separate "queue input" UI** | Adds cognitive load, breaks flow | Use same input box with mode indicator |
| **Modal confirmation dialog** | Interrupts typing flow, annoying | Use non-blocking toast notification |
| **Automatic task execution** | User may want to review queue first | Add to queue only, let user start execution |
| **Input focus stealing** | Breaks typing if focus moves unexpectedly | Maintain focus in input field |
| **Complex queue management UI** | Overcomplicates simple feature | Taskboard panel already handles queue management |
| **Blocking attachment upload** | Freezes UI during upload | Async upload with loading indicator |
| **Silent failure** | User doesn't know if task was added | Always show toast feedback |
| **Disabling input during streaming** | Loses user's typed content, frustrating | Keep input active, redirect to taskboard |

### Anti-Feature Rationale

The [Claude Code GitHub issue #10878](https://github.com/anthropics/claude-code/issues/10878) documents problems when modal dialogs interrupt queue input - users accidentally confirm dialogs while typing. Avoid any pattern that interrupts the typing flow.

---

## Feature Dependencies

```
Streaming Detection
       |
       v
Input Redirection Logic
       |
       +---> Task Creation (existing)
       |           |
       |           v
       |     Taskboard State Update
       |
       +---> Attachment Handling
       |           |
       |           v
       |     Sandbox Upload (if initialized)
       |           |
       |           v
       |     Pending Queue (if not initialized)
       |
       +---> Toast Notification
       |
       v
Input Clear + Focus Maintain
```

### Dependency Notes

1. **Streaming Detection**: `chatState.isStreaming` already exists
2. **Task Creation**: `codeAgentTaskboardState.addTaskFromInput()` already exists
3. **Attachment Handling**: `uploadAttachments()` and `pendingAttachments` already exist
4. **Toast**: `svelte-sonner` already integrated

Most infrastructure exists - this is primarily a **routing/orchestration** feature.

---

## MVP Recommendation

For MVP, prioritize these features in order:

### Must Have (Phase 1)
1. **Input remains active during streaming** - Core UX improvement
2. **Visual mode indicator** - Placeholder text change to "Add task to queue..."
3. **Automatic task creation** - Redirect input to taskboard
4. **Toast notification** - Confirm task was added
5. **Input cleared after adding** - Standard form behavior

### Should Have (Phase 1 if time permits)
6. **Attachment handling** - Upload to sandbox, reference in task
7. **Keyboard shortcut (Enter)** - Consistent with normal behavior

### Defer to Post-MVP
- Undo capability in toast
- Task count badge
- Repeat count preservation
- Advanced pending attachments handling

---

## Implementation Considerations

### State Detection
```typescript
// Existing state to leverage
const shouldRedirectToTaskboard = $derived(
  codeAgentState.enabled &&           // In Vibe Mode
  codeAgentState.inCodeAgentMode &&   // Has active session
  (chatState.isStreaming || chatState.isSubmitted)  // AI is working
);
```

### Input Routing
The `chat-input-box.svelte` component's `handleSendMessage()` function needs conditional routing:
- If `shouldRedirectToTaskboard`: call taskboard add logic
- Otherwise: call normal `chatState.sendMessage()`

### Toast Message
```typescript
// Suggested toast pattern
toast.success(m.toast_task_added_to_queue(), {
  description: inputValue.slice(0, 50) + (inputValue.length > 50 ? '...' : ''),
  action: {
    label: m.text_undo(),
    onClick: () => codeAgentTaskboardState.removeTask(newTaskId)
  }
});
```

### Attachment Flow
1. Check if sandbox initialized (`claudeCodeSandboxState.currentSessionWorkspacePath`)
2. If yes: upload immediately, add path reference to task content
3. If no: add to `pendingAttachments` queue (existing mechanism)

---

## Complexity Assessment

| Component | Complexity | Rationale |
|-----------|------------|-----------|
| Streaming detection | Low | State already exists |
| Input routing logic | Low | Simple conditional |
| Task creation | Low | Reuse existing method |
| Toast notification | Low | Library already integrated |
| Placeholder text change | Low | Derived state |
| Attachment handling | Medium | Multiple code paths |
| Pending attachments | Medium | Edge cases with timing |
| Overall Feature | **Low-Medium** | Mostly orchestration |

---

## Sources

- [Claude Code GitHub Issue #10878](https://github.com/anthropics/claude-code/issues/10878) - Queue next message UX issues
- [Claude Code Tasks System](https://claudecode.jp/en/news/claude-code-tasks-system) - Parallel task workflow patterns
- [Shape of AI Patterns](https://www.shapeof.ai/patterns/cta) - AI UX patterns reference
- [Anthropic Claude Code](https://www.anthropic.com/claude-code) - Official Claude Code documentation
- Existing codebase analysis:
  - `/src/lib/stores/chat-state.svelte.ts` - Chat state management
  - `/src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts` - Taskboard state
  - `/src/routes/(with-sidebar)/chat/components/chat-input/chat-input-box.svelte` - Input component
  - `/src/lib/components/buss/taskboard/taskboard-input.svelte` - Taskboard input
