# Story.report FAQ

## Report data and time range

### How is the period calculated?
By default, the report covers the previous full calendar month:
- from day 01 of the previous month,
- through the last day of that month (23:59:59).

### Can I change the date range?
Yes! In the web UI, use the "Date From" and "Date To" fields to specify a custom date range (ISO format: YYYY-MM-DD).

### Is the data all-time?
No. All core metrics are calculated from a single time range (the previous month by default, or your custom range) based on scrobbles.

### Where do top tags come from?
Top tags are assembled from the tags of the top artists in the selected month.

## Images

### Why are some images missing?
Last.fm often does not return a complete image field for every entity. The project has fallbacks, but not every entity has artwork in the API.

### How does the fallback work?
- artist: artist -> album -> track
- album: album -> artist -> track
- track: track/track album -> track album -> track artist -> top artist

## Output files

### Where is the report?
In generated/report.png.

### Where is the API JSON snapshot?
In generated/report.json.

### Where is the Typst source?
In generated/report.typ.

### Where are the downloaded images?
In generated/assets.

## Web UI

### How do I open the web interface?
Run:

```bash
npm run web
```

Then open the local Next.js app in the browser.

### Where does the preview image come from?
The image preview is streamed from `/api/report-image` inside the Next.js app and points to `generated/report.png`.

## Customization

### Which modules can I disable?
All main modules can be toggled on/off in the web UI:
- **Statistics** - Artists, albums, tracks count
- **Top Artists Mosaic** - Grid of top artist images
- **Top Items** - Top artist, album, and track sections
- **Word Cloud** - Tag cloud from top artists

### How do I disable a module?
In the web UI, uncheck the corresponding checkbox in the "Modules" section.

### What is the mosaic?
The top artists mosaic shows album artwork for your top artists in a dynamic grid. You can set it to display 2, 4, 6, 8, or 10 artists.

### What about text color?
The report has three text color modes:
- **Auto** (default) - Automatically chooses white or black based on the background luminance
- **Light** - Always uses white text
- **Dark** - Always uses black text

Use "Auto" mode for best contrast on custom backgrounds.

### How do I change the font?
Use the web UI **Font** dropdown - it groups **40+ fonts** (Sans-serif, Serif, Monospace, Display/Decorative) plus the `Mono preset` and `Serif preset`. Only fonts Typst can actually render on your machine are shown (auto-detected via `typst fonts`); a small note under the dropdown shows the count. You can also edit `config.js` and set `typography.font` to any renderable font name; if a font is missing, the report falls back to `Segoe UI`.

### Only a few fonts show up on my server. How do I get more?
Typst can only use fonts installed on the machine. To make Story.report work everywhere, it can bundle a curated set of Google Fonts into a local `fonts/` directory and pass it to Typst with `--font-path`. Download them with either:
- the **⬇️ Pobierz czcionki Google** button in the web UI (next to the font dropdown), or
- `npm run fonts` on the command line (`npm run fonts -- --force` to re-download).

The catalog includes Roboto, Open Sans, Montserrat, Poppins, Inter, Playfair Display, Lora, JetBrains Mono, Bebas Neue, Lobster and more (all OFL-licensed). In Docker the fonts are baked in during the image build, so no action is needed after deploy. Use `REPORT_FONTS_DIR` to point at a different directory.

### How do the image color presets work?
In the web UI, open **Color Presets from Image** and click `Top Artist`, `Top Album`, or `Top Track`. The report downsamples the artwork, runs median-cut quantization to build a palette, then proposes two colors: a **background** (dominant color, darkened when dark) and an **accent** (most vibrant color distinct from the background). The accent is then adjusted (lightened on dark backgrounds, darkened on light ones) until it reaches a **WCAG AA contrast ratio of at least 4.5:1** against the background, so accent-colored text stays clearly readable. Both colors are applied to the form and the report regenerates automatically.

### What are the tag cloud sizes?
Tags are displayed in a flowing word cloud. Font size scales from **14pt** (smallest count) to **32pt** (largest count). Tags are shuffled for organic appearance and use varying gray shades (darker = less popular, whiter = more popular).

## Running the app

### Minimum requirements
- Node.js 18+
- Typst CLI
- LASTFM_API_KEY and LASTFM_USERNAME in .env

### Start command

```bash
npm start
```

## Debugging

### Typst does not work
Check:

```bash
typst --version
```

### The report has no data
Make sure the account has scrobbles in the previous month and that the API key is valid.
