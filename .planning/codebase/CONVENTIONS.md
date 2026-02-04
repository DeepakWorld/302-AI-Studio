# Coding Conventions

**Analysis Date:** 2026-02-02

## Naming Patterns

**Files:**
- Components: `kebab-case.svelte` (e.g., `chat-input.svelte`, `image-viewer.svelte`)
- Stores: `kebab-case.svelte.ts` (e.g., `chat-state.svelte.ts`, `provider-state.svelte.ts`)
- Types: `kebab-case.ts` (e.g., `chat-types.ts`, `shortcut.ts`)
- Services: `kebab-case/index.ts` directories (e.g., `window-service/index.ts`, `storage-service/index.ts`)
- Routes: SvelteKit convention (`+page.svelte`, `+layout.svelte`, `+page.ts`)
- Utilities: `kebab-case.ts` (e.g., `error-handler.ts`, `clone.ts`)

**Functions:**
- camelCase for functions and methods (e.g., `sendMessage`, `generateTitle`, `handleChatError`)
- Async functions prefixed with verb (e.g., `async generateTitleManually()`, `async createBranch()`)
- Event handlers prefixed with `handle` (e.g., `handleThinkingActiveChange`, `handleSendMessage`)
- Private methods prefixed with `private` keyword (e.g., `private resetChat()`, `private syncPersistedStatesToChat()`)

**Variables:**
- camelCase for variables (e.g., `chatState`, `selectedModel`, `inputValue`)
- Constants: UPPER_SNAKE_CASE (e.g., `TODO_TASKS_FILE_PATH`, `WINDOW_SIZE`, `CONFIG`)
- Boolean variables: prefixed with `is`, `has`, `can`, `should` (e.g., `isStreaming`, `hasMessages`, `canRetry`, `shouldGenerateTitle`)

**Types:**
- PascalCase for interfaces and types (e.g., `ChatMessage`, `ModelProvider`, `ThreadParmas`)
- Enums: PascalCase with UPPER_CASE values (e.g., `ErrorType.NETWORK`, `ErrorType.API`)
- Type suffixes: `Input` for creation types, `Config` for configuration (e.g., `ModelCreateInput`, `MigrationConfig`)

## Code Style

**Formatting:**
- Tool: Prettier 3.6.2 with `prettier-plugin-svelte`
- Tabs: `useTabs: true` (not spaces)
- Quotes: Double quotes (`singleQuote: false`)
- Trailing commas: Always (`trailingComma: "all"`)
- Print width: 100 characters
- Svelte files: Parsed with svelte parser

**Linting:**
- Tool: ESLint 9.35.0 with TypeScript and Svelte support
- Config: `eslint.config.js` using flat config format
- Key rules:
  - Unused vars: Error with `_` prefix ignore pattern (`argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`)
  - No undef: Off (TypeScript handles this)
  - Svelte navigation: `svelte/no-navigation-without-resolve` disabled
  - Generated files: Allow empty interfaces with `allowInterfaces: "always"`

## Import Organization

**Order:**
1. External packages (e.g., `import { nanoid } from "nanoid"`)
2. AI SDK imports (e.g., `import { Chat } from "@ai-sdk/svelte"`)
3. Internal lib imports with `$lib` alias (e.g., `import { m } from "$lib/paraglide/messages.js"`)
4. Shared imports with `@shared` alias (e.g., `import type { Model } from "@shared/types"`)
5. Electron imports with `@electron` alias (e.g., `import { CONFIG } from "@electron/constants"`)
6. Relative imports (e.g., `import { chatState } from "./chat-state.svelte"`)

**Path Aliases:**
- `$lib` → `src/lib`
- `@shared` → `src/shared`
- `@electron` → `electron`

**Import Style:**
- Named imports preferred over default imports
- Type imports use `import type` syntax (e.g., `import type { ChatMessage } from "$lib/types/chat"`)
- Group related imports with line breaks between categories

## Error Handling

**Patterns:**
- Centralized error handling via `ChatErrorHandler` class in `src/lib/utils/error-handler.ts`
- Error types: Enum-based classification (`ErrorType.NETWORK`, `ErrorType.API`, `ErrorType.AUTHENTICATION`, etc.)
- Error context: Include provider, model, action, and retryability
- User-friendly messages: Use i18n messages via `$lib/paraglide/messages.js`
- Toast notifications: Use `svelte-sonner` for error display
- Try-catch blocks: Always log errors with `console.error()` before handling
- Plugin hooks: Execute error hooks for plugin integration (e.g., `pluginService.executeErrorHook()`)

**Example:**
```typescript
try {
  await chat.sendMessage(/* ... */);
} catch (error) {
  const chatError = ChatErrorHandler.createError(error, {
    provider: this.currentProvider?.name,
    model: this.selectedModel?.id,
    action: "send_message",
    retryable: true,
  });
  this.lastError = chatError;
  notificationState.setError(chatError);
  ChatErrorHandler.showErrorNotification(chatError);
}
```

## Logging

**Framework:** Console API (native)

**Patterns:**
- Prefix logs with component/module name in brackets (e.g., `console.log("[ChatState] Applied default model")`)
- Use appropriate log levels:
  - `console.log()` for informational messages
  - `console.warn()` for warnings
  - `console.error()` for errors
  - `console.debug()` for debug information with JSON.stringify for objects
- Include context in log messages (e.g., variable values, state changes)
- Log state snapshots with `$state.snapshot()` for Svelte 5 runes

**Example:**
```typescript
console.log("[ChatState] Clearing selectedModel", selectedModel?.providerId, selectedModel?.id);
console.debug("[onFinish] messages", JSON.stringify($state.snapshot(messages), null, 2));
console.error("[ChatState] Error hook failed:", hookError);
```

## Comments

**When to Comment:**
- Complex business logic requiring explanation
- Non-obvious workarounds or hacks
- Public API methods (JSDoc style)
- TODO/FIXME for future improvements (minimal usage observed)
- State management effects with side effects
- Plugin hook integration points

**JSDoc/TSDoc:**
- Used for public methods and complex functions
- Include parameter descriptions and return types
- Document side effects and async behavior

**Example:**
```typescript
/**
 * Cancel any pending suggestions generation request.
 * Should be called before sending a new message to avoid race conditions.
 */
cancelPendingSuggestions() {
  if (this.suggestionsAbortController) {
    this.suggestionsAbortController.abort();
    this.suggestionsAbortController = null;
  }
}
```

## Function Design

**Size:** Functions should be focused and single-purpose. Large functions (100+ lines) are acceptable for complex state management (e.g., `sendMessage` in `chat-state.svelte.ts`)

**Parameters:**
- Use options objects for multiple optional parameters (e.g., `sendMessage(options?: { content?: string })`)
- Destructure parameters in function signature when appropriate
- Type all parameters explicitly

**Return Values:**
- Explicit return types for public methods
- Use `Promise<T>` for async functions
- Return `null` for not-found cases, `undefined` for optional values
- Boolean returns for validation/check functions

## Module Design

**Exports:**
- Named exports preferred over default exports
- Export singleton instances for state management (e.g., `export const chatState = new ChatState()`)
- Barrel exports via `index.ts` for component libraries
- Re-export types from shared modules

**Barrel Files:**
- Used extensively in `src/lib/components/ui/` for shadcn-svelte components
- Each component directory has `index.ts` exporting all sub-components
- Example: `src/lib/components/ui/button/index.ts` exports button variants

## Svelte 5 Runes Patterns

**State Management:**
- Use `$state` for reactive state (e.g., `messages = $state<ChatMessage[]>([])`)
- Use `$derived` for computed values (e.g., `isStreaming = $derived(chat.status === "streaming")`)
- Use `$effect` for side effects with proper cleanup
- Use `$props()` for component props (e.g., `const { src, alt }: ImageViewerProps = $props()`)

**Singleton Classes:**
- State management via singleton class instances
- Export instance, not class (e.g., `export const chatState = new ChatState()`)
- Use private fields for internal state
- Expose getters/setters for reactive properties

**Example:**
```typescript
class ChatState {
  private lastError: ChatError | null = $state(null);
  loadingAttachmentIds = $state(new Set<string>());

  isStreaming = $derived(chat.status === "streaming");
  sendMessageEnabled = $derived(
    (this.inputValue.trim() !== "" || this.attachments.length > 0) &&
    !!this.selectedModel &&
    !this.isStreaming
  );
}

export const chatState = new ChatState();
```

## TypeScript Conventions

**Strict Mode:** Enabled in `tsconfig.json`
- `strict: true`
- `forceConsistentCasingInFileNames: true`
- `skipLibCheck: true`

**Type Annotations:**
- Explicit types for function parameters and return values
- Infer types for local variables when obvious
- Use `type` for unions and aliases, `interface` for object shapes
- Avoid `any` (use `unknown` or proper types)

**Null Handling:**
- Use `null` for intentional absence
- Use `undefined` for optional/uninitialized values
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Check with `isNull()`, `isUndefined()` from `es-toolkit`

---

*Convention analysis: 2026-02-02*
