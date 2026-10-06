#!/usr/bin/env node
/**
 * Downloads a curated set of Google Fonts (TTF/OTF) into ./fonts so Typst can
 * render them on any machine — including minimal servers / containers that have
 * only a couple of system fonts installed.
 *
 * The fonts live in the public `google/fonts` repository and are licensed under
 * the SIL Open Font License (OFL), so they are safe to bundle.
 *
 * Usage:
 *   node scripts/fetch-fonts.js            # download missing fonts (idempotent)
 *   node scripts/fetch-fonts.js --force    # re-download every font
 *
 * Env:
 *   REPORT_FONTS_DIR   Override the destination directory (default: <repo>/fonts)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DEST_DIR = process.env.REPORT_FONTS_DIR || path.join(ROOT, 'fonts');
const RAW_BASE = 'https://raw.githubusercontent.com/google/fonts/main/';
const FORCE = process.argv.includes('--force');
const CONCURRENCY = 4;

// Paths are relative to the `google/fonts` repo root. Families are grouped for
// readability only — every entry is downloaded and made available to Typst.
const FONT_FILES = [
  // Sans-serif
  'ofl/roboto/Roboto[wdth,wght].ttf',
  'ofl/opensans/OpenSans[wdth,wght].ttf',
  'ofl/lato/Lato-Regular.ttf',
  'ofl/lato/Lato-Bold.ttf',
  'ofl/montserrat/Montserrat[wght].ttf',
  'ofl/poppins/Poppins-Regular.ttf',
  'ofl/poppins/Poppins-Bold.ttf',
  'ofl/inter/Inter[opsz,wght].ttf',
  'ofl/nunito/Nunito[wght].ttf',
  'ofl/raleway/Raleway[wght].ttf',
  'ofl/worksans/WorkSans[wght].ttf',
  // Serif
  'ofl/playfairdisplay/PlayfairDisplay[wght].ttf',
  'ofl/merriweather/Merriweather[opsz,wdth,wght].ttf',
  'ofl/lora/Lora[wght].ttf',
  'ofl/sourceserif4/SourceSerif4[opsz,wght].ttf',
  // Monospace
  'ofl/jetbrainsmono/JetBrainsMono[wght].ttf',
  'ofl/firacode/FiraCode[wght].ttf',
  'ofl/robotomono/RobotoMono[wght].ttf',
  'ofl/sourcecodepro/SourceCodePro[wght].ttf',
  'ofl/ibmplexmono/IBMPlexMono-Regular.ttf',
  // Display / decorative
  'ofl/bebasneue/BebasNeue-Regular.ttf',
  'ofl/lobster/Lobster-Regular.ttf',
  'ofl/pacifico/Pacifico-Regular.ttf',
  'ofl/anton/Anton-Regular.ttf',
];

// raw.githubusercontent.com needs brackets/commas percent-encoded.
function toUrl(relPath) {
  const encoded = relPath
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/,/g, '%2C');
  return RAW_BASE + encoded;
}

// Never include brackets/commas in on-disk names (Typst reads any name, but
// this keeps the directory portable across shells/filesystems).
function toFileName(relPath) {
  const base = path.basename(relPath);
  return base.replace(/[[\],]/g, '-').replace(/-+/g, '-');
}

async function downloadOne(relPath) {
  const name = toFileName(relPath);
  const dest = path.join(DEST_DIR, name);

  if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return { name, status: 'skipped' };
  }

  const res = await fetch(toUrl(relPath), { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) {
    throw new Error(`suspiciously small file (${buf.length} bytes)`);
  }
  fs.writeFileSync(dest, buf);
  return { name, status: 'downloaded', bytes: buf.length };
}

async function main() {
  fs.mkdirSync(DEST_DIR, { recursive: true });

  console.log(`\n🔤 Story.report — fetching Google Fonts`);
  console.log(`   destination: ${DEST_DIR}`);
  console.log(`   mode:        ${FORCE ? 'force (re-download)' : 'incremental'}\n`);

  const results = [];
  const failures = [];

  // Simple worker pool so we don't hammer the network.
  let index = 0;
  async function worker() {
    while (index < FONT_FILES.length) {
      const relPath = FONT_FILES[index++];
      try {
        results.push(await downloadOne(relPath));
      } catch (error) {
        failures.push({ relPath, error: error.message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, FONT_FILES.length) }, worker));

  const downloaded = results.filter((r) => r.status === 'downloaded').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  for (const f of failures) {
    console.warn(`   ⚠️  ${toFileName(f.relPath)} — ${f.error}`);
  }

  console.log(
    `\n✅ Fonts ready: ${downloaded} downloaded, ${skipped} already present` +
      (failures.length ? `, ${failures.length} failed` : '')
  );
  console.log(`   Typst will pick them up via --font-path "${DEST_DIR}".\n`);

  // Non-zero exit only if nothing could be prepared at all.
  if (failures.length === FONT_FILES.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Font fetch failed:', error.message);
  process.exit(1);
});
