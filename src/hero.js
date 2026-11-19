// Reward Stairs — the rigged VYBS astronaut (from Reward River): loads the GLB, crossfades clips, soft blob shadow.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { T } from './config.js';

const ONCE = new Set(['jump', 'land', 'sit', 'wave', 'cheer']);

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(20,10,60,0.55)'); grd.addColorStop(0.6, 'rgba(20,10,60,0.22)'); grd.addColorStop(1, 'rgba(20,10,60,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export async function loadHero(url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url).catch(() => new Promise(r => setTimeout(r, 500)).then(() => loader.loadAsync(url)));
  const model = gltf.scene;
  model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) { const m = o.material; if (m.map) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = 0.32; } } } });
  const box = new THREE.Box3().setFromObject(model);
  model.scale.setScalar(T.heroHeight / (box.max.y - box.min.y));
  model.position.y = -box.min.y * model.scale.y;
  const root = new THREE.Group(); root.add(model);
  return new Hero(root, model, gltf.animations);
}

class Hero {
  constructor(root, model, clips) {
    this.root = root; this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const c of clips) {
      const a = this.mixer.clipAction(c);
      if (ONCE.has(c.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[c.name] = a;
    }
    this.name = ''; this.current = null; this.yaw = 0;
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, fog: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.renderOrder = 2;
  }
  play(name, speed = 1, fade = 0.2, from = null) {
    const a = this.actions[name] || this.actions.idle;
    if (name !== this.name) {
      a.reset(); if (from !== null) a.time = from;
      a.setEffectiveWeight(1).fadeIn(fade).play();
      if (this.current && this.current !== a) this.current.fadeOut(fade);
      this.current = a; this.name = name;
    }
    a.timeScale = speed;
  }
  finished(name) { const a = this.actions[name]; return !a || (this.name === name && a.time >= a.getClip().duration - 0.05); }
  faceTowards(dx, dz, dt, k = 10) {
    const target = Math.atan2(dx, dz);
    let d = target - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * (1 - Math.exp(-dt * k));
    this.root.rotation.y = this.yaw;
  }
  setShadow(x, groundY, z, heightAbove) {
    const k = Math.max(0, 1 - heightAbove / 3);
    this.shadow.visible = k > 0.02;
    this.shadow.position.set(x, groundY + 0.02, z);
    this.shadow.scale.setScalar(0.85 * (0.6 + 0.4 * k));
    this.shadow.material.opacity = k;
  }
  update(dt) { this.mixer.update(dt); }
}
