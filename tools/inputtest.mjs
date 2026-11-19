// node tools/inputtest.mjs — real keyboard on desktop + real touch on the on-screen pads (phone emulation)
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const out = {}; const errors = [];
const state = page => page.evaluate(() => ({ mode: __game.mode, s: +__game.P.s.toFixed(2), y: +__game.P.y.toFixed(2), got: __game.G.collected, fps: Math.round(__game.fps), audio: __game.sound.ctx?.state || 'none' }));
// desktop keyboard
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url); await page.waitForFunction(() => window.__game?.ready);
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  out.kbStart = await state(page);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1200);
  const before = await state(page); await page.keyboard.press('Space'); await page.waitForTimeout(250);
  const air = await page.evaluate(() => !__game.P.grounded); await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowRight');
  out.kb = { before, jumpedAirborne: air, after: await state(page) };
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(800); await page.keyboard.up('ArrowLeft');
  out.kbLeft = await state(page);
  await page.waitForTimeout(3500); out.kbFps = await state(page);
  await page.close();
}
// phone: real touches through CDP
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url); await page.waitForFunction(() => window.__game?.ready); await page.waitForTimeout(800);
  out.ctl = await page.textContent('#ctl');
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', 200, 400); await touch('touchEnd'); await page.waitForTimeout(400);
  out.padsVisible = await page.evaluate(() => getComputedStyle(document.getElementById('pads')).display);
  const r = await page.evaluate(() => { const b = id => document.getElementById(id).getBoundingClientRect(); return { R: b('padR'), J: b('padJ') }; });
  await touch('touchStart', r.R.x + r.R.width / 2, r.R.y + r.R.height / 2); await page.waitForTimeout(2000);
  const mid = await state(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.R.x + r.R.width / 2, y: r.R.y + r.R.height / 2, id: 1 }, { x: r.J.x + r.J.width / 2, y: r.J.y + r.J.height / 2, id: 2 }] });
  await page.waitForTimeout(200); const air = await page.evaluate(() => !__game.P.grounded);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: r.R.x + r.R.width / 2, y: r.R.y + r.R.height / 2, id: 1 }] });
  await page.waitForTimeout(1500); await touch('touchEnd'); await page.waitForTimeout(600);
  out.touch = { mid, jumpedAirborne: air, after: await state(page) };
  await page.screenshot({ path: process.argv[2] || 'art-src/touch.png' });
  await ctx.close();
}
console.log(JSON.stringify({ ...out, errors }, null, 1));
await browser.close(); server.close();
