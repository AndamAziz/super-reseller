import { expect, it, vi } from 'vitest';
import { Route } from '@/routes/_authenticated/image-to-link';
import { requireImageAdmin } from '@/lib/image-links';
vi.mock('@/lib/image-links', () => ({ requireImageAdmin: vi.fn(), IMAGE_PAGE_SIZE: 20, listImageLinks: vi.fn(), deleteImageLink: vi.fn(), uploadImageLink: vi.fn() }));
it('redirects a non-admin away from image management before history loads', async () => {
  vi.mocked(requireImageAdmin).mockResolvedValue(false);
  const guard = Route.options.beforeLoad;
  if (!guard) throw new Error('Missing access guard');
  await expect(guard({} as Parameters<typeof guard>[0])).rejects.toMatchObject({ options: { to: '/dashboard' } });
});
it('allows an existing admin to open image management', async () => {
  vi.mocked(requireImageAdmin).mockResolvedValue(true);
  const guard = Route.options.beforeLoad;
  if (!guard) throw new Error('Missing access guard');
  await expect(guard({} as Parameters<typeof guard>[0])).resolves.toBeUndefined();
});