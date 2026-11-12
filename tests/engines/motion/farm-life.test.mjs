import test from 'node:test';
import assert from 'node:assert/strict';
import { FARM_KINDS, farmStep, farmHerd, createFarmLife } from '../../../scripts/engines/motion/farm-life.mjs';

const calm = { dt: 1 / 20, grid: 100, near: [], ok: () => true, blocked: () => false, random: () => 0.5 };

// Roi: farm animals besides the town's: cows, goats, sheep, pigs, horses.
test('five farm kinds, each with its size and pace; a horse longer than a cow, a goat the smallest', () => {
  assert.deepEqual(Object.keys(FARM_KINDS), ['cows', 'goats', 'sheep', 'pigs', 'horses']);
  assert.ok(FARM_KINDS.horses.squares > FARM_KINDS.cows.squares && FARM_KINDS.cows.squares > FARM_KINDS.sheep.squares);
  assert.ok(FARM_KINDS.goats.squares <= Math.min(...Object.values(FARM_KINDS).map((k) => k.squares)));
});

test('a grazing animal stays put a while, then walks a little and grazes again', () => {
  let a = { kind: 'cows', x: 500, y: 500, a: 0, mode: 'graze', wait: 0.2, v: 0 };
  a = farmStep(a, calm); a = farmStep(a, calm); a = farmStep(a, calm); a = farmStep(a, calm);
  assert.equal(a.mode, 'walk');
  const from = { x: a.x, y: a.y }; for (let i = 0; i < 20; i++) a = farmStep(a, calm);
  assert.ok(Math.hypot(a.x - from.x, a.y - from.y) > 5, 'it moved'); assert.ok(Math.hypot(a.x - from.x, a.y - from.y) < 300, 'only a little');
});

test('it never steps where it may not go, nor across a wall or its region\'s edge', () => {
  let a = { kind: 'sheep', x: 500, y: 500, a: Math.PI / 2, mode: 'walk', wait: 30, v: 0 };
  for (let i = 0; i < 200; i++) a = farmStep(a, { ...calm, ok: (x) => x < 560, blocked: (p, q) => q.y < 450 });
  assert.ok(a.x < 560 && a.y >= 450, `${a.x}, ${a.y}`);
});

test('a creature close by or a loud noise sends it off at a run, away; it calms down after', () => {
  let a = { kind: 'goats', x: 500, y: 500, a: 0, mode: 'graze', wait: 5, v: 0 };
  a = farmStep(a, { ...calm, near: [{ x: 540, y: 500 }] });
  assert.equal(a.mode, 'flee');
  const start = a.x; for (let i = 0; i < 10; i++) a = farmStep(a, { ...calm, near: [{ x: 540, y: 500 }] });
  assert.ok(a.x < start - 20, 'away from it, fast');
  for (let i = 0; i < 200; i++) a = farmStep(a, calm);
  assert.notEqual(a.mode, 'flee', 'settled again');
  let b = farmStep({ kind: 'cows', x: 500, y: 500, a: 0, mode: 'graze', wait: 5, v: 0 }, { ...calm, noise: { x: 700, y: 500, radius: 600 } });
  assert.equal(b.mode, 'flee');
});

test('a herd keeps loosely together: one strayed far walks back toward the rest', () => {
  const herd = [{ x: 500, y: 500 }, { x: 520, y: 510 }, { x: 490, y: 480 }];
  const middle = farmHerd(herd);
  let a = { kind: 'sheep', x: 1500, y: 500, a: 0, mode: 'graze', wait: 0.01, v: 0 };
  for (let i = 0; i < 60; i++) a = farmStep(a, { ...calm, herd: middle });
  assert.ok(a.x < 1500, `came back toward them: ${a.x}`);
});

// Roi's picks from the audition; each call a little different every time (pitch, speed and volume).
test('every farm call has its sounds on disk, credited, and plays a little different each time', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const { WILD_SOUNDS, WILD_GAPS } = await import('../../../scripts/engines/motion/wildlife.mjs');
  const { FARM_CALLS } = await import('../../../scripts/engines/motion/farm-life.mjs');
  const root = new URL('../../../', import.meta.url), licence = readFileSync(new URL('assets/sounds/wildlife/farm/License.txt', root), 'utf8');
  for (const call of Object.values(FARM_CALLS)) {
    assert.ok(WILD_SOUNDS[call]?.length, call); assert.ok(WILD_GAPS[call], call);
    for (const file of WILD_SOUNDS[call]) { const rel = file.replace(/^modules\/animater\//, ''); assert.ok(existsSync(new URL(rel, root)), rel); assert.match(licence, new RegExp(rel.split('/').pop().replace('.', '\\.'))); }
  }
  const main = readFileSync(new URL('scripts/main.mjs', root), 'utf8');
  for (const call of Object.values(FARM_CALLS)) {
    const m = main.match(new RegExp(`${call}: \\{ volume: ([\\d.]+), reach: (\\d+), rates: \\[([\\d.]+), ([\\d.]+)\\] \\}`));
    assert.ok(m, call); assert.ok(Number(m[4]) - Number(m[3]) >= 0.15, `${call} pitch varies enough`);
  }
  assert.match(main, /sound: wildVoice \}\);\n?\s*\}/, 'the farm layer is given the voice');
  assert.doesNotMatch(main, /FARM_SOUNDS_READY/);
});

// Roi: every animal a little different, not copies of one.
test('no two of a herd alike: each its own size and shade', () => {
  const sprites = [];
  class Thing { constructor(t) { this.texture = t; this.tint = 0xffffff; this.anchor = { set() {} }; this.sc = 1; this.scale = { set: (s) => { this.sc = s; } }; this.position = { set() {} }; sprites.push(this); } destroy() {} }
  const layer = createFarmLife({ PIXI: { Sprite: Thing }, floor: () => ({ addChild() {} }), picture: () => ({}) });
  layer.populate({ spots: [{ x: 300, y: 300 }], sheep: 6, grid: 100 });
  layer.tick(0.05, { ok: () => true, blocked: () => false, near: [] });
  const bodies = sprites.filter((_, i) => i % 2 === 1);
  assert.ok(new Set(bodies.map((s) => s.tint)).size > 2, 'shades'); assert.ok(new Set(bodies.map((s) => s.sc.toFixed(3))).size > 2, 'sizes');
});

test('the layer places them on the spots given and counts them; cleared, none', () => {
  const kids = [];
  class Thing { constructor(t) { this.texture = t; this.anchor = { set() {} }; this.scale = { set() {} }; this.position = { set() {} }; } destroy() { this.destroyed = true; } }
  const PIXI = { Sprite: Thing, Texture: { from: () => ({}) } };
  const layer = createFarmLife({ PIXI, floor: () => ({ addChild: (c) => kids.push(c) }), picture: () => ({}) });
  layer.populate({ spots: [{ x: 100, y: 100 }, { x: 300, y: 300 }], cows: 2, sheep: 3, grid: 100, random: () => 0.3 });
  assert.equal(layer.counts.cows, 2); assert.equal(layer.counts.sheep, 3); assert.equal(layer.busy, true);
  layer.tick(0.05, { ok: () => true, blocked: () => false, near: [] });
  layer.clear(); assert.equal(layer.busy, false);
});

// Paulomat's report: sheep stuck on a region's edges (corners, round ones, straight ones), spinning on the spot.
test('a farm animal at an edge goes along it or stops, never spinning on the spot', () => {
  let seed = 3; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cases = {
    'fleeing into a straight edge': { ok: (x, y) => y > 0, near: [{ x: 0, y: 120 }], start: { x: 0, y: 20 } },
    'walking into a corner': { ok: (x, y) => x > 0 && y > 0, near: [], start: { x: 25, y: 25, a: -Math.PI * 0.75 } },
    'just over the edge': { ok: (x, y) => y > 0, near: [], start: { x: 0, y: -5, a: Math.PI } },
  };
  for (const [name, { ok, near, start }] of Object.entries(cases)) {
    let s = { kind: 'sheep', x: start.x, y: start.y, a: start.a ?? 0, mode: near.length ? 'graze' : 'walk', wait: 3, v: 50 };
    let turned = 0, last = s.a;
    for (let i = 0; i < 20 * 4; i++) { s = farmStep(s, { dt: 1 / 20, grid: 100, ok, blocked: (p, q) => ok(p.x, p.y) && !ok(q.x, q.y), near, random }); let d = Math.abs(s.a - last) % (2 * Math.PI); turned += Math.min(d, 2 * Math.PI - d); last = s.a; }
    assert.ok(turned < Math.PI * 2, name + ': turned ' + (turned / Math.PI).toFixed(1) + ' half-turns in 4 s');
  }
});
