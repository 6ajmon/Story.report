# Story.report

Instagram Story report generator (1080x1920) built from Last.fm listening data, with a Next.js web UI for configuring, customizing, and previewing reports in real-time.

## Features

- ✅ **Monthly Listening Report** - Generates Instagram Story (1080×1920) with listening stats
- ✅ **Live Web UI** - Real-time preview and configuration with 50/50 layout (form + preview)
- ✅ **Customizable Modules** - Toggle statistics, top items, mosaic, word cloud on/off
- ✅ **Top Artists Mosaic** - Dynamic grid layout (2-5 artists per row, up to 10 artists)
- ✅ **Word Cloud** - Tag cloud from top artists with accent color gradient
- ✅ **Adaptive Text Colors** - Automatic white/black text based on background luminance
- ✅ **Custom Date Ranges** - Override the default previous month with any date range
- ✅ **Fontawesome Icons** - Star icon for artists, disc icon for albums, note for tracks
- ✅ **Smart Image Fallbacks** - Multi-level fallback chain for artist/album/track images
- ✅ **Intelligent Caching** - Caches Last.fm API responses, reuses on config changes
- ✅ **No Avatar** - Lightweight, clean design without user avatar

## Quick Start

### 1. Install dependencies

```bash
npm install
cd web && npm install
```

### 2. Create `.env` file

```env
LASTFM_API_KEY=your_api_key
LASTFM_USERNAME=your_username
```

### 3. Generate a report

**CLI mode:**
```bash
npm start
```

**Web UI mode:**
```bash
npm run web
```
Then open [http://localhost:3000](http://localhost:3000) to configure and preview in real-time.

## Folder Structure

```text
story-report/
├── index.js
├── README.md
├── QUICK_START.md
├── ARCHITECTURE.md
├── FAQ.md
├── AGENTS.md
├── .gitignore
├── package.json
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
      ├── artist.*
      ├── album.*
      └── track.*
```

Note: the generated directory is ignored by git.

## Output

- final image: generated/report.png
- API snapshot: generated/report.json
- Typst source: generated/report.typ
- downloaded helper images: generated/assets

## Customizing the report

### Web UI Configuration

The web UI provides real-time controls for:

- **Font** - 8 font presets displayed in their own fonts
- **Background Color** - Custom hex color for page background
- **Accent Color** - Custom hex color for highlights and text
- **Date Range** - Override the default previous month (ISO format: YYYY-MM-DD)
- **Text Color Mode** - Auto (based on background luminance), Light (white), or Dark (black)
- **Mosaic Artist Count** - 2, 4, 6, 8, or 10 artists in the top artists grid
- **Module Toggles**:
  - Statistics (artists, albums, tracks count)
  - Top Artists Mosaic
  - Top Items (top artist, album, track)
  - Word Cloud (top tags)
- **Footer Text** - Custom footer or leave empty to hide

### Change font
Use the web UI font presets, or edit [config.js](config.js) if you want to change the default font family:

```javascript
typography: {
  font: 'Segoe UI',       // Change to 'Courier New', 'IBM Plex Mono', 'JetBrains Mono' for monospace
  monoFont: 'Courier New', // Fallback monospace font
  ...
}
```

Common monospace fonts:
- `Consolas` (default monospace fallback on Windows)
- `Courier New`
- `JetBrains Mono`
- `Inconsolata`

### Adjust layout (margins, spacing)
Edit [config.js](config.js) page margins and spacing properties:

```javascript
page: {
  margin: {
    top: '60pt',
    bottom: '60pt',
    left: '48pt',
    right: '48pt',
  },
}
```

### Change statistics icons
Edit [config.js](config.js) icons section to customize the minimalist Unicode symbols:

```javascript
icons: {
  artists: '★',       // BLACK STAR - change to ◆, ◈, etc.
  albums: '◉',        // FISHEYE (vinyl-like) - change to ◯, ◎, etc.
  tracks: '♪',        // EIGHTH NOTE - change to ♫, 🎵, etc.
}
```

### Modify colors
Use the web UI controls or edit [config.js](config.js) colors section.

## Extending the project

The main extension points are:

- data aggregation: aggregateListeningData in index.js
- layout and typography: generateTypstTemplate and generateTagCloud in index.js
- image fallbacks: extractImageUrls, extractTrackImageUrls, downloadImage in index.js
- tag cloud styling: generateTagCloud function in index.js
- web UI: web/pages/index.js and web/pages/api/report-image.js

## Troubleshooting

1. Typst is not detected:
   - run typst --version,
   - add Typst to PATH.
2. No data appears:
   - make sure the account has scrobbles in the previous month.
3. Missing images:
   - Last.fm often returns empty image fields,
   - the project has fallbacks, but not every entity has artwork in the API.
4. Web UI preview does not load:
   - make sure `npm run web` is running from the repo root,
   - the preview image is served from `/api/report-image` inside the Next.js app.

## Security

- do not commit .env
- do not commit generated images or runtime artifacts

## License

MIT

