/** Request-driven refresh, with a last-good value and coalesced concurrent reads. */
export const PLAYLIST_REFRESH_MS = 5_000;
export const PLAYLIST_RETRY_MS = 5_000;
export function createPlaylistCache<T>(load: () => Promise<T>, now = Date.now) {
  let value: T | undefined;
  let nextCheck = 0;
  let pending: Promise<T> | undefined;
  return async (force = false): Promise<T> => {
    if (!force && value !== undefined && now() < nextCheck) return value;
    if (pending) return pending;
    pending = (async () => {
      try {
        value = await load();
        nextCheck = now() + PLAYLIST_REFRESH_MS;
        return value;
      } catch (error) {
        nextCheck = now() + PLAYLIST_RETRY_MS;
        if (value !== undefined) return value;
        throw error;
      } finally {
        pending = undefined;
      }
    })();
    return pending;
  };
}