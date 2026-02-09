# Phase Research: Foundation

## Summary

Phase 6 establishes the data model and settings infrastructure for context compression. This involves extending `ThreadParmas` with compression fields (following the existing `incrementalSummary` pattern), adding compression settings to `PreferencesSettingsState`, and exposing compression state through `ChatState` with exemption logic for Code Agent and private chat modes.

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/shared/types.ts` | Add `contextSummary?: string`, `compressedMessageCount?: number`, `lastCompressionMessageId?: string`, `compressionEnabled?: boolean` to `ThreadParmas` (lines 130-155) |
| `src/lib/stores/preferences-settings.state.svelte.ts` | Add `contextCompressionEnabled: boolean` (default: true), `contextCompressionLimit: number` (default: 20) to interface and manager class |
| `src/lib/stores/chat-state.svelte.ts` | Add getters/setters for new ThreadParmas fields + `shouldApplyCompression` derived that checks exemptions |

## Implementation Patterns

### ThreadParmas Extension Pattern
From existing `incrementalSummary` (line 152):
```typescript
/** Incremental summary for title generation, stores context from previous conversations */
incrementalSummary?: string;
```

New fields follow same pattern:
```typescript
/** Rolling summary for context compression, stores condensed earlier conversation */
contextSummary?: string;
/** Count of messages included in the context summary */
compressedMessageCount?: number;
/** Message ID of last message included in compression */
lastCompressionMessageId?: string;
/** Whether compression is enabled for this thread (overrides global) */
compressionEnabled?: boolean;
```

### PreferencesSettingsState Pattern
From existing settings (lines 10-31):
1. Add to interface with type
2. Add to `getDefaults()` with default value
3. Add getter/setter pair to manager class

### ChatState Exemption Pattern
Exemption check needs to consider:
1. `codeAgentState.enabled` (from `./code-agent` imports)
2. `this.isPrivateChatActive` (already in chatState)
3. Global `preferencesSettings.contextCompressionEnabled`
4. Per-thread `this.compressionEnabled` override

```typescript
get shouldApplyCompression(): boolean {
  // Disabled globally
  if (!preferencesSettings.contextCompressionEnabled) return false;
  // Disabled per-thread
  if (this.compressionEnabled === false) return false;
  // Exempt: Code Agent mode
  if (codeAgentState.enabled) return false;
  // Exempt: Private chat
  if (this.isPrivateChatActive) return false;
  return true;
}
```

## UI Component Location

Settings UI should go in:
- `src/routes/(settings-page)/settings/(center)/preferences-settings/`

Follow existing pattern of toggle switches for boolean settings and number input for limit.

## Open Questions

1. **Default limit value**: 20 messages chosen based on research. May need tuning.
2. **Per-thread override UI**: Should users be able to override compression per-thread? (Research says yes, but could defer to later phase)
3. **i18n keys**: Need to add translation keys for settings labels.

## Confidence: HIGH

All patterns verified from codebase. No new dependencies or architectural decisions needed. This is pure extension of existing infrastructure.

---
*Researched: 2026-02-05*
