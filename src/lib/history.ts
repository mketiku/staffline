const HISTORY_KEY = 'stafflines-history';
const MAX_ENTRIES = 10;

export interface HistoryEntry {
  filename: string;
  hash: string;
  musicxml: string;
  date: string;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    // Corrupt storage or private browsing
    return [];
  }
}

export function saveToHistory(entry: Omit<HistoryEntry, 'date'>): void {
  try {
    const existing = loadHistory().filter((e) => e.hash !== entry.hash);
    const updated = [
      { ...entry, date: new Date().toISOString() },
      ...existing,
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Storage quota exceeded or private browsing
  }
}

export function removeFromHistory(hash: string): void {
  try {
    const updated = loadHistory().filter((e) => e.hash !== hash);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Storage quota exceeded or private browsing
  }
}

export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
