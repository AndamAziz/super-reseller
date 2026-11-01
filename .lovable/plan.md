# Phase 2: Real playback verification

## Scope
Complete the uploaded checklist without changing the current panel layout, customer records, reseller assignments, credit rules or working playback paths.

The panel currently has a stream connectivity test, not an embedded decoding player. Add a reusable browser playback engine and an isolated verification harness rather than replacing the current experience.

## Work
1. **Detect the actual media.** Combine final response headers, redirects and bounded content-signature inspection to distinguish HLS, TS, MP4, audio and DASH. Preserve streaming, seeking headers and existing source headers.
2. **Verify real playback.** Use native browser playback where appropriate and proven browser engines for HLS/TS and DASH. Measure startup, decoded frames, audio output signal, playback progress, stalls and supported seeking. Exercise audio/subtitle selection when test media provides those tracks.
3. **Complete DASH delivery.** Handle MPD manifests and their media, initialization and audio URLs through the existing authenticated, signed proxy chain. Verify actual decoding, adaptive switching and audio/video behavior before reporting DASH as supported. Keep DRM or unavailable upstream content explicitly unverified.
4. **Check codecs and unsupported formats.** Inspect representative media codecs and compare with the test browser's capabilities. Return a clear unsupported result instead of treating a 200 response as successful playback. Evaluate AVI/MKV per codec, not filename.
5. **Verify synchronization and regressions.** Check five-second panel polling, content-version changes, update replacement without newly introduced duplicates, safe removals and latest-URL resolution. Use controlled fixtures for source mutations; do not edit the real GitHub playlist or reseller assignments. Run existing tests and the complete authenticated channel-to-player path using an authorized test line.
6. **Deliver the report.** Separate HTTP and decoded-playback success rates with sample counts and test durations. Include audio/video evidence, codec results, DASH status, refresh findings and limitations. Do not extrapolate a sample to all 10,402 entries or all devices.

## Limits
- Automated audio analysis can prove decoded output signal, not that a person heard sound from their phone. Track availability and synchronization evidence will be reported separately, not assumed.
- A bounded playback run cannot guarantee continuous upstream availability or every device's codec support.
- RTMP/RTMPS are not browser-native. The current hosting cannot run a server-side FFmpeg conversion process. Investigate relay options only; do not add a paid service without approval.
- Publishing is separate and will not happen without your request.

## Technical approach
- Load browser playback dependencies dynamically after hydration; keep the current page layout unchanged.
- Use Shaka Player for DASH and a proven HLS/TS engine where needed. Keep the harness isolated from ordinary panel usage.
- Retain line authentication, expiry checks, connection-limit accounting, signed target authorization and redirect protection for new delivery paths.
- Preserve the body after bounded signature inspection; do not buffer long audio/video responses.
- Add focused tests for detection, DASH URL handling and measured playback verdicts; retain and run the existing regression suite.
- Record HTTP statuses separately from decoder evidence. Sanitize credentials and signed playback links from reports and screenshots.