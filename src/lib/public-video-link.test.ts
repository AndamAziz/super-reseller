import { describe, expect, it } from 'vitest';
import { handlePublicVideoLink, redirectFor } from './public-video-link.server';

describe('short public video link', () => {
  it('redirects to the token-free public object URL', () => {
    const res = redirectFor('https://x.example', 'abc/v 1.mp4');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://x.example/storage/v1/object/public/public-videos/abc/v%201.mp4');
    expect(res.headers.get('Location')).not.toMatch(/token=/);
  });
  it('rejects names that are not mp4', async () => {
    expect((await handlePublicVideoLink('evil.exe')).status).toBe(404);
  });
});
