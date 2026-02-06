# Architecture

**Analysis Date:** 2026-02-02

## Pattern Overview

**Overall:** Multi-Process Electron Desktop Application with SvelteKit Frontend

**Key Characteristics:**
- Electron main/renderer process separation with IPC bridge
- SvelteKit 5 SPA with file-based routing
- Reactive state management using Svelte 5 runes (singleton classes)
- Local Hono.js backend server for AI streaming
- Auto-generated type-safe IPC layer via custom Vite plugin
- Multi-window architecture with shell windows and tab management

## Layers

**Electron Main Process:**
- Purpose: System integration, window management, persistent storage, IPC coordination
- Location: `electron/main/`
- Contains: Services (22+), server router, plugin manager, factories, utilities
- Depends on: Node.js APIs, Electron APIs, @302ai/unstorage
- Used by: Renderer processes via IPC

**Hono.js Backend Server:**
- Purpose: AI model streaming, MCP integration, tool orchestration
- Location: `electron/main/server/router.ts`
- Contains: HTTP router, AI SDK integration, streaming middleware
- Depends on: ai SDK, provider SDKs (Anthropic, OpenAI, Google)
- Used by: Renderer via fetch to localhost:8089 (dynamic port)

**IPC Bridge Layer:**
- Purpose: Type-safe communication between main and renderer
- Location: `electron/main/generated/` (auto-generated), `electron/preload/`
- Contains: Preload services, IPC registration, event handlers
- Depends on: Service definitions in `electron/main/services/`
- Used by: Both main and renderer processes

**SvelteKit Frontend (Renderer):**
- Purpose: User interface, chat interaction, settings management
- Location: `src/routes/`, `src/lib/`
- Contains: Pages, layouts, components, stores, utilities
- Depends on: Svelte 5, shadcn-svelte, TailwindCSS
- Used by: End users via Electron BrowserWindow

**Shared Layer:**
- Purpose: Type definitions and utilities shared between main and renderer
- Location: `src/shared/`
- Contains: Types, constants, storage schemas, utilities
- Depends on: Nothing (pure TypeScript)
- Used by: Both main process and renderer process

**Plugin System:**
- Purpose: Extensibility via sandboxed plugins
- Location: `electron/main/plugin-manager/`, `packages/plugin-sdk/`
- Contains: Plugin loader, registry, hook manager, sandbox
- Depends on: Plugin SDK, service layer
- Used by: Main process, plugins via SDK

## Data Flow

**Chat Message Flow:**

1. User types message in `ChatInputBox` component (`src/routes/(with-sidebar)/chat/components/chat-input/`)
2. `chatState.sendMessage()` called (`src/lib/stores/chat-state.svelte.ts`)
3. Message added to local state, attachments converted to parts
4. `DynamicChatTransport` sends HTTP POST to `localhost:8089/api/chat` (`src/lib/transport/dynamic-chat-transport.ts`)
5. Hono router receives request (`electron/main/server/router.ts`)
6. Router creates AI SDK provider, applies middleware (smoothStream, extractReasoning)
7. Streaming response sent back to renderer
8. `chatState` updates messages reactively as chunks arrive
9. Message persisted to storage via `storageService` IPC call
10. UI updates automatically via Svelte reactivity

**IPC Service Call Flow:**

1. Renderer calls `window.electronAPI.serviceName.methodName(args)`
2. Preload script invokes `ipcRenderer.invoke('serviceName:methodName', args)` (`electron/main/generated/preload-services.ts`)
3. Main process receives via `ipcMain.handle('serviceName:methodName', handler)` (`electron/main/generated/ipc-registration.ts`)
4. Service method executes in main process (`electron/main/services/*/index.ts`)
5. Result returned through IPC channel
6. Renderer receives typed response

**State Persistence Flow:**

1. Store class extends `PersistedState` (`src/lib/hooks/persisted-state.svelte.ts`)
2. State changes trigger debounced `setItemAsync()` call
3. `ElectronStorageAdapter` calls `storageService.setItem()` via IPC
4. Main process writes to `@302ai/unstorage` backend (`electron/main/services/storage-service/`)
5. Storage emits change event
6. Other windows receive `persisted-state:sync` event via broadcast
7. Stores update reactively across all windows

**State Management:**
- Svelte 5 runes (`$state`, `$derived`, `$effect`) in singleton class instances
- PersistedState wrapper for automatic storage synchronization
- Reactive updates propagate through component tree automatically

## Key Abstractions

**Service Classes:**
- Purpose: Encapsulate main process functionality with IPC exposure
- Examples: `electron/main/services/window-service/index.ts`, `electron/main/services/thread-service/index.ts`
- Pattern: Class with methods accepting `IpcMainInvokeEvent` as first parameter, auto-registered via plugin

**Store Classes:**
- Purpose: Reactive state management with persistence
- Examples: `src/lib/stores/chat-state.svelte.ts`, `src/lib/stores/provider-state.svelte.ts`
- Pattern: Singleton class with `$state` properties, `$derived` computed values, action methods

**Transport Classes:**
- Purpose: Abstract HTTP communication with backend server
- Examples: `src/lib/transport/dynamic-chat-transport.ts`, `src/lib/transport/f-chat-transport.ts`
- Pattern: Implements AI SDK `ChatTransport` interface, handles streaming

**WebContents Factories:**
- Purpose: Create and configure Electron BrowserWindow instances
- Examples: `electron/main/factories/web-contents-factory.ts`
- Pattern: Factory methods with mixins for common behaviors

**Plugin Hooks:**
- Purpose: Extension points for plugin system
- Examples: `electron/main/plugin-manager/hook-manager.ts`
- Pattern: Event-based hooks with sandboxed execution

## Entry Points

**Main Process Entry:**
- Location: `electron/main/index.ts`
- Triggers: Electron app 'ready' event
- Responsibilities: Initialize IPC handlers, start Hono server, create windows, setup protocols, register plugins

**Renderer Entry (Root Layout):**
- Location: `src/routes/+layout.svelte`
- Triggers: SvelteKit app mount
- Responsibilities: Initialize global styles, mode watcher, toaster, shortcut handlers, FPS display

**Shell Window Layout:**
- Location: `src/routes/shell/+layout.svelte`
- Triggers: Shell window navigation
- Responsibilities: Render tab bar, handle tab shortcuts, manage multi-tab state

**Chat Page:**
- Location: `src/routes/(with-sidebar)/chat/[id]/+page.svelte`
- Triggers: Navigation to `/chat/[threadId]`
- Responsibilities: Render chat interface, message list, input box, agent preview panel, handle IPC events

**Settings Pages:**
- Location: `src/routes/(settings-page)/settings/(center|full-width)/*/+page.svelte`
- Triggers: Navigation to settings routes
- Responsibilities: Render settings UI, persist configuration changes

**Hono Server Entry:**
- Location: `electron/main/server/router.ts` (`initServer()`)
- Triggers: Called from main process init
- Responsibilities: Start HTTP server on dynamic port, register chat endpoint, handle AI streaming

## Error Handling

**Strategy:** Layered error handling with user-friendly messages

**Patterns:**
- `ChatErrorHandler` class converts technical errors to localized messages (`src/lib/utils/error-handler.ts`)
- IPC errors caught and returned as rejected promises
- Streaming errors sent via `sendStreamError()` utility
- Toast notifications for user-facing errors (`svelte-sonner`)
- Console logging for debugging in development mode

## Cross-Cutting Concerns

**Logging:** Console-based logging with prefixes (`[Main]`, `[Chat Page]`, `[Service]`), conditional FPS display in dev mode

**Validation:** Zod schemas for message validation (`src/lib/types/chat.ts`), TypeScript strict mode for compile-time checks

**Authentication:** SSO via `ai302studio://` deep links (`electron/main/services/sso-service/`), API key storage in encrypted storage, session state management (`src/lib/stores/session-state.svelte.ts`)

---

*Architecture analysis: 2026-02-02*
