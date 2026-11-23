# Fix stream 127 and HTML error responses

- Reproduce the published `/movie/.../127.m3u8` response and preserve the exact source URL and current account/catalog behavior.
- After authentication and connection-limit admission, redirect original `.txt` HLS entry sources directly with HTTP 302 before any server-side origin fetch, regardless of the player-requested extension and across Live, Movie, Series, and `/api/public` paths.
- Keep signed media proxying unchanged for working sources. When an HLS entry cannot be fetched, hand the original HLS URL to the player where possible; otherwise return a real upstream error.
- Never pass an HTTP 200 `text/html` error document through as media; retain verified media-signature handling for origins that mislabel real TS bytes as HTML.
- Add focused regression tests for all entry kinds/extensions, exact redirect targets, no origin fetch for `.txt`, admission/auth ordering, HTML error rejection, and existing MP4/M3U8/TS behavior.
- Run targeted and full tests, typecheck/build signals, and exercise stream 127 plus comparison streams through the running app. Do not publish or change accounts, playlists, billing, URLs, or connection-limit logic without separate approval.
