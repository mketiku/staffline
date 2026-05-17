import { render, act, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TrimZone } from './TrimZone';

// --- WaveSurfer mock ---
type EventHandler = (...args: unknown[]) => void;

interface MockWsInstance {
  on: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  isPlaying: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  getDecodedData: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
  _handlers: Record<string, EventHandler[]>;
}

let lastWsInstance: MockWsInstance | null = null;
const createCallCount = { count: 0 };

vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn(() => {
      createCallCount.count++;
      const handlers: Record<string, EventHandler[]> = {};
      const instance: MockWsInstance = {
        _handlers: handlers,
        on: vi.fn((event: string, handler: EventHandler) => {
          handlers[event] = handlers[event] ?? [];
          handlers[event].push(handler);
        }),
        destroy: vi.fn(),
        isPlaying: vi.fn(() => false),
        pause: vi.fn(),
        getDecodedData: vi.fn(() => null),
        emit(event, ...args) {
          handlers[event]?.forEach((h) => h(...args));
        },
      };
      lastWsInstance = instance;
      return instance;
    }),
  },
}));

const { mockRegion } = vi.hoisted(() => ({
  mockRegion: {
    on: vi.fn(),
    play: vi.fn(),
    setOptions: vi.fn(),
    start: 0,
    end: 10,
  },
}));

vi.mock('wavesurfer.js/dist/plugins/regions.esm.js', () => ({
  default: {
    create: vi.fn(() => ({
      addRegion: vi.fn(() => mockRegion),
    })),
  },
}));

vi.mock('@/lib/audio.worker?worker', () => ({
  default: class {
    onmessage: null = null;
    onerror: null = null;
    postMessage() {}
    terminate() {}
  },
}));

// Silence URL.createObjectURL / revokeObjectURL in jsdom
beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  });
  createCallCount.count = 0;
  lastWsInstance = null;
  mockRegion.on.mockReset();
  mockRegion.play.mockReset();
  mockRegion.setOptions.mockReset();
  mockRegion.start = 0;
  mockRegion.end = 10;
});

const mockFile = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' });

async function renderReady(onConfirm = vi.fn(), onCancel = vi.fn()) {
  const utils = render(
    <TrimZone file={mockFile} onConfirm={onConfirm} onCancel={onCancel} />
  );
  await act(async () => {
    lastWsInstance?.emit('ready', 10);
  });
  return { ...utils, onConfirm, onCancel };
}

describe('TrimZone', () => {
  it('does not recreate WaveSurfer when onConfirm reference changes', async () => {
    const onConfirm1 = vi.fn();
    const onConfirm2 = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <TrimZone file={mockFile} onConfirm={onConfirm1} onCancel={onCancel} />
    );

    // Simulate WaveSurfer loading
    await act(async () => {
      lastWsInstance?.emit('ready', 10);
    });

    const destroyCallsAfterReady = (
      lastWsInstance?.destroy as ReturnType<typeof vi.fn>
    ).mock.calls.length;
    const createCountAfterReady = createCallCount.count;

    // Simulate parent re-render with a new onConfirm reference (e.g. from useCyclingFact)
    rerender(
      <TrimZone file={mockFile} onConfirm={onConfirm2} onCancel={onCancel} />
    );

    // WaveSurfer must NOT have been destroyed or recreated
    expect(
      (lastWsInstance?.destroy as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBe(destroyCallsAfterReady);
    expect(createCallCount.count).toBe(createCountAfterReady);
  });

  it('does not call onConfirm when a cleaned-up WaveSurfer instance fires error', async () => {
    const onConfirm = vi.fn();

    const { unmount } = render(
      <TrimZone file={mockFile} onConfirm={onConfirm} onCancel={vi.fn()} />
    );

    const staleInstance = lastWsInstance!;

    // Simulate StrictMode cleanup: unmount sets mounted=false and calls ws.destroy()
    unmount();

    // Error fires after cleanup (e.g. in-flight fetch finally rejects)
    await act(async () => {
      staleInstance.emit('error');
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  describe('after ready', () => {
    it('clicking play calls region.play() when not already playing', async () => {
      await renderReady();
      const playBtn = screen.getByRole('button', { name: 'Play selection' });
      await act(async () => {
        fireEvent.click(playBtn);
      });
      expect(mockRegion.play).toHaveBeenCalledTimes(1);
    });

    it('ws play event sets isPlaying — Pause icon appears', async () => {
      await renderReady();
      await act(async () => {
        lastWsInstance?.emit('play');
      });
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    });

    it('ws pause event restores Play icon', async () => {
      await renderReady();
      await act(async () => {
        lastWsInstance?.emit('play');
      });
      await act(async () => {
        lastWsInstance?.emit('pause');
      });
      expect(
        screen.getByRole('button', { name: 'Play selection' })
      ).toBeInTheDocument();
    });

    it('ws finish event restores Play icon', async () => {
      await renderReady();
      await act(async () => {
        lastWsInstance?.emit('play');
      });
      await act(async () => {
        lastWsInstance?.emit('finish');
      });
      expect(
        screen.getByRole('button', { name: 'Play selection' })
      ).toBeInTheDocument();
    });

    it('clicking Cancel calls ws.pause() and invokes onCancel', async () => {
      const { onCancel } = await renderReady();
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      await act(async () => {
        fireEvent.click(cancelBtn);
      });
      expect(lastWsInstance?.pause).toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('clicking "Transcribe full track" calls onConfirm(file) directly (isFullTrack path)', async () => {
      const { onConfirm } = await renderReady();
      const confirmBtn = screen.getByRole('button', {
        name: /transcribe full track/i,
      });
      await act(async () => {
        fireEvent.click(confirmBtn);
      });
      expect(onConfirm).toHaveBeenCalledWith(mockFile);
    });

    it('handleConfirm with non-full-track region and no decoded data calls onConfirm(file)', async () => {
      const { onConfirm } = await renderReady();

      // Simulate region drag — fire the update-end handler captured by region.on
      mockRegion.start = 1;
      mockRegion.end = 8;
      const updateEndCall = mockRegion.on.mock.calls.find(
        (args: unknown[]) => args[0] === 'update-end'
      );
      expect(updateEndCall).toBeDefined();
      await act(async () => {
        updateEndCall![1]();
      });

      // getDecodedData returns null (default), so falls back to onConfirm(file)
      const confirmBtn = screen.getByRole('button', {
        name: /transcribe selection/i,
      });
      await act(async () => {
        fireEvent.click(confirmBtn);
      });
      expect(onConfirm).toHaveBeenCalledWith(mockFile);
    });

    it('blurring start input with "0:05" calls setOptions with start=5', async () => {
      await renderReady();
      const startInput = screen.getByRole('textbox', { name: 'Start time' });
      await act(async () => {
        fireEvent.change(startInput, { target: { value: '0:05' } });
        fireEvent.blur(startInput);
      });
      expect(mockRegion.setOptions).toHaveBeenCalledWith(
        expect.objectContaining({ start: 5 })
      );
    });

    it('blurring end input with "0:05" calls setOptions with end=5', async () => {
      await renderReady();
      const endInput = screen.getByRole('textbox', { name: 'End time' });
      await act(async () => {
        fireEvent.change(endInput, { target: { value: '0:05' } });
        fireEvent.blur(endInput);
      });
      expect(mockRegion.setOptions).toHaveBeenCalledWith(
        expect.objectContaining({ end: 5 })
      );
    });

    it('parseTimeInput: plain seconds "90" sets start=90 (clamped to end-0.5)', async () => {
      await renderReady();
      const startInput = screen.getByRole('textbox', { name: 'Start time' });
      await act(async () => {
        fireEvent.change(startInput, { target: { value: '90' } });
        fireEvent.blur(startInput);
      });
      // duration=10, so max clamped start = end(10) - 0.5 = 9.5
      expect(mockRegion.setOptions).toHaveBeenCalledWith(
        expect.objectContaining({ start: 9.5 })
      );
    });

    it('parseTimeInput: empty string resets start to current value', async () => {
      await renderReady();
      const startInput = screen.getByRole('textbox', { name: 'Start time' });
      await act(async () => {
        fireEvent.change(startInput, { target: { value: '' } });
        fireEvent.blur(startInput);
      });
      // null result → keeps startRef.current (0)
      expect(mockRegion.setOptions).toHaveBeenCalledWith(
        expect.objectContaining({ start: 0 })
      );
    });

    it('parseTimeInput: invalid string "abc" resets start to current value', async () => {
      await renderReady();
      const startInput = screen.getByRole('textbox', { name: 'Start time' });
      await act(async () => {
        fireEvent.change(startInput, { target: { value: 'abc' } });
        fireEvent.blur(startInput);
      });
      expect(mockRegion.setOptions).toHaveBeenCalledWith(
        expect.objectContaining({ start: 0 })
      );
    });
  });
});
