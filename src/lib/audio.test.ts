import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashFile,
  computeWaveform,
  transcriptionCache,
  decodeAudio,
} from './audio';

describe('hashFile', () => {
  beforeEach(() => {
    // jsdom may not implement File.prototype.arrayBuffer — stub it.
    Object.defineProperty(File.prototype, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    });
  });

  it('returns a lowercase hex string', async () => {
    const mockDigest = new Uint8Array([0x1a, 0x2b, 0x3c, 0x4d, 0xfe]).buffer;
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn().mockResolvedValue(mockDigest) },
    });
    const file = new File(['hello'], 'test.mp3');
    const hash = await hashFile(file);
    expect(hash).toBe('1a2b3c4dfe');
  });

  it('pads single hex digits', async () => {
    const mockDigest = new Uint8Array([0x0f, 0x01]).buffer;
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn().mockResolvedValue(mockDigest) },
    });
    const hash = await hashFile(new File([''], 't.mp3'));
    expect(hash).toBe('0f01');
  });
});

describe('computeWaveform', () => {
  function makeBuffer(samples: number[]): AudioBuffer {
    return {
      getChannelData: () => new Float32Array(samples),
      length: samples.length,
      numberOfChannels: 1,
      sampleRate: 44100,
      duration: samples.length / 44100,
    } as unknown as AudioBuffer;
  }

  it('returns the requested number of points', () => {
    const buf = makeBuffer([0.1, 0.5, 0.2, 0.8, 0.3, 0.9, 0.4, 0.6]);
    expect(computeWaveform(buf, 4)).toHaveLength(4);
  });

  it('all values are in [0, 1]', () => {
    const buf = makeBuffer([0.1, 0.5, 0.2, 0.8, 0.3, 0.9, 0.4, 0.6]);
    const waveform = computeWaveform(buf, 4);
    waveform.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('the peak value normalises to 1.0', () => {
    const buf = makeBuffer([0.0, 1.0, 0.5, 0.5]);
    const waveform = computeWaveform(buf, 2);
    expect(Math.max(...waveform)).toBe(1);
  });

  it('handles silent audio without dividing by zero', () => {
    const buf = makeBuffer([0, 0, 0, 0]);
    const waveform = computeWaveform(buf, 2);
    waveform.forEach((v) => expect(v).toBe(0));
  });

  it('uses absolute value so negative peaks count', () => {
    const buf = makeBuffer([-0.8, -0.2, 0.1, 0.1]);
    const waveform = computeWaveform(buf, 2);
    expect(waveform[0]).toBeGreaterThan(waveform[1]);
  });
});

describe('decodeAudio', () => {
  it('decodes audio via AudioContext and returns an AudioBuffer', async () => {
    const mockBuffer = {
      numberOfChannels: 1,
      sampleRate: 44100,
    } as unknown as AudioBuffer;
    const mockCtx = {
      decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return mockCtx;
      })
    );
    Object.defineProperty(File.prototype, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    });

    const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });
    const result = await decodeAudio(file);
    expect(result).toBe(mockBuffer);
    expect(mockCtx.decodeAudioData).toHaveBeenCalled();
    expect(mockCtx.close).toHaveBeenCalled();
  });
});

describe('transcriptionCache', () => {
  it('is a Map', () => {
    expect(transcriptionCache).toBeInstanceOf(Map);
  });

  it('can store and retrieve entries', () => {
    transcriptionCache.set('testhash', '<xml/>');
    expect(transcriptionCache.get('testhash')).toBe('<xml/>');
    transcriptionCache.delete('testhash');
  });
});
