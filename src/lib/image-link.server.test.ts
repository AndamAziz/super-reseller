import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleImageLink } from './image-link.server';

afterEach(() => { vi.unstubAllEnvs(); });

describe('short public image link', () => {
  it('redirects to the token-free public storage object', () => {
    vi.stubEnv('SUPABASE_URL', 'https://images.example');
    const res = handleImageLink('966168c6cdfdca7f.jpg');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://images.example/storage/v1/object/public/channel-images/966168c6cdfdca7f.jpg');
  });
  it('rejects names that are not uploaded image ids', () => {
    expect(handleImageLink('evil.exe').status).toBe(404);
    expect(handleImageLink('..%2Fetc%2Fpasswd').status).toBe(404);
  });
});
