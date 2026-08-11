/**
 * Ids are opaque strings. crypto.randomUUID is used when available so records
 * stay unique if the data is ever merged across devices; the counter fallback
 * keeps older browsers and non-secure contexts working.
 */
let counter = 0;

export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
