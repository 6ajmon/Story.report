/**
 * Configuration for Story.report
 * Customize these settings to change the appearance of your report
 */

export const config = {
  // Page dimensions (Instagram Story format: 9:16)
  page: {
    width: '1080pt',
    height: '1920pt',
    margin: '0pt',
  },

  // Colors
  colors: {
    background: '#1a1a1a', // Dark background
    primary: '#00d9ff', // Cyan accent
    secondary: '#aaaaaa', // Gray
    text: '#ffffff', // White
    textMuted: '#666666', // Dark gray
  },

  // Typography
  typography: {
    font: 'Inter',
    title: {
      size: '48pt',
      weight: 'bold',
    },
    sectionTitle: {
      size: '36pt',
      weight: 'bold',
    },
    itemTitle: {
      size: '22pt',
    },
    itemSubtitle: {
      size: '20pt',
    },
    caption: {
      size: '18pt',
    },
    footer: {
      size: '16pt',
    },
  },

  // Spacing
  spacing: {
    headerTop: '40pt',
    headerBottom: '32pt',
    sectionGap: '24pt',
    itemGap: '16pt',
    boxPadding: '20pt',
    gridGutter: '20pt',
  },

  // API Settings
  api: {
    topArtistsLimit: 5,
    topTracksLimit: 5,
    period: '1month', // Options: "overall", "7day", "1month", "3month", "6month", "12month"
  },

  // Output
  output: {
    typstFile: 'report.typ',
    imageFile: 'report.png',
  },

  // Emojis
  emojis: {
    title: '🎵',
    artists: '🎤',
    tracks: '🎶',
  },
};

export default config;
