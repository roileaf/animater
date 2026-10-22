import test from 'node:test';
import assert from 'node:assert/strict';
import { isLuminous, lightShape, lightColor, planLights, envelope } from '../../../scripts/engines/lighting/effect-lights.mjs';
import { HEX } from '../../../scripts/engines/playback/color-parity.mjs';
import { ELEMENT_COLORS } from '../../../scripts/catalogs/shared/element-choice.mjs';

const GRID = 100;
const sq = n => n * GRID;
// A stage with a place on the map (pointOf reads `at`) and a footprint radius in pixels (`r`).
const st = (stageId, kind, asset, extra = {}) => ({ stageId, kind, asset, assets: [asset], delay: 0, duration: 1000, fadeOut: 0, ...extra });
const opts = (tiers, extra = {}) => ({
  tiers: new Map(Object.entries(tiers)), grid: GRID,
  pointOf: s => s.at ?? null, radiusOf: s => s.r ?? null, ...extra,
});

test('classifier: physical and smoke never luminous', () => {
  for (const k of ['jb2a.fireball.explosion.orange', 'jb2a.chain_lightning.primary.blue', 'jb2a.magic_missile.purple', 'jb2a.fire_bolt.orange', 'jb2a.healing_generic.200px.green'])
    assert.equal(isLuminous(k), true, k);
  for (const k of ['jb2a.bolt.physical.white02', 'jb2a.arrow.physical.white.01', 'jb2a.smoke.puff.centered.grey', 'jb2a.liquid.splash02.red', 'jb2a.darkness.black', 'jb2a.melee_attack.01.trail'])
    assert.equal(isLuminous(k), false, k);
  assert.equal(isLuminous(''), false);
  assert.equal(isLuminous(undefined), false);
});

test('shape: travel glows, lightning strobes, impacts flash, fire areas flicker, other auras pulse', () => {
  assert.equal(lightShape(st('a', 'projectile', 'jb2a.fire_bolt.orange')), 'glow');
  assert.equal(lightShape(st('a', 'travel', 'jb2a.magic_missile.purple')), 'glow');
  assert.equal(lightShape(st('a', 'impact', 'jb2a.chain_lightning.primary.blue')), 'strobe');
  assert.equal(lightShape(st('a', 'impact', 'jb2a.fireball.explosion.orange')), 'flash');
  assert.equal(lightShape(st('a', 'template', 'jb2a.fireball.explosion.orange', { duration: 1500 })), 'flash');
  assert.equal(lightShape(st('a', 'template', 'jb2a.fire_ring.orange', { duration: 6000 })), 'flicker');
  assert.equal(lightShape(st('a', 'aura', 'jb2a.flames.orange', { persist: true })), 'flicker');
  assert.equal(lightShape(st('a', 'aura', 'jb2a.healing_generic.200px.green', { persist: true })), 'pulse');
  assert.equal(lightShape(st('a', 'template', 'jb2a.energy_strands.complete.blue', { duration: 6000 })), 'pulse');
});

test('colour: tint, then key colour word, then element', () => {
  assert.equal(lightColor({ tint: '#123456', asset: 'jb2a.fireball.explosion.orange' }), '#123456');
  assert.equal(lightColor({ asset: 'jb2a.fireball.explosion.orange' }), HEX.orange);
  assert.equal(lightColor({ asset: 'jb2a.energy_strands.complete.white.01' }, { element: 'cold' }), '#ffe8c0');
  assert.equal(lightColor({ asset: 'jb2a.energy_strands.complete' }, { element: 'cold' }), ELEMENT_COLORS.cold[0]);
});

test('colour: disabled tint is ignored, aliases and recipe colour fall back in order', () => {
  assert.equal(lightColor({ tint: '#123456', tintEnabled: false, asset: 'jb2a.fireball.explosion.orange' }), HEX.orange);
  assert.equal(lightColor({ tint: '#123456', tintEnabled: true, asset: 'jb2a.fireball.explosion.orange' }), '#123456');
  assert.equal(lightColor({ asset: 'jb2a.energy_strands.complete' }, { element: 'lightning' }), ELEMENT_COLORS.electricity[0]);
  assert.equal(lightColor({ asset: 'jb2a.energy_strands.complete' }, { recipeColor: '#abcdef' }), '#abcdef');
  assert.equal(lightColor({ asset: 'jb2a.energy_strands.complete' }), '#ffe8c0');
});

test('planLights groups spots within 2 squares and anchors on tier 0', () => {
  const impact = st('impact', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: sq(10), y: sq(10) }, r: sq(2), delay: 400 });
  const flare = st('flare', 'sprite', 'jb2a.sparks.orange', { at: { x: sq(11), y: sq(10) }, r: sq(1), delay: 400 });
  const plan = [impact, flare];
  const lights = planLights(plan, opts({ impact: 0, flare: 1 }));
  assert.equal(lights.size, 1);
  assert.ok(lights.has(impact));
  assert.equal(lights.get(impact).shape, 'flash');

  // Three targets 5 squares apart: three lights; a fourth is dropped (earliest spots first).
  const hits = [0, 1, 2, 3].map(i => st('hit' + i, 'impact', 'jb2a.fireball.explosion.orange', { at: { x: sq(5 * i), y: 0 }, delay: 100 * i }));
  const four = planLights(hits, opts(Object.fromEntries(hits.map(h => [h.stageId, 0]))));
  assert.deepEqual([...four.keys()].map(s => s.stageId), ['hit0', 'hit1', 'hit2']);
  assert.equal(planLights(hits.slice(0, 3), opts(Object.fromEntries(hits.map(h => [h.stageId, 0])))).size, 3);
  assert.equal(planLights(hits, opts(Object.fromEntries(hits.map(h => [h.stageId, 0])), { perAnimation: 2 })).size, 2);
});

test('a luminous stage at a higher tier is lit through the tier 0 stage at its spot', () => {
  const impact = st('impact', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 }, r: sq(2), delay: 300 });
  const cloud = st('cloud', 'sprite', 'jb2a.smoke.puff.centered.grey', { at: { x: sq(1), y: 0 }, delay: 100 });
  const far = st('far', 'sprite', 'jb2a.smoke.puff.centered.grey', { at: { x: sq(9), y: 0 } });
  const lights = planLights([far, cloud, impact], opts({ impact: 1, cloud: 0, far: 0 }));
  assert.deepEqual([...lights.keys()].map(s => s.stageId), ['cloud']);
  assert.equal(lights.get(cloud).startMs, 200);
});

test('no tier 0 at a spot means no light there', () => {
  const impact = st('impact', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 } });
  assert.equal(planLights([impact], opts({ impact: 1 })).size, 0);
  assert.equal(planLights([impact], opts({ impact: 2 })).size, 0);
});

test('stages that are not luminous, have no place, or are not visual get no light', () => {
  const smoke = st('smoke', 'impact', 'jb2a.smoke.puff.centered.grey', { at: { x: 0, y: 0 } });
  const nowhere = st('nowhere', 'impact', 'jb2a.fireball.explosion.orange');
  const sound = st('sound', 'sound', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 } });
  assert.equal(planLights([smoke, nowhere, sound], opts({ smoke: 0, nowhere: 0, sound: 0 })).size, 0);
});

test('radius is 1.5x the footprint, bright is half, clamped to 1..12 squares', () => {
  const size = r => {
    const s = st('s', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 }, r });
    return planLights([s], opts({ s: 0 })).get(s);
  };
  assert.equal(size(sq(4)).dim, 6);
  assert.equal(size(sq(4)).bright, 3);
  assert.equal(size(sq(0.2)).dim, 1);
  assert.equal(size(sq(0.2)).bright, 0.5);
  assert.equal(size(null).dim, 1);
  assert.equal(size(sq(40)).dim, 12);
  assert.equal(size(sq(40)).bright, 6);
});

test('tag carries colour, timing relative to the anchor, fade and lasting', () => {
  const area = st('area', 'template', 'jb2a.fire_ring.orange', { at: { x: 0, y: 0 }, r: sq(2), delay: 500, duration: 6000, fadeOut: 800, persist: true });
  const tag = planLights([area], opts({ area: 0 }, { element: 'cold' })).get(area);
  assert.equal(tag.color, HEX.orange);
  assert.equal(tag.shape, 'flicker');
  assert.equal(tag.lasting, true);
  assert.equal(tag.startMs, 0);
  assert.equal(tag.fadeMs, 800);
  // A persisting stage loops until it is ended: its light lasts until its anchor ends, whatever its duration.
  assert.equal(tag.lengthMs, 86400000);
  // A long area that does not persist lasts its own duration.
  const timed = st('timed', 'template', 'jb2a.fire_ring.orange', { at: { x: 0, y: 0 }, duration: 6000 });
  const timedTag = planLights([timed], opts({ timed: 0 })).get(timed);
  assert.equal(timedTag.lasting, true);
  assert.equal(timedTag.lengthMs, 6000);
});

test('a lasting lightning area pulses instead of strobing out', () => {
  assert.equal(lightShape(st('a', 'template', 'jb2a.lightning_ball.blue', { persist: true })), 'pulse');
  assert.equal(lightShape(st('a', 'impact', 'jb2a.lightning_ball.blue')), 'strobe');
});

test('a still light carries its place; a light on a following anchor and a flight do not', () => {
  const cone = st('cone', 'template', 'jb2a.breath_weapons.fire.cone.orange', { at: { x: sq(5), y: sq(1) } });
  assert.deepEqual(planLights([cone], opts({ cone: 0 })).get(cone).at, { x: sq(5), y: sq(1) });
  assert.equal(planLights([cone], opts({ cone: 0 })).get(cone).follow, undefined);
  const aura = st('aura', 'aura', 'jb2a.flames.orange', { at: { x: 0, y: 0 }, persist: true });
  const auraTag = planLights([aura], opts({ aura: 0 }, { follows: s => s.kind === 'aura' })).get(aura);
  assert.equal(auraTag.follow, true);
  assert.equal(auraTag.at, undefined);
  const bolt = st('bolt', 'projectile', 'jb2a.fire_bolt.orange', { at: { x: sq(8), y: 0 } });
  assert.equal(planLights([bolt], opts({ bolt: 0 }, { follows: () => true })).get(bolt).at, undefined);
});

test('slow motion stretches flash, strobe and a flight arrival; lasting lights keep their speed', () => {
  const boom = st('boom', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 } });
  const zap = st('zap', 'impact', 'jb2a.chain_lightning.primary.blue', { at: { x: sq(20), y: 0 } });
  const bolt = st('bolt', 'projectile', 'jb2a.fire_bolt.orange', { at: { x: sq(8), y: 0 }, duration: 1600, contact: 500 });
  const ring = st('ring', 'template', 'jb2a.fire_ring.orange', { at: { x: sq(40), y: 0 }, persist: true });
  const tiers = { boom: 0, zap: 0, bolt: 0, ring: 0 };
  const plain = planLights([boom, zap, bolt, ring], opts(tiers));
  const slowed = planLights([boom, zap, bolt, ring], opts(tiers, { tempo: 0.5 }));
  assert.equal(slowed.get(boom).lengthMs, 2 * plain.get(boom).lengthMs);
  assert.equal(slowed.get(zap).lengthMs, 2 * plain.get(zap).lengthMs);
  assert.equal(slowed.get(boom).rate, 0.5);
  assert.equal(slowed.get(bolt).arriveMs, 1000);
  assert.equal(slowed.get(ring).rate, undefined);
  assert.equal(plain.get(boom).rate, undefined);
  // The flash peaks at 120 ms instead of 60 ms, and is still lit when the plain one is gone.
  assert.equal(envelope(slowed.get(boom), 120), 1);
  assert.ok(envelope(slowed.get(boom), 60) < 1);
  assert.equal(envelope(plain.get(boom), 1000), 0);
  assert.ok(envelope(slowed.get(boom), 1000) > 0);
  // A one-shot area slowed past the lasting length is still a one-shot flash.
  const burst = st('burst', 'template', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 }, duration: 3000 });
  const tag = planLights([burst], opts({ burst: 0 }, { tempo: 0.5 })).get(burst);
  assert.equal(tag.shape, 'flash');
  assert.equal(tag.lasting, false);
});

test('a burst and a later lasting area at one spot each keep their light', () => {
  const burst = st('burst', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 }, delay: 0 });
  const wall = st('wall', 'template', 'jb2a.fire_ring.orange', { at: { x: sq(1), y: 0 }, delay: 400, persist: true });
  const lights = planLights([burst, wall], opts({ burst: 0, wall: 0 }));
  assert.equal(lights.get(burst).shape, 'flash');
  assert.equal(lights.get(wall).shape, 'flicker');
  assert.equal(lights.get(wall).lasting, true);
  assert.equal(lights.get(wall).lengthMs, 86400000);
  // The two count towards the same cap.
  assert.equal(planLights([burst, wall], opts({ burst: 0, wall: 0 }, { perAnimation: 1 })).size, 1);
  // With one tier 0 stage at the spot, the lasting light rides on the lasting stage.
  const one = planLights([burst, wall], opts({ burst: 1, wall: 0 }));
  assert.deepEqual([...one.keys()].map(s => s.stageId), ['wall']);
});

test('tags carry the source level and elevation when known', () => {
  const boom = st('boom', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 } });
  const tag = planLights([boom], opts({ boom: 0 }, { level: 'lvl2', elevation: 10 })).get(boom);
  assert.equal(tag.level, 'lvl2');
  assert.equal(tag.elevation, 10);
  const bare = planLights([boom], opts({ boom: 0 })).get(boom);
  assert.equal('level' in bare, false);
  assert.equal('elevation' in bare, false);
});

test('a travelling stage carries its route and arrival time', () => {
  const bolt = st('bolt', 'projectile', 'jb2a.fire_bolt.orange', { at: { x: sq(8), y: 0 }, r: sq(1), duration: 800, contact: 500 });
  const tag = planLights([bolt], opts({ bolt: 0 }, { originOf: () => ({ x: 0, y: 0 }) })).get(bolt);
  assert.deepEqual(tag.from, { x: 0, y: 0 });
  assert.deepEqual(tag.to, { x: sq(8), y: 0 });
  assert.equal(tag.arriveMs, 500);
  const slow = st('slow', 'travel', 'jb2a.fire_bolt.orange', { at: { x: sq(8), y: 0 }, duration: 1000 });
  assert.equal(planLights([slow], opts({ slow: 0 }, { originOf: () => ({ x: 0, y: 0 }) })).get(slow).arriveMs, 550);
  assert.equal(planLights([slow], opts({ slow: 0 })).get(slow).from, undefined);
});

test('every light fades over at least 300 ms, or the stage fade-out if larger', () => {
  const a = st('a', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 } });
  const b = st('b', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: sq(20), y: 0 }, fadeOut: 900 });
  const lights = planLights([a, b], opts({ a: 0, b: 0 }));
  assert.equal(lights.get(a).fadeMs, 300);
  assert.equal(lights.get(b).fadeMs, 900);
});

test('envelope: flash peaks at 60 ms and is gone after its decay and fade', () => {
  const tag = { shape: 'flash', startMs: 0, lengthMs: 650, fadeMs: 300 };
  assert.equal(envelope(tag, 60), 1);
  assert.ok(envelope(tag, 400) < 1 && envelope(tag, 400) > 0);
  assert.equal(envelope(tag, 1000), 0);
  assert.equal(envelope(tag, -5), 0);
  assert.equal(envelope({ ...tag, startMs: 200 }, 100), 0);
  assert.equal(envelope({ ...tag, startMs: 200 }, 260), 1);
});

test('envelope: glow fades in over 100 ms, holds, then fades out; flicker and pulse are steady', () => {
  const glow = { shape: 'glow', startMs: 0, lengthMs: 1000, fadeMs: 300 };
  assert.equal(envelope(glow, 50), 0.5);
  assert.equal(envelope(glow, 500), 1);
  assert.equal(envelope(glow, 1150), 0.5);
  assert.equal(envelope(glow, 1300), 0);
  for (const shape of ['flicker', 'pulse']) {
    const tag = { shape, startMs: 0, lengthMs: 1000, fadeMs: 300 };
    assert.equal(envelope(tag, 500), 1);
    assert.equal(envelope(tag, 1150), 0.5);
  }
});

test('strobe peaks three times in the first 300 ms, then decays', () => {
  const tag = { shape: 'strobe', startMs: 0, lengthMs: 700, fadeMs: 300 };
  const samples = [];
  for (let t = 0; t <= 1000; t += 2) samples.push(envelope(tag, t));
  let peaks = 0;
  for (let i = 1; i < samples.length - 1; i++) if (samples[i] > samples[i - 1] && samples[i] >= samples[i + 1] && samples[i] > 0.9) peaks++;
  assert.equal(peaks, 3);
  assert.ok(samples.every(v => v >= 0 && v <= 1));
  // After the strobes it only goes down.
  for (let t = 300; t < 1000; t += 10) assert.ok(envelope(tag, t + 10) <= envelope(tag, t), String(t));
  assert.equal(envelope(tag, 1000), 0);
});

test('steady envelope never strobes', () => {
  const tag = { shape: 'strobe', startMs: 0, lengthMs: 700, fadeMs: 300 };
  let falling = false, prev = 0;
  for (let t = 0; t <= 1000; t += 5) {
    const v = envelope(tag, t, { steady: true });
    assert.ok(v >= 0 && v <= 1);
    if (v < prev) falling = true;
    else if (v === prev) continue;
    else assert.ok(!falling, 'rose again at ' + t);
    prev = v;
  }
  assert.ok(falling);
  assert.equal(Math.max(...Array.from({ length: 201 }, (_, i) => envelope(tag, i * 5, { steady: true }))), 1);
});

test('a flight and its impact are separate lights: a glow on the projectile, a flash on the impact', () => {
  const bolt = st('bolt', 'projectile', 'jb2a.fire_bolt.orange', { at: { x: sq(8), y: 0 }, r: sq(1), duration: 800, contact: 500 });
  const boom = st('boom', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: sq(8), y: 0 }, r: sq(2), delay: 500 });
  const lights = planLights([bolt, boom], opts({ bolt: 0, boom: 0 }));
  assert.equal(lights.size, 2);
  assert.equal(lights.get(bolt).shape, 'glow');
  assert.equal(lights.get(boom).shape, 'flash');
  // A flight that is not tier 0 gets no glow, and does not take the impact's place.
  const noGlow = planLights([bolt, boom], opts({ bolt: 1, boom: 0 }));
  assert.deepEqual([...noGlow.keys()].map(s => s.stageId), ['boom']);
});

test('flight glows and spot lights are capped separately', () => {
  const bolts = [0, 1, 2, 3].map(i => st('b' + i, 'projectile', 'jb2a.fire_bolt.orange', { at: { x: sq(5 * i), y: 0 }, delay: 50 * i }));
  const hits = [0, 1, 2, 3].map(i => st('h' + i, 'impact', 'jb2a.fireball.explosion.orange', { at: { x: sq(5 * i), y: 0 }, delay: 500 + 50 * i }));
  const tiers = Object.fromEntries([...bolts, ...hits].map(s => [s.stageId, 0]));
  const lights = planLights([...bolts, ...hits], opts(tiers));
  assert.deepEqual([...lights.keys()].map(s => s.stageId).sort(), ['b0', 'b1', 'b2', 'h0', 'h1', 'h2']);
});

test('a glow ends when the flight lands, then fades out', () => {
  const bolt = st('bolt', 'projectile', 'jb2a.fire_bolt.orange', { at: { x: sq(8), y: 0 }, duration: 800, contact: 500 });
  const tag = planLights([bolt], opts({ bolt: 0 })).get(bolt);
  assert.equal(tag.arriveMs, 500);
  assert.equal(tag.lengthMs, 500);
  assert.equal(envelope(tag, 400), 1);
  assert.equal(envelope(tag, 650), 0.5);
  assert.equal(envelope(tag, 800), 0);
  const slow = st('slow', 'travel', 'jb2a.fire_bolt.orange', { at: { x: sq(8), y: 0 }, duration: 1000 });
  assert.equal(planLights([slow], opts({ slow: 0 })).get(slow).lengthMs, 550);
});

test('a stage missing from the tiers map is not tier 0 and cannot anchor', () => {
  const impact = st('impact', 'impact', 'jb2a.fireball.explosion.orange', { at: { x: 0, y: 0 } });
  assert.equal(planLights([impact], opts({})).size, 0);
});
