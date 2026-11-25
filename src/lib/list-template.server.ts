// Per-catalog list templates for the Xtream API and M3U playlist.
//
// A line's lists differ from every other line's only in its username/password inside the stream
// links (see playbackUrl). Building a list costs 400–900 ms of CPU (catalog decode + 20k objects +
// JSON), which the free Workers plan (10 ms) kills at random. So each list is built once per stored
// catalog with placeholders, kept in memory (and in Cloudflare's cache, where available), and a
// line's copy is made by substituting its credentials (~5 ms). Templates hold no credentials.
import { catalogStamp } from './provider-catalog-store.server';

export const LINE_USER = '__ANDAM_LINE_USER__';
export const LINE_PASS = '__ANDAM_LINE_PASS__';

const MAX_BYTES = 48_000_000;
/** A template pre-encoded as UTF-8 pieces with a gap (user / pass) between consecutive pieces. */
export type Template = { parts: Uint8Array[]; gaps: ('u' | 'p')[]; bytes: number };
const memory = new Map<string, Template>();
let memoryBytes = 0;
const encoder = new TextEncoder();

function compile(text: string): Template {
  const parts: Uint8Array[] = []; const gaps: ('u' | 'p')[] = [];
  const re = /__ANDAM_LINE_(USER|PASS)__/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) { parts.push(encoder.encode(text.slice(last, m.index))); gaps.push(m[1] === 'USER' ? 'u' : 'p'); last = re.lastIndex; }
  parts.push(encoder.encode(text.slice(last)));
  return { parts, gaps, bytes: parts.reduce((n, x) => n + x.length, 0) };
}

type EdgeCache = { match(r: Request): Promise<Response | undefined>; put(r: Request, res: Response): Promise<void> };
const edge = (): EdgeCache | null => (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default ?? null;

function remember(key: string, text: string): Template {
  const template = compile(text);
  const old = memory.get(key);
  if (old !== undefined) { memory.delete(key); memoryBytes -= old.bytes; }
  memory.set(key, template); memoryBytes += template.bytes;
  while (memoryBytes > MAX_BYTES && memory.size > 1) {
    const oldest = memory.keys().next().value as string;
    memoryBytes -= memory.get(oldest)!.bytes; memory.delete(oldest);
  }
  return template;
}

/** Key for one list of the current stored catalog, or null when no catalog is stored yet. */
export async function templateKey(...parts: string[]): Promise<string | null> {
  const stamp = await catalogStamp();
  return stamp ? [stamp, ...parts].join('|') : null;
}

export async function listTemplate(key: string, build: () => Promise<string | null>): Promise<Template | null> {
  const hit = memory.get(key);
  if (hit !== undefined) return hit;
  const cache = edge();
  const cacheKey = new Request(`https://list-template.internal/${encodeURIComponent(key)}`);
  if (cache) {
    const cached = await cache.match(cacheKey).catch(() => undefined);
    if (cached) return remember(key, await cached.text());
  }
  const text = await build();
  if (text === null) return null;
  const template = remember(key, text);
  if (cache) {
    await cache.put(cacheKey, new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } })).catch(() => {});
  }
  return template;
}

/**
 * The line's own copy as UTF-8 bytes: exactly what playbackUrl would have produced for these
 * credentials (~4 ms for the 4.7 MB live list; no 4.7 MB string replace or re-encode).
 */
export function fillLine(template: Template, username: string, password: string): Uint8Array<ArrayBuffer> {
  const u = encoder.encode(encodeURIComponent(username));
  const p = encoder.encode(encodeURIComponent(password));
  let length = template.bytes;
  for (const g of template.gaps) length += g === 'u' ? u.length : p.length;
  const out = new Uint8Array(new ArrayBuffer(length));
  let offset = 0;
  for (let i = 0; i < template.parts.length; i++) {
    const part = template.parts[i]!;
    out.set(part, offset); offset += part.length;
    if (i < template.gaps.length) { const v = template.gaps[i] === 'u' ? u : p; out.set(v, offset); offset += v.length; }
  }
  return out;
}

/** ETag of a filled list without hashing its megabytes: it is fully determined by key + credentials. */
export async function lineEtag(key: string, username: string, password: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${key}\n${username}\n${password}`));
  return `"${Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')}"`;
}
