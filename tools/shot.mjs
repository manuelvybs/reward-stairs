// node tools/shot.mjs "<query>" out.png [w h] [waitMs] [evalJS]  — one headless GPU screenshot of the game (served locally)
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [q = '', out = 'shot.png', w = 1280, h = 720, wait = 1500, js = ''] = process.argv.slice(2);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?mute&${q}`);
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 60000 });
if (js) await page.evaluate(js);
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
console.log(out, errors.length ? 'ERRORS ' + errors.join(' | ') : '0 errors');
await browser.close(); server.close();
