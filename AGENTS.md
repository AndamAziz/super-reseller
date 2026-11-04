<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Credit deduction and line expiry run only in database functions; update_line locks the line, bill_connection_increase triggers atomic balance deductions for all reseller connection increases (including legacy service-role updates without a user identity), and renew_line charges every configured connection. Authenticated admin changes remain exempt; update_line must not also deduct the trigger's charge.
- Connection upgrade previews mirror database UTC calendar-month arithmetic, rounding remaining partial months up; the database returns the actual charge and remains authoritative.
- Reseller accounts are created/deleted by admin-only server functions; public sign-up is disabled.
- Low-credit alerts use the authenticated AppShell balance and one tested threshold helper on every reseller page; no duplicate notification state.
- Admin balances use shared reseller queries (30s) and low-credit warnings.
- Stream proxy targets are authorized by an HMAC signature (scope user:stream) added when our rewriter emits each URI, so any host in a channel's playlist chain is allowed without a host allowlist; private hosts stay blocked on every redirect hop.
- Generated media URLs use authenticated /api/public playback handlers and preserve source extensions, so audio/video files avoid HLS misidentification and the site access wall; catalog classification still follows tvg-type only.
- Format mirroring is decided from detected origin bytes in shared playback code, never per provider: .ts entry links answered by a manifest 302 to the .m3u8/.mpd app link, manifest/extensionless links answered by raw TS 302 to the .ts link, proxied URIs keep origin extensions, and every entry path (including legacy /live) uses handleMediaPlayback.
- Public IP-literal origins are 302'd to the exact origin URL because the hosting rejects server-side fetches to bare IPs; private hosts stay blocked and the stream limit is checked before the hand-off.
- Provider reads use durable last-good snapshots; authenticated minute warm checks refresh GitHub conditionally every five minutes; admin refresh is role-checked. Client reads never fetch GitHub.
- The default Playlists view reads the shared GitHub catalog through a role-checked server function and polls every five seconds while visible; the catalog retains original cross-type source order so automatic category updates do not depend on manually imported snapshots.
- Uploaded channel URL/logo edits use column-scoped authenticated grants and admin-only RLS, then invalidate the imported channel query; exports use persisted edits while the GitHub playback source remains separate.
- Uploaded M3U retains raw entries/header/newlines; exports change only edited fields; classify by pre-name tvg-type. Legacy metadata requires reimport. Manual additions use admin-only INSERT and the shared parser, append saved positions and refresh counts; GitHub stays separate.
- Uploaded channel ordering uses an admin-checked atomic database RPC to swap saved positions with the previous/next visible channel; reads sort by position and ID so exports and reloads preserve the same order without granting direct position writes.
- Generated direct-source links carry a channel identity derived from name and group, propagated through signed HLS links, so catalog reordering and source URL rotation keep the selected channel; legacy numeric-only links retain their behavior.
- Upstream timeouts apply only until response headers arrive, with one retry for network errors or 502/503/504, so long MP3/MP4 bodies are not aborted by the header deadline.
- Routing tests use the real tree. Images convert browser-side with lazy HEIC decoding; image route checks roles and storage/history enforce admin writes.
- Admin stream tests probe the selected URL with its own Referer and User-Agent independently of GitHub; success requires media bytes after signed playlist traversal, with one recheck for transient failures, and diagnostic origin codes do not change playback response semantics.
- Playback protocol detection uses bounded signature inspection with byte replay; DASH resources use scoped exact-URL or constrained signed-template authorization, never a browser-accessible arbitrary signing endpoint.
- Admin playback-check dynamically loads engines and separates HTTP, frame, audio and continuity evidence; records unchanged.
- Browser TS playback uses mpegts.js transmuxing, while TS URLs detected as HLS use the HLS engine; live detection probes avoid Range requests rejected by origins.
- Shared signature inspection collects fragmented network chunks and replays all bytes; verified TS signatures override misleading upstream MIME types on provider responses.
- Catalog hashes cover all bytes; cold reads use stored snapshots; instances recheck each minute.
- YouTube creation is atomic and owner/provider/TMDB-keyed; the line-scoped API and provider view merge GitHub series by TMDB (explicit source identity fallback), preserve episode alternatives and legacy playback URLs, and keep M3U delivery unchanged.
- Uploaded episode posters live in a private owner-scoped bucket; store canonical locators and resolve short-lived signed display URLs so public-bucket restrictions do not expose drafts.
- YouTube uses official embeds; Android branches by source_type. APIs add only admin-shared published GitHub episodes; CRUD stays owner-scoped.
- Connection RPCs enforce ownership and saved limits; service-role playback follows line auth; policies unchanged.
- Customer links share a host builder; M3U and combined feeds stay distinct.
- MP4: lossless bounded-index Blob faststart before TUS; reject unsafe layouts. ASCII names, storage API only; preserve aliases. Pinned paths bypass cold I/O; others use lookup.
- Metadata is source-derived; no per-row enrichment or invented tracks. VOD stays authenticated.
- Provider reads retry once; outages never fake credentials/devices. Private ETags follow auth; 24h diagnostics store only type/duration/status/timeout.
- Minute cron pings /api/public/warm; short first login deadline beats app cold-start timeouts.
- Stream limits count one device per line + client IP (not user-agent), because one device's app and player engine send different user-agents.
