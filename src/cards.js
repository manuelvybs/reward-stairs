// Reward Stairs — gift cards: the floating pickups, the hover-card platforms, cards flying off to become stars,
// and the card staircase of the ending.
import * as THREE from 'three';
import { worldXZ, frame } from './level.js';
import { rr, rng, clamp, lerp, smooth } from './util.js';
import { CARDS } from './config.js';
import { GLOW } from './world.js';

const _p = {}, _f = {};
const UP = new THREE.Vector3(0, 1, 0);
export function atPath(s, n, y, out = new THREE.Vector3()) { worldXZ(s, n, _p); return out.set(_p.x, y, _p.z); }

// rounded-rectangle card slab; caps carry the brand face (UVs 0..1 over the card), sides a gold edge
export function cardGeometry(L, W, depth, rad) {
  const s = new THREE.Shape(), x = -L / 2, y = -W / 2;
  s.moveTo(x + rad, y); s.lineTo(x + L - rad, y); s.quadraticCurveTo(x + L, y, x + L, y + rad); s.lineTo(x + L, y + W - rad);
  s.quadraticCurveTo(x + L, y + W, x + L - rad, y + W); s.lineTo(x + rad, y + W); s.quadraticCurveTo(x, y + W, x, y + W - rad);
  s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 5 });
  g.translate(0, 0, -depth / 2);
  const pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nrm.getZ(i)) > 0.9) {
      const u = (pos.getX(i) + L / 2) / L, v = (pos.getY(i) + W / 2) / W;
      uv.setXY(i, nrm.getZ(i) > 0 ? u : 1 - u, v);   // back face reads the right way round too
    }
  }
  return g;
}

export class CardKit {
  constructor(tex) {
    this.mats = {};
    for (const k of CARDS) {
      const t = tex[k]; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      this.mats[k] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.05, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.5 });
    }
    this.edge = new THREE.MeshStandardMaterial({ color: '#ffd45a', emissive: '#ffb300', emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.4 });
    this.blank = new THREE.MeshStandardMaterial({ color: '#6b5cff', emissive: '#4a3fd6', emissiveIntensity: 0.5, roughness: 0.4 });
    this.small = cardGeometry(0.74, 0.48, 0.04, 0.06);       // pickups
    this.big = cardGeometry(1.24, 0.8, 0.07, 0.09);          // hover-card platforms
    this.step = cardGeometry(1.2, 0.77, 0.06, 0.08);         // ending staircase
    let i = 0; this.next = () => CARDS[i++ % CARDS.length];
  }
  mesh(geo, brand) {
    const face = brand === 'blank' ? this.blank : this.mats[brand];
    const m = new THREE.Mesh(geo, [face.clone(), this.edge.clone()]);
    m.userData.brand = brand;
    return m;
  }
}

function halo(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW.tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, fog: false }));
  s.scale.setScalar(size); s.renderOrder = 6;
  return s;
}
function setOpacity(mesh, a) {
  for (const m of mesh.material) { if (!m.transparent && a < 1) { m.transparent = true; m.needsUpdate = true; } m.opacity = a; }
}

// ---- pickups: float, sway towards the camera, shine ------------------------------------------------------------------
export class PickupView {
  constructor(scene, kit, logic) {
    this.logic = logic; this.brand = kit.next();
    this.mesh = kit.mesh(kit.small, this.brand);
    this.halo = halo('#ffe39a', 1.5);
    this.pos = atPath(logic.s, logic.n, logic.y);
    scene.add(this.mesh, this.halo);
  }
  update(t, camera) {
    const L = this.logic;
    if (L.state !== 'idle') { this.mesh.visible = this.halo.visible = false; return; }
    atPath(L.s, L.n, L.y, this.pos);
    this.mesh.position.copy(this.pos); this.halo.position.copy(this.pos);
    const face = Math.atan2(camera.position.x - this.pos.x, camera.position.z - this.pos.z);
    this.mesh.rotation.set(Math.sin(t * 1.3 + L.phase) * 0.12, face + Math.sin(t * 1.1 + L.phase) * 0.55, Math.sin(t * 0.9 + L.phase) * 0.1);
    this.halo.material.opacity = 0.42 + 0.12 * Math.sin(t * 3 + L.phase);
  }
}

// ---- hover-card platforms --------------------------------------------------------------------------------------------
export class PlatformView {
  constructor(scene, kit, logic) {
    this.logic = logic; this.brand = kit.next();
    this.mesh = kit.mesh(kit.big, this.brand);
    this.under = halo('#ffd27a', 2.6); this.under.material.opacity = 0.35;
    this.pos = new THREE.Vector3();
    scene.add(this.mesh, this.under);
  }
  update(t) {
    const L = this.logic;
    const vis = L.alpha > 0.02;
    this.mesh.visible = this.under.visible = vis;
    if (!vis) return;
    atPath(L.curS, 0, L.top - 0.035, this.pos);
    const yaw = -frame(L.curS, _f).h;
    this.mesh.position.copy(this.pos);
    const sh = L.shake ? Math.sin(t * 38) * 0.05 : 0;
    // lie flat (card face up), long side along the path
    this.mesh.rotation.set(-Math.PI / 2 + Math.sin(t * 1.4 + L.phase) * 0.03 + sh + L.flip, 0, 0);
    this.mesh.rotation.order = 'YXZ'; this.mesh.rotation.y = yaw;
    this.mesh.rotation.z = Math.sin(t * 1.1 + L.phase) * 0.035 + sh * 0.6;
    this.under.position.copy(this.pos).y -= 0.25;
    this.under.material.opacity = (0.16 + 0.34 * L.glow) * L.alpha;
    for (const m of this.mesh.material) m.emissiveIntensity = (m === this.mesh.material[0] ? 0.5 : 0.55) + L.glow * 0.6;
    setOpacity(this.mesh, L.alpha);
  }
}

// ---- a collected card flies off and becomes a star in the sky ---------------------------------------------------------
export class Flyers {
  constructor(scene, kit, stars) { this.scene = scene; this.kit = kit; this.stars = stars; this.list = []; this.collected = []; }
  launch(from, brand, s) {
    frame(s, _f);
    const target = from.clone().add(new THREE.Vector3(_f.tx * rr(6, 16) - _f.nx * rr(8, 22), rr(14, 24), _f.tz * rr(6, 16) - _f.nz * rr(8, 22)));
    const mesh = this.kit.mesh(this.kit.small, brand);
    mesh.position.copy(from);
    const h = halo('#fff0b8', 1.4);
    this.scene.add(mesh, h);
    this.list.push({ mesh, halo: h, from: from.clone(), target, t: 0, dur: rr(1.5, 1.9), brand, spin: rr(7, 10) * (rng() < 0.5 ? -1 : 1) });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i]; f.t += dt;
      const k = clamp(f.t / f.dur, 0, 1), e = 1 - Math.pow(1 - k, 2.2);
      f.mesh.position.lerpVectors(f.from, f.target, e);
      f.mesh.position.y += Math.sin(Math.min(1, k * 1.6) * Math.PI) * 1.2;     // a little hop first
      f.mesh.rotation.y += dt * f.spin * (1 - k * 0.6); f.mesh.rotation.x = Math.sin(f.t * 5) * 0.3;
      const sc = lerp(1.15, 0.35, smooth(k));
      f.mesh.scale.setScalar(sc);
      f.halo.position.copy(f.mesh.position); f.halo.scale.setScalar(1.2 + k * 1.2);
      f.halo.material.opacity = 0.3 * (1 - k * 0.5);
      setOpacity(f.mesh, 1 - smooth((k - 0.75) / 0.25));
      if (k >= 1) {
        this.scene.remove(f.mesh, f.halo); f.halo.material.dispose(); for (const m of f.mesh.material) m.dispose();
        const idx = this.stars.add(f.target, 1.9, 1, 0.88, 0.6, 0.9);
        this.collected.push({ pos: f.target.clone(), brand: f.brand, idx, born: performance.now() });
        this.list.splice(i, 1);
        this.onStar?.(f.target);
      }
    }
  }
}
