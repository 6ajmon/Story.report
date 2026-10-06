# Story.report Quick Start

## 1. Install Typst

Windows:

```powershell
choco install typst
```

macOS:

```bash
brew install typst
```

Linux (Debian/Ubuntu):

```bash
sudo apt-get install typst
```

Verify:

```bash
typst --version
```

## 2. Install dependencies

```bash
npm install
```

For the web UI:

```bash
cd web
npm install
```

## 3. Configure .env

```env
LASTFM_API_KEY=your_api_key
LASTFM_USERNAME=your_username
```

## 4. (Optional) Bundle extra fonts

Typst can only render fonts installed on the machine. On a minimal server only a
few may be present, so Story.report can download a curated set of Google Fonts
into a local `fonts/` directory:

```bash
npm run fonts
```

You can also click **⬇️ Pobierz czcionki Google** in the web UI. In Docker the
fonts are downloaded automatically during the image build.

## 5. Generate the report

```bash
npm start
```

Or run the web UI:

```bash
npm run web
```

## 6. Find the output

- image: generated/report.png
- Typst source: generated/report.typ
- helper images: generated/assets

The report covers the previous full calendar month, from day 01 to the last day of that month.
