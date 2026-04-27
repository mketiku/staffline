import { useEffect, useRef, useState } from 'react';
import { Scissors, Music2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  decodeAudio,
  computeWaveform,
  sliceAudio,
  encodeWAV,
} from '@/lib/audio';

interface TrimZoneProps {
  file: File;
  onConfirm: (fileToUpload: File) => void;
  onCancel: () => void;
}

const WAVEFORM_POINTS = 300;

export function TrimZone({ file, onConfirm, onCancel }: TrimZoneProps) {
  const [status, setStatus] = useState<'decoding' | 'ready'>('decoding');
  const bufferRef = useRef<AudioBuffer | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<'start' | 'end' | null>(null);

  // Audio playback — all via refs to avoid re-renders per frame
  const playheadRef = useRef<SVGLineElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const playOffsetRef = useRef<number>(0);
  const isPlayingRef = useRef(false);

  // Mirror state in refs so stable callbacks always read fresh values
  const startRef = useRef(0);
  const endRef = useRef(0);
  startRef.current = start;
  endRef.current = end;

  // Latest togglePlay for the keydown handler (avoids stale closure)
  const togglePlayRef = useRef<() => void>(() => {});

  useEffect(() => {
    decodeAudio(file)
      .then((buffer) => {
        bufferRef.current = buffer;
        setDuration(buffer.duration);
        setEnd(buffer.duration);
        setWaveform(computeWaveform(buffer, WAVEFORM_POINTS));
        setStatus('ready');
      })
      .catch(() => {
        onConfirm(file);
      });
  }, [file, onConfirm]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      try {
        sourceRef.current?.stop();
      } catch {
        // stop() throws if the source already ended naturally
      }
      audioCtxRef.current?.close();
    };
  }, []);

  function stopPlayback() {
    cancelAnimationFrame(rafRef.current);
    try {
      sourceRef.current?.stop();
    } catch {
      // stop() throws if the source already ended naturally
    }
    sourceRef.current = null;
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (playheadRef.current) {
      playheadRef.current.setAttribute('x1', '-1');
      playheadRef.current.setAttribute('x2', '-1');
    }
  }

  function play() {
    const buffer = bufferRef.current;
    if (!buffer) return;

    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') ctx.resume();

    const playStart = startRef.current;
    const playEnd = endRef.current;
    const bufDuration = buffer.duration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0, playStart, playEnd - playStart);

    sourceRef.current = source;
    startedAtRef.current = ctx.currentTime;
    playOffsetRef.current = playStart;
    isPlayingRef.current = true;
    setIsPlaying(true);

    function tick() {
      if (!isPlayingRef.current || !audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - startedAtRef.current;
      const pos = playOffsetRef.current + elapsed;
      if (pos >= playEnd || pos >= bufDuration) {
        stopPlayback();
        return;
      }
      if (playheadRef.current) {
        const x = String((pos / bufDuration) * WAVEFORM_POINTS);
        playheadRef.current.setAttribute('x1', x);
        playheadRef.current.setAttribute('x2', x);
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    source.onended = () => {
      if (sourceRef.current === source) stopPlayback();
    };
  }

  function togglePlay() {
    if (isPlayingRef.current) stopPlayback();
    else play();
  }
  togglePlayRef.current = togglePlay;

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
      togglePlayRef.current();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status]);

  function timeToX(t: number) {
    return duration > 0 ? (t / duration) * 100 : 0;
  }

  function xToTime(clientX: number): number {
    if (!svgRef.current || duration === 0) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    return (
      Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration
    );
  }

  function handlePointerDown(e: React.PointerEvent, handle: 'start' | 'end') {
    e.preventDefault();
    if (isPlayingRef.current) stopPlayback();
    dragging.current = handle;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const t = xToTime(e.clientX);
    if (dragging.current === 'start') {
      setStart(Math.max(0, Math.min(t, end - 0.5)));
    } else {
      setEnd(Math.min(duration, Math.max(t, start + 0.5)));
    }
  }

  function handlePointerUp() {
    dragging.current = null;
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  async function handleConfirm(useFullTrack: boolean) {
    stopPlayback();
    const buffer = bufferRef.current;
    if (!buffer || useFullTrack || (start <= 0.05 && end >= duration - 0.05)) {
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
    stopPlayback();
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
            {status === 'decoding'
              ? 'Decoding audio…'
              : `${formatTime(duration)} total · drag handles to select a region`}
          </p>
        </div>
        <button
          onClick={handleCancel}
          className="cursor-pointer text-xs text-ink-dim hover:text-ink"
        >
          Cancel
        </button>
      </div>

      {status === 'decoding' ? (
        <div className="flex h-24 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-gold" />
        </div>
      ) : (
        <>
          {/* Waveform */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WAVEFORM_POINTS} 60`}
            preserveAspectRatio="none"
            className="h-24 w-full cursor-crosshair select-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Bars */}
            {waveform.map((amp, i) => {
              const x = i;
              const h = Math.max(2, amp * 58);
              const y = (60 - h) / 2;
              const inSelection =
                i / WAVEFORM_POINTS >= start / duration &&
                i / WAVEFORM_POINTS <= end / duration;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={0.6}
                  height={h}
                  fill={
                    inSelection ? 'oklch(80% 0.15 75)' : 'oklch(26% 0.025 265)'
                  }
                />
              );
            })}

            {/* Unselected overlay */}
            <rect
              x={0}
              y={0}
              width={timeToX(start)}
              height={60}
              fill="oklch(10% 0.02 265 / 0.7)"
            />
            <rect
              x={timeToX(end)}
              y={0}
              width={100 - timeToX(end)}
              height={60}
              fill="oklch(10% 0.02 265 / 0.7)"
            />

            {/* Playhead — position updated directly via ref, hidden at x=-1 */}
            <line
              ref={playheadRef}
              x1={-1}
              y1={0}
              x2={-1}
              y2={60}
              stroke="white"
              strokeWidth={0.5}
              strokeOpacity={0.9}
              style={{ pointerEvents: 'none' }}
            />

            {/* Start handle */}
            <g
              onPointerDown={(e) => handlePointerDown(e, 'start')}
              className="cursor-ew-resize"
              style={{ touchAction: 'none' }}
            >
              {/* Wider invisible hit area */}
              <rect
                x={timeToX(start) - 4}
                y={0}
                width={8}
                height={60}
                fill="transparent"
              />
              <line
                x1={timeToX(start)}
                y1={0}
                x2={timeToX(start)}
                y2={60}
                stroke="oklch(80% 0.15 75)"
                strokeWidth={1}
              />
              <circle
                cx={timeToX(start)}
                cy={30}
                r={4}
                fill="oklch(80% 0.15 75)"
              />
            </g>

            {/* End handle */}
            <g
              onPointerDown={(e) => handlePointerDown(e, 'end')}
              className="cursor-ew-resize"
              style={{ touchAction: 'none' }}
            >
              {/* Wider invisible hit area */}
              <rect
                x={timeToX(end) - 4}
                y={0}
                width={8}
                height={60}
                fill="transparent"
              />
              <line
                x1={timeToX(end)}
                y1={0}
                x2={timeToX(end)}
                y2={60}
                stroke="oklch(80% 0.15 75)"
                strokeWidth={1}
              />
              <circle
                cx={timeToX(end)}
                cy={30}
                r={4}
                fill="oklch(80% 0.15 75)"
              />
            </g>
          </svg>

          {/* Playback control + time labels */}
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={togglePlay}
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
            <div className="flex flex-1 justify-between text-xs tabular-nums text-ink-dim">
              <span>{formatTime(start)}</span>
              <span className="text-ink">
                {isFullTrack
                  ? 'Full track'
                  : `${formatTime(selectionDuration)} selected`}
              </span>
              <span>{formatTime(end)}</span>
            </div>
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
