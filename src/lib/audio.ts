export const transcriptionCache = new Map<string, string>();

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function decodeAudio(file: File): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();
  return buffer;
}

export function computeWaveform(
  buffer: AudioBuffer,
  numPoints: number
): number[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.floor(data.length / numPoints);
  const waveform: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const start = i * blockSize;
    let peak = 0;
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(data[start + j]);
      if (abs > peak) peak = abs;
    }
    waveform.push(peak);
  }

  const max = Math.max(...waveform, 0.001);
  return waveform.map((v) => v / max);
}

export function sliceAudio(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number
): AudioBuffer {
  const { sampleRate, numberOfChannels } = buffer;
  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.min(Math.ceil(endSec * sampleRate), buffer.length);
  const length = endSample - startSample;

  const sliced = new AudioBuffer({ numberOfChannels, length, sampleRate });
  for (let ch = 0; ch < numberOfChannels; ch++) {
    sliced.copyToChannel(
      buffer.getChannelData(ch).subarray(startSample, endSample),
      ch
    );
  }
  return sliced;
}

export function encodeWAV(buffer: AudioBuffer): Blob {
  const { numberOfChannels, sampleRate, length: numSamples } = buffer;
  const dataLength = numSamples * numberOfChannels * 2;
  const ab = new ArrayBuffer(44 + dataLength);
  const view = new DataView(ab);

  function str(offset: number, s: string) {
    for (let i = 0; i < s.length; i++)
      view.setUint8(offset + i, s.charCodeAt(i));
  }

  str(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const s = buffer.getChannelData(ch)[i];
      view.setInt16(
        offset,
        (Math.max(-1, Math.min(1, s)) * (s < 0 ? 0x8000 : 0x7fff)) | 0,
        true
      );
      offset += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}
