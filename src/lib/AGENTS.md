# MAG startup
- Keep the native MAG screen an isolated ES5 HTML/XHR bootstrap with resolved semantic CSS tokens, because MAG250 WebKit cannot run the panel's modern React frontend; use the existing authenticated catalog and playback handlers unchanged.
## Admin movie library
- Keep TMDB credentials and metadata calls server-only and role-checked; store the curated library separately and use VidAPI's documented iframe URLs so GitHub and native IPTV delivery remain unchanged.
## Connection limits
- Share positive PostgreSQL-integer validation between subscriber edit functions to prevent conflicting caps; retain the default of one and database-only billing.