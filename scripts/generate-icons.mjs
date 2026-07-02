import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

const LIGHT_TILE = "#0066cc";
const DARK_TILE = "#1d1d1f";
const GLYPH = "#ffffff";

// "any" icon — glyph centered on themed tile.
const anyIcon = (size, tile) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${tile}"/>
  <g stroke="${GLYPH}" stroke-width="34" stroke-linecap="round">
    <path d="M150 180h212"/>
    <path d="M150 256h212"/>
    <path d="M150 332h120"/>
  </g>
  <circle cx="362" cy="332" r="26" fill="${GLYPH}"/>
</svg>`;

// Maskable icon — full-bleed tile with glyph inside the safe zone.
const maskableIcon = (size, tile) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${tile}"/>
  <g stroke="${GLYPH}" stroke-width="30" stroke-linecap="round">
    <path d="M176 196h160"/>
    <path d="M176 256h160"/>
    <path d="M176 316h92"/>
  </g>
  <circle cx="336" cy="316" r="22" fill="${GLYPH}"/>
</svg>`;

const themes = [
  { suffix: "", tile: LIGHT_TILE },
  { suffix: "-dark", tile: DARK_TILE },
];

const targets = [
  { name: "icon", sizes: [192, 512], svg: anyIcon },
  { name: "icon-maskable", sizes: [192, 512], svg: maskableIcon },
  { name: "apple-touch-icon", sizes: [180], svg: anyIcon },
];

for (const theme of themes) {
  for (const t of targets) {
    for (const size of t.sizes) {
      const fileName =
        t.name === "apple-touch-icon"
          ? `${t.name}${theme.suffix || "-light"}.png`
          : `${t.name}-${size}${theme.suffix}.png`;
      await sharp(Buffer.from(t.svg(size, theme.tile)))
        .png()
        .toFile(path.join(outDir, fileName));
      console.log("wrote", fileName);
    }
  }
}

// Legacy alias for apple-touch-icon (light default).
await sharp(path.join(outDir, "apple-touch-icon-light.png")).toFile(
  path.join(outDir, "apple-touch-icon.png"),
);
console.log("alias apple-touch-icon.png <- apple-touch-icon-light.png");
