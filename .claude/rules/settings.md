---
paths:
  - "app/src/utils/config/**"
---

# Adding New Settings

1. Update schema in `app/src/utils/config/settings.ts`
2. Add to `DEFAULT_SETTINGS`
3. Add to `SETTINGS_DOCS` (for CLI display)
4. Access via `useSettings()` hook
5. Document in `CLAUDE.md`
