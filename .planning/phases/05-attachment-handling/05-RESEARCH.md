# Phase 5: Attachment Handling - Research

**Researched:** 2026-02-04
**Domain:** File upload to sandbox, attachment state management
**Confidence:** HIGH

## Summary

This phase implements attachment handling when chat input is redirected to the taskboard during AI streaming in Vibe Mode. The codebase already has comprehensive infrastructure for attachment uploads to sandbox environments, including the `uploadAttachments()` API, `pendingAttachments` pattern for deferred uploads, and `batchUploadFile()` for efficient multi-file uploads.

The key challenge is that when redirection occurs during streaming, the sandbox workspace path may or may not be available. The existing `pendingAttachments` pattern in `CodeAgentTaskboardState` provides the exact solution: queue attachments when sandbox is not ready, upload them when it becomes available.

**Primary recommendation:** Use the existing `pendingAttachments` pattern to queue chat attachments during redirection, then upload them when sandbox initializes. Modify `addTaskFromChatInput()` to accept attachments and include file references in task content.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Existing `uploadAttachments()` | N/A | Upload files to sandbox `.302ai/attachments/` | Already implemented, tested, handles batch uploads |
| Existing `batchUploadFile()` | N/A | Low-level batch file upload API | Used by all attachment upload flows |
| `fileToBase64()` utility | N/A | Convert File objects to base64 data URLs | Standard pattern in codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `AttachmentFile` type | N/A | Attachment data structure | All attachment operations |
| `Attachment` interface | N/A | Upload payload structure | When calling uploadAttachments() |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pendingAttachments pattern | Immediate upload with retry | Would fail if sandbox not ready; existing pattern handles this |
| Inline base64 in task content | File references | Base64 bloats task content; references are cleaner |

**Installation:**
```bash
# No new dependencies needed - all infrastructure exists
```

## Architecture Patterns

### Recommended Flow
```
User sends message during streaming
    ↓
shouldRedirectToTaskboard = true
    ↓
addTaskFromChatInput(content, attachments)
    ↓
┌─────────────────────────────────────────┐
│ Is sandbox workspace available?          │
│   YES → Upload immediately               │
│   NO  → Queue to pendingAttachments      │
└─────────────────────────────────────────┘
    ↓
Create task with attachment references in content
    ↓
Clear chatState.attachments
```

### Pattern 1: Attachment Reference in Task Content
**What:** Include uploaded file paths as references in task content
**When to use:** When attachments accompany a task
**Example:**
```typescript
// Source: Existing pattern in codebase
const ATTACHMENTS_DIR_PATH = ".302ai/attachments";

// Task content with attachment references
const attachmentRefs = attachments.map(att =>
  `[Attachment: ${ATTACHMENTS_DIR_PATH}/${att.name}]`
).join('\n');

const taskContent = attachmentRefs
  ? `${content}\n\n${attachmentRefs}`
  : content;
```

### Pattern 2: Pending Attachments Queue
**What:** Queue attachments when sandbox not ready, upload on initialization
**When to use:** When workspace path is not yet available
**Example:**
```typescript
// Source: code-agent-taskboard-state.svelte.ts lines 197-248
// Already implemented - just need to use it

// Queue attachments
codeAgentTaskboardState.addPendingAttachments(attachments);

// Later, when sandbox initializes (in enableCodeAgentFlow):
await codeAgentTaskboardState.uploadPendingAttachments(sandboxId, workspacePath);
```

### Pattern 3: Immediate Upload When Workspace Available
**What:** Upload directly if sandbox workspace path exists
**When to use:** When `claudeCodeSandboxState.currentSessionWorkspacePath` is available
**Example:**
```typescript
// Source: taskboard/index.ts uploadAttachments()
const workspacePath = claudeCodeSandboxState.currentSessionWorkspacePath;
if (workspacePath) {
  const attachmentList: Attachment[] = await Promise.all(
    attachments.map(async (att) => ({
      filename: att.name,
      content: att.file ? await fileToBase64(att.file) : "",
    }))
  );
  await uploadAttachments(sandboxId, workspacePath, attachmentList);
}
```

### Anti-Patterns to Avoid
- **Blocking on upload:** Don't wait for upload to complete before adding task - use async pattern
- **Losing attachments on error:** Always clear chatState.attachments only after successful queue/upload
- **Duplicate uploads:** Check if attachment already in pendingAttachments before adding

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File to base64 conversion | Custom FileReader logic | `fileToBase64()` from utils.ts | Handles edge cases, consistent format |
| Batch file upload | Multiple single uploads | `batchUploadFile()` API | Single request, better performance |
| Deferred upload queue | Custom queue system | `pendingAttachments` pattern | Already tested, integrated with sandbox init |
| Attachment path construction | Manual string concat | `ATTACHMENTS_DIR_PATH` constant | Consistent with existing code |

**Key insight:** The entire attachment upload infrastructure already exists. This phase is about wiring existing pieces together in the redirection flow.

## Common Pitfalls

### Pitfall 1: Workspace Path Not Available
**What goes wrong:** Attempting to upload when `currentSessionWorkspacePath` is empty
**Why it happens:** Sandbox not yet initialized during fresh tab or before first message
**How to avoid:** Check workspace path availability, use pendingAttachments if not ready
**Warning signs:** Empty string from `claudeCodeSandboxState.currentSessionWorkspacePath`

### Pitfall 2: File Object Lost After Clear
**What goes wrong:** Clearing `chatState.attachments` before extracting File objects
**Why it happens:** AttachmentFile.file is the actual File object needed for upload
**How to avoid:** Clone/extract attachment data before clearing chatState
**Warning signs:** `att.file` is undefined during upload

### Pitfall 3: Race Condition with Sandbox Init
**What goes wrong:** Upload starts before sandbox workspace is created
**Why it happens:** Async sandbox initialization not awaited
**How to avoid:** Use pendingAttachments pattern which is processed after sandbox init
**Warning signs:** 404 errors on upload, workspace path not found

### Pitfall 4: Attachment References Not in Task Content
**What goes wrong:** Task added without file references, AI doesn't know about attachments
**Why it happens:** Only uploading files without updating task content
**How to avoid:** Always include attachment references in task content string
**Warning signs:** AI responses don't reference uploaded files

## Code Examples

Verified patterns from official sources:

### Converting AttachmentFile to Upload Format
```typescript
// Source: code-agent-taskboard-state.svelte.ts lines 232-237
const attachmentList: Attachment[] = await Promise.all(
  attachments.map(async (att) => ({
    filename: att.name,
    content: att.file ? await this.#fileToBase64(att.file) : "",
  }))
);
```

### Uploading Attachments to Sandbox
```typescript
// Source: taskboard/index.ts lines 206-237
export async function uploadAttachments(
  sandboxId: string,
  cwd: string,
  attachments: Attachment[],
): Promise<{ isOk: boolean }> {
  if (attachments.length === 0) {
    return { isOk: true };
  }

  const fileList = attachments.map((attachment) => ({
    content: attachment.content,
    save_path: `${cwd}/${ATTACHMENTS_DIR_PATH}/${attachment.filename}`,
  }));

  const response = await batchUploadFile({
    sandbox_id: sandboxId,
    file_list: fileList,
  });
  // ... error handling
}
```

### Adding Task with Attachment References
```typescript
// Proposed pattern based on existing addTaskFromChatInput
addTaskFromChatInput(content: string, attachments: AttachmentFile[]) {
  const trimmedContent = content.trim();
  if (!trimmedContent && attachments.length === 0) return;

  // Build attachment references
  const attachmentRefs = attachments.length > 0
    ? attachments.map(att => `[Attachment: .302ai/attachments/${att.name}]`).join('\n')
    : '';

  const taskContent = attachmentRefs
    ? `${trimmedContent}\n\n${attachmentRefs}`
    : trimmedContent;

  const newTask: Task = {
    id: nanoid(),
    content: taskContent,
    status: "pending",
    number: 1,
    executedCount: 0,
  };
  this.updateTasklist([...this.tasklist, newTask]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | pendingAttachments pattern | Already in codebase | Handles deferred uploads elegantly |

**Deprecated/outdated:**
- None - all patterns are current

## Open Questions

Things that couldn't be fully resolved:

1. **Attachment reference format in task content**
   - What we know: Need to include file paths so AI knows about attachments
   - What's unclear: Exact format that works best with AI (markdown link vs plain text)
   - Recommendation: Use `[Attachment: path]` format, can be refined in Phase 6 UI polish

2. **Error handling for partial upload failures**
   - What we know: `batchUploadFile` returns per-file success status
   - What's unclear: Should task still be added if some attachments fail?
   - Recommendation: Add task with successful attachments, show warning toast for failures

## Sources

### Primary (HIGH confidence)
- `src/lib/api/taskboard/index.ts` - uploadAttachments() implementation
- `src/lib/api/taskboard/base-apis.ts` - batchUploadFile() API
- `src/lib/stores/code-agent/code-agent-taskboard-state.svelte.ts` - pendingAttachments pattern
- `src/lib/stores/code-agent/code-agent-send-message-button-state.svelte.ts` - Full upload flow example

### Secondary (MEDIUM confidence)
- Phase 4 implementation - Established addTaskFromChatInput pattern

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All APIs exist and are well-documented in code
- Architecture: HIGH - Patterns directly from existing codebase
- Pitfalls: HIGH - Derived from actual code analysis

**Research date:** 2026-02-04
**Valid until:** 60 days (stable internal APIs)
