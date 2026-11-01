// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TYPE public.app_role AS ENUM ('admin','reseller');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '10000000-0000-0000-0000-000000000001'::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
    CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true)='yes' $$;
    CREATE TABLE public.content_episodes(id integer PRIMARY KEY,title text);
    INSERT INTO public.content_episodes VALUES (17,'S01E17');
    GRANT SELECT,UPDATE,INSERT ON public.content_episodes TO authenticated;`);
  await db.exec(readFileSync('drizzle/migrations/0023_explicit_provider_episode_sharing.sql','utf8'));
},30000);
afterAll(async()=>{ await db?.close(); });

it('denies reseller enabling provider-wide sharing',async()=>{
  await db.exec("SELECT set_config('test.role','authenticated',false),set_config('test.admin','no',false); SET ROLE authenticated;");
  await expect(db.exec('UPDATE public.content_episodes SET provider_shared=true WHERE id=17')).rejects.toMatchObject({code:'42501'});
});
it('keeps ordinary authorised episode edits working',async()=>{
  await db.exec("UPDATE public.content_episodes SET title='S01E17 updated' WHERE id=17");
  expect((await db.query<{title:string}>('SELECT title FROM public.content_episodes WHERE id=17')).rows[0]?.title).toBe('S01E17 updated');
});
it('allows an admin to explicitly enable sharing',async()=>{
  await db.exec("SELECT set_config('test.admin','yes',false); UPDATE public.content_episodes SET provider_shared=true WHERE id=17");
  expect((await db.query<{provider_shared:boolean}>('SELECT provider_shared FROM public.content_episodes WHERE id=17')).rows[0]?.provider_shared).toBe(true);
});
it('denies a reseller disabling an approved shared episode',async()=>{
  await db.exec("SELECT set_config('test.admin','no',false)");
  await expect(db.exec('UPDATE public.content_episodes SET provider_shared=false WHERE id=17')).rejects.toMatchObject({code:'42501'});
});