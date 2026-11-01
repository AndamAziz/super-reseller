import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { YoutubePlayer } from '@/components/youtube-player';

afterEach(() => { cleanup(); vi.useRealTimers(); delete (window as Window & { YT?: unknown }).YT; });
it('handles the official embedding-disabled error event', async () => {
  vi.useFakeTimers();
  let callback: ((event: { data: number }) => void) | undefined;
  class Player {
    constructor(_frame: HTMLIFrameElement, options: { events: { onError: (event: { data: number }) => void } }) { callback = options.events.onError; }
    destroy() {}
  }
  (window as Window & { YT?: unknown }).YT = { Player };
  render(<YoutubePlayer videoId="M7lc1UVf-VE" title="Fixture" />);
  await act(async () => { vi.advanceTimersByTime(200); });
  expect(callback).toBeTypeOf('function');
  act(() => callback?.({ data: 150 }));
  expect(screen.getByRole('alert').textContent).toBe('The owner does not permit embedded playback.');
});