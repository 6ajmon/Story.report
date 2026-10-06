import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { medianCutQuantize, extractBackgroundAndAccent } from '../lib/palette';

// Expanded font catalog (grouped). Values are real Windows/system font names
// passed straight to the generator; Typst falls back to Segoe UI if missing.
//
// The "Google Fonts" group is bundled on disk via `scripts/fetch-fonts.js`
// (npm run fonts) and passed to Typst with --font-path, so these families work
// even on a server that has only a handful of system fonts installed.
const FONT_GROUPS = [
  {
    label: 'Google Fonts (bundled)',
    options: [
      { value: 'Roboto', label: 'Roboto' },
      { value: 'Open Sans', label: 'Open Sans' },
      { value: 'Lato', label: 'Lato' },
      { value: 'Montserrat', label: 'Montserrat' },
      { value: 'Poppins', label: 'Poppins' },
      { value: 'Inter', label: 'Inter' },
      { value: 'Nunito', label: 'Nunito' },
      { value: 'Raleway', label: 'Raleway' },
      { value: 'Work Sans', label: 'Work Sans' },
      { value: 'Playfair Display', label: 'Playfair Display' },
      { value: 'Merriweather', label: 'Merriweather' },
      { value: 'Lora', label: 'Lora' },
      { value: 'Source Serif 4', label: 'Source Serif 4' },
      { value: 'JetBrains Mono', label: 'JetBrains Mono' },
      { value: 'Fira Code', label: 'Fira Code' },
      { value: 'Roboto Mono', label: 'Roboto Mono' },
      { value: 'Source Code Pro', label: 'Source Code Pro' },
      { value: 'IBM Plex Mono', label: 'IBM Plex Mono' },
      { value: 'Bebas Neue', label: 'Bebas Neue' },
      { value: 'Lobster', label: 'Lobster' },
      { value: 'Pacifico', label: 'Pacifico' },
      { value: 'Anton', label: 'Anton' },
    ],
  },
  {
    label: 'Presets',
    options: [
      { value: 'mono', label: 'Mono preset' },
      { value: 'serif', label: 'Serif preset' },
    ],
  },
  {
    label: 'Sans-serif',
    options: [
      { value: 'Segoe UI', label: 'Segoe UI' },
      { value: 'Arial', label: 'Arial' },
      { value: 'Calibri', label: 'Calibri' },
      { value: 'Tahoma', label: 'Tahoma' },
      { value: 'Verdana', label: 'Verdana' },
      { value: 'Trebuchet MS', label: 'Trebuchet MS' },
      { value: 'Franklin Gothic Medium', label: 'Franklin Gothic Medium' },
      { value: 'Franklin Gothic', label: 'Franklin Gothic' },
      { value: 'Century Gothic', label: 'Century Gothic' },
      { value: 'Candara', label: 'Candara' },
      { value: 'Corbel', label: 'Corbel' },
      { value: 'Bahnschrift', label: 'Bahnschrift' },
      { value: 'Segoe UI Light', label: 'Segoe UI Light' },
      { value: 'Segoe UI Semibold', label: 'Segoe UI Semibold' },
      { value: 'Lucida Sans Unicode', label: 'Lucida Sans Unicode' },
      { value: 'Gill Sans MT', label: 'Gill Sans MT' },
      { value: 'Microsoft Sans Serif', label: 'Microsoft Sans Serif' },
    ],
  },
  {
    label: 'Serif',
    options: [
      { value: 'Georgia', label: 'Georgia' },
      { value: 'Times New Roman', label: 'Times New Roman' },
      { value: 'Cambria', label: 'Cambria' },
      { value: 'Garamond', label: 'Garamond' },
      { value: 'Book Antiqua', label: 'Book Antiqua' },
      { value: 'Palatino Linotype', label: 'Palatino Linotype' },
      { value: 'Constantia', label: 'Constantia' },
      { value: 'Rockwell', label: 'Rockwell' },
      { value: 'Goudy Old Style', label: 'Goudy Old Style' },
      { value: 'Bodoni MT', label: 'Bodoni MT' },
      { value: 'Perpetua', label: 'Perpetua' },
      { value: 'Bookman Old Style', label: 'Bookman Old Style' },
    ],
  },
  {
    label: 'Monospace',
    options: [
      { value: 'Consolas', label: 'Consolas' },
      { value: 'Courier New', label: 'Courier New' },
      { value: 'Lucida Console', label: 'Lucida Console' },
      { value: 'DejaVu Sans Mono', label: 'DejaVu Sans Mono' },
      { value: 'Ubuntu Mono', label: 'Ubuntu Mono' },
      { value: 'Cascadia Mono', label: 'Cascadia Mono' },
      { value: 'Cascadia Code', label: 'Cascadia Code' },
    ],
  },
  {
    label: 'Display / Decorative',
    options: [
      { value: 'Segoe Print', label: 'Segoe Print' },
      { value: 'Segoe Script', label: 'Segoe Script' },
      { value: 'Comic Sans MS', label: 'Comic Sans MS' },
      { value: 'Brush Script MT', label: 'Brush Script MT' },
      { value: 'Ink Free', label: 'Ink Free' },
      { value: 'Chiller', label: 'Chiller' },
    ],
  },
];

// CSS fallback stack used only to preview a font in the <select>.
function fontPreviewFamily(fontName) {
  if (fontName === 'mono') return 'Consolas, monospace';
  if (fontName === 'serif') return 'Georgia, serif';
  return `'${fontName}', sans-serif`;
}

// A catalog font is usable if Typst reports it (exact face or family prefix).
function isTypstFontAvailable(fontValue, typstFaces) {
  if (fontValue === 'mono' || fontValue === 'serif') return true;
  const v = fontValue.toLowerCase();
  return typstFaces.some((face) => {
    const f = face.toLowerCase();
    return f === v || f.startsWith(`${v} `);
  });
}

// Preferred default font, in order. Falls back to the first available one so
// the app still looks right on servers without Segoe UI.
const DEFAULT_FONT_PREFERENCE = ['Segoe UI', 'Roboto', 'Open Sans', 'Lato', 'Inter'];

function pickDefaultFont(typstFaces) {
  for (const font of DEFAULT_FONT_PREFERENCE) {
    if (isTypstFontAvailable(font, typstFaces)) return font;
  }
  const firstCatalogFont = FONT_GROUPS.flatMap((g) => g.options).find((opt) =>
    isTypstFontAvailable(opt.value, typstFaces)
  );
  return firstCatalogFont ? firstCatalogFont.value : 'Segoe UI';
}

export default function Home() {
  const [font, setFont] = useState('Segoe UI');
  const [bg, setBg] = useState('#0f0f0f');
  const [accent, setAccent] = useState('#e8d5a3');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [footer, setFooter] = useState('Generated by Story.report');
  const [mosaicArtistCount, setMosaicArtistCount] = useState(8);
  const [enableMosaic, setEnableMosaic] = useState(true);
  const [enableStatistics, setEnableStatistics] = useState(true);
  const [enableTopItems, setEnableTopItems] = useState(true);
  const [enableWordCloud, setEnableWordCloud] = useState(true);
  const [textColorMode, setTextColorMode] = useState('auto');
  // Last.fm credentials (optional — fall back to server-side .env when empty)
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [credState, setCredState] = useState('idle'); // idle | checking | ok | error
  const [credStatus, setCredStatus] = useState('');
  const [typstFaces, setTypstFaces] = useState(null); // null = not checked yet
  const [fontFetching, setFontFetching] = useState(false);
  const [fontFetchStatus, setFontFetchStatus] = useState('');
  const [status, setStatus] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const autoGenerateTimeoutRef = useRef(null);

  // Auto-generate on config changes (debounced)
  useEffect(() => {
    // Clear existing timeout
    if (autoGenerateTimeoutRef.current) {
      clearTimeout(autoGenerateTimeoutRef.current);
    }

    // Set new timeout to generate after user stops typing/changing (500ms debounce)
    autoGenerateTimeoutRef.current = setTimeout(() => {
      generateReport(false);
    }, 500);

    return () => {
      if (autoGenerateTimeoutRef.current) {
        clearTimeout(autoGenerateTimeoutRef.current);
      }
    };
  }, [font, bg, accent, from, to, footer, mosaicArtistCount, enableMosaic, enableStatistics, enableTopItems, enableWordCloud, textColorMode]);

  // Load the list of fonts Typst can render and hide unavailable ones.
  const loadFonts = useCallback(async (refresh = false) => {
    try {
      const resp = await fetch(`/api/fonts${refresh ? '?refresh=1' : ''}`);
      const data = await resp.json();
      const faces = data && data.ok ? data.fonts : null;
      setTypstFaces(faces);
      if (faces) {
        setFont((current) =>
          isTypstFontAvailable(current, faces) ? current : pickDefaultFont(faces)
        );
      }
      return faces;
    } catch {
      setTypstFaces(null);
      return null;
    }
  }, []);

  useEffect(() => {
    loadFonts(false);
  }, [loadFonts]);

  // Download the bundled Google Fonts, then refresh the catalog.
  async function fetchGoogleFonts() {
    if (fontFetching) return;
    setFontFetching(true);
    setFontFetchStatus('⏳ Pobieram czcionki Google...');
    try {
      const resp = await fetch('/api/fetch-fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (data.ok) {
        const faces = await loadFonts(true);
        setFontFetchStatus(`✅ Gotowe — dostępnych czcionek: ${faces ? faces.length : 0}`);
        setTimeout(() => setFontFetchStatus(''), 4000);
      } else {
        setFontFetchStatus('❌ ' + (data.error || 'Nie udało się pobrać czcionek'));
      }
    } catch (err) {
      setFontFetchStatus('❌ ' + err.message);
    } finally {
      setFontFetching(false);
    }
  }

  // Catalog fonts filtered to what Typst can actually render on this machine.
  const visibleFontGroups = useMemo(() => {
    if (!typstFaces) return FONT_GROUPS;
    return FONT_GROUPS.map((group) => ({
      ...group,
      options: group.options.filter((opt) => isTypstFontAvailable(opt.value, typstFaces)),
    })).filter((group) => group.options.length > 0);
  }, [typstFaces]);

  const allCatalogOptions = FONT_GROUPS.flatMap((g) => g.options);
  const availableFontCount = typstFaces
    ? allCatalogOptions.filter((opt) => isTypstFontAvailable(opt.value, typstFaces)).length
    : null;

  async function checkCredentials() {
    const user = username.trim();
    const key = apiKey.trim();
    // Empty fields are allowed — the API falls back to server-side .env values.
    setCredState('checking');
    setCredStatus('⏳ Sprawdzam dane logowania...');
    try {
      const resp = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, apiKey: key }),
      });
      const data = await resp.json();
      if (data.ok) {
        setCredState('ok');
        setCredStatus(
          `✅ Dane poprawne: ${data.user.username} — ${data.user.playcount.toLocaleString('pl-PL')} scrobble'i`
        );
        // Credentials verified — regenerate using them right away.
        generateReport(true);
      } else {
        setCredState('error');
        setCredStatus('❌ ' + (data.error || 'Nieprawidłowe dane logowania'));
      }
    } catch (err) {
      setCredState('error');
      setCredStatus('❌ ' + err.message);
    }
  }

  async function generateReport(forceFetch = false) {
    setStatus(forceFetch ? '⏳ Force fetching...' : '⏳ Generating...');
    setImageUrl(null);
    setIsLoading(true);
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ font, bg, accent, from, to, footer, forceFetch, mosaicArtistCount, enableMosaic, enableStatistics, enableTopItems, enableWordCloud, textColorMode, username: username.trim(), apiKey: apiKey.trim() }),
      });
      const data = await resp.json();
      if (data.ok) {
        setStatus('✅ Done!');
        const version = Date.now();
        setImageVersion(version);
        setImageUrl('/api/report-image?ts=' + version);
        // Clear status after 2 seconds
        setTimeout(() => setStatus(''), 2000);
      } else {
        setStatus('❌ Error: ' + (data.error || 'unknown'));
      }
    } catch (err) {
      setStatus('❌ Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // ---- Color presets from generated images ----

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image for color extraction'));
      img.src = url;
    });
  }

  // Sample the image down to a small grid, run median-cut quantization,
  // and return a { bg, accent } hex pair extracted from the artwork.
  async function extractPaletteFromAsset(file) {
    const url = `/api/report-assets?file=${encodeURIComponent(file)}`;
    const img = await loadImage(url);

    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

    const imageData = ctx.getImageData(0, 0, size, size).data;
    const pixels = [];
    for (let i = 0; i < imageData.length; i += 4) {
      if (imageData[i + 3] < 125) continue; // skip transparent pixels
      pixels.push([imageData[i], imageData[i + 1], imageData[i + 2]]);
    }

    const palette = medianCutQuantize(pixels, 8);
    return extractBackgroundAndAccent(palette);
  }

  async function applyImagePreset(type) {
    const labels = { artist: 'Top Artist', album: 'Top Album', track: 'Top Track' };
    setStatus(`⏳ Extracting colors from ${labels[type] || type} image...`);
    try {
      const resp = await fetch('/api/report-images');
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'No report images available');
      const file = data.images && data.images[type];
      if (!file) throw new Error(`No ${labels[type] || type} image available yet`);

      const { bg: newBg, accent: newAccent } = await extractPaletteFromAsset(file);
      setBg(newBg);
      setAccent(newAccent);
      setStatus(`🎨 ${labels[type] || type} preset applied`);
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus('❌ ' + err.message);
    }
  }

  const containerStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px',
    padding: '24px',
    paddingLeft: 'max(24px, calc((100vw - 1400px) / 2))',
    paddingRight: 'max(24px, calc((100vw - 1400px) / 2))',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    color: '#eee',
    minHeight: '100vh',
    maxWidth: '1400px',
    margin: '0 auto',
  };

  const formContainerStyle = {
    maxWidth: '500px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const labelStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '14px',
    fontWeight: '500',
  };

  const labelTextStyle = {
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontSize: '12px',
  };

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #333',
    background: '#1a1a1a',
    color: '#eee',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const buttonStyle = {
    padding: '10px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#e8d5a3',
    color: '#0a0a0a',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  };

  const buttonSecondaryStyle = {
    ...buttonStyle,
    background: '#333',
    color: '#eee',
  };

  const buttonsContainerStyle = {
    display: 'flex',
    gap: '8px',
    flexDirection: 'column',
  };

  const previewContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'sticky',
    top: '24px',
    maxHeight: 'calc(100vh - 48px)',
  };

  const previewBoxStyle = {
    background: '#1a1a1a',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #333',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minHeight: '400px',
    overflow: 'auto',
  };

  const statusStyle = {
    fontSize: '14px',
    color: status.includes('Error') ? '#ff6b6b' : status.includes('Done') ? '#a8d5ba' : '#ffd700',
    fontWeight: '500',
    minHeight: '20px',
  };

  const credStatusStyle = {
    fontSize: '13px',
    fontWeight: '500',
    minHeight: '18px',
    color: credState === 'error' ? '#ff6b6b' : credState === 'ok' ? '#a8d5ba' : '#ffd700',
  };

  const linkStyle = {
    color: '#e8d5a3',
    fontSize: '12px',
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: '0',
    textDecoration: 'underline',
  };

  const colorInputStyle = {
    ...inputStyle,
    cursor: 'pointer',
    height: '40px',
    padding: '4px',
  };

  const presetButtonStyle = {
    ...buttonSecondaryStyle,
    flex: 1,
    minWidth: '110px',
  };

  return (
    <div style={containerStyle}>
      <div style={formContainerStyle}>
        <h1 style={{ marginTop: 0, marginBottom: '16px', fontSize: '28px', fontWeight: '600' }}>
          📊 Story.report
        </h1>

        <div style={formStyle}>
          {/* Last.fm credentials */}
          <div style={{ borderBottom: '1px solid #333', paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={labelTextStyle}>Last.fm Account</span>

            <label style={labelStyle}>
              <span style={{ ...labelTextStyle, textTransform: 'none', letterSpacing: '0' }}>Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={inputStyle}
                placeholder="np. uzytkownik"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <label style={labelStyle}>
              <span style={{ ...labelTextStyle, textTransform: 'none', letterSpacing: '0' }}>
                API Key{' '}
                <a
                  href="https://www.last.fm/api/account/create"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Zdobądź klucz API ↗
                </a>
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontFamily: showApiKey ? "'Consolas', monospace" : 'inherit' }}
                  placeholder="32-znakowy klucz z last.fm/api"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #333',
                    background: '#2a2a2a',
                    color: '#aaa',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}
                  title={showApiKey ? 'Ukryj klucz' : 'Pokaż klucz'}
                >
                  {showApiKey ? '🙈' : '👁'}
                </button>
              </div>
            </label>

            <button
              type="button"
              onClick={checkCredentials}
              style={buttonStyle}
              disabled={credState === 'checking' || isLoading}
            >
              🔍 Sprawdź i pobierz
            </button>

            {credStatus && <div style={credStatusStyle}>{credStatus}</div>}

            <span style={{ color: '#777', fontSize: '12px', fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>
              Pola są opcjonalne — pozostaw puste, aby użyć danych z pliku <code>.env</code>.
            </span>
          </div>

          {/* Font selection with font preview */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Font</span>
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              style={{
                ...selectStyle,
                fontFamily: fontPreviewFamily(font),
              }}
            >
              {visibleFontGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      style={{ fontFamily: fontPreviewFamily(opt.value) }}
                    >
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {availableFontCount != null && (
              <span style={{ color: '#888', fontSize: '12px', fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>
                {availableFontCount} of {allCatalogOptions.length} fonts are renderable by Typst on this machine
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                type="button"
                onClick={fetchGoogleFonts}
                style={{ ...buttonSecondaryStyle, fontSize: '12px', padding: '6px 10px' }}
                disabled={fontFetching}
                title="Pobiera czcionki Google do katalogu fonts/ (bez instalacji w systemie)"
              >
                {fontFetching ? '⏳ Pobieram...' : '⬇️ Pobierz czcionki Google'}
              </button>
              {fontFetchStatus && (
                <span style={{ color: '#888', fontSize: '12px', fontWeight: '400' }}>{fontFetchStatus}</span>
              )}
            </div>
          </label>

          {/* Background color */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Background Color</span>
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={colorInputStyle} />
          </label>

          {/* Accent color */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Accent Color</span>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={colorInputStyle} />
          </label>

          {/* Color presets extracted from generated images */}
          <div style={{ borderTop: '1px solid #333', paddingTop: '12px', marginTop: '12px' }}>
            <span style={labelTextStyle}>Color Presets from Image</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => applyImagePreset('artist')} style={presetButtonStyle} disabled={isLoading}>
                🎤 Top Artist
              </button>
              <button onClick={() => applyImagePreset('album')} style={presetButtonStyle} disabled={isLoading}>
                💿 Top Album
              </button>
              <button onClick={() => applyImagePreset('track')} style={presetButtonStyle} disabled={isLoading}>
                🎵 Top Track
              </button>
            </div>
          </div>

          {/* Date range */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Date From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Date To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </label>

          {/* Mosaic artist count */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Top Artists Mosaic Count</span>
            <select value={mosaicArtistCount} onChange={(e) => setMosaicArtistCount(parseInt(e.target.value))} style={selectStyle} disabled={!enableMosaic}>
              <option value={5}>5 artists</option>
              <option value={8}>8 artists</option>
            </select>
          </label>

          {/* Module toggles */}
          <div style={{ borderTop: '1px solid #333', paddingTop: '12px', marginTop: '12px' }}>
            <span style={labelTextStyle}>Modules</span>

            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="checkbox"
                checked={enableStatistics}
                onChange={(e) => setEnableStatistics(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ ...labelTextStyle, textTransform: 'none', fontSize: '14px' }}>Statistics (artists, albums, tracks)</span>
            </label>

            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="checkbox"
                checked={enableMosaic}
                onChange={(e) => setEnableMosaic(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ ...labelTextStyle, textTransform: 'none', fontSize: '14px' }}>Top Artists Mosaic</span>
            </label>

            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="checkbox"
                checked={enableTopItems}
                onChange={(e) => setEnableTopItems(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ ...labelTextStyle, textTransform: 'none', fontSize: '14px' }}>Top Items (artist, album, track)</span>
            </label>

            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input
                type="checkbox"
                checked={enableWordCloud}
                onChange={(e) => setEnableWordCloud(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ ...labelTextStyle, textTransform: 'none', fontSize: '14px' }}>Word Cloud (top tags)</span>
            </label>
          </div>

          {/* Text color mode */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Text Color Mode</span>
            <select value={textColorMode} onChange={(e) => setTextColorMode(e.target.value)} style={selectStyle}>
              <option value="auto">Auto (based on background)</option>
              <option value="light">Light (white text)</option>
              <option value="dark">Dark (black text)</option>
            </select>
          </label>

          {/* Footer text with clear option */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Footer Text</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="Leave empty for no footer"
              />
              <button
                onClick={() => setFooter('')}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #333',
                  background: '#2a2a2a',
                  color: '#aaa',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
                title="Clear footer text"
              >
                ✕
              </button>
            </div>
          </label>

          {/* Force Fetch button */}
          <button
            onClick={() => generateReport(true)}
            style={buttonSecondaryStyle}
            disabled={isLoading}
            onMouseOver={(e) => !isLoading && (e.target.style.background = '#404040')}
            onMouseOut={(e) => (e.target.style.background = '#333')}
            title="Force refetch data from Last.fm API"
          >
            🔄 Force Fetch
          </button>

          {/* Status */}
          {status && <div style={statusStyle}>{status}</div>}
        </div>
      </div>

      {/* Preview panel (right side, 50% width) */}
      <div style={previewContainerStyle}>
        <div>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Preview
          </h2>
        </div>
        <div style={previewBoxStyle}>
          {imageUrl ? (
            <img key={imageVersion} src={imageUrl} alt="report" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '6px' }} />
          ) : (
            <span style={{ color: '#555', fontSize: '14px' }}>No preview yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
