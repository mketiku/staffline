import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from './App';

// --- motion/react: render children without animations ---
// Motion-specific props are stripped so they don't bleed into HTML attributes.
const MOTION_PROPS = new Set([
  'initial',
  'animate',
  'exit',
  'transition',
  'variants',
  'whileHover',
  'whileTap',
  'layout',
]);

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  motion: new Proxy({} as Record<string, unknown>, {
    get:
      (_, tag: string) =>
      (props: { children?: React.ReactNode; [key: string]: unknown }) => {
        const { children, ...rest } = props;
        const htmlProps = Object.fromEntries(
          Object.entries(rest).filter(([k]) => !MOTION_PROPS.has(k))
        );
        return React.createElement(
          tag as keyof React.JSX.IntrinsicElements,
          htmlProps as React.HTMLAttributes<HTMLElement>,
          children
        );
      },
  }),
}));

// --- lib mocks ---
// vi.hoisted ensures mockCache exists when the vi.mock factory runs (factories
// are hoisted to the top of the file, before any const declarations).
const { mockCache } = vi.hoisted(() => ({
  mockCache: new Map<string, string>(),
}));

vi.mock('@/lib/audio', () => ({
  hashFile: vi.fn(async () => 'hash-abc'),
  transcriptionCache: mockCache,
}));

vi.mock('@/lib/api', () => ({
  transcribeAudioStream: vi.fn(),
}));

vi.mock('@/lib/history', () => ({
  loadHistory: vi.fn(() => []),
  saveToHistory: vi.fn(),
  removeFromHistory: vi.fn(),
  formatRelativeDate: vi.fn((d: string) => `rel:${d}`),
}));

// --- component mocks ---
vi.mock('@/features/upload/components/TrimZone', () => ({
  TrimZone: ({
    onConfirm,
    onCancel,
    file,
  }: {
    onConfirm: (f: File) => void;
    onCancel: () => void;
    file: File;
  }) => (
    <div data-testid="trim-zone">
      <button onClick={() => onConfirm(file)}>Confirm Trim</button>
      <button onClick={onCancel}>Cancel Trim</button>
    </div>
  ),
}));

vi.mock('@/features/transcription/components/SheetMusic', () => ({
  SheetMusic: ({
    filename,
    musicxml,
  }: {
    musicxml: string;
    filename?: string;
    audioFile?: File;
  }) => (
    <div data-testid="sheet-music">
      <span data-testid="sm-filename">{filename}</span>
      <span data-testid="sm-musicxml">{musicxml}</span>
    </div>
  ),
}));

import { loadHistory, removeFromHistory } from '@/lib/history';
import { transcribeAudioStream } from '@/lib/api';
import { hashFile } from '@/lib/audio';

const mockFile = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });

function renderApp() {
  return render(<App />);
}

describe('App — idle state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.clear();
    vi.mocked(loadHistory).mockReturnValue([]);
  });

  it('renders the heading and upload zone', () => {
    renderApp();
    expect(screen.getByText(/Turn audio into/)).toBeInTheDocument();
    expect(screen.getByText('Drop your audio file here')).toBeInTheDocument();
  });

  it('does not render the history section when history is empty', () => {
    renderApp();
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
  });

  it('renders history entries when history is non-empty', () => {
    vi.mocked(loadHistory).mockReturnValue([
      {
        filename: 'old-track.mp3',
        hash: 'h1',
        musicxml: '<xml/>',
        date: '2024-01-01T00:00:00.000Z',
      },
    ]);
    renderApp();
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('old-track.mp3')).toBeInTheDocument();
  });

  it('clicking a history entry shows the success state', () => {
    vi.mocked(loadHistory).mockReturnValue([
      {
        filename: 'old-track.mp3',
        hash: 'h1',
        musicxml: '<saved-xml/>',
        date: '2024-01-01T00:00:00.000Z',
      },
    ]);
    renderApp();
    fireEvent.click(screen.getByText('old-track.mp3'));
    expect(screen.getByTestId('sheet-music')).toBeInTheDocument();
    expect(screen.getByTestId('sm-musicxml').textContent).toBe('<saved-xml/>');
  });

  it('removing a history entry updates the list', () => {
    vi.mocked(loadHistory).mockReturnValue([
      {
        filename: 'old-track.mp3',
        hash: 'h1',
        musicxml: '<xml/>',
        date: '2024-01-01T00:00:00.000Z',
      },
    ]);
    renderApp();
    fireEvent.click(screen.getByLabelText('Remove from history'));
    expect(removeFromHistory).toHaveBeenCalledWith('h1');
    expect(screen.queryByText('old-track.mp3')).not.toBeInTheDocument();
  });
});

describe('App — trimming state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.clear();
    vi.mocked(loadHistory).mockReturnValue([]);
  });

  it('transitions to trimming when a file is uploaded', () => {
    renderApp();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [mockFile] } });
    expect(screen.getByTestId('trim-zone')).toBeInTheDocument();
  });

  it('Cancel Trim returns to idle state', () => {
    renderApp();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [mockFile] } });
    fireEvent.click(screen.getByText('Cancel Trim'));
    expect(screen.queryByTestId('trim-zone')).not.toBeInTheDocument();
    expect(screen.getByText('Drop your audio file here')).toBeInTheDocument();
  });
});

describe('App — transcription success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.clear();
    vi.mocked(loadHistory).mockReturnValue([]);
  });

  it('goes through loading to success after Confirm Trim', async () => {
    vi.mocked(transcribeAudioStream).mockImplementation(
      async (_file, onStage) => {
        onStage({ stage: 'validating', pct: 10 });
        onStage({ stage: 'analyzing', pct: 50 });
        onStage({ stage: 'exporting', pct: 80 });
        return '<fresh-xml/>';
      }
    );

    renderApp();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [mockFile] } });

    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Trim'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('sheet-music')).toBeInTheDocument()
    );
    expect(screen.getByTestId('sm-musicxml').textContent).toBe('<fresh-xml/>');
    expect(screen.getByTestId('sm-filename').textContent).toBe('song.mp3');
  });

  it('uses the cache when the hash is already stored', async () => {
    mockCache.set('hash-abc', '<cached-xml/>');

    renderApp();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [mockFile] } });

    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Trim'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('sheet-music')).toBeInTheDocument()
    );
    expect(transcribeAudioStream).not.toHaveBeenCalled();
    expect(screen.getByTestId('sm-musicxml').textContent).toBe('<cached-xml/>');
  });

  it('"Try another" button returns to idle', async () => {
    vi.mocked(transcribeAudioStream).mockResolvedValue('<xml/>');

    renderApp();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [mockFile] } });

    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Trim'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('sheet-music')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /try another/i }));
    expect(screen.queryByTestId('sheet-music')).not.toBeInTheDocument();
    expect(screen.getByText('Drop your audio file here')).toBeInTheDocument();
  });
});

describe('App — transcription error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.clear();
    vi.mocked(loadHistory).mockReturnValue([]);
  });

  it('shows the error message and a Try again button', async () => {
    vi.mocked(transcribeAudioStream).mockRejectedValue(
      new Error('Network failure')
    );

    renderApp();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [mockFile] } });

    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Trim'));
    });

    await waitFor(() =>
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    );
    expect(
      screen.getByRole('button', { name: /try again/i })
    ).toBeInTheDocument();
  });

  it('"Try again" returns to idle', async () => {
    vi.mocked(transcribeAudioStream).mockRejectedValue(new Error('Oops'));

    renderApp();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [mockFile] } });

    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Trim'));
    });

    await waitFor(() => expect(screen.getByText('Oops')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.queryByText('Oops')).not.toBeInTheDocument();
    expect(screen.getByText('Drop your audio file here')).toBeInTheDocument();
  });

  it('shows a generic message when the thrown value is not an Error', async () => {
    vi.mocked(transcribeAudioStream).mockRejectedValue('string-error');
    vi.mocked(hashFile).mockResolvedValue('miss');

    renderApp();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [mockFile] } });

    await act(async () => {
      fireEvent.click(screen.getByText('Confirm Trim'));
    });

    await waitFor(() =>
      expect(screen.getByText('Transcription failed')).toBeInTheDocument()
    );
  });
});
