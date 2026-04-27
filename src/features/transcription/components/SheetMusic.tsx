import { useEffect, useRef, useState, useCallback } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import {
  Loader2,
  Play,
  Pause,
  Download,
  FileCode2,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface SheetMusicProps {
  musicxml: string;
  audioFile?: File;
  filename?: string;
}

function triggerDownload(
  content: BlobPart,
  mimeType: string,
  downloadName: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  a.click();
  URL.revokeObjectURL(url);
}

export function SheetMusic({ musicxml, audioFile, filename }: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    setIsRendering(true);
    setRenderError(null);
    container.innerHTML = '';

    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      drawTitle: true,
    });

    osmd
      .load(musicxml)
      .then(() => {
        if (!mounted) return;
        osmd.render();
        setIsRendering(false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setRenderError(
          err instanceof Error ? err.message : 'Failed to render sheet music'
        );
        setIsRendering(false);
      });

    return () => {
      mounted = false;
      container.innerHTML = '';
    };
  }, [musicxml]);

  useEffect(() => {
    if (!audioFile) return;

    const url = URL.createObjectURL(audioFile);
    const audio = new Audio(url);
    audioRef.current = audio;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      URL.revokeObjectURL(url);
      audioRef.current = null;
    };
  }, [audioFile]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setProgress(t);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const stem = filename ? filename.replace(/\.[^.]+$/, '') : 'sheet';

  function downloadMusicXML() {
    triggerDownload(musicxml, 'application/xml', `${stem}.musicxml`);
  }

  function downloadSVG() {
    if (!containerRef.current) return;
    const svgs = containerRef.current.querySelectorAll('svg');
    if (!svgs.length) return;
    const parts = Array.from(svgs).map((svg) => svg.outerHTML);
    const combined = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  ${parts.join('\n')}
</svg>`;
    triggerDownload(combined, 'image/svg+xml', `${stem}.svg`);
  }

  if (renderError) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line bg-surface py-16 text-sm text-error">
        {renderError}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'no-print flex items-center gap-3',
          isRendering && 'invisible'
        )}
      >
        {audioFile && (
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
            <Button
              variant="primary"
              onClick={togglePlay}
              className="h-8 w-8 rounded-full p-0 justify-center"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5 translate-x-0.5" />
              )}
            </Button>
            <span className="w-10 text-right text-xs tabular-nums text-ink-dim">
              {formatTime(progress)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={progress}
              onChange={handleSeek}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-raised accent-gold"
            />
            <span className="w-10 text-xs tabular-nums text-ink-dim">
              {formatTime(duration)}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={downloadMusicXML}>
            <FileCode2 className="h-4 w-4" />
            MusicXML
          </Button>
          <Button variant="ghost" onClick={downloadSVG}>
            <Download className="h-4 w-4" />
            SVG
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="print-sheet overflow-hidden rounded-2xl bg-white shadow-lg">
        {isRendering && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        )}
        <div ref={containerRef} className={isRendering ? 'invisible' : ''} />
      </div>
    </div>
  );
}
