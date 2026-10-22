import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKS, isHarmful, markElement, planMarks, layoutBlotches, markAlpha, markTiming } from '../../../scripts/engines/marks/ground-marks.mjs';

const GRID = 100;
const sq = n => n * GRID;
// A stage with a place on the map (pointOf reads `at`) and a footprint in pixels (sizeOf reads `size`).
const st = (stageId, kind, at, extra = {}) => ({ stageId, kind, at, assets: ['jb2a.x'], delay: 0, duration: 1000, ...extra });
const opts = (tiers, extra = {}) => ({
  context: { element: 'fire', sceneId: 'scene1' }, recipe: {}, tiers: new Map(Object.entries(tiers)), gridPx: GRID,
  pointOf: s => s.at ?? null, sizeOf: s => s.size ?? null, seed: 1234, ...extra,
});
const only = map => { assert.equal(map.size, 1); return [...map][0]; };

test('damage moments and buffs never mark', () => {
  assert.equal(isHarmful({ automatic: true, type: 'attack' }, { itemDamages: () => false }), true);
  assert.equal(isHarmful({ automatic: true, type: 'spell', item: {} }, { itemDamages: () => false }), false); // Resist Energy
  assert.equal(isHarmful({ type: 'attack' }, { itemDamages: () => true }), false); // not dispatched (damage moment, finisher)
});
test('harmful: damage and save rolls, damaging spells, actions and uses; not checks', () => {
  const item = { name: 'Fireball' };
  assert.equal(isHarmful({ automatic: true, type: 'damage' }, { itemDamages: () => false }), true);
  assert.equal(isHarmful({ automatic: true, type: 'save' }, { itemDamages: () => false }), true);
  assert.equal(isHarmful({ automatic: true, type: 'spell', item }, { itemDamages: i => i === item }), true);
  assert.equal(isHarmful({ automatic: true, type: 'action', item }, { itemDamages: () => true }), true);
  assert.equal(isHarmful({ automatic: true, type: 'check', item }, { itemDamages: () => true }), false);
  // D&D 5e activities and Daggerheart actions arrive as a 'use'.
  assert.equal(isHarmful({ automatic: true, type: 'use', item }, { itemDamages: i => i === item }), true);
  assert.equal(isHarmful({ automatic: true, type: 'use', item }, { itemDamages: () => false }), false);
  // A placed area spell (PF2e Fireball, D&D Fireball) plays from its template event.
  assert.equal(isHarmful({ automatic: true, type: 'template', item }, { itemDamages: i => i === item }), true);
  assert.equal(isHarmful({ automatic: true, type: 'template', item }, { itemDamages: () => false }), false);
  assert.equal(isHarmful({ automatic: false, type: 'spell', item }, { itemDamages: () => true }), false);
  assert.equal(isHarmful(null, { itemDamages: () => true }), false);
});

test('element: weapon mark element, then event, then chosen; physical none', () => {
  assert.equal(markElement({ markElement: 'acid' }, { element: 'fire' }), 'acid');
  assert.equal(markElement({}, { element: 'necrotic' }), 'void');
  assert.equal(markElement({}, { element: 'slashing' }), null);
});
test('element: chosen element last; aliases; elements without a mark leave none', () => {
  assert.equal(markElement({ chosenElement: 'cold' }, {}), 'cold');
  assert.equal(markElement({ chosenElement: 'cold' }, { element: 'lightning' }), 'electricity');
  assert.equal(markElement({}, { element: 'negative' }), 'void');
  assert.equal(markElement({}, { element: 'thunder' }), 'sonic');
  for (const element of ['mental', 'vitality', 'spirit', 'bleed', 'piercing', null]) assert.equal(markElement({}, { element }), null, String(element));
  assert.deepEqual(MARKS, { fire: 'scorch', cold: 'rime', acid: 'residue', electricity: 'streaks', poison: 'stain', sonic: 'cracks', force: 'cracks', void: 'withered' });
});

test('a fireball marks its area once and skips spots inside it', () => {
  const center = { x: sq(10), y: sq(10) };
  const bead = st('bead', 'travel', center, { flightOutcome: 'target' });
  const blast = st('blast', 'template', center, { delay: 800 });
  const hits = [{ x: sq(9), y: sq(10) }, { x: sq(11), y: sq(11) }, { x: sq(10), y: sq(12) }].map(at => st('hit', 'impact', at, { delay: 900, size: sq(1) }));
  const marks = planMarks([bead, blast, ...hits], opts({ bead: 0, blast: 0, hit: 0 }, { area: { type: 'circle', center, diameter: sq(8) } }));
  const [anchor, tag] = only(marks);
  assert.equal(anchor, blast);
  assert.equal(tag.mark, 'scorch');
  assert.equal(tag.shape, 'circle');
  assert.deepEqual(tag.at, center);
  assert.equal(tag.radius, sq(4));
  assert.equal(tag.delayMs, 0);
  assert.equal(tag.lasting, false);
  assert.equal(tag.sceneId, 'scene1');
  assert.equal(typeof tag.seed, 'number');
});
test('a target outside the area keeps its own spot', () => {
  const center = { x: sq(10), y: sq(10) };
  const blast = st('blast', 'template', center);
  const inside = st('hit', 'impact', { x: sq(11), y: sq(10) }, { delay: 100 });
  const outside = st('hit', 'impact', { x: sq(20), y: sq(10) }, { delay: 100 });
  const marks = planMarks([blast, inside, outside], opts({ blast: 0, hit: 0 }, { area: { type: 'circle', center, diameter: sq(4) } }));
  assert.equal(marks.size, 2);
  assert.equal(marks.get(blast).shape, 'circle');
  assert.equal(marks.get(outside).shape, 'spot');
  assert.equal(marks.has(inside), false);
});
test('an area whose template is not tier 0 rides on a tier 0 stage inside it', () => {
  const center = { x: sq(10), y: sq(10) };
  const blast = st('blast', 'template', center, { delay: 800 });
  const hit = st('hit', 'impact', { x: sq(11), y: sq(10) }, { delay: 500 });
  const [anchor, tag] = only(planMarks([hit, blast], opts({ blast: 1, hit: 0 }, { area: { type: 'circle', center, diameter: sq(4) } })));
  assert.equal(anchor, hit);
  assert.equal(tag.shape, 'circle');
  assert.equal(tag.delayMs, 300); // the area lands at 800, its anchor started at 500
});
test('lines and cones carry their geometry; a lasting area is lasting', () => {
  const line = { type: 'line', center: { x: 0, y: 0 }, endpoint: { x: sq(6), y: 0 }, length: sq(6), width: sq(1) };
  const wall = st('wall', 'template', { x: sq(3), y: 0 }, { persist: true, delay: 300 });
  const lineTag = only(planMarks([wall], opts({ wall: 0 }, { area: line })))[1];
  assert.equal(lineTag.shape, 'line');
  assert.deepEqual(lineTag.at, { x: 0, y: 0 });
  assert.deepEqual(lineTag.endpoint, { x: sq(6), y: 0 });
  assert.equal(lineTag.width, sq(1));
  assert.equal(lineTag.length, sq(6));
  assert.equal(lineTag.lasting, true);
  // A target beside the line, inside its width, is covered; one past its end is not.
  const covered = st('hit', 'impact', { x: sq(2), y: 40 }), beyond = st('hit', 'impact', { x: sq(8), y: 0 });
  assert.deepEqual([...planMarks([wall, covered, beyond], opts({ wall: 0, hit: 0 }, { area: line })).keys()], [wall, beyond]);

  const cone = { type: 'cone', center: { x: 0, y: 0 }, endpoint: { x: sq(3), y: 0 }, length: sq(3), angle: 90 };
  const breath = st('breath', 'template', { x: sq(1.5), y: 0 });
  const inCone = st('hit', 'impact', { x: sq(2), y: sq(1.5) }), outCone = st('hit', 'impact', { x: sq(1), y: sq(2.5) });
  const marks = planMarks([breath, inCone, outCone], opts({ breath: 0, hit: 0 }, { area: cone }));
  assert.deepEqual([...marks.keys()], [breath, outCone]);
  assert.equal(marks.get(breath).shape, 'cone');
  assert.equal(marks.get(breath).angle, 90);
  assert.equal(marks.get(breath).length, sq(3));
});

test('a wall hit marks the wall point; a past miss marks nothing', () => {
  const wallPoint = { x: sq(4), y: sq(1) };
  const bolt = st('bolt', 'projectile', wallPoint, { delay: 200, contact: 400, flightTo: wallPoint, flightOutcome: 'wall', size: sq(1) });
  const [anchor, tag] = only(planMarks([bolt], opts({ bolt: 0 })));
  assert.equal(anchor, bolt);
  assert.equal(tag.shape, 'spot');
  assert.deepEqual(tag.at, wallPoint);
  assert.equal(tag.delayMs, 400); // lands at its contact, from its own start
  const past = st('bolt', 'projectile', { x: sq(9), y: sq(1) }, { flightTo: { x: sq(9), y: sq(1) }, flightOutcome: 'past' });
  assert.equal(planMarks([past], opts({ bolt: 0 })).size, 0);
});
test('a splash weapon that misses marks where it lands; a miss that never lands marks nothing', () => {
  const landing = { x: sq(5), y: sq(6) };
  const flask = st('flask', 'travel', landing, { landing, duration: 1000 });
  const context = { element: 'acid', outcome: 'failure', sceneId: 's' };
  const [, tag] = only(planMarks([flask], opts({ flask: 0 }, { context })));
  assert.equal(tag.mark, 'residue');
  assert.deepEqual(tag.at, landing);
  assert.equal(tag.delayMs, 550); // no contact: lands at 55% of its flight
  const bent = st('bolt', 'travel', { x: sq(5), y: sq(6) });
  assert.equal(planMarks([bent], opts({ bolt: 0 }, { context })).size, 0);
});

test('spots within a square share one mark; size is the footprint, clamped', () => {
  const a = st('hit', 'impact', { x: sq(2), y: sq(2) }, { delay: 300, size: sq(4) });
  const near = st('burst', 'impact', { x: sq(2.5), y: sq(2) }, { delay: 100, size: sq(1) });
  const far = st('hit', 'impact', { x: sq(8), y: sq(2) }, { delay: 300, size: 10 });
  const marks = planMarks([a, near, far], opts({ hit: 0, burst: 1 }));
  assert.equal(marks.size, 2);
  const first = marks.get(a);
  assert.equal(first.radius, sq(2) / 2); // the bigger footprint, clamped to 2 squares
  assert.deepEqual(first.at, { x: sq(2.5), y: sq(2) }); // the earliest landing describes the spot
  assert.equal(first.delayMs, 0); // landed (100) before its anchor started (300): shown as the anchor starts
  assert.equal(marks.get(far).radius, sq(0.5) / 2);
  assert.notEqual(first.seed, marks.get(far).seed);
});
test('a missing tier cannot anchor; physical and non-visual stages mark nothing', () => {
  assert.equal(planMarks([st('hit', 'impact', { x: 0, y: 0 })], opts({ other: 0 })).size, 0);
  assert.equal(planMarks([st('hit', 'impact', { x: 0, y: 0 })], opts({ hit: 0 }, { context: { element: 'slashing' } })).size, 0);
  assert.equal(planMarks([st('cue', 'sound', { x: 0, y: 0 })], opts({ cue: 0 })).size, 0);
});
test('level and elevation come from the source token', () => {
  const source = { document: { level: 'upper', elevation: 10, parent: { id: 'sc' } } };
  const [, tag] = only(planMarks([st('hit', 'impact', { x: 0, y: 0 })], opts({ hit: 0 }, { context: { element: 'cold', source } })));
  assert.equal(tag.level, 'upper');
  assert.equal(tag.elevation, 10);
  assert.equal(tag.sceneId, 'sc');
  assert.equal(tag.mark, 'rime');
});

test('layout is the same for the same seed and capped at 12', () => {
  const circle = { mark: 'scorch', shape: 'circle', at: { x: 0, y: 0 }, radius: sq(20), seed: 42 };
  const blotches = layoutBlotches(circle, GRID);
  assert.deepEqual(layoutBlotches({ ...circle }, GRID), blotches);
  assert.equal(blotches.length, 12);
  assert.notDeepEqual(layoutBlotches({ ...circle, seed: 43 }, GRID), blotches);
  for (const b of blotches) {
    assert.ok(Math.hypot(b.x, b.y) <= sq(20), 'inside the circle');
    assert.ok(b.r > 0 && b.rotation >= 0 && b.rotation < 2 * Math.PI && Number.isInteger(b.variant));
  }
  // Denser near the centre: more than half sit in the inner half of the radius.
  assert.ok(blotches.filter(b => Math.hypot(b.x, b.y) < sq(10)).length > 6);
  const spot = layoutBlotches({ shape: 'spot', at: { x: sq(1), y: sq(1) }, radius: sq(0.5), seed: 7 }, GRID);
  assert.ok(spot.length >= 1 && spot.length <= 3);
  assert.deepEqual([spot[0].x, spot[0].y], [sq(1), sq(1)]);
  assert.ok(spot[0].r >= sq(0.5) * 0.8 && spot[0].r <= sq(0.5) * 1.2);
});
test('lines and cones lay blotches along their shape', () => {
  const line = layoutBlotches({ shape: 'line', at: { x: 0, y: 0 }, endpoint: { x: sq(12), y: 0 }, length: sq(12), width: sq(1), seed: 5 }, GRID);
  assert.ok(line.length > 1 && line.length <= 12);
  for (const b of line) assert.ok(b.x >= 0 && b.x <= sq(12) && Math.abs(b.y) <= sq(0.5), JSON.stringify(b));
  const cone = layoutBlotches({ shape: 'cone', at: { x: 0, y: 0 }, endpoint: { x: 0, y: sq(6) }, length: sq(6), angle: 90, seed: 5 }, GRID);
  assert.ok(cone.length > 1 && cone.length <= 12);
  for (const b of cone) assert.ok(b.y > 0 && b.y <= sq(6) && Math.abs(b.x) <= b.y, JSON.stringify(b));
});

test('markTiming: minutes split 40/60, 0 never fades', () => {
  assert.deepEqual(markTiming(5), { holdMs: 120000, fadeMs: 180000 });
  assert.deepEqual(markTiming(10), { holdMs: 240000, fadeMs: 360000 });
  assert.deepEqual(markTiming(0), { holdMs: Infinity, fadeMs: 0 });
  assert.equal(markAlpha(1e12, markTiming(0)), 1);
});
test('markAlpha: in, hold, fade, gone', () => {
  assert.equal(markAlpha(150), 0.5);
  assert.equal(markAlpha(60000), 1);
  assert.equal(markAlpha(120000 + 90000), 0.5);
  assert.equal(markAlpha(400000), 0);
});
test('markAlpha: before landing nothing; custom timings', () => {
  assert.equal(markAlpha(-1), 0);
  assert.equal(markAlpha(0), 0);
  assert.equal(markAlpha(50, { inMs: 100 }), 0.5);
  assert.equal(markAlpha(1500, { holdMs: 1000, fadeMs: 1000 }), 0.5);
});
