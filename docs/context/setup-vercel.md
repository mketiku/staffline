# Vercel Setup Guide

Hosts the Vite frontend. Requires the HF Space to be running first.

## 1. Deploy

```bash
# From the staffline repo root
bunx vercel
```

Follow the prompts to link your Vercel account and create the project.

## 2. Set environment variable

```bash
bunx vercel env add VITE_API_URL production
# Enter: https://mketiku-staffline-api.hf.space
```

## 3. Deploy to production

```bash
bunx vercel --prod
```

## 4. Update CORS on the backend

Once you have your Vercel URL, go to HF Space → **Settings** → **Variables and Secrets**:

| Key               | Value                          |
| ----------------- | ------------------------------ |
| `ALLOWED_ORIGINS` | `https://staffline.vercel.app` |

The Space restarts automatically.

## End-to-end checklist

- [ ] HF Space status is **Running** and `/health` returns `{"status":"ok"}`
- [ ] `VITE_API_URL` set in Vercel env vars
- [ ] Frontend redeployed after env var added
- [ ] `ALLOWED_ORIGINS` set in HF Space
- [ ] Upload an MP3 and verify sheet music renders

## Local development

```bash
# Terminal 1 — backend
cd ../backend && source .venv/bin/activate
uvicorn main:app --reload --port 8100

# Terminal 2 — frontend (repo root)
bun dev  # port 5274
```

Set `VITE_API_URL=http://localhost:8100` in `.env.local`.
