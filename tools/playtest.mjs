// node tools/playtest.mjs [outDir] [--portrait] [--base URL]
// Serves the folder, lets the autopilot climb in headless GPU Chromium, screenshots every beat, fails on console errors.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const out = path.resolve(args.find(a => !a.startsWith('--')) || 'art-src/live');
const portrait = args.includes('--portrait');
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;
fs.mkdirSync(out, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
let server = null, base = baseArg;
if (!base) {
  server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/index.html`;
}

const vp = portrait ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const watch = page => { page.on('console', m => m.type() === 'error' && errors.push(m.text())); page.on('pageerror', e => errors.push(String(e))); };
const tag = portrait ? 'p' : 'l';

// title screen
{
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 }); watch(page);
  await page.goto(`${base}?mute`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/${tag}00-title.png` });
  await page.close();
}

const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 }); watch(page);
const t0 = Date.now();
await page.goto(`${base}?autopilot&mute`);
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 60000 });
const marks = [1.5, 8, 17.5, 23.5, 30, 38.3, 44.5, 52, 59.5, 66, 76];
let i = 1;
for (const m of marks) {
  await page.waitForFunction(m => window.__game.P.s >= m || window.__game.mode !== 'play', m, { timeout: 90000 });
  await page.screenshot({ path: `${out}/${tag}${String(i++).padStart(2, '0')}-s${m}.png` });
}
await page.waitForFunction(() => window.__game.mode === 'ending', null, { timeout: 90000 });
for (const w of [1500, 2500]) { await page.waitForTimeout(w); await page.screenshot({ path: `${out}/${tag}${String(i++).padStart(2, '0')}-ending.png` }); }
await page.waitForFunction(() => window.__game.ending.sat && window.__game.ending.satT > 0.4, null, { timeout: 60000 });
await page.screenshot({ path: `${out}/${tag}${String(i++).padStart(2, '0')}-sit.png` });
await page.waitForFunction(() => window.__game.ending.satT > 2.6, null, { timeout: 60000 });
await page.screenshot({ path: `${out}/${tag}${String(i++).padStart(2, '0')}-cheer.png` });
await page.waitForFunction(() => window.__game.mode === 'end', null, { timeout: 60000 });
await page.waitForTimeout(1600);
await page.screenshot({ path: `${out}/${tag}${String(i++).padStart(2, '0')}-end.png` });
const st = await page.evaluate(() => ({ collected: __game.G.collected, total: __game.G.total, falls: __game.G.falls, simT: +__game.G.t.toFixed(1), endAt: +__game.G.endAt.toFixed(1), fps: __game.fps }));
const result = { viewport: vp, ...st, wallSecs: Math.round((Date.now() - t0) / 1000), errors };
fs.writeFileSync(`${out}/result-${tag}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await browser.close();
server?.close();
process.exit(errors.length ? 1 : 0);
