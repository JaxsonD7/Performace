import type { AppState, CollectionKey } from '@/types';

/**
 * Export helpers. CSV and JSON work today; PDF is left to the print stylesheet
 * (File > Print > Save as PDF) until a real report generator earns its weight.
 */

function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(state: AppState): void {
  const stamp = new Date().toISOString().slice(0, 10);
  download(`performace-backup-${stamp}.json`, JSON.stringify(state, null, 2), 'application/json');
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Quote anything that could break a cell boundary, and double inner quotes.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  // Union of keys, so a record with an optional field still gets its column.
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [headers.join(',')];
  rows.forEach((r) => lines.push(headers.map((h) => escapeCell(r[h])).join(',')));
  return lines.join('\n');
}

export function exportCollectionCSV(state: AppState, key: CollectionKey): void {
  const rows = state[key] as unknown as Record<string, unknown>[];
  if (!rows.length) return;
  const stamp = new Date().toISOString().slice(0, 10);
  download(`performace-${key}-${stamp}.csv`, toCSV(rows), 'text/csv');
}

/** Reads a user-picked .json backup back into an AppState. */
export async function importJSONFile(file: File): Promise<AppState> {
  const text = await file.text();
  const parsed = JSON.parse(text) as AppState;
  if (typeof parsed !== 'object' || parsed === null || !('settings' in parsed)) {
    throw new Error('That file does not look like a Performace backup.');
  }
  return parsed;
}
