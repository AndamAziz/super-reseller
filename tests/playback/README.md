# Real browser playback checks

This opt-in harness is separate from the existing jsdom suite. The admin-only
`/playback-check` page has no navigation entry and leaves ordinary panel UI unchanged.

Generate deterministic fixtures with FFmpeg in `/tmp`, then run the isolated
localhost fixture service using Bun. It exercises the real `proxyFetch` and signed
DASH resolution code without changing GitHub, customer records or assignments.
The service is test-only and is not imported into the app.

The browser checks use the sandbox's installed Python Playwright. Restore the
managed session only on localhost, open `/playback-check`, and call
`window.kurdistanPlaybackCheck.check(url, expectsVideo, expectsAudio, durationMs)`.
Use an existing explicitly named authorized test line for the real handler flow;
never log credentials or credential-bearing URLs.

Record HTTP status separately from presented video frames, Web Audio RMS signal,
media clock progress, stalls and seek outcomes. Report browser capability checks
and codec failures; a container or HTTP 200 does not establish playback support.
Tracks listed are not tracks verified. Human audibility, device-specific playback,
DRM and unmeasured synchronization must stay explicitly unverified.