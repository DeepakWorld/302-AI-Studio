# Phase 9: UI Indicators - Research

**Researched:** 2026-02-06
**Domain:** Svelte 5 UI components, chat message list rendering, Collapsible pattern, i18n, state-derived indicators
**Confidence:** HIGH

## Summary

Phase 9 adds visual indicators for context compression in the chat UI. The user needs to see: (1) when compression is active in the current thread, (2) how many messages have been summarized, and (3) the actual summary text (expandable). All state fields already exist from Phase 6 (`contextSummary`, `compressedMessageCount`, `lastCompressionMessageId`, `compressionEnabled`) and Phase 8 populated them. This phase is purely frontend UI work.

The codebase already has all the building blocks: the `Collapsible` component (bits-ui based, used in the reasoning section of `assistant-message.svelte`), `Badge` component for status indicators, `ButtonWithTooltip` for icon buttons, and established patterns for conditional rendering in the message list. The chat page (`+page.svelte`) passes `chatState.visibleMessages` to `MessageList`, which renders messages in a scrollable area -- the compression banner needs to appear at the top of this list.

**Primary recommendation:** Create a single new Svelte component `compression-banner.svelte` in the message list area that shows a collapsible banner at the top of the message list when compression is active. Use the existing `Collapsible` + `ChevronDown` pattern from the reasoning section. Add 6 i18n keys (3 zh, 3 en). No new libraries needed.

## Standard Stack

No new libraries needed. All work uses existing project infrastructure.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bits-ui` (Collapsible) | 2.9.8 | Expandable/collapsible summary section | Already used for reasoning content in assistant-message.svelte |
| `@lucide/svelte` | installed | Icons for compression indicator | Already used throughout the chat UI |
| Svelte 5 runes | 5.38.10 | Reactive state binding from `chatState` | All stores use this pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwind-variants` (`tv`) | installed | Consistent styling if variants needed | Only if badge variants are needed |
| `inlang/paraglide-js` | 2.3.2 | i18n for all user-facing strings | Required for all new text |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Collapsible component | Dialog/Sheet for summary | Collapsible is inline, non-disruptive; dialog forces modal interaction -- bad UX for quick glance |
| Top-of-list banner | Per-message annotation | Banner is simpler, single location; per-message would need to mark every compressed message individually |
| New component file | Inline in message-list.svelte | Separate component keeps message-list clean (it's already 400 lines) and is reusable |

## Architecture Patterns

### Recommended Component Location
```
src/routes/(with-sidebar)/chat/components/message/
├── compression-banner.svelte   # NEW: compression status + expandable summary
├── message-list.svelte          # MODIFY: render banner above message list
├── assistant-message.svelte     # NO CHANGE (reference for Collapsible pattern)
└── user-message.svelte          # NO CHANGE
```

### Pattern 1: Compression Banner Component
**What:** A self-contained component that reads from `chatState` and conditionally renders a banner showing compression status with expandable summary.
**When to use:** Always rendered inside `message-list.svelte`, but it only shows when `chatState.compressedMessageCount > 0`.
**Verified from:** `assistant-message.svelte` lines 523-567 (reasoning Collapsible pattern)

```svelte
<!-- compression-banner.svelte -->
<script lang="ts">
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "$lib/components/ui/collapsible";
  import { m } from "$lib/paraglide/messages.js";
  import { chatState } from "$lib/stores/chat-state.svelte";
  import { ChevronDown, FileStack } from "@lucide/svelte";

  let isExpanded = $state(false);

  const compressedCount = $derived(chatState.compressedMessageCount ?? 0);
  const contextSummary = $derived(chatState.contextSummary);
  const isActive = $derived(compressedCount > 0 && !!contextSummary);
</script>

{#if isActive}
  <Collapsible bind:open={isExpanded} class="mb-4 rounded-lg border bg-muted/30 p-3">
    <CollapsibleTrigger
      class="flex w-full items-center justify-between text-left transition-colors hover:bg-muted/20 rounded-md p-2"
    >
      <div class="flex items-center gap-2">
        <FileStack class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm text-muted-foreground">
          {m.compression_banner_count({ count: compressedCount })}
        </span>
      </div>
      <ChevronDown
        class="h-4 w-4 text-muted-foreground transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}"
      />
    </CollapsibleTrigger>
    <CollapsibleContent class="space-y-2">
      <div class="pt-3">
        <div class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {contextSummary}
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
{/if}
```

### Pattern 2: Message List Integration
**What:** Render the compression banner at the top of the message list, before the `{#each}` loop.
**Where:** `message-list.svelte` line 349, inside the container div, before the `{#each messages}` block.
**Verified from:** `message-list.svelte` lines 347-357

```svelte
<!-- In message-list.svelte, inside the container div -->
<div bind:this={messageListContainer} class={cn("w-full space-y-4", containerClass)}>
  <CompressionBanner />  <!-- NEW: renders only when compression active -->
  {#each messages as message, index (message.id + "-" + index)}
    <!-- existing message rendering -->
  {/each}
</div>
```

### Pattern 3: i18n Messages
**What:** Add i18n keys for all user-facing strings.
**Where:** `messages/en.json` and `messages/zh.json`
**Verified from:** Existing compression keys at line 208-212 in both files

New keys needed:
```json
// en.json
{
  "compression_banner_count": "{count} earlier messages summarized",
  "compression_banner_expand": "View summary",
  "compression_banner_label": "Context Compression Active"
}

// zh.json
{
  "compression_banner_count": "{count} 条较早的消息已总结",
  "compression_banner_expand": "查看摘要",
  "compression_banner_label": "上下文压缩已启用"
}
```

### Pattern 4: Derived State Access
**What:** Use existing `chatState` getters -- no new store modifications needed.
**Verified from:** `chat-state.svelte.ts` lines 466-493

Available state (all already exist):
- `chatState.contextSummary` -- the summary text (string or undefined)
- `chatState.compressedMessageCount` -- number of compressed messages (number or undefined)
- `chatState.lastCompressionMessageId` -- ID of last compressed message (for potential future use)
- `chatState.compressionEnabled` -- per-thread override (boolean or undefined)
- `chatState.shouldApplyCompression` -- derived: whether compression should apply (considers global, per-thread, code agent, private chat)

### Anti-Patterns to Avoid
- **Do NOT add new state fields:** All required data already exists in `chatState` from Phase 6.
- **Do NOT modify ChatState class:** Read existing getters, do not add new derived properties for UI display. Put display logic in the component.
- **Do NOT render summary as Markdown:** The summary is plain text generated by the AI summarizer. Rendering it as Markdown would be overkill and could introduce XSS vectors. Use `whitespace-pre-wrap` (same as reasoning content).
- **Do NOT show banner during streaming:** The banner should reflect the persisted state, not in-flight state. `compressedMessageCount` is only updated after successful summary generation in `onFinish`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Expandable/collapsible section | Custom show/hide with transitions | `Collapsible` from bits-ui (via `$lib/components/ui/collapsible`) | Already has proper accessibility (ARIA), keyboard handling, and smooth transitions |
| Icon for compression | Custom SVG | `FileStack` or `Layers` from `@lucide/svelte` | Consistent with all other icons in the app |
| Conditional rendering | Wrapper component with `{#if}` prop | Direct `{#if isActive}` in banner component | Simpler, follows existing patterns |
| Parameterized i18n | Template literals with variables | Paraglide `{count}` parameter syntax | Handles pluralization and locale formatting |

**Key insight:** This phase requires zero new infrastructure. Every UI building block (Collapsible, Badge, icons, i18n) is already present and proven in the codebase. The only new artifact is the `compression-banner.svelte` component file and 6 i18n keys.

## Common Pitfalls

### Pitfall 1: Reactivity with undefined values
**What goes wrong:** `chatState.compressedMessageCount` starts as `undefined` (not `0`). Using it directly in template expressions without nullish coalescing causes rendering issues.
**Why it happens:** ThreadParmas fields are optional, initialized as `undefined` until first compression runs.
**How to avoid:** Always use `?? 0` when reading `compressedMessageCount`, and `??` or truthiness checks for `contextSummary`.
**Warning signs:** Banner shows when it shouldn't (count is undefined but truthy-like in template).

### Pitfall 2: Banner scrolling interference
**What goes wrong:** Adding content at the top of the message list can interfere with auto-scroll behavior. The `MutationObserver` in `message-list.svelte` (line 171) triggers scroll-to-bottom on DOM changes.
**Why it happens:** The banner toggling open/closed mutates the DOM, which the observer detects.
**How to avoid:** The banner is above the messages, and toggle only changes its own height. The auto-scroll logic (`shouldAutoScroll`) only fires when near the bottom. The initial render of the banner (on page load) happens before messages are loaded, so it won't interfere. Expanding the banner while scrolled down also won't trigger scroll because the user is not near the bottom.
**Warning signs:** Unexpected scroll jumps when toggling the banner.

### Pitfall 3: i18n parameter syntax
**What goes wrong:** Using wrong parameter syntax in Paraglide messages causes build errors or missing translations.
**Why it happens:** Paraglide uses `{paramName}` in message files and generates typed functions `m.key({ paramName: value })`.
**How to avoid:** Use `{count}` in the message string and pass `{ count: number }` when calling. Check the generated type in `$lib/paraglide/messages.js`.
**Warning signs:** TypeScript errors on `m.compression_banner_count()` call.

### Pitfall 4: Showing banner in Code Agent mode or private chat
**What goes wrong:** Banner shows even though compression is disabled for these modes.
**Why it happens:** `compressedMessageCount` might be non-zero from a previous non-agent session, but `shouldApplyCompression` returns false.
**How to avoid:** Use `chatState.shouldApplyCompression` AND `compressedMessageCount > 0` as the visibility condition. Or simply use `compressedMessageCount > 0 && contextSummary` since the backend won't generate summaries when compression is disabled.
**Warning signs:** Banner appears in Code Agent or private chat threads.

### Pitfall 5: Screenshot capture includes banner
**What goes wrong:** The compression banner gets included in chat screenshot exports, which may be undesirable.
**Why it happens:** The screenshot captures everything inside `messageListContainer`.
**How to avoid:** This is acceptable behavior -- the banner is part of the chat display. If exclusion is desired, add `data-exclude-screenshot` attribute, but this is NOT a Phase 9 requirement. Note as a potential enhancement.
**Warning signs:** N/A -- not a bug, just a design consideration.

## Code Examples

### Example 1: Complete compression-banner.svelte Component

```svelte
<script lang="ts">
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "$lib/components/ui/collapsible";
  import { m } from "$lib/paraglide/messages.js";
  import { chatState } from "$lib/stores/chat-state.svelte";
  import { ChevronDown, FileStack } from "@lucide/svelte";

  let isExpanded = $state(false);

  const compressedCount = $derived(chatState.compressedMessageCount ?? 0);
  const contextSummary = $derived(chatState.contextSummary);
  const isActive = $derived(compressedCount > 0 && !!contextSummary);
</script>

{#if isActive}
  <Collapsible bind:open={isExpanded} class="mb-4 rounded-lg border bg-muted/30 p-3">
    <CollapsibleTrigger
      class="flex w-full items-center justify-between text-left transition-colors hover:bg-muted/20 rounded-md p-2"
    >
      <div class="flex items-center gap-2">
        <FileStack class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm text-muted-foreground">
          {m.compression_banner_count({ count: compressedCount })}
        </span>
      </div>
      <ChevronDown
        class="h-4 w-4 text-muted-foreground transition-transform duration-200 {isExpanded
          ? 'rotate-180'
          : ''}"
      />
    </CollapsibleTrigger>
    <CollapsibleContent class="space-y-2">
      <div class="pt-3">
        <div class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {contextSummary}
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
{/if}
```

### Example 2: Message List Integration (message-list.svelte changes)

```svelte
<!-- Add import at top of script -->
<script lang="ts">
  import CompressionBanner from "./compression-banner.svelte";
  // ... existing imports
</script>

<!-- Add banner before {#each} in template -->
<div bind:this={messageListContainer} class={cn("w-full space-y-4", containerClass)}>
  <CompressionBanner />
  {#each messages as message, index (message.id + "-" + index)}
    {#if message.role === "user"}
      <UserMessage message={{ ...message, role: "user" as const }} />
    {:else if message.role === "assistant"}
      <AssistantMessage message={{ ...message, role: "assistant" as const }} />
    {/if}
  {/each}
</div>
```

### Example 3: i18n Message Keys

```json
// messages/en.json (add after existing compression settings keys around line 212)
"compression_banner_count": "{count} earlier messages summarized",
"compression_banner_expand": "View summary",
"compression_banner_label": "Context Compression Active"

// messages/zh.json (add after existing compression settings keys around line 212)
"compression_banner_count": "{count} 条较早的消息已总结",
"compression_banner_expand": "查看摘要",
"compression_banner_label": "上下文压缩已启用"
```

### Example 4: Reasoning Collapsible Pattern (Reference -- existing code)

Source: `assistant-message.svelte` lines 523-567 (the pattern being replicated)

```svelte
<Collapsible
  bind:open={isReasoningExpanded}
  class="mb-4 rounded-lg border bg-muted/30 p-3"
>
  <CollapsibleTrigger
    class="flex w-full items-center justify-between text-left transition-colors hover:bg-muted/20 rounded-md p-2"
  >
    <div class="flex items-center gap-2">
      <Lightbulb class="h-4 w-4 text-muted-foreground" />
      <span class="text-sm font-medium text-muted-foreground">{m.title_thinking()}</span>
    </div>
    <ChevronDown
      class="h-4 w-4 text-muted-foreground transition-transform duration-200 {isReasoningExpanded
        ? 'rotate-180'
        : ''}"
    />
  </CollapsibleTrigger>
  <CollapsibleContent class="space-y-2">
    <div class="pt-3">
      <div class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {part.text}
      </div>
    </div>
  </CollapsibleContent>
</Collapsible>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No compression indicators | Phase 9 adds visual feedback | v1.2 (this release) | User gains visibility into compression state |
| Silent context truncation | Explicit banner with summary view | v1.2 (this release) | Transparency: user knows what the AI "remembers" |

**No deprecated/outdated items** -- this is new functionality.

## Open Questions

1. **Summary text formatting**
   - What we know: The summary is generated by AI as plain text (see `generateContextSummary` API). The backend wraps it with `[Context from earlier conversation]` markers when prepending to system prompt.
   - What's unclear: Whether the summary text itself contains markdown formatting (lists, bold, etc.) depending on the model.
   - Recommendation: Use `whitespace-pre-wrap` (not Markdown renderer) for initial implementation. If users report formatting issues, upgrade to MarkdownRenderer in a later iteration.

2. **Banner visibility when thread loads with compression data**
   - What we know: `persistedChatParamsState` hydrates from storage on load, so `compressedMessageCount` and `contextSummary` will be available after hydration.
   - What's unclear: Whether there's a brief flash during hydration where the banner appears/disappears.
   - Recommendation: Since PersistedState hydrates before messages render (constructor checks hydration), the banner should be stable. If not, add a hydration guard: `{#if persistedChatParamsState.isHydrated && isActive}`.

3. **Icon choice**
   - What we know: `@lucide/svelte` provides `FileStack`, `Layers`, `AlignLeft`, `BookOpen`, `Minimize2`, and many others.
   - What's unclear: Which icon best communicates "compressed/summarized messages" at a glance.
   - Recommendation: Use `FileStack` (stacked documents) or `Layers` (layered content). Both suggest "multiple items condensed." The reasoning section uses `Lightbulb`, so using a different icon differentiates the banner. `FileStack` is the top recommendation.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- `src/lib/stores/chat-state.svelte.ts` lines 466-564 (compression state accessors and shouldApplyCompression derived)
- **Codebase inspection** -- `src/routes/(with-sidebar)/chat/components/message/assistant-message.svelte` lines 523-567 (Collapsible pattern for reasoning)
- **Codebase inspection** -- `src/routes/(with-sidebar)/chat/components/message/message-list.svelte` lines 347-357 (message rendering loop)
- **Codebase inspection** -- `src/lib/components/ui/collapsible/` (bits-ui wrapper components)
- **Codebase inspection** -- `messages/en.json` and `messages/zh.json` (existing compression i18n keys)
- **Codebase inspection** -- `src/shared/types.ts` lines 130-163 (ThreadParmas with compression fields)
- **Codebase inspection** -- `electron/main/server/utils.ts` lines 1025-1057 (applyContextCompression function)
- **Codebase inspection** -- `src/routes/(with-sidebar)/chat/[id]/+page.svelte` (page layout, visibleMessages usage)

### Secondary (MEDIUM confidence)
- **Lucide icon availability** -- `@lucide/svelte` package includes `FileStack` and `Layers` icons (verified via existing imports like `Lightbulb`, `ChevronDown`, etc.)

### Tertiary (LOW confidence)
- None -- all findings are codebase-verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components already exist in the codebase
- Architecture: HIGH -- pattern directly mirrors the reasoning Collapsible in assistant-message.svelte
- Pitfalls: HIGH -- identified from direct code analysis of message-list.svelte scroll behavior and chatState typing

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- no external dependencies changing)
