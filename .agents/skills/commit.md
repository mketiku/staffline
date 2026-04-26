---
name: commit
description: Use before every git commit or push. Runs the quality gate steps (typecheck, lint, tests) and organizes conventional commits.
---

# Skill: Commit Workflow

Use this skill whenever you're about to commit and push changes.

## Steps

### 1. Typecheck

```bash
bun run typecheck
```

### 2. Lint

```bash
bun run lint
```

Fix all lint errors. Never disable rules to make the check pass.

### 3. Tests

```bash
bun run test:run
```

All tests must pass. Fix failures — never weaken a test to make it pass.

### 4. Organize Commits

- `feat(scope): ...` — new functionality
- `fix(scope): ...` — bug fix
- `refactor(scope): ...` — restructuring without behavior change
- `test(scope): ...` — test additions or changes
- `chore(scope): ...` — tooling, config, deps
- `docs(scope): ...` — documentation only

Scopes: `upload`, `transcription`, `ui`, `api`, `backend`

### 5. Commit

```bash
git commit -m "$(cat <<'EOF'
type(scope): concise summary (7-14 words)
EOF
)"
```

For non-code changes append `[skip ci]` to skip a Vercel build.

### 6. Push

```bash
git push
```

## Rules

- Never use `--no-verify` unless the user explicitly asks.
- Never commit without running typecheck + lint first.
- Never amend a published commit — create a new one.
- Never commit secrets or `.env` files.
