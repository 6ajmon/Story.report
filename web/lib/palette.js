/**
 * Color palette extraction utilities (pure JS, no dependencies).
 *
 * The algorithm:
 *  1. Downsamples the source image (done by the caller via canvas).
 *  2. Runs median-cut quantization over the sampled pixels to produce a
 *     small palette of representative colors (most frequent = highest weight).
 *  3. Picks a "background" (dominant color, slightly darkened when dark)
 *     and an "accent" (most vibrant color clearly distinct from the bg).
 */

export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

export function luminance(r, g, b) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function colorDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// ---- WCAG contrast helpers ----

// Minimum contrast ratio for accent-colored text on the background (WCAG AA).
export const ACCENT_CONTRAST_TARGET = 4.5;

function relativeLuminance(r, g, b) {
  const linearize = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(rgbA, rgbB) {
  const l1 = relativeLuminance(rgbA[0], rgbA[1], rgbA[2]);
  const l2 = relativeLuminance(rgbB[0], rgbB[1], rgbB[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Adjust the accent's lightness (keeping hue and saturation) until it reaches
 * the target WCAG contrast ratio against the background. Dark backgrounds
 * lighten the accent; light backgrounds darken it.
 * @param {[number, number, number]} accent RGB
 * @param {[number, number, number]} bg RGB
 * @param {number} targetRatio WCAG contrast ratio to reach
 * @returns {[number, number, number]} adjusted RGB accent
 */
export function ensureAccentContrast(accent, bg, targetRatio = ACCENT_CONTRAST_TARGET) {
  const bgIsDark = luminance(bg[0], bg[1], bg[2]) < 0.5;
  const { h, s, l } = rgbToHsl(accent[0], accent[1], accent[2]);

  let lightness = l;
  let result = accent;
  let ratio = contrastRatio(accent, bg);

  const step = bgIsDark ? 0.08 : -0.08;
  const clampLow = 0.02;
  const clampHigh = 0.98;

  for (let i = 0; i < 40 && ratio < targetRatio; i++) {
    lightness = Math.min(clampHigh, Math.max(clampLow, lightness + step));
    result = hslToRgb(h, s, lightness);
    ratio = contrastRatio(result, bg);
  }

  return result;
}

/**
 * Median-cut quantization.
 * @param {Array<[number, number, number]>} pixels RGB pixel array
 * @param {number} maxColors max number of palette colors to produce
 * @returns {Array<{ color: [number, number, number], weight: number }>}
 */
export function medianCutQuantize(pixels, maxColors = 8) {
  if (!pixels || pixels.length === 0) {
    return [];
  }

  let boxes = [pixels];

  while (boxes.length < maxColors) {
    let bestIdx = -1;
    let bestRange = -1;

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length < 2) continue;

      let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
      for (const p of box) {
        if (p[0] < minR) minR = p[0];
        if (p[0] > maxR) maxR = p[0];
        if (p[1] < minG) minG = p[1];
        if (p[1] > maxG) maxG = p[1];
        if (p[2] < minB) minB = p[2];
        if (p[2] > maxB) maxB = p[2];
      }

      const range = Math.max(maxR - minR, maxG - minG, maxB - minB);
      if (range > bestRange) {
        bestRange = range;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;

    const box = boxes[bestIdx];
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (const p of box) {
      if (p[0] < minR) minR = p[0];
      if (p[0] > maxR) maxR = p[0];
      if (p[1] < minG) minG = p[1];
      if (p[1] > maxG) maxG = p[1];
      if (p[2] < minB) minB = p[2];
      if (p[2] > maxB) maxB = p[2];
    }
    const ranges = [maxR - minR, maxG - minG, maxB - minB];
    const channel = ranges.indexOf(Math.max(...ranges));

    box.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(box.length / 2);
    boxes.splice(bestIdx, 1, box.slice(0, mid), box.slice(mid));
  }

  return boxes
    .filter((b) => b.length > 0)
    .map((box) => {
      let r = 0, g = 0, b = 0;
      for (const p of box) {
        r += p[0];
        g += p[1];
        b += p[2];
      }
      const n = box.length;
      return {
        color: [Math.round(r / n), Math.round(g / n), Math.round(b / n)],
        weight: n,
      };
    })
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Pick a background + accent pair from a quantized palette.
 * @param {Array<{ color: [number, number, number], weight: number }>} palette
 * @returns {{ bg: string, accent: string }} hex colors
 */
export function extractBackgroundAndAccent(palette) {
  if (!palette || palette.length === 0) {
    return { bg: '#1a1a1a', accent: '#e8d5a3' };
  }

  const dominant = palette[0].color;
  const bgLum = luminance(...dominant);

  // Background = dominant color. Dark covers get a deeper, moodier shade;
  // light covers stay light (text color auto-adjusts via luminance).
  const bg =
    bgLum < 0.5 ? dominant.map((v) => Math.round(v * 0.62)) : [...dominant];

  // Accent = most vibrant color that is clearly distinct from the background.
  let bestAccent = (palette[1] && palette[1].color) || dominant;
  let bestScore = -1;

  for (const entry of palette) {
    const c = entry.color;
    const dist = colorDistance(bg, c);
    if (dist < 45) continue;

    const { s, l } = rgbToHsl(c[0], c[1], c[2]);
    // Prefer saturated, mid-luminance colors for maximum "pop".
    const lumScore = 1 - Math.abs(l - 0.5) * 2;
    const score = s * 1.3 + lumScore * 0.6 + Math.min(dist / 255, 1) * 0.3;
    if (score > bestScore) {
      bestScore = score;
      bestAccent = c;
    }
  }

  // Make sure the accent is not too dark to be visible on the report.
  if (luminance(...bestAccent) < 0.12) {
    bestAccent = bestAccent.map((v) => Math.round(v + (255 - v) * 0.35));
  }

  // Guarantee the accent text is readable on the background (WCAG contrast).
  bestAccent = ensureAccentContrast(bestAccent, bg);

  return { bg: rgbToHex(...bg), accent: rgbToHex(...bestAccent) };
}
