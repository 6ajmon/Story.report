import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { font, bg, accent, from, to, footer, forceFetch, mosaicArtistCount, enableMosaic, textColorMode } = req.body || {};

  const cwd = path.resolve(process.cwd(), '..');
  const node = process.execPath;
  const script = path.join(cwd, 'index.js');
  const reportJsonPath = path.join(cwd, 'generated', 'report.json');

  // Determine if we should use --force flag
  // Use --force if: forceFetch is true OR report.json doesn't exist OR date range overrides are provided
  const shouldForce = forceFetch || !fs.existsSync(reportJsonPath) || from || to;

  const env = Object.assign({}, process.env);
  if (font) env.REPORT_FONT = font;
  if (bg) env.REPORT_BG = bg;
  if (accent) env.REPORT_ACCENT = accent;
  if (footer) env.REPORT_FOOTER_TEXT = footer;
  if (from) env.REPORT_DATE_FROM = from;
  if (to) env.REPORT_DATE_TO = to;
  if (mosaicArtistCount) env.REPORT_MOSAIC_ARTIST_COUNT = String(mosaicArtistCount);
  if (enableMosaic !== undefined) env.REPORT_ENABLE_MOSAIC = String(enableMosaic);
  if (textColorMode) env.REPORT_TEXT_COLOR_MODE = textColorMode;

  const args = [script];
  if (shouldForce) {
    args.push('--force');
  }

  const child = spawn(node, args, { env, cwd: cwd });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  child.on('close', (code) => {
    if (code === 0) {
      res.status(200).json({ ok: true });
    } else {
      res.status(500).json({ ok: false, error: stderr || stdout || `exit ${code}` });
    }
  });
}

