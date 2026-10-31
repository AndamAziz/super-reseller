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
- Stream proxy targets are authorized by an HMAC signature (scope user:stream) added when our rewriter emits each URI, so any host in a channel's playlist chain is allowed without a host allowlist; private hosts stay blocked on every redirect hop.
- Generated media URLs use authenticated /api/public playback handlers and preserve source extensions, so audio/video files avoid HLS misidentification and the site access wall; catalog classification still follows tvg-type only.
- Catalog refresh is request-driven through a coalesced last-good cache with short retries, so source outages do not discard a working playlist.
- Generated direct-source links carry a channel identity derived from name and group, propagated through signed HLS links, so catalog reordering and source URL rotation keep the selected channel; legacy numeric-only links retain their behavior.
- Upstream timeouts apply only until response headers arrive, with one retry for network errors or 502/503/504, so long MP3/MP4 bodies are not aborted by the header deadline.
- Routing tests load the real route tree with deterministic signed-out auth and omit only the document shell in the div-based test renderer, so redirects and not-found state are tested without invalid nested HTML or hosted auth calls.
