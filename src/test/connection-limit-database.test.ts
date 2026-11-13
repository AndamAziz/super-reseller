// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

let db: PGlite;
const owner = '10000000-0000-4000-8000-000000000001';
const admin = '10000000-0000-4000-8000-000000000002';
const line = '20000000-0000-4000-8000-000000000001';
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uid uuid, role text) RETURNS boolean LANGUAGE sql AS $$ SELECT (uid='${owner}' AND role='reseller') OR (uid='${admin}' AND role='admin') $$;
    CREATE TABLE public.profiles(id uuid primary key, credits integer);
    INSERT INTO profiles VALUES ('${owner}',1000),('${admin}',0);
    CREATE TABLE public.credit_transactions(reseller_id uuid,actor_id uuid,amount integer,reason text);
    CREATE TABLE public.lines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reseller_id uuid,username text,password text,custom_host text,expires_at timestamptz,max_connections integer NOT NULL DEFAULT 1 CONSTRAINT lines_max_connections_check CHECK(max_connections BETWEEN 1 AND 100));
    INSERT INTO lines(id,reseller_id,username,password,expires_at) VALUES('${line}','${owner}','fixture','password',now()+interval '1 month');
  `);
  const cost = readFileSync('drizzle/migrations/0012_bill_reseller_connection_upgrades_and_renewals.sql','utf8').split('CREATE OR REPLACE FUNCTION public.update_line')[0];
  if (!cost) throw new Error('Missing connection cost function');
  await db.exec(cost);
  await db.exec(readFileSync('drizzle/migrations/0013_enforce_connection_billing_for_legacy_updates.sql','utf8'));
  await db.exec(readFileSync('drizzle/migrations/0032_remove_max_connections_100_cap.sql','utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });
async function edit(count: number, uid = owner) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);
  return db.query<{charge:number}>("SELECT public.update_line($1,'password','',$2) AS charge",[line,count]);
}
it('keeps the database default at one', async () => {
  expect((await db.query<{max_connections:number}>('INSERT INTO lines DEFAULT VALUES RETURNING max_connections')).rows[0]?.max_connections).toBe(1);
});
it('saves 250 connections and charges only once for the 249 extra connections', async () => {
  expect((await edit(250)).rows[0]?.charge).toBe(249);
  expect((await db.query<{max_connections:number}>('SELECT max_connections FROM lines WHERE id=$1',[line])).rows[0]?.max_connections).toBe(250);
  expect((await db.query<{credits:number}>('SELECT credits FROM profiles WHERE id=$1',[owner])).rows[0]?.credits).toBe(751);
});
it('rejects an unaffordable increase without changing the saved count', async () => {
  await expect(edit(2000)).rejects.toThrow('Insufficient credits');
  expect((await db.query<{max_connections:number}>('SELECT max_connections FROM lines WHERE id=$1',[line])).rows[0]?.max_connections).toBe(250);
});
it('retains admin exemption for counts above 100', async () => {
  expect((await edit(1000,admin)).rows[0]?.charge).toBe(0);
  expect((await db.query<{credits:number}>('SELECT credits FROM profiles WHERE id=$1',[owner])).rows[0]?.credits).toBe(751);
});
it('rejects zero in the RPC and table', async () => {
  await expect(edit(0)).rejects.toThrow('positive integer');
  await expect(db.query('UPDATE lines SET max_connections=0 WHERE id=$1',[line])).rejects.toMatchObject({code:'23514'});
});