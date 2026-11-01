import { describe, expect, it } from 'vitest';
import { episodeCode, episodeSchema, youtubeId, youtubePlayerError } from '@/lib/youtube';

describe('YouTube source validation', () => {
  it.each(['https://youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=10', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/embed/dQw4w9WgXcQ', 'https://youtube.com/live/dQw4w9WgXcQ'])('extracts the video ID from %s', url => expect(youtubeId(url)).toBe('dQw4w9WgXcQ'));
  it.each(['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://evil.test/embed/dQw4w9WgXcQ', 'http://youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short', 'https://youtube.com/playlist?list=test', 'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com:444/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=dQw4w9WgXcQ&v=aaaaaaaaaaa'])('rejects unsupported URL %s', url => expect(youtubeId(url)).toBeNull());
  it('automatically generates S01E21 and S01E22', () => {
    expect(episodeCode(1, 21)).toBe('S01E21');
    expect(episodeCode(1, 22)).toBe('S01E22');
  });
  it('rejects episode number zero', () => {
    expect(episodeSchema.safeParse({ season_id: '00000000-0000-4000-8000-000000000001', episode_number: 0, title: 'Episode', original_url: 'https://youtu.be/dQw4w9WgXcQ', poster_url: '', description: '', release_date: '', published: true }).success).toBe(false);
  });
  it('handles embedding-disabled videos', () => {
    expect(youtubePlayerError(101)).toBe('The owner does not permit embedded playback.');
    expect(youtubePlayerError(150)).toBe('The owner does not permit embedded playback.');
  });
  it('handles unavailable videos', () => expect(youtubePlayerError(100)).toBe('This video is private, deleted or unavailable.'));
});