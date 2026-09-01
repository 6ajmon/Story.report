import { execSync } from 'child_process';

/**
 * Returns the font faces Typst can actually render on this machine
 * (output of `typst fonts`). The web UI uses this to hide catalog fonts
 * that Typst cannot resolve, so every offered font works on the image.
 */

let cached = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

export default function handler(req, res) {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    res.status(200).json(cached);
    return;
  }

  try {
    const output = execSync('typst fonts', {
      encoding: 'utf-8',
      maxBuffer: 8 * 1024 * 1024,
    });

    const fonts = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    cached = { ok: true, fonts };
    cachedAt = Date.now();
    res.status(200).json(cached);
  } catch (error) {
    res.status(200).json({
      ok: false,
      error: `Could not list Typst fonts: ${error.message}`,
    });
  }
}
