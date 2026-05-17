---
name: validation
description: Use for proactive pre-commit/pre-push validation, or to diagnose a failing CI check or git hook.
---

# Skill: Validation

## How Hooks Work

- **pre-commit**: runs `lint-staged` (lint + format staged files)
- **pre-push**: runs lint + typecheck in parallel, then tests

Both call `node scripts/run-hook-checks.mjs <mode>`.

## Proactive Validation

```bash
bun run lint
bun run typecheck
bun run test:run
bun run build
```

## Diagnosing a Failure

```bash
bun run lint          # lint only
bun run typecheck     # typecheck only
bun run test:run      # tests without coverage (faster)
bun run test:coverage # with thresholds (what CI runs)
```

## Escalation

| Failure                  | Fix                                                  |
| ------------------------ | ---------------------------------------------------- |
| Lint error               | Fix manually or `bun run lint:fix`                   |
| Type error               | Fix the code. Never use `any` or `@ts-ignore`        |
| Test failure             | Fix the code — never weaken a test                   |
| Coverage below threshold | Write missing tests                                  |
| Build failure            | Usually a type error — run `bun run typecheck` first |

Bypassing the pre-push hook with `--no-verify` requires explicit user consent.
