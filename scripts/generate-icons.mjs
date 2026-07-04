import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = join(root, 'brand', 'appstore');
const publicDir = join(root, 'public');

/** App / PWA icons sourced from brand/appstore (Android + iOS export). */
const outputs = [
  { src: join(brandDir, 'ios', '32.png'), out: 'favicon.png' },
  { src: join(brandDir, 'ios', '32.png'), out: 'favicon.ico' },
  { src: join(brandDir, 'ios', '180.png'), out: 'apple-touch-icon.png' },
  { src: join(brandDir, 'android', 'launchericon-192x192.png'), out: 'icon-192.png' },
  { src: join(brandDir, 'android', 'launchericon-512x512.png'), out: 'icon-512.png' },
  { src: join(brandDir, 'android', 'launchericon-512x512.png'), out: 'icon-512-maskable.png' },
];

mkdirSync(publicDir, { recursive: true });

for (const { src, out } of outputs) {
  if (!existsSync(src)) {
    console.error(`Missing source icon: ${src}`);
    console.error('Copy app store exports into brand/appstore/{android,ios}/ first.');
    process.exit(1);
  }
  copyFileSync(src, join(publicDir, out));
  console.log(`Wrote public/${out}`);
}
