# Technology Stack

**Analysis Date:** 2026-02-02

## Languages

**Primary:**
- TypeScript 5.9.2 - All application code (frontend, electron main/preload)
- JavaScript (ESNext) - Configuration files and build scripts

**Secondary:**
- JSON - Configuration, i18n messages, storage data
- CSS - Styling (via TailwindCSS)

## Runtime

**Environment:**
- Node.js (version not pinned, managed via pnpm)
- Electron 38.1.0 - Desktop application runtime

**Package Manager:**
- pnpm 10.18.3 (enforced via packageManager field)
- Lockfile: pnpm-lock.yaml (present)
- Patches: @sveltejs/kit, @electron/notarize@3.1.0
- Overrides: @electron/notarize@3.1.0, @ai-sdk/provider@3.0.0, @ai-sdk/provider-utils@4.0.0

## Frameworks

**Core:**
- SvelteKit 2.39.1 - Frontend framework
- Svelte 5.38.10 - UI component framework with runes
- Electron Forge 7.9.0 - Electron build/package tooling

**Backend:**
- Hono 4.9.10 - HTTP server for AI streaming (localhost:8089)
- @hono/node-server 1.19.5 - Node.js adapter for Hono

**Testing:**
- Vitest 3.2.4 - Unit testing framework
- Playwright 1.55.0 - E2E testing framework
- @testing-library/svelte 5.2.8 - Component testing utilities
- jsdom 27.0.0 - DOM implementation for tests

**Build/Dev:**
- Vite 7.1.5 - Build tool and dev server
- @sveltejs/vite-plugin-svelte 6.2.0 - Svelte integration
- tsx 4.20.5 - TypeScript execution for scripts
- electron-forge plugins (vite, fuses, auto-unpack-natives)

## Key Dependencies

**Critical:**
- ai 6.0.1 - Vercel AI SDK for unified AI provider interface
- @ai-sdk/anthropic 3.0.0 - Anthropic Claude integration
- @ai-sdk/openai 3.0.0 - OpenAI integration
- @ai-sdk/google 3.0.0 - Google Gemini integration
- @ai-sdk/openai-compatible 2.0.0 - Generic OpenAI-compatible providers
- @302ai/ai-sdk 0.2.14 - Custom 302.AI provider SDK
- @ai-sdk/mcp 1.0.0 - Model Context Protocol integration
- @modelcontextprotocol/sdk 1.20.0 - MCP SDK for tool servers

**UI Components:**
- bits-ui 2.9.8 - Headless UI primitives (shadcn-svelte base)
- @lucide/svelte 0.544.0 - Icon library
- embla-carousel-svelte 8.6.0 - Carousel component
- svelte-sonner 1.0.5 - Toast notifications
- vaul-svelte 1.0.0-next.7 - Drawer component
- paneforge 1.0.2 - Resizable panes
- svelte-dnd-action 0.9.65 - Drag and drop
- svelte-image-viewer 5.0.0 - Image viewer
- emoji-picker-element 1.27.0 - Emoji picker

**Styling:**
- tailwindcss 4.1.13 - Utility-first CSS framework
- @tailwindcss/vite 4.1.13 - Vite integration
- @tailwindcss/forms 0.5.10 - Form styling
- @tailwindcss/typography 0.5.16 - Typography plugin
- tailwind-merge 3.3.1 - Class merging utility
- tailwind-variants 3.1.1 - Variant API
- tw-animate-css 1.3.8 - Animation utilities
- mode-watcher 1.1.0 - Dark/light mode management

**Code Editing:**
- codemirror 6.0.2 - Code editor
- @codemirror/lang-* - Language support (js, css, html, json, markdown, python, xml)
- @codemirror/theme-one-dark 6.1.3 - Dark theme
- lexical 0.33.1 - Rich text editor framework
- svelte-lexical 0.6.3 - Svelte bindings for Lexical

**Infrastructure:**
- @302ai/unstorage 1.18.0 - Unified storage layer with filesystem driver
- ky 1.11.0 - HTTP client library
- get-port 7.1.0 - Dynamic port allocation
- electron-window-state 5.0.3 - Window state persistence
- fix-path 5.0.0 - PATH environment fix for macOS

**Data Processing:**
- markdown-it 14.1.0 - Markdown parser
- markdown-it-texmath 1.0.0 - Math rendering for markdown
- katex 0.16.25 - LaTeX math rendering
- shiki 3.13.0 - Syntax highlighting
- shiki-stream 0.1.2 - Streaming syntax highlighting
- mermaid 11.12.2 - Diagram rendering
- @opendocsg/pdf2md 0.2.2 - PDF to markdown conversion
- mammoth 1.11.0 - DOCX to HTML conversion
- xlsx 0.18.5 - Excel file processing
- browser-image-compression 2.0.2 - Client-side image compression

**Utilities:**
- arktype 2.1.22 - Runtime type validation
- superjson 2.2.2 - JSON serialization with type preservation
- ts-pattern 5.9.0 - Pattern matching
- es-toolkit 1.39.10 - Modern utility library
- nanoid 5.1.5 - ID generation
- date-fns 4.1.0 - Date manipulation
- dedent 1.7.0 - String dedenting
- mitt 3.0.1 - Event emitter
- semver 7.7.3 - Semantic versioning
- archiver 7.0.1 - Archive creation
- extract-zip 2.0.1 - ZIP extraction

**Forms & Validation:**
- sveltekit-superforms 2.27.1 - Form handling
- formsnap 2.0.1 - Form utilities
- @internationalized/date 3.9.0 - Date internationalization

**Internationalization:**
- @inlang/paraglide-js 2.3.2 - i18n framework
- Base locale: Chinese (zh)
- Supported locales: English (en), Chinese (zh)

**Plugin System:**
- @302ai/studio-plugin-sdk workspace:* - Custom plugin SDK (workspace package)

**Code Quality:**
- eslint 9.35.0 - Linting
- @eslint/js 9.35.0 - ESLint JavaScript rules
- typescript-eslint 8.43.0 - TypeScript ESLint integration
- eslint-plugin-svelte 3.12.3 - Svelte linting
- eslint-config-prettier 10.1.8 - Prettier integration
- prettier 3.6.2 - Code formatting
- prettier-plugin-svelte 3.4.0 - Svelte formatting
- svelte-check 4.3.1 - Type checking for Svelte

## Configuration

**Environment:**
- No .env files used in production
- Configuration via Electron main process
- Storage in user data directory (managed by @302ai/unstorage)
- Development: `storage/` directory in project root
- Production: OS-specific user data path

**Build:**
- `vite.config.ts` - Renderer process (SvelteKit)
- `vite.main.config.ts` - Main process
- `vite.preload.config.ts` - Preload scripts
- `forge.config.ts` - Electron Forge packaging
- `svelte.config.js` - SvelteKit adapter configuration
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.js` - TailwindCSS configuration (if present)
- `.prettierrc` - Code formatting rules
- `eslint.config.js` - Linting rules
- `playwright.config.ts` - E2E test configuration
- `project.inlang/settings.json` - i18n configuration

## Platform Requirements

**Development:**
- Node.js (compatible with Electron 38.1.0)
- pnpm 10.18.3 (enforced)
- macOS/Windows/Linux support

**Production:**
- Electron 38.1.0 runtime (bundled)
- Deployment targets:
  - Windows: Squirrel installer, NSIS installer
  - macOS: DMG, ZIP (with code signing and notarization)
  - Linux: Deb, RPM, ZIP

**Electron Forge Makers:**
- @electron-forge/maker-squirrel 7.9.0 - Windows Squirrel
- @electron-addons/electron-forge-maker-nsis 7.0.2 - Windows NSIS
- @electron-forge/maker-dmg 7.9.0 - macOS DMG
- @electron-forge/maker-zip 7.9.0 - Cross-platform ZIP
- @electron-forge/maker-deb 7.9.0 - Debian package
- @electron-forge/maker-rpm 7.9.0 - RPM package

**Security:**
- @electron/fuses 2.0.0 - Electron security fuses
- @electron/osx-sign 2.2.0 - macOS code signing
- @electron/notarize 3.1.0 - macOS notarization (patched)

---

*Stack analysis: 2026-02-02*
