import { expect, it } from 'vitest';
import { collectContentPages } from '@/lib/content-pagination';

it('reads beyond the database row cap without losing or appending duplicate episodes', async () => {
  const episodes = Array.from({ length: 1022 }, (_, i) => i + 1);
  const result = await collectContentPages(async (from, to) => ({ data: episodes.slice(from, to + 1), error: null }));
  expect(result).toEqual(episodes);
  expect(result[20]).toBe(21);
  expect(result[21]).toBe(22);
});