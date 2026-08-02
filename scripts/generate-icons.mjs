import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildAdaptiveMarkSvg, buildLogoMarkSvg, LOGO_THEMES } from "./logo-mark.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/icons");
const publicDir = path.resolve(__dirname, "../public");
mkdirSync(outDir, { recursive: true });

const themes = [
  { suffix: "", ...LOGO_THEMES.light, key: "light" },
  { suffix: "-dark", ...LOGO_THEMES.dark, key: "dark" },
];

const targets = [
  { name: "icon", sizes: [192, 512], maskable: false },
  { name: "icon-maskable", sizes: [192, 512], maskable: true },
  { name: "apple-touch-icon", sizes: [180], maskable: false },
];

for (const theme of themes) {
  for (const t of targets) {
    for (const size of t.sizes) {
      const svg = buildLogoMarkSvg({
        tileTop: theme.tileTop,
        tileBottom: theme.tileBottom,
        size: 512,
        maskable: t.maskable,
      });
      const fileName =
        t.name === "apple-touch-icon"
          ? `${t.name}${theme.suffix || "-light"}.png`
          : `${t.name}-${size}${theme.suffix}.png`;
      await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, fileName));
      console.log("wrote", fileName);
    }
  }

  const faviconSvg = buildLogoMarkSvg({
    tileTop: theme.tileTop,
    tileBottom: theme.tileBottom,
    size: 64,
    cornerRadius: 14,
  }).replace('width="512" height="512" viewBox="0 0 512 512"', 'viewBox="0 0 512 512" width="64" height="64"');

  const faviconName = theme.key === "light" ? "favicon-light.svg" : "favicon-dark.svg";
  writeFileSync(path.join(publicDir, faviconName), faviconSvg);
  console.log("wrote", faviconName);
}

writeFileSync(path.join(publicDir, "favicon.svg"), buildLogoMarkSvg({
  tileTop: LOGO_THEMES.light.tileTop,
  tileBottom: LOGO_THEMES.light.tileBottom,
  size: 64,
  cornerRadius: 14,
}).replace('width="512" height="512" viewBox="0 0 512 512"', 'viewBox="0 0 512 512" width="64" height="64"'));
console.log("wrote favicon.svg");

await sharp(path.join(outDir, "apple-touch-icon-light.png")).toFile(
  path.join(outDir, "apple-touch-icon.png"),
);
console.log("alias apple-touch-icon.png <- apple-touch-icon-light.png");

// Flattened on purpose: any alpha channel at all pushes iOS down its
// transparent-web-clip path, where it fills the background with black in every
// appearance. Background is #F2F2F7 (not #ffffff) so Liquid Glass Default keeps
// a solid light tile instead of punching the fill through as clear glass.
const adaptiveBg = "#F2F2F7";
await sharp(Buffer.from(buildAdaptiveMarkSvg({ background: adaptiveBg })))
  .resize(180, 180)
  .flatten({ background: adaptiveBg })
  .png()
  .toFile(path.join(outDir, "apple-touch-icon-home.png"));
console.log("wrote apple-touch-icon-home.png");
