# Connection billing
## Admin credit overview
- [ ] Show every reseller balance and the existing below-10 warning in the admin dashboard.
- [ ] Verify authenticated dashboard balances and run tests.

## Test suite
- [x] Fix the two page tests without changing application behavior.
- [x] Run the full test suite and confirm all 26 tests pass.

## Playlist playback
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