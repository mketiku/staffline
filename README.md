# stafflines — frontend

Vite + React app. See the [root README](../README.md) for the full quickstart.

## Local development

```bash
bun install
bun dev        # :5274 — proxies /transcribe to localhost:8000
```

No `.env` needed for local dev. The Vite dev server proxies API calls to the
backend automatically. Set `VITE_API_URL` only for production (Vercel).

## Environment variables

| Variable       | Required  | Description                          |
| -------------- | --------- | ------------------------------------ |
| `VITE_API_URL` | prod only | Backend base URL (HF Space endpoint) |

## Deployment

Push to Vercel. Set `VITE_API_URL` to your Hugging Face Space URL in the
Vercel project settings.
