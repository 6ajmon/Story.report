# AGENTS.md

## Purpose

This repository generates a monthly Last.fm Instagram Story report.

Primary runtime entrypoint:
- index.js

Primary web interface:
- web/pages/index.js
- web/pages/api/generate.js
- web/pages/api/report-image.js

Primary output:
- generated/report.png

## Invariants

1. Time window
- Always use the previous full calendar month.
- Start: day 01 00:00:00 (local time).
- End: last day of that month 23:59:59 (local time).

2. Data consistency
- Core metrics must come from the same scrobble dataset fetched from user.getRecentTracks with from/to.
- Do not mix all-time data with monthly report metrics.

3. Output structure
- Keep runtime artifacts under generated/.
- Keep downloaded images under generated/assets/.
- Keep Typst source under generated/report.typ.
- Keep final image under generated/report.png.

4. Track image policy
- Prefer top-track-specific image sources first.
- Fallback order for track image:
  1) track image / track album image
  2) top-track album image
  3) top-track artist image
  4) top-artist image

5. Git hygiene
- Never commit secrets (.env).
- Never commit runtime artifacts from generated/.

## Development workflow

1. Install dependencies
- npm install
- cd web && npm install

2. Run generator
- npm start

3. Run web UI
- npm run web

4. Validate after code edits
- npm start
- cd web && npm run build
- Ensure generated/report.png is created.
- Confirm date range in output matches previous full month.

## Editing guidance

When changing functionality:
- Update README.md, QUICK_START.md, ARCHITECTURE.md, and FAQ.md if behavior changed.
- Keep functions small and deterministic.
- Preserve backward-compatible CLI behavior: npm start should remain the primary command.

When changing visual layout:
- Edit generateTypstTemplate in index.js.
- Keep 1080x1920 output size.
- Avoid introducing unsupported fonts by default on Windows.

When changing the web UI:
- Edit files under web/pages.
- Keep the preview endpoint serving generated/report.png with no-store caching.

## API notes

Currently used Last.fm methods:
- user.getInfo
- user.getRecentTracks
- artist.getInfo
- album.getInfo
- track.getInfo
- artist.getTopTags

If adding methods, keep rate-limit-friendly usage and clear fallback handling.
