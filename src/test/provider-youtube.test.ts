import { describe, expect, it } from 'vitest';
import { providerEpisodeSchema, structuredEpisodeTitle, youtubeId } from '@/lib/youtube';

const example = { owner_id: '00000000-0000-4000-8000-000000000001', provider_key: 'github', english_name: 'Setayesh', original_name: 'ستایش', tmdb_id: 94146, season_number: 1, episode_number: 17, language_label: 'KURDISH-دۆبلاژ', original_url: 'https://www.youtube.com/watch?v=3leqKX7BsFw', poster_url: 'https://media.themoviedb.org/t/p/w600_and_h900_face/6e7Wkc5jckzksjKta4TELHCufs.jpg' };
describe('structured provider episodes', () => {
  it('preserves supplied Setayesh metadata', () => expect(providerEpisodeSchema.parse(example)).toEqual(example));
  it('generates the requested exact episode identity', () => expect(structuredEpisodeTitle('Setayesh', 'ستایش', 94146, 1, 17)).toBe('Setayesh _ ستایش {tmdb-94146} - S01E17'));
  it('generates future season codes without manual entry', () => expect(structuredEpisodeTitle('Other', 'Original', 123, 2, 1)).toBe('Other _ Original {tmdb-123} - S02E01'));
  it('uses only the official YouTube identity', () => expect(youtubeId(example.original_url)).toBe('3leqKX7BsFw'));
  it('requires a provider identity', () => expect(providerEpisodeSchema.safeParse({ ...example, provider_key: 'other' }).success).toBe(false));
});