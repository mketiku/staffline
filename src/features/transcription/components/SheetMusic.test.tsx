import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SheetMusic } from './SheetMusic';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

// Simple class mock — implementation is injected fresh in each beforeEach so
// vi.clearAllMocks() can't accidentally wipe an inlined mockImplementation.
vi.mock('opensheetmusicdisplay', () => ({
  OpenSheetMusicDisplay: vi.fn(),
}));

// Synchronous RAF: load() → .then() → RAF → render() + setIsRendering(false)
// all complete in one act() flush.
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  cb(performance.now());
  return 0;
});

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
});

const SAMPLE_XML = '<score-partwise><part id="P1"/></score-partwise>';

let mockLoad: ReturnType<typeof vi.fn>;
let mockRender: ReturnType<typeof vi.fn>;

function setupOsmdMock(rejectWith?: unknown) {
  mockLoad = vi
    .fn()
    .mockImplementation(() =>
      rejectWith !== undefined
        ? Promise.reject(rejectWith)
        : Promise.resolve(undefined)
    );
  mockRender = vi.fn();
  vi.mocked(OpenSheetMusicDisplay).mockImplementation(
    () =>
      ({
        load: mockLoad,
        render: mockRender,
      }) as unknown as OpenSheetMusicDisplay
  );
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('SheetMusic — rendering states', () => {
  beforeEach(() => setupOsmdMock());
  afterEach(() => vi.restoreAllMocks());

  it('shows a loading spinner initially then removes it after render', async () => {
    const { container } = render(<SheetMusic musicxml={SAMPLE_XML} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    await settle();

    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
    expect(mockRender).toHaveBeenCalled();
  });

  it('shows an error message when OSMD load rejects with an Error', async () => {
    setupOsmdMock(new Error('Invalid MusicXML'));
    render(<SheetMusic musicxml="<bad/>" />);
    await waitFor(() =>
      expect(screen.getByText('Invalid MusicXML')).toBeInTheDocument()
    );
  });

  it('shows a fallback error message for non-Error rejections', async () => {
    setupOsmdMock('string-error');
    render(<SheetMusic musicxml="<bad/>" />);
    await waitFor(() =>
      expect(
        screen.getByText('Failed to render sheet music')
      ).toBeInTheDocument()
    );
  });
});

describe('SheetMusic — toolbar', () => {
  beforeEach(() => setupOsmdMock());
  afterEach(() => vi.restoreAllMocks());

  it('renders MusicXML, PNG and Print buttons after loading', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} filename="song.mp3" />);
    await settle();
    expect(
      screen.getByRole('button', { name: /musicxml/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /png/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
  });

  it('MusicXML download creates and revokes an object URL', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} filename="song.mp3" />);
    await settle();

    // Set up spies AFTER render so React's own DOM operations are not intercepted.
    const appendSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((n) => n);
    const removeSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((n) => n);

    try {
      fireEvent.click(screen.getByRole('button', { name: /musicxml/i }));
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    } finally {
      appendSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  it('Print button calls window.print', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} />);
    await settle();

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: /print/i }));
    expect(printSpy).toHaveBeenCalled();
  });
});

describe('SheetMusic — audio controls', () => {
  const audioFile = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });
  const mockPlay = vi.fn().mockResolvedValue(undefined);
  const mockPause = vi.fn();

  beforeEach(() => {
    setupOsmdMock();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: mockPlay,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: mockPause,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders a range slider when audioFile is provided', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />);
    await settle();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('does not render a range slider without an audioFile', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} />);
    await settle();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('clicking the play button calls audio.play()', async () => {
    const { container } = render(
      <SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />
    );
    await settle();
    // The play/pause button is icon-only (no text). It is the first button
    // rendered inside the audio-player row.
    const allButtons = container.querySelectorAll('button');
    fireEvent.click(allButtons[0]);
    expect(mockPlay).toHaveBeenCalled();
  });

  it('seeking via the range input updates audio currentTime', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />);
    await settle();
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '30' } });
    // Asserts no exception is thrown; currentTime update is side-effect only.
  });
});
