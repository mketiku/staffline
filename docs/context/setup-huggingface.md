# Hugging Face Spaces Setup Guide

Hosts the FastAPI backend (`../backend/`) as a Docker Space.

## 1. Create the Space

1. Go to huggingface.co/new-space
2. Space name: `staffline-api`
3. SDK: **Docker → Blank**
4. Hardware: **CPU Basic** (free)
5. Visibility: **Public**
6. Storage Bucket: **off** (backend uses temp files, nothing persists)
7. Click **Create Space**

## 2. Get an access token

Settings → Access Tokens → New token → **Write** permission

## 3. Add the HF remote

The backend lives at `~/Projects/staffline/backend/` — its own git repo.

```bash
cd ../backend
git remote add hf https://huggingface.co/spaces/mketiku/staffline-api
```

When prompted for credentials: username = HF username, password = HF token.

## 4. Push

```bash
git push hf main
```

## 5. Monitor the build

Space → **Logs** tab. First build takes 5–10 minutes (TensorFlow install).
Ready when status shows **Running**.

## 6. Verify

```bash
curl https://mketiku-staffline-api.hf.space/health
# {"status":"ok"}
```

## 7. Set environment variables

Space → **Settings** → **Variables and Secrets**:

| Key               | Value                                              |
| ----------------- | -------------------------------------------------- |
| `ALLOWED_ORIGINS` | your Vercel frontend URL (set after Vercel deploy) |

## Redeploying after backend changes

Commit your changes in the backend repo, then:

```bash
git push hf main
```

HF rebuilds automatically on every push.
