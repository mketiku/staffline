import { useEffect, useRef, useState } from 'react';
import { Scissors, Music2 } from 'lucide-react';
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

  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<'start' | 'end' | null>(null);

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
          onClick={onCancel}
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

            {/* Start handle */}
            <g
              onPointerDown={(e) => handlePointerDown(e, 'start')}
              className="cursor-ew-resize"
              style={{ touchAction: 'none' }}
            >
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

          {/* Time labels */}
          <div className="mt-2 flex justify-between text-xs tabular-nums text-ink-dim">
            <span>{formatTime(start)}</span>
            <span className="text-ink">
              {isFullTrack
                ? 'Full track'
                : `${formatTime(selectionDuration)} selected`}
            </span>
            <span>{formatTime(end)}</span>
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
