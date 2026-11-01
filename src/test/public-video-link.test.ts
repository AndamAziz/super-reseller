import { describe, expect, it } from 'vitest';
import { pickUniqueVideoName, sanitizeVideoName, shortVideoName, shortVideoUrl } from '@/lib/public-videos';

describe('short public video links', () => {
  it('strips the legacy uuid prefix from storage filenames', () => {
    expect(shortVideoName('uid/7537981d-2352-4e3d-aa99-1e96829cb26c_video_2026-11-01_05-43-18.mp4')).toBe('video_2026-11-01_05-43-18.mp4');
    expect(shortVideoName('uid/video-2026-11-01.mp4')).toBe('video-2026-11-01.mp4');
  });

  it('builds a short token-free link on our own origin', () => {
    expect(shortVideoUrl('https://super-reseller.lovable.app', 'uid/video-2026-11-01.mp4')).toBe('https://super-reseller.lovable.app/api/public/v/video-2026-11-01.mp4');
  });

  it('sanitizes uploaded filenames into short safe names', () => {
    expect(sanitizeVideoName('My Video (final).MP4')).toBe('My-Video-final.mp4');
    expect(sanitizeVideoName('...mp4')).toBe('video.mp4');
  });

  it('keeps short names unique per bucket', () => {
    expect(pickUniqueVideoName('clip.mp4', ['other.mp4'])).toBe('clip.mp4');
    expect(pickUniqueVideoName('clip.mp4', ['clip.mp4'])).toBe('clip-2.mp4');
    expect(pickUniqueVideoName('clip.mp4', ['clip.mp4', 'CLIP-2.mp4'])).toBe('clip-3.mp4');
  });
});
