// Release-pinned PUBLIC object paths only. No credentials or private media.
// Existing published movie links can redirect on a cold instance without I/O.
// Keep paths stable; the storage service remains authoritative for availability.
const moviePath = '2bce34f8-9310-4b4a-a6b4-b7a481fe0d05/utf8-d8acd988d985d988d986daaf2d3231.mp4';
// Collision Course: the GitHub playlist line uses an earlier short link.
const collisionCoursePath = '2bce34f8-9310-4b4a-a6b4-b7a481fe0d05/Movies--Collision-Course-2026.mp4';
const publishedMovies: Readonly<Record<string, string>> = Object.freeze({
  'v-1d5b89a07c2d.mp4': moviePath,
  'utf8-d8acd988d985d988d986daaf2d3231.mp4': moviePath,
  'v-0bfb9f91d8d3.mp4': collisionCoursePath,
  'v-127d11c9b774.mp4': collisionCoursePath,
});

export function publishedMoviePath(short: string): string | undefined {
  return Object.hasOwn(publishedMovies, short) ? publishedMovies[short] : undefined;
}