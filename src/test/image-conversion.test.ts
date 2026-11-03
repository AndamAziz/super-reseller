import { expect, it } from 'vitest';
import { DEFAULT_IMAGE_FORMAT, DEFAULT_MAX_WIDTH, imageQuality, IMAGE_QUALITY, MAX_IMAGE_BYTES, resizedDimensions, validateImage, imageMime } from '@/lib/image-conversion';
import { IMAGE_PAGE_SIZE } from '@/lib/image-links';
it('accepts 15 MB and rejects an input over 15 MB', () => {
  expect(() => validateImage({ name: 'photo.heic', type: '', size: 15 * 1024 * 1024 })).not.toThrow();
  expect(() => validateImage({ name: 'photo.png', type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toThrow('15 MB');
});
it('uses WebP quality 85 percent', () => { expect(IMAGE_QUALITY).toBe(0.85); expect(imageQuality('webp')).toBe(0.85); });
it('defaults to JPG at quality 90 and 600px', () => { expect(DEFAULT_IMAGE_FORMAT).toBe('jpg'); expect(imageQuality('jpg')).toBe(0.9); expect(DEFAULT_MAX_WIDTH).toBe(600); });
it('preserves aspect ratio at the 400px preset', () => { expect(resizedDimensions(800, 800, 400)).toEqual({ width: 400, height: 400 }); });
it('preserves aspect ratio at the 1000px preset', () => { expect(resizedDimensions(2000, 3000, 1000)).toEqual({ width: 1000, height: 1500 }); });
it('preserves aspect ratio at the 600px preset', () => { expect(resizedDimensions(1200, 800, 600)).toEqual({ width: 600, height: 400 }); });
it('keeps original size without upscaling and supports custom width', () => {
  expect(resizedDimensions(300, 200, 600)).toEqual({ width: 300, height: 200 });
  expect(resizedDimensions(1200, 800, 450)).toEqual({ width: 450, height: 300 });
  expect(resizedDimensions(1200, 800, null)).toEqual({ width: 1200, height: 800 });
});
it('returns correct output image MIME types', () => { expect(['webp','png','jpg'].map(f => imageMime(f as 'webp'|'png'|'jpg'))).toEqual(['image/webp','image/png','image/jpeg']); });
it('paginates 20 images at a time', () => { expect(IMAGE_PAGE_SIZE).toBe(20); });