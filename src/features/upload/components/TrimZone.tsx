import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, {
  type Region,
} from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Scissors, Music2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { sliceAudio, encodeWAV } from '@/lib/audio';

interface TrimZoneProps {
  file: File;
  onConfirm: (fileToUpload: File) => void;
  onCancel: () => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function parseTimeInput(str: string, max: number): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;
  const colon = trimmed.indexOf(':');
  let seconds: number;
  if (colon !== -1) {
    const m = parseInt(trimmed.slice(0, colon));
    const s = parseFloat(trimmed.slice(colon + 1));
    if (isNaN(m) || isNaN(s) || m < 0 || s < 0 || s >= 60) return null;
    seconds = m * 60 + s;
  } else {
    seconds = parseFloat(trimmed);
    if (isNaN(seconds) || seconds < 0) return null;
  }
  return Math.min(seconds, max);
}

export function TrimZone({ file, onConfirm, onCancel }: TrimZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionRef = useRef<Region | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [startInput, setStartInput] = useState('0:00');
  const [endInput, setEndInput] = useState('0:00');

  // Mirrors for stable callbacks
  const durationRef = useRef(0);
  const startRef = useRef(0);
  const endRef = useRef(0);
  durationRef.current = duration;
  startRef.current = start;
  endRef.current = end;

  useEffect(() => {
    if (!containerRef.current) return;

    const objectUrl = URL.createObjectURL(file);
    const regions = RegionsPlugin.create();

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'oklch(30% 0.025 265)',
      progressColor: 'oklch(75% 0.14 75)',
      cursorColor: 'oklch(75% 0.14 75)',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 96,
      normalize: true,
      url: objectUrl,
      plugins: [regions],
    });
    wsRef.current = ws;

    ws.on('ready', (dur) => {
      durationRef.current = dur;
      setDuration(dur);
      setEnd(dur);
      setEndInput(formatTime(dur));

      const region = regions.addRegion({
        start: 0,
        end: dur,
        color: 'rgba(245, 166, 35, 0.1)',
        drag: true,
        resize: true,
        minLength: 0.5,
      });
      regionRef.current = region;

      region.on('update-end', () => {
        setStart(region.start);
        setEnd(region.end);
        setStartInput(formatTime(region.start));
        setEndInput(formatTime(region.end));
      });

      setStatus('ready');
    });

    ws.on('error', () => {
      onConfirm(file);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    return () => {
      ws.destroy();
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, onConfirm]);

  // Spacebar shortcut
  useEffect(() => {
    if (status !== 'ready') return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      if (
        e.target instanceof HTMLButtonElement ||
        e.target instanceof HTMLInputElement
      )
        return;
      e.preventDefault();
      const ws = wsRef.current;
      const region = regionRef.current;
      if (!ws || !region) return;
      if (ws.isPlaying()) ws.pause();
      else region.play();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status]);

  function commitStart(value: string) {
    const t = parseTimeInput(value, durationRef.current);
    const clamped =
      t !== null
        ? Math.max(0, Math.min(t, endRef.current - 0.5))
        : startRef.current;
    setStart(clamped);
    setStartInput(formatTime(clamped));
    regionRef.current?.setOptions({ start: clamped });
  }

  function commitEnd(value: string) {
    const t = parseTimeInput(value, durationRef.current);
    const clamped =
      t !== null
        ? Math.max(startRef.current + 0.5, Math.min(t, durationRef.current))
        : endRef.current;
    setEnd(clamped);
    setEndInput(formatTime(clamped));
    regionRef.current?.setOptions({ end: clamped });
  }

  function handleTogglePlay() {
    const ws = wsRef.current;
    const region = regionRef.current;
    if (!ws || !region) return;
    if (ws.isPlaying()) ws.pause();
    else region.play();
  }

  async function handleConfirm(useFullTrack: boolean) {
    wsRef.current?.pause();
    if (useFullTrack || (start <= 0.05 && end >= duration - 0.05)) {
      onConfirm(file);
      return;
    }
    const buffer = wsRef.current?.getDecodedData();
    if (!buffer) {
      onConfirm(file);
      return;
    }
    const sliced = sliceAudio(buffer, start, end);
    const wav = encodeWAV(sliced);
    const trimmedFile = new File([wav], file.name.replace(/\.[^.]+$/, '.wav'), {
      type: 'audio/wav',
    });
    onConfirm(trimmedFile);
  }

  function handleCancel() {
    wsRef.current?.pause();
    onCancel();
  }

  const selectionDuration = end - start;
  const isFullTrack = start <= 0.05 && end >= duration - 0.05;

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="font-medium text-ink">{file.name}</p>
          <p className="text-sm text-ink-dim">
            {status === 'loading'
              ? 'Loading audio…'
              : `${formatTime(duration)} total · drag handles or type to trim`}
          </p>
        </div>
        <button
          onClick={handleCancel}
          className="cursor-pointer text-xs text-ink-dim hover:text-ink"
        >
          Cancel
        </button>
      </div>

      {/* WaveSurfer mounts here; spinner overlaid while loading */}
      <div className="relative">
        <div
          ref={containerRef}
          className={status === 'loading' ? 'invisible' : ''}
        />
        {status === 'loading' && (
          <div className="absolute inset-0 flex h-24 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-gold" />
          </div>
        )}
      </div>

      {status === 'ready' && (
        <>
          {/* Playback + editable timestamps */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleTogglePlay}
              className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-raised text-ink-dim transition-colors hover:text-gold"
              title="Play selection (Space)"
              aria-label={isPlaying ? 'Pause' : 'Play selection'}
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>

            <input
              type="text"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              onBlur={() => commitStart(startInput)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitStart(startInput);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 cursor-text bg-transparent text-center text-xs tabular-nums text-ink-dim outline-none transition-colors hover:text-ink focus:text-gold"
              aria-label="Start time"
            />

            <div className="flex flex-1 items-center justify-center">
              <span className="text-xs text-ink-dim">
                {isFullTrack ? 'Full track' : formatTime(selectionDuration)}
              </span>
            </div>

            <input
              type="text"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              onBlur={() => commitEnd(endInput)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitEnd(endInput);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 cursor-text bg-transparent text-center text-xs tabular-nums text-ink-dim outline-none transition-colors hover:text-ink focus:text-gold"
              aria-label="End time"
            />
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              onClick={() => handleConfirm(false)}
              className="flex-1"
            >
              <Scissors className="h-4 w-4" />
              {isFullTrack
                ? 'Transcribe full track'
                : `Transcribe selection (${formatTime(selectionDuration)})`}
            </Button>
            {!isFullTrack && (
              <Button variant="ghost" onClick={() => handleConfirm(true)}>
                <Music2 className="h-4 w-4" />
                Use full track
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
