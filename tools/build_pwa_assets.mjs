// สร้างไอคอนแอป (PNG) + รูปพรีวิวลิงก์ (og.png) จาก assets/icon.svg
// ใช้: node tools/build_pwa_assets.mjs <โฟลเดอร์ node_modules ที่มี @fontsource/cinzel และ @fontsource/ibm-plex-sans-thai>
// ต้องมี rsvg-convert และ playwright (chromium)
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const fonts = process.argv[2] || '/tmp/fonts/node_modules';
const svg = readFileSync('assets/icon.svg', 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'pwa-'));

// แบบเต็มกรอบ (ไม่มีมุมมน) ให้ iPhone/Android ตัดมุมเอง · maskable = ย่อลูกเต๋าให้อยู่ในวงกลมปลอดภัย 80%
const square = (scale) => svg.replace(' rx="96"', '').replace(/translate\(64 64\) scale\(\.75\)/, `translate(${(512 - 512 * scale) / 2} ${(512 - 512 * scale) / 2}) scale(${scale})`);
const out = [
  ['assets/icon-192.png', svg, 192],
  ['assets/icon-512.png', svg, 512],
  ['assets/apple-touch-icon.png', square(.72), 180],
  ['assets/icon-maskable-512.png', square(.6), 512],
];
for (const [file, src, size] of out) {
  const f = join(tmp, 'i.svg');
  writeFileSync(f, src);
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', file, f]);
  console.log('✓', file);
}

const font = (pkg, file) => `url(data:font/woff2;base64,${readFileSync(`${fonts}/@fontsource/${pkg}/files/${file}`).toString('base64')})`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Cinzel; font-weight: 700; src: ${font('cinzel', 'cinzel-latin-700-normal.woff2')}; }
@font-face { font-family: Plex; font-weight: 600; src: ${font('ibm-plex-sans-thai', 'ibm-plex-sans-thai-thai-600-normal.woff2')}; }
@font-face { font-family: Plex; font-weight: 600; src: ${font('ibm-plex-sans-thai', 'ibm-plex-sans-thai-latin-600-normal.woff2')}; unicode-range: U+0000-00FF; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: radial-gradient(circle at 20% 30%, #3a1517 0, #121214 60%); color: #ece9e4; font-family: Plex;
  display: flex; align-items: center; gap: 64px; padding: 0 90px; border-bottom: 14px solid #e0464a; }
.ico { width: 300px; height: 300px; flex: none; filter: drop-shadow(0 18px 40px #0009); }
h1 { font-family: Cinzel; font-size: 92px; line-height: 1; color: #fff; letter-spacing: 1px; }
h1 b { color: #e0464a; }
p { font-size: 38px; margin-top: 26px; color: #d8d2cb; line-height: 1.45; }
.tags { display: flex; gap: 12px; margin-top: 30px; }
.tags span { font-size: 26px; padding: 8px 18px; border: 2px solid #e0464a; border-radius: 999px; color: #fff; background: #e0464a22; }
</style></head><body>
<img class="ico" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">
<div><h1><b>DnD</b> Builder</h1>
<p>สร้างตัวละครและใบตัวละคร<br>ภาษาไทย ใช้กฎปี 2024</p>
<div class="tags"><span>เลเวล 1–20</span><span>เซฟในเครื่อง</span><span>ไม่ต้องล็อกอิน</span></div></div>
</body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: 'assets/og.jpg', type: 'jpeg', quality: 88 });
await b.close();
console.log('✓ assets/og.jpg');
