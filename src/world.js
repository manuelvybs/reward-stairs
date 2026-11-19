// Reward Stairs — the scenery: painted sky dome, cloud sea billboards, moonstone stairs on rock islands, crystals,
// sparkle flowers, drifting motes and the crescent moon.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { frame, worldXZ, SEG, FLIGHTS, GAPS, groundRef, MOON, H5, S_EDGE } from './level.js';
import { rr, rng, mulberry, noise3, clamp, lerp, smooth, pick } from './util.js';
import { PAL } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
const _f = {}, _p = {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
function at(s, n, y) { worldXZ(s, n, _p); return v3(_p.x, y, _p.z); }
const yawAt = s => -frame(s, _f).h;   // rotation.y that lines local +X up with the path tangent

// ---- canvas sprites ------------------------------------------------------------------------------------------------
export function sparkleTexture() {     // the VYBS four-point sparkle, soft glow around it
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.16)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff'; g.beginPath();
  const r = 60, w = 9;
  g.moveTo(64, 64 - r); g.quadraticCurveTo(64 + w * 0.6, 64 - w * 0.6, 64 + r, 64); g.quadraticCurveTo(64 + w * 0.6, 64 + w * 0.6, 64, 64 + r);
  g.quadraticCurveTo(64 - w * 0.6, 64 + w * 0.6, 64 - r, 64); g.quadraticCurveTo(64 - w * 0.6, 64 - w * 0.6, 64, 64 - r); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.14)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
export const GLOW = { tex: null };

// sparkle points with per-point colour, size and twinkle (additive)
export class Sparkles {
  constructor(max, tex) {
    this.max = max; this.n = 0;
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max); this.ph = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aPh', new THREE.BufferAttribute(this.ph, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 400 }, uTime: { value: 0 }, uTw: { value: 0.35 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize; attribute float aPh; uniform float uScale, uTime, uTw; varying vec4 vCol; varying float vRot;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float tw = 1.0 - uTw + uTw * (0.5 + 0.5 * sin(uTime * (1.3 + fract(aPh * 7.1) * 2.2) + aPh * 6.28));
          gl_PointSize = aSize * tw * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; vCol = aCol; vCol.a *= mix(0.6, 1.0, tw); }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vCol; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vCol.rgb * t.rgb * t.a * vCol.a, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 8;
    g.setDrawRange(0, 0);
  }
  add(p, size, r, g, b, a = 1) {
    if (this.n >= this.max) return -1;
    const i = this.n++;
    this.pos.set([p.x, p.y, p.z], i * 3); this.col.set([r, g, b, a], i * 4); this.size[i] = size; this.ph[i] = rng();
    this.geo.setDrawRange(0, this.n); this.dirty();
    return i;
  }
  dirty() { for (const k of ['position', 'aCol', 'aSize']) this.geo.attributes[k].needsUpdate = true; this.geo.attributes.aPh.needsUpdate = true; }
}

// ---- sky ---------------------------------------------------------------------------------------------------------
function buildSky(dusk, night) {
  for (const t of [dusk, night]) { t.wrapS = THREE.MirroredRepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; }
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDusk: { value: dusk }, tNight: { value: night }, uNight: { value: 0 }, uBelow: { value: new THREE.Color(PAL.belowDusk) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDusk, tNight; uniform float uNight; uniform vec3 uBelow; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float u = atan(d.z, d.x) / 6.2831853 * 2.0;
        float e = asin(clamp(d.y, -1.0, 1.0));
        float v = clamp((e + 0.16) / 1.05, 0.004, 0.996);
        vec3 c = mix(texture2D(tDusk, vec2(u, v)).rgb, texture2D(tNight, vec2(u, v)).rgb, uNight);
        c = mix(c, uBelow, smoothstep(-0.03, -0.15, e));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

// ---- rock blobs: lumpy, flat-topped, painted by vertex colour (lit top, indigo flank, rosy bounce underneath) -----
function blobGeometry(seed, detail = 2) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, r = mulberry(seed), o = [r() * 50, r() * 50, r() * 50];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = 1 + 0.2 * noise3(x * 1.4 + o[0], y * 1.4 + o[1], z * 1.4 + o[2]) + 0.07 * noise3(x * 3.3 + o[1], y * 3.3 + o[2], z * 3.3 + o[0]);
    x *= d; y *= d; z *= d;
    if (y > 0.5) y = 0.5 + (y - 0.5) * 0.3;     // flattish tops to stand stairs on
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, col = new Float32Array(p.count * 3);
  const top = new THREE.Color(PAL.rockTop), side = new THREE.Color(PAL.rockSide), bot = new THREE.Color(PAL.rockBottom), bounce = new THREE.Color(PAL.rockBounce), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const ny = n.getY(i), y = p.getY(i);
    c.copy(side).lerp(top, smooth((ny - 0.25) / 0.6)).lerp(bot, smooth((-ny - 0.1) / 0.7) * 0.8);
    c.lerp(bounce, smooth((-y - 0.55) / 0.5) * 0.55);
    const k = 1 + 0.06 * noise3(p.getX(i) * 4, y * 4, p.getZ(i) * 4);
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ---- the crescent moon ---------------------------------------------------------------------------------------------
function craterTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#f3f4ff'; g.fillRect(0, 0, 512, 512);
  const r = mulberry(77);
  for (let i = 0; i < 46; i++) {
    const x = r() * 512, y = r() * 512, rad = 8 + r() * r() * 46;
    g.fillStyle = `rgba(178, 186, 236, ${0.35 + r() * 0.3})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x - rad * 0.18, y - rad * 0.18, rad * 0.72, 0, 7); g.fill();
    g.fillStyle = `rgba(190, 196, 240, 0.5)`; g.beginPath(); g.arc(x + rad * 0.08, y + rad * 0.08, rad * 0.6, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.2, 0.2);
  return t;
}
function buildMoon() {
  const R = MOON.R, r = R * 0.92, d = R * 0.3, bevel = R * 0.1;
  const yi = (R * R - r * r + d * d) / (2 * d), xi = Math.sqrt(R * R - yi * yi);
  const th1 = Math.atan2(yi, xi), th2 = Math.atan2(yi, -xi), ph2 = Math.atan2(yi - d, -xi), ph1 = Math.atan2(yi - d, xi);
  const sh = new THREE.Shape();
  sh.moveTo(xi, yi);
  sh.absarc(0, 0, R, th1, th2 - Math.PI * 2, true);
  sh.absarc(0, d, r, ph2, ph1 + Math.PI * 2, false);
  const depth = R * 0.42;
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: R * 0.14, bevelSize: bevel, bevelSegments: 6, curveSegments: 64 });
  geo.translate(0, 0, -depth / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#e2e6ff', emissive: '#c8d2ff', emissiveIntensity: 0.45, roughness: 0.95, metalness: 0, map: craterTexture() });
  const moon = new THREE.Mesh(geo, mat);
  const tilt = -0.32;
  moon.rotation.z = tilt;
  const group = new THREE.Group(); group.add(moon);
  const c = at(MOON.s, MOON.n, MOON.y); group.position.copy(c);
  group.lookAt(at(S_EDGE - 6, 9, H5 + 4));       // face the summit / ending camera
  // glow behind it
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW.tex, color: '#cdd6ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false }));
  glow.scale.setScalar(R * 5.2); glow.position.z = -R * 0.5; glow.renderOrder = -2; group.add(glow);
  // where the astronaut sits: the bottom of the inner curve, lifted by the bevel (local, before tilt)
  const seatLocal = v3(0, d - r + bevel + 0.02, 0).applyAxisAngle(v3(0, 0, 1), tilt);
  group.updateMatrixWorld(true);
  const seat = seatLocal.clone().applyMatrix4(group.matrixWorld);
  return { group, moon, glow, mat, seat, center: c };
}

// ---- the world ---------------------------------------------------------------------------------------------------
export class World {
  constructor(scene, tex) {
    this.scene = scene;
    GLOW.tex = glowTexture();
    this.spark = sparkleTexture();
    this.sky = buildSky(tex.sky_dusk, tex.sky_night); scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.05); scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(PAL.keyDusk, 1.5); scene.add(this.key); scene.add(this.key.target);
    this.rim = new THREE.DirectionalLight(PAL.rimDusk, 0.9); scene.add(this.rim); scene.add(this.rim.target);
    scene.fog = new THREE.Fog(PAL.fogDusk, 30, 170);
    this.clouds = [];
    this.buildStairs(); this.buildLedges(); this.buildRocks(); this.buildCrystals(); this.buildFlowers(); this.buildClouds(tex); this.buildMotes();
    this.moon = buildMoon(); scene.add(this.moon.group);
    this.skyStars = new Sparkles(260, this.spark); scene.add(this.skyStars.points);
    for (let i = 0; i < 240; i++) {                  // night twinkles high in the sky, faded in as it gets dark
      const s = rr(-20, 140), F = frame(s, _f), n = rr(-160, -40), y = rr(25, 110);
      this.skyStars.add(v3(F.x + F.nx * n + F.tx * rr(-30, 30), y, F.z + F.nz * n + F.tz * rr(-30, 30)), rr(1.2, 3.4), 1, rng() < 0.3 ? 0.86 : 1, rng() < 0.3 ? 0.55 : 1, 0);
    }
  }

  // moonstone steps with a thin gold nose
  buildStairs() {
    const steps = SEG.filter(g => g.kind === 'step');
    const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
    { const n = geo.attributes.normal, col = new Float32Array(n.count * 3), tread = new THREE.Color('#ffffff'), riser = new THREE.Color('#9d93d6'), cc = new THREE.Color();
      for (let i = 0; i < n.count; i++) { cc.copy(riser).lerp(tread, smooth((n.getY(i) - 0.2) / 0.6)); col.set([cc.r, cc.g, cc.b], i * 3); }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true });
    const mesh = new THREE.InstancedMesh(geo, mat, steps.length);
    const nose = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: PAL.stepEdge, fog: true }), steps.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), base = new THREE.Color(PAL.step);
    steps.forEach((g, i) => {
      const mid = (g.a + g.b) / 2, len = g.b - g.a + 0.04, hgt = 0.62, wid = 1.62 + rr(-0.05, 0.05);
      q.setFromAxisAngle(UP, yawAt(mid) + rr(-0.02, 0.02));
      m.compose(at(mid, rr(-0.03, 0.03), g.h - hgt / 2), q, v3(len, hgt, wid));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.copy(base).multiplyScalar(rr(0.9, 1.04)).lerp(new THREE.Color('#e9d5f2'), rng() * 0.25));
      q.setFromAxisAngle(UP, yawAt(g.a));
      m.compose(at(g.a + 0.01, 0, g.h - 0.012), q, v3(0.035, 0.035, wid * 0.92));
      nose.setMatrixAt(i, m);
    });
    this.scene.add(mesh, nose);
  }

  // landings + the summit plateau: rounded slabs, split into short pieces so they follow the curve
  buildLedges() {
    const flats = SEG.filter(g => g.kind !== 'step');
    const pieces = [];
    for (const g of flats) {
      const a = g.kind === 'start' ? g.a - 3 : g.a, b = g.kind === 'summit' ? g.b + 3 : g.b;
      const n = Math.max(1, Math.ceil((b - a) / 2.4));
      for (let k = 0; k < n; k++) pieces.push({ a: a + (b - a) * k / n, b: a + (b - a) * (k + 1) / n, h: g.h, wide: g.kind === 'summit' ? 5.2 : g.kind === 'start' ? 3.6 : 2.5, back: g.kind === 'summit' ? -1.2 : -0.25 });
    }
    const mesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 3, 0.14), new THREE.MeshLambertMaterial({ color: '#ffffff' }), pieces.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(PAL.step);
    pieces.forEach((p, i) => {
      const mid = (p.a + p.b) / 2;
      q.setFromAxisAngle(UP, yawAt(mid));
      m.compose(at(mid, p.back + rr(-0.05, 0.05), p.h - 0.45 + rr(-0.012, 0)), q, v3(p.b - p.a + 0.35, 0.9, p.wide));
      mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.clone().multiplyScalar(rr(0.82, 0.92)));
    });
    this.scene.add(mesh);
  }

  // rock islands under the stairs and ledges, fading down into the cloud sea
  buildRocks() {
    const bases = [11, 23, 37, 52].map(sd => blobGeometry(sd));
    const items = [];
    const add = (s, n, y, sx, sy, sz, shade = 1) => items.push({ s, n, y, sx, sy, sz, shade, b: Math.floor(rng() * bases.length), yaw: rr(0, 6.28) });
    const inGap = s => GAPS.some(([a, b]) => s > a + 0.4 && s < b - 0.4) || (s > 38.1 && s < 38.9);
    for (let s = -8; s < 98; s += rr(0.9, 1.4)) {
      if (inGap(s)) continue;
      const top = groundRef(s), summit = s > 70;
      add(s, rr(-0.35, 0.25) + (summit ? -1 : 0), top - rr(1.25, 1.7), rr(0.9, 1.3), rr(0.9, 1.2), (summit ? 2.6 : 1.25) + rr(0, 0.3));
      add(s + rr(-0.5, 0.5), rr(-0.8, 0.6) + (summit ? -1.2 : 0), top - rr(3.2, 4.4), rr(1.4, 2.0), rr(1.6, 2.2), (summit ? 3.2 : 1.7) + rr(0, 0.4), 0.9);
      if (rng() < 0.55) add(s, rr(-1.6, 0.6), top - rr(6, 8), rr(1.6, 2.4), rr(2, 2.8), rr(1.6, 2.4), 0.8);
      if (rng() < 0.22 && !summit) add(s, rr(-1.6, -1.15), top + rr(-0.2, 0.3), rr(0.35, 0.6), rr(0.4, 0.7), rr(0.35, 0.55));   // boulders behind
    }
    for (let s = 72; s < 96; s += rr(1.6, 2.6)) add(s, rr(-3.9, -3.1), H5 + rr(-0.2, 0.5), rr(0.7, 1.3), rr(0.7, 1.4), rr(0.7, 1.1));     // summit rim
    const byBase = bases.map(() => []);
    for (const it of items) byBase[it.b].push(it);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    bases.forEach((geo, bi) => {
      const list = byBase[bi];
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
      list.forEach((it, i) => {
        q.setFromAxisAngle(UP, it.yaw);
        m.compose(at(it.s, it.n, it.y), q, v3(it.sx, it.sy, it.sz));
        mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.setScalar(it.shade * rr(0.92, 1.05)));
      });
      this.scene.add(mesh);
    });
  }

  buildCrystals() {
    const spots = [];
    const cluster = (s, n, y, k = 3, sc = 1) => { for (let i = 0; i < k; i++) spots.push({ s: s + rr(-0.25, 0.25), n: n + rr(-0.15, 0.15), y, h: rr(0.18, 0.5) * sc, tilt: rr(-0.5, 0.5), col: pick(PAL.crystals) }); };
    for (let s = 1; s < 70; s += rr(2.2, 3.6)) { if (GAPS.some(([a, b]) => s > a - 0.3 && s < b + 0.3)) continue; cluster(s, rng() < 0.7 ? -0.95 : 0.92, groundRef(s), 2 + Math.floor(rng() * 3)); }
    for (let s = 71; s < 94; s += rr(1.2, 2.2)) cluster(s, rr(-3.2, -1.4), H5, 3 + Math.floor(rng() * 3), 1.6);
    for (let s = 72; s < 92; s += rr(3, 5)) cluster(s, rr(1.2, 2.1), H5, 2, 0.9);
    const geo = new THREE.OctahedronGeometry(1, 0); geo.translate(0, 1, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7a6cff', emissiveIntensity: 0.35, roughness: 0.25, metalness: 0.1, flatShading: true }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    spots.forEach((sp, i) => {
      q.setFromEuler(e.set(sp.tilt * 0.5, rr(0, 6.28), sp.tilt));
      m.compose(at(sp.s, sp.n, sp.y - 0.04), q, v3(sp.h * 0.32, sp.h, sp.h * 0.32));
      mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.set(sp.col));
    });
    this.scene.add(mesh);
    this.crystalSpots = spots;
  }

  // little glowing sparkle flowers along the stair edges
  buildFlowers() {
    this.flowers = new Sparkles(420, this.spark);
    for (let s = -4; s < 95; s += rr(0.25, 0.6)) {
      if (GAPS.some(([a, b]) => s > a - 0.1 && s < b + 0.1)) continue;
      const summit = s > 70.5, n = summit ? rr(-3.4, 2.2) : (rng() < 0.6 ? rr(-0.95, -0.75) : rr(0.72, 0.92));
      const warm = rng() < 0.5;
      this.flowers.add(at(s, n, groundRef(s) + rr(0.06, 0.2)), rr(0.12, 0.26), warm ? 1 : 0.75, warm ? 0.86 : 0.85, warm ? 0.55 : 1, 0.95);
    }
    this.scene.add(this.flowers.points);
  }

  buildClouds(tex) {
    const kinds = { bank_a: tex.bank_a, bank_b: tex.bank_b, tower: tex.tower, puff: tex.puff };
    for (const t of Object.values(kinds)) t.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1, 1);
    const add = (kind, s, n, y, w, layer) => {
      const t = kinds[kind], img = t.image, h = w * img.height / img.width;
      const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: true, alphaTest: 0.02 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(rng() < 0.5 ? w : -w, h, 1);
      mesh.position.copy(at(s, n, y + h * 0.3));
      mesh.renderOrder = layer;
      mesh.userData = { base: mesh.position.clone(), drift: rr(0.4, 1.2), ph: rr(0, 6.28) };
      this.scene.add(mesh); this.clouds.push(mesh);
    };
    const banks = ['bank_a', 'bank_b', 'puff'];
    const g = s => groundRef(clamp(s, -4, 92));
    for (let s = -14; s < 108; s += rr(3.2, 5)) {               // the cloud sea under the path
      add(pick(banks), s, rr(-11, -3), g(s) - rr(5.5, 8), rr(9, 15), 1);
      add(pick(banks), s + 2, rr(-2, 6), g(s) - rr(6.5, 9), rr(9, 14), 1);
    }
    for (let s = -12; s < 104; s += rr(4.5, 7)) add(pick(banks), s, rr(8.5, 12), g(s) - rr(4.2, 6), rr(8, 12), 2);   // framing the bottom of the view
    for (let s = -40; s < 160; s += rr(9, 14)) add(pick(banks), s, rr(-48, -28), g(s) + rr(-7, 1), rr(26, 44), 0);  // big banks behind
    for (let s = -40; s < 170; s += rr(16, 24)) add('tower', s, rr(-90, -60), g(s) + rr(-6, 4), rr(26, 40), 0);
    for (let s = -20; s < 150; s += rr(7, 11)) add('puff', s, rr(-70, -26), g(s) + rr(7, 22), rr(5, 11), 0);   // high puffs
  }

  buildMotes() {
    this.motes = new Sparkles(140, this.spark);
    this.moteBase = [];
    for (let i = 0; i < 140; i++) {
      this.moteBase.push([rr(-9, 9), rr(-3, 12), rr(-7, 4), rr(0, 6.28)]);
      this.motes.add(v3(0, 0, 0), rr(0.05, 0.12), 1, rr(0.85, 1), rr(0.7, 1), 0.7);
    }
    this.motes.mat.uniforms.uTw.value = 0.7;
    this.scene.add(this.motes.points);
  }

  // per frame: night amount 0..1, camera for billboards, a centre point for motes
  update(dt, t, night, camera, centre) {
    const u = this.sky.material.uniforms;
    u.uNight.value = night;
    u.uBelow.value.set(PAL.belowDusk).lerp(new THREE.Color(PAL.belowNight), night);
    this.sky.position.copy(camera.position);
    this.scene.fog.color.set(PAL.fogDusk).lerp(new THREE.Color(PAL.fogNight), night);
    this.hemi.intensity = lerp(1.05, 0.9, night);
    this.key.color.set(PAL.keyDusk).lerp(new THREE.Color(PAL.keyNight), night); this.key.intensity = lerp(2.1, 1.6, night);
    this.rim.color.set(PAL.rimDusk).lerp(new THREE.Color(PAL.rimNight), night);
    // key light from the camera side and above, rim from behind the path
    frame(clamp(centre.s, -4, 92), _f);
    this.key.position.set(centre.x + _f.nx * 10 - _f.tx * 6, centre.y + 14, centre.z + _f.nz * 10 - _f.tz * 6); this.key.target.position.set(centre.x, centre.y, centre.z);
    this.rim.position.set(centre.x - _f.nx * 12 + _f.tx * 4, centre.y + 5, centre.z - _f.nz * 12 + _f.tz * 4); this.rim.target.position.set(centre.x, centre.y, centre.z);
    // clouds face the camera (around Y) and drift; tint them cooler at night
    const tint = PAL.cloudNight;
    for (const c of this.clouds) {
      const d = c.userData;
      c.position.x = d.base.x + Math.sin(t * 0.05 + d.ph) * d.drift;
      c.rotation.y = Math.atan2(camera.position.x - c.position.x, camera.position.z - c.position.z);
      c.material.color.setRGB(lerp(0.9, tint[0], night), lerp(0.88, tint[1], night), lerp(0.92, tint[2], night));
    }
    this.skyStars.mat.uniforms.uTime.value = t; this.flowers.mat.uniforms.uTime.value = t; this.motes.mat.uniforms.uTime.value = t;
    const a = clamp(night * 1.5 - 0.2, 0, 1);
    for (let i = 0; i < this.skyStars.n; i++) this.skyStars.col[i * 4 + 3] = a * 0.9;
    this.skyStars.geo.attributes.aCol.needsUpdate = true;
    // motes drift upward around the hero
    for (let i = 0; i < this.moteBase.length; i++) {
      const [x, y, z, ph] = this.moteBase[i];
      const yy = ((y + t * 0.25 + ph) % 15) - 3;
      this.motes.pos[i * 3] = centre.x + x + Math.sin(t * 0.3 + ph) * 0.6;
      this.motes.pos[i * 3 + 1] = centre.y + yy;
      this.motes.pos[i * 3 + 2] = centre.z + z + Math.cos(t * 0.25 + ph) * 0.6;
    }
    this.motes.geo.attributes.position.needsUpdate = true;
    this.moon.glow.material.opacity = lerp(0.3, 0.7, night) * (this.moonBoost || 1);
    this.moon.mat.emissiveIntensity = lerp(0.32, 0.48, night) * (this.moonBoost || 1);
  }

  setPointScale(px) { for (const s of [this.skyStars, this.flowers, this.motes]) s.mat.uniforms.uScale.value = px; }
}
