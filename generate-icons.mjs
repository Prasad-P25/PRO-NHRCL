// One-off: render PWA icons (blue "P" logo) from an inline SVG using sharp.
// Run from repo root:  node generate-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'fs';

const OUT = 'frontend/public/icons';
mkdirSync(OUT, { recursive: true });

const BLUE = '#2563EB';
// Full-bleed square so it works for iOS (rounds it) and Android maskable (P in the
// center safe zone). Bold white P centered.
const svg = (size) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BLUE}"/>
  <text x="256" y="270" text-anchor="middle" dominant-baseline="central"
        font-family="'Segoe UI', Arial, Helvetica, sans-serif" font-weight="800"
        font-size="300" fill="#FFFFFF">P</text>
</svg>`);

const targets = [
  { file: 'pwa-192.png', size: 192 },
  { file: 'pwa-512.png', size: 512 },
  { file: 'maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-48.png', size: 48 },
];

for (const t of targets) {
  await sharp(svg(t.size)).resize(t.size, t.size).png().toFile(`${OUT}/${t.file}`);
  console.log('wrote', `${OUT}/${t.file}`);
}
console.log('done');
