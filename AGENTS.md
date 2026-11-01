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
- Low-credit alerts derive from the authenticated balance in the shared AppShell and a single tested threshold helper, so every reseller page shows the same warning without storing duplicate notification state.
- The admin dashboard reads reseller balances from the shared reseller query, refreshed every 30 seconds, and reuses the low-credit helper per reseller to keep warning thresholds consistent.
- Stream proxy targets are authorized by an HMAC signature (scope user:stream) added when our rewriter emits each URI, so any host in a channel's playlist chain is allowed without a host allowlist; private hosts stay blocked on every redirect hop.
- Generated media URLs use authenticated /api/public playback handlers and preserve source extensions, so audio/video files avoid HLS misidentification and the site access wall; catalog classification still follows tvg-type only.
- Format mirroring is decided from detected origin bytes in shared playback code, never per provider: .ts entry links answered by a manifest 302 to the .m3u8/.mpd app link, manifest/extensionless links answered by raw TS 302 to the .ts link, proxied URIs keep origin extensions, and every entry path (including legacy /live) uses handleMediaPlayback.
- Public IP-literal origins are 302'd to the exact origin URL because the hosting rejects server-side fetches to bare IPs; private hosts stay blocked and the stream limit is checked before the hand-off.
- Catalog refresh and outage retries use a five-second request-driven coalesced last-good cache; each GitHub source fetch uses a fresh cache key, so minute-long edge cache keys do not delay additions and source outages do not discard a working playlist.
- The default Playlists view reads the shared GitHub catalog through a role-checked server function and polls every five seconds while visible; the catalog retains original cross-type source order so automatic category updates do not depend on manually imported snapshots.
- Uploaded channel URL/logo edits use column-scoped authenticated grants and admin-only RLS, then invalidate the imported channel query; exports use persisted edits while the GitHub playback source remains separate.
- Uploaded M3U imports persist media type, user agent, raw EXTINF/directives/URL/trailing lines and document header/line endings; exports replace only edited fields in place without rewriting other attributes, and media views classify by pre-name tvg-type only. Legacy imports require reimport to recover metadata discarded before these columns existed.
- Uploaded channel ordering uses an admin-checked atomic database RPC to swap saved positions with the previous/next visible channel; reads sort by position and ID so exports and reloads preserve the same order without granting direct position writes.
- Generated direct-source links carry a channel identity derived from name and group, propagated through signed HLS links, so catalog reordering and source URL rotation keep the selected channel; legacy numeric-only links retain their behavior.
- Upstream timeouts apply only until response headers arrive, with one retry for network errors or 502/503/504, so long MP3/MP4 bodies are not aborted by the header deadline.
- Routing tests load the real route tree with deterministic signed-out auth and omit only the document shell in the div-based test renderer, so redirects and not-found state are tested without invalid nested HTML or hosted auth calls.
- Admin stream tests probe the selected URL with its own Referer and User-Agent independently of GitHub; success requires media bytes after signed playlist traversal, with one recheck for transient failures, and diagnostic origin codes do not change playback response semantics.
- Playback protocol detection uses bounded signature inspection with byte replay; DASH resources use scoped exact-URL or constrained signed-template authorization, never a browser-accessible arbitrary signing endpoint.
- The isolated admin playback-check route dynamically loads browser engines and separates HTTP, frame, audio-signal and continuity evidence; ordinary panel layout and records remain unchanged.
- Browser TS playback uses mpegts.js transmuxing, while TS URLs detected as HLS use the HLS engine; live detection probes avoid Range requests rejected by origins.
- Shared signature inspection collects fragmented network chunks and replays all bytes; verified TS signatures override misleading upstream MIME types on provider responses.
- Shared catalogs carry a full-content revision hash; polling replaces source arrays and never appends updates or mutates reseller assignments.
- YouTube creation is atomic and owner/provider/TMDB-keyed; the line-scoped API and provider view merge GitHub series by TMDB (explicit source identity fallback), preserve episode alternatives and legacy playback URLs, and keep M3U delivery unchanged.
- Uploaded episode posters live in a private owner-scoped bucket; store canonical locators and resolve short-lived signed display URLs so public-bucket restrictions do not expose drafts.
- YouTube uses official embeds; Android branches by source_type. Customer APIs add only admin-shared published GitHub episodes; owner-scoped CRUD stays unchanged.
- Connection RPCs authorize signed-in line owners before any writes and use their saved device limits; trusted service-role playback remains allowed after line authentication, without broadening any table policy.
