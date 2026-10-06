import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Returns the font faces Typst can actually render on this machine
 * (output of `typst fonts`). The web UI uses this to hide catalog fonts
 * that Typst cannot resolve, so every offered font works on the image.
 *
 * Bundled Google Fonts (see scripts/fetch-fonts.js) are included via
 * --font-path so servers with few system fonts can still offer a rich catalog.
 *
 * Query params:
 *   ?refresh=1   Bypass the in-memory cache (used after downloading fonts).
 */

let cached = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

function resolveFontsDir() {
  const root = path.resolve(process.cwd(), '..');
  const configured = process.env.REPORT_FONTS_DIR;
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(root, configured);
  }
  return path.join(root, 'fonts');
}

export default function handler(req, res) {
  const refresh = req.query && (req.query.refresh === '1' || req.query.refresh === 'true');
  const now = Date.now();
  if (!refresh && cached && now - cachedAt < CACHE_TTL_MS) {
    res.status(200).json(cached);
    return;
  }

  const fontsDir = resolveFontsDir();
  const hasBundledFonts = fs.existsSync(fontsDir);
  const fontPathArg = hasBundledFonts ? ` --font-path "${fontsDir}"` : '';

  try {
    const output = execSync(`typst fonts${fontPathArg}`, {
      encoding: 'utf-8',
      maxBuffer: 8 * 1024 * 1024,
    });

    const fonts = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    cached = { ok: true, fonts, fontsDir: hasBundledFonts ? fontsDir : null };
    cachedAt = Date.now();
    res.status(200).json(cached);
  } catch (error) {
    res.status(200).json({
      ok: false,
      error: `Could not list Typst fonts: ${error.message}`,
    });
  }
}
