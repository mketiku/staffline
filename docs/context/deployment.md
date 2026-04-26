# Deployment Guide

## Architecture

| Service  | Host                         | URL pattern                              |
| -------- | ---------------------------- | ---------------------------------------- |
| Frontend | Vercel                       | `https://staffline.vercel.app`           |
| Backend  | Hugging Face Spaces (Docker) | `https://mketiku-staffline-api.hf.space` |

---

## Backend — Hugging Face Spaces

### 1. Create the Space

1. Go to huggingface.co/new-space
2. Set Space name: `staffline-api`
3. Select SDK: **Docker → Blank**
4. Hardware: **CPU Basic** (free)
5. Visibility: **Public**
6. Click **Create Space**

### 2. Get an access token

Settings → Access Tokens → New token → **Write** permission

### 3. Push the backend

`backend/` is its own independent git repo — separate from the main staffline repo.

```bash
cd backend
git init
git add .
git commit -m "feat: initial backend"
git remote add origin https://huggingface.co/spaces/mketiku/staffline-api
git push -u origin main
```

When prompted: username = HF username, password = HF token.

### 4. Monitor the build

In your Space → **Logs** tab. First build takes 5–10 minutes (TensorFlow install).
The Space is ready when status shows **Running**.

### 5. Set environment variables

Space → **Settings** → **Variables and Secrets**:

| Key               | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| `ALLOWED_ORIGINS` | `https://staffline.vercel.app` (set after frontend deploy) |

---

## Frontend — Vercel

### 1. Deploy

```bash
# From the staffline repo root
bunx vercel
```

Follow the prompts to link your Vercel account and create the project.

### 2. Set environment variable

```bash
bunx vercel env add VITE_API_URL production
# Enter: https://mketiku-staffline-api.hf.space
```

### 3. Deploy to production

```bash
bunx vercel --prod
```

---

## End-to-end checklist

- [ ] HF Space status is **Running**
- [ ] `GET https://mketiku-staffline-api.hf.space/health` returns `{"status":"ok"}`
- [ ] Frontend deployed to Vercel
- [ ] `VITE_API_URL` set in Vercel env vars → redeployed
- [ ] `ALLOWED_ORIGINS` set in HF Space settings
- [ ] Upload an MP3 and verify sheet music renders

---

## Redeploying the backend

```bash
cd backend
git add .
git commit -m "fix: ..."
git push
```

HF rebuilds automatically on every push.

## Local development

```bash
# Terminal 1 — backend
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8100

# Terminal 2 — frontend
bun dev  # runs on port 5274
```

Set `VITE_API_URL=http://localhost:8100` in `.env.local`.
