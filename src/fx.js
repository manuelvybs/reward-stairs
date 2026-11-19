// Reward Stairs — particles (from Reward River): one pooled point system per blend mode (soft dust/splash, additive sparkles).
//   fx.emit(kind, pos, n, opts)   kind = 'soft' | 'glow'
//   opts: color, size, life, speed (outward), up (vertical speed), spread (position jitter), gravity, grow
import * as THREE from 'three';

const VS = `
  attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
  varying float vAlpha; varying vec3 vColor;
  uniform float uScale;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
    vAlpha = aAlpha; vColor = aColor;
  }`;
const FS = `
  varying float vAlpha; varying vec3 vColor;
  void main(){
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.35, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }`;

class Pool {
  constructor(scene, max, blending) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max); this.life = new Float32Array(max); this.age = new Float32Array(max);
    this.grav = new Float32Array(max); this.grow = new Float32Array(max); this.a0 = new Float32Array(max);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uScale: { value: 300 } }, transparent: true, depthWrite: false, blending });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  emit(p, n, { color = [1, 1, 1], size = 0.4, life = 0.8, speed = 1, up = 1, spread = 0.2, gravity = 0, grow = 1, alpha = 0.8 } = {}) {
    for (let k = 0; k < n; k++) {
      const i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);   // full: recycle a random one
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.pos[i * 3] = p.x + (Math.random() - 0.5) * spread; this.pos[i * 3 + 1] = p.y + Math.random() * spread * 0.5; this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread;
      this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = up * (0.5 + Math.random() * 0.5); this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.col[i * 3] = color[0]; this.col[i * 3 + 1] = color[1]; this.col[i * 3 + 2] = color[2];
      this.size[i] = size * (0.7 + Math.random() * 0.6); this.life[i] = life * (0.7 + Math.random() * 0.6); this.age[i] = 0;
      this.grav[i] = gravity; this.grow[i] = grow; this.a0[i] = alpha; this.alpha[i] = alpha;
    }
  }

  update(dt) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) continue;
      if (w !== i) {   // compact the live particles to the front
        for (let c = 0; c < 3; c++) { this.pos[w * 3 + c] = this.pos[i * 3 + c]; this.vel[w * 3 + c] = this.vel[i * 3 + c]; this.col[w * 3 + c] = this.col[i * 3 + c]; }
        this.size[w] = this.size[i]; this.life[w] = this.life[i]; this.age[w] = this.age[i]; this.grav[w] = this.grav[i]; this.grow[w] = this.grow[i]; this.a0[w] = this.a0[i];
      }
      this.vel[w * 3 + 1] -= this.grav[w] * dt;
      const drag = Math.exp(-2.2 * dt);
      this.vel[w * 3] *= drag; this.vel[w * 3 + 2] *= drag;
      for (let c = 0; c < 3; c++) this.pos[w * 3 + c] += this.vel[w * 3 + c] * dt;
      this.size[w] *= 1 + this.grow[w] * dt;
      const k = this.age[w] / this.life[w];
      this.alpha[w] = this.a0[w] * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
      w++;
    }
    this.n = w;
    this.geo.setDrawRange(0, this.n);
    for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.attributes[a].needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.soft = new Pool(scene, 900, THREE.NormalBlending);
    this.glow = new Pool(scene, 300, THREE.AdditiveBlending);
  }
  emit(kind, p, n, opts) { this[kind].emit(p, n, opts); }
  setScale(h) { this.soft.mat.uniforms.uScale.value = this.glow.mat.uniforms.uScale.value = h * 0.45; }
  update(dt) { this.soft.update(dt); this.glow.update(dt); }
}
