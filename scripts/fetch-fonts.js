#!/usr/bin/env node
/**
 * Downloads a curated set of Google Fonts (TTF/OTF) plus the Font Awesome Free
 * desktop fonts into ./fonts so Typst can render them on any machine — including
 * minimal servers / containers that have only a couple of system fonts installed.
 *
 * Sources:
 *   - Google Fonts (public `google/fonts` repo, SIL Open Font License)
 *   - Font Awesome Free (public `FortAwesome/Font-Awesome` repo, OFL + CC BY 4.0),
 *     required by the Typst `fontawesome` package used for the report icons.
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

// Font Awesome Free desktop OTFs — required by the Typst `fontawesome` package
// used for the report's stats icons (star / disc / note).
const FONT_AWESOME_BASE = 'https://raw.githubusercontent.com/FortAwesome/Font-Awesome/7.x/otfs/';
const FONT_AWESOME_FILES = [
  'Font Awesome 7 Free-Solid-900.otf',
  'Font Awesome 7 Free-Regular-400.otf',
  'Font Awesome 7 Brands-Regular-400.otf',
];

// raw.githubusercontent.com needs brackets/commas percent-encoded.
function toUrl(relPath) {
  const encoded = relPath
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/,/g, '%2C');
  return RAW_BASE + encoded;
}

// Never include brackets/commas/spaces in on-disk names (Typst reads any name,
// but this keeps the directory portable across shells/filesystems).
function toFileName(fileName) {
  return path
    .basename(fileName)
    .replace(/[[\],]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Build the download queue: Google Fonts (relative to `google/fonts`) plus the
// Font Awesome desktop OTFs (absolute URLs).
function buildTasks() {
  const tasks = FONT_FILES.map((relPath) => ({
    url: toUrl(relPath),
    name: toFileName(relPath),
  }));
  for (const file of FONT_AWESOME_FILES) {
    tasks.push({ url: FONT_AWESOME_BASE + encodeURIComponent(file), name: toFileName(file) });
  }
  return tasks;
}

async function downloadOne({ url, name }) {
  const dest = path.join(DEST_DIR, name);

  if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return { name, status: 'skipped' };
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
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

  console.log(`\n🔤 Story.report — fetching fonts (Google Fonts + Font Awesome)`);
  console.log(`   destination: ${DEST_DIR}`);
  console.log(`   mode:        ${FORCE ? 'force (re-download)' : 'incremental'}\n`);

  const tasks = buildTasks();
  const results = [];
  const failures = [];

  // Simple worker pool so we don't hammer the network.
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const task = tasks[index++];
      try {
        results.push(await downloadOne(task));
      } catch (error) {
        failures.push({ task, error: error.message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));

  const downloaded = results.filter((r) => r.status === 'downloaded').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  for (const f of failures) {
    console.warn(`   ⚠️  ${f.task.name} — ${f.error}`);
  }

  console.log(
    `\n✅ Fonts ready: ${downloaded} downloaded, ${skipped} already present` +
      (failures.length ? `, ${failures.length} failed` : '')
  );
  console.log(`   Typst will pick them up via --font-path "${DEST_DIR}".\n`);

  // Non-zero exit only if nothing could be prepared at all.
  if (failures.length === tasks.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Font fetch failed:', error.message);
  process.exit(1);
});
