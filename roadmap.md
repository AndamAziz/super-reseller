# Connection billing
## Uploaded playlist format
- [ ] Harden raw attribute and directive preservation, type-only counts and edit-only export; verify a 14-movie/92-episode admin upload/download diff.
- [x] Preserve media classification and original M3U metadata through import, edits and download; show separate Live TV, Movies and Series views. Legacy imports require reimport to recover discarded metadata.
- [x] Verified mixed-media upload, exact untouched download, persisted name/stream/logo edits, separate views and deletion/export using authenticated admin data; temporary fixture removed, all 44 tests passed and build OK.
## Uploaded channel ordering
- [x] Add up/down arrows for admins on uploaded channels, persist reordered positions atomically and export the saved order.
- [x] Verify authenticated mobile moves in both directions, reload and M3U download with a temporary fixture (removed afterwards); all 41 tests passed, build OK, transactional admin/reseller/anonymous permission checks passed.
## Channel-link permission verification
- [x] Run transactional admin/reseller/signed-out channel-link permission checks: admins saved both links, reseller edits changed zero rows, signed-out edits were blocked; no permission gaps found. Retain src/test/channel-links-permissions.sql; all 36 automated tests pass.
## Uploaded playlist editing
- [x] Let admins replace stream and logo URLs on individual uploaded channels, persist edits and include them in downloaded M3U files.
- [x] Verify authenticated upload, edit, reload, logo removal and download with real saved data; 36 tests pass and transactional permission checks confirm only admins can update links.
## Automatic GitHub categories
- [x] Show the live GitHub source in Playlists with automatic five-second updates and source category ordering for admins and resellers.
- [x] Test automatic reorder updates without remounting; all 33 tests pass, authenticated UI reads 10,409 channels and polls twice in 11.5 seconds without refresh.
## Admin credit overview
- [x] Show every reseller balance and the existing below-10 warning in the admin dashboard.
- [x] Verify authenticated dashboard balances against both real reseller records; all 26 tests pass, including low-credit boundary tests.

## Test suite
- [x] Fix the two page tests without changing application behavior.
- [x] Run the full test suite and confirm all 26 tests pass.

## Playlist playback
- [x] Reduce catalog freshness and outage retry delays to five seconds, remove minute-bucketed GitHub cache keys, and pass all 29 tests (live/movie/series additions, coalescing and last-good fallback).
- [x] Verify a real authenticated shared catalog read in the panel (10,409 channels); automatic additions and reorder timing tested with controlled source changes without modifying the user's GitHub playlist.
- [x] Keep generated identity-bearing links tied to their channel across source reordering and automatically updated URLs.
- [x] Retry temporary upstream failures; 14 tests passed and real MP3 played beyond 20 seconds without refresh in preview.
- [x] Support correct MP3/MP4/M3U8 links through authenticated public playback.
- [x] Refresh GitHub additions quickly with last-good playlist fallback.
- [x] Test formats and refresh; real Quran MP3 returned 206 audio/mpeg and admin test returned Media 200.

- [x] Show reseller low-balance warning below 10 credits and test the boundary.
- [x] Deduct AZHI's five previously unbilled connection credits and verify the balance and ledger.
- [x] Investigate and close legacy unbilled connection updates; verify six-device pricing.
- [x] Enforce connection increase and renewal credit deductions atomically in the database.
- [x] Show connection upgrade and renewal costs to resellers.
- [x] Test deductions, insufficient balance, and no browser bypass.