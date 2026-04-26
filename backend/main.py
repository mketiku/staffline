import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Music Note Creator API")

origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_MAX_BYTES = 50 * 1024 * 1024  # 50 MB


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if file.content_type not in ("audio/mpeg", "audio/mp3"):
        raise HTTPException(status_code=400, detail="Only MP3 files are supported")

    content = await file.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    with tempfile.TemporaryDirectory() as tmp:
        audio_path = Path(tmp) / "input.mp3"
        audio_path.write_bytes(content)
        try:
            musicxml = _transcribe(str(audio_path), tmp)
        except Exception as exc:
            raise HTTPException(
                status_code=422, detail=f"Transcription failed: {exc}"
            ) from exc

    return {"musicxml": musicxml}


def _transcribe(audio_path: str, tmp_dir: str) -> str:
    from basic_pitch.inference import predict
    from basic_pitch import ICASSP_2022_MODEL_PATH
    import music21

    _, midi_data, _ = predict(
        audio_path,
        ICASSP_2022_MODEL_PATH,
        minimum_note_length=0.1,
    )

    midi_path = os.path.join(tmp_dir, "output.midi")
    midi_data.write(midi_path)

    score = music21.converter.parse(midi_path)
    xml_path = os.path.join(tmp_dir, "output.musicxml")
    score.write("musicxml", fp=xml_path)

    with open(xml_path, "r", encoding="utf-8") as f:
        return f.read()
