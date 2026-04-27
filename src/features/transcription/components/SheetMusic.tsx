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

function triggerDownload(content: BlobPart, mimeType: string, name: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SheetMusic({ musicxml, audioFile, filename }: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // OSMD render effect.
  // autoResize: false avoids a ResizeObserver that conflicts with StrictMode's
  // double-invoke (two instances fighting over the same container). We handle
  // resize manually below. The requestAnimationFrame ensures the container has
  // settled its layout before OSMD measures offsetWidth for page formatting.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    setIsRendering(true);
    setRenderError(null);
    container.innerHTML = '';

    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: false,
      drawTitle: true,
    });
    osmdRef.current = osmd;

    osmd
      .load(musicxml)
      .then(() => {
        if (!mounted) return;
        requestAnimationFrame(() => {
          if (!mounted) return;
          osmd.render();
          setIsRendering(false);
        });
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
      osmdRef.current = null;
      container.innerHTML = '';
    };
  }, [musicxml]);

  // Re-render on window resize (debounced) once the initial render is done.
  useEffect(() => {
    if (isRendering) return;
    let timer: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(timer);
      timer = setTimeout(() => osmdRef.current?.render(), 150);
    }
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
    };
  }, [isRendering]);

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

  async function downloadPNG() {
    const container = containerRef.current;
    if (!container) return;
    const svgEls = Array.from(container.querySelectorAll('svg'));
    if (!svgEls.length) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let totalWidth = 0;
    let totalHeight = 0;
    const dims = svgEls.map((svg) => {
      const w = svg.clientWidth;
      const h = svg.clientHeight;
      totalWidth = Math.max(totalWidth, w);
      totalHeight += h;
      return { w, h };
    });

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth * dpr;
    canvas.height = totalHeight * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    let y = 0;
    for (let i = 0; i < svgEls.length; i++) {
      const svg = svgEls[i];
      const { w, h } = dims[i];
      const clone = svg.cloneNode(true) as SVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const svgData = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, y, w, h);
          y += h;
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(blob, 'image/png', `${stem}.png`);
    }, 'image/png');
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
      {/* Toolbar — stacks on mobile so nothing overflows */}
      <div
        className={cn(
          'no-print flex flex-col gap-3',
          isRendering && 'invisible'
        )}
      >
        {audioFile && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
            <Button
              variant="primary"
              onClick={togglePlay}
              className="h-8 w-8 shrink-0 rounded-full p-0 justify-center"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5 translate-x-0.5" />
              )}
            </Button>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-dim">
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
            <span className="w-10 shrink-0 text-xs tabular-nums text-ink-dim">
              {formatTime(duration)}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={downloadPNG}>
            <Download className="h-4 w-4" />
            PNG
          </Button>
          <Button variant="ghost" onClick={downloadMusicXML}>
            <FileCode2 className="h-4 w-4" />
            MusicXML
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Sheet music — overflow-x-auto scrolls rather than clips if OSMD
          produces content wider than the viewport (e.g. very dense passages) */}
      <div className="print-sheet overflow-x-auto rounded-2xl bg-white shadow-lg">
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
