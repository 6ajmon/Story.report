const API_BASE_URL = 'https://ws.audioscrobbler.com/2.0';

/**
 * Validates Last.fm credentials coming from the web form.
 *
 * POST body: { username?, apiKey? }
 * If a value is omitted, the server-side .env value is used instead
 * (so the user can check whatever is currently configured).
 *
 * Returns: { ok: true, user: { username, realname, playcount, image } }
 *       or { ok: false, error: '...' }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { username, apiKey } = req.body || {};
  const user = (username || process.env.LASTFM_USERNAME || '').trim();
  const key = (apiKey || process.env.LASTFM_API_KEY || '').trim();

  if (!user || !key) {
    res.status(400).json({
      ok: false,
      error: 'Both username and API key are required.',
    });
    return;
  }

  const url =
    `${API_BASE_URL}/?method=user.getInfo` +
    `&user=${encodeURIComponent(user)}` +
    `&api_key=${encodeURIComponent(key)}` +
    `&format=json`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));

    // Last.fm returns HTTP 200 with an `error` field on failure.
    if (data && data.error) {
      res.status(200).json({
        ok: false,
        error: `${data.message || 'Last.fm API error'} (code ${data.error})`,
      });
      return;
    }

    const info = (data && data.user) || {};
    res.status(200).json({
      ok: true,
      user: {
        username: info.name || user,
        realname: info.realname || '',
        playcount: parseInt(info.playcount, 10) || 0,
        country: info.country || '',
      },
    });
  } catch (error) {
    const aborted = error.name === 'AbortError';
    res.status(200).json({
      ok: false,
      error: aborted
        ? 'Last.fm API request timed out.'
        : error.message || 'Could not reach Last.fm API.',
    });
  }
}
