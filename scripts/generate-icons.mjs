/**
 * Generates the PWA icon set from one inline SVG source.
 *
 *   npm run icons
 *
 * Kept as a script rather than committed-and-forgotten binaries so the mark can
 * be changed in one place. sharp is a devDependency; nothing here ships.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');

const BRAND = '#2a78d6';

/**
 * @param inset how far the mark sits from the edge, as a fraction of the canvas.
 *   Maskable icons get a fat inset because launchers crop to a circle.
 * @param radius corner rounding, as a fraction. 0 = square (iOS rounds it itself).
 */
function svg(size, { inset = 0.24, radius = 0.22 } = {}) {
  const r = size * radius;
  const pad = size * inset;
  const w = size - pad * 2;
  // A check mark drawn on a 100x100 grid, scaled into the safe area.
  const scale = w / 100;
  const stroke = Math.max(2, size * 0.085);
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BRAND}"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})">
    <path d="M8 55 L37 84 L92 16" fill="none" stroke="#ffffff" stroke-width="${stroke / scale}"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`);
}

const targets = [
  { file: 'icon-192.png', size: 192, opts: {} },
  { file: 'icon-512.png', size: 512, opts: {} },
  // Maskable: full-bleed square, mark inside the middle 60% so a circular crop
  // never clips it.
  { file: 'icon-maskable-512.png', size: 512, opts: { inset: 0.3, radius: 0 } },
  // iOS applies its own mask and dislikes transparency, so this one is square.
  { file: 'apple-touch-icon.png', size: 180, opts: { radius: 0 } },
  { file: 'favicon-32.png', size: 32, opts: { inset: 0.18, radius: 0.2 } },
];

await mkdir(OUT, { recursive: true });

for (const { file, size, opts } of targets) {
  const png = await sharp(svg(size, opts)).png().toBuffer();
  await writeFile(path.join(OUT, file), png);
  console.log(`${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)}kB`);
}
