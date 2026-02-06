# Roadmap: Auto Context Compression

## Milestones

- [x] **v1.0 Streaming Fix** - Phases 1-3 (shipped 2026-02-04)
- [x] **v1.1 Streaming Input to Taskboard** - Phases 4-5 (shipped 2026-02-04)
- [ ] **v1.2 Auto Context Compression** - Phases 6-9 (in progress)

## Overview

This milestone enables automatic context compression for long conversations. When message count exceeds a configurable threshold, older messages are summarized into a rolling summary that gets injected as context when sending to AI. Original messages remain in UI -- compression is purely a transport optimization. Code Agent and private chat modes are exempt to preserve full context where needed.

## Phases

<details>
<summary>v1.0 Streaming Fix (Phases 1-3) - SHIPPED 2026-02-04</summary>

See: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v1.1 Streaming Input to Taskboard (Phases 4-5) - SHIPPED 2026-02-04</summary>

### Phase 4: Core Redirection
**Goal**: Users can add tasks to taskboard while AI is streaming in Vibe Mode
**Plans**: 1 plan (complete)

### Phase 5: Attachment Handling
**Goal**: Attachments in chat input are uploaded to sandbox and referenced in task content
**Plans**: 1 plan (complete)

</details>

### v1.2 Auto Context Compression

- [x] **Phase 6: Foundation** - Data model, settings, and exemption logic
- [ ] **Phase 7: Backend Summarization** - Endpoint for generating rolling summaries
- [ ] **Phase 8: Router Integration** - Inject summary into AI requests with auto-update
- [ ] **Phase 9: UI Indicators** - Visual feedback for compression state

## Phase Details

### Phase 6: Foundation
**Goal**: Data model and settings infrastructure exists for compression
**Depends on**: Phase 5 (v1.1 complete)
**Requirements**: COMP-01, UI-03, EXEMPT-01, EXEMPT-02
**Success Criteria** (what must be TRUE):
  1. User can configure message limit N in preferences settings
  2. ThreadParmas stores compression state (summary, messageId, enabled)
  3. ChatState exposes compression fields with getters/setters
  4. Compression is automatically disabled in Code Agent mode
  5. Compression is automatically disabled in private chat mode
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Data model and preferences state foundation
- [x] 06-02-PLAN.md — ChatState integration and settings UI

### Phase 7: Backend Summarization
**Goal**: Backend can generate rolling summaries from message history
**Depends on**: Phase 6
**Requirements**: COMP-02
**Success Criteria** (what must be TRUE):
  1. `/generate-context-summary` endpoint exists and returns 200-500 char summary
  2. Summary preserves key facts, decisions, and context from older messages
  3. Endpoint uses title generation model for fast, cheap summarization
  4. API wrapper with AbortController support exists in frontend
**Plans**: 1 plan

Plans:
- [ ] 07-01-PLAN.md — Backend endpoint, frontend API wrapper, and ChatState AbortController

### Phase 8: Router Integration
**Goal**: AI receives compressed context instead of full message history
**Depends on**: Phase 7
**Requirements**: COMP-03, COMP-04
**Success Criteria** (what must be TRUE):
  1. Summary is prepended to system prompt when sending to AI
  2. Messages beyond threshold are excluded from AI request
  3. Summary auto-updates after AI response when message count exceeds threshold
  4. Summary generation follows AbortController pattern (cancels on new message)
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

### Phase 9: UI Indicators
**Goal**: User has visibility into compression state and can view compressed content
**Depends on**: Phase 8
**Requirements**: UI-01, UI-02, UI-04
**Success Criteria** (what must be TRUE):
  1. User sees visual indicator when compression is active in current thread
  2. User sees count of compressed messages (e.g., "12 earlier messages summarized")
  3. User can expand to view the actual summary text
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Stream Lifecycle | v1.0 | 2/2 | Complete | 2026-02-04 |
| 2. Transport Layer Validation | v1.0 | 1/1 | Complete | 2026-02-04 |
| 3. Frontend State Sync | v1.0 | 2/2 | Complete | 2026-02-04 |
| 4. Core Redirection | v1.1 | 1/1 | Complete | 2026-02-04 |
| 5. Attachment Handling | v1.1 | 1/1 | Complete | 2026-02-04 |
| 6. Foundation | v1.2 | 2/2 | Complete | 2026-02-06 |
| 7. Backend Summarization | v1.2 | 0/1 | Planned | - |
| 8. Router Integration | v1.2 | 0/TBD | Not started | - |
| 9. UI Indicators | v1.2 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-04*
*Last updated: 2026-02-06 after Phase 7 planned*
