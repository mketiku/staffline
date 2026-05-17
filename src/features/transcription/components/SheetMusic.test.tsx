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
    const allButtons = container.querySelectorAll('button');
    fireEvent.click(allButtons[0]);
    expect(mockPlay).toHaveBeenCalled();
  });

  it('seeking via the range input updates audio currentTime', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />);
    await settle();
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '30' } });
  });
});

describe('SheetMusic — audio event handlers', () => {
  const audioFile = new File(['audio'], 'song.mp3', { type: 'audio/mpeg' });

  type MockAudio = {
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    paused: boolean;
    currentTime: number;
    duration: number;
  };

  let mockAudio: MockAudio;

  beforeEach(() => {
    setupOsmdMock();
    mockAudio = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      paused: true,
      currentTime: 0,
      duration: 120,
    };
    vi.stubGlobal(
      'Audio',
      vi.fn(() => mockAudio)
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(performance.now());
      return 0;
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  function getHandler(name: string): () => void {
    const call = mockAudio.addEventListener.mock.calls.find(
      (args: unknown[]) => args[0] === name
    );
    return call![1] as () => void;
  }

  it('timeupdate event updates the slider position', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />);
    await settle();
    // Set duration first so the slider max allows a non-zero progress value.
    mockAudio.duration = 120;
    act(() => getHandler('loadedmetadata')());
    mockAudio.currentTime = 45;
    act(() => getHandler('timeupdate')());
    expect(screen.getByRole('slider')).toHaveValue('45');
  });

  it('loadedmetadata event updates the duration display', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />);
    await settle();
    mockAudio.duration = 180;
    act(() => getHandler('loadedmetadata')());
    expect(screen.getByRole('slider')).toHaveAttribute('max', '180');
  });

  it('ended event resets playing state and progress', async () => {
    const { container } = render(
      <SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />
    );
    await settle();
    mockAudio.paused = false;
    const allButtons = container.querySelectorAll('button');
    fireEvent.click(allButtons[0]);
    act(() => getHandler('ended')());
    expect(screen.getByRole('slider')).toHaveValue('0');
  });

  it('togglePlay calls audio.pause() when audio is playing', async () => {
    const { container } = render(
      <SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />
    );
    await settle();
    mockAudio.paused = false;
    const allButtons = container.querySelectorAll('button');
    fireEvent.click(allButtons[0]);
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('audio cleanup runs on unmount', async () => {
    const { unmount } = render(
      <SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />
    );
    await settle();
    unmount();
    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.removeEventListener).toHaveBeenCalled();
  });

  it('seeking via slider updates audio.currentTime and progress', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} audioFile={audioFile} />);
    await settle();
    mockAudio.duration = 120;
    act(() => getHandler('loadedmetadata')());
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '60' } });
    expect(mockAudio.currentTime).toBe(60);
    expect(slider).toHaveValue('60');
  });
});

describe('SheetMusic — resize handler', () => {
  beforeEach(() => setupOsmdMock());
  afterEach(() => vi.restoreAllMocks());

  it('fires OSMD render again when window is resized after initial render', async () => {
    // Only fake setTimeout/clearTimeout — do NOT take over requestAnimationFrame,
    // otherwise vi.useFakeTimers replaces our synchronous RAF stub and the
    // initial OSMD render (which uses RAF) never completes, so isRendering stays
    // true and the resize effect returns early.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      render(<SheetMusic musicxml={SAMPLE_XML} />);
      await settle();
      const renderCountBefore = mockRender.mock.calls.length;
      act(() => {
        fireEvent(window, new Event('resize'));
        vi.advanceTimersByTime(200);
      });
      expect(mockRender.mock.calls.length).toBeGreaterThan(renderCountBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SheetMusic — downloadPNG', () => {
  beforeEach(() => setupOsmdMock());
  afterEach(() => vi.restoreAllMocks());

  it('PNG button click does not throw when container has no SVG elements', async () => {
    render(<SheetMusic musicxml={SAMPLE_XML} filename="track.mp3" />);
    await settle();
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: /png/i }))
    ).not.toThrow();
  });

  it('PNG button tolerates SVG-to-image conversion errors', async () => {
    const { container } = render(
      <SheetMusic musicxml={SAMPLE_XML} filename="track.mp3" />
    );
    await settle();

    const sheetContainer = container.querySelector(
      'div[class=""]'
    ) as HTMLDivElement;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.defineProperty(svg, 'clientWidth', { value: 800 });
    Object.defineProperty(svg, 'clientHeight', { value: 600 });
    sheetContainer?.appendChild(svg);

    const mockCtx = {
      scale: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (this: HTMLCanvasElement, cb) {
        cb(null);
      }
    );

    class FakeImageError {
      onload?: () => void;
      onerror?: () => void;
      set src(_: string) {
        Promise.resolve().then(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', FakeImageError);

    try {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /png/i }));
        await new Promise((r) => setTimeout(r, 50));
      });
      // Should complete without throwing even when img.onerror fires.
    } finally {
      vi.stubGlobal('Image', globalThis.Image);
    }
  });

  it('PNG button downloads when SVG elements are present', async () => {
    const { container } = render(
      <SheetMusic musicxml={SAMPLE_XML} filename="track.mp3" />
    );
    await settle();

    const sheetContainer = container.querySelector(
      'div[class=""]'
    ) as HTMLDivElement;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.defineProperty(svg, 'clientWidth', { value: 800 });
    Object.defineProperty(svg, 'clientHeight', { value: 600 });
    sheetContainer?.appendChild(svg);

    const mockCtx = {
      scale: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (this: HTMLCanvasElement, cb) {
        cb(new Blob(['png'], { type: 'image/png' }));
      }
    );

    // Stub Image so img.onload fires synchronously when src is set.
    const OrigImage = globalThis.Image;
    class FakeImage {
      onload?: () => void;
      onerror?: () => void;
      set src(_: string) {
        Promise.resolve().then(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', FakeImage);

    const appendSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((n) => n);
    const removeSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((n) => n);

    try {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /png/i }));
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(mockCtx.drawImage).toHaveBeenCalled();
    } finally {
      appendSpy.mockRestore();
      removeSpy.mockRestore();
      vi.stubGlobal('Image', OrigImage);
    }
  });
});
