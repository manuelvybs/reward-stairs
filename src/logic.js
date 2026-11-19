// Reward Stairs — gameplay logic without rendering: the player's physics, hover-card platforms, gift-card pickups
// and an autopilot for tests. Visual classes read these states; Node tests drive them directly.
import { T } from './config.js';
import { clamp, lerp, smooth } from './util.js';
import { staticSupport, bodyTop, groundRef, PLATFORMS, PLAT_HALF, PICKUPS, S_MIN, S_MAX, NO_GROUND } from './level.js';

// ---- hover-card platform -----------------------------------------------------------------------------------------
// idle -> (stepped on) lit: glows and lifts a little -> shake: trembles and sinks, still solid -> drop: falls away ->
// gone -> back: floats up from below -> idle. Counting happens on the first landing only.
export class Platform {
  constructor([s, top, drift, bob], i) {
    Object.assign(this, { s, slotTop: top, drift, bob, i });
    this.phase = i * 0.9; this.state = 'idle'; this.timer = 0; this.solid = true; this.counted = false;
    this.halfTop = PLAT_HALF; this.lift = 0; this.shake = 0; this.alpha = 1; this.glow = 0;
    this.curS = s; this.top = top; this.ds = 0; this.vy = 0; this.justCounted = false; this.flip = 0;
    this.place(0);
  }
  place(t) {
    const old = this.curS, top0 = this.top;
    this.curS = this.s + (this.drift ? Math.sin(t * 1.2 + this.phase) * this.drift : 0);
    this.top = this.slotTop + this.lift + Math.sin(t * 1.8 + this.phase) * this.bob;
    this.ds = this.curS - old; this.dTop = this.top - top0;
  }
  land() {
    if (this.state !== 'idle') return;
    this.state = 'lit'; this.timer = 0;
    if (!this.counted) { this.counted = true; this.justCounted = true; }
  }
  update(dt, t) {
    this.timer += dt;
    const st = this.state;
    if (st === 'idle') { this.glow = Math.max(0, this.glow - dt * 2); this.lift = lerp(this.lift, 0, 1 - Math.exp(-dt * 3)); }
    else if (st === 'lit') { this.glow = Math.min(1, this.glow + dt * 5); this.lift = 0.22 * smooth(this.timer / 0.6); if (this.timer > 2.1) { this.state = 'shake'; this.timer = 0; } }
    else if (st === 'shake') { this.shake = 1; this.lift = 0.22 - 0.55 * smooth(this.timer / 1.2); if (this.timer > 1.2) { this.state = 'drop'; this.timer = 0; this.solid = false; } }
    else if (st === 'drop') { this.lift -= dt * (2 + this.timer * 14); this.flip = smooth(this.timer / 0.9) * Math.PI * 0.8; this.alpha = 1 - smooth((this.timer - 0.4) / 0.6); if (this.timer > 1) { this.state = 'gone'; this.timer = 0; } }
    else if (st === 'gone') { this.alpha = 0; if (this.timer > 1.8) this.comeBack(); }
    else if (st === 'back') { const k = smooth(this.timer / 1.6); this.lift = lerp(-6, 0, k); this.alpha = k; this.flip = 0; if (k >= 1) { this.state = 'idle'; this.solid = true; this.timer = 0; } }
    if (st !== 'shake') this.shake = 0;
    this.place(t);
    this.vy = dt > 0 ? this.dTop / dt : 0;
  }
  comeBack() { this.state = 'back'; this.timer = 0; this.solid = false; this.lift = -6; this.alpha = 0; this.flip = 0; this.glow = 0; }
}

// ---- gift-card pickup ----------------------------------------------------------------------------------------------
export class Pickup {
  constructor([s, dy, n], i) {
    Object.assign(this, { s, dy, n, i });
    this.base = groundRef(s) + dy; this.y = this.base; this.phase = i * 1.7; this.state = 'idle';
  }
  update(t) { this.y = this.base + Math.sin(t * 1.6 + this.phase) * 0.07; }
}

// ---- the player ----------------------------------------------------------------------------------------------------
export class Player {
  constructor(platforms, s = 0.5) { this.platforms = platforms; this.reset(s); }
  reset(s) {
    const h = staticSupport(s, 1e9, T.foot);
    Object.assign(this, { s, y: h > NO_GROUND ? h : 0, vs: 0, vy: 0, grounded: true, plat: null, coyote: 0, jumpBuf: 0, face: 1, air: 0,
      anim: 'idle', animSpeed: 1, events: [] });
    this.lastSafe = { s: this.s, y: this.y };
  }
  support(s, yMax, snap = 0) {
    let best = staticSupport(s, yMax, T.foot), plat = null;
    for (const L of this.platforms) if (L.solid && Math.abs(s - L.curS) < L.halfTop + T.platFoot && L.top <= yMax + snap && L.top > best) { best = L.top; plat = L; }
    return { h: best, plat };
  }
  // inp: { left, right, jumpPressed }
  step(dt, inp) {
    if (inp.jumpPressed) this.jumpBuf = T.jumpBuf;
    const axis = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const acc = this.grounded ? T.acc : T.airAcc;
    this.vs += clamp(axis * T.speed - this.vs, -acc * dt, acc * dt);
    // only a rise taller than a small step stops the body
    let ns = clamp(this.s + this.vs * dt, S_MIN, S_MAX);
    const bt = bodyTop(ns);
    if (bt > this.y + (this.grounded ? T.stepUp : T.airStepUp) && bt > bodyTop(this.s) + 0.01) { ns = this.s; this.vs = 0; }
    this.s = ns;
    // in the air: a gentle pull onto the hover-card you are about to land on
    if (!this.grounded) {
      const rising = this.vy > 0.5;
      let best = null, bd = 1e9;
      for (const L of this.platforms) {
        if (!L.solid) continue;
        const ad = Math.abs(L.curS - this.s);
        if (ad < L.halfTop + T.magnetR && this.y > L.top - (rising ? 0.8 : T.platSnap) && this.y < L.top + 1.6 && ad < bd && (!rising || (L.curS - this.s) * this.vs > 0)) { best = L; bd = ad; }
      }
      if (best) {
        const d = best.curS - this.s, inner = best.halfTop * 0.35;
        if (Math.abs(d) > inner) this.s += Math.sign(d) * Math.min(Math.abs(d) - inner, (axis * d < 0 ? 0.45 : 1) * (rising ? 0.6 : 1) * T.magnetV * dt);
      }
    }
    this.coyote -= dt; this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = T.jumpV + (this.plat ? clamp(this.plat.vy, 0, 1) : 0);
      this.grounded = false; this.plat = null; this.coyote = 0; this.jumpBuf = 0; this.air = 0;
      this.events.push('jump');
    }
    if (this.grounded) {
      const sup = this.support(this.s, this.y + T.stepUp);
      if (sup.h > NO_GROUND && sup.h >= this.y - T.stepDown) {
        if (sup.h > this.y + 0.05 && !sup.plat) this.events.push('step');
        this.y = sup.h; this.vy = 0; this.plat = sup.plat;
      } else { this.grounded = false; this.plat = null; this.coyote = T.coyote; this.vy = Math.min(this.vy, 0); this.air = 0; }
    }
    if (!this.grounded) {
      this.air += dt; this.vy -= T.g * dt;
      const ny = this.y + this.vy * dt;
      if (this.vy <= 0) {
        const sup = this.support(this.s, this.y + T.airStepUp, T.platSnap - T.airStepUp);
        if (sup.h > NO_GROUND && ny <= sup.h) {
          this.y = sup.h; this.vy = 0; this.grounded = true; this.plat = sup.plat;
          this.events.push(sup.plat ? 'landPlat' : 'land');
          if (sup.plat) sup.plat.land();
        } else this.y = ny;
      } else {
        this.y = ny;
        const gh = staticSupport(this.s, this.y + T.airStepUp, 0.06);   // rising past a step lip: ride over it
        if (gh > this.y) this.y = gh;
      }
    }
    if (this.grounded && !this.plat) { this.lastSafe.s = this.s; this.lastSafe.y = this.y; }
    if (axis) this.face = axis;
    const sp = Math.abs(this.vs);
    if (!this.grounded) { this.anim = this.vy > -2.5 || this.air < 0.35 ? 'jump' : 'fall'; this.animSpeed = 1; }
    else if (sp > 1.55) { this.anim = 'run'; this.animSpeed = 0.62 + sp * 0.12; }
    else if (sp > 0.25) { this.anim = 'walk'; this.animSpeed = clamp(sp / 1.1, 0.6, 1.5); }
    else { this.anim = 'idle'; this.animSpeed = 1; }
  }
  fell() { return this.y < groundRef(this.lastSafe.s) - 6; }
  // respawn on solid ground at the last safe spot, a little back from any edge
  respawn() {
    let s = this.lastSafe.s;
    for (let k = 0; k < 30 && staticSupport(s, this.lastSafe.y + 0.1, 0.3) < this.lastSafe.y - 0.5; k++) s -= 0.2;
    this.reset(s);
    for (const L of this.platforms) if (L.state !== 'idle') L.comeBack();
  }
}

// touched cards: chest close enough to the card
export function touching(P, c) {
  if (c.state !== 'idle') return false;
  const dy = c.y - (P.y + T.chest);
  return Math.abs(c.s - P.s) < 0.62 && dy > -0.85 && dy < 1.0;
}

export function makeLevelState() {
  const platforms = PLATFORMS.map((p, i) => new Platform(p, i));
  const pickups = PICKUPS.map((p, i) => new Pickup(p, i));
  return { platforms, pickups, total: platforms.length + pickups.length };
}

// ---- autopilot: holds right, hops gaps, cracks and high cards (used by the headless playtest) -----------------------
export function autopilot(P, pickups) {
  const inp = { left: false, right: true, jumpPressed: false };
  if (!P.grounded) return inp;
  for (const c of pickups) {
    if (c.state !== 'idle') continue;
    const ds = c.s - P.s, dy = c.y - (P.y + T.chest);
    if (ds > 0.05 && ds < 0.5 && dy >= 1.0 && dy < 2.2) { inp.jumpPressed = true; return inp; }
  }
  const sup = P.support(P.s + 0.16, P.y + T.stepUp);
  if (sup.h < P.y - T.stepDown) {                 // an edge: is there somewhere to land within a hop?
    for (let d = 0.5; d <= 1.55; d += 0.05) {
      const s = P.s + d, land = P.support(s, P.y + 1.05);
      if (land.h > P.y - 1.5 && land.h > NO_GROUND && (!land.plat || Math.abs(land.plat.curS - s) < land.plat.halfTop * 0.8)) { inp.jumpPressed = true; return inp; }
    }
    inp.right = false;                            // wait for the next hover-card to drift closer
  }
  return inp;
}
