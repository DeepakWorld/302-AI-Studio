# Codebase Structure

**Analysis Date:** 2026-02-02

## Directory Layout

```
302-AI-Studio-sv/
├── electron/                    # Electron main process
│   ├── main/                    # Main process code
│   │   ├── services/            # IPC services (22+)
│   │   ├── server/              # Hono.js backend
│   │   ├── generated/           # Auto-generated IPC bindings
│   │   ├── plugin-manager/      # Plugin system
│   │   ├── factories/           # WebContents factories
│   │   ├── mixins/              # WebContents mixins
│   │   ├── apis/                # API clients
│   │   ├── utils/               # Main process utilities
│   │   ├── constants/           # Main process constants
│   │   └── index.ts             # Main entry point
│   └── preload/                 # Preload scripts
│       └── index.ts             # Preload entry
├── src/
│   ├── routes/                  # SvelteKit routes
│   │   ├── (with-sidebar)/      # Main app layout with sidebar
│   │   │   ├── chat/[id]/       # Chat page
│   │   │   └── components/      # Shared layout components
│   │   ├── (settings-page)/     # Settings layout
│   │   │   └── settings/
│   │   │       ├── (center)/    # Center-aligned settings
│   │   │       └── (full-width)/ # Full-width settings
│   │   ├── shell/[id]/          # Shell window wrapper
│   │   ├── html-preview/        # HTML preview route
│   │   ├── +layout.svelte       # Root layout
│   │   └── +page.svelte         # Root page
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/              # Shadcn-svelte base (60+)
│   │   │   ├── buss/            # Business components (30+)
│   │   │   ├── chat/            # Chat-specific components
│   │   │   └── html-preview/    # Preview components
│   │   ├── stores/              # Svelte 5 runes stores (25+)
│   │   │   ├── code-agent/      # Code agent stores
│   │   │   └── chat-paramters/  # Chat parameter stores
│   │   ├── api/                 # Frontend API layer
│   │   │   ├── skills/          # Skills API
│   │   │   ├── core/            # Core APIs
│   │   │   └── taskboard/       # Taskboard API
│   │   ├── transport/           # Chat transport layer
│   │   ├── types/               # TypeScript types
│   │   ├── utils/               # Utility functions
│   │   ├── hooks/               # Custom Svelte hooks
│   │   ├── theme/               # Theme system
│   │   ├── datas/               # Static data
│   │   ├── services/            # Frontend services
│   │   ├── handlers/            # Event handlers
│   │   ├── shortcut/            # Shortcut handling
│   │   ├── event/               # Event emitter
│   │   ├── constants/           # Frontend constants
│   │   ├── assets/              # Static assets
│   │   └── paraglide/           # Generated i18n
│   ├── shared/                  # Shared between main/renderer
│   │   ├── types/               # Shared types
│   │   ├── storage/             # Storage schemas
│   │   ├── config/              # Shared config
│   │   ├── constants/           # Shared constants
│   │   └── utils/               # Shared utilities
│   ├── app.html                 # HTML template
│   ├── app.css                  # Global styles
│   └── app.d.ts                 # Global type definitions
├── packages/                    # Workspace packages
│   ├── plugin-sdk/              # @302ai/studio-plugin-sdk
│   └── plugin-registry/         # Plugin registry
├── vite-plugins/
│   └── ipc-service-generator/   # Custom IPC generator plugin
├── messages/                    # i18n message files
│   ├── en.json                  # English
│   └── zh.json                  # Chinese (base)
├── scripts/                     # Build/release scripts
├── static/                      # Static assets
├── storage/                     # Runtime storage (gitignored)
├── docs/                        # Documentation
├── e2e/                         # E2E tests
├── vite.config.ts               # Renderer Vite config
├── vite.main.config.ts          # Main process Vite config
├── vite.preload.config.ts       # Preload Vite config
├── svelte.config.js             # SvelteKit config
├── forge.config.ts              # Electron Forge config
├── tsconfig.json                # TypeScript config
├── package.json                 # Dependencies
└── pnpm-workspace.yaml          # Workspace config
```

## Directory Purposes

**electron/main/services/:**
- Purpose: IPC-exposed services for main process functionality
- Contains: Service class directories with index.ts
- Key files: `window-service/index.ts`, `thread-service/index.ts`, `storage-service/index.ts`, `code-agent-service/index.ts`, `mcp-service/index.ts`, `tab-service/index.ts`, `provider-service/index.ts`, `shortcut-service/index.ts`, `broadcast-service/index.ts`, `plugin-service.ts`

**electron/main/generated/:**
- Purpose: Auto-generated IPC bindings (DO NOT EDIT MANUALLY)
- Contains: Type-safe preload and registration code
- Key files: `preload-services.ts`, `ipc-registration.ts`

**electron/main/server/:**
- Purpose: Local HTTP server for AI streaming
- Contains: Hono.js router, middleware, utilities
- Key files: `router.ts`, `claude-code-processor.ts`, `citations-processor.ts`, `utils.ts`, `constant.ts`

**electron/main/plugin-manager/:**
- Purpose: Plugin system implementation
- Contains: Plugin loader, registry, hook manager, sandbox
- Key files: `plugin-loader.ts`, `plugin-registry.ts`, `hook-manager.ts`, `sandbox.ts`

**src/routes/(with-sidebar)/:**
- Purpose: Main application layout with sidebar navigation
- Contains: Chat pages, shared components
- Key files: `+layout.svelte`, `chat/[id]/+page.svelte`, `components/app-sidebar.svelte`, `components/page-header.svelte`

**src/routes/(settings-page)/settings/:**
- Purpose: Settings pages with two layout variants
- Contains: Center-aligned and full-width settings pages
- Key files: `(center)/general-settings/+page.svelte`, `(center)/account-settings/+page.svelte`, `(center)/mcp-settings/+page.svelte`, `(full-width)/model-settings/+page.svelte`, `(full-width)/plugins/+page.svelte`

**src/routes/shell/:**
- Purpose: Shell window wrapper for multi-tab management
- Contains: Tab bar layout and components
- Key files: `+layout.svelte`, `[id]/+page.svelte`, `components/tab-bar/tab-bar.svelte`

**src/lib/components/ui/:**
- Purpose: Shadcn-svelte base UI components
- Contains: 60+ reusable UI primitives
- Key files: `button/`, `dialog/`, `sidebar/`, `data-table/`, `select/`, `input/`, `textarea/`, `dropdown-menu/`, `popover/`, `tooltip/`, `tabs/`, `card/`, `alert/`, `badge/`, `scroll-area/`, `resizable/`

**src/lib/components/buss/:**
- Purpose: Business-specific components
- Contains: Domain components for chat, models, providers, MCP, themes, plugins
- Key files: `chat/`, `model-select/`, `model-list/`, `provider-list/`, `mcp-server-selector/`, `mcp-server-form/`, `theme-switcher/`, `prompt-editor/`, `markdown/`, `editor/`, `settings/`, `quick-prompt/`, `skill-list/`

**src/lib/stores/:**
- Purpose: Reactive state management with Svelte 5 runes
- Contains: Singleton store classes with persistence
- Key files: `chat-state.svelte.ts`, `provider-state.svelte.ts`, `thread-state.svelte.ts`, `mcp-state.svelte.ts`, `tab-bar-state.svelte.ts`, `session-state.svelte.ts`, `marketplace-state.svelte.ts`, `plugin-state.svelte.ts`, `theme.state.svelte.ts`, `preferences-settings.state.svelte.ts`, `general-settings.state.svelte.ts`

**src/lib/stores/code-agent/:**
- Purpose: Code agent specific state management
- Contains: Claude Code sandbox state, taskboard state
- Key files: `code-agent-state.svelte.ts`, `claude-code-state.svelte.ts`, `claude-code-sandbox-state.svelte.ts`, `code-agent-taskboard-state.svelte.ts`, `code-agent-global-configs-state.svelte.ts`

**src/lib/api/:**
- Purpose: Frontend API layer for backend communication
- Contains: API client functions
- Key files: `models.ts`, `sandbox-*.ts`, `302-mcp-servers.ts`, `suggestions-generation.ts`, `title-generation.ts`

**src/lib/transport/:**
- Purpose: Chat transport abstraction
- Contains: Transport implementations for AI SDK
- Key files: `dynamic-chat-transport.ts`, `f-chat-transport.ts`

**src/lib/hooks/:**
- Purpose: Custom Svelte hooks and utilities
- Contains: Reusable reactive patterns
- Key files: `persisted-state.svelte.ts`

**src/lib/theme/:**
- Purpose: Theme system implementation
- Contains: Theme parser, config, types
- Key files: `theme-types.ts`, `theme-config.ts`, `theme-parser.ts`, `ds.css`

**src/shared/:**
- Purpose: Code shared between main and renderer processes
- Contains: Types, storage schemas, utilities, constants
- Key files: `types/`, `storage/`, `config/`, `constants/`, `utils/`

**packages/plugin-sdk/:**
- Purpose: Plugin development SDK
- Contains: Plugin API definitions, types, utilities
- Key files: Package workspace for plugin development

**vite-plugins/ipc-service-generator/:**
- Purpose: Custom Vite plugin for IPC code generation
- Contains: Parser, generator, types
- Key files: `index.ts`, `parser.ts`, `generator.ts`, `types.ts`

## Key File Locations

**Entry Points:**
- `electron/main/index.ts`: Main process entry
- `src/routes/+layout.svelte`: Root renderer layout
- `src/routes/shell/+layout.svelte`: Shell window layout
- `src/routes/(with-sidebar)/chat/[id]/+page.svelte`: Chat page
- `electron/main/server/router.ts`: Backend server entry

**Configuration:**
- `vite.config.ts`: Renderer build config
- `vite.main.config.ts`: Main process build config
- `vite.preload.config.ts`: Preload build config
- `svelte.config.js`: SvelteKit config
- `forge.config.ts`: Electron packaging config
- `tsconfig.json`: TypeScript config
- `eslint.config.js`: ESLint config
- `.prettierrc`: Prettier config
- `tailwind.config.ts`: TailwindCSS config (in vite.config.ts)

**Core Logic:**
- `src/lib/stores/chat-state.svelte.ts`: Chat state management
- `src/lib/transport/dynamic-chat-transport.ts`: AI streaming transport
- `electron/main/server/router.ts`: AI request handling
- `electron/main/services/storage-service/index.ts`: Data persistence
- `electron/main/services/thread-service/index.ts`: Thread management
- `electron/main/services/code-agent-service/index.ts`: Code agent operations

**Testing:**
- `e2e/`: Playwright E2E tests
- `vitest-setup-client.ts`: Vitest setup

## Naming Conventions

**Files:**
- Components: `kebab-case.svelte` (e.g., `chat-input.svelte`, `model-select.svelte`)
- Stores: `kebab-case.svelte.ts` (e.g., `chat-state.svelte.ts`, `provider-state.svelte.ts`)
- Types: `kebab-case.ts` (e.g., `chat-types.ts`, `theme-types.ts`)
- Utilities: `kebab-case.ts` (e.g., `file-preview.ts`, `error-handler.ts`)
- Routes: `+page.svelte`, `+layout.svelte`, `+page.ts`, `+layout.ts` (SvelteKit convention)

**Directories:**
- Services: `kebab-case/` with `index.ts` (e.g., `window-service/`, `thread-service/`)
- Components: `kebab-case/` (e.g., `chat-input/`, `model-select/`)
- Route groups: `(group-name)/` (e.g., `(with-sidebar)/`, `(settings-page)/`)
- Dynamic routes: `[param]/` (e.g., `[id]/`, `[provider]/`)

**Classes:**
- Services: `PascalCase` + `Service` suffix (e.g., `WindowService`, `ThreadService`)
- Stores: `PascalCase` + `State` suffix (e.g., `ChatState`, `ProviderState`)
- Utilities: `PascalCase` (e.g., `ChatErrorHandler`, `DynamicChatTransport`)

**Variables:**
- Store instances: `camelCase` + `State` suffix (e.g., `chatState`, `providerState`)
- Service instances: `camelCase` + `Service` suffix (e.g., `windowService`, `threadService`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_SHORTCUTS`, `THINKING_BUDGET_MAP`)

## Where to Add New Code

**New Chat Feature:**
- Primary code: `src/lib/stores/chat-state.svelte.ts` (state), `src/routes/(with-sidebar)/chat/components/` (UI)
- Tests: `e2e/` (E2E tests)
- Types: `src/lib/types/chat.ts` or `src/shared/types/`

**New Settings Page:**
- Implementation: `src/routes/(settings-page)/settings/(center|full-width)/new-setting/+page.svelte`
- State: `src/lib/stores/new-setting.state.svelte.ts`
- Navigation: Update `src/routes/(with-sidebar)/components/app-sidebar.svelte`

**New IPC Service:**
- Service class: `electron/main/services/new-service/index.ts`
- Export: Add to `electron/main/services/index.ts`
- Auto-generation: Run `pnpm run generate:ipc` or restart dev server
- Usage: `window.electronAPI.newService.methodName()`

**New UI Component:**
- Base component: `src/lib/components/ui/new-component/` (if reusable primitive)
- Business component: `src/lib/components/buss/new-component/` (if domain-specific)
- Export: Add to component index file

**New Store:**
- Implementation: `src/lib/stores/new-feature-state.svelte.ts`
- Pattern: Extend `PersistedState` if persistence needed
- Export: Add to `src/lib/stores/index.ts` if needed

**New Route:**
- Page: `src/routes/new-route/+page.svelte`
- Layout: `src/routes/new-route/+layout.svelte` (if custom layout needed)
- Data loading: `src/routes/new-route/+page.ts` (if server-side data needed)

**Utilities:**
- Shared helpers: `src/lib/utils/new-utility.ts` (renderer-only)
- Main process helpers: `electron/main/utils/new-utility.ts` (main-only)
- Shared utilities: `src/shared/utils/new-utility.ts` (both processes)

**Types:**
- Renderer types: `src/lib/types/new-types.ts`
- Shared types: `src/shared/types/new-types.ts`
- Storage schemas: `src/shared/storage/new-schema.ts`

## Special Directories

**electron/main/generated/:**
- Purpose: Auto-generated IPC bindings
- Generated: Yes (by vite-plugins/ipc-service-generator)
- Committed: Yes (for build reproducibility)
- Note: DO NOT EDIT MANUALLY - regenerate via `pnpm run generate:ipc`

**src/lib/paraglide/:**
- Purpose: Generated i18n code
- Generated: Yes (by Inlang Paraglide)
- Committed: Yes
- Note: Generated from `messages/*.json` files

**.svelte-kit/:**
- Purpose: SvelteKit build artifacts
- Generated: Yes (by SvelteKit)
- Committed: No (gitignored)

**.vite/:**
- Purpose: Vite build output for Electron
- Generated: Yes (by Vite)
- Committed: No (gitignored)

**storage/:**
- Purpose: Runtime application data
- Generated: Yes (at runtime)
- Committed: No (gitignored)
- Note: Contains user data, threads, settings

**out/:**
- Purpose: Electron Forge packaging output
- Generated: Yes (by Electron Forge)
- Committed: No (gitignored)

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes (by pnpm)
- Committed: No (gitignored)

---

*Structure analysis: 2026-02-02*
