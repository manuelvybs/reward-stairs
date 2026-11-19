// node tools/inspect-glb.mjs file.glb [--expect-clips a,b,c]
// Prints size, meshes, triangles, bones, animation clips (name + duration) and textures.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'node:fs';
import { MeshoptDecoder } from 'meshoptimizer';

const [file, flag, list] = process.argv.slice(2);
await MeshoptDecoder.ready;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(file);
const root = doc.getRoot();
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  const idx = p.getIndices();
  tris += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
}
const bones = root.listSkins().flatMap(s => s.listJoints().map(j => j.getName()));
const clips = root.listAnimations().map(a => {
  const d = Math.max(0, ...a.listSamplers().map(s => s.getInput().getMax([])[0] ?? 0));
  return `${a.getName()} (${d.toFixed(2)}s)`;
});
const tex = root.listTextures().map(t => `${t.getMimeType()} ${t.getSize()?.join('x')} ${(t.getImage().byteLength / 1024).toFixed(0)}KB`);
console.log(JSON.stringify({ file, MB: +(fs.statSync(file).size / 1e6).toFixed(2), meshes: root.listMeshes().length,
  tris: Math.round(tris), bones: bones.length, boneNames: bones, clips, textures: tex }, null, 2));
if (flag === '--expect-clips') {
  const have = new Set(root.listAnimations().map(a => a.getName()));
  const miss = list.split(',').filter(c => !have.has(c));
  if (miss.length) { console.error('MISSING clips:', miss.join(', ')); process.exit(1); }
  console.error('all clips present');
}
