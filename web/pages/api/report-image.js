import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const root = path.resolve(process.cwd(), '..');
  const imagePath = path.join(root, 'generated', 'report.png');

  if (!fs.existsSync(imagePath)) {
    res.status(404).json({ ok: false, error: 'report.png not found' });
    return;
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const stream = fs.createReadStream(imagePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).end('Read error');
    } else {
      res.end();
    }
  });
  stream.pipe(res);
}