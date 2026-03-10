---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.integration.test.ts"
  - "**/*.integration.test.tsx"
  - "**/*.snapshot.test.ts"
  - "**/*.snapshot.test.tsx"
---

# Testing

**When writing or modifying tests, invoke the appropriate skill before proceeding:**

```
Is this a snapshot test (*.snapshot.test.tsx)?
  Yes → invoke /writing-snapshot-tests

Does this test require keyboard input or test infrastructure (sockets, registry)?
  Yes → invoke /writing-integration-tests

Otherwise → invoke /writing-unit-tests
```

## Shared Conventions

**Describe naming** — ONE root `describe` per file (ESLint enforced):
- Hyphen-case files: parent-folder + filename → `describe('feedback decision', ...)`
- CamelCase files: filename only → `describe('useNavigationKeys', ...)`
- Integration tests: append `integration` → `describe('feedback delete-behavior integration', ...)`
- Snapshot tests: append `snapshots` → `describe('Plan snapshots', ...)`

**Fixture scoping** — `beforeEach`/`afterEach` must be inside the `describe` block, not at file root.

**Mocking** — Never use `mock.module()` — Bun bug #12823 leaks mocks between files, causing cascading failures across the entire test suite.

## Quirks

- Always append `2>&1` — Bun writes test failures to stderr
- Never run bare `bun test` — it runs ALL tests. Use `bun run test` / `bun run test:integration`
- Integration tests may be flaky — retry the specific file before rerunning everything
- Always call `cleanup()` in `afterEach` for any test that calls `render` from `ink-testing-library` — Bun runs all files in one process, Ink signal handlers accumulate
