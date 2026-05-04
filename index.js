import axios from 'axios';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_KEY = process.env.LASTFM_API_KEY;
const USERNAME = process.env.LASTFM_USERNAME;
const API_BASE_URL = 'https://ws.audioscrobbler.com/2.0';
const GENERATED_DIR = path.join(process.cwd(), 'generated');
const GENERATED_ASSETS_DIR = path.join(GENERATED_DIR, 'assets');

// Validate environment variables
if (!API_KEY || !USERNAME) {
  console.error('❌ Error: Missing environment variables.');
  console.error('Please set LASTFM_API_KEY and LASTFM_USERNAME in .env file');
  process.exit(1);
}

function ensureGeneratedDirectories() {
  fs.mkdirSync(GENERATED_ASSETS_DIR, { recursive: true });
}

/**
 * Fetch user info including total scrobbles
 */
async function fetchUserInfo() {
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

function getPreviousMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
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
    topArtists: pickTopEntries(artistCounts, 6, (name, playcount, rank) => ({ rank, name, playcount })),
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

async function fetchTopTagsFromArtists(artists, limit = 5) {
  try {
    const tagCounts = new Map();

    const responses = await Promise.all(
      artists.slice(0, 5).map(async (artist) => {
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
      for (const tag of tags.slice(0, 5)) {
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
      .map(([tag]) => tag);
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
 * Format duration (minutes to days/hours)
 */
function formatDuration(minutes) {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;

  if (days > 0) {
    return `${days} d, ${hours} h`;
  }
  if (hours > 0) {
    return `${hours} h, ${mins} min`;
  }
  return `${mins} min`;
}

/**
 * Generate Typst template with advanced layout
 */
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
    dateRange,
    artistImagePath,
    albumImagePath,
    trackImagePath,
  } = data;

  // Estimate listening time (assuming avg 3.5 min per track)
  const listeningMinutes = monthlyScrobbles * 3.5;
  const listeningTime = formatDuration(Math.round(listeningMinutes));

  // Format top tags
  const tagsText = topTags.length > 0 ? topTags.slice(0, 5).join(', ') : 'No tags found';

  // Build image elements - use relative paths directly
  let artistImageElement = '';
  if (artistImagePath) {
    artistImageElement = `#image("${artistImagePath}", width: 120pt)\n\n`;
  }

  let albumImageElement = '';
  if (albumImagePath) {
    albumImageElement = `#image("${albumImagePath}", width: 120pt)\n\n`;
  }

  let trackImageElement = '';
  if (trackImagePath) {
    trackImageElement = `#image("${trackImagePath}", width: 120pt)\n\n`;
  }

  const template = `#set page(width: 1080pt, height: 1920pt, margin: 0pt, fill: rgb("#0f0f0f"))
#set text(font: "Segoe UI", fill: rgb("#ffffff"))

// Header: Username and date range
#text(size: 20pt, fill: rgb("#888888"))[
  ${username}, ${dateRange}
]

#v(30pt)

// Main stat: Monthly scrobbles
#text(size: 84pt, weight: "bold")[
  ${monthlyScrobbles}
]

#v(-20pt)

#text(size: 24pt, fill: rgb("#888888"))[
  scrobbles
]

#v(10pt)

#text(size: 22pt, fill: rgb("#aaaaaa"))[
  ${listeningTime}
]

#v(50pt)

// Three statistics
#text(size: 18pt, fill: rgb("#aaaaaa"))[
  ${uniqueArtists} artists · ${uniqueAlbums} albums · ${uniqueTracks} tracks
]

#v(60pt)

#line(length: 100%, stroke: 1pt + rgb("#333333"))

#v(50pt)

// Top artist
#text(size: 20pt, weight: "bold", fill: rgb("#888888"))[
  Top artist
]

#v(8pt)

${artistImageElement}#text(size: 32pt, weight: "bold")[
  ${topArtist.name}
]

#v(4pt)

#text(size: 18pt, fill: rgb("#aaaaaa"))[
  ${topArtist.playcount} scrobbles
]

#v(40pt)

// Top album
#text(size: 20pt, weight: "bold", fill: rgb("#888888"))[
  Top album
]

#v(8pt)

${albumImageElement}#text(size: 32pt, weight: "bold")[
  ${topAlbum.name}
]

#v(4pt)

#text(size: 18pt, fill: rgb("#aaaaaa"))[
  ${topAlbum.artist} · ${topAlbum.playcount} scrobbles
]

#v(40pt)

// Top track
#text(size: 20pt, weight: "bold", fill: rgb("#888888"))[
  Top track
]

#v(8pt)

${trackImageElement}#text(size: 32pt, weight: "bold")[
  ${topTrack.name}
]

#v(4pt)

#text(size: 18pt, fill: rgb("#aaaaaa"))[
  ${topTrack.artist} · ${topTrack.playcount} scrobbles
]

#v(40pt)

// Top tags
#text(size: 20pt, weight: "bold", fill: rgb("#888888"))[
  Top tags
]

#v(8pt)

#text(size: 20pt)[
  ${tagsText}
]

#v(1fr)

// Footer
#align(center)[
  #text(size: 18pt, fill: rgb("#555555"))[
    Generated by Story.report
  ]
]`;

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

    // Compile Typst to PNG
    execSync(`typst compile "${typstFilePath}" "${outputImagePath}"`, {
      stdio: 'inherit',
    });

    console.log(`✅ PNG image generated: ${outputImagePath}`);
  } catch (error) {
    console.error('❌ Error compiling Typst:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🚀 Starting Story.report Generator...\n');
    ensureGeneratedDirectories();

    const userInfo = await fetchUserInfo();
    const monthRange = getPreviousMonthRange();
    const recentTracks = await fetchRecentTracksInRange(monthRange.from, monthRange.to);

    if (!recentTracks.length) {
      throw new Error('No scrobbles found for the previous month');
    }

    const listeningData = aggregateListeningData(recentTracks);
    const topArtist = listeningData.topArtists[0];

    if (!topArtist || !listeningData.topAlbum || !listeningData.topTrack) {
      throw new Error('No top listening data available for the previous month');
    }

    const topTags = await fetchTopTagsFromArtists(listeningData.topArtists, 5);

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

    // Prepare template data
    const templateData = {
      username: userInfo.username,
      monthlyScrobbles: listeningData.monthlyScrobbles,
      uniqueTracks: listeningData.uniqueTracks,
      uniqueArtists: listeningData.uniqueArtists,
      uniqueAlbums: listeningData.uniqueAlbums,
      topArtist: topArtist,
      topAlbum: listeningData.topAlbum,
      topTrack: listeningData.topTrack,
      topTags: topTags,
      dateRange: monthRange.label,
      artistImagePath: artistImagePath,
      albumImagePath: albumImagePath,
      trackImagePath: trackImagePath,
    };

    console.log('\n📊 Data Summary:');
    console.log(`   Username: ${templateData.username}`);
    console.log(`   Monthly Scrobbles: ${templateData.monthlyScrobbles}`);
    console.log(`   Unique Artists: ${templateData.uniqueArtists}`);
    console.log(`   Unique Albums: ${templateData.uniqueAlbums}`);
    console.log(`   Unique Tracks: ${templateData.uniqueTracks}`);
    console.log(`   Top Artist: ${templateData.topArtist.name} (${templateData.topArtist.playcount})`);
    console.log(`   Top Album: ${templateData.topAlbum.name} (${templateData.topAlbum.playcount})`);
    console.log(`   Top Track: ${templateData.topTrack.name} (${templateData.topTrack.playcount})`);
    console.log(`   Top Tags: ${templateData.topTags.join(', ')}\n`);

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




