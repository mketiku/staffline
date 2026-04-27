import { useState, useEffect } from 'react';
import { Music, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { UploadZone } from '@/features/upload/components/UploadZone';
import { TrimZone } from '@/features/upload/components/TrimZone';
import { SheetMusic } from '@/features/transcription/components/SheetMusic';
import { transcribeAudioStream, type TranscribeStage } from '@/lib/api';
import { hashFile, transcriptionCache } from '@/lib/audio';
import {
  loadHistory,
  saveToHistory,
  removeFromHistory,
  formatRelativeDate,
  type HistoryEntry,
} from '@/lib/history';
import { Button } from '@/components/ui/Button';

const STAGE_LABELS: Record<string, string> = {
  validating: 'Validating file…',
  analyzing: 'Analyzing audio…',
  exporting: 'Generating sheet music…',
};

const MUSIC_FACTS = [
  'The A above middle C vibrates at exactly 440 Hz — a standard adopted internationally in 1955.',
  'basic-pitch uses a neural network trained on thousands of hours of audio to detect individual notes.',
  "Sheet music notation as we know it emerged in the 11th century with Guido of Arezzo's staff system.",
  'A piano spans over 7 octaves — each octave doubles the frequency of the one below it.',
  'Pitch detection works by analyzing tiny audio slices called frames, each just milliseconds long.',
  "MIDI, the format we use internally, was created in 1983 and is still music's universal language.",
  'MusicXML was designed to be the "PDF of sheet music" — portable between any notation software.',
  'Beethoven composed his 9th Symphony while almost completely deaf.',
  'The circle of fifths was first described by Johann David Heinichen in 1728.',
  "Most Western music uses 12 equal-tempered notes per octave — a compromise tuning system from Bach's era.",
  'A human can hear roughly 20 Hz to 20,000 Hz; most musical notes fall between 27–4,186 Hz.',
  'The oldest surviving piece of written music is a Hurrian hymn from around 1400 BCE.',
  'Harmonics — the overtones above a fundamental pitch — are what give each instrument its unique timbre.',
  'The word "music" traces back to the Greek "mousike", meaning the art of the Muses.',
  'On a guitar, pressing a string exactly halfway up the neck raises it by exactly one octave.',
];

type LoadingStage = 'validating' | 'analyzing' | 'exporting';

type AppState =
  | { status: 'idle' }
  | { status: 'trimming'; file: File }
  | { status: 'loading'; filename: string; stage: LoadingStage; pct: number }
  | { status: 'success'; musicxml: string; filename: string; file: File | null }
  | { status: 'error'; message: string };

function useCyclingFact() {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * MUSIC_FACTS.length)
  );
  const [key, setKey] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % MUSIC_FACTS.length);
      setKey((k) => k + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return { fact: MUSIC_FACTS[index], key };
}

export default function App() {
  const [state, setState] = useState<AppState>({ status: 'idle' });
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const { fact, key: factKey } = useCyclingFact();

  function handleFile(file: File) {
    setState({ status: 'trimming', file });
  }

  function handleLoadFromHistory(entry: HistoryEntry) {
    setState({
      status: 'success',
      musicxml: entry.musicxml,
      filename: entry.filename,
      file: null,
    });
  }

  function handleRemoveFromHistory(hash: string) {
    removeFromHistory(hash);
    setHistory((h) => h.filter((e) => e.hash !== hash));
  }

  async function handleTrim(fileToUpload: File) {
    const filename =
      state.status === 'trimming' ? state.file.name : fileToUpload.name;

    const hash = await hashFile(fileToUpload);
    const cached = transcriptionCache.get(hash);
    if (cached) {
      setState({
        status: 'success',
        musicxml: cached,
        filename,
        file: fileToUpload,
      });
      return;
    }

    setState({ status: 'loading', filename, stage: 'validating', pct: 0 });

    function onStage(event: TranscribeStage) {
      if (event.stage === 'done' || event.stage === 'error') return;
      setState((prev) =>
        prev.status === 'loading'
          ? { ...prev, stage: event.stage, pct: event.pct }
          : prev
      );
    }

    try {
      const musicxml = await transcribeAudioStream(fileToUpload, onStage);
      transcriptionCache.set(hash, musicxml);
      saveToHistory({ filename, hash, musicxml });
      setHistory(loadHistory());
      setState({ status: 'success', musicxml, filename, file: fileToUpload });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Transcription failed',
      });
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="no-print border-b border-line px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5">
          <Music className="h-5 w-5 text-gold" />
          <span className="font-semibold tracking-tight">stafflines</span>
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

              {history.length > 0 && (
                <div className="mt-10">
                  <p className="mb-3 text-sm font-medium text-ink-dim">
                    Recent
                  </p>
                  <div className="flex flex-col gap-2">
                    {history.slice(0, 5).map((entry) => (
                      <div
                        key={entry.hash}
                        className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-gold-dim hover:bg-surface-raised"
                      >
                        <button
                          onClick={() => handleLoadFromHistory(entry)}
                          className="flex min-w-0 flex-1 cursor-pointer flex-col items-start text-left"
                        >
                          <span className="w-full truncate text-sm font-medium text-ink">
                            {entry.filename}
                          </span>
                          <span className="text-xs text-ink-dim">
                            {formatRelativeDate(entry.date)}
                          </span>
                        </button>
                        <button
                          onClick={() => handleRemoveFromHistory(entry.hash)}
                          className="cursor-pointer p-1 text-ink-dim opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
                          aria-label="Remove from history"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {state.status === 'trimming' && (
            <motion.div
              key="trimming"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold tracking-tight">
                  Select a region to transcribe
                </h2>
                <p className="mt-1 text-sm text-ink-dim">
                  Drag the handles to focus on a section, or transcribe the full
                  track
                </p>
              </div>
              <TrimZone
                file={state.file}
                onConfirm={handleTrim}
                onCancel={() => setState({ status: 'idle' })}
              />
            </motion.div>
          )}

          {state.status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-6 py-24"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-gold" />
              <div className="text-center">
                <p className="text-ink-dim">
                  {STAGE_LABELS[state.stage] ?? 'Processing…'}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {state.filename}
                </p>
              </div>
              <div className="w-48 overflow-hidden rounded-full bg-surface-raised">
                <motion.div
                  className="h-1 rounded-full bg-gold"
                  animate={{ width: `${state.pct}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>

              <AnimatePresence mode="wait">
                <motion.p
                  key={factKey}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.4 }}
                  className="max-w-sm text-center text-sm text-ink-dim"
                >
                  {fact}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}

          {state.status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="no-print mb-6 flex items-center justify-between">
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
              <SheetMusic
                musicxml={state.musicxml}
                audioFile={state.file ?? undefined}
                filename={state.filename}
              />
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
