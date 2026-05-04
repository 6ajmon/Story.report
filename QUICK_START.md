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

## 3. Configure .env

```env
LASTFM_API_KEY=your_api_key
LASTFM_USERNAME=your_username
```

## 4. Generate the report

```bash
npm start
```

## 5. Find the output

- image: generated/report.png
- Typst source: generated/report.typ
- helper images: generated/assets

The report covers the previous full calendar month, from day 01 to the last day of that month.
