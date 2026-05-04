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

1. Time window (default behavior)
- By default, uses the previous full calendar month.
- Start: day 01 00:00:00 (local time).
- End: last day of that month 23:59:59 (local time).
- Can be overridden via REPORT_DATE_FROM and REPORT_DATE_TO environment variables (ISO format: YYYY-MM-DD).

2. Data consistency
- Core metrics must come from the same scrobble dataset fetched from user.getRecentTracks with from/to.
- Do not mix all-time data with monthly report metrics.

3. Output structure
- Keep runtime artifacts under generated/.
- Keep downloaded images under generated/assets/.
- Keep Typst source under generated/report.typ.
- Keep final image under generated/report.png.
- Compile with --pages 1 flag to export single page.

4. Module system
- All report modules (statistics, mosaic, top items, word cloud) can be toggled via environment variables.
- Default: all modules enabled.
- REPORT_ENABLE_MOSAIC, REPORT_ENABLE_STATISTICS, REPORT_ENABLE_TOP_ITEMS, REPORT_ENABLE_WORDCLOUD.

5. Image policy
- Prefer top-track-specific image sources first.
- Fallback order for track image:
  1) track image / track album image
  2) top-track album image
  3) top-track artist image
  4) top-artist image

6. Git hygiene
- Never commit secrets (.env).
- Never commit runtime artifacts from generated/.
- utils.js is currently unused helper file (can be removed or enhanced for future features).

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

## Environment Overrides (REPORT_OVERRIDES)

The web UI communicates with the generator through environment variables:

- REPORT_FONT - Font family selection
- REPORT_BG - Background color hex
- REPORT_ACCENT - Accent color hex
- REPORT_FOOTER_TEXT - Custom footer (empty = no footer)
- REPORT_DATE_FROM/REPORT_DATE_TO - Custom date range
- REPORT_MOSAIC_ARTIST_COUNT - Number of artists in mosaic (2-10)
- REPORT_ENABLE_MOSAIC - Enable top artists mosaic
- REPORT_ENABLE_STATISTICS - Enable statistics module
- REPORT_ENABLE_TOP_ITEMS - Enable top items section
- REPORT_ENABLE_WORDCLOUD - Enable word cloud
- REPORT_TEXT_COLOR_MODE - Text color strategy (auto/light/dark)

All overrides are optional; defaults apply if not specified.
