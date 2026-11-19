// Reward Stairs — the level. The astronaut walks a winding 1D path (s = metres along it); heights are level data.
// Pure data + queries, no three.js: the physics tests import this file in Node.
import { clamp, lerp, smooth } from './util.js';

// ---- the path: heading (radians) keyed along s, integrated into a smooth XZ curve -------------------------------
const HEADING = [[-14, -0.1], [0, -0.16], [16, -0.44], [20, -0.12], [28.6, 0.04], [33, -0.34], [44, -0.6], [47.5, -0.22],
  [58, -0.02], [61, -0.4], [70.5, -0.3], [92, -0.12], [130, -0.05]];
function headingAt(s) {
  const K = HEADING;
  if (s <= K[0][0]) return K[0][1];
  for (let i = 0; i < K.length - 1; i++) {
    const [s0, h0] = K[i], [s1, h1] = K[i + 1];
    if (s <= s1) return lerp(h0, h1, smooth((s - s0) / (s1 - s0)));
  }
  return K[K.length - 1][1];
}
const PS0 = -16, PS1 = 140, PDS = 0.05, PN = Math.round((PS1 - PS0) / PDS) + 1;
const PX = new Float32Array(PN), PZ = new Float32Array(PN), PH = new Float32Array(PN);
{
  let x = 0, z = 0;
  for (let i = 0; i < PN; i++) { const h = headingAt(PS0 + i * PDS); PX[i] = x; PZ[i] = z; PH[i] = h; x += Math.cos(h) * PDS; z += Math.sin(h) * PDS; }
  const i0 = Math.round(-PS0 / PDS), ox = PX[i0], oz = PZ[i0];
  for (let i = 0; i < PN; i++) { PX[i] -= ox; PZ[i] -= oz; }
}
// frame(s): point on the path, tangent t (forward, screen-right) and normal n (towards the camera side)
export function frame(s, o = {}) {
  const f = clamp((s - PS0) / PDS, 0, PN - 1.001), i = Math.floor(f), a = f - i;
  const h = lerp(PH[i], PH[i + 1], a);
  o.x = lerp(PX[i], PX[i + 1], a); o.z = lerp(PZ[i], PZ[i + 1], a); o.h = h;
  o.tx = Math.cos(h); o.tz = Math.sin(h); o.nx = -Math.sin(h); o.nz = Math.cos(h);
  return o;
}
const _f = {};
export function worldXZ(s, n, o = {}) { frame(s, _f); o.x = _f.x + _f.nx * n; o.z = _f.z + _f.nz * n; return o; }

// ---- walkable surfaces -----------------------------------------------------------------------------------------
export const RISE = 0.25;
export const SEG = [];                      // { a, b, h, kind }
export const FLIGHTS = [];                  // { a, b, n, h0, skip } for the stair builder
const flat = (a, b, h, kind = 'ledge') => SEG.push({ a, b, h, kind });
function stairs(a, n, len, h0, skip = []) {
  const tr = len / n;
  for (let i = 0; i < n; i++) if (!skip.includes(i)) SEG.push({ a: a + i * tr, b: a + (i + 1) * tr, h: h0 + (i + 1) * RISE, kind: 'step', i });
  FLIGHTS.push({ a, b: a + len, n, h0, tread: tr, skip });
  return h0 + n * RISE;
}
flat(-6, 4, 0, 'start');
export const H1 = stairs(4, 26, 12, 0);                 // 6.5
flat(16, 20, H1);
export const H2 = 8.6; flat(28.6, 33, H2);
export const H3 = stairs(33, 24, 11, H2, [11, 12]);     // 14.6, two steps missing: hop the crack
flat(44, 47.5, H3);
export const H4 = 17.0; flat(58, 61, H4);
export const H5 = stairs(61, 22, 9.5, H4);              // 22.5
flat(70.5, 96, H5, 'summit');

export const GAPS = [[20, 28.6], [47.5, 58]];
export const S_MIN = -4.5, S_MAX = 90, S_END = 84.5, S_EDGE = 86.6;

// hover-cards over the gaps: s, top height, drift (m along s), bob (m)
export const PLATFORMS = [
  [21.3, 6.85, 0, 0.07], [23.2, 7.3, 0, 0.09], [25.1, 7.75, 0, 0.09], [27.0, 8.2, 0, 0.07],
  [49.0, 14.9, 0.16, 0.09], [50.9, 15.35, 0.28, 0.11], [52.8, 15.8, 0.3, 0.11], [54.7, 16.25, 0.28, 0.11], [56.5, 16.65, 0.16, 0.09],
];
export const PLAT_HALF = 0.62;

// gift cards to touch: s, height above the local ground (card centre), n (across the path; 0 = on it)
export const PICKUPS = [
  [2.0, 0.98, -0.12], [6.6, 0.98, -0.12], [9.0, 2.12, 0], [11.6, 0.98, -0.12], [14.1, 2.12, 0], [18.0, 0.98, -0.12],
  [22.25, 1.75, 0], [26.05, 1.75, 0],
  [30.6, 0.98, -0.12], [35.4, 0.98, -0.12], [37.0, 2.12, 0], [38.5, 1.45, 0], [40.8, 0.98, -0.12], [42.8, 2.12, 0], [45.8, 0.98, -0.12],
  [51.85, 1.75, 0], [55.6, 1.75, 0],
  [59.5, 0.98, -0.12], [63.0, 0.98, -0.12], [65.6, 2.12, 0], [68.4, 0.98, -0.12], [74.5, 0.98, -0.12], [78.5, 2.12, 0], [82.0, 0.98, -0.12],
];

// the crescent moon you climb to at the end (its centre; R = outer radius)
export const MOON = { s: S_EDGE + 15, n: -16.5, y: H5 + 10.5, R: 3.2 };

// ---- ground queries --------------------------------------------------------------------------------------------
export const NO_GROUND = -1e9;
// highest static surface under a foot of half-width `foot` that is not above yMax
export function staticSupport(s, yMax, foot) {
  let best = NO_GROUND;
  for (const g of SEG) if (g.b > s - foot && g.a < s + foot && g.h <= yMax && g.h > best) best = g.h;
  return best;
}
// top of whatever solid is at s (any height): used to stop the body at tall rises
export function bodyTop(s) {
  let best = NO_GROUND;
  for (const g of SEG) if (g.a <= s + 0.05 && g.b >= s - 0.05 && g.h > best) best = g.h;
  return best;
}
function edgeTop(s) { let best = NO_GROUND; for (const g of SEG) if (g.a <= s && g.b >= s && g.h > best) best = g.h; return best; }
// a smooth reference height everywhere (camera, cards, clouds); across a gap it ramps between the two edges
export function groundRef(s) {
  for (const [a, b] of GAPS) if (s > a && s < b) return lerp(edgeTop(a - 0.05), edgeTop(b + 0.05), (s - a) / (b - a));
  let best = NO_GROUND;
  for (const g of SEG) if (s >= g.a - 0.6 && s <= g.b + 0.6 && g.h > best) best = g.h;
  return best > NO_GROUND ? best : 0;
}
export function gapWeight(s) {
  let w = 0;
  for (const [a, b] of GAPS) w = Math.max(w, smooth((s - a + 2.2) / 2.6) * smooth((b + 1.4 - s) / 2.6));
  return w;
}
