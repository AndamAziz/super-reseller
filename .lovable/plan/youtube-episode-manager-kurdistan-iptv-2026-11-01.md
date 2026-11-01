# YouTube Episode Manager — KURDISTAN IPTV

## Audit findings
- The platform has authenticated admin/reseller dashboards, customer-line authentication, imported M3U channels and a shared GitHub catalog.
- Existing series and episodes are derived from GitHub M3U entries; there are no persisted series, season or episode tables. The provider currently returns numeric series IDs and direct-media playback URLs.
- No Android source, Android manifest or Android build configuration is present in this repository. Native YouTube playback and automatic device updates require a separate Android integration; dashboard/backend work alone cannot complete that objective.

## What to build
1. Add a **YouTube Episode Manager** accessible from the dashboard and navigation. Resellers manage their own content; admins can manage all content.
2. Persist series, seasons and episodes in Lovable Cloud. Support existing managed series, creating series/seasons, editing details, replacing URLs/posters, confirming deletion, published/unpublished status and chronological ordering.
3. Generate codes such as **S01E21** from numeric fields. Enforce unique episode numbers within each season and series.
4. Validate supported YouTube watch, short, embed and live URLs; store the original URL and video ID. Retrieve permitted public title/thumbnail metadata with manual fallback. Support poster selection/upload and series-poster fallback.
5. Provide official YouTube embedded preview and clear unavailable-video states. Never extract streams, convert YouTube content or send its URLs through the direct-media player.
6. Add customer-line-authenticated series, details, seasons, episodes and playback-source APIs. Return explicit source types and a content revision for five-second refresh while visible. Published content is scoped to the customer's reseller; drafts remain readable only to their owner/admin.
7. Preserve all existing IPTV/M3U/provider playback and billing. Existing GitHub series remain available; linking managed episodes to an existing GitHub series uses a stable title/category identity rather than its reorder-sensitive numeric ID. Do not place YouTube URLs in ordinary direct-media playlists.

## Android handoff
- Deliver exact endpoint contracts and Android implementation requirements: merge existing provider content with managed episodes; branch on `source_type`; use the official embedded YouTube player rather than Media3 for YouTube; refresh catalog revisions without restart; show title/poster/code and handle official player restrictions.
- Provide the integration guide and honest completion report. Native Android source or its developer's implementation is required before in-app playback and automatic episode display can be claimed complete.

## Technical details
- Use additive `content_series`, `content_seasons` and `content_episodes` tables because existing `channels` represent imported M3U documents, not owned relational episode records.
- Apply explicit grants, owner/admin RLS, immutable ownership, parent ownership consistency and database uniqueness. Keep roles in the existing role table. Use authenticated server functions for management and the existing customer-line validation for external read-only APIs.
- Metadata fetches use a fixed official YouTube oEmbed endpoint with bounded timeout, not arbitrary user-supplied fetch targets. Poster storage accepts bounded image uploads with owner-scoped storage policies.
- New content reads return only safe published fields; no reseller identity, credentials or secrets in API payloads. Use no-store responses and query invalidation after edits.
- Keep GitHub playback/catalog handlers unchanged except narrowly scoped source identity helpers if necessary; new YouTube source delivery is separate from media proxying.

## Verification and report
- Test URL extraction/rejection, episode-code generation, ordering, duplicate rejection, owner isolation, draft visibility and poster fallback.
- Exercise a real reseller workflow: create/select series, save S01E21 and S01E22, reload, edit, read through customer API and remove temporary fixtures.
- Test official player error handling and report actual playback separately from HTTP/API success; do not claim target Android results from a browser preview.
- Run existing media/provider regressions and the full automated suite. Do not publish without your approval.

## Completion boundary
The dashboard, storage and APIs can be implemented here. Native Android integration and on-device verification remain pending until its source or an implementation from its developer is available.