// Reward Stairs — boot, game states and the frame loop.
//   URL flags: ?autopilot (plays itself)  ?play (skip the title)  ?s=NN (start at metre NN)  ?mute  ?lowq  ?hiq
import * as THREE from 'three';
import { GAME, T, CARDS } from './config.js';
import { frame, groundRef, gapWeight, staticSupport, S_END, NO_GROUND } from './level.js';
import { clamp, lerp, smooth, damp, rr } from './util.js';
import { Player, makeLevelState, autopilot, touching } from './logic.js';
import { World, Sparkles } from './world.js';
import { CardKit, PickupView, PlatformView, Flyers, atPath } from './cards.js';
import { loadHero } from './hero.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { Post } from './post.js';
import { FX } from './fx.js';
import { Ending } from './ending.js';

const Q = new URLSearchParams(location.search);
const AUTO = Q.has('autopilot');
const $ = id => document.getElementById(id);

// ---- renderer ------------------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight || 1, 0.1, 2000);
const post = new Post(renderer, scene, camera, Q);
const narrow = () => clamp((1.25 - camera.aspect) / 0.75, 0, 1);
// in-app browsers (and hidden webviews) can boot at 0x0 and grow later without a resize event: tick() polls the size
const view = { w: 0, h: 0 };
function fit() {
  view.w = innerWidth; view.h = innerHeight;
  if (!view.w || !view.h) return;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = lerp(46, 66, narrow());
  camera.updateProjectionMatrix();
  post.setSize(innerWidth, innerHeight);
  const px = innerHeight * renderer.getPixelRatio() * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  world?.setPointScale(px); fx?.setScale(px); flyers?.stars.mat && (flyers.stars.mat.uniforms.uScale.value = px);
}
let world = null, fx = null, flyers = null;
addEventListener('resize', fit);

// ---- load ----------------------------------------------------------------------------------------------------------
const loader = new THREE.TextureLoader();
const loadTex = url => new Promise((res, rej) => loader.load(url, res, undefined, () => setTimeout(() => loader.load(url, res, undefined, rej), 500)));
const IMG = ['sky_dusk', 'sky_night', 'bank_a', 'bank_b', 'tower', 'puff'];
const [imgs, cardTex, hero] = await Promise.all([
  Promise.all(IMG.map(n => loadTex(`assets/img/${n}.webp`))),
  Promise.all(CARDS.map(n => loadTex(`assets/cards/${n}.webp`))),
  loadHero('assets/models/hero.glb'),
]);
const tex = Object.fromEntries(IMG.map((n, i) => [n, imgs[i]]));
CARDS.forEach((n, i) => { tex[n] = cardTex[i]; });

world = new World(scene, tex);
fx = new FX(scene);
const kit = new CardKit(tex);
const L = makeLevelState();
const pickups = L.pickups.map(p => new PickupView(scene, kit, p));
const platforms = L.platforms.map(p => new PlatformView(scene, kit, p));
const stars = new Sparkles(80, world.spark); scene.add(stars.points); stars.mat.uniforms.uTw.value = 0.25;
flyers = new Flyers(scene, kit, stars);
flyers.onStar = p => { fx.emit('glow', p, 10, { color: [1, 0.9, 0.62], size: 0.5, life: 0.9, speed: 3, up: 0.8, spread: 0.3 }); };
scene.add(hero.root, hero.shadow);
const sound = new Sound();
const input = new Input();
const P = new Player(L.platforms, Q.has('s') ? +Q.get('s') : 0.5);
const ending = new Ending({ scene, kit, hero, world, flyers, sound, fx });

const G = { mode: 'title', ready: false, collected: 0, total: L.total, falls: 0, t: 0, night: 0, respawnT: 0, yCam: P.y, yVis: P.y, chimeK: 0, endAt: 0 };
$('total').textContent = G.total; $('endTotal').textContent = G.total;
$('ctl').textContent = matchMedia('(pointer: coarse)').matches ? GAME.controlsTouch : GAME.controls;
{ const ua = navigator.userAgent; $('cta').href = /iPhone|iPad|iPod/.test(ua) ? GAME.store.ios : /Android/.test(ua) ? GAME.store.android : GAME.store.web; }
$('again').addEventListener('click', () => { location.search = '?play'; });
$('mute').addEventListener('click', e => { e.stopPropagation(); $('mute').textContent = sound.toggle() ? '✕' : '♪'; });
// audio may only start inside a user gesture
const unlock = () => sound.start();
addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

fit();

// ---- camera --------------------------------------------------------------------------------------------------------
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false };
const _f = {}, _cp = new THREE.Vector3(), _cl = new THREE.Vector3();
function followTargets(s, y, outP, outL) {
  frame(s, _f);
  const bw = gapWeight(s), nw = narrow(), sw = smooth((s - 69) / 5), prog = clamp(s / S_END, 0, 1);
  const side = lerp(lerp(4.8, 6.4, bw), 6.0, sw) * lerp(1, 1.4, nw);
  const back = lerp(lerp(2.7, 1.3, bw), 2.2, sw) * lerp(1, 0.55, nw);
  const lift = lerp(lerp(0.55, 1.0, bw), 1.5, sw) + nw * 0.9;
  outP.set(_f.x + _f.nx * side - _f.tx * back, y + 1.0 + lift, _f.z + _f.nz * side - _f.tz * back);
  const ahead = lerp(2.1, 1.4, bw) * (1 - 0.35 * nw);
  outL.set(_f.x + _f.tx * ahead - _f.nx * 0.3, y + 1.15 + nw * 1.2 + prog * 0.5, _f.z + _f.tz * ahead - _f.nz * 0.3);
}
function updateCamera(dt, t) {
  if (G.mode === 'title') {
    const a = Math.sin(t * 0.08) * 0.6;
    frame(3, _f); const nw = narrow();
    _cp.set(_f.x + _f.nx * (9 + a + nw * 5) - _f.tx * (3.5 - a), 2.4 + nw * 2 + Math.sin(t * 0.11) * 0.3, _f.z + _f.nz * (9 + a + nw * 5) - _f.tz * (3.5 - a));
    frame(10, _f); _cl.set(_f.x - _f.nx * 1.2, 4.2 + nw * 1.5, _f.z - _f.nz * 1.2);
    if (!cam.init) { cam.pos.copy(_cp); cam.look.copy(_cl); cam.init = true; }
    cam.pos.lerp(_cp, 1 - Math.exp(-dt * 1.2)); cam.look.lerp(_cl, 1 - Math.exp(-dt * 1.2));
  } else if (G.mode === 'play') {
    followTargets(P.s, G.yCam, _cp, _cl);
    if (!cam.init) { cam.pos.copy(_cp); cam.look.copy(_cl); cam.init = true; }
    cam.pos.lerp(_cp, 1 - Math.exp(-dt * 2.4)); cam.look.lerp(_cl, 1 - Math.exp(-dt * 3.2));
  } else ending.camera(dt, cam);
  const o = window.__game?.camOverride;
  if (o) { cam.pos.set(...o.pos); cam.look.set(...o.look); }
  camera.position.copy(cam.pos); camera.position.y += Math.sin(t * 0.5) * 0.03;
  camera.lookAt(cam.look);
}

// ---- game flow -----------------------------------------------------------------------------------------------------
function startGame() {
  G.mode = 'play';
  $('title').classList.remove('on'); $('hud').classList.add('on'); $('mute').classList.add('on');
  if (matchMedia('(pointer: coarse)').matches) $('pads').classList.add('on');
  sound.start(); sound.music('music_climb', 0.9);
  if (!AUTO) followTargets(P.s, P.y, cam.pos, cam.look);
}
function bumpHud() { const h = $('hud'); $('count').textContent = G.collected; h.classList.add('bump'); setTimeout(() => h.classList.remove('bump'), 240); }
function collect(pos, brand, s) {
  G.collected++; bumpHud();
  flyers.launch(pos, brand, s);
  sound.play('collect', 0.55, 1 + (G.chimeK % 5) * 0.03); sound.chime(G.chimeK++);
  fx.emit('glow', pos, 12, { color: [1, 0.86, 0.5], size: 0.28, life: 0.7, speed: 2.2, up: 1.1, spread: 0.25 });
}
function startEnding() {
  G.mode = 'ending'; G.endAt = G.t;
  $('hud').classList.remove('on'); $('pads').classList.remove('on');
  ending.start(P);
  ending.onDone = () => {
    G.mode = 'end';
    $('endCount').textContent = G.collected;
    $('endHead').textContent = G.collected === G.total ? 'Every card. You reached the moon!' : 'You reached the moon!';
    setTimeout(() => $('end').classList.add('on'), 400);
  };
}

// ---- frame loop ----------------------------------------------------------------------------------------------------
let lastNow = performance.now();
let acc = 0, stepCool = 0;
const noJump = { left: false, right: false, jumpPressed: false };
function tick() {
  if (innerWidth !== view.w || innerHeight !== view.h) fit();
  if (!view.w || !view.h) return;              // nothing to draw into yet (and a NaN aspect would poison the camera)
  const now = performance.now(), dt = Math.min((now - lastNow) / 1000, 1 / 20); lastNow = now;
  const t = (G.t += dt);
  const inp = input.sample();
  if (inp.mute) $('mute').textContent = sound.toggle() ? '✕' : '♪';
  if (G.mode === 'title' && G.ready && (inp.start || AUTO || Q.has('play'))) startGame();
  else if (G.mode === 'end' && inp.restart) location.search = '?play';

  for (const p of L.platforms) p.update(dt, t);
  for (const c of L.pickups) c.update(t);

  if (G.mode === 'play') {
    if (G.respawnT > 0) {
      G.respawnT -= dt;
      if (G.respawnT < 0.3 && !G.respawned) { P.respawn(); G.respawned = true; G.yVis = G.yCam = P.y; $('fade').classList.remove('on'); fx.emit('glow', atPath(P.s, 0, P.y + 0.6), 22, { color: [1, 0.9, 1], size: 0.4, life: 0.9, speed: 1.6, up: 1 }); }
    } else {
      if (P.plat && P.grounded && P.plat.solid) { P.s += P.plat.ds; P.y = P.plat.top; }
      const pin = AUTO ? autopilot(P, L.pickups) : inp;
      acc += dt; let first = true;
      while (acc >= 1 / 120) { P.step(1 / 120, first ? pin : { ...pin, jumpPressed: false }); first = false; acc -= 1 / 120; }
      stepCool -= dt;
      for (const e of P.events) {
        if (e === 'jump') { sound.play('jump', 0.45, rr(0.95, 1.08)); hero.play('jump', 1.25, 0.08, 0.32); }
        else if (e === 'land' || e === 'landPlat') { sound.play('land', 0.4, rr(0.95, 1.1)); fx.emit('soft', atPath(P.s, 0, P.y + 0.05), 6, { color: [0.95, 0.88, 1], size: 0.25, life: 0.5, speed: 0.9, up: 0.3 }); }
        else if (e === 'step' && stepCool <= 0) { sound.play('step_stone', 0.18, rr(0.9, 1.15)); stepCool = 0.16; }
      }
      P.events.length = 0;
      for (let i = 0; i < L.pickups.length; i++) { const c = L.pickups[i]; if (touching(P, c)) { c.state = 'got'; collect(pickups[i].pos.clone(), pickups[i].brand, c.s); } }
      for (let i = 0; i < L.platforms.length; i++) { const p = L.platforms[i]; if (p.justCounted) { p.justCounted = false; collect(platforms[i].pos.clone().setY(p.top + 0.4), platforms[i].brand, p.curS); } }
      if (P.fell()) { G.falls++; G.respawnT = 0.75; G.respawned = false; $('fade').classList.add('on'); sound.play('respawn', 0.5); }
      if (P.s >= S_END && P.grounded) startEnding();
    }
  }

  // hero placement + animation while playing / on the title
  if (G.mode === 'play' || G.mode === 'title') {
    frame(P.s, _f);
    G.yVis = P.grounded && !P.plat ? damp(G.yVis, P.y, 18, dt) : P.y;
    if (Math.abs(G.yVis - P.y) > 1) G.yVis = P.y;
    const tgt = P.grounded ? P.y : clamp(G.yCam, P.y - 1.0, P.y + 0.2);
    G.yCam = damp(G.yCam, Math.max(tgt, P.lastSafe.y - 1.4), 3, dt);
    hero.root.position.set(_f.x, G.yVis, _f.z);
    const f = G.mode === 'title' ? 0.25 : P.face;
    hero.faceTowards(_f.tx * f + _f.nx * 0.42, _f.tz * f + _f.nz * 0.42, dt, 10);
    if (G.mode === 'title') hero.play('idle');
    else if (P.anim === 'jump' || P.anim === 'fall') { if (hero.name !== 'jump' && hero.name !== 'fall') hero.play('jump', 1.25, 0.1, 0.32); else if (P.anim === 'fall' && hero.finished('jump')) hero.play('fall', 1, 0.25); }
    else hero.play(P.anim, P.animSpeed, 0.18);
    let gy = staticSupport(P.s, P.y + 0.05, 0.12);
    for (const p of L.platforms) if (p.solid && Math.abs(P.s - p.curS) < p.halfTop && p.top <= P.y + 0.05 && p.top > gy) gy = p.top;
    hero.setShadow(_f.x, gy > NO_GROUND ? gy : -100, _f.z, gy > NO_GROUND ? P.y - gy : 99);
  } else { hero.shadow.visible = false; }
  if (G.mode === 'ending' || G.mode === 'end') ending.update(dt, t);
  hero.update(dt);

  for (const v of pickups) v.update(t, camera);
  for (const v of platforms) v.update(t);
  flyers.update(dt);
  stars.mat.uniforms.uTime.value = t;

  // dusk turns to night as you climb
  const prog = G.mode === 'title' ? 0 : clamp(P.s / S_END, 0, 1);
  const night = G.mode === 'ending' || G.mode === 'end' ? 1 : smooth((prog - 0.1) / 0.85) * 0.94;
  G.night = damp(G.night, night, 0.7, dt);
  updateCamera(dt, t);
  const hp = hero.root.position;
  world.update(dt, t, G.night, camera, { s: G.mode === 'play' ? P.s : 86, x: hp.x, y: hp.y, z: hp.z });
  fx.update(dt);
  post.watch(dt, G.mode === 'play');
  if (view.w && view.h) post.render();
}

G.ready = true;
$('loading').classList.remove('on');
if (!AUTO && !Q.has('play')) $('title').classList.add('on');
window.__game = { ready: true, G, P, L, camera, hero, ending, sound, post, get mode() { return G.mode; }, get fps() { return post.fps; } };
renderer.setAnimationLoop(tick);
