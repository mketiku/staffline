import { useRef, useState } from 'react';
import { Music, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface UploadZoneProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onUpload, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/aac',
    'audio/x-aac',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
  ]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && ACCEPTED_TYPES.has(file.type)) onUpload(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-6 rounded-2xl border-2 border-dashed px-8 py-24 text-center transition-colors',
        isDragging
          ? 'border-gold bg-gold/5'
          : 'border-line hover:border-line/60',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
        <Music className="h-8 w-8 text-gold" />
      </div>

      <div>
        <p className="text-lg font-medium text-ink">
          Drop your audio file here
        </p>
        <p className="mt-1 text-sm text-ink-dim">or browse to upload</p>
      </div>

      <Button onClick={() => inputRef.current?.click()} disabled={disabled}>
        <Upload className="h-4 w-4" />
        Browse files
      </Button>

      <p className="text-xs text-ink-dim opacity-60">
        MP3, M4A, AAC, WAV · max 50 MB
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.m4a,.aac,.wav,audio/mpeg,audio/mp4,audio/aac,audio/wav"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
