# Changelog

## v1.0.1 — 2026-04-10

### Fixed
- QSV encoder crash (`Invalid FrameType:0`) on specific content patterns (reproducible on animated sources with rapid scene changes). Removed `-look_ahead 1 -look_ahead_depth 40 -extbrc 1` from all four encoder tiers. Extended BRC with deep look-ahead was producing frame-type decisions the encoder core couldn't handle.

### Trade-off
- Slight reduction in quality-per-bit efficiency (roughly 5-10%) in exchange for encoder stability.

## v1.0.0 — 2026-04-10

Initial release. **Withdrawn** due to QSV encoder crash on certain content — see v1.0.1.
