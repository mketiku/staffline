# stafflines

Upload an MP3, get sheet music. Pitch detection via Spotify's [basic-pitch](https://github.com/spotify/basic-pitch), rendered in-browser with [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org/).

## Stack

| Layer    | Tech                                          | Host                |
| -------- | --------------------------------------------- | ------------------- |
| Frontend | Vite 6 · React 19 · TypeScript · Tailwind v4  | Vercel              |
| Backend  | FastAPI · basic-pitch · music21 · Python 3.11 | Hugging Face Spaces |

## Local development

**Frontend**

```bash
cp .env.example .env.local
bun install
bun dev
```

**Backend**

```bash
cd ../backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8100
```

Set `VITE_API_URL=http://localhost:8100` in `.env.local`.

## Deployment

- **Frontend** — `vercel deploy`, set `VITE_API_URL` to your HF Space URL
- **Backend** — push `../backend/` to a Hugging Face Space with Docker SDK (port 7860)

## Limitations

- Best results on single-instrument, melodic audio
- Complex chords and multi-instrument tracks will have reduced accuracy
- Max file size: 50 MB
