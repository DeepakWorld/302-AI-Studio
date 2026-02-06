# Architecture Patterns: Streaming Input Redirection

**Domain:** Streaming input redirection for Vibe Mode taskboard
**Researched:** 2026-02-04
**Confidence:** HIGH (based on direct codebase analysis)

## Executive Summary

This document analyzes how streaming input redirection should integrate with the existing 302-AI-Studio chat/taskboard architecture. The feature allows users to type new tasks while AI is streaming, redirecting input to the taskboard instead of blocking it.

## Current Architecture Overview

### State Management Hierarchy

```
chatState (singleton)
    |-- isStreaming: $derived(chat.status === "streaming")
    |-- isSubmitted: $derived(chat.status === "submitted")
    |-- inputValue: string (persisted)
    |-- sendMessage(): async function
    |-- stopGeneration(): function

codeAgentState (singleton)
    |-- enabled: $derived (from persisted config)
    |-- inCodeAgentMode: $derived(!isFreshTab && enabled)
    |-- isFreshTab: $derived(!chatState.hasMessages)

codeAgentTaskboardState (singleton)
    |-- inputValue: $state("")
    |-- attachments: $state<AttachmentFile[]>([])
    |-- taskboardStatus: "idle" | "running" | "waiting_to_stop" | "waiting_for_chat"
    |-- addTaskFromInput(): function
    |-- tasklist: Task[]
```

### Key Derived States

| State | Location | Derivation |
|-------|----------|------------|
| `isStreaming` | chatState | `chat.status === "streaming"` |
| `isSubmitted` | chatState | `chat.status === "submitted"` |
| `sendMessageEnabled` | chatState | Complex: has content + model + not streaming + not submitted |
| `inCodeAgentMode` | codeAgentState | `!isFreshTab && enabled` |
| `showTaskboardStatusBar` | taskboardState | Has in_progress or pending tasks |

### Component Hierarchy

```
chat-input-box.svelte (main input)
    |-- ChatInputBoxHeader
    |-- Textarea (binds to chatState.inputValue)
    |-- ChatActions
    |-- ModelSelect
    |-- SendMessageButton / standard button
    |-- StreamingIndicator (shows stop button when streaming)

taskboard-input.svelte (taskboard input)
    |-- Textarea (binds to codeAgentTaskboardState.inputValue)
    |-- Attachment handling
    |-- Add button -> addTaskFromInput()

taskboard-status-bar.svelte (status display)
    |-- Shows active task
    |-- Play/Pause controls
```

## Integration Points

### 1. Input Redirection Decision Point

**Location:** `chat-input-box.svelte` lines 134-189

**Current Flow:**
```typescript
async function handleSendMessage() {
    if (!chatState.sendMessageEnabled) return;  // <-- Blocks during streaming
    // ... validation and send logic
}
```

**Integration Point:** The `sendMessageEnabled` derived state currently blocks input during streaming. The redirection logic should intercept BEFORE this check.

### 2. Streaming State Detection

**Location:** `chatState` lines 447-449

```typescript
isStreaming = $derived(chat.status === "streaming");
isSubmitted = $derived(chat.status === "submitted");
```

**Integration Point:** These states are the authoritative source for "is AI currently responding". Use these for redirection decisions.

### 3. Taskboard Input API

**Location:** `codeAgentTaskboardState` lines 114-131

```typescript
addTaskFromInput() {
    if (this.inputValue.trim() || this.attachments.length > 0) {
        if (this.inputValue.trim()) {
            const newTask: Task = {
                id: nanoid(),
                content: this.inputValue.trim(),
                status: "pending",
                number: Math.min(99, Math.max(1, this.repeatCount)),
                executedCount: 0,
            };
            this.updateTasklist([...this.tasklist, newTask]);
        }
        this.inputValue = "";
        this.attachments = [];
        this.repeatCount = 1;
    }
}
```

**Integration Point:** This is the target API for redirected input. It handles task creation and state cleanup.

### 4. Mode Detection

**Location:** `codeAgentState` lines 72-73

```typescript
isFreshTab = $derived(!chatState.hasMessages);
inCodeAgentMode = $derived(!this.isFreshTab && this.enabled);
```

**Integration Point:** Redirection should only occur when:
- `codeAgentState.enabled === true` (Vibe Mode on)
- `codeAgentState.inCodeAgentMode === true` (has messages, not fresh)
- `chatState.isStreaming === true` (AI is responding)

## Recommended Architecture

### New Components Needed

| Component | Purpose | Location |
|-----------|---------|----------|
| None | Reuse existing components | - |

### Modified Components

| Component | Modification | Complexity |
|-----------|--------------|------------|
| `chat-input-box.svelte` | Add redirection logic in handleSendMessage | Low |
| `chatState` | Add `shouldRedirectToTaskboard` derived state | Low |
| `codeAgentTaskboardState` | Add `addTaskFromChatInput(content, attachments)` method | Low |

### New Derived State

```typescript
// In chatState or as standalone
shouldRedirectToTaskboard = $derived(
    codeAgentState.enabled &&
    codeAgentState.inCodeAgentMode &&
    (chatState.isStreaming || chatState.isSubmitted)
);
```

### Data Flow Changes

**Current Flow (Blocked):**
```
User types -> chatState.inputValue
User presses Enter -> handleSendMessage()
    -> sendMessageEnabled check FAILS (streaming)
    -> Nothing happens
```

**New Flow (Redirected):**
```
User types -> chatState.inputValue
User presses Enter -> handleSendMessage()
    -> Check shouldRedirectToTaskboard FIRST
    -> If true:
        -> Copy chatState.inputValue to taskboard
        -> Copy chatState.attachments to taskboard
        -> Call codeAgentTaskboardState.addTaskFromInput()
        -> Clear chatState.inputValue and attachments
        -> Show toast notification
    -> If false:
        -> Continue with existing sendMessageEnabled check
```

## Component Boundaries

### State Ownership

| Data | Owner | Consumers |
|------|-------|-----------|
| `inputValue` (chat) | `chatState` | `chat-input-box.svelte` |
| `inputValue` (taskboard) | `codeAgentTaskboardState` | `taskboard-input.svelte` |
| `isStreaming` | `chatState` (via Chat) | Multiple components |
| `shouldRedirectToTaskboard` | NEW in `chatState` | `chat-input-box.svelte` |

### Event Flow

```
handleSendMessage() [chat-input-box.svelte]
    |
    v
shouldRedirectToTaskboard? [chatState derived]
    |
    +-- YES --> addTaskFromChatInput() [codeAgentTaskboardState]
    |               |
    |               v
    |           updateTasklist() --> Backend sync
    |               |
    |               v
    |           Clear chat input state
    |               |
    |               v
    |           Toast notification
    |
    +-- NO --> Existing sendMessage flow
```

## Suggested Build Order

### Phase 1: Core Redirection Logic (Foundation)

1. **Add derived state** `shouldRedirectToTaskboard` to `chatState`
   - Dependencies: `codeAgentState.enabled`, `codeAgentState.inCodeAgentMode`, `chatState.isStreaming`
   - Risk: Low - pure derived state, no side effects

2. **Add method** `addTaskFromChatInput(content, attachments)` to `codeAgentTaskboardState`
   - Similar to existing `addTaskFromInput()` but accepts parameters
   - Risk: Low - follows existing pattern

### Phase 2: Input Component Integration

3. **Modify** `handleSendMessage()` in `chat-input-box.svelte`
   - Add redirection check at the TOP of the function
   - Call new taskboard method when redirecting
   - Clear chat input state after redirect
   - Risk: Medium - touches critical send path

### Phase 3: User Feedback

4. **Add toast notification** for successful redirection
   - Use existing `svelte-sonner` toast system
   - i18n message for "Task added to queue"
   - Risk: Low - UI only

### Phase 4: Edge Cases

5. **Handle attachment transfer**
   - Transfer `chatState.attachments` to taskboard
   - Consider pending attachment uploads
   - Risk: Medium - attachment state is complex

6. **Handle keyboard shortcuts**
   - Ensure Enter key redirection works via `onShortcutAction`
   - Risk: Low - existing shortcut system handles this

## Anti-Patterns to Avoid

### 1. Duplicating Streaming Detection

**Bad:**
```typescript
// In chat-input-box.svelte
const isStreaming = $derived(chat.status === "streaming");
```

**Good:**
```typescript
// Use existing chatState.isStreaming
if (chatState.isStreaming) { ... }
```

### 2. Direct State Mutation Across Boundaries

**Bad:**
```typescript
// In chat-input-box.svelte
codeAgentTaskboardState.inputValue = chatState.inputValue;
codeAgentTaskboardState.addTaskFromInput();
```

**Good:**
```typescript
// Use dedicated method
codeAgentTaskboardState.addTaskFromChatInput(
    chatState.inputValue,
    chatState.attachments
);
```

### 3. Blocking UI During Redirection

**Bad:**
```typescript
async function handleSendMessage() {
    if (shouldRedirectToTaskboard) {
        await uploadAttachments(); // Blocks UI
        await addTask();
    }
}
```

**Good:**
```typescript
function handleSendMessage() {
    if (shouldRedirectToTaskboard) {
        // Synchronous task creation
        codeAgentTaskboardState.addTaskFromChatInput(...);
        // Async upload happens in background
    }
}
```

## Scalability Considerations

| Concern | Current Scale | At Scale | Mitigation |
|---------|---------------|----------|------------|
| Task queue size | ~10 tasks | 100+ tasks | Already handled by backend pagination |
| Attachment transfer | Immediate | Large files | Use pending attachment queue pattern |
| State sync | Synchronous | High frequency | Debounce taskboard updates |

## Integration Test Scenarios

1. **Basic redirection:** Type while streaming -> task appears in queue
2. **Attachment transfer:** Paste image while streaming -> attachment in task
3. **Mode boundary:** Disable Vibe Mode while streaming -> no redirection
4. **Fresh tab:** First message in new tab -> no redirection (not inCodeAgentMode)
5. **Rapid input:** Multiple Enter presses while streaming -> multiple tasks

## Sources

- Direct codebase analysis of:
  - `/src/lib/stores/chat-state.svelte.ts`
  - `/src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts`
  - `/src/lib/stores/code-agent/code-agent-state.svelte.ts`
  - `/src/routes/(with-sidebar)/chat/components/chat-input/chat-input-box.svelte`
  - `/src/lib/components/buss/taskboard/taskboard-input.svelte`
