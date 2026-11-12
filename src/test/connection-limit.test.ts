import { expect, it } from 'vitest';
import { maxConnectionsSchema } from '../lib/connection-limit';

it('defaults to one connection', () => {
  expect(maxConnectionsSchema.parse(undefined)).toBe(1);
});
it('accepts manually chosen connection counts above 100', () => {
  expect(maxConnectionsSchema.parse(101)).toBe(101);
  expect(maxConnectionsSchema.parse(250)).toBe(250);
  expect(maxConnectionsSchema.parse(1000)).toBe(1000);
});
it('rejects nonpositive, fractional and unstorable connection counts', () => {
  for (const count of [0, -1, 1.5, Infinity, 2_147_483_648]) {
    expect(maxConnectionsSchema.safeParse(count).success).toBe(false);
  }
});