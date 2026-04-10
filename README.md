# Tdarr Tiered Intel QSV HEVC Flow

A resolution-aware HEVC transcoding flow for [Tdarr](https://github.com/HaveAGitGat/Tdarr), built around Intel Quick Sync Video (QSV) hardware encoding. Designed for mixed media libraries where source quality, codec, and resolution vary widely.

## What it does

- **Shrinks libraries without visible quality loss.** Re-encodes h264/MPEG-class video to 10-bit HEVC using per-resolution bitrate targets (3 Mbps SD, 4 Mbps 720p, 5.5 Mbps 1080p, 12 Mbps 4K), with 10-bit HEVC output and tunable per-resolution bitrate targets.
- **Never touches sources that shouldn't be touched.** Skips Dolby Vision (re-encoding breaks DV metadata), HDR10, hardlinked files still seeding in torrent clients, files already in HEVC/VP9/AV1, and low-bitrate sources where re-encoding would degrade quality.
- **Cleans up containers and metadata.** Remuxes MP4 to MKV, strips unwanted subtitle languages and codecs (keeping English), removes unwanted audio tracks (keeping English/Japanese/Spanish), removes image/attachment streams, and reorders streams so video comes first.
- **Fails safely.** A loopback retries cleanup-only if an encode produces a suspiciously small output. A hard upper size gate reverts to original if the result is somehow larger. An mkvpropedit recovery path handles files with missing per-stream bitrate metadata. The original library file is never lost.

## Hardware requirements

- **Intel CPU with Quick Sync Video**, 7th-gen Core (Kaby Lake) or newer for 10-bit HEVC
- **Or an Intel Arc dGPU** (A-series) — recommended for best quality-per-bit and throughput
- **`mkvpropedit`** available on the Tdarr node container (part of `mkvtoolnix`)
- **Tdarr 2.11.01** or newer

## Installation

### 1. Install the local flow plugins

Copy the four folders inside `plugins/` into your Tdarr node's local flow plugins directory:

```
<your-tdarr-data>/server/Tdarr/Plugins/FlowPlugins/LocalFlowPlugins/file/
```

After copying, the structure should look like:

```
LocalFlowPlugins/file/
├── skipHardlinked/1.0.0/index.js
├── skipDolbyVision/1.0.0/index.js
├── stripUnsupportedSubs/1.0.0/index.js
└── runMkvpropeditOnCache/1.0.0/index.js
```

### 2. Confirm mkvpropedit is available

```bash
docker exec <tdarr-node-container> which mkvpropedit
```

Should return `/usr/bin/mkvpropedit`. If not, install `mkvtoolnix` in the container.

### 3. Confirm the Boosh QSV HEVC plugin is available

This flow uses `Local:Tdarr_Plugin_bsh1_Boosh_FFMPEG_QSV_HEVC`. Install it via Tdarr's plugin browser if not already present.

### 4. Import the flow

In Tdarr UI: **Flows** → **Import Flow** → select the JSON file from `flows/`.

### 5. Attach to a library

**Libraries** → select your library → **Transcode** tab → choose the flow.

### 6. Restart the Tdarr node

Ensures the local plugins are picked up.

## What it skips (and why)

| Condition | Reason |
|---|---|
| Dolby Vision metadata detected | Re-encoding strips DV, causing playback issues |
| HDR10 content | SDR-only encoding path; HDR needs tone-mapping |
| File already HEVC, VP9, or AV1 | Already in an efficient codec |
| Video bitrate < 1000 kbps | Source is too low quality; re-encoding would hurt |
| File size < 50 MB | Likely a trailer, sample, or extra |
| File has 2+ hardlinks | Torrent-sourced, still seeding in qBittorrent |

## Tuning

| Setting | Where | Default | Notes |
|---|---|---|---|
| Size ratio lower bound | `compare_file_size` node | 10% | Catches broken encodes. Raise to 20-30% if you want more caution |
| Bitrate modifier (1080p) | `qsv_fullhd_encode` node | 0.55 | Lower = smaller files, more quality loss |
| Bitrate modifier (SD/720p) | `qsv_sd_encode` / `qsv_hd_encode` | 0.50 | Same trade-off |
| Audio language whitelist | `clean_audio` node | `eng,und,jpn,spa` | Adjust to your languages |
| Subtitle language whitelist | `clean_subtitles` node | `eng,und` | Adjust to your languages |
| Bitrate cutoff | All encoder nodes | 0 (disabled) | Set to e.g. 3500 to skip sources already below that kbps |

## Included plugins

| Plugin | Purpose |
|---|---|
| `skipHardlinked` | Checks `nlink` count to protect torrent-seeding files |
| `skipDolbyVision` | Inspects ffprobe side_data for DOVI configuration records |
| `stripUnsupportedSubs` | Removes WebVTT and unknown subtitle codecs that crash ffmpeg in MKV |
| `runMkvpropeditOnCache` | Populates missing BPS/DURATION tags on a cache copy so the Boosh encoder plugin can calculate target bitrates |

## Tested on

- Intel Arc A380 (dGPU) + Ryzen 5 7600
- Unraid 7.x + Tdarr 2.68.01 (Docker)
- Jellyfin FFmpeg 7.1.2

## Scope and limitations

- **Intel QSV only.** No NVENC, AMD, or software fallback.
- **HEVC output only.** No AV1 path.
- **MKV output container only.** MP4 sources are remuxed in.
- **SDR only.** HDR content is skipped entirely.
- **Language whitelists are hardcoded.** Edit the JSON before importing if you need different languages.

## License

[MIT](LICENSE)
