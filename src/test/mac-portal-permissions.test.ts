// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

let db: PGlite;
const owner = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const mac = '00:1A:79:00:00:01';
const hash = 'a'.repeat(64);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uid uuid, role text) RETURNS boolean LANGUAGE sql AS $$ SELECT role='reseller' AND uid IS NOT NULL $$;
    CREATE TABLE public.profiles(id uuid primary key,credits integer);
    INSERT INTO public.profiles VALUES ('${owner}',20),('${other}',20);
    CREATE TABLE public.lines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reseller_id uuid,username text UNIQUE,password text,expires_at timestamptz,custom_host text,max_connections integer DEFAULT 1);
    CREATE FUNCTION public.create_line(_username text,_password text,_months integer) RETURNS public.lines LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE l public.lines; BEGIN UPDATE profiles SET credits=credits-_months WHERE id=auth.uid(); INSERT INTO lines(reseller_id,username,password,expires_at) VALUES(auth.uid(),_username,_password,now()+interval '1 month') RETURNING * INTO l; RETURN l; END $$;
    CREATE FUNCTION public.create_test_line(_username text,_password text,_customer text) RETURNS public.lines LANGUAGE sql AS $$ SELECT public.create_line(_username,_password,0) $$;
    CREATE FUNCTION public.update_line(_line_id uuid,_password text,_custom_host text,_max_connections integer,_expires_at timestamptz DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN UPDATE profiles SET credits=credits-1 WHERE id=auth.uid(); UPDATE lines SET password=_password,max_connections=_max_connections WHERE id=_line_id; RETURN 1; END $$;
  `);
  await db.exec(readFileSync('drizzle/migrations/0030_add_mac_portal_subscribers_and_sessions.sql','utf8'));
  await session('authenticated', owner);
  await db.query("SELECT public.create_subscriber('mac-owner','password',1,'mac',$1)",[mac]);
}, 30000);
afterAll(async () => { await db?.close(); });
async function session(role: string, uid = '') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);
  await db.exec(`SET ROLE ${role}`);
}
async function authorize(token = hash, newToken?: string, address = mac) {
  const result = await db.query<{ result: Record<string, unknown> }>('SELECT public.authorize_mac_portal($1,$2,$3,$4) AS result',[address,token,newToken ?? null,'203.0.113.1']);
  return result.rows[0]?.result;
}
it('enforces unique uppercase MACs and rolls back charged creation on duplicates', async () => {
  await session('authenticated',owner);
  await expect(db.query("SELECT public.create_subscriber('duplicate','password',1,'mac',$1)",[mac.toLowerCase()])).rejects.toMatchObject({ code:'23505' });
  await db.exec('RESET ROLE');
  expect((await db.query<{ credits: number }>('SELECT credits FROM profiles WHERE id=$1',[owner])).rows[0]?.credits).toBe(19);
  expect((await db.query<{ count: number }>("SELECT count(*)::int AS count FROM lines WHERE username='duplicate'")).rows[0]?.count).toBe(0);
});
it('denies non-owner editing and rolls back the wrapper charge', async () => {
  await db.exec('RESET ROLE');
  const id=(await db.query<{id:string}>("SELECT id FROM lines WHERE username='mac-owner'")).rows[0]?.id;
  await session('authenticated',other);
  await expect(db.query("SELECT public.update_subscriber($1,'changed','',2,'both',$2)",[id,mac])).rejects.toThrow('Not allowed');
  await db.exec('RESET ROLE');
  expect((await db.query<{credits:number}>('SELECT credits FROM profiles WHERE id=$1',[other])).rows[0]?.credits).toBe(20);
});
it('denies anonymous RPC execution and all authenticated session-table reads', async () => {
  await session('anon');
  await expect(db.query("SELECT public.create_subscriber('bad','password',1)")).rejects.toMatchObject({code:'42501'});
  await session('authenticated',owner);
  await expect(authorize()).rejects.toMatchObject({code:'42501'});
  await expect(db.query('SELECT * FROM mac_portal_sessions')).rejects.toMatchObject({code:'42501'});
});
it('stores hash-only sessions for exactly 24 hours and records MAC login time and IP', async () => {
  await session('service_role');
  expect(await authorize(hash,hash)).toMatchObject({mac,username:'mac-owner'});
  expect(await authorize()).toMatchObject({mac});
  await db.exec('RESET ROLE');
  const row=(await db.query<{seconds:number,ip:string}>("SELECT round(extract(epoch from (s.expires_at-l.last_mac_login_at)))::int AS seconds,l.last_mac_login_ip AS ip FROM mac_portal_sessions s JOIN lines l ON l.id=s.line_id WHERE token_hash=$1",[hash])).rows[0];
  expect(row).toEqual({seconds:86400,ip:'203.0.113.1'});
});
it('rejects tokens used with another MAC, expired tokens, disabled accounts and expired subscriptions', async () => {
  await session('service_role');
  expect(await authorize(hash,undefined,'00:1A:79:FF:FF:FF')).toEqual({error:'Unknown MAC address'});
  await db.exec('RESET ROLE');
  await db.query("UPDATE mac_portal_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[hash]);
  await session('service_role');
  expect(await authorize()).toEqual({error:'Invalid or expired token'});
  await db.exec("RESET ROLE; UPDATE lines SET portal_disabled=true WHERE username='mac-owner'");
  await session('service_role');
  expect(await authorize()).toEqual({error:'Account disabled'});
  await db.exec("RESET ROLE; UPDATE lines SET portal_disabled=false,expires_at=now()-interval '1 second' WHERE username='mac-owner'");
  await session('service_role');
  expect(await authorize()).toEqual({error:'Subscription expired'});
  await db.exec("RESET ROLE; UPDATE lines SET expires_at=now()+interval '1 month' WHERE username='mac-owner'");
});
it('rate-limits independently by MAC rather than shared IP and resets after one minute', async () => {
  await db.exec('RESET ROLE');
  await db.query('UPDATE mac_portal_rate_limits SET requests=120 WHERE mac_address=$1',[mac]);
  await session('service_role');
  expect(await authorize()).toEqual({error:'Too many requests; retry shortly'});
  await db.exec('RESET ROLE');
  await db.query("UPDATE mac_portal_rate_limits SET window_start=now()-interval '61 seconds' WHERE mac_address=$1",[mac]);
  await session('service_role');
  expect(await authorize()).toEqual({error:'Invalid or expired token'});
  await db.exec('RESET ROLE');
  expect((await db.query<{requests:number}>('SELECT requests FROM mac_portal_rate_limits WHERE mac_address=$1',[mac])).rows[0]?.requests).toBe(1);
});