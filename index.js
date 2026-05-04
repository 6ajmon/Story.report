import axios from 'axios';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { config } from './config.js';

// Load environment variables
dotenv.config();

const API_KEY = process.env.LASTFM_API_KEY;
const USERNAME = process.env.LASTFM_USERNAME;
const API_BASE_URL = 'https://ws.audioscrobbler.com/2.0';
const GENERATED_DIR = path.join(process.cwd(), 'generated');
const GENERATED_ASSETS_DIR = path.join(GENERATED_DIR, 'assets');
const GENERATED_JSON_FILE = path.join(GENERATED_DIR, 'report.json');

// CLI flags
const FORCE_FETCH = process.argv.includes('--force');

// Environment overrides (used by the UI server)
const REPORT_OVERRIDES = {
  font: process.env.REPORT_FONT || null,
  bg: process.env.REPORT_BG || null,
  accent: process.env.REPORT_ACCENT || null,
  footerText: process.env.REPORT_FOOTER_TEXT || null,
  dateFrom: process.env.REPORT_DATE_FROM || null,
  dateTo: process.env.REPORT_DATE_TO || null,
  mosaicArtistCount: parseInt(process.env.REPORT_MOSAIC_ARTIST_COUNT || '8', 10),  enableMosaic: process.env.REPORT_ENABLE_MOSAIC !== 'false',
  enableStatistics: process.env.REPORT_ENABLE_STATISTICS !== 'false',
  enableTopItems: process.env.REPORT_ENABLE_TOP_ITEMS !== 'false',
  enableWordCloud: process.env.REPORT_ENABLE_WORDCLOUD !== 'false',
  textColorMode: process.env.REPORT_TEXT_COLOR_MODE || 'auto',
};

function ensureGeneratedDirectories() {
  fs.mkdirSync(GENERATED_ASSETS_DIR, { recursive: true });
}

function writeJsonReport(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function loadCachedReport() {
  if (fs.existsSync(GENERATED_JSON_FILE)) {
    console.log(`📂 Loading cached report from ${GENERATED_JSON_FILE}...`);
    const raw = fs.readFileSync(GENERATED_JSON_FILE, 'utf-8');
    return JSON.parse(raw);
  }
  return null;
}

/**
 * Fetch user info including total scrobbles and avatar
 */
async function fetchUserInfo() {
  // Validate environment variables only when hitting the API
  if (!API_KEY || !USERNAME) {
    console.error('❌ Error: Missing environment variables.');
    console.error('Please set LASTFM_API_KEY and LASTFM_USERNAME in .env file');
    process.exit(1);
  }

  try {
    console.log('📊 Fetching user info...');
    const response = await axios.get(API_BASE_URL, {
      params: {
        method: 'user.getInfo',
        user: USERNAME,
        api_key: API_KEY,
        format: 'json',
      },
    });

    if (response.data.error) {
      throw new Error(`Last.fm API Error: ${response.data.message}`);
    }

    const user = response.data.user;

    return {
      username: user.name,
      totalScrobbles: parseInt(user.playcount) || 0,
      realname: user.realname || user.name,
      country: user.country || '',
    };
  } catch (error) {
    console.error('❌ Error fetching user info:', error.message);
    throw error;
  }
}

function normalizeArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

// Calculate luminance of a hex color (0-1, where 1 is brightest)
function getColorLuminance(hexColor) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  // Standard luminance formula
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Get appropriate text color based on background luminance
function getTextColor(bgColor, textColorMode = 'auto') {
  if (textColorMode === 'light') return 'ffffff';
  if (textColorMode === 'dark') return '000000';
  
  // Auto mode: use luminance to decide
  const luminance = getColorLuminance(bgColor);
  return luminance > 0.5 ? '000000' : 'ffffff';
}

function getDateRange() {
  // Check for custom date overrides
  const customFrom = REPORT_OVERRIDES.dateFrom;
  const customTo = REPORT_OVERRIDES.dateTo;

  let start, end;

  if (customFrom && customTo) {
    // Parse ISO date format (YYYY-MM-DD) and create Date objects
    start = new Date(`${customFrom}T00:00:00Z`);
    end = new Date(`${customTo}T23:59:59Z`);
  } else {
    // Use previous calendar month (default behavior)
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return {
    from: Math.floor(start.getTime() / 1000),
    to: Math.floor(end.getTime() / 1000),
    label: `${formatter.format(start)} - ${formatter.format(end)}`,
  };
}

function extractImageUrls(imageField) {
  return normalizeArray(imageField)
    .map((entry) => entry?.['#text'] || '')
    .filter(Boolean)
    .reverse();
}

function pickTopEntries(countMap, limit, mapEntry) {
  return [...countMap.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key, playcount], index) => mapEntry(key, playcount, index + 1));
}

async function fetchRecentTracksInRange(fromTimestamp, toTimestamp) {
  console.log('📅 Fetching tracks for previous month...');

  const allTracks = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await axios.get(API_BASE_URL, {
      params: {
        method: 'user.getRecentTracks',
        user: USERNAME,
        from: fromTimestamp,
        to: toTimestamp,
        limit: 200,
        page,
        api_key: API_KEY,
        format: 'json',
      },
    });

    if (response.data.error) {
      throw new Error(`Last.fm API Error: ${response.data.message}`);
    }

    const recenttracks = response.data.recenttracks;
    const tracks = normalizeArray(recenttracks?.track).filter((track) => track?.date?.uts);

    allTracks.push(...tracks);
    totalPages = parseInt(recenttracks?.['@attr']?.totalPages, 10) || 1;
    page += 1;
  }

  return allTracks;
}

function aggregateListeningData(tracks) {
  const artistCounts = new Map();
  const albumCounts = new Map();
  const trackCounts = new Map();
  const trackAlbumCounts = new Map();
  const uniqueArtists = new Set();
  const uniqueAlbums = new Set();
  const uniqueTracks = new Set();

  for (const track of tracks) {
    const artistName = track?.artist?.['#text'] || track?.artist?.name || '';
    const albumName = track?.album?.['#text'] || track?.album?.name || '';
    const trackName = track?.name || '';

    if (artistName) {
      uniqueArtists.add(artistName);
      artistCounts.set(artistName, (artistCounts.get(artistName) || 0) + 1);
    }

    if (artistName && albumName) {
      const albumKey = `${artistName} — ${albumName}`;
      uniqueAlbums.add(albumKey);
      albumCounts.set(albumKey, (albumCounts.get(albumKey) || 0) + 1);
    }

    if (artistName && trackName) {
      const trackKey = `${artistName} — ${trackName}`;
      uniqueTracks.add(trackKey);
      trackCounts.set(trackKey, (trackCounts.get(trackKey) || 0) + 1);

      if (albumName) {
        const trackAlbumKey = `${trackKey}|||${albumName}`;
        trackAlbumCounts.set(trackAlbumKey, (trackAlbumCounts.get(trackAlbumKey) || 0) + 1);
      }
    }
  }

  const topTrack = pickTopEntries(trackCounts, 1, (key, playcount) => {
    const [artist, name] = key.split(' — ');
    return { artist, name, playcount };
  })[0] || null;

  let topTrackAlbumName = null;
  if (topTrack) {
    const topTrackKey = `${topTrack.artist} — ${topTrack.name}`;
    topTrackAlbumName = [...trackAlbumCounts.entries()]
      .filter(([key]) => key.startsWith(`${topTrackKey}|||`))
      .sort((left, right) => right[1] - left[1])[0]?.[0]
      ?.split('|||')[1] || null;
  }

  return {
    monthlyScrobbles: tracks.length,
    uniqueArtists: uniqueArtists.size,
    uniqueAlbums: uniqueAlbums.size,
    uniqueTracks: uniqueTracks.size,
    topArtists: pickTopEntries(artistCounts, 8, (name, playcount, rank) => ({ rank, name, playcount })),
    topAlbum: pickTopEntries(albumCounts, 1, (key, playcount) => {
      const [artist, name] = key.split(' — ');
      return { artist, name, playcount };
    })[0] || null,
    topTrack,
    topTrackAlbumName,
  };
}

function extractTrackImageUrls(trackInfo) {
  return [
    ...extractImageUrls(trackInfo?.album?.image),
    ...extractImageUrls(trackInfo?.image),
  ];
}

function escapeTypstString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatTypstFontList(fontNames) {
  const uniqueFontNames = [...new Set(fontNames.filter(Boolean))];
  return `(${uniqueFontNames.map((fontName) => `"${escapeTypstString(fontName)}"`).join(', ')})`;
}

function resolveTypstFontSpec(requestedFont, monoFont) {
  const fontName = (requestedFont || '').trim();
  const normalized = fontName.toLowerCase();

  if (!fontName || normalized === 'default' || normalized === 'sans' || normalized === 'system') {
    return `"${escapeTypstString('Segoe UI')}"`;
  }

  if (normalized === 'mono' || normalized === 'monospace') {
    return formatTypstFontList([
      monoFont || 'Consolas',
      'Cascadia Mono',
      'Courier New',
      'DejaVu Sans Mono',
      'JetBrains Mono',
    ]);
  }

  if (normalized === 'serif') {
    return formatTypstFontList(['Georgia', 'Times New Roman', 'Noto Serif']);
  }

  if (fontName.includes(',')) {
    return formatTypstFontList(fontName.split(',').map((part) => part.trim()));
  }

  return `"${escapeTypstString(fontName)}"`;
}

async function fetchEntityInfo(entityType, entityData) {
  const endpointMap = {
    artist: 'artist.getInfo',
    album: 'album.getInfo',
    track: 'track.getInfo',
  };

  const params = {
    method: endpointMap[entityType],
    user: USERNAME,
    api_key: API_KEY,
    format: 'json',
  };

  if (entityType === 'artist') {
    params.artist = entityData.name;
  } else if (entityType === 'album') {
    params.artist = entityData.artist;
    params.album = entityData.name;
  } else if (entityType === 'track') {
    params.artist = entityData.artist;
    params.track = entityData.name;
  }

  const response = await axios.get(API_BASE_URL, { params });

  if (response.data.error) {
    throw new Error(`Last.fm API Error: ${response.data.message}`);
  }

  return response.data[entityType] || null;
}

async function fetchTopTagsFromArtists(artists, limit = 50) {
  try {
    const tagCounts = new Map();

    const responses = await Promise.all(
      artists.slice(0, 50).map(async (artist) => {
        const response = await axios.get(API_BASE_URL, {
          params: {
            method: 'artist.getTopTags',
            artist: artist.name,
            api_key: API_KEY,
            format: 'json',
          },
        });

        return { artist, data: response.data };
      })
    );

    for (const { artist, data } of responses) {
      const tags = normalizeArray(data?.toptags?.tag);
      for (const tag of tags.slice(0, 50)) {
        const tagName = tag?.name;
        if (!tagName) {
          continue;
        }

        tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + (artist.playcount || 0));
      }
    }

    return [...tagCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ name: tag, count }));
  } catch (error) {
    console.warn(`⚠️  Could not derive fallback tags: ${error.message}`);
    return [];
  }
}

async function downloadImage(urls, baseFilename) {
  for (const candidateUrl of normalizeArray(urls).filter(Boolean)) {
    try {
      const response = await axios.get(candidateUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');

      let extension = '.jpg';
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        extension = '.png';
      } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        extension = '.gif';
      } else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        extension = '.jpg';
      }

      const filename = `${baseFilename}${extension}`;
      const filepath = path.join(GENERATED_ASSETS_DIR, filename);
      fs.writeFileSync(filepath, buffer);
      return `assets/${filename}`;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Format duration (minutes to days/hours with full words)
 */
function formatDuration(minutes) {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;

  const parts = [];
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (mins > 0 && days === 0) {
    parts.push(`${mins} ${mins === 1 ? 'minute' : 'minutes'}`);
  }

  return parts.join(', ') || '0 minutes';
}

/**
 * Generate a word-cloud using primaviz
 * Expects tagsWithCounts: Array<{ name: string, count: number }>
 * accentColor: hex color string (e.g., '#e8d5a3')
 * bgColor: hex background color string (e.g., '#0f0f0f')
 */
function generateTagCloud(tagsWithCounts, maxTags = 20, accentColor = '#e8d5a3', bgColor = '#0f0f0f') {
  if (!tagsWithCounts || tagsWithCounts.length === 0) {
    return '#text(size: 20pt)[No tags found]';
  }

  // Calculate luminance to determine if background is light or dark
  const bgHex = bgColor.replace('#', '');
  const r = parseInt(bgHex.substr(0, 2), 16);
  const g = parseInt(bgHex.substr(2, 2), 16);
  const b = parseInt(bgHex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const isDarkBg = luminance < 0.5;

  const topTags = tagsWithCounts.slice(0, maxTags);

  const wordEntries = topTags
    .map(({ name, count }) => `(text: "${name.replace(/"/g, '')}", weight: ${count})`)
    .join(',\n    ');

  // Generate palette based on accent color with varying opacity/lightness
  const generateAccentPalette = (count) => {
    const safeCount = Math.min(Math.max(count, 1), maxTags);
    const accentHex = accentColor.replace('#', '');
    const accentR = parseInt(accentHex.substr(0, 2), 16);
    const accentG = parseInt(accentHex.substr(2, 2), 16);
    const accentB = parseInt(accentHex.substr(4, 2), 16);

    // Get text color based on background brightness
    const textColor = isDarkBg ? '#ffffff' : '#000000';

    if (safeCount === 1) {
      return [{ accentColor, textColor }];
    }

    return Array.from({ length: safeCount }, (_, i) => {
      const t = i / (safeCount - 1);
      // Create variations of accent color by blending with black or white
      const blendFactor = 0.3 + (0.7 * (1 - t)); // 30% to 100% of original color intensity
      
      const r = Math.round(accentR * blendFactor);
      const g = Math.round(accentG * blendFactor);
      const b = Math.round(accentB * blendFactor);
      
      const hex = [r, g, b]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
      
      return { accentColor: `#${hex}`, textColor };
    });
  };

  const paletteWithText = generateAccentPalette(topTags.length);
  const paletteEntries = paletteWithText
    .map(({ accentColor }) => `rgb("${accentColor}")`)
    .join(',\n        ');
  
  // Use text color from first entry (all are same for light/dark bg)
  const textColorForCloud = paletteWithText[0]?.textColor || '#ffffff';

  return `#word-cloud(
    (words: (
      ${wordEntries}
    )),
    height: auto,
    width: 100%,
    min-size: 24pt,
    max-size: 72pt,
    theme: (
      palette: (
        ${paletteEntries}
      ),
      text-color: rgb("${textColorForCloud}"),
    ),
  )`;
}

/**
 * Generate mosaic layout for top artists
 * Returns Typst grid code
 */
function generateArtistMosaic(topArtistsImages, mosaicCount, colors) {
  if (!topArtistsImages || topArtistsImages.length === 0) {
    return '';
  }

  const artists = topArtistsImages.slice(0, mosaicCount);
  if (artists.length === 0) {
    return '';
  }

  // Determine grid layout dynamically
  let cols, rows;
  cols = 4;
  rows = 2;

  const cellSize = '1fr';
  const columnDef = Array(cols).fill(cellSize).join(', ');

  let mosaicElements = '';
  for (const artist of artists) {
    if (artist.imagePath) {
      mosaicElements += `
        [#box(
          width: 100%,
          height: auto,
          clip: false,
        )[ #image("${artist.imagePath}", width: 100%, fit: "contain") ]],`;
    } else {
      mosaicElements += `
  [#box(width: 100%, height: 100%, fill: rgb("${colors.secondary}"), stroke: 1pt + rgb("${colors.secondary}"))],`;
    }
  }

  // Add empty cells if needed to fill grid
  const totalCells = cols * rows;
  for (let i = artists.length; i < totalCells; i++) {
    mosaicElements += `
  [],`;
  }

  return `#grid(
  columns: (${columnDef}),
  column-gutter: 8pt,
  row-gutter: 8pt,
  ${mosaicElements}
)`;
}
function generateTypstTemplate(data) {
  console.log('🎨 Generating Story.report Typst template...');

  const {
    username,
    monthlyScrobbles,
    uniqueTracks,
    uniqueArtists,
    uniqueAlbums,
    topArtist,
    topAlbum,
    topTrack,
    topTags,
    topArtistsImages,
    dateRange,
    artistImagePath,
    albumImagePath,
    trackImagePath,
    footerText,
  } = data;

  // Estimate listening time (assuming avg 3.5 min per track)
  const listeningMinutes = monthlyScrobbles * 3.5;
  const listeningTime = formatDuration(Math.round(listeningMinutes));

  // Use config for margins, fonts, icons and colors
  const { page, typography, icons } = config;
  let { colors } = config;
  const font = resolveTypstFontSpec(typography.font, typography.monoFont);

  // Calculate adaptive text color based on background luminance
  const bgColorHex = REPORT_OVERRIDES.bg || config.colors.background || '#0f0f0f';
  const textColor = getTextColor(bgColorHex, REPORT_OVERRIDES.textColorMode);
  colors = {
    ...colors,
    text: textColor,
    textMuted: textColor,
    background: bgColorHex,
    secondary: REPORT_OVERRIDES.accent || config.colors.secondary || '#e8d5a3',
  };

  // Build image elements - use relative paths directly
  let artistImageElement = '';
  if (artistImagePath) {
    artistImageElement = `image("${artistImagePath}", width: 144pt),`;
  }

  let albumImageElement = '';
  if (albumImagePath) {
    albumImageElement = `image("${albumImagePath}", width: 144pt),`;
  }

  let trackImageElement = '';
  if (trackImagePath) {
    trackImageElement = `image("${trackImagePath}", width: 144pt),`;
  }

  // avatar support removed

  // Generate tag cloud (primaviz) with accent color
  const accentColorHex = REPORT_OVERRIDES.accent || config.colors.secondary || '#e8d5a3';
  const tagCloud = generateTagCloud(topTags, 20, accentColorHex, bgColorHex);

  // Generate artist mosaic (only if enabled)
  let artistMosaic = '';
  if (REPORT_OVERRIDES.enableMosaic) {
    const mosaicCount = REPORT_OVERRIDES.mosaicArtistCount || 8;
    artistMosaic = generateArtistMosaic(topArtistsImages, mosaicCount, colors);
  }

  // Process footer text - preserve empty/null values
  let footerTextSafe = null;
  if (footerText && typeof footerText === 'string' && footerText.trim()) {
    footerTextSafe = footerText.replace(/"/g, '\\"');
  }

  const template = `#import "@preview/primaviz:0.6.0": word-cloud
#import "@preview/fontawesome:0.6.0": *

#set page(
  width: ${page.width},
  height: ${page.height},
  margin: (
    top: ${page.margin.top},
    bottom: ${page.margin.bottom},
    left: ${page.margin.left},
    right: ${page.margin.right},
  ),
  fill: rgb("${colors.background}"),
)
#set text(font: ${font}, fill: rgb("${colors.text}"))

// Header: Username and date range
#align(right)[
  #text(size: 32pt, fill: rgb("${colors.textMuted}"))[
    ${username}, ${dateRange}
  ]
]

#v(-70pt)

// Main stat: Monthly scrobbles
#text(size: 108pt, weight: "bold")[
  ${monthlyScrobbles} 
  #h(-20pt) 
  #text(size: 42pt, weight: "regular", fill: rgb("${colors.textMuted}"))[scrobbles]
]

#v(-80pt)

#text(size: 42pt, fill: rgb("${colors.secondary}"))[
  ${listeningTime}
]

#v(20pt)

// Statistics: artists, albums, tracks count
${REPORT_OVERRIDES.enableStatistics ? `
#grid(
  columns: (1fr, 1fr, 1fr),
  column-gutter: 24pt,
  align: (left + horizon, left + horizon, left + horizon),

  [
    #text(size: 32pt, weight: "bold", fill: rgb("${colors.secondary}"))[#fa-star(solid: true)]
    #v(0pt)
    #text(size: 32pt, fill: rgb("${colors.secondary}"))[${uniqueArtists} artists]
  ],

  [
    #text(size: 32pt, weight: "bold", fill: rgb("${colors.secondary}"))[#fa-compact-disc()]
    #v(0pt)
    #text(size: 32pt, fill: rgb("${colors.secondary}"))[${uniqueAlbums} albums]
  ],

  [
    #text(size: 32pt, weight: "bold", fill: rgb("${colors.secondary}"))[#fa-music()]
    #v(0pt)
    #text(size: 32pt, fill: rgb("${colors.secondary}"))[${uniqueTracks} tracks]
  ],
)

#v(15pt)
` : ''}

#line(length: 100%, stroke: 1pt + rgb("${colors.secondary}"))

#v(15pt)

// Top artists mosaic (with max height constraint to 1/4 of page)
${REPORT_OVERRIDES.enableMosaic ? `
#box(width: 100%, height: auto, clip: false)[
  ${artistMosaic}
]

#v(40pt)
` : ''}

// Top items: artist, album, track
${REPORT_OVERRIDES.enableTopItems ? `
#grid(
  columns: (166pt, 1fr, 160pt),
  column-gutter: 24pt,
  row-gutter: 28pt,
  align: (left + horizon, left + horizon, center + horizon),

  // Top artist
  text(size: 28pt, weight: "bold", fill: rgb("${colors.textMuted}"))[Top artist],
  [
    #text(size: 36pt, weight: "bold")[${topArtist.name}]
    #v(0pt)
    #text(size: 29pt, fill: rgb("${colors.secondary}"))[${topArtist.playcount} scrobbles]
  ],
  ${artistImageElement}

  // Top album
  text(size: 28pt, weight: "bold", fill: rgb("${colors.textMuted}"))[Top album],
  [
    #text(size: 36pt, weight: "bold")[${topAlbum.name}]
    #v(0pt)
    #text(size: 29pt, fill: rgb("${colors.secondary}"))[${topAlbum.artist} · ${topAlbum.playcount} scrobbles]
  ],
  ${albumImageElement}

  // Top track
  text(size: 28pt, weight: "bold", fill: rgb("${colors.textMuted}"))[Top track],
  [
    #text(size: 36pt, weight: "bold")[${topTrack.name}]
    #v(0pt)
    #text(size: 29pt, fill: rgb("${colors.secondary}"))[${topTrack.artist} · ${topTrack.playcount} scrobbles]
  ],
  ${trackImageElement}
)

#v(28pt)
` : ''}

// Top tags (word cloud)
${REPORT_OVERRIDES.enableWordCloud ? `
#text(size: 28pt, weight: "bold", fill: rgb("${colors.textMuted}"))[
  Top tags
]

#v(-40pt)

${tagCloud}

#v(1fr)
` : `#v(1fr)`}

// Footer
${footerTextSafe ? `#align(center)[
  #text(size: 20pt, fill: rgb("${colors.textMuted}"))[ 
    ${footerTextSafe}
  ]
]` : ''}

`;

  return template;
}

/**
 * Compile Typst template to PNG
 */
async function compileTypstToPng(typstFilePath, outputImagePath) {
  try {
    console.log('🔨 Compiling Typst to PNG...');

    // Check if typst CLI is available
    try {
      execSync('typst --version', { stdio: 'pipe' });
    } catch {
      console.error(
        '❌ Error: typst CLI not found. Please install Typst from https://github.com/typst/typst/releases'
      );
      console.error('   or install via your package manager (brew, choco, apt, etc.)');
      process.exit(1);
    }

    // Compile Typst to PNG (export only page 1 for Instagram Story)
    execSync(`typst compile --pages 1 "${typstFilePath}" "${outputImagePath}"`, {
      stdio: 'inherit',
    });

    console.log(`✅ PNG image generated: ${outputImagePath}`);
  } catch (error) {
    console.error('❌ Error compiling Typst:', error.message);
    throw error;
  }
}

/**
 * Fetch all data from Last.fm API and save to JSON cache
 */
async function fetchAndCacheReport() {
  const userInfo = await fetchUserInfo();
  const monthRange = getDateRange();
  const recentTracks = await fetchRecentTracksInRange(monthRange.from, monthRange.to);

  if (!recentTracks.length) {
    throw new Error('No scrobbles found for the previous month');
  }

  const listeningData = aggregateListeningData(recentTracks);
  const topArtist = listeningData.topArtists[0];

  if (!topArtist || !listeningData.topAlbum || !listeningData.topTrack) {
    throw new Error('No top listening data available for the previous month');
  }

  const topTags = await fetchTopTagsFromArtists(listeningData.topArtists, 50);

  console.log('🖼️  Downloading images...');
  const [artistInfo, albumInfo, trackInfo, topTrackArtistInfo, topTrackAlbumInfo] = await Promise.all([
    fetchEntityInfo('artist', topArtist).catch(() => null),
    fetchEntityInfo('album', listeningData.topAlbum).catch(() => null),
    fetchEntityInfo('track', listeningData.topTrack).catch(() => null),
    fetchEntityInfo('artist', { name: listeningData.topTrack.artist }).catch(() => null),
    listeningData.topTrackAlbumName
      ? fetchEntityInfo('album', {
          artist: listeningData.topTrack.artist,
          name: listeningData.topTrackAlbumName,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const artistImagePath = await downloadImage(
    [
      ...extractImageUrls(artistInfo?.image),
      ...extractImageUrls(albumInfo?.image),
      ...extractImageUrls(trackInfo?.image),
    ],
    'artist'
  );

  const albumImagePath = await downloadImage(
    [
      ...extractImageUrls(albumInfo?.image),
      ...extractImageUrls(artistInfo?.image),
      ...extractImageUrls(trackInfo?.image),
    ],
    'album'
  );

  const trackImagePath = await downloadImage(
    [
      ...extractTrackImageUrls(trackInfo),
      ...extractImageUrls(topTrackAlbumInfo?.image),
      ...extractImageUrls(topTrackArtistInfo?.image),
      ...extractImageUrls(artistInfo?.image),
    ],
    'track'
  );

  // Fetch top artists images for mosaic
  const topArtistsImages = [];
  const topArtistsData = await Promise.all(
    listeningData.topArtists.slice(0, REPORT_OVERRIDES.mosaicArtistCount).map(async (artist, index) => {
      const info = await fetchEntityInfo('artist', artist).catch(() => null);
      const imagePath = await downloadImage(extractImageUrls(info?.image), `artist-mosaic-${index}`);
      return { artist, info, index, imagePath };
    })
  );

  for (const { artist, info, index } of topArtistsData) {
    const imagePath = await downloadImage(
      extractImageUrls(info?.image),
      `artist-mosaic-${index}`
    );
    topArtistsImages.push({
      artist: artist.name,
      playcount: artist.playcount,
      imagePath,
    });
  }

  const jsonReport = {
    generatedAt: new Date().toISOString(),
    monthRange: monthRange,
    userInfo: userInfo,
    recentTracks: recentTracks,
    listeningData: listeningData,
    topTags: topTags,
    topArtistsImages: topArtistsImages,
    images: {
      artistImagePath: artistImagePath,
      albumImagePath: albumImagePath,
      trackImagePath: trackImagePath,
    },
    apiPayload: {
      artistInfo: artistInfo,
      albumInfo: albumInfo,
      trackInfo: trackInfo,
      topTrackArtistInfo: topTrackArtistInfo,
      topTrackAlbumInfo: topTrackAlbumInfo,
    },
  };

  writeJsonReport(GENERATED_JSON_FILE, jsonReport);
  console.log(`✅ JSON report saved: ${GENERATED_JSON_FILE}`);

  return jsonReport;
}

/**
 * Build template data from a cached (or freshly fetched) JSON report
 */
function buildTemplateData(jsonReport) {
  const { userInfo, listeningData, topTags, topArtistsImages, images, monthRange } = jsonReport;
  const topArtist = listeningData.topArtists[0];

  return {
    username: userInfo.username,
    monthlyScrobbles: listeningData.monthlyScrobbles,
    uniqueTracks: listeningData.uniqueTracks,
    uniqueArtists: listeningData.uniqueArtists,
    uniqueAlbums: listeningData.uniqueAlbums,
    topArtist: topArtist,
    topAlbum: listeningData.topAlbum,
    topTrack: listeningData.topTrack,
    topTags: topTags,
    topArtistsImages: topArtistsImages,
    dateRange: monthRange.label,
    artistImagePath: images.artistImagePath,
    albumImagePath: images.albumImagePath,
    trackImagePath: images.trackImagePath,
    footerText: REPORT_OVERRIDES.footerText || null,
  };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🚀 Starting Story.report Generator...\n');
    ensureGeneratedDirectories();

    let jsonReport;

    if (FORCE_FETCH) {
      console.log('⚡ --force flag detected: fetching fresh data from Last.fm API...\n');
      jsonReport = await fetchAndCacheReport();
    } else {
      const cached = loadCachedReport();
      if (cached) {
        jsonReport = cached;
        console.log('✅ Using cached report.json — skipping API calls.\n');
        console.log('   (Run with --force to fetch fresh data from Last.fm)\n');
      } else {
        console.log('ℹ️  No cached report found — fetching from Last.fm API...\n');
        // Validate env vars now since we need to hit the API
        if (!API_KEY || !USERNAME) {
          console.error('❌ Error: Missing environment variables.');
          console.error('Please set LASTFM_API_KEY and LASTFM_USERNAME in .env file');
          process.exit(1);
        }
        jsonReport = await fetchAndCacheReport();
      }
    }

    const templateData = buildTemplateData(jsonReport);

    console.log('\n📊 Data Summary:');
    console.log(`   Username: ${templateData.username}`);
    console.log(`   Monthly Scrobbles: ${templateData.monthlyScrobbles}`);
    console.log(`   Unique Artists: ${templateData.uniqueArtists}`);
    console.log(`   Unique Albums: ${templateData.uniqueAlbums}`);
    console.log(`   Unique Tracks: ${templateData.uniqueTracks}`);
    console.log(`   Top Artist: ${templateData.topArtist.name} (${templateData.topArtist.playcount})`);
    console.log(`   Top Album: ${templateData.topAlbum.name} (${templateData.topAlbum.playcount})`);
    console.log(`   Top Track: ${templateData.topTrack.name} (${templateData.topTrack.playcount})`);
    console.log(`   Top Tags: ${templateData.topTags.map((t) => t.name).join(', ')}\n`);

    // Apply environment overrides (from UI) into config
    if (REPORT_OVERRIDES.font) config.typography.font = REPORT_OVERRIDES.font;
    if (REPORT_OVERRIDES.bg) config.colors.background = REPORT_OVERRIDES.bg;
    if (REPORT_OVERRIDES.accent) {
      // Ensure accent shows up in template - set both primary and secondary
      config.colors.primary = REPORT_OVERRIDES.accent;
      config.colors.secondary = REPORT_OVERRIDES.accent;
    }

    // Generate Typst template
    const typstTemplate = generateTypstTemplate(templateData);

    // Save Typst template to file
    const typstFilePath = path.join(GENERATED_DIR, 'report.typ');
    fs.writeFileSync(typstFilePath, typstTemplate);
    console.log(`✅ Typst template saved: ${typstFilePath}`);

    // Compile to PNG
    const outputImagePath = path.join(GENERATED_DIR, 'report.png');
    await compileTypstToPng(typstFilePath, outputImagePath);

    console.log('\n✨ Done! Your Story.report is ready!');
    console.log(`📸 Image saved at: ${outputImagePath}\n`);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the application
main();