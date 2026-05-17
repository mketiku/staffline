import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeAudio, transcribeAudioStream } from './api';

function mockResponse(opts: {
  ok: boolean;
  status?: number;
  json?: unknown;
  body?: ReadableStream<Uint8Array> | null;
}) {
  return {
    ok: opts.ok,
    status: opts.status ?? 200,
    json: vi.fn().mockResolvedValue(opts.json ?? {}),
    body: opts.body ?? null,
  } as unknown as Response;
}

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  let i = 0;
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

function sseChunk(event: object) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

describe('transcribeAudio', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('returns musicxml on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: true, json: { musicxml: '<score/>' } })
    );
    const result = await transcribeAudio(
      new File([''], 'test.mp3', { type: 'audio/mpeg' })
    );
    expect(result).toBe('<score/>');
  });

  it('throws with the detail field on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: false, status: 400, json: { detail: 'Bad file' } })
    );
    await expect(transcribeAudio(new File([''], 'test.mp3'))).rejects.toThrow(
      'Bad file'
    );
  });

  it('uses "HTTP <status>" when the error response has no detail field', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: false, status: 400, json: {} })
    );
    await expect(transcribeAudio(new File([''], 'test.mp3'))).rejects.toThrow(
      'HTTP 400'
    );
  });

  it('throws "Unknown error" when the error response body cannot be parsed', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('parse error')),
    } as unknown as Response);
    await expect(transcribeAudio(new File([''], 'test.mp3'))).rejects.toThrow(
      'Unknown error'
    );
  });
});

describe('transcribeAudioStream', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('calls onStage for each non-terminal event and returns musicxml', async () => {
    const chunks = [
      sseChunk({ stage: 'validating', pct: 10 }),
      sseChunk({ stage: 'analyzing', pct: 50 }),
      sseChunk({ stage: 'done', pct: 100, musicxml: '<score/>' }),
    ];
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: true, body: makeStream(chunks) })
    );

    const onStage = vi.fn();
    const result = await transcribeAudioStream(
      new File([''], 'test.mp3'),
      onStage
    );

    expect(result).toBe('<score/>');
    expect(onStage).toHaveBeenCalledWith({ stage: 'validating', pct: 10 });
    expect(onStage).toHaveBeenCalledWith({ stage: 'analyzing', pct: 50 });
    expect(onStage).toHaveBeenCalledWith({
      stage: 'done',
      pct: 100,
      musicxml: '<score/>',
    });
  });

  it('handles an event split across two chunks', async () => {
    const full = sseChunk({ stage: 'done', pct: 100, musicxml: '<score/>' });
    const mid = Math.floor(full.length / 2);
    const chunks = [full.slice(0, mid), full.slice(mid)];
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: true, body: makeStream(chunks) })
    );
    const result = await transcribeAudioStream(
      new File([''], 'test.mp3'),
      vi.fn()
    );
    expect(result).toBe('<score/>');
  });

  it('throws on non-ok response with detail', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({
        ok: false,
        status: 422,
        json: { detail: 'Unprocessable' },
      })
    );
    await expect(
      transcribeAudioStream(new File([''], 'test.mp3'), vi.fn())
    ).rejects.toThrow('Unprocessable');
  });

  it('uses "HTTP <status>" when stream error response has no detail field', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: false, status: 503, json: {} })
    );
    await expect(
      transcribeAudioStream(new File([''], 'test.mp3'), vi.fn())
    ).rejects.toThrow('HTTP 503');
  });

  it('skips non-data SSE lines and still finds the done event', async () => {
    const chunks = [
      `id: 1\n\ndata: ${JSON.stringify({ stage: 'done', pct: 100, musicxml: '<score/>' })}\n\n`,
    ];
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: true, body: makeStream(chunks) })
    );
    const result = await transcribeAudioStream(
      new File([''], 'test.mp3'),
      vi.fn()
    );
    expect(result).toBe('<score/>');
  });

  it('throws when stream ends without a done event', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: true, body: makeStream([]) })
    );
    await expect(
      transcribeAudioStream(new File([''], 'test.mp3'), vi.fn())
    ).rejects.toThrow('Stream ended without a result');
  });

  it('throws when stream contains an error event', async () => {
    const chunks = [
      sseChunk({ stage: 'error', pct: 0, detail: 'Server crashed' }),
    ];
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ ok: true, body: makeStream(chunks) })
    );
    await expect(
      transcribeAudioStream(new File([''], 'test.mp3'), vi.fn())
    ).rejects.toThrow('Server crashed');
  });
});
