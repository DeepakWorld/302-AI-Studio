# Roadmap: Streaming Input to Taskboard

## Milestones

- [x] **v1.0 Streaming Fix** - Phases 1-3 (shipped 2026-02-04)
- [x] **v1.1 Streaming Input to Taskboard** - Phases 4-5 (shipped 2026-02-04)

## Overview

This milestone enables users to capture task ideas immediately while AI is streaming output in Vibe Mode. When the user types and presses Enter during streaming, input redirects to the taskboard instead of queuing as a chat message. Phase 4 delivers core redirection with toast feedback. Phase 5 adds attachment handling with sandbox upload.

## Phases

<details>
<summary>v1.0 Streaming Fix (Phases 1-3) - SHIPPED 2026-02-04</summary>

See: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### v1.1 Streaming Input to Taskboard

- [x] **Phase 4: Core Redirection** - Redirect chat input to taskboard during streaming
- [x] **Phase 5: Attachment Handling** - Upload attachments to sandbox and reference in tasks

## Phase Details

### Phase 4: Core Redirection
**Goal**: Users can add tasks to taskboard while AI is streaming in Vibe Mode
**Depends on**: Phase 3 (v1.0 streaming fix)
**Requirements**: REDIR-01, REDIR-02, REDIR-03, REDIR-04
**Success Criteria** (what must be TRUE):
  1. User can type in chat input while AI response is streaming in Vibe Mode
  2. User pressing Enter during streaming adds input as new task to taskboard
  3. User sees toast notification confirming task was added
  4. Chat input is cleared after task is added
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md — Add taskboard method and chat input redirection logic

### Phase 5: Attachment Handling
**Goal**: Attachments in chat input are uploaded to sandbox and referenced in task content
**Depends on**: Phase 4
**Requirements**: ATTACH-01, ATTACH-02
**Success Criteria** (what must be TRUE):
  1. Attachments in chat input are uploaded to sandbox workspace when task is added
  2. Uploaded attachment paths appear in task content
  3. Chat attachments are cleared after task is added
**Plans**: 1 plan

Plans:
- [x] 05-01-PLAN.md — Handle attachments during chat input redirection

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Stream Lifecycle | v1.0 | 2/2 | Complete | 2026-02-04 |
| 2. Transport Layer Validation | v1.0 | 1/1 | Complete | 2026-02-04 |
| 3. Frontend State Sync | v1.0 | 2/2 | Complete | 2026-02-04 |
| 4. Core Redirection | v1.1 | 1/1 | Complete | 2026-02-04 |
| 5. Attachment Handling | v1.1 | 1/1 | Complete | 2026-02-04 |

---
*Roadmap created: 2026-02-04*
*Last updated: 2026-02-04 after v1.1 milestone complete*
