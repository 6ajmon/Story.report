# Story.report Architecture

## Overview

The current architecture is built around a single source of truth: the scrobble list from the previous full calendar month. The generator remains the backend source of truth, while the Next.js app is a thin configuration and preview layer.

1. Fetch scrobbles from user.getRecentTracks with from/to parameters.
2. Aggregate all statistics locally from that list.
3. Make additional requests only for metadata such as images and tags.
4. Generate Typst.
5. Compile to PNG.
6. Optionally serve a web UI that posts overrides to the generator and streams the latest PNG.

## Project Structure

```text
story-report/
├── index.js
├── README.md
├── QUICK_START.md
├── ARCHITECTURE.md
├── FAQ.md
├── AGENTS.md
├── web/
│  ├── package.json
│  └── pages/
│     ├── index.js
│     └── api/
│        ├── generate.js
│        └── report-image.js
└── generated/
   ├── report.typ
   ├── report.png
   └── assets/
```

## Key functions in index.js

- getDateRange
  - Returns date range from REPORT_OVERRIDES if provided, otherwise uses previous full calendar month.
  - Custom dates override the default month calculation.
- fetchRecentTracksInRange
  - Fetches all recent track pages for the selected range.
- aggregateListeningData
  - computes scrobbles, unique counts, and top artist/album/track.
- fetchEntityInfo
  - fetches artist/album/track metadata for images.
- fetchTopTagsFromArtists
  - builds top tags from the monthly top artists.
- downloadImage
  - downloads an image from a list of URLs, detects the format from magic bytes, and stores it in generated/assets.
- generateTypstTemplate
  - renders the report as Typst with conditional module rendering.
- generateArtistMosaic
  - creates dynamic grid layout for top artists (2-5 columns based on count).
- getTextColor / getColorLuminance
  - adaptive text color calculation based on background brightness.
- compileTypstToPng
  - compiles generated/report.typ into generated/report.png (--pages 1 export).

## Image fallback logic

- artist: artist image -> top album image -> top track image
- album: album image -> artist image -> track image
- track: track image/track album image -> track album -> track artist -> top artist image

## Why it works this way

- all numbers come from one consistent time range,
- lower risk of mixing monthly data with all-time data,
- easier to extend with more report sections later.
- **Typst** - CLI tool for PDF/PNG generation (REQUIRED)
- **Node.js** - Runtime (v18+ recommended)
- **Next.js** - Optional web UI runtime in `web/`

### Operating Systems
- ✅ Windows
- ✅ macOS
- ✅ Linux

## Future Enhancement Ideas

1. **Multiple Templates** - Support different design templates
2. **Time Periods** - Allow user to select different periods (week, quarter, year)
3. **Social Sharing** - Direct upload to Instagram API
4. **Caching** - Cache API responses to reduce calls
5. **Image Formats** - Support PDF, SVG output
6. **Custom Colors** - CLI arguments for color schemes
7. **Scheduling** - Cron job to generate weekly/monthly reports
8. **User Statistics** - Additional metrics (genre breakdown, discovery)
9. **Share Link** - Generate shareable link to report

## Debugging

### Enable Verbose Logging
Modify `index.js` to add console logs:
```javascript
console.log('DEBUG: API Response', response.data);
```

### Test API Connection
```bash
# Test Last.fm API manually
curl "https://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=USERNAME&api_key=API_KEY&format=json"
```

### Test Typst Installation
```bash
typst --version
typst compile template.typ.example out.png
```

## Environment Variables

### Core
- `LASTFM_API_KEY` - Last.fm API key (required)
- `LASTFM_USERNAME` - Last.fm username (required)

### Report Overrides (used by web UI)
- `REPORT_FONT` - Font family (e.g., 'Segoe UI', 'mono', 'serif')
- `REPORT_BG` - Background color hex (e.g., '#0f0f0f')
- `REPORT_ACCENT` - Accent color hex (e.g., '#e8d5a3')
- `REPORT_FOOTER_TEXT` - Custom footer text
- `REPORT_DATE_FROM` - Start date for custom range (ISO format: YYYY-MM-DD)
- `REPORT_DATE_TO` - End date for custom range (ISO format: YYYY-MM-DD)
- `REPORT_MOSAIC_ARTIST_COUNT` - Number of artists in mosaic (2-10, default: 10)
- `REPORT_ENABLE_MOSAIC` - Enable/disable top artists mosaic (default: true)
- `REPORT_ENABLE_STATISTICS` - Enable/disable statistics module (default: true)
- `REPORT_ENABLE_TOP_ITEMS` - Enable/disable top items section (default: true)
- `REPORT_ENABLE_WORDCLOUD` - Enable/disable word cloud (default: true)
- `REPORT_TEXT_COLOR_MODE` - Text color mode: 'auto' (default), 'light', 'dark'

## Contributing

When modifying the application:
1. Keep functions small and focused
2. Add error handling for new features
3. Update documentation
4. Test with sample data first (`npm run example`)
5. Verify with real data before committing

---

Last Updated: 2024
