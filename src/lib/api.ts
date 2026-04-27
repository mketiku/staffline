const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export type TranscribeStage =
  | { stage: 'validating'; pct: number }
  | { stage: 'analyzing'; pct: number }
  | { stage: 'exporting'; pct: number }
  | { stage: 'done'; pct: number; musicxml: string }
  | { stage: 'error'; pct: number; detail: string };

export async function transcribeAudio(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_URL}/transcribe`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(
      (error as { detail?: string }).detail ?? `HTTP ${res.status}`
    );
  }

  const data = (await res.json()) as { musicxml: string };
  return data.musicxml;
}

export async function transcribeAudioStream(
  file: File,
  onStage: (event: TranscribeStage) => void
): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_URL}/transcribe/stream`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(
      (error as { detail?: string }).detail ?? `HTTP ${res.status}`
    );
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  function processBuffer() {
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';
    for (const chunk of lines) {
      const line = chunk.trim();
      if (!line.startsWith('data: ')) continue;
      const event = JSON.parse(line.slice(6)) as TranscribeStage;
      onStage(event);
      if (event.stage === 'done') return event.musicxml;
      if (event.stage === 'error') throw new Error(event.detail);
    }
    return null;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      const result = processBuffer();
      if (result) return result;
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const result = processBuffer();
    if (result) return result;
  }

  throw new Error('Stream ended without a result');
}
