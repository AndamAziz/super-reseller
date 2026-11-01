// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { compactVideoName } from '@/lib/video-names';

let db: PGlite;
const path = 'owner/utf8-d8acd988d985d988d986daaf2d3231.mp4';
beforeAll(async () => {
  db = new PGlite();
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA storage; CREATE TABLE storage.objects(bucket_id text,name text);');
  await db.exec(readFileSync('drizzle/migrations/0026_compact_public_video_aliases.sql', 'utf8'));
  await db.query('INSERT INTO storage.objects VALUES ($1,$2)', ['public-videos', path]);
  await db.exec('SET ROLE anon');
}, 30000);
afterAll(async () => { await db?.close(); });
it('resolves the same compact public alias as the copy-link control without authentication', async () => {
  expect((await db.query<{ path: string }>('SELECT public.public_video_path($1) AS path', [compactVideoName(path)])).rows[0]?.path).toBe(path);
});
it('preserves already-shared movie-name links', async () => {
  expect((await db.query<{ path: string }>('SELECT public.public_video_path($1) AS path', [path.split('/')[1]])).rows[0]?.path).toBe(path);
});
it('does not resolve private buckets or unknown aliases', async () => {
  expect((await db.query<{ path: string | null }>("SELECT public.public_video_path('missing.mp4') AS path")).rows[0]?.path).toBeNull();
});