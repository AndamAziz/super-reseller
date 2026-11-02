// Release-pinned PUBLIC object paths only. No credentials or private media.
// Existing published movie links can redirect on a cold instance without I/O.
// Keep paths stable; the storage service remains authoritative for availability.
const moviePath = '2bce34f8-9310-4b4a-a6b4-b7a481fe0d05/utf8-d8acd988d985d988d986daaf2d3231.mp4';
const publishedMovies: Readonly<Record<string, string>> = Object.freeze({
  'v-1d5b89a07c2d.mp4': moviePath,
  'utf8-d8acd988d985d988d986daaf2d3231.mp4': moviePath,
});

export function publishedMoviePath(short: string): string | undefined {
  return Object.hasOwn(publishedMovies, short) ? publishedMovies[short] : undefined;
}