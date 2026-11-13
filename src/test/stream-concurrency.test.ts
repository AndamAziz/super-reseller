// @vitest-environment node
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Dedicated disposable PostgreSQL only; never point this at the application database.
const url = process.env['CONCURRENCY_TEST_DATABASE_URL'];
if (url && new URL(url).hostname !== '127.0.0.1') throw new Error('Concurrency tests require a disposable loopback database');
const suite = url ? describe : describe.skip;
suite('real PostgreSQL concurrent stream admission', () => {
  const sql = postgres(url ?? '', { max: 260 });
  const line = '20000000-0000-0000-0000-000000000250';
  beforeAll(async () => {
    await sql.unsafe(`CREATE SCHEMA auth;
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
      CREATE TABLE lines(id uuid PRIMARY KEY, reseller_id uuid, max_connections integer);
      CREATE TABLE active_connections(line_id uuid, client_key text, last_seen timestamptz,
        user_agent text, ip text, UNIQUE(line_id,client_key));
      INSERT INTO lines VALUES ('${line}',NULL,250);
      CREATE FUNCTION delayed_insert() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN PERFORM pg_sleep(0.03); RETURN NEW; END $$;
      CREATE TRIGGER delay BEFORE INSERT ON active_connections FOR EACH ROW EXECUTE FUNCTION delayed_insert();`);
    await sql.unsafe(readFileSync('drizzle/migrations/0022_restrict_connection_functions_to_line_owners.sql', 'utf8'));
    for (const file of readdirSync('drizzle/migrations').filter(f => f.endsWith('_serialize_stream_admission.sql')).sort()) {
      await sql.unsafe(readFileSync(`drizzle/migrations/${file}`, 'utf8'));
    }
  }, 30000);
  afterAll(async () => { await sql.end(); });
  const admit = (key: string) => sql<{allowed: boolean}[]>`SELECT check_stream_limit(${line}::uuid,${key}::text,250::integer,'player'::text,'test'::text) AS allowed`;
  it('admits 250 distinct clients, rejects client 251, and allows reconnects', async () => {
    const results = await Promise.all(Array.from({ length: 250 }, (_, i) => admit(`client-${i}`)));
    expect(results.filter(r => r[0]?.allowed === true)).toHaveLength(250);
    expect((await admit('client-251'))[0]?.allowed).toBe(false);
    expect((await admit('client-0'))[0]?.allowed).toBe(true);
    expect(Number((await sql`SELECT count(*) AS count FROM active_connections`)[0]?.['count'])).toBe(250);
  }, 60000);
  it('never exceeds 250 when 260 clients arrive together', async () => {
    await sql`DELETE FROM active_connections WHERE line_id=${line}::uuid`;
    const results = await Promise.all(Array.from({ length: 260 }, (_, i) => admit(`burst-${i}`)));
    expect(results.filter(r => r[0]?.allowed === true)).toHaveLength(250);
    expect(results.filter(r => r[0]?.allowed === false)).toHaveLength(10);
    expect(Number((await sql`SELECT count(*) AS count FROM active_connections`)[0]?.['count'])).toBe(250);
  }, 60000);
  it('handles concurrent requests from the same client without duplicate-key failures', async () => {
    await sql`DELETE FROM active_connections WHERE line_id=${line}::uuid`;
    const results = await Promise.all(Array.from({ length: 20 }, () => admit('same-device')));
    expect(results.every(r => r[0]?.allowed === true)).toBe(true);
    expect(Number((await sql`SELECT count(*) AS count FROM active_connections`)[0]?.['count'])).toBe(1);
  }, 60000);
});