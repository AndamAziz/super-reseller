# Connection billing
## Direct provider YouTube episodes
- [ ] Add structured provider form, TMDB-based series association, automatic names and language/poster display without altering M3U delivery.
- [ ] Verify Setayesh S01E17 persistence, customer content delivery, permissions and stream regressions; deliver dashboard versus Android report.
- [ ] Integrate actual Android display/playback; blocked by absent native Android source and device access.
## YouTube episode integration
- [x] Audit existing series APIs, ownership and Android integration boundary; no native Android source found.
- [x] Add database-backed, owner-scoped series/seasons/YouTube episodes and management page, without changing existing IPTV playback or billing.
- [x] Add validated YouTube URLs, permitted metadata, private poster uploads and official embedded playback; decoded Google Developers sample reached 12.98 seconds at 854×480 in browser.
- [x] Expose customer-line-scoped series/season/episode/source APIs with publication filtering, revisions and five-second refresh contract; provide exact Android integration requirements.
- [x] Verify real admin/reseller save/edit/reload, private poster, customer API, draft filtering, duplicate/ownership checks and existing media regressions; remove temporary fixtures and report limitations.
- [ ] Integrate and build native Android client, then verify automatic series display and YouTube playback on-device; blocked by absent Android source/device access.
## Phase 3B provider-specific diagnosis
- [x] Trace existing Provider API and M3U paths: both use the same source/catalog/playback handlers; AVA Media, RUDAW TV and Kurdsat TV emit identical URLs and reach signed TS media bytes. No separate configured upstream provider found in application code.
- [ ] Reproduce the reported provider-only failure and fix only verified defects; blocked by missing customer player name/configuration and failing channel identification (clarification skipped). No playback changes made for Phase 3B.
- [ ] Verify decoded video/audio, 60-second continuity, supported seeking, interruption recovery and all-format decoded regressions; controlled AVA Media attempt did not start within 30 seconds. Target-player access required; publishing awaits results approval.
## Global .ts support (all providers)
- [x] Audit full pipeline; route legacy /live through the shared handler; mirror raw TS behind .m3u8/extensionless links to .ts; hand public IP-address origins (hosting returns 403 to server fetches) to the player directly. No provider-specific code.
- [x] Multi-provider end-to-end tests (13 new, 111 total pass); real check: all 3 .ts servers in the GitHub playlist deliver TS through provider links in the preview.
- [ ] Publish and confirm on the user's phone; awaits user approval.
## Provider TS playback follow-up
- [x] Fix .ts provider links that are HLS upstream: entry link now redirects to the .m3u8 app link (like the source does) and segment links keep .ts; verified AVA Media through the provider: 302 → playlist → video/mp2t segment. 97 tests pass. Not yet published; on-phone playback awaits user check.
- [x] Fix fragmented protocol inspection and misleading TS response types on the shared provider playback path; all 94 tests pass and build OK.
- [x] Verify authenticated provider catalog (79 TS channels) and signed media chain: AVA Media, RUDAW TV and Kurdsat TV return HLS then TS media bytes with HTTP 200. Decoded target-device playback remains unverified; changes are not published.
## Phase 2 real playback
- [x] Add TS transmuxing and detect HLS behind .TS; remove Range prerequisite rejected by some origins. Regression tests pass; real H.264/AAC decoding is blocked by the sandbox browser's absent codecs.
- [x] Add bounded protocol detection and verify decoded playback separately from HTTP connectivity.
- [x] Implement scoped signed DASH delivery; controlled VP9/Opus DASH decodes through actual proxy with seeking and 258 frames in ten seconds. Current panel navigation/layout unchanged.
- [x] Check browser codecs, seeking and bounded continuity; report absent H.264/AAC support, unmeasured sync and track-switch limitations honestly.
- [x] Retain five-second polling, replacement-based source queries and identity-safe removal/rotation regressions; add full-content version hashes. All 88 tests pass; customer records and assignments untouched.
- [x] Report measured sample outcomes and RTMP conversion infeasibility on current hosting; no paid service added.
- [ ] Verify user's H.264/AAC TS/HLS/MP4 on their target player; blocked by codecs absent from test Chromium and intermittent source timeouts.
- [ ] Complete independent A/V sync, subtitle rendering and audio/automatic bitrate switching evidence on target devices; requires suitable device/player and controlled track fixtures. Do not claim these are verified.
## Stream test accuracy
- [x] Use selected channel headers independently of GitHub, require actual media bytes and recheck transient failures once; supplied AVA Media link verified in authenticated Playlists with playlist/first segment 200, all 75 tests pass and build OK. Playback and billing unchanged.
## Playback engine audit
- [x] Audit parser, proxy, playback routes and reseller module against the compatibility checklist; add 22 playback-compatibility tests (master/media playlist rewriting, TS/MKV/AAC/WebM streaming, audio-only HLS, origin 403/404/500 mapping, redirect-to-private blocking, public redirect following, content-type mapping). All 69 tests pass, typecheck clean; no code fixes were required.
## Uploaded playlist format
- [x] Harden raw attribute and directive preservation, type-only counts and edit-only export; authenticated 14-movie/92-episode/3-live upload persisted correct counts after reload and exported byte-identically, edits changed only requested fields, test uploads removed; all 47 tests passed and build OK.
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