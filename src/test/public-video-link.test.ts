import { describe, expect, it } from 'vitest';
import { pickUniqueVideoName, sanitizeVideoName, shortVideoName, shortVideoUrl, videoPublicUrl } from '@/lib/public-videos';
import { compactVideoName, displayVideoName, storageVideoName } from '@/lib/video-names';

describe('short public video links', () => {
  it('stores the requested Kurdish movie name with a safe reversible ASCII key', () => {
    const name = sanitizeVideoName('جومونگ 21');
    const key = storageVideoName(name);
    expect(key).toMatch(/^[a-zA-Z0-9._-]+\.mp4$/);
    expect(displayVideoName(key)).toBe('جومونگ-21.mp4');
    expect(shortVideoName(`owner/${key}`)).toBe('جومونگ-21.mp4');
    expect(new URL(videoPublicUrl(`owner/${key}`)).pathname).toBe(`/api/public/v/${compactVideoName(`owner/${key}`)}`);
  });
  it('strips the legacy uuid prefix from storage filenames', () => {
    expect(shortVideoName('uid/7537981d-2352-4e3d-aa99-1e96829cb26c_video_2026-11-01_05-43-18.mp4')).toBe('video_2026-11-01_05-43-18.mp4');
    expect(shortVideoName('uid/video-2026-11-01.mp4')).toBe('video-2026-11-01.mp4');
  });

  it('builds a short token-free link on our own origin', () => {
    expect(shortVideoUrl('https://super-reseller.lovable.app', 'uid/video-2026-11-01.mp4')).toBe(`https://super-reseller.lovable.app/api/public/v/${compactVideoName('uid/video-2026-11-01.mp4')}`);
  });
  it('never copies a private preview origin or a token', () => {
    const url = new URL(videoPublicUrl('uid/film.mp4'));
    expect(url.origin).toBe('https://super-reseller.lovable.app');
    expect(url.pathname).toBe(`/api/public/v/${compactVideoName('uid/film.mp4')}`);
    expect(url.search).toBe('');
  });

  it('sanitizes uploaded filenames into short safe names', () => {
    expect(sanitizeVideoName('My Video (final).MP4')).toBe('My-Video-final.mp4');
    expect(sanitizeVideoName('...mp4')).toBe('video.mp4');
  });

  it('keeps Kurdish public links compact without including the movie name or credentials', () => {
    expect(compactVideoName('owner/utf8-d8acd988d985d988d986daaf2d3231.mp4')).toMatch(/^v-[a-f0-9]{12}\.mp4$/);
    expect(compactVideoName('owner/film.mp4')).not.toBe(compactVideoName('other/film.mp4'));
    expect(compactVideoName('owner/film.mp4')).toBe(compactVideoName('owner/film.mp4'));
  });

  it('keeps short names unique per bucket', () => {
    expect(pickUniqueVideoName('clip.mp4', ['other.mp4'])).toBe('clip.mp4');
    expect(pickUniqueVideoName('clip.mp4', ['clip.mp4'])).toBe('clip-2.mp4');
    expect(pickUniqueVideoName('clip.mp4', ['clip.mp4', 'CLIP-2.mp4'])).toBe('clip-3.mp4');
  });
});
