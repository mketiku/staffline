# Engineering Standards

## Architecture

Two-service split:

| Service  | Stack                           | Host                         |
| -------- | ------------------------------- | ---------------------------- |
| Frontend | Vite 6 + React 19 + TypeScript  | Vercel                       |
| Backend  | FastAPI + basic-pitch + music21 | Hugging Face Spaces (Docker) |

The frontend calls `POST /transcribe` on the backend, receives MusicXML, and
renders it with OpenSheetMusicDisplay (OSMD).

## Stack

- **Package manager:** Bun (`bun install`, `bun run`, `bunx`) — never npm or pnpm
- **Frontend:** Vite 6 · React 19 · TypeScript strict
- **Styling:** Tailwind v4 via `@tailwindcss/vite` — design tokens in `@theme {}`
- **Animations:** `motion/react` (Motion v12) — never `framer-motion`
- **Icons:** `lucide-react` only — no custom SVG icon components
- **Backend:** FastAPI · basic-pitch · music21 · Python 3.11

## Folder structure

```
src/
  components/ui/        # Atomic hand-rolled UI primitives
  features/
    upload/
      components/       # UploadZone
    transcription/
      components/       # SheetMusic
  lib/
    api.ts              # fetch wrapper → backend
    utils.ts            # cn() helper
```

## Styling conventions

- Design tokens live in `@theme {}` in `src/index.css`
- Color names: `canvas`, `surface`, `surface-raised`, `line`, `ink`, `ink-dim`, `gold`, `error`
- Class merging: `cn()` from `@/lib/utils` in every component with conditional classes
- **No shadcn**, **no CVA** — variants as plain TypeScript objects:
  ```ts
  const variants: Record<Variant, string> = { primary: '...', ghost: '...' };
  ```
- `cursor-pointer` on all interactive elements

## API

`src/lib/api.ts` exports one function: `transcribeAudio(file: File): Promise<string>`

Backend URL is controlled by `VITE_API_URL` (see `.env.example`).

## Environment variables

| Variable          | Used in  | Description                  |
| ----------------- | -------- | ---------------------------- |
| `VITE_API_URL`    | Frontend | Backend base URL             |
| `ALLOWED_ORIGINS` | Backend  | Comma-separated CORS origins |

## Commit style

Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`

## Build & Deploy

- **Vercel** (frontend only). Ignored Build Step: `bash scripts/vercel-build-skip.sh`
- `[skip ci]` skips GitHub Actions **and** Vercel — use for docs/config-only commits.
- `[skip vercel]` skips Vercel only (GitHub CI still runs) — set in the commit message.
- See `.agents/skills/ci-skip.md` for the full decision table.

## Skills (`.agents/skills/`)

| Skill          | When to use                                      |
| -------------- | ------------------------------------------------ |
| `commit`       | Before every `git commit` or `git push`          |
| `bug-hunt`     | Diagnosing any bug — broken flows, test failures |
| `tdd-workflow` | Every implementation, feature, or bug fix        |
| `validation`   | Pre-push checks, diagnosing hook failures        |
| `ci-skip`      | Deciding when/how to skip CI or Vercel builds    |

## Key constraints

- OSMD renders on a **white background** — wrap it in a white `bg-white` container
- basic-pitch requires `ffmpeg` in the Docker image (audio decoding)
- HF Spaces exposes port **7860**
- Accepted formats: MP3, M4A, AAC, WAV (enforced in both frontend and backend)
- Max upload size: 50 MB (enforced in both frontend hint and backend)
