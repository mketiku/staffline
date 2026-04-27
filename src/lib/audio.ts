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
