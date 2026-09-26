/* eslint-disable */
/**
 * Renders the brand assets that the site, e-mails and the project PDF expect:
 *   public/apple-icon.png           180×180 iOS home-screen icon
 *   public/favicon.ico              16/32/48 browser tab icon
 *   public/brand/marketlink-email.png  e-mail header logo (used as a CID attachment)
 *
 * Usage: NODE_PATH=./node_modules node scripts/generate-brand-assets.cjs
 * Requires `sharp` (SVG rasteriser) and Python + Pillow for the .ico container.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const BRAND = path.join(ROOT, "public", "brand");
const GREEN = { r: 1, g: 65, b: 28, alpha: 1 }; // brand-950 #01411c

const symbol = fs.readFileSync(path.join(BRAND, "marketlink-symbol.svg"));
const logo = fs.readFileSync(path.join(BRAND, "marketlink-logo.svg"));

(async () => {
  // 1. Square app icon: symbol centred on the brand-green field.
  const symbolPng = await sharp(symbol, { density: 600 }).resize({ width: 432, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const square = await sharp({ create: { width: 540, height: 540, channels: 4, background: GREEN } })
    .composite([{ input: symbolPng, gravity: "center" }])
    .png()
    .toBuffer();

  const apple = await sharp(square).resize(180, 180).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(ROOT, "public", "apple-icon.png"), apple);
  fs.writeFileSync("/tmp/ml-icon-512.png", await sharp(square).resize(512, 512).png().toBuffer());

  // 2. Multi-resolution .ico (Pillow builds the container from the 512px master).
  execFileSync("python3", ["-c", `
from PIL import Image
img = Image.open("/tmp/ml-icon-512.png").convert("RGBA")
img.save(${JSON.stringify(path.join(ROOT, "public", "favicon.ico"))}, sizes=[(16,16),(32,32),(48,48)])
`], { stdio: "inherit" });

  // 3. E-mail / PDF logo: the full lockup, 4× the 260px e-mail width for retina screens.
  const email = await sharp(logo, { density: 600 }).resize({ width: 1040, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  fs.writeFileSync(path.join(BRAND, "marketlink-email.png"), email);

  for (const f of ["apple-icon.png", "favicon.ico", "brand/marketlink-email.png"]) {
    const p = path.join(ROOT, "public", f);
    const meta = f.endsWith(".ico") ? "" : ` (${(await sharp(p).metadata()).width}px wide)`;
    console.log(`✔ public/${f} — ${(fs.statSync(p).size / 1024).toFixed(1)} KB${meta}`);
  }
})();
