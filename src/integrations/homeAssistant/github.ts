import type { HaStatus, HomeAssistantContext } from '@/types';

/**
 * Pushes homeassistant.json to a dedicated private repo — not the sync gist,
 * and not this app's own public repo — so schedule/sleep/gym timing never
 * sits on the public GitHub Pages surface the mail digest already uses. This
 * is a *separate* token from the sync gist token: `Settings.haPushToken` is a
 * fine-grained PAT scoped only to this one repo, Contents: Read+write. Home
 * Assistant reads with its own, separate, read-only PAT that never touches
 * this browser at all.
 */

export class HomeAssistantSyncError extends Error {}

const OWNER = 'JaxsonD7';
const REPO = 'performace-ha';
const PATH = 'homeassistant.json';
const STATUS_PATH = 'ha-status.json';
const API = 'https://api.github.com';
const CONTENTS_URL = `${API}/repos/${OWNER}/${REPO}/contents/${PATH}`;
const STATUS_URL = `${API}/repos/${OWNER}/${REPO}/contents/${STATUS_PATH}`;

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/** Raw media type — the response body is the file's bytes directly, no base64 envelope to unwrap. */
function rawHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github.raw+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** btoa() only handles Latin-1 — this survives titles with real unicode (emoji habit names, accented course names, …). */
function toBase64(content: string): string {
  return btoa(unescape(encodeURIComponent(content)));
}

/** The current file's blob SHA, or undefined if it doesn't exist yet — the Contents API needs it to update rather than conflict. */
async function currentSha(token: string): Promise<string | undefined> {
  const res = await fetch(CONTENTS_URL, { headers: headers(token) });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new HomeAssistantSyncError(`GitHub returned ${res.status} while checking homeassistant.json.`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

function putBody(context: HomeAssistantContext, sha?: string): string {
  return JSON.stringify({
    message: `Update Home Assistant context — ${context.generated_at}`,
    content: toBase64(JSON.stringify(context, null, 2)),
    branch: 'main',
    ...(sha ? { sha } : {}),
  });
}

/** Pushes the current context, looking up the file's SHA first. Returns the new SHA to cache for the next flush. */
export async function pushHomeAssistantContext(token: string, context: HomeAssistantContext): Promise<string> {
  const sha = await currentSha(token);
  const res = await fetch(CONTENTS_URL, { method: 'PUT', headers: headers(token), body: putBody(context, sha) });
  if (!res.ok) {
    if (res.status === 401) throw new HomeAssistantSyncError('That Home Assistant push token was rejected. Check it in Settings.');
    if (res.status === 404) throw new HomeAssistantSyncError('performace-ha repo not found, or the token lacks Contents access to it.');
    const body = await res.text().catch(() => '');
    throw new HomeAssistantSyncError(`GitHub returned an error (${res.status}) pushing homeassistant.json. ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content: { sha: string } };
  return data.content.sha;
}

/**
 * Best-effort push for tab-hide/close, mirroring `flushSyncGist` — `keepalive`
 * is the one request shape allowed to outlive page teardown. Uses a cached
 * SHA rather than looking it up fresh (no time for two requests during
 * teardown); a stale SHA here just 409s, which is harmless since the next
 * debounced or periodic push corrects it with a fresh lookup.
 */
export function flushHomeAssistantContext(token: string, context: HomeAssistantContext, cachedSha?: string): void {
  const body = putBody(context, cachedSha);
  if (body.length > 60_000) return;
  fetch(CONTENTS_URL, { method: 'PUT', headers: headers(token), body, keepalive: true }).catch(() => {});
}

/**
 * Reads ha-status.json — the reverse direction, written by Home Assistant
 * itself using its own token. This app never writes to this file. A 404
 * (HA hasn't written it yet) or any other failure resolves to null rather
 * than throwing — this is a nice-to-have display, not something that should
 * ever block the app.
 */
export async function fetchHaStatus(token: string): Promise<HaStatus | null> {
  try {
    const res = await fetch(STATUS_URL, { headers: rawHeaders(token) });
    if (!res.ok) return null;
    return (await res.json()) as HaStatus;
  } catch {
    return null;
  }
}
