const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

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
