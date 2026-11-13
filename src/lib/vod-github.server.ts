import { Buffer } from 'node:buffer';
import { appendVodEntry } from './vod-source';
import type { VodEntry } from './vod';

const path = 'repos/AndamAziz/Andamiptv/contents/playlist.m3u';
async function github(suffix: string, init: RequestInit = {}) {
  const key = process.env['GITHUB_API_KEY'];
  const token = process.env['LOVABLE_API_KEY'];
  if (!key || !token) throw new Error('Connect GitHub before publishing.');
  const res = await fetch(`https://connector-gateway.lovable.dev/github/${path}${suffix}`, {
    ...init, signal: AbortSignal.timeout(30000), headers: {
      Accept: 'application/vnd.github+json', 'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`, 'X-Connection-Api-Key': key, ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`GitHub playlist request [${res.status}]: ${body}`);
    throw new Error(`GitHub playlist request failed (${res.status}): ${body}`);
  }
  return res;
}
export async function publishVodSource(item: VodEntry) {
  const info = await (await github('?ref=main')).json() as { sha: string; size: number };
  if (!info.sha || info.size > 20_000_000) throw new Error('Playlist metadata invalid or file too large.');
  const response = await github('?ref=main', { headers: { Accept: 'application/vnd.github.raw+json' } });
  const text = await response.text();
  const updated = appendVodEntry(text, item);
  if (updated === text) return { ok: true, unchanged: true };
  await github('', { method: 'PUT', body: JSON.stringify({ message: `Add playable ${item.media_type} library entry`, branch: 'main', sha: info.sha, content: Buffer.from(updated, 'utf8').toString('base64') }) });
  return { ok: true, unchanged: false };
}