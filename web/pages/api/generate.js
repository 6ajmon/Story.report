import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// The generator always writes to the same generated/report.png and
// generated/report.typ. Overlapping runs would race, and the slower (older) one
// could overwrite the output of a newer one, so runs are serialized and only the
// most recent queued request is kept.
let running = false;
let pendingJob = null;

function runGenerator(cwd, env, force) {
  return new Promise((resolve) => {
    const args = [path.join(cwd, 'index.js')];
    if (force) args.push('--force');

    const child = spawn(process.execPath, args, { env, cwd });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      resolve(
        code === 0
          ? { status: 200, body: { ok: true } }
          : { status: 500, body: { ok: false, error: stderr || stdout || `exit ${code}` } }
      );
    });
  });
}

async function drainQueue() {
  if (running) return;
  running = true;
  try {
    while (pendingJob) {
      const job = pendingJob;
      pendingJob = null;
      const result = await runGenerator(job.cwd, job.env, job.force);
      job.resolve(result);
    }
  } finally {
    running = false;
  }
}

function enqueue(job) {
  return new Promise((resolve) => {
    if (pendingJob) {
      // Superseded before it started — the newer request produces the output.
      pendingJob.resolve({ status: 200, body: { ok: true, superseded: true } });
    }
    pendingJob = { ...job, resolve };
    drainQueue();
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { font, fontSecondary, bg, accent, from, to, footer, forceFetch, mosaicArtistCount, enableMosaic, enableStatistics, enableTopItems, enableWordCloud, textColorMode, username, apiKey } = req.body || {};

  const cwd = path.resolve(process.cwd(), '..');
  const reportJsonPath = path.join(cwd, 'generated', 'report.json');

  // Determine if we should use --force flag
  // Use --force if: forceFetch is true OR report.json doesn't exist OR date range overrides are provided
  const shouldForce = forceFetch || !fs.existsSync(reportJsonPath) || from || to;

  const env = Object.assign({}, process.env);
  if (font) env.REPORT_FONT = font;
  if (fontSecondary) env.REPORT_FONT_SECONDARY = fontSecondary;
  if (bg) env.REPORT_BG = bg;
  if (accent) env.REPORT_ACCENT = accent;
  if (footer) env.REPORT_FOOTER_TEXT = footer;
  if (from) env.REPORT_DATE_FROM = from;
  if (to) env.REPORT_DATE_TO = to;
  if (mosaicArtistCount) env.REPORT_MOSAIC_ARTIST_COUNT = String(mosaicArtistCount);
  if (enableMosaic !== undefined) env.REPORT_ENABLE_MOSAIC = String(enableMosaic);
  if (enableStatistics !== undefined) env.REPORT_ENABLE_STATISTICS = String(enableStatistics);
  if (enableTopItems !== undefined) env.REPORT_ENABLE_TOP_ITEMS = String(enableTopItems);
  if (enableWordCloud !== undefined) env.REPORT_ENABLE_WORDCLOUD = String(enableWordCloud);
  if (textColorMode) env.REPORT_TEXT_COLOR_MODE = textColorMode;
  // Optional per-run Last.fm credentials coming from the web form.
  if (username) env.REPORT_LASTFM_USERNAME = username;
  if (apiKey) env.REPORT_LASTFM_API_KEY = apiKey;

  const result = await enqueue({ cwd, env, force: shouldForce });
  res.status(result.status).json(result.body);
}


