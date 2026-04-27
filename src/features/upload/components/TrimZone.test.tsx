import { render, act } from '@testing-library/react';
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

vi.mock('wavesurfer.js/dist/plugins/regions.esm.js', () => {
  const mockRegion = {
    on: vi.fn(),
    play: vi.fn(),
    setOptions: vi.fn(),
    start: 0,
    end: 10,
  };
  return {
    default: {
      create: vi.fn(() => ({
        addRegion: vi.fn(() => mockRegion),
      })),
    },
  };
});

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
});

const mockFile = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' });

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
});
