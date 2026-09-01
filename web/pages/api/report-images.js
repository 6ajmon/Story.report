import fs from 'fs';
import path from 'path';

/**
 * Returns the filenames of the currently generated top-artist / top-album /
 * top-track images (read from the cached report.json). The UI uses these to
 * build "/api/report-assets?file=..." URLs for color extraction.
 */
export default function handler(req, res) {
  const cwd = path.resolve(process.cwd(), '..');
  const reportJsonPath = path.join(cwd, 'generated', 'report.json');

  if (!fs.existsSync(reportJsonPath)) {
    res.status(200).json({
      ok: false,
      error: 'No report generated yet. Generate the report first.',
    });
    return;
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportJsonPath, 'utf-8'));
  } catch {
    res.status(200).json({ ok: false, error: 'Could not read report.json' });
    return;
  }

  const images = report.images || {};
  const result = {};
  if (images.artistImagePath) result.artist = path.basename(images.artistImagePath);
  if (images.albumImagePath) result.album = path.basename(images.albumImagePath);
  if (images.trackImagePath) result.track = path.basename(images.trackImagePath);

  res.status(200).json({ ok: true, images: result });
}
