---
name: bug-hunt
description: Use to investigate and fix a bug systematically. Emphasizes root cause analysis before writing any fix.
---

# Skill: Bug Hunt

**Never fix before you understand.** If the proposed cause doesn't fully explain all observed symptoms, keep digging.

## Step 1: Gather Symptoms

- What exactly is failing? (error message, blank screen, wrong data)
- When did it start? (recent deploy, dep update, backend change)
- Reproducible locally? On HF Spaces? Production only?

## Step 2: Common Axes

| Axis          | What to look for                                                     |
| ------------- | -------------------------------------------------------------------- |
| **Code path** | Execution order, null checks, async/await gaps                       |
| **Types**     | TypeScript errors, `any` escapes hiding mismatches                   |
| **API**       | Backend returning unexpected shape, CORS error, wrong `VITE_API_URL` |
| **OSMD**      | MusicXML malformed, container ref null on mount                      |
| **State**     | App stuck in `loading` state, missing error handling path            |

```bash
bun run typecheck   # often reveals the issue immediately
bunx vitest run src/path/to/failing.test.ts
```

## Step 3: Validate Root Cause

Confirm the diagnosis explains **all** symptoms before writing a fix.

## Step 4: Write a Failing Regression Test

Before changing production code, write a test that reproduces the bug.

## Step 5: Fix

Write the minimal fix that resolves the root cause — not the symptom.

## Step 6: Verify

```bash
bunx vitest run src/path/to/fixed.test.ts
bun run test:coverage
bun run build
```

> A bug is not fixed until a regression test exists and the full suite passes.
