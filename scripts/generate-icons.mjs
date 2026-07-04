import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const outputs = [
  { src: 'icon.svg', out: 'favicon.png', size: 32 },
  { src: 'icon.svg', out: 'apple-touch-icon.png', size: 180 },
  { src: 'icon.svg', out: 'icon-192.png', size: 192 },
  { src: 'icon.svg', out: 'icon-512.png', size: 512 },
  { src: 'icon-maskable.svg', out: 'icon-512-maskable.png', size: 512 },
];

for (const { src, out, size } of outputs) {
  const svg = readFileSync(join(publicDir, src));
  await sharp(svg).resize(size, size).png().toFile(join(publicDir, out));
  console.log(`Wrote public/${out} (${size}x${size})`);
}
