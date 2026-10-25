import test from 'node:test';
import assert from 'node:assert/strict';
import { distortionKind, planDistortions, slotParams, chooseSlots } from '../../../scripts/engines/distortion/scene-distortion.mjs';

const GRID = 100;
const sq = n => n * GRID;
const st = (stageId, kind, asset, extra = {}) => ({ stageId, kind, asset, assets: [asset], delay: 0, duration: 1000, ...extra });
const opts = (tiers, extra = {}) => ({
  context: {}, tiers: new Map(Object.entries(tiers)), gridPx: GRID,
  pointOf: s => s.at ?? null, radiusOf: s => s.r ?? null, ...extra,
});

test('blasts and heavy crits shock; small hits do not', () => {
  assert.equal(distortionKind({ kind: 'impact', assets: ['jb2a.fireball.explosion.orange'] }, { context: {} }), 'shock');
  assert.equal(distortionKind({ kind: 'impact', assets: ['jb2a.impact.001.orange'] }, { context: {} }), null);
  assert.equal(distortionKind({ kind: 'impact', assets: ['jb2a.melee_attack.03.greataxe'] }, { context: { type: 'attack', outcome: 'criticalSuccess' }, heavyItem: true }), 'shock');
  assert.equal(distortionKind({ kind: 'impact', assets: ['jb2a.melee_attack.03.greataxe'] }, { context: { type: 'attack', outcome: 'success' }, heavyItem: true }), null);
});

test('critical means a critical attack or check, from the outcome or any target', () => {
  const hit = { kind: 'impact', assets: ['jb2a.impact.001.orange'] };
  assert.equal(distortionKind(hit, { context: { type: 'check', outcome: 'criticalSuccess' }, heavyItem: true }), 'shock');
  assert.equal(distortionKind(hit, { context: { type: 'attack', targetOutcomes: { a: 'success', b: 'criticalSuccess' } }, heavyItem: true }), 'shock');
  assert.equal(distortionKind(hit, { context: { type: 'damage', outcome: 'criticalSuccess' }, heavyItem: true }), null);
  assert.equal(distortionKind(hit, { context: { type: 'save', outcome: 'criticalSuccess' }, heavyItem: true }), null);
  assert.equal(distortionKind(hit, { context: { type: 'attack', outcome: 'criticalSuccess' }, heavyItem: false }), null);
  // The weapon can also be known from the asset family.
  assert.equal(distortionKind({ kind: 'impact', assets: ['jb2a.melee_attack.03.greataxe'] }, { context: { type: 'attack', outcome: 'criticalSuccess' } }), 'shock');
  // A warhammer is one-handed (not on the heavy item list), so its asset does not count either.
  assert.equal(distortionKind({ kind: 'impact', assets: ['jb2a.melee_attack.03.warhammer'] }, { context: { type: 'attack', outcome: 'criticalSuccess' } }), null);
});

test('a circle one-shot of 2+ squares shocks; a small or line one does not', () => {
  const area = type => ({ type, center: { x: 0, y: 0 } });
  const burst = { kind: 'template', assets: ['jb2a.template_circle.out_pulse.01.burst.orange'], duration: 1000 };
  assert.equal(distortionKind(burst, { context: { area: area('circle') }, radius: sq(2), gridPx: GRID }), 'shock');
  assert.equal(distortionKind(burst, { context: { area: area('emanation') }, radius: sq(3), gridPx: GRID }), 'shock');
  assert.equal(distortionKind(burst, { context: { area: area('circle') }, radius: sq(1), gridPx: GRID }), null);
  assert.equal(distortionKind(burst, { context: { area: area('cone') }, radius: sq(4), gridPx: GRID }), null);
});

test('lasting fire hazes, one-shot fire does not', () => {
  assert.equal(distortionKind({ kind: 'template', assets: ['jb2a.wall_of_fire.ring.yellow'], persist: true }, { context: {} }), 'haze');
  assert.equal(distortionKind({ kind: 'aura', assets: ['jb2a.aura.generic'], persist: true }, { context: {}, element: 'fire' }), 'haze');
  assert.equal(distortionKind({ kind: 'aura', assets: ['jb2a.aura.generic'], persist: true }, { context: { element: 'cold' } }), null);
  assert.equal(distortionKind({ kind: 'template', assets: ['jb2a.wall_of_fire.ring.yellow'], duration: 1000 }, { context: {} }), null);
  assert.equal(distortionKind({ kind: 'aura', assets: ['jb2a.shield.blue'], persist: true }, { context: {} }), null);
  assert.equal(distortionKind({ kind: 'projectile', assets: ['jb2a.fire_bolt.orange'], persist: true }, { context: {} }), null);
});

test('shock ring grows and fades; nothing after 1400 ms', () => {
  const tag = { kind: 'shock', at: { x: 0, y: 0 }, radius: 600, startMs: 0, lengthMs: 1400 };
  assert.equal(slotParams(tag, 0, { zoom: 1 }).amp, 24);
  assert.ok(slotParams(tag, 700, { zoom: 1 }).ring > 300);
  assert.equal(slotParams(tag, 1500, { zoom: 1 }), null);
  assert.equal(slotParams(tag, -1, { zoom: 1 }), null);
  assert.equal(slotParams(tag, 0, { zoom: 2 }).amp, 48);
  assert.equal(slotParams(tag, 0, { zoom: 1 }).kind, 0);
});

// A big blast throws a bright flash over its middle: the ring must still bend the map past the flash's edge, and
// a zoomed-out view must still see it.
test('the ring is still clearly bending past the edge of a blast flash, even zoomed out', () => {
  const tag = { kind: 'shock', at: { x: 0, y: 0 }, radius: 600, startMs: 0, lengthMs: 1400 };
  // Two thirds of the way out (where a Fireball's flash ends), at least 6 screen pixels.
  const past = slotParams(tag, 470, { zoom: 1 });
  assert.ok(past.ring > 0.65 * 600 && past.amp >= 6, JSON.stringify(past));
  assert.equal(slotParams(tag, 0, { zoom: 0.3 }).amp, slotParams(tag, 0, { zoom: 0.75 }).amp, 'never weaker than at 0.75 zoom');
});

test('haze is steady for as long as its anchor lasts; warp swells and ends', () => {
  const haze = { kind: 'haze', at: { x: 5, y: 6 }, radius: 200, startMs: 100, lengthMs: null };
  assert.equal(slotParams(haze, 50, { zoom: 1 }), null);
  assert.deepEqual(slotParams(haze, 90000, { zoom: 2 }), { kind: 1, centre: { x: 5, y: 6 }, radius: 200, ring: 0, amp: 5 });
  const warp = { kind: 'warp', at: { x: 0, y: 0 }, radius: 150, startMs: 0, lengthMs: 500 };
  assert.ok(Math.abs(slotParams(warp, 250, { zoom: 1 }).amp - 10) < 1e-9);
  assert.equal(slotParams(warp, 500, { zoom: 1 }), null);
});

test('the same time gives the same parameters', () => {
  const tag = { kind: 'shock', at: { x: 0, y: 0 }, radius: 600, startMs: 0, lengthMs: 700 };
  assert.deepEqual(slotParams(tag, 400, { zoom: 1 }), slotParams(tag, 400, { zoom: 1 }));
});

test('plan: a fireball makes one ring on its tier 0 stage; radius clamps to 3..12 squares', () => {
  const mk = r => planDistortions([st('a', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 500, y: 500 }, r, delay: 200, contact: 300 })], opts({ a: 0 }));
  const [[stage, tag]] = [...mk(sq(4))];
  assert.equal(stage.stageId, 'a');
  assert.deepEqual({ kind: tag.kind, radius: tag.radius, startMs: tag.startMs, lengthMs: tag.lengthMs, follow: tag.follow }, { kind: 'shock', radius: sq(6), startMs: 300, lengthMs: 1400, follow: false });
  assert.equal([...mk(sq(1)).values()][0].radius, sq(3));
  assert.equal([...mk(sq(20)).values()][0].radius, sq(12));
  assert.equal([...mk(null).values()][0].radius, sq(3));
});

// Reach only moves how far the ring travels: its band stays as wide as the default ring's, so a long reach still
// ripples instead of sliding the whole view.
test('plan: the ring band is the blast’s, whatever the reach', () => {
  const tag = (r, shockReach) => [...planDistortions([st('a', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 500, y: 500 }, r })], opts({ a: 0 }, { shockReach })).values()][0];
  assert.equal(tag(sq(4), 3).band, tag(sq(4), 1.5).band);
  assert.equal(tag(sq(4), 0.5).band, tag(sq(4), 1.5).band);
  assert.ok(Math.abs(tag(sq(4), 1.5).band - 0.16 * sq(6)) < 1e-9, 'the default ring keeps its band');
  assert.equal(tag(null, 1.5).band, 0.16 * sq(3));
  assert.equal(tag(sq(40), 1.5).band, 0.16 * sq(12));
  const t = tag(sq(4), 3);
  assert.equal(slotParams(t, 100, { zoom: 1 }).band, t.band);
});

test('plan: shockwave reach scales the ring and its cap', () => {
  const mk = (r, shockReach) => [...planDistortions([st('a', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 500, y: 500 }, r })], opts({ a: 0 }, { shockReach })).values()][0].radius;
  // 1.5 (the default) is today's ring: 1.5x the blast, 3..12 squares.
  for (const r of [sq(1), sq(4), sq(20)]) assert.equal(mk(r, 1.5), mk(r, undefined));
  assert.equal(mk(sq(4), 1.5), sq(6));
  // 3 doubles it, and the cap with it.
  assert.equal(mk(sq(4), 3), sq(12));
  assert.equal(mk(sq(20), 3), sq(24));
  assert.equal(mk(sq(1), 3), sq(3), 'the floor stays 3 squares');
  // A small reach still carries the ring a square past the blast's edge (a ring inside the blast is hidden by it).
  assert.equal(mk(sq(4), 0.5), sq(5));
  assert.equal(mk(sq(1), 0.5), sq(3), 'and never under the 3-square floor');
  // A missing or broken value is the default.
  assert.equal(mk(sq(4), NaN), sq(6));
  assert.equal(mk(sq(4), -2), sq(6));
});

test('plan: tags carry the source token\'s level', () => {
  const plan = [st('a', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 }, r: sq(4) })];
  assert.equal([...planDistortions(plan, opts({ a: 0 }, { level: 'L2' })).values()][0].level, 'L2');
  assert.equal('level' in [...planDistortions(plan, opts({ a: 0 })).values()][0], false);
});

test('plan: two stages at one spot share one ring; a missing tier cannot anchor', () => {
  const plan = [
    st('a', 'template', 'jb2a.template_circle.out_pulse.01.burst.orange', { at: { x: 0, y: 0 }, r: sq(3) }),
    st('b', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 50, y: 0 }, r: sq(3) }),
  ];
  const context = { area: { type: 'circle', center: { x: 0, y: 0 } } };
  assert.equal(planDistortions(plan, opts({ a: 0, b: 1 }, { context })).size, 1);
  assert.equal(planDistortions(plan, opts({ b: 1 }, { context })).size, 0);
  assert.equal(planDistortions(plan, opts({}, { context })).size, 0);
});

test('plan: a lasting fire area hazes on a lasting anchor; capsule for a line', () => {
  const wall = st('w', 'template', 'jb2a.wall_of_fire.line.yellow', { at: { x: 300, y: 0 }, r: sq(5), persist: true });
  const context = { area: { type: 'line', center: { x: 0, y: 0 }, endpoint: { x: 600, y: 0 }, length: 600 } };
  const [[stage, tag]] = [...planDistortions([wall], opts({ w: 0 }, { context }))];
  assert.equal(stage, wall);
  assert.equal(tag.kind, 'haze');
  assert.equal(tag.lengthMs, null);
  assert.deepEqual(tag.area, { type: 'capsule', a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, width: GRID });
  assert.deepEqual(tag.at, { x: 300, y: 0 });
  assert.equal(tag.radius, 300 + GRID / 2);
  // A cone's capsule is as wide as the cone at its far end.
  const cone = st('c', 'template', 'jb2a.fire_jet.orange', { at: { x: 300, y: 0 }, r: sq(3), persist: true });
  const coneArea = angle => ({ area: { type: 'cone', center: { x: 0, y: 0 }, endpoint: { x: 600, y: 0 }, length: 600, angle } });
  const coneTag = angle => [...planDistortions([cone], opts({ c: 0 }, { context: coneArea(angle) })).values()][0];
  assert.ok(Math.abs(coneTag(90).area.width - 1200) < 1e-6);
  assert.ok(Math.abs(coneTag(53).area.width - 2 * 600 * Math.tan(53 * Math.PI / 360)) < 1e-6);
  assert.ok(Math.abs(coneTag(90).radius - (300 + 600)) < 1e-6);
  assert.equal(coneTag(undefined).area.width, 300, 'no angle: half its length, as before');
  const ring = st('r', 'template', 'jb2a.wall_of_fire.ring.yellow', { at: { x: 0, y: 0 }, r: sq(2), persist: true });
  assert.deepEqual([...planDistortions([ring], opts({ r: 0 }))].map(([, t]) => t.area), [{ type: 'circle' }]);
});

test('plan: a haze never rides a one-shot; an aura on a token follows', () => {
  const plan = [
    st('burst', 'impact', 'jb2a.impact.001.orange', { at: { x: 0, y: 0 } }),
    st('aura', 'aura', 'jb2a.fire.aura', { at: { x: 0, y: 0 }, r: sq(1), persist: true }),
  ];
  assert.equal(planDistortions(plan, opts({ burst: 0 })).size, 0);
  const planned = planDistortions(plan, opts({ burst: 0, aura: 0 }, { follows: s => s.kind === 'aura' }));
  assert.equal(planned.size, 1);
  const [[stage, tag]] = [...planned];
  assert.equal(stage.stageId, 'aura');
  assert.equal(tag.follow, true);
});

const mkActive = (x, lasting, y = 0) => ({ tag: {}, lasting, params: { centre: { x, y }, radius: 50 } });
const VIEW = { x: 0, y: 0, w: 1000, h: 1000 };

test('slot choice drops one-shots first, then the farthest', () => {
  const lasting = mkActive(900, true);
  const near = [100, 200, 300].map(x => mkActive(500 + x, false));
  const far = mkActive(10, false);
  const chosen = chooseSlots([far, lasting, ...near], VIEW);
  assert.equal(chosen.length, 4);
  assert.ok(chosen.includes(lasting));
  assert.ok(!chosen.includes(far));
  const farLasting = [0, 1, 2, 3, 4].map(i => mkActive(500 + i * 90, true));
  const kept = chooseSlots(farLasting, VIEW);
  assert.equal(kept.length, 4);
  assert.ok(!kept.includes(farLasting[0]) || !kept.includes(farLasting[4]));
});

test('off-screen distortions take no slot', () => {
  const off = mkActive(-500, false);
  const edge = mkActive(-40, true);
  const on = mkActive(500, false);
  assert.deepEqual(chooseSlots([off, edge, on], VIEW), [edge, on]);
  assert.deepEqual(chooseSlots([], VIEW), []);
  assert.equal(chooseSlots([on, edge], VIEW, 1).length, 1);
});

// Reported on D&D 5e: map distortion and camera shake never showed. Its catalog's areas play their whole clip
// (a Fireball's explosion runs 4.2 s), which read as a lasting area, and a placed circle carries no area type.
test('D&D: a long one-shot blast still shocks; a placed circle (no type) counts as round', () => {
  const placed = { center: { x: 0, y: 0 }, diameter: sq(8) };
  const fireball = { kind: 'template', assets: ['jb2a.fireball.explosion.orange'], duration: 4222 };
  assert.equal(distortionKind(fireball, { context: { area: placed }, element: 'fire', radius: sq(4), gridPx: GRID }), 'shock');
  assert.equal(distortionKind({ kind: 'template', assets: ['jb2a.shatter.blue'], duration: 3213 }, { context: { area: { center: { x: 0, y: 0 }, diameter: sq(4) } }, radius: sq(2), gridPx: GRID }), 'shock');
  const iceStorm = { kind: 'template', assets: ['jb2a.sleet_storm.02.blue'], duration: 4347 };
  assert.equal(distortionKind(iceStorm, { context: { area: placed }, radius: sq(4), gridPx: GRID }), 'shock');
  assert.equal(distortionKind(iceStorm, { context: { area: { type: 'sphere', center: { x: 0, y: 0 } } }, radius: sq(4), gridPx: GRID }), 'shock');
  assert.equal(distortionKind(iceStorm, { context: { area: { center: { x: 0, y: 0 } } }, radius: sq(4), gridPx: GRID }), null, 'no diameter: not a placed circle');
  // A healing or detecting sphere is no blast.
  assert.equal(distortionKind(iceStorm, { context: { area: placed }, harmful: false, radius: sq(4), gridPx: GRID }), null);
  assert.equal(distortionKind(fireball, { context: { area: placed }, harmful: false, radius: sq(4), gridPx: GRID }), 'shock', 'a blast asset shocks regardless');
  // A persisting blast clip is a burning area, never a ring; a long fire cone still hazes.
  assert.equal(distortionKind({ ...fireball, persist: true }, { context: {} }), 'haze');
  assert.equal(distortionKind({ kind: 'template', assets: ['jb2a.burning_hands.01.orange'], duration: 4186 }, { context: { area: { type: 'cone' } }, element: 'fire', radius: sq(3), gridPx: GRID }), 'haze');
});

test('D&D: a Fireball plans one shock on its explosion, which camera shake reads', () => {
  const plan = [
    st('cast', 'cast', 'jb2a.cast_generic.fire.01.orange', { at: { x: 0, y: 0 }, r: sq(1), duration: 2247 }),
    st('fly', 'travel', 'jb2a.fire_bolt.orange', { at: { x: 1200, y: 0 }, r: sq(0.5), duration: 1980 }),
    st('boom', 'template', 'jb2a.fireball.explosion.orange', { at: { x: 1200, y: 0 }, r: sq(4), delay: 1500, duration: 4222 }),
  ];
  const tags = planDistortions(plan, opts({ cast: 1, fly: 0, boom: 0 }, { context: { type: 'template', area: { center: { x: 1200, y: 0 }, diameter: sq(8) } }, element: 'fire' }));
  assert.equal(tags.size, 1);
  const [[stage, tag]] = [...tags];
  assert.equal(stage.stageId, 'boom');
  assert.equal(tag.kind, 'shock');
  assert.equal(tag.radius, 1.5 * sq(4));
});
