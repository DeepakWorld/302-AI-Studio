# Codebase Concerns

**Analysis Date:** 2026-02-02

## Tech Debt

**Incomplete Stream Reconnection:**
- Issue: `reconnectToStream` method in FChatTransport returns null with TODO comment
- Files: `src/lib/transport/f-chat-transport.ts:130`
- Impact: Chat sessions cannot resume after disconnection, users lose context on network interruptions
- Fix approach: Implement reconnection logic using stored message history and session state

**Plugin i18n Integration Missing:**
- Issue: Plugin API hardcodes locale to "en", not integrated with app i18n system
- Files: `electron/main/plugin-manager/plugin-api.ts:317-318`, `electron/main/plugin-manager/plugin-api.ts:334-335`
- Impact: Plugins cannot respect user language preferences, poor UX for non-English users
- Fix approach: Pass app locale from generalSettingsStorage to plugin API context

**Plugin Update System Incomplete:**
- Issue: Plugin update checking reads plugin.json but logic is commented out
- Files: `electron/main/services/plugin-service.ts:304-308`
- Impact: Users cannot receive plugin updates, must manually reinstall
- Fix approach: Implement repository/update URL checking from plugin.json metadata

**Deprecated Utility Function:**
- Issue: `createUIMessageStreamFromText` marked deprecated but still in codebase
- Files: `electron/main/server/utils.ts:311-319`
- Impact: Technical debt accumulation, potential confusion for developers
- Fix approach: Migrate all usages to `createUIMessageStreamFromGenerator`, remove deprecated function

**GitHub Release Migration Pending:**
- Issue: GitHub publisher and release workflow marked for removal after user migration
- Files: `forge.config.ts:166`, `.github/workflows/release.yml:120`, `.github/workflows/release.yml:146`
- Impact: Maintaining dual update systems increases complexity and maintenance burden
- Fix approach: Monitor user migration metrics, remove GitHub publisher when adoption threshold met

**Massive Model Data File:**
- Issue: 302models.ts contains 12,373 lines of hardcoded model data
- Files: `src/lib/datas/302models.ts`
- Impact: Large bundle size, difficult to maintain, slow to update model information
- Fix approach: Move to external JSON file loaded on demand, implement caching strategy

## Known Bugs

**Local Agent UI Placeholder:**
- Symptoms: Comment indicates local agent UI not implemented
- Files: `src/routes/(with-sidebar)/chat/components/code-agent/code-agent-panel.svelte:125`
- Trigger: Attempting to use local agent functionality
- Workaround: Only cloud agents currently functional

**Skill Creation Methods Incomplete:**
- Symptoms: Only one creation method implemented, others marked TODO
- Files: `src/lib/components/buss/skill-list/skill-create-dialog.svelte:284`
- Trigger: Attempting to use alternative skill creation methods
- Workaround: Use default creation method only

## Security Considerations

**Web Security Disabled:**
- Risk: WebContents created with `webSecurity: false` and `sandbox: false`
- Files: `electron/main/factories/web-contents-factory.ts:58`, `electron/main/factories/web-contents-factory.ts:57`
- Current mitigation: Electron Fuses enabled for production builds
- Recommendations: Re-evaluate necessity of disabled web security, implement CSP headers, enable sandbox where possible

**Excessive Console Logging:**
- Risk: Sensitive data (API responses, user data) logged to console in production
- Files: 340+ console.log/warn/error occurrences across 50+ files in `src/`, extensive logging in `electron/main/apis/code-agent.ts`
- Current mitigation: None detected
- Recommendations: Implement logging levels, strip console.log in production builds, sanitize logged data

**No Environment Variable Validation:**
- Risk: Missing .env files, no validation of required environment variables
- Files: No .env files detected in project root
- Current mitigation: Configuration appears to use storage service instead
- Recommendations: Document required configuration, validate critical settings on startup

**Type Safety Bypasses:**
- Risk: Limited but present use of `any` types and `@ts-expect-error`
- Files: `src/lib/handlers/chat-handlers.ts:17`, `src/lib/api/taskboard/index.ts:22`, `src/shared/types.ts:75`, `src/routes/(settings-page)/settings/(full-width)/model-settings/[provider]/+page.svelte:394`
- Current mitigation: TypeScript strict mode enabled
- Recommendations: Refactor to use proper types, document why type bypasses are necessary

## Performance Bottlenecks

**Large Component Files:**
- Problem: Multiple components exceed 1000 lines, largest is 1880 lines
- Files: `src/lib/stores/chat-state.svelte.ts` (1880 lines), `src/routes/(settings-page)/settings/(full-width)/plugins/+page.svelte` (1447 lines), `src/routes/(with-sidebar)/chat/components/agent-preview/agent-preview-panel.svelte` (1404 lines), `src/routes/(with-sidebar)/chat/components/agent-preview/file-tree-state.svelte.ts` (1301 lines)
- Cause: Complex state management and UI logic not decomposed
- Improvement path: Extract reusable logic into composables, split large components into smaller focused components

**Synchronous File Operations:**
- Problem: Code agent file operations may block main thread
- Files: `electron/main/apis/code-agent.ts` (extensive file upload/download operations)
- Cause: Large file transfers without chunking or progress feedback
- Improvement path: Implement streaming file transfers, add progress indicators, use worker threads for heavy operations

**12K+ Line Data File:**
- Problem: Entire model catalog loaded into memory on app start
- Files: `src/lib/datas/302models.ts` (12,373 lines)
- Cause: Static import of massive data structure
- Improvement path: Lazy load model data, implement virtual scrolling for model lists, cache frequently accessed models

## Fragile Areas

**Window Tab State Management:**
- Files: `src/lib/stores/tab-bar-state.svelte.ts` (534 lines), `src/routes/shell/components/tab-bar/tab-bar.svelte` (485 lines)
- Why fragile: Complex state synchronization between main process and renderer, ghost windows for drag preview
- Safe modification: Always test tab creation, closing, and drag-drop scenarios; verify state persistence
- Test coverage: Only 1 test file in entire src/ directory (`src/lib/components/buss/markdown/markdown-renderer.test.ts`)

**Chat State Initialization:**
- Files: `src/lib/stores/chat-state.svelte.ts:54-99`
- Why fragile: Complex fallback logic for corrupted window.tab or window.thread data after reload
- Safe modification: Preserve all fallback checks, test with missing/corrupted temp files
- Test coverage: No unit tests detected for state initialization

**IPC Service Generation:**
- Files: `electron/main/generated/preload-services.ts`, `electron/main/generated/ipc-registration.ts`, `vite-plugins/ipc-service-generator/`
- Why fragile: Auto-generated code, changes to service signatures require regeneration
- Safe modification: Always run `pnpm run generate:ipc` after modifying service classes
- Test coverage: No tests for IPC generator

**MCP Server Management:**
- Files: `src/lib/stores/mcp-state.svelte.ts`, `electron/main/services/mcp-service/`
- Why fragile: External process management, tool discovery, stream handling
- Safe modification: Test with multiple MCP servers, verify cleanup on server disable/remove
- Test coverage: No MCP-specific tests detected

## Scaling Limits

**Single Hono Server Instance:**
- Current capacity: All AI streaming requests through localhost:8089
- Limit: Single-threaded Node.js server, no load balancing
- Scaling path: Implement worker pool for concurrent requests, add request queuing

**In-Memory Message Storage:**
- Current capacity: All chat messages stored in memory via Svelte stores
- Limit: Large conversations (1000+ messages) may cause memory pressure
- Scaling path: Implement message pagination, archive old messages to disk, lazy load message history

**File Tree State:**
- Current capacity: Entire sandbox file tree loaded into memory
- Limit: Large projects (10,000+ files) will cause performance degradation
- Scaling path: Implement virtual tree rendering, lazy load directory contents

## Dependencies at Risk

**Deprecated npm Packages:**
- Risk: Multiple deprecated dependencies in pnpm-lock.yaml
- Impact: Security vulnerabilities, compatibility issues with future Node.js versions
- Migration plan: Audit deprecated packages (tar, glob, rimraf, level-* packages), update to maintained alternatives

**Electron 38:**
- Risk: Rapid Electron release cycle, version 38 will become unsupported
- Impact: Security patches unavailable, compatibility issues with newer OS versions
- Migration plan: Establish quarterly Electron update schedule, test thoroughly before major version bumps

**Svelte 5 Runes:**
- Risk: Svelte 5 still relatively new, ecosystem catching up
- Impact: Limited community resources, potential breaking changes in minor versions
- Migration plan: Monitor Svelte 5 stability, pin versions carefully, maintain comprehensive tests

## Missing Critical Features

**Error Recovery:**
- Problem: Limited error recovery for failed AI requests
- Blocks: Users cannot retry failed messages without manual intervention
- Priority: High - affects core chat functionality

**Offline Mode:**
- Problem: No offline functionality, app requires network connection
- Blocks: Cannot use app during network outages, no local model support
- Priority: Medium - would improve reliability

**Request Cancellation:**
- Problem: No way to cancel in-progress AI requests
- Blocks: Users stuck waiting for long-running requests
- Priority: High - affects user experience

**Rate Limiting:**
- Problem: No client-side rate limiting for API requests
- Blocks: Users may hit provider rate limits unexpectedly
- Priority: Medium - affects reliability

## Test Coverage Gaps

**Core Chat Functionality:**
- What's not tested: Message sending, streaming, error handling, attachment processing
- Files: `src/lib/stores/chat-state.svelte.ts`, `src/lib/transport/`, `src/lib/handlers/chat-handlers.ts`
- Risk: Regressions in core functionality go undetected
- Priority: High

**IPC Services:**
- What's not tested: All 22+ IPC services lack unit tests
- Files: `electron/main/services/*/index.ts`
- Risk: Breaking changes to main-renderer communication
- Priority: High

**State Management:**
- What's not tested: 20+ Svelte stores have no tests
- Files: `src/lib/stores/*.svelte.ts`
- Risk: State synchronization bugs, memory leaks
- Priority: High

**Plugin System:**
- What's not tested: Plugin loading, sandboxing, API exposure
- Files: `electron/main/plugin-manager/`, `electron/main/services/plugin-service.ts`
- Risk: Security vulnerabilities, plugin crashes affecting app
- Priority: Medium

**Code Agent Operations:**
- What's not tested: Sandbox creation, file operations, terminal execution
- Files: `electron/main/apis/code-agent.ts`, `src/lib/api/sandbox-*.ts`
- Risk: Data loss, sandbox corruption
- Priority: High

**MCP Integration:**
- What's not tested: MCP server lifecycle, tool discovery, stream handling
- Files: `src/lib/stores/mcp-state.svelte.ts`, `electron/main/services/mcp-service/`
- Risk: Tool execution failures, resource leaks
- Priority: Medium

---

*Concerns audit: 2026-02-02*
