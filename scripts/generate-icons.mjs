import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/icons");
mkdirSync(outDir, { recursive: true });

// "any" icon — glyph centered on Action Blue tile.
const anyIcon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#0066cc"/>
  <g stroke="#ffffff" stroke-width="34" stroke-linecap="round">
    <path d="M150 180h212"/>
    <path d="M150 256h212"/>
    <path d="M150 332h120"/>
  </g>
  <circle cx="362" cy="332" r="26" fill="#ffffff"/>
</svg>`;

// Maskable icon — full-bleed Action Blue with glyph inside the safe zone.
const maskableIcon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0066cc"/>
  <g stroke="#ffffff" stroke-width="30" stroke-linecap="round">
    <path d="M176 196h160"/>
    <path d="M176 256h160"/>
    <path d="M176 316h92"/>
  </g>
  <circle cx="336" cy="316" r="22" fill="#ffffff"/>
</svg>`;

const targets = [
  { name: "icon-192.png", size: 192, svg: anyIcon },
  { name: "icon-512.png", size: 512, svg: anyIcon },
  { name: "icon-maskable-192.png", size: 192, svg: maskableIcon },
  { name: "icon-maskable-512.png", size: 512, svg: maskableIcon },
  { name: "apple-touch-icon.png", size: 180, svg: anyIcon },
];

for (const t of targets) {
  await sharp(Buffer.from(t.svg(t.size)))
    .png()
    .toFile(path.join(outDir, t.name));
  console.log("wrote", t.name);
}
