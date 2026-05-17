import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadHistory,
  saveToHistory,
  removeFromHistory,
  formatRelativeDate,
} from './history';

const HISTORY_KEY = 'stafflines-history';

describe('loadHistory', () => {
  beforeEach(() => localStorage.clear());

  it('returns [] when nothing stored', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('returns parsed entries', () => {
    const entry = {
      filename: 'test.mp3',
      hash: 'abc',
      musicxml: '<xml/>',
      date: '2024-01-01T00:00:00.000Z',
    };
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry]));
    expect(loadHistory()).toEqual([entry]);
  });

  it('returns [] for corrupt JSON', () => {
    localStorage.setItem(HISTORY_KEY, 'not json');
    expect(loadHistory()).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify({ not: 'array' }));
    expect(loadHistory()).toEqual([]);
  });
});

describe('saveToHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('saves a new entry with the current date', () => {
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
    saveToHistory({ filename: 'test.mp3', hash: 'abc', musicxml: '<xml/>' });
    const stored = loadHistory();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      filename: 'test.mp3',
      hash: 'abc',
      date: '2024-06-01T12:00:00.000Z',
    });
  });

  it('deduplicates by hash, keeping the newer entry first', () => {
    saveToHistory({ filename: 'a.mp3', hash: 'abc', musicxml: '<xml1/>' });
    saveToHistory({ filename: 'a-new.mp3', hash: 'abc', musicxml: '<xml2/>' });
    const stored = loadHistory();
    expect(stored).toHaveLength(1);
    expect(stored[0].filename).toBe('a-new.mp3');
  });

  it('puts the newest entry at the front', () => {
    saveToHistory({ filename: 'a.mp3', hash: 'aaa', musicxml: '<xml/>' });
    saveToHistory({ filename: 'b.mp3', hash: 'bbb', musicxml: '<xml/>' });
    expect(loadHistory()[0].filename).toBe('b.mp3');
  });

  it('silently swallows localStorage quota errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() =>
      saveToHistory({ filename: 'a.mp3', hash: 'x', musicxml: '<xml/>' })
    ).not.toThrow();
    vi.restoreAllMocks();
  });

  it('caps history at 10 entries', () => {
    for (let i = 0; i < 12; i++) {
      saveToHistory({
        filename: `${i}.mp3`,
        hash: `h${i}`,
        musicxml: '<xml/>',
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
});

describe('removeFromHistory', () => {
  beforeEach(() => localStorage.clear());

  it('removes the entry with the given hash', () => {
    saveToHistory({ filename: 'a.mp3', hash: 'aaa', musicxml: '<xml/>' });
    saveToHistory({ filename: 'b.mp3', hash: 'bbb', musicxml: '<xml/>' });
    removeFromHistory('aaa');
    const stored = loadHistory();
    expect(stored).toHaveLength(1);
    expect(stored[0].hash).toBe('bbb');
  });

  it('silently swallows localStorage errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    saveToHistory({ filename: 'a.mp3', hash: 'aaa', musicxml: '<xml/>' });
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => removeFromHistory('aaa')).not.toThrow();
    vi.restoreAllMocks();
  });

  it('does nothing for an unknown hash', () => {
    saveToHistory({ filename: 'a.mp3', hash: 'aaa', musicxml: '<xml/>' });
    removeFromHistory('unknown');
    expect(loadHistory()).toHaveLength(1);
  });
});

describe('formatRelativeDate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const now = new Date('2024-06-15T12:00:00.000Z');

  it('returns "just now" for less than 1 minute ago', () => {
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 30_000).toISOString();
    expect(formatRelativeDate(iso)).toBe('just now');
  });

  it('returns minutes ago', () => {
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe('3h ago');
  });

  it('returns "yesterday" for ~25 hours ago', () => {
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 25 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe('yesterday');
  });

  it('returns days ago for 2-6 days', () => {
    vi.setSystemTime(now);
    const iso = new Date(now.getTime() - 3 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeDate(iso)).toBe('3d ago');
  });

  it('returns a locale date string for 7+ days ago', () => {
    vi.setSystemTime(now);
    const iso = new Date('2024-06-01T00:00:00.000Z').toISOString();
    const result = formatRelativeDate(iso);
    expect(result).toMatch(/\d/);
    expect(result).not.toMatch(/ago/);
  });
});
