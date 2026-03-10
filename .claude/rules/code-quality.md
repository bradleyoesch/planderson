# Code Quality

- **Context over props** — read from `useSettings()`, `useTerminal()`, `usePlanViewStaticContext()`, `usePlanViewDynamicContext()` directly; don't pass context values as props
- **Static vs dynamic context** — use static for immutable parsed content, dynamic for state that changes during interaction; subscribing to the wrong one causes unnecessary re-renders
- **Logging** — pass `__filename` as first arg to `logEvent()`/`logError()`; `console.error()` is invisible in hook/background contexts
