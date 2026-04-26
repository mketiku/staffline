import { useState } from 'react';
import { Music, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { UploadZone } from '@/features/upload/components/UploadZone';
import { SheetMusic } from '@/features/transcription/components/SheetMusic';
import { transcribeAudio } from '@/lib/api';
import { Button } from '@/components/ui/Button';

type AppState =
  | { status: 'idle' }
  | { status: 'loading'; filename: string }
  | { status: 'success'; musicxml: string; filename: string }
  | { status: 'error'; message: string };

export default function App() {
  const [state, setState] = useState<AppState>({ status: 'idle' });

  async function handleFile(file: File) {
    setState({ status: 'loading', filename: file.name });
    try {
      const musicxml = await transcribeAudio(file);
      setState({ status: 'success', musicxml, filename: file.name });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Transcription failed',
      });
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5">
          <Music className="h-5 w-5 text-gold" />
          <span className="font-semibold tracking-tight">
            Music Note Creator
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <AnimatePresence mode="wait">
          {state.status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold tracking-tight">
                  Turn audio into <span className="text-gold">sheet music</span>
                </h1>
                <p className="mt-3 text-ink-dim">
                  Upload an MP3 and we'll detect the notes and generate sheet
                  music
                </p>
              </div>
              <UploadZone onUpload={handleFile} />
            </motion.div>
          )}

          {state.status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-32"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-gold" />
              <p className="text-ink-dim">
                Transcribing{' '}
                <span className="font-medium text-ink">{state.filename}</span>
                &hellip;
              </p>
              <p className="text-sm text-ink-dim opacity-60">
                This may take 30–60 seconds
              </p>
            </motion.div>
          )}

          {state.status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{state.filename}</p>
                  <p className="text-sm text-ink-dim">Sheet music generated</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setState({ status: 'idle' })}
                >
                  <RotateCcw className="h-4 w-4" />
                  Try another
                </Button>
              </div>
              <SheetMusic musicxml={state.musicxml} />
            </motion.div>
          )}

          {state.status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-20 text-center"
            >
              <p className="text-error">{state.message}</p>
              <Button
                variant="ghost"
                onClick={() => setState({ status: 'idle' })}
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
