// Reward Stairs — the ending: every gift card you sent to the sky swoops back down and becomes a step; the astronaut
// climbs them to the crescent moon, sits in it and cheers. Cards you missed are filled by plain VYBS-violet cards.
import * as THREE from 'three';
import { frame, S_EDGE, H5 } from './level.js';
import { clamp, lerp, smooth, rr } from './util.js';
import { atPath } from './cards.js';

const _f = {};
const V = () => new THREE.Vector3();

export class Ending {
  constructor({ scene, kit, hero, world, flyers, sound, fx }) { Object.assign(this, { scene, kit, hero, world, flyers, sound, fx }); this.active = false; }

  start(P) {
    this.active = true; this.t = 0; this.done = false; this.sat = false; this.cheered = false;
    this.A = atPath(S_EDGE, 0, H5);
    this.seat = this.world.moon.seat.clone();
    const dir = this.seat.clone().sub(this.A).setY(0); this.dist = dir.length(); dir.normalize();
    this.dir = dir; this.side = new THREE.Vector3(-dir.z, 0, dir.x);
    const got = this.flyers.collected;
    const K = this.K = clamp(got.length, 12, 40);
    this.steps = [];
    const gap = Math.min(0.09, 2.6 / K);
    for (let k = 0; k < K; k++) {
      const f = (k + 1) / (K + 1);
      const target = this.A.clone().addScaledVector(dir, this.dist * f).addScaledVector(this.side, Math.sin(f * Math.PI) * 1.8);
      target.y = this.A.y + (this.seat.y - 0.05 - this.A.y) * f;
      const src = got[k];
      const brand = src ? src.brand : 'blank';
      const from = src ? src.pos.clone() : target.clone().add(new THREE.Vector3(rr(-14, 14), rr(16, 28), rr(-14, 14)));
      if (src) this.world_hideStar(src.idx);
      const mesh = this.kit.mesh(this.kit.step, brand);
      mesh.visible = false; mesh.rotation.order = 'YXZ';
      this.scene.add(mesh);
      const yaw = Math.atan2(dir.x, dir.z) - Math.PI / 2;
      this.steps.push({ target, from, mesh, yaw, arrive: 1.2 + k * gap, dur: 1.15, landed: false, lit: 0 });
    }
    this.climbAt = this.steps[K - 1].arrive + 0.35;
    this.hop = clamp(6.5 / K, 0.24, 0.5);
    this.cur = -1; this.hopT = 0; this.from = V();
    this.walkFrom = P.s;
    this.sound.music(null, 1, 1.2);
    this.sound.bell(392, 0.12, 0, 2.5);
  }
  world_hideStar(idx) { const st = this.flyers.stars; st.col[idx * 4 + 3] = 0; st.geo.attributes.aCol.needsUpdate = true; }

  update(dt, t) {
    if (!this.active) return;
    this.t += dt;
    const h = this.hero, root = h.root;
    // 1) walk to the edge of the summit, look up at the moon
    if (this.t < 1.3) {
      const s = lerp(this.walkFrom, S_EDGE, smooth(this.t / 1.2)); frame(s, _f);
      root.position.set(_f.x, H5, _f.z);
      h.play('walk', 1.1); h.faceTowards(this.dir.x, this.dir.z, dt, 5);
    } else if (this.t < this.climbAt) {
      if (!this.cheered) { this.cheered = true; h.play('cheer', 1, 0.3); }
      h.faceTowards(this.dir.x, this.dir.z, dt, 4);
    }
    // 2) cards swoop down from the stars and line up as steps
    this.steps.forEach((st, i) => {
      const k = clamp((this.t - (st.arrive - st.dur)) / st.dur, 0, 1);
      if (k <= 0) return;
      st.mesh.visible = true;
      const e = smooth(k);
      st.mesh.position.lerpVectors(st.from, st.target, e);
      st.mesh.position.y += Math.sin(e * Math.PI) * 3;
      st.mesh.position.addScaledVector(this.side, Math.sin(e * Math.PI) * 2 * (i % 2 ? 1 : -1));
      st.mesh.rotation.set(lerp(0.3, -Math.PI / 2, e), st.yaw + (1 - e) * 6, 0);
      st.mesh.scale.setScalar(lerp(0.5, 1, e));
      if (k >= 1 && !st.landed) { st.landed = true; this.fx.emit('glow', st.target, 6, { color: [1, 0.9, 0.6], size: 0.3, life: 0.6, speed: 0.8, up: 0.6 }); }
      st.mesh.position.y += Math.sin(t * 2 + i) * 0.03 * (k >= 1 ? 1 : 0);
      st.lit = Math.max(0, st.lit - dt * 0.8);
      st.mesh.material[0].emissiveIntensity = 0.5 + st.lit * 0.8;
    });
    // 3) climb the cards, one hop each, then a big hop into the moon
    if (this.t >= this.climbAt && !this.sat) {
      if (this.cur < 0 || this.hopT >= 1) {
        if (this.cur >= 0 && this.cur < this.K) { const st = this.steps[this.cur]; st.lit = 1; this.sound.chime(this.cur); }
        this.cur++; this.hopT = 0; this.from.copy(root.position);
        if (this.cur === 0) h.play('run', 1.25, 0.2);
      }
      const final = this.cur >= this.K, dur = final ? 0.75 : this.hop;
      this.hopT = Math.min(1, this.hopT + dt / dur);
      const to = final ? this.seat : this.steps[this.cur].target.clone().setY(this.steps[this.cur].target.y + 0.03);
      root.position.lerpVectors(this.from, to, this.hopT);
      root.position.y += Math.sin(this.hopT * Math.PI) * (final ? 0.9 : 0.28);
      if (final) h.play('jump', 1.1, 0.15, 0.3);
      const d = to.clone().sub(this.from); h.faceTowards(d.x, d.z, dt, 10);
      if (final && this.hopT >= 1) {
        this.sat = true; this.satT = 0; h.play('sit', 1, 0.2);
        this.sound.fanfare(); this.sound.music('music_end', 0.9, 0.4);
        this.fx.emit('glow', this.seat.clone().setY(this.seat.y + 0.5), 28, { color: [1, 0.93, 0.7], size: 0.45, life: 1.3, speed: 3, up: 2, spread: 0.6 });
      }
    }
    // 4) sitting in the moon: turn to the camera, cheer
    if (this.sat) {
      this.satT += dt;
      root.position.copy(this.seat);
      const cam = this.camPos || this.seat;
      h.faceTowards(cam.x - this.seat.x, cam.z - this.seat.z, dt, 4);
      if (this.satT > 1.6 && h.name === 'sit') h.play('sitCheer', 1, 0.4);
      this.world.moonBoost = lerp(1, 1.15, smooth(this.satT / 1.5));
      if (Math.random() < dt * 10) this.fx.emit('glow', this.seat.clone().add(new THREE.Vector3(rr(-2.2, 2.2), rr(-0.5, 2.5), rr(-0.8, 0.8))), 1, { color: [1, 0.92, 0.7], size: 0.3, life: 1.2, speed: 0.3, up: 0.8 });
      if (this.satT > 3.2 && !this.done) { this.done = true; this.onDone?.(); }
    }
  }

  // camera: watch the cards arrive from behind the hero, follow the climb, then face the moon
  camera(dt, cam) {
    const h = this.hero.root.position, dir = this.dir, side = this.side;
    const p = V(), l = V();
    if (!this.sat) {
      p.copy(h).addScaledVector(side, -5.5).addScaledVector(dir, -6.5).setY(h.y + 5);
      l.copy(h).addScaledVector(dir, 7).setY(h.y + (this.t < this.climbAt ? 4 : 1.8));
      if (this.t < this.climbAt) l.lerp(this.seat, 0.35);
    } else {
      const k = smooth(this.satT / 3), M = this.world.moon, nw = clamp((1.25 - innerWidth / innerHeight) / 0.75, 0, 1), far = lerp(1, 1.55, nw);
      const out = new THREE.Vector3(0, 0, 1).applyQuaternion(M.group.quaternion);
      p.copy(this.seat).addScaledVector(out, lerp(4.6, 7.8, k) * far).add(new THREE.Vector3(0, lerp(0.9, -0.6, k), 0)).addScaledVector(side, lerp(-1.4, -0.4, k));
      l.copy(this.seat).add(new THREE.Vector3(0, 0.65, 0)).lerp(M.center, lerp(0.05, 0.45, k));
    }
    this.camPos = cam.pos;
    const kk = 1 - Math.exp(-dt * (this.sat ? 1.6 : 2.2));
    cam.pos.lerp(p, kk); cam.look.lerp(l, 1 - Math.exp(-dt * 2.6));
  }
}
