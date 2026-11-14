# MAG startup
- Keep the native MAG screen an isolated ES5 HTML/XHR bootstrap with resolved semantic CSS tokens, because MAG250 WebKit cannot run the panel's modern React frontend; use the existing authenticated catalog and playback handlers unchanged.
## Admin movie library
- Keep TMDB credentials and metadata calls server-only and role-checked; store the curated library separately and use VidAPI's documented iframe URLs so GitHub and native IPTV delivery remain unchanged.
- Admin-supplied direct library sources play as native MP4/HLS with VidAPI fallback; explicit GitHub publication appends uniquely identified entries with SHA conflict protection and never rewrites existing entries or Live TV.
## Connection limits
- Share positive PostgreSQL-integer validation between subscriber edit functions to prevent conflicting caps; retain the default of one and database-only billing.
- Both connection RPC overloads use the same per-line transaction advisory lock and line-scoped cleanup, preventing concurrent over-admission and duplicate device inserts.- Count one connection per line + viewer IP (CF-Connecting-IP only, never client headers; IPv6 grouped by /64, IPv4 exact for CGNAT) with a 45s idle window, so playlist/segment requests and channel switches share one slot.
