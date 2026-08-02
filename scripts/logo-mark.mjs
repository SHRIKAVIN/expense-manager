/** Shared 3D expense-list logo mark for PNG icons and static favicons. */

const GLYPH = "#ffffff";

/**
 * @param {{ tileTop: string; tileBottom: string; size?: number; cornerRadius?: number; maskable?: boolean }} opts
 */
export function buildLogoMarkSvg({
  tileTop,
  tileBottom,
  size = 512,
  cornerRadius = 112,
  maskable = false,
}) {
  const uid = `lm-${tileTop.slice(1)}-${maskable ? "m" : "a"}`;
  const inset = maskable ? 26 : 0;
  const line1 = maskable ? "M176 196h160" : "M150 180h212";
  const line2 = maskable ? "M176 256h160" : "M150 256h212";
  const line3 = maskable ? "M176 316h92" : "M150 332h120";
  const dotCx = maskable ? 336 : 362;
  const dotCy = maskable ? 316 : 332;
  const dotR = maskable ? 22 : 26;
  const strokeW = maskable ? 30 : 34;
  const shadowDy = maskable ? 2.5 : 3;
  const highlightDy = maskable ? -1.5 : -2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="${uid}-tile" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${tileTop}"/>
      <stop offset="100%" stop-color="${tileBottom}"/>
    </linearGradient>
    <linearGradient id="${uid}-dot" x1="${dotCx - dotR}" y1="${dotCy - dotR}" x2="${dotCx + dotR}" y2="${dotCy + dotR}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#f2f2f2"/>
      <stop offset="100%" stop-color="#d8d8d8"/>
    </linearGradient>
    <filter id="${uid}-pop" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="${shadowDy}" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.38"/>
      <feDropShadow dx="0" dy="${highlightDy}" stdDeviation="0.5" flood-color="#ffffff" flood-opacity="0.42"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="${maskable ? 0 : cornerRadius}" fill="url(#${uid}-tile)"/>
  <g filter="url(#${uid}-pop)" stroke-linecap="round" fill="none">
    <g stroke="rgba(0,0,0,0.32)" stroke-width="${strokeW}" transform="translate(0 ${shadowDy})">
      <path d="${line1}"/>
      <path d="${line2}"/>
      <path d="${line3}"/>
    </g>
    <g stroke="rgba(255,255,255,0.38)" stroke-width="${strokeW}" transform="translate(0 ${highlightDy})">
      <path d="${line1}"/>
      <path d="${line2}"/>
      <path d="${line3}"/>
    </g>
    <g stroke="${GLYPH}" stroke-width="${strokeW}">
      <path d="${line1}"/>
      <path d="${line2}"/>
      <path d="${line3}"/>
    </g>
  </g>
  <g filter="url(#${uid}-pop)">
    <circle cx="${dotCx}" cy="${dotCy + shadowDy * 0.6}" r="${dotR}" fill="rgba(0,0,0,0.28)"/>
    <circle cx="${dotCx}" cy="${dotCy + highlightDy * 0.4}" r="${dotR}" fill="url(#${uid}-dot)"/>
  </g>
</svg>`;
}

/**
 * Flat glyph on a transparent canvas, for the iOS home screen icon.
 *
 * iOS only stores one web-clip image, captured when the app is installed, so it
 * can never be swapped for a dark variant afterwards. What it *can* do is
 * generate its own light / dark / tinted backdrops — but only when the artwork
 * is transparent and flat. Gradients, shadows and a baked-in tile all defeat
 * that, so this variant drops them and uses a single brand blue that stays
 * legible whether iOS puts white or near-black behind it.
 *
 * @param {{ size?: number; glyph?: string; scale?: number }} opts
 */
export function buildAdaptiveMarkSvg({ size = 512, glyph = "#0078e8", scale = 1.3 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <g stroke="${glyph}" stroke-width="34" stroke-linecap="round" fill="none">
      <path d="M150 180h212"/>
      <path d="M150 256h212"/>
      <path d="M150 332h120"/>
    </g>
    <circle cx="362" cy="332" r="26" fill="${glyph}"/>
  </g>
</svg>`;
}

export const LOGO_THEMES = {
  light: { tileTop: "#0078e8", tileBottom: "#0055aa" },
  dark: { tileTop: "#2c2c2e", tileBottom: "#121214" },
};
