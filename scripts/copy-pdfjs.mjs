// Copies pdf.js into the app's assets so PDFs can be read on the phone, offline.
// Runs automatically after `npm install`. Saved as .txt so Metro bundles them as plain assets.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const build = join(dirname(require.resolve('pdfjs-dist/package.json')), 'legacy', 'build');
const out = new URL('../assets/pdfjs/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
copyFileSync(join(build, 'pdf.min.mjs'), join(out, 'pdf.min.mjs.txt'));
copyFileSync(join(build, 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs.txt'));
console.log('pdf.js copied to assets/pdfjs');
