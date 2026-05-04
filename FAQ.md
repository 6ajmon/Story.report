# Story.report FAQ

## Report data and time range

### How is the period calculated?
The report covers the previous full calendar month:
- from day 01 of the previous month,
- through the last day of that month (23:59:59).

### Is the data all-time?
No. All core metrics are calculated from a single time range (the previous month) based on scrobbles.

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

### How do I change the font to monospace?
Use the web UI `Mono preset`, or edit `config.js` and set `typography.font` to `mono`.

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
