/// <reference lib="webworker" />

interface SliceMessage {
  channels: Float32Array[];
  sampleRate: number;
  startSec: number;
  endSec: number;
}

self.onmessage = (e: MessageEvent<SliceMessage>) => {
  const { channels, sampleRate, startSec, endSec } = e.data;

  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.ceil(endSec * sampleRate);
  const sliced = channels.map((ch) => ch.slice(startSample, endSample));

  const ab = encodeWAV(sliced, sampleRate);
  self.postMessage(ab, [ab]);
};

function encodeWAV(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numberOfChannels = channels.length;
  const numSamples = channels[0].length;
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
  view.setUint16(20, 1, true);
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
      const s = channels[ch][i];
      view.setInt16(
        offset,
        (Math.max(-1, Math.min(1, s)) * (s < 0 ? 0x8000 : 0x7fff)) | 0,
        true
      );
      offset += 2;
    }
  }

  return ab;
}
