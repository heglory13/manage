/**
 * Downloads TTF font files from Google Fonts into public/fonts/.
 * Run once: node scripts/download-fonts.mjs
 */
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir  = path.join(__dirname, '../public/fonts');
fs.mkdirSync(fontsDir, { recursive: true });

// Wget UA → Google Fonts CSS1 serves direct TTF URLs
const OLD_UA = 'Wget/1.12';

const FONTS = [
  { name: 'Roboto',            gFamily: 'Roboto',             weights: [400, 700] },
  { name: 'Lato',              gFamily: 'Lato',               weights: [400, 700] },
  { name: 'Montserrat',        gFamily: 'Montserrat',         weights: [400, 700] },
  { name: 'Poppins',           gFamily: 'Poppins',            weights: [400, 700] },
  { name: 'Raleway',           gFamily: 'Raleway',            weights: [400, 700] },
  { name: 'Oswald',            gFamily: 'Oswald',             weights: [400, 700] },
  { name: 'Nunito',            gFamily: 'Nunito',             weights: [400, 700] },
  { name: 'Ubuntu',            gFamily: 'Ubuntu',             weights: [400, 700] },
  { name: 'PlayfairDisplay',   gFamily: 'Playfair+Display',   weights: [400, 700] },
  { name: 'CormorantGaramond', gFamily: 'Cormorant+Garamond', weights: [400, 700] },
  { name: 'Cinzel',            gFamily: 'Cinzel',             weights: [400, 700] },
  { name: 'BebasNeue',         gFamily: 'Bebas+Neue',         weights: [400] },
  { name: 'Pacifico',          gFamily: 'Pacifico',           weights: [400] },
  { name: 'DancingScript',     gFamily: 'Dancing+Script',     weights: [400, 700] },
  { name: 'SourceCodePro',     gFamily: 'Source+Code+Pro',    weights: [400, 700] },
];

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, headers).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

let downloaded = 0;
let skipped = 0;

for (const font of FONTS) {
  const weightsStr = font.weights.join(',');
  const cssUrl = `https://fonts.googleapis.com/css?family=${font.gFamily}:${weightsStr}`;

  console.log(`\n▶ ${font.name} (weights: ${weightsStr})`);
  const css = (await get(cssUrl, { 'User-Agent': OLD_UA })).toString('utf8');

  // Split into @font-face blocks and extract weight + TTF URL from each
  const blocks = css.split('@font-face').slice(1);
  for (const block of blocks) {
    const wMatch = block.match(/font-weight:\s*(\d+)/);
    const uMatch = block.match(/url\(([^)]+\.ttf)\)/);
    if (!wMatch || !uMatch) continue;

    const weight = Number(wMatch[1]);
    if (!font.weights.includes(weight)) continue;

    const fontUrl  = uMatch[1].replace(/['"]/g, '');
    const filename = `${font.name}-${weight}.ttf`;
    const dest     = path.join(fontsDir, filename);

    if (fs.existsSync(dest)) {
      console.log(`  ✓ ${filename} already exists`);
      skipped++;
      continue;
    }

    const data = await get(fontUrl, { 'User-Agent': OLD_UA });
    fs.writeFileSync(dest, data);
    console.log(`  ↓ ${filename} (${Math.round(data.length / 1024)} KB)`);
    downloaded++;
  }
}

console.log(`\nDone! Downloaded: ${downloaded}, Skipped: ${skipped}`);
console.log(`Fonts saved to: ${fontsDir}`);
