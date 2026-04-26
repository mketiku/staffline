---
title: Music Note Creator API
emoji: 🎵
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Music Note Creator API

FastAPI backend that converts MP3 audio to MusicXML sheet music using Spotify's
basic-pitch for pitch detection and music21 for notation export.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/transcribe` | Upload MP3, receive MusicXML string |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed CORS origins |

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
