Review recently changed code for quality, reuse, and efficiency — then fix any issues found.

## Instructions

1. Run `git diff HEAD` (or `git diff main...HEAD` for the full branch) to identify all changed files.
2. Read each changed file and evaluate against the project's standards:

### What to look for

**Duplication & reuse**

- Business logic duplicated across files
- Inline fetch logic that could use the existing `src/lib/api.ts` helper
- Class strings copy-pasted instead of extracted into a component or `cn()` call

**Code quality**

- `console.log`, `console.warn`, or `console.error` left in production code — remove them
- `any` types — replace with named interfaces or `unknown` + type guard
- Unnecessary `useMemo` / `useCallback` without a proven re-render problem

**Correctness**

- Missing error boundaries around OSMD rendering
- File type validation missing in upload handler
- State machine transitions that can get stuck (e.g. `loading` with no timeout)

**Structure**

- Feature code leaking into `src/lib/` (keep API/utils generic)
- Helpers or abstractions created for one-time use — inline instead
- Speculative complexity beyond what the task required
- New component without a colocated test file

3. Fix all issues found. Preserve behavior — this is cleanup, not a rewrite.
4. Run `bun run lint` and `bun run typecheck` to confirm no regressions.
5. Summarize what was changed and why.
