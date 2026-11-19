// Headless sim: the autopilot climbs the whole level, touches every card, never needs a respawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLevelState, Player, autopilot, touching } from '../src/logic.js';
import { S_END } from '../src/level.js';

function run(maxT = 120) {
  const L = makeLevelState(), P = new Player(L.platforms);
  let t = 0, got = 0, falls = 0;
  const dt = 1 / 120;
  while (t < maxT) {
    t += dt;
    for (const p of L.platforms) p.update(dt, t);
    if (P.plat && P.grounded && P.plat.solid) { P.s += P.plat.ds; P.y = P.plat.top; }
    for (const c of L.pickups) c.update(t);
    P.step(dt, autopilot(P, L.pickups));
    for (const c of L.pickups) if (touching(P, c)) { c.state = 'got'; got++; }
    for (const p of L.platforms) if (p.justCounted) { p.justCounted = false; got++; }
    if (P.fell()) { falls++; P.respawn(); }
    if (P.s >= S_END && P.grounded) return { done: true, t, got, falls, total: L.total, missed: L.pickups.filter(c => c.state === 'idle').map(c => c.s) };
  }
  return { done: false, t, s: P.s, y: P.y, got, falls, total: L.total };
}

test('autopilot reaches the summit with every card', () => {
  const r = run();
  console.log(JSON.stringify(r));
  assert.ok(r.done, `stuck at s=${r.s}`);
  assert.equal(r.falls, 0);
  assert.equal(r.got, r.total);
});
