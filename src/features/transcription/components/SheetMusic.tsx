import { useEffect, useRef, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Loader2 } from 'lucide-react';

interface SheetMusicProps {
  musicxml: string;
}

export function SheetMusic({ musicxml }: SheetMusicProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    setIsRendering(true);
    setRenderError(null);
    containerRef.current.innerHTML = '';

    const osmd = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      drawTitle: true,
    });

    osmd
      .load(musicxml)
      .then(() => {
        osmd.render();
        setIsRendering(false);
      })
      .catch((err: unknown) => {
        setRenderError(
          err instanceof Error ? err.message : 'Failed to render sheet music'
        );
        setIsRendering(false);
      });
  }, [musicxml]);

  if (renderError) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-line bg-surface py-16 text-sm text-error">
        {renderError}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
      {isRendering && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      )}
      <div ref={containerRef} className={isRendering ? 'invisible' : ''} />
    </div>
  );
}
