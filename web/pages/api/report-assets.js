import fs from 'fs';
import path from 'path';

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export default function handler(req, res) {
  const file = req.query.file;
  if (!file) {
    res.status(400).json({ ok: false, error: 'Missing file parameter' });
    return;
  }

  const assetsDir = path.resolve(process.cwd(), '..', 'generated', 'assets');
  // Only allow the file basename (prevents directory traversal)
  const safeName = path.basename(file);
  const filePath = path.join(assetsDir, safeName);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ ok: false, error: 'Asset not found' });
    return;
  }

  const ext = path.extname(safeName).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).end('Read error');
    } else {
      res.end();
    }
  });
  stream.pipe(res);
}
