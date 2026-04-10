# Changelog

## v1.0.0 — 2026-04-10

Initial public release.

### Features
- Resolution-tiered HEVC encoding: SD (3 Mbps), 720p (4 Mbps), 1080p (5.5 Mbps), 4K (12 Mbps)
- 10-bit HEVC output via Intel QSV with EncTools-style tuning (extbrc, look-ahead depth 40, b-strategy)
- Skip paths for Dolby Vision, HDR10, already-efficient codecs (HEVC/VP9/AV1), low-bitrate sources, small files
- Hardlink protection for torrent-seeding files (`skipHardlinked`)
- WebVTT and unknown subtitle codec stripping to prevent ffmpeg crashes (`stripUnsupportedSubs`)
- mkvpropedit recovery path for files missing per-stream BPS metadata (`runMkvpropeditOnCache`)
- Loopback retry with cleanup-only fallback if an encode produces a suspiciously small output
- Hard upper size gate with original-file restore if output is somehow larger than source
- Safe stream cleanup: MP4→MKV remux, attachment removal, stream reorder, language filtering, EAC3 audio
