// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

let db: PGlite;
const owner = '10000000-0000-0000-0000-000000000001';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA auth, storage TO authenticated, anon;
    CREATE TYPE public.app_role AS ENUM ('admin','reseller');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${owner}'::uuid $$;
    CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true)='yes' $$;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
    CREATE FUNCTION storage.extension(text) RETURNS text LANGUAGE sql AS $$ SELECT split_part($1,'.',-1) $$;
    CREATE TABLE storage.objects(bucket_id text, name text);
    GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated, anon;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
  await db.exec(readFileSync('drizzle/migrations/0024_admin_public_mp4_storage.sql', 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec("RESET ROLE; DELETE FROM storage.objects; SELECT set_config('test.admin','yes',false); SET ROLE authenticated;");
});
afterAll(async () => { await db?.close(); });
it('allows admin MP4 upload and deletion', async () => {
  await db.exec(`INSERT INTO storage.objects VALUES ('public-videos','${owner}/video.mp4')`);
  expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(1);
  await db.exec('DELETE FROM storage.objects');
  expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(0);
});
it('denies reseller uploads', async () => {
  await db.exec("SELECT set_config('test.admin','no',false)");
  await expect(db.exec(`INSERT INTO storage.objects VALUES ('public-videos','${owner}/video.mp4')`)).rejects.toMatchObject({ code: '42501' });
});
it('hides management records and prevents reseller deletion', async () => {
  await db.exec(`INSERT INTO storage.objects VALUES ('public-videos','${owner}/video.mp4'); SELECT set_config('test.admin','no',false)`);
  expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(0);
  await db.exec('DELETE FROM storage.objects; RESET ROLE');
  expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(1);
});
it('denies anonymous uploads', async () => {
  await db.exec('SET ROLE anon');
  await expect(db.exec(`INSERT INTO storage.objects VALUES ('public-videos','${owner}/video.mp4')`)).rejects.toMatchObject({ code: '42501' });
});
it('rejects non-MP4 uploads and other ownership paths', async () => {
  await expect(db.exec(`INSERT INTO storage.objects VALUES ('public-videos','${owner}/video.webm')`)).rejects.toMatchObject({ code: '42501' });
  await expect(db.exec("INSERT INTO storage.objects VALUES ('public-videos','other/video.mp4')")).rejects.toMatchObject({ code: '42501' });
});