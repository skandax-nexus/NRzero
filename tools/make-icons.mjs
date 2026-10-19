// Generates the AFTERZERO app icons from our own canvas drawing (no external art):
// the Chronolith ring / the "O" of the logo, warm past on the left, cool future on the right.
// Renders in headless Chromium and writes PNGs to icons/.
//   node tools/make-icons.mjs            (needs Playwright: `npm i -D playwright` or a global install)
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'icons');
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/node-tools/node_modules/playwright/index.mjs')); }

// [file, size, options]. shape: 'rounded' (transparent corners) | 'full' (full bleed, opaque).
// scale = ring outer diameter / icon size. Maskable icons keep the ring inside the 80% safe zone.
const ICONS = [
  ['icon-192.png', 192, { shape: 'rounded', scale: 0.8 }],
  ['icon-512.png', 512, { shape: 'rounded', scale: 0.8 }],
  ['icon-maskable-192.png', 192, { shape: 'full', scale: 0.62 }],
  ['icon-maskable-512.png', 512, { shape: 'full', scale: 0.62 }],
  ['apple-touch-icon.png', 180, { shape: 'full', scale: 0.74 }],
  ['favicon-32.png', 32, { shape: 'full', scale: 0.92, simple: true }],
  ['store/app-store-icon-1024.png', 1024, { shape: 'full', scale: 0.74 }],   // App Store / Xcode marketing icon
  ['store/play-icon-512.png', 512, { shape: 'full', scale: 0.74 }],           // Google Play listing icon
];

// Runs in the page. Draws the emblem; returns a PNG data URL.
function drawEmblem(W, H, o) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const S = Math.min(W, H), cx = o.cx ?? W / 2, cy = o.cy ?? H / 2;
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const circle = (r, x = cx, y = cy) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };

  if (o.shape === 'rounded') {
    const r = S * 0.22; g.beginPath();
    g.moveTo(r, 0); g.arcTo(W, 0, W, H, r); g.arcTo(W, H, 0, H, r); g.arcTo(0, H, 0, 0, r); g.arcTo(0, 0, W, 0, r); g.closePath(); g.clip();
  }
  // night sky, slightly lifted behind the ring
  const bg = g.createRadialGradient(cx, cy - S * 0.05, 0, cx, cy, Math.max(W, H) * 0.75);
  bg.addColorStop(0, '#12233a'); bg.addColorStop(0.5, '#070d18'); bg.addColorStop(1, '#02040a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // the past glows warm on the left, the future cool on the right (as on the title screen)
  const glow = (x, y, r, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  glow(cx - S * 0.34, cy + S * 0.12, S * 0.5, 'rgba(200,100,40,0.42)');
  glow(cx + S * 0.34, cy + S * 0.12, S * 0.5, 'rgba(40,110,170,0.45)');
  if (o.wordmark) glow(W * 0.72, H * 0.62, W * 0.4, 'rgba(40,110,170,0.32)');
  if (!o.simple) for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * H * 0.8, r = (0.4 + rnd() * 0.9) * S / 512;
    g.fillStyle = `rgba(220,235,255,${0.15 + rnd() * 0.5})`; circle(r, x, y); g.fill();
  }
  // a low horizon of black rock
  if (!o.simple) {
    const hz = g.createLinearGradient(0, cy + S * 0.3, 0, H);
    hz.addColorStop(0, 'rgba(4,6,10,0)'); hz.addColorStop(0.35, 'rgba(4,6,10,0.85)'); hz.addColorStop(1, '#020306');
    g.fillStyle = hz; g.fillRect(0, cy + S * 0.3, W, H);
  }

  const R = S * 0.5 * o.scale, w = R * (o.simple ? 0.34 : 0.25), rm = R - w / 2, ri = R - w;
  // through the ring: another sky, lit from the ring's edge (dark heart, bright rim)
  const inner = g.createRadialGradient(cx, cy, 0, cx, cy, ri);
  inner.addColorStop(0, '#0f2236'); inner.addColorStop(0.6, '#0a1a2b'); inner.addColorStop(0.9, '#133b56'); inner.addColorStop(0.975, '#3c9cc8'); inner.addColorStop(1, '#a6ecff');
  g.fillStyle = inner; circle(ri); g.fill();
  g.save(); circle(ri); g.clip();
  const tint = g.createLinearGradient(cx - ri, 0, cx + ri, 0);   // the past bleeds in warm from the left
  tint.addColorStop(0, 'rgba(255,140,50,0.3)'); tint.addColorStop(0.42, 'rgba(255,140,50,0)'); tint.addColorStop(1, 'rgba(95,230,255,0.08)');
  g.fillStyle = tint; g.fillRect(cx - ri, cy - ri, ri * 2, ri * 2);
  if (!o.simple) for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * ri * 0.9, r = (0.35 + rnd() * 0.8) * S / 512;
    g.fillStyle = `rgba(230,245,255,${0.2 + rnd() * 0.55})`; circle(r, cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.fill();
  }
  g.globalCompositeOperation = 'lighter';
  // the zero second: a vertical seam of light with a hot centre and a faint horizontal flare
  const halo = g.createRadialGradient(cx, cy, 0, cx, cy, ri * 0.55);
  halo.addColorStop(0, 'rgba(200,245,255,0.55)'); halo.addColorStop(1, 'rgba(60,160,220,0)');
  g.fillStyle = halo; circle(ri * 0.55); g.fill();
  const seam = g.createLinearGradient(0, cy - ri, 0, cy + ri);
  seam.addColorStop(0.04, 'rgba(160,230,255,0)'); seam.addColorStop(0.5, 'rgba(255,255,255,1)'); seam.addColorStop(0.96, 'rgba(160,230,255,0)');
  const sw = Math.max(1.5, S * (o.simple ? 0.05 : 0.011));
  g.shadowColor = '#7fe4ff'; g.shadowBlur = S * 0.035; g.fillStyle = seam;
  g.beginPath(); g.moveTo(cx, cy - ri); g.quadraticCurveTo(cx + sw, cy, cx, cy + ri); g.quadraticCurveTo(cx - sw, cy, cx, cy - ri); g.fill();
  if (!o.simple) { g.shadowBlur = S * 0.045; g.fillStyle = '#ffffff'; circle(S * 0.011); g.fill(); }
  g.restore();
  // obsidian ring body, haloed in the gold of the logo's O
  g.save(); g.shadowColor = 'rgba(255,150,50,0.6)'; g.shadowBlur = S * (o.simple ? 0.04 : 0.06);
  g.lineWidth = w; g.strokeStyle = '#090b10'; circle(rm); g.stroke(); g.restore();
  const body = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  body.addColorStop(0, '#3a414d'); body.addColorStop(0.35, '#151920'); body.addColorStop(0.7, '#07090d'); body.addColorStop(1, '#14171d');
  g.lineWidth = w; g.strokeStyle = body; circle(rm); g.stroke();
  // polished obsidian: a soft reflection along the upper-left of the ring
  if (!o.simple) {
    g.save(); g.lineCap = 'round'; g.lineWidth = w * 0.42;
    const sh = g.createLinearGradient(cx - R, cy - R, cx, cy);
    sh.addColorStop(0, 'rgba(190,210,235,0.13)'); sh.addColorStop(1, 'rgba(190,210,235,0)');
    g.strokeStyle = sh; g.beginPath(); g.arc(cx, cy, rm, Math.PI * 1.05, Math.PI * 1.55); g.stroke(); g.restore();
  }
  // inner edge lit by the core: gold on the past side, cyan on the future side
  const edge = g.createConicGradient(-Math.PI / 2, cx, cy);
  edge.addColorStop(0, '#eaf8ff'); edge.addColorStop(0.22, '#5fe6ff'); edge.addColorStop(0.45, '#3fa8d0');
  edge.addColorStop(0.55, '#d98a3a'); edge.addColorStop(0.78, '#ffb347'); edge.addColorStop(1, '#eaf8ff');
  g.save(); g.shadowColor = 'rgba(140,230,255,0.9)'; g.shadowBlur = S * 0.025;
  g.lineWidth = Math.max(1.2, S * (o.simple ? 0.03 : 0.012)); g.strokeStyle = edge; circle(ri + g.lineWidth / 2); g.stroke(); g.restore();
  // the outer rim: the gold stroke of the logo's O
  g.save(); g.shadowColor = '#ff8a00'; g.shadowBlur = S * 0.03;
  g.lineWidth = Math.max(1, S * (o.simple ? 0.02 : 0.007)); g.strokeStyle = '#ffd9a0'; circle(R - g.lineWidth / 2); g.stroke(); g.restore();

  if (o.wordmark) {   // feature graphic: wordmark to the right of the ring
    const x = o.wordmark.x, y = o.wordmark.y, fs = o.wordmark.size;
    g.textBaseline = 'alphabetic'; g.font = `600 ${fs}px Cinzel, "Cormorant Garamond", Georgia, serif`;
    const word = 'AFTERZER', wTxt = g.measureText(word).width, spacing = fs * 0.14;
    const tg = g.createLinearGradient(0, y - fs, 0, y);
    tg.addColorStop(0.2, '#ffffff'); tg.addColorStop(0.6, '#a8bccc'); tg.addColorStop(1, '#5d6f80');
    g.fillStyle = tg; let px = x;
    for (const ch of word) { g.fillText(ch, px, y); px += g.measureText(ch).width + spacing; }
    g.save(); g.shadowColor = '#ff8a00'; g.shadowBlur = fs * 0.25; g.strokeStyle = '#ffd9a0'; g.lineWidth = fs * 0.035;
    g.strokeText('O', px, y); g.restore();
    g.font = `600 ${fs * 0.2}px Cinzel, Georgia, serif`; g.fillStyle = '#cfd8e0';
    const sub = 'THE LAST VERSION OF EARTH'; let sx = x;
    for (const ch of sub) { g.fillText(ch, sx, y + fs * 0.55); sx += g.measureText(ch).width + fs * 0.08; }
    void wTxt;
  }
  const px = g.getImageData(0, 0, W, H).data;
  let bin = ''; for (let i = 0; i < px.length; i += 0x8000) bin += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
  return { w: W, h: H, rgba: btoa(bin) };
}

// Minimal PNG encoder: opaque images are written as RGB (no alpha channel: app stores require that),
// with the usual per-row adaptive filter and maximum deflate.
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length), td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  out.writeUInt32BE(data.length, 0); td.copy(out, 4); out.writeUInt32BE(crc32(td), 8 + data.length); return out;
}
function encodePNG({ w, h, rgba }) {
  const src = Buffer.from(rgba, 'base64');
  let opaque = true; for (let i = 3; i < src.length; i += 4) if (src[i] !== 255) { opaque = false; break; }
  const bpp = opaque ? 3 : 4, stride = w * bpp, raw = Buffer.alloc(h * (stride + 1));
  const row = Buffer.alloc(stride), prev = Buffer.alloc(stride), cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) for (let k = 0; k < bpp; k++) row[x * bpp + k] = src[(y * w + x) * 4 + k];
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const o = cand[f]; let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        const v = (row[i] - [0, a, b, (a + b) >> 1, paeth(a, b, c)][f]) & 255;
        o[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = f; }
    }
    raw[y * (stride + 1)] = best; cand[best].copy(raw, y * (stride + 1) + 1); row.copy(prev);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600&display=block" rel="stylesheet"></head><body style="margin:0;background:#000"></body></html>`, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
await page.evaluate(() => document.fonts.load('600 40px Cinzel').catch(() => null)).catch(() => null);
fs.mkdirSync(path.join(outDir, 'store'), { recursive: true });
const save = (file, img) => { const png = encodePNG(img); fs.writeFileSync(path.join(outDir, file), png); console.log(`wrote icons/${file} (${(png.length / 1024).toFixed(0)} KB)`); };
for (const [file, size, o] of ICONS) save(file, await page.evaluate(([W, H, opts, src]) => new Function('return ' + src)()(W, H, opts), [size, size, o, drawEmblem.toString()]));
// Google Play feature graphic (1024x500): ring on the left, wordmark on the right
save('store/feature-graphic-1024x500.png', await page.evaluate(([src]) => new Function('return ' + src)()(1024, 500,
  { shape: 'full', scale: 0.74, cx: 232, cy: 250, wordmark: { x: 470, y: 272, size: 66 } }), [drawEmblem.toString()]));
await browser.close();
