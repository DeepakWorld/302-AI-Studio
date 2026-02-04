# Testing Patterns

**Analysis Date:** 2026-02-02

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: `vitest-setup-client.ts` for client-side setup

**Assertion Library:**
- `@testing-library/jest-dom` 6.8.0 (vitest integration)
- `@testing-library/svelte` 5.2.8 for Svelte component testing

**Run Commands:**
```bash
pnpm run test:unit       # Run unit tests with Vitest
pnpm run test:e2e        # Run E2E tests with Playwright
pnpm run test            # Run all tests (unit + e2e)
```

## Test File Organization

**Location:**
- E2E tests: `e2e/` directory (separate from source)
- Unit tests: Not currently implemented (framework configured but no test files found)

**Naming:**
- E2E tests: `*.test.ts` (e.g., `demo.test.ts`)
- Unit tests: Would follow `*.test.ts` or `*.spec.ts` pattern

**Structure:**
```
302-AI-Studio-sv/
├── e2e/
│   └── demo.test.ts          # E2E tests (currently commented out)
├── vitest-setup-client.ts    # Vitest setup for client-side tests
└── playwright.config.ts      # Playwright E2E configuration
```

## Test Structure

**Suite Organization:**
Currently minimal test implementation. E2E test example (commented out):

```typescript
// import { expect, test } from "@playwright/test";

// test("home page has expected h1", async ({ page }) => {
//   await page.goto("/");
//   await expect(page.locator("h1")).toBeVisible();
// });
```

**Patterns:**
- E2E tests use Playwright's `test` and `expect` API
- Tests follow AAA pattern (Arrange, Act, Assert)
- Async/await for all E2E operations

## Mocking

**Framework:** Vitest's built-in `vi` mock utilities

**Patterns:**
Setup in `vitest-setup-client.ts` for browser API mocks:

```typescript
import { vi } from "vitest";

// Mock matchMedia for Svelte 5 + jsdom compatibility
Object.defineProperty(window, "matchMedia", {
  writable: true,
  enumerable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

**What to Mock:**
- Browser APIs not supported by jsdom (e.g., `matchMedia`)
- External service calls
- Electron IPC calls (when testing renderer code)

**What NOT to Mock:**
- Internal business logic
- Svelte components (test integration, not isolation)
- State management (test real behavior)

## Fixtures and Factories

**Test Data:**
Not currently implemented. Would follow pattern:

```typescript
// Example pattern (not in codebase)
export const createMockMessage = (overrides?: Partial<ChatMessage>): ChatMessage => ({
  id: nanoid(),
  role: "user",
  parts: [{ type: "text", text: "Test message" }],
  ...overrides,
});
```

**Location:**
Would be placed in test utility files (e.g., `src/lib/test-utils/` or `e2e/fixtures/`)

## Coverage

**Requirements:** Not enforced (no coverage thresholds configured)

**View Coverage:**
```bash
# Coverage not explicitly configured in package.json
# Would typically use: vitest --coverage
```

## Test Types

**Unit Tests:**
- Framework configured (Vitest + Testing Library)
- No unit tests currently implemented
- Would test: Utility functions, state management classes, type guards

**Integration Tests:**
- Not currently implemented
- Would test: Component interactions, store integrations, IPC communication

**E2E Tests:**
- Framework: Playwright 1.55.0
- Config: `playwright.config.ts`
- Test directory: `e2e/`
- Web server: Builds and previews on port 4173
- Currently minimal (demo test commented out)

## Common Patterns

**Async Testing:**
E2E tests use async/await pattern:

```typescript
test("example test", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("selector")).toBeVisible();
});
```

**Error Testing:**
Not currently implemented. Would follow pattern:

```typescript
// Example pattern (not in codebase)
test("handles error gracefully", async () => {
  const errorHandler = new ChatErrorHandler();
  expect(() => errorHandler.throwError()).toThrow();
});
```

## Testing Setup

**Vitest Setup:**
- File: `vitest-setup-client.ts`
- Imports: `@testing-library/jest-dom/vitest` for DOM matchers
- Browser mocks: `matchMedia` for Svelte 5 compatibility
- Comment indicates: "add more mocks here if you need them"

**Playwright Setup:**
- Config: `playwright.config.ts`
- Web server command: `npm run build && npm run preview`
- Port: 4173
- Test directory: `e2e`

## Testing Gaps

**Current State:**
- E2E framework configured but tests commented out
- Unit test framework configured but no tests written
- No integration tests
- No coverage reporting configured
- No CI/CD test automation visible

**Recommended Test Coverage:**
- State management classes (`chat-state.svelte.ts`, `provider-state.svelte.ts`)
- Utility functions (`error-handler.ts`, `clone.ts`, `markdown-code-block.ts`)
- IPC service generators
- Component rendering and interactions
- E2E user flows (chat, settings, code agent)

## Pre-commit Hooks

**Configuration:** `.pre-commit-config.yaml`
- ESLint validation
- Prettier formatting
- Svelte-check type validation
- Conventional commit validation
- Tests NOT run in pre-commit hooks

**Installation:**
```bash
pnpm run postinstall  # Installs pre-commit hooks
```

---

*Testing analysis: 2026-02-02*
