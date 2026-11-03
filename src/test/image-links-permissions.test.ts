// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
let db: PGlite;
const uid = '10000000-0000-0000-0000-000000000001';
const row = `('https://example.test/a.webp','0123456789abcdef.webp','poster.png','webp',600,400,2048,'${uid}')`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage;
  GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;
  CREATE TYPE public.app_role AS ENUM ('admin','reseller');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${uid}'::uuid $$;
  CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true)='yes' $$;
  CREATE TABLE storage.objects(bucket_id text,name text);
  GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
  await db.exec(readFileSync('drizzle/migrations/0028_admin_channel_image_links.sql','utf8'));
},30000);
beforeEach(async () => { await db.exec("RESET ROLE; DELETE FROM public.image_links; DELETE FROM storage.objects; SELECT set_config('test.admin','yes',false); SET ROLE authenticated;"); });
afterAll(async () => { await db?.close(); });
const insertRow = () => db.exec(`INSERT INTO image_links(url,path,original_name,format,width,height,size_bytes,created_by) VALUES ${row}`);
it('allows admin history insert/read/delete', async () => { await insertRow(); expect((await db.query('SELECT * FROM image_links')).rows).toHaveLength(1); await db.exec('DELETE FROM image_links'); expect((await db.query('SELECT * FROM image_links')).rows).toHaveLength(0); });
it('blocks reseller history insert/read/delete', async () => { await insertRow(); await db.exec("SELECT set_config('test.admin','no',false)"); await expect(insertRow()).rejects.toMatchObject({ code:'42501' }); expect((await db.query('SELECT * FROM image_links')).rows).toHaveLength(0); await db.exec('DELETE FROM image_links; RESET ROLE'); expect((await db.query('SELECT * FROM image_links')).rows).toHaveLength(1); });
it('allows admin storage insert/update/delete', async () => { await db.exec("INSERT INTO storage.objects VALUES ('channel-images','0123456789abcdef.webp')"); expect((await db.query("UPDATE storage.objects SET name='abcdef0123456789.png' RETURNING *")).rows).toHaveLength(1); await db.exec('DELETE FROM storage.objects'); expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(0); });
it('blocks reseller storage writes while retaining public image reads', async () => { await db.exec("INSERT INTO storage.objects VALUES ('channel-images','0123456789abcdef.webp'); SELECT set_config('test.admin','no',false)"); await expect(db.exec("INSERT INTO storage.objects VALUES ('channel-images','abcdef0123456789.png')")).rejects.toMatchObject({code:'42501'}); expect((await db.query('UPDATE storage.objects SET name=name RETURNING *')).rows).toHaveLength(0); await db.exec('DELETE FROM storage.objects'); expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(1); });
it('allows anonymous image reads but denies history and uploads', async () => { await db.exec("INSERT INTO storage.objects VALUES ('channel-images','0123456789abcdef.webp'); SET ROLE anon;"); expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(1); await expect(db.query('SELECT * FROM image_links')).rejects.toMatchObject({code:'42501'}); await expect(db.exec("INSERT INTO storage.objects VALUES ('channel-images','abcdef0123456789.png')")).rejects.toMatchObject({code:'42501'}); });
it('rejects original filenames and non-output extensions even for admin', async () => { await expect(db.exec("INSERT INTO storage.objects VALUES ('channel-images','poster.svg')")).rejects.toMatchObject({code:'42501'}); });