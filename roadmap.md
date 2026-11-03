# Connection billing
## Image to Link
- [x] Added admin-only image conversion, public storage and protected history; existing panel roles and policies unchanged. Browser HEIC decoder added; random output names and one-year immutable caching verified.
- [x] Real admin upload/600px resize/tvg-logo copy/reload/search/delete and anonymous WebP 200 verified; 360px layout checked. Permission and redirect tests pass; all 232 prior/new tests plus two additional access tests pass. Not published. HEIC and AVIF depend on browser/decoder support; real iPhone input not available for verification.
## Manual uploaded-playlist entries
- [x] Added admin-only manual Live TV, Movie and Series creation with details or original M3U entry text; preserves existing uploaded attributes, saved order and document format. GitHub source and billing unchanged.
- [x] Real admin import/add/reload/export verified for all three types; original CRLF/header/entry and pasted TMDB/custom attributes/directives preserved. Temporary playlists deleted, no page errors; all 219 tests pass and build OK. Not published.
## Automatic MP4 startup and existing links
- [x] All twelve stored MP4 aliases returned anonymous 206 and decoded two seconds of H.264/AAC. Repaired supplied v-fe4433d8ca83.mp4 in place: index moved from byte 2217045670 to byte 32; every stream hash unchanged. Exact published link returned matching new bytes; 72 frames/three seconds decoded in 0.91 seconds. No link changes or deployment needed for this file repair; other late-index files work but are not claimed equally fast.
- [x] Future uploads prepare lossless bounded-memory faststart before TUS, with cancellation and safe rejection of unsupported layouts. Real admin upload saved/reloaded and copied short token-free link; anonymous playback and video/audio hashes passed. Existing paths/links untouched.
- [x] All 213 tests pass and build OK. Real admin upload/reload/copy, unchanged media hashes, anonymous decoded playback and cleanup verified. Future-upload change awaits publication; user's VLC/device startup and continuous availability cannot be guaranteed.
## Reported Collision Course MP4 link
- [x] Repaired v-0bfb9f91d8d3.mp4 in place through owner-authenticated TUS storage replacement: moved its playback index from byte 1107291989 to byte 32 without transcoding. Audio/video SHA256 hashes identical; published anonymous range 206 matched new bytes; five seconds of H.264/AAC decoded through the exact short link in a 1.06-second check. Fourteen targeted tests pass; no app deployment needed. User's own player remains untested.
## Intermittent provider availability
- [x] Concurrent reseller requests immediately get the last-good catalog during refresh; the owning request completes the refresh without detached background work. Forced/cold reads wait; synchronous cold failures no longer poison later reads. Four availability tests and all 205 tests pass; 15 authenticated preview calls returned 200, anonymous catalog denied; build OK. Not published.
- [x] Account/settings/source reads retry transient failures once with bounded deadlines. Provider outages return 503 + Retry-After rather than false Disabled/auth:0; connection failures never fabricate zero devices. Expiry, connection enforcement and billing unchanged.
- [x] Nine outage/security regressions and all 201 tests pass. Supplied customer's published and preview auth Active plus live/movie/series reads returned 200; 15 concurrent preview requests passed (maximum 0.98s). Not published.
- [ ] Confirm intermittent loss/continuity in the customer's actual IPTV player after publication; blocked by target-player access and publication approval. No permanent availability guarantee.
## Provider movie and series metadata
- [x] Added source-derived TMDB and declared metadata to movie/series lists/details and missing get_vod_info; original names/posters, authenticated playback, accounts and billing unchanged. No enrichment requests added; five-second coalesced refresh retained.
- [x] Public GitHub sample: 10,503 entries, 19 movies/188 episodes, all 207 TMDB IDs/posters parsed; zero declared audio/subtitle languages. All 192 tests pass, including credential denial, five-second updates/outage fallback, HLS audio/subtitle authorization and DASH descriptor preservation; build OK. Not published.
- [ ] Verify real customer provider UI, decoded audio/subtitles and target-player startup; blocked by unavailable signed-in session (automatic account mint found no requesting-user account) and target-player access. Ask user to sign in for end-to-end verification; no universal playback claim.
## Admin public MP4 uploads
- [x] Existing short/legacy movie links now use a release-pinned public path, bypassing all cache/database I/O on cold instances. Fourteen tests pass; preview GET/HEAD 302, anonymous range 206 with identical 1 MB bytes and moov at byte 32, unknown 404; build OK. Not published; target-player startup remains unmeasured.
- [x] Moved the existing movie's 5 MB index from the end to byte 32 without transcoding; audio/video hashes unchanged. Compact aliases copied through the real admin page, 182 tests passed; published short and legacy links returned anonymous 206, HEAD succeeded, five seconds of audio/video decoded. VLC device speed remains unmeasured.
- [x] Fixed Kurdish movie-name saving with reversible ASCII storage keys; real admin rename to جومونگ 21 persisted after reload, anonymous playback returned 206 video/mp4, fixture removed, eleven tests passed. Existing user video untouched.
- [x] Selected filename, editable movie name and TUS progress verified with real admin upload; rename persisted after reload, clipboard uses published host, anonymous redirect returned 206 video/mp4 (1024 bytes); temporary video deleted, no page errors, ten targeted tests passed.
- [x] Public short-link availability verified after requested publication; copied links use the published origin and return anonymous MP4 bytes.
- [x] Replace the YouTube management screen and navigation with admin-only MP4 uploads and an honest unavailable state; existing customer content retained.
- [x] Enable public storage, admin upload, progress and copy-public-link controls.
- [x] Verify real admin small/TUS upload, reload, clipboard and delete; anonymous MP4 range returned 206/1024 bytes without credentials. Five database-backed policy tests enforce admin writes and reseller/anonymous denial; all 170 tests passed, build OK. Not published; VLC decoding not tested.
- [x] Short token-free links: /api/public/v/<name>.mp4 302-redirects via public_video_path RPC; uploads stored under short sanitized unique names. Verified: short link 302 → 206 video/mp4 range playback, unknown name 404, all 174 tests pass, build OK. Not published.
## Mobile panel usability
- [x] Improve dashboard, reseller accounts, lines and credit history with stacked records, touch controls and quick navigation; permissions and billing unchanged.
- [x] Verify signed-in mobile pages at 390px and 320px without overflow, line search, edit dialog/cancel and navigation; desktop table visible, no browser errors.
## Customer test account and delivery links
- [x] Created requested free 24-hour customer test; saved/reloaded and published M3U HTTP 200, provider auth=1, combined HTTP 200 with 17 Setayesh episodes verified.
- [x] Default copies use published host; separate M3U, Host and M3U + YouTube buttons verified from clipboard. Eleven targeted tests pass; build OK. Button changes await publication.
## Provider-wide Setayesh episode
- [x] Share only published YouTube S01E17 with all already-authorised GitHub customer lines; preserve private content and raw playlists. Existing policies remain byte-equivalent by hash.
- [x] All 8 active lines returned HTTP 200 and exactly 16 unchanged M3U + S01E17 in preview; official descriptor/poster verified, other provider detail 404; all 162 tests passed.
- [x] Approved publication verified on super-reseller.lovable.app: customer catalogue and S01E17 detail HTTP 200, one Setayesh series with episodes 1–17 (16 M3U + 1 YouTube), official embed, five-second hint; other provider detail 404.
## Connection-function access
- [x] Restrict both connection RPCs to signed-in line owners; 11 database-backed access tests and all 157 regressions passed. Real non-owner/anonymous calls denied; trusted customer playback returned 200 with 330623 bytes; policy hash unchanged. Not published.
## Combined provider series catalogue
- [x] Audit and minimally merge authorised GitHub M3U and owned YouTube series by provider/TMDB, preserving playback URLs and episode variants.
- [x] Display combined provider episodes and verify real customer HTTP 200: one Setayesh series, 16 M3U + YouTube S01E17; other reseller receives no private YouTube; 146 tests passed. HLS manifest/resource returned 200/447816 bytes; decoded M3U attempt did not start in 15 seconds and is reported separately.
## Direct provider YouTube episodes
- [x] Add structured provider form, atomic owner/provider/TMDB association, database-generated names and language/poster display without altering M3U delivery.
- [x] Verify exact Setayesh S01E17 save/reload, supplied poster, real customer API HTTP 200 and official embedded decoded playback at 16.06 seconds; 141 tests passed; dashboard versus Android report delivered.
- [ ] Execute new transactional database-role permission test; blocked because sandbox connection cannot assume authenticated role (existing API auth/ownership regressions passed).
- Native Android changes are outside the clarified provider/backend scope.
## YouTube episode integration
- [x] Audit existing series APIs, ownership and Android integration boundary; no native Android source found.
- [x] Add database-backed, owner-scoped series/seasons/YouTube episodes and management page, without changing existing IPTV playback or billing.
- [x] Add validated YouTube URLs, permitted metadata, private poster uploads and official embedded playback; decoded Google Developers sample reached 12.98 seconds at 854×480 in browser.
- [x] Expose customer-line-scoped series/season/episode/source APIs with publication filtering, revisions and five-second refresh contract; provide exact Android integration requirements.
- [x] Verify real admin/reseller save/edit/reload, private poster, customer API, draft filtering, duplicate/ownership checks and existing media regressions; remove temporary fixtures and report limitations.
- Native Android changes are outside the clarified provider/backend scope; no on-device claims.
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