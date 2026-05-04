/**
 * Utility functions for Story.report
 */

/**
 * Escape special characters for Typst markup
 */
export function escapeTypstText(text) {
  // Escape backticks, hashes, and other special characters
  return text
    .replace(/\\/g, '\\\\') // Backslash must be first
    .replace(/`/g, '\\`')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text, maxLength = 30) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get current date formatted
 */
export function getCurrentDate() {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Validate Last.fm API response
 */
export function validateApiResponse(data, expectedField) {
  if (!data) {
    throw new Error('No data received from Last.fm API');
  }
  if (!data[expectedField]) {
    throw new Error(`Missing expected field: ${expectedField}`);
  }
  return true;
}

/**
 * Convert playcount to readable format
 */
export function formatPlaycount(playcount) {
  const count = parseInt(playcount);
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }
  return count.toString();
}

/**
 * Create a progress message
 */
export function progressMessage(step, total, message) {
  const percent = Math.round((step / total) * 100);
  return `[${percent}%] ${message}`;
}
