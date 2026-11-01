import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const owner = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const line = '20000000-0000-0000-0000-000000000001';
const foreignLine = '20000000-0000-0000-0000-000000000002';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS
      $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    CREATE TABLE public.lines(id uuid PRIMARY KEY, reseller_id uuid, max_connections integer);
    CREATE TABLE public.active_connections(line_id uuid,client_key text,last_seen timestamptz,user_agent text,ip text, UNIQUE(line_id,client_key));
    INSERT INTO public.lines VALUES ('${line}','${owner}',1),('${foreignLine}','${other}',1);
    INSERT INTO public.active_connections VALUES ('${foreignLine}','stale',now()-interval '2 minutes',NULL,NULL);
  `);
  await db.exec(readFileSync('drizzle/migrations/0022_restrict_connection_functions_to_line_owners.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });

async function session(role: string, uid = '') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)", [uid, role]);
  await db.exec(`SET ROLE ${role}`);
}
function call(extended: boolean, id = line, key = 'device') {
  return db.query<{allowed: boolean}>(extended
    ? 'SELECT public.check_stream_limit($1::uuid,$2::text,999::integer,NULL::text,NULL::text) AS allowed'
    : 'SELECT public.check_stream_limit($1::uuid,$2::text,999::integer) AS allowed', [id, key]);
}

describe.each([false, true])('connection access (extended=%s)', (extended) => {
  it('denies anonymous execution', async () => {
    await session('anon');
    await expect(call(extended)).rejects.toMatchObject({code: '42501'});
  });
  it('denies a signed-in non-owner, including when the line ID is guessed', async () => {
    await session('authenticated', other);
    await expect(call(extended)).rejects.toMatchObject({code: '42501'});
  });
  it('denies an authenticated role without a user identity', async () => {
    await session('authenticated');
    await expect(call(extended)).rejects.toMatchObject({code: '42501'});
  });
  it('allows the signed-in owner and uses the saved limit, not a caller-supplied 999', async () => {
    await session('authenticated', owner);
    expect((await call(extended)).rows[0]?.allowed).toBe(true);
    expect((await call(extended, line, 'extra-device')).rows[0]?.allowed).toBe(false);
  });
  it('does not clean up another owner’s connection records', async () => {
    await db.exec('RESET ROLE');
    const result = await db.query<{count: number}>("SELECT count(*)::int AS count FROM public.active_connections WHERE client_key='stale'");
    expect(result.rows[0]?.count).toBe(1);
  });
});

it('preserves trusted service-role customer playback', async () => {
  await session('service_role');
  expect((await call(true, foreignLine, 'trusted-device')).rows[0]?.allowed).toBe(true);
  expect((await call(false, foreignLine, 'trusted-device')).rows[0]?.allowed).toBe(true);
});