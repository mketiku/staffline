---
name: tdd_workflow
description: Use for every new implementation, feature, or bug fix. Enforces Red-Green-Refactor with the Vitest + jsdom stack.
---

# Skill: TDD Workflow (Red-Green-Refactor)

## Workflow

### 1. RED: Write a Failing Test

```bash
bunx vitest run src/features/my/MyComponent.test.tsx
```

- Colocate tests with source (`MyComponent.tsx` → `MyComponent.test.tsx`)
- For bug fixes: write a regression test that reproduces the bug exactly
- Confirm the test fails for the **right reason** — not an import error

### 2. GREEN: Minimum Implementation

Write the simplest code that makes the test pass.

```bash
bunx vitest run src/features/my/MyComponent.test.tsx
```

### 3. REFACTOR

```bash
bun run lint
bun run typecheck
```

- Remove all `console.log` statements
- No `any`, no `@ts-ignore`

### 4. Final Verification

```bash
bun run test:coverage   # full suite + thresholds
bun run build           # must succeed
```

## Test placement

| Needs                           | File suffix |
| ------------------------------- | ----------- |
| Pure logic, utils               | `.test.ts`  |
| `render`, `screen`, `userEvent` | `.test.tsx` |

## Thresholds

70% lines / statements / branches · 60% functions

> A task is not complete until `bun run test:coverage` and `bun run build` both pass.
