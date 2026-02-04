# Requirements: Streaming Input to Taskboard

**Defined:** 2026-02-04
**Core Value:** Users can capture task ideas immediately without waiting for AI output to complete

## v1.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Core Redirection

- [ ] **REDIR-01**: User can type in chat input while AI is streaming in Vibe Mode
- [ ] **REDIR-02**: User pressing Enter/Send during streaming adds input as task to taskboard
- [ ] **REDIR-03**: User sees toast notification confirming task was added
- [ ] **REDIR-04**: Chat input and attachments are cleared after task is added

### Attachment Handling

- [ ] **ATTACH-01**: Attachments in chat input are uploaded to sandbox workspace
- [ ] **ATTACH-02**: Uploaded attachment paths are referenced in task content

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Polish

- **POLISH-01**: User can undo task addition via toast action button
- **POLISH-02**: User sees task count badge near input during streaming
- **POLISH-03**: Placeholder text changes to indicate taskboard mode

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Separate queue input UI | Adds cognitive load, breaks flow |
| Modal confirmation dialog | Interrupts typing flow |
| Visual hint on input box | Toast notification is sufficient feedback |
| Extending Task type with attachment metadata | Path references in content are cleaner |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REDIR-01 | Phase 4 | Pending |
| REDIR-02 | Phase 4 | Pending |
| REDIR-03 | Phase 4 | Pending |
| REDIR-04 | Phase 4 | Pending |
| ATTACH-01 | Phase 5 | Pending |
| ATTACH-02 | Phase 5 | Pending |

**Coverage:**
- v1.1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-04 after initial definition*
