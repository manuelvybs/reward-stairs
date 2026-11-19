// Reward Stairs — post: soft bloom (cards, moon, sparkles), a gentle grade with paper grain + vignette,
// and a watchdog that drops bloom when the frame rate stays low.   ?lowq no bloom   ?hiq never downgrade
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const Grade = {
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uSat: { value: 1.05 }, uVig: { value: 0.3 }, uGrain: { value: 0.045 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uSat, uVig, uGrain; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      vec2 px = floor(vUv * uRes / 2.0);
      c *= 1.0 + (hash(px) - 0.5) * uGrain;                                   // paper grain (static)
      vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y * 0.7;
      float v = smoothstep(0.95, 0.3, length(q));
      c = mix(c * vec3(0.66, 0.6, 0.92), c, mix(1.0, v, uVig * 1.6));     // violet vignette
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, q) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.5, 0.93);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(Grade); this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.low = q.has('lowq'); this.lock = q.has('hiq');
    if (this.low) this.bloom.enabled = false;
    this.win = { t: 0, frames: 0 }; this.fps = 60;
  }
  setSize(w, h) { this.composer.setSize(w, h); this.bloom.setSize(w, h); this.grade.uniforms.uRes.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio()); }
  watch(dt, playing) {
    if (!playing || this.lock || !this.bloom.enabled) return;
    const w = this.win; w.t += dt; w.frames++;
    if (w.t < 3) return;
    this.fps = w.frames / w.t; w.t = 0; w.frames = 0;
    if (this.fps < 38) { this.bloom.enabled = false; console.info(`bloom off (${this.fps.toFixed(0)} fps)`); }
  }
  render() { this.composer.render(); }
}
