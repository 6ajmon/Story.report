# Story.report
<img height="600" alt="report" src="https://github.com/user-attachments/assets/2b8c4a02-f685-4cb4-a1b1-f221875311c0" />

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
- ✅ **Expanded Font Catalog** - 40+ grouped fonts (sans-serif, serif, mono, decorative) with live preview, auto-filtered to only fonts Typst can render on the machine
- ✅ **Bundled Google Fonts** - Download a curated OFL font set into `fonts/` (CLI or one UI button) so servers/containers with few system fonts still get a rich catalog
- ✅ **Two Fonts** - Separate primary and secondary (labels/captions) font selectors, both defaulting to the same family
- ✅ **Export Actions** - Copy the rendered story to the clipboard or download it as PNG straight from the preview
- ✅ **Remembered Credentials** - Optionally keep your Last.fm username + API key in the browser's `localStorage`
- ✅ **Image Color Presets** - One-click background + accent extraction from the Top Artist, Top Album, or Top Track artwork (median-cut quantization), with WCAG contrast enforcement so accent text stays readable
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
├── Dockerfile
├── README.md
├── QUICK_START.md
├── ARCHITECTURE.md
├── FAQ.md
├── AGENTS.md
├── .gitignore
├── package.json
├── scripts/
│  └── fetch-fonts.js         # downloads bundled Google Fonts into fonts/
├── fonts/                    # bundled TTFs (git-ignored, `npm run fonts`)
├── web/
│  ├── package.json
│  ├── lib/
│  │  └── palette.js          # median-cut color extraction for presets
│  └── pages/
│     ├── index.js
│     └── api/
│        ├── generate.js
│        ├── validate.js      # validates Last.fm username + API key
│        ├── fonts.js         # lists fonts Typst can render
│        ├── fetch-fonts.js   # triggers the Google Fonts download
│        ├── report-image.js
│        ├── report-assets.js # serves generated/assets for the UI
│        └── report-images.js # lists top artist/album/track images
└── generated/
   ├── report.typ
   ├── report.png
   └── assets/
      ├── artist.*
      ├── album.*
      └── track.*
```

Note: the generated directory and the bundled `fonts/` directory are ignored by git.

## Output

- final image: generated/report.png
- API snapshot: generated/report.json
- Typst source: generated/report.typ
- downloaded helper images: generated/assets

## Customizing the report

### Web UI Configuration

The web UI provides real-time controls for:

- **Last.fm Credentials** - Optional username + API key fields (with a **🔍 Check & Generate** button that validates them against the Last.fm API). Leave empty to use `LASTFM_USERNAME` / `LASTFM_API_KEY` from `.env`. Get a key at [last.fm/api/account/create](https://www.last.fm/api/account/create). With **Remember in this browser** checked they are stored in `localStorage` so you don't have to retype them.
- **Primary Font** - Base font for the report (bundled Google Fonts + system fonts, only fonts Typst can render are offered)
- **Secondary Font** - Optional second font for labels, captions and supporting text. Tick **different from primary** to use a different family; otherwise it follows the primary font.
- **⬇️ Download Google Fonts** - Download the bundled font catalog on servers with few system fonts
- **Background Color** - Custom hex color for page background
- **Accent Color** - Custom hex color for highlights and text
- **Custom date range** - Off by default (report covers the previous full calendar month). Tick it to reveal the `Date From` / `Date To` inputs (ISO format: YYYY-MM-DD)
- **Text Color Mode** - Auto (based on background luminance), Light (white), or Dark (black)
- **Mosaic Artist Count** - 2, 4, 6, 8, or 10 artists in the top artists grid
- **Module Toggles**:
  - Statistics (artists, albums, tracks count)
  - Top Artists Mosaic
  - Top Items (top artist, album, track)
  - Word Cloud (top tags)
- **Footer Text** - Custom footer or leave empty to hide
- **Preview actions** - **📋 Copy** copies the rendered PNG to the clipboard and **⬇️ Download** downloads it. Both are enabled once the image is generated (clipboard copy needs HTTPS or localhost).

### Change font
Use the web UI font dropdown, or edit [config.js](config.js) to change the default font family:

```javascript
typography: {
  font: 'Segoe UI',        // primary font — any family name (see below)
  fontSecondary: '',       // optional secondary font; empty = same as primary
  monoFont: 'Courier New', // Fallback monospace font
  ...
}
```

The **primary** font is used for the base text (big numbers, top item names, word
cloud), while the **secondary** font is applied to labels and captions (header,
`scrobbles` label, `N artists/albums/tracks`, `Top artist/album/track` labels,
playcount sublines, `Top tags` and the footer). When `fontSecondary` is empty
both are the same, reproducing the classic single-font report.

#### Bundled Google Fonts
Typst renders the report server-side, so it can only use fonts that exist on the
machine. On a minimal server/container that often means only a couple of system
fonts are available. To fix this, Story.report can bundle a curated set of
[Google Fonts](https://fonts.google.com/) (all OFL-licensed) — plus the
**Font Awesome Free** desktop fonts used for the report icons — into a local
`fonts/` directory and pass it to Typst via `--font-path`:

```bash
npm run fonts            # download missing fonts into ./fonts (idempotent)
npm run fonts -- --force # re-download everything
```

You can also trigger the download from the web UI with the
**⬇️ Download Google Fonts** button (next to the font selector); the catalog
refreshes automatically afterwards. In Docker the fonts are downloaded during
the image build, so nothing extra is needed at runtime.

The font dropdown previews each bundled family **in its own typeface**: the
browser loads the Google Fonts webfonts on demand (when the selector is focused),
independent of the server-side TTFs used by Typst.

Bundled families: Roboto, Open Sans, Lato, Montserrat, Poppins, Inter, Nunito,
Raleway, Work Sans, Playfair Display, Merriweather, Lora, Source Serif 4,
JetBrains Mono, Fira Code, Roboto Mono, Source Code Pro, IBM Plex Mono,
Bebas Neue, Lobster, Pacifico, Anton.

Set `REPORT_FONTS_DIR` to use a different bundled-fonts directory.

Common system monospace fonts (used as fallbacks):
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

