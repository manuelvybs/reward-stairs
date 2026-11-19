// node tools/matte.mjs name...  — birefnet v2 Matting on art-src/<name>.png -> art-src/<name>_cut.png
import { run, upload, download } from './fal.mjs';
await Promise.all(process.argv.slice(2).map(async n => {
  const url = await upload(`art-src/${n}.png`);
  const res = await run('fal-ai/birefnet/v2', { image_url: url, model: 'Matting', operating_resolution: '2048x2048', refine_foreground: true, output_format: 'png' }, `matte_${n}`);
  await download(res.image.url, `art-src/${n}_cut.png`); console.log('ok', n);
}));
