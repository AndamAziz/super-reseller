// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '10000000-0000-0000-0000-000000000001'::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true)='yes' $$;`);
  await db.exec(readFileSync('drizzle/migrations/0031_admin_vod_library.sql','utf8'));
  await db.exec(readFileSync('drizzle/migrations/0034_vod_playable_sources.sql','utf8'));
}, 30000);
beforeEach(async () => { await db.exec("RESET ROLE; DELETE FROM vod_library; SELECT set_config('test.admin','yes',false); SET ROLE authenticated;"); });
afterAll(async () => { await db?.close(); });
const insert = () => db.exec("INSERT INTO vod_library(media_type,tmdb_id,title) VALUES ('movie',120,'Movie')");
it('allows only admin to save, view, edit and delete curated titles', async () => {
  await insert(); expect((await db.query('SELECT * FROM vod_library')).rows).toHaveLength(1);
  expect((await db.query("UPDATE vod_library SET title='Edited' RETURNING title")).rows).toEqual([{ title: 'Edited' }]);
  await db.exec('DELETE FROM vod_library'); expect((await db.query('SELECT * FROM vod_library')).rows).toHaveLength(0);
});
it('blocks reseller reads and writes without deleting admin titles', async () => {
  await insert(); await db.exec("SELECT set_config('test.admin','no',false)");
  expect((await db.query('SELECT * FROM vod_library')).rows).toHaveLength(0);
  await expect(insert()).rejects.toMatchObject({ code: '42501' });
  expect((await db.query("UPDATE vod_library SET title='Forbidden' RETURNING *")).rows).toHaveLength(0);
  await db.exec('DELETE FROM vod_library; RESET ROLE'); expect((await db.query('SELECT * FROM vod_library')).rows).toHaveLength(1);
});
it('denies anonymous library access', async () => { await db.exec('SET ROLE anon'); await expect(db.query('SELECT * FROM vod_library')).rejects.toMatchObject({ code: '42501' }); });
it('allows admin source edits but blocks reseller source changes', async () => {
  await insert();
  expect((await db.query("UPDATE vod_library SET source_url='https://media.example/video.mp4' RETURNING source_url")).rows).toEqual([{ source_url: 'https://media.example/video.mp4' }]);
  await db.exec("SELECT set_config('test.admin','no',false)");
  expect((await db.query("UPDATE vod_library SET source_url='https://media.example/other.mp4' RETURNING source_url")).rows).toHaveLength(0);
});