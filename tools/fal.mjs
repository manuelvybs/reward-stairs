// Minimal fal queue client. Every call is appended to tools/fal-log.jsonl (endpoint, label, input, urls).
//   node tools/fal.mjs <endpoint> <input.json> <label>   -> prints the result JSON
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(HERE, 'fal-log.jsonl');
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', glb: 'model/gltf-binary', mp3: 'audio/mpeg', wav: 'audio/wav' };

const urlsIn = o => JSON.stringify(o).match(/https:\/\/[^"]+/g) || [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function run(endpoint, input, label, o = {}) {
  const f = o.fetch || fetch, key = o.key || process.env.FAL_KEY, pollMs = o.pollMs ?? 3000;
  const H = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };
  const t0 = Date.now();
  const sub = await (await f(`https://queue.fal.run/${endpoint}`, { method: 'POST', headers: H, body: JSON.stringify(input) })).json();
  if (!sub.request_id) throw new Error(`submit failed: ${JSON.stringify(sub).slice(0, 400)}`);
  if (o.onSubmit) o.onSubmit(sub);
  for (;;) {
    const st = await (await f(sub.status_url, { headers: H })).json();
    if (st.status === 'COMPLETED') break;
    if (st.status === 'FAILED' || st.error) throw new Error(`FAILED ${endpoint}: ${JSON.stringify(st).slice(0, 400)}`);
    await sleep(pollMs);
  }
  const res = await (await f(sub.response_url, { headers: H })).json();
  if (res.detail) throw new Error(`FAILED ${endpoint}: ${JSON.stringify(res.detail).slice(0, 600)}`);
  fs.appendFileSync(o.logFile || LOG, JSON.stringify({ t: new Date().toISOString(), label, endpoint, request_id: sub.request_id,
    secs: Math.round((Date.now() - t0) / 1000), input, urls: urlsIn(res) }) + '\n');
  return res;
}

export async function upload(file, o = {}) {
  const key = o.key || process.env.FAL_KEY;
  const content_type = MIME[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream';
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', { method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: path.basename(file), content_type }) });
  if (!init.ok) throw new Error(`upload initiate ${init.status}: ${(await init.text()).slice(0, 300)}`);
  const { upload_url, file_url } = await init.json();
  const put = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': content_type }, body: fs.readFileSync(file) });
  if (!put.ok) throw new Error(`upload put ${put.status}`);
  return file_url;
}

export async function download(url, out) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [endpoint, inputFile, label] = process.argv.slice(2);
  const res = await run(endpoint, JSON.parse(fs.readFileSync(inputFile, 'utf8')), label || path.basename(inputFile),
    { onSubmit: s => console.error(`submitted ${endpoint} ${s.request_id}`) });
  console.log(JSON.stringify(res, null, 2));
}
