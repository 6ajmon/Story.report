# Story.report

Instagram Story report generator (1080x1920) built from Last.fm listening data.

## What the project does now

1. Fetches all scrobbles from the previous full calendar month.
2. Calculates all core statistics locally from the same dataset:
   - scrobble count,
   - unique artists,
   - unique albums,
   - unique tracks,
   - top artist, top album, top track.
3. Builds top tags from the monthly top artists.
4. Downloads images with fallbacks:
   - artist: artist -> album -> track,
   - album: album -> artist -> track,
   - track: track/track album -> track album -> track artist -> top artist.
5. Generates Typst and compiles PNG.

## Requirements

- Node.js 18+
- Typst CLI available in PATH
- Last.fm account + API key

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create a .env file:

```env
LASTFM_API_KEY=your_api_key
LASTFM_USERNAME=your_username
```

3. Run the generator:

```bash
npm start
```

## Folder Structure

```text
story-report/
├── index.js
├── README.md
├── QUICK_START.md
├── ARCHITECTURE.md
├── FAQ.md
├── AGENTS.md
├── .env.example
├── .gitignore
├── package.json
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

### Change font
Edit [config.js](config.js) to change the `typography.font` value:

```javascript
typography: {
  font: 'Segoe UI',       // Change to 'Courier New', 'IBM Plex Mono', 'JetBrains Mono' for monospace
  monoFont: 'Courier New', // Fallback monospace font
  ...
}
```

Common monospace fonts:
- `Courier New` (default, works everywhere)
- `IBM Plex Mono`
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
Edit [config.js](config.js) colors section, or directly in generateTypstTemplate function in [index.js](index.js).

## Extending the project

The main extension points are:

- data aggregation: aggregateListeningData in index.js
- layout and typography: generateTypstTemplate and generateTagCloud in index.js
- image fallbacks: extractImageUrls, extractTrackImageUrls, downloadImage in index.js
- tag cloud styling: generateTagCloud function in index.js (controls min/max font size: 14pt–28pt)

## Troubleshooting

1. Typst is not detected:
   - run typst --version,
   - add Typst to PATH.
2. No data appears:
   - make sure the account has scrobbles in the previous month.
3. Missing images:
   - Last.fm often returns empty image fields,
   - the project has fallbacks, but not every entity has artwork in the API.

## Security

- do not commit .env
- do not commit generated images or runtime artifacts

## License

MIT

