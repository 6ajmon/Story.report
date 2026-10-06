import { spawn } from 'child_process';
import path from 'path';

/**
 * Triggers a download of the bundled Google Fonts (see scripts/fetch-fonts.js)
 * so users can populate the font catalog on servers/containers that only ship a
 * couple of system fonts.
 *
 * POST body: { force?: boolean }  — force re-downloads every font.
 * Returns:   { ok: true, output } or { ok: false, error }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { force } = req.body || {};
  const cwd = path.resolve(process.cwd(), '..');
  const node = process.execPath;
  const script = path.join(cwd, 'scripts', 'fetch-fonts.js');

  const args = [script];
  if (force) {
    args.push('--force');
  }

  const child = spawn(node, args, { cwd });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  child.on('error', (error) => {
    res.status(500).json({ ok: false, error: error.message });
  });

  child.on('close', (code) => {
    if (code === 0) {
      res.status(200).json({ ok: true, output: stdout.trim() });
    } else {
      res.status(500).json({ ok: false, error: (stderr || stdout || `exit ${code}`).trim() });
    }
  });
}
