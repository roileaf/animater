import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pigeonStep, pigeonAlarm, landingSpot, chickenStep, catStep, dogStep, lightsOutAt, townCounts, townGroups, homesFor, createTownLife } from '../../scripts/engines/motion/town-life.mjs';

test('a big map has several groups, a small one a single group, none without room', () => {
  assert.equal(townGroups('busy', 0), 0);
  assert.equal(townGroups('busy', 100), 1);
  assert.equal(townGroups('busy', 5000), 4);
  assert.equal(townGroups('quiet', 5000), 2);
});

test('the first group starts near the view, however big the map', () => {
  const spots = []; for (let x = 0; x < 10000; x += 100) for (let y = 0; y < 10000; y += 100) spots.push({ x, y });
  for (let i = 0; i < 40; i++) { const [first] = homesFor(spots, 3, { x: 7000, y: 2000 }, { grid: 100 }); assert.ok(Math.hypot(first.x - 7000, first.y - 2000) <= 600); }
  const [nearest] = homesFor([{ x: 0, y: 0 }, { x: 5000, y: 5000 }], 1, { x: 4800, y: 4800 }, { grid: 100 });
  assert.deepEqual(nearest, { x: 5000, y: 5000 });
  assert.deepEqual(homesFor([], 2, null), []);
});

const pigeon = (over = {}) => ({ x: 0, y: 0, a: 0, mode: 'ground', wait: 5, peck: 0, walk: 0, gait: 0, h: 0, t: 0, ...over });
const hen = (over = {}) => ({ x: 0, y: 0, a: 0, mode: 'peck', wait: 5, peck: 0, nod: 5, gait: 0, t: 0, ...over });
const WALL = { ax: 0, ay: 0, bx: 1000, by: 0 };
const puss = (over = {}) => ({ seg: WALL, u: 0.5, dir: 1, x: 500, y: 0, a: Math.PI / 2, mode: 'sit', left: 40, wash: 0, washIn: 3, gait: 0, show: 1, t: 0, ...over });
const hound = (over = {}) => ({ x: 0, y: 0, a: 0, mode: 'nose', t: 50, want: 0, next: 50, sniff: false, v: 0, gait: 0, bark: 0, bored: 0, ...over });
const steady = () => 0.5;

// ---- Pigeons ------------------------------------------------------------------------------------------------------------
test('a pigeon goes up from anyone within 2 squares or a noise, and not from someone further off', () => {
  assert.equal(pigeonStep(pigeon(), { near: [{ x: 150, y: 0 }], random: steady }).mode, 'fly');
  assert.equal(pigeonStep(pigeon(), { near: [{ x: 250, y: 0 }], random: steady }).mode, 'ground');
  assert.equal(pigeonStep(pigeon(), { noise: { x: 900, y: 0 }, random: steady }).mode, 'fly');
  assert.ok(pigeonAlarm(pigeon(), { near: [{ x: 199, y: 0 }] })); assert.equal(pigeonAlarm(pigeon(), { near: [{ x: 201, y: 0 }] }), null);
});

test('a flock goes up together: a far bird rises with the one that was scared, the same way', () => {
  const flush = { x: -300, y: 0 }, up = pigeonStep(pigeon({ x: 100 }), { flush, wheel: 1.1, random: steady });
  assert.equal(up.mode, 'fly'); assert.equal(up.turn, 1.1);
  assert.ok(Math.sin(up.a) > 0.9, 'heads away from what scared the flock');
});

test('a pigeon climbs, wheels overhead and comes down elsewhere on the ground it was sent to', () => {
  let p = pigeonStep(pigeon(), { near: [{ x: 100, y: 0 }], landing: { x: 800, y: 300 }, random: steady }), top = 0, turned = new Set();
  for (let i = 0; i < 1800 && p.mode === 'fly'; i++) { p = pigeonStep(p, { random: steady }); top = Math.max(top, p.h); turned.add(Math.round(p.a)); }
  assert.equal(p.mode, 'ground'); assert.equal(p.h, 0);
  assert.equal(top, 1, 'it got high'); assert.ok(turned.size > 3, 'and wheeled');
  assert.ok(Math.hypot(p.x - 800, p.y - 300) < 80, `on its landing place: ${p.x}, ${p.y}`);
});

test('a pigeon with nowhere to land keeps wheeling, and comes down once it is given somewhere', () => {
  let p = pigeonStep(pigeon(), { near: [{ x: 100, y: 0 }], random: steady });
  assert.ok(p.wantLand);
  for (let i = 0; i < 1500; i++) { p = pigeonStep(p, { random: steady }); assert.equal(p.mode, 'fly'); }
  p = pigeonStep(p, { landing: { x: 0, y: 0 }, random: steady }); assert.equal(p.wantLand, false);
  for (let i = 0; i < 1500 && p.mode === 'fly'; i++) p = pigeonStep(p, { random: steady });
  assert.equal(p.mode, 'ground');
});

test('a pigeon will not come down where someone stands, nor on bad ground', () => {
  let p = { ...pigeon(), mode: 'fly', stage: 'glide', glide: 0.99, glideFor: 1.4, gx: 0, gy: 0, lx: 10, ly: 0, h: 0.1, t: 9, len: 5, turn: 1 };
  assert.equal(pigeonStep(p, { dt: 0.05, near: [{ x: 10, y: 50 }], random: steady }).mode, 'fly');
  assert.equal(pigeonStep(p, { dt: 0.05, ok: () => false, random: steady }).wantLand, true);
});

test('low down a wall stops a pigeon, high up it clears it, and it will not fly into a closed place', () => {
  const blocked = (a, b) => a.x < 300 !== b.x < 300, barred = (x) => x > 900;
  const low = { ...pigeon(), x: 299, a: Math.PI / 2, mode: 'fly', stage: 'wheel', t: 0, h: 0, len: 99, turn: 0, wantLand: true };
  assert.ok(pigeonStep(low, { blocked, random: steady }).x <= 300);
  const high = { ...low, t: 5, h: 1 };
  assert.ok(pigeonStep(high, { blocked, random: steady }).x > 299);
  let p = { ...high, x: 880, turn: 0 };
  for (let i = 0; i < 600; i++) { p = pigeonStep(p, { barred, random: steady }); assert.ok(p.x <= 900, `over the closed place at ${p.x}`); }
});

test('in heavy rain a pigeon sits tucked and still, but goes up all the same when someone comes close', () => {
  let p = pigeon({ x: 40, y: 40, wait: 0 }), steps = [0.1, 0.5, 0.7]; let i = 0;
  const random = () => steps[i++ % steps.length];
  for (let n = 0; n < 600; n++) { p = pigeonStep(p, { rain: 0.9, random }); assert.equal(p.tucked, true); assert.equal(p.x, 40); assert.equal(p.y, 40); assert.equal(p.peck, 0); }
  assert.equal(pigeonStep(p, { rain: 0.2, random: steady }).tucked, false, 'light rain does not bother it');
  assert.equal(pigeonStep(p, { rain: 0.9, near: [{ x: 90, y: 40 }], random: steady }).mode, 'fly');
});

test('a pigeon pecks and walks on open ground, its nod going with the ground it covers', () => {
  let p = pigeon({ wait: 0 }), n = 0; const seq = [0.1, 0.5, 0.6], random = () => seq[n++ % seq.length];
  let pecked = false, walked = false, lastGait = 0, lastX = 0, lastY = 0;
  for (let i = 0; i < 3000; i++) {
    p = pigeonStep(p, { random, ok: (x, y) => Math.hypot(x, y) < 300 });
    pecked ||= p.peck > 0;
    const d = Math.hypot(p.x - lastX, p.y - lastY), g = p.gait - lastGait;
    if (d > 0) { walked = true; assert.ok(Math.abs(g - d / 14) < 1e-6, `gait ${g} for ${d}`); } else assert.equal(g, 0, 'no ground, no stride');
    lastX = p.x; lastY = p.y; lastGait = p.gait;
  }
  assert.ok(pecked && walked); assert.ok(Math.hypot(p.x, p.y) < 300, 'and kept to the ground');
});

test('a flock lands on a spot nearby with nobody close', () => {
  const spots = [{ x: 500, y: 0 }, { x: 2000, y: 0 }, { x: 0, y: 500 }], from = { x: 0, y: 0 };
  assert.deepEqual(landingSpot(spots, from, { near: [{ x: 0, y: 450 }], random: () => 0 }), { x: 500, y: 0 });
  assert.deepEqual(landingSpot(spots, from, { ok: (x) => x > 1000, random: () => 0 }), { x: 2000, y: 0 }, 'further off if there is nothing nearer');
  assert.equal(landingSpot(spots, from, { ok: () => false }), null);
});

// ---- Chickens -----------------------------------------------------------------------------------------------------------
test('a chicken panics from anyone near on a zigzag, getting away and staying on the ground', () => {
  let c = hen(), sides = new Set(), n = 0; const random = () => (n++ % 7) / 7;
  const near = [{ x: 0, y: 120 }];
  c = chickenStep(c, { near, random }); assert.equal(c.mode, 'panic');
  let flips = 0, side = c.zig;
  for (let i = 0; i < 70; i++) { c = chickenStep(c, { near, random }); assert.equal(c.mode, 'panic'); assert.equal(c.h, undefined, 'never in the air'); sides.add(c.zig); if (c.zig !== side) { flips++; side = c.zig; } }
  assert.ok(flips >= 2, `zigzags: ${flips}`); assert.equal(sides.size, 2);
  assert.ok(c.y < -150, `ran away: ${c.y}`);
});

test('a chicken comes out of its panic once nobody is near, and a noise sets it off too', () => {
  let c = chickenStep(hen(), { noise: { x: 900, y: 0 }, random: steady }); assert.equal(c.mode, 'panic');
  for (let i = 0; i < 120; i++) c = chickenStep(c, { random: () => 0.05 });
  assert.notEqual(c.mode, 'panic');
});

test('a chicken keeps to its ground and behind walls however it is run at', () => {
  const ok = (x, y) => y > -150, blocked = (a, b) => (a.x - 200) * (b.x - 200) < 0;
  let c = hen(), n = 0; const random = () => (n++ * 0.37) % 1;
  for (let i = 0; i < 4000; i++) { c = chickenStep(c, { near: [{ x: c.x - 100, y: c.y + 100 }], ok, blocked, random }); assert.ok(c.y > -150 && c.x < 200, `at ${c.x}, ${c.y}`); }
});

test('left alone a chicken pecks, scratches, walks and sprints, feet going by the ground covered', () => {
  let c = hen({ wait: 0 }), n = 1, seen = new Set(), lastX = 0, lastY = 0, lastGait = 0; const random = () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
  for (let i = 0; i < 20000; i++) {
    c = chickenStep(c, { random }); seen.add(c.mode);
    const d = Math.hypot(c.x - lastX, c.y - lastY), g = c.gait - lastGait; lastX = c.x; lastY = c.y; lastGait = c.gait;
    if (d === 0) assert.equal(g, 0, 'no ground, no stride');
    else assert.ok(Math.abs(g - d / 20) < 1e-6 || Math.abs(g - d / 30) < 1e-6, `gait ${g} for ${d}`);
  }
  for (const m of ['peck', 'scratch', 'walk', 'sprint']) assert.ok(seen.has(m), m);
});

// ---- The cat ------------------------------------------------------------------------------------------------------------
test('a cat sits and washes for a long time, not moving', () => {
  let o = puss({ left: 60 }), washed = 0, n = 0; const random = () => (n++ * 0.37) % 1;
  for (let i = 0; i < 60 * 40; i++) { o = catStep(o, { random }); assert.equal(o.mode, 'sit'); assert.equal(o.x, 500); if (o.wash > 0) washed += 1 / 60; }
  assert.ok(washed > 8, `washed for ${washed}s`);
});

test('a freshly settled cat sits a long time, and less long at night', () => {
  const sitFor = (night) => { let o = catStep(puss({ mode: 'walk', walkFor: 0.001 }), { random: steady, night }); assert.equal(o.mode, 'sit'); return o.left; };
  assert.ok(sitFor(0) >= 25); assert.ok(sitFor(1) < sitFor(0));
});

test('a cat walks along the wall top and stays on it, turning at the end, stride by the ground covered', () => {
  let o = puss({ mode: 'walk', walkFor: 1e6, u: 0.9, x: 900, dir: 1 }), turned = false, lastX = o.x, lastGait = 0;
  for (let i = 0; i < 2000; i++) {
    const wasDir = o.dir; o = catStep(o, { random: steady }); turned ||= o.dir !== wasDir;
    assert.equal(o.y, 0, 'on the wall'); assert.ok(o.x >= 0 && o.x <= 1000);
    assert.ok(Math.abs(o.gait - lastGait - Math.abs(o.x - lastX) / 42) < 1e-6); lastX = o.x; lastGait = o.gait;
  }
  assert.ok(turned, 'turned at the end');
});

test('a cat turns round before it walks, and goes on to a wall that joins', () => {
  const next = { ax: 1000, ay: 0, bx: 1000, by: 800 };
  let o = puss({ mode: 'walk', walkFor: 1e6, dir: -1 }), x0 = o.x;
  o = catStep(o, { random: steady, walls: [WALL] }); assert.equal(o.x, x0, 'still turning, feet not sliding');
  o = puss({ mode: 'walk', walkFor: 1e6, u: 0.99, x: 990, dir: 1 });
  for (let i = 0; i < 400 && o.seg === WALL; i++) o = catStep(o, { random: steady, walls: [WALL, next] });
  assert.equal(o.seg, next); assert.equal(o.u < 0.1, true); assert.equal(o.dir, 1);
});

test('a cat slinks away from anyone within 1.5 squares, along the wall, away from them', () => {
  let o = catStep(puss(), { near: [{ x: 400, y: 50 }], walls: [WALL], random: steady });
  assert.equal(o.mode, 'slink'); assert.equal(o.dir, 1);
  assert.equal(catStep(puss(), { near: [{ x: 300, y: 50 }], random: steady }).mode, 'sit');
  for (let i = 0; i < 120; i++) o = catStep(o, { near: [{ x: 400, y: 50 }], walls: [WALL], random: steady });
  assert.ok(o.x > 600, `got away: ${o.x}`);
  assert.equal(o.y, 0);
});

test('a cat settles again once clear, and cornered it drops off the wall and comes back later', () => {
  let o = catStep(puss(), { near: [{ x: 400, y: 0 }], random: steady, walls: [WALL] });
  for (let i = 0; i < 400; i++) o = catStep(o, { random: steady, walls: [WALL] });
  assert.equal(o.mode, 'sit', 'settled');
  o = puss({ u: 0.98, x: 980, a: Math.PI / 2 });
  const after = { x: 900, y: 0 };
  for (let i = 0; i < 300 && o.mode !== 'away'; i++) o = catStep(o, { near: [after], walls: [WALL], random: steady });
  assert.equal(o.mode, 'away', 'nowhere left to go');
  for (let i = 0; i < 60; i++) o = catStep(o, { near: [{ x: 500, y: 0 }], walls: [WALL], random: steady });
  assert.equal(o.show, 0, 'faded off');
  for (let i = 0; i < 60 * 80; i++) o = catStep(o, { near: [{ x: 500, y: 0 }], walls: [WALL], random: steady });
  assert.equal(o.mode, 'away', 'not back while someone stands by the only wall');
  for (let i = 0; i < 60 * 80 && o.mode === 'away'; i++) o = catStep(o, { walls: [WALL], random: steady });
  assert.equal(o.mode, 'sit'); assert.equal(o.y, 0);
});

// ---- The dog ------------------------------------------------------------------------------------------------------------
const SPOTS = [{ x: 600, y: 0 }, { x: 0, y: 600 }, { x: -700, y: -200 }];

test('a dog trots between spots and noses the ground there, stride by the ground covered', () => {
  let d = hound({ t: 0.01, a: Math.PI / 2 }), seen = new Set(), visited = 0, lastX = d.x, lastY = d.y, lastGait = 0, was = d.mode; let n = 0; const random = () => (n++ * 0.6180339) % 1;
  for (let i = 0; i < 60 * 90; i++) {
    d = dogStep(d, { spots: SPOTS, random }); seen.add(d.mode); if (d.mode === 'nose' && was === 'trot') visited++; was = d.mode;
    const dist = Math.hypot(d.x - lastX, d.y - lastY), g = d.gait - lastGait; lastX = d.x; lastY = d.y; lastGait = d.gait;
    if (dist === 0) assert.equal(g, 0); else assert.ok(Math.abs(g - dist / 70) < 1e-6 || Math.abs(g - dist / 45) < 1e-6, `gait ${g} for ${dist}`);
  }
  assert.ok(seen.has('trot') && seen.has('nose')); assert.ok(visited >= 3, `visited ${visited} spots`);
});

test('a dog stays put nosing with nowhere to go, and goes round a wall instead of through it', () => {
  let d = hound({ t: 0.01 });
  for (let i = 0; i < 120; i++) d = dogStep(d, { spots: [], random: steady });
  assert.equal(d.mode, 'nose');
  const blocked = (a, b) => (a.x - 100) * (b.x - 100) < 0;
  d = hound({ t: 0.01, a: Math.PI / 2 });
  for (let i = 0; i < 3000; i++) { d = dogStep(d, { spots: SPOTS, blocked, random: steady }); assert.ok(d.x < 100, `through the wall at ${d.x}`); }
});

test('a dog follows a passing creature at about 2 squares, then loses interest for a while', () => {
  let d = hound(), who = { x: 300, y: 0 }, inFollow = 0, gaps = [];
  for (let i = 0; i < 60 * 40; i++) {
    who = { x: who.x + 0.8, y: 0 };
    d = dogStep(d, { near: [who], spots: SPOTS, random: steady });
    if (d.mode === 'follow') { inFollow++; if (inFollow > 240) gaps.push(Math.hypot(who.x - d.x, who.y - d.y)); }
    else if (inFollow) break;
  }
  assert.ok(inFollow > 60 * 5, `followed for ${inFollow / 60}s`); assert.ok(gaps.length, 'long enough to settle');
  for (const g of gaps) assert.ok(g > 170 && g < 280, `gap ${g}`);
  assert.notEqual(d.mode, 'follow'); assert.ok(d.bored > 20, 'it has lost interest');
  who = { x: d.x + 200, y: d.y };
  for (let i = 0; i < 600; i++) { who = { x: who.x + 0.5, y: who.y }; d = dogStep(d, { near: [who], spots: SPOTS, random: steady }); assert.notEqual(d.mode, 'follow'); }
});

test('a dog leaves alone a creature standing still, and never closes in on one that stops', () => {
  let d = hound();
  for (let i = 0; i < 300; i++) { d = dogStep(d, { near: [{ x: 300, y: 0 }], spots: [], random: steady }); assert.notEqual(d.mode, 'follow'); }
  d = hound({ mode: 'follow', t: 0, len: 20, a: Math.PI / 2 });
  for (let i = 0; i < 600; i++) { d = dogStep(d, { near: [{ x: 500, y: 0 }], random: steady }); assert.ok(d.x < 500 - 195, `crowding it: ${d.x}`); }
});

test('a dog barks now and then and stops to look at a noise', () => {
  let d = hound(), barks = 0, n = 0; const random = () => (n++ * 0.6180339) % 1;
  for (let i = 0; i < 60 * 300; i++) { d = dogStep(d, { spots: SPOTS, random }); if (d.barked) barks++; }
  assert.ok(barks >= 2 && barks < 30, `barks: ${barks}`);
  const heard = dogStep(hound(), { noise: { x: 500, y: 0 }, random: steady });
  assert.equal(heard.mode, 'look'); assert.equal(heard.barked, true);
});

// ---- How many -----------------------------------------------------------------------------------------------------------
test('counts: a quiet place has about half of a busy one, flock 4 to 9, hens 2 to 5', () => {
  for (const r of [0, 0.5, 0.999]) {
    const busy = townCounts('busy', 40, 5, () => r), quiet = townCounts('quiet', 40, 5, () => r);
    assert.ok(busy.pigeons >= 7 && busy.pigeons <= 9); assert.ok(quiet.pigeons >= 4 && quiet.pigeons <= 5);
    assert.ok(busy.chickens >= 4 && busy.chickens <= 5); assert.ok(quiet.chickens >= 2 && quiet.chickens <= 3);
    assert.ok(quiet.pigeons + quiet.chickens <= (busy.pigeons + busy.chickens) * 0.65);
    assert.equal(busy.dog, 1); assert.equal(quiet.dog, 0, 'a dog only where it is busy'); assert.equal(busy.cat, 1); assert.equal(quiet.cat, 1);
  }
});

test('counts: too few spots gives fewer, no wall no cat', () => {
  const at = (n) => townCounts('busy', n, 0, () => 0.999);
  assert.deepEqual(at(0), { pigeons: 0, chickens: 0, cat: 0, dog: 0 });
  assert.deepEqual(at(1), { pigeons: 0, chickens: 0, cat: 0, dog: 0 });
  assert.deepEqual(at(2), { pigeons: 4, chickens: 2, cat: 0, dog: 1 });
  assert.deepEqual(at(3), { pigeons: 6, chickens: 3, cat: 0, dog: 1 });
  assert.deepEqual(at(50), { pigeons: 9, chickens: 5, cat: 0, dog: 1 });
  assert.equal(townCounts('busy', 0, 3, () => 0.5).cat, 1);
});

// ---- The windows --------------------------------------------------------------------------------------------------------
test('windows go dark one by one between 21:00 and 01:00 and are lit again round 05:30', () => {
  const seeds = Array.from({ length: 200 }, (_, i) => i), dark = (h) => seeds.filter((s) => lightsOutAt(s, h)).length;
  for (const h of [6, 12, 18, 20.99]) assert.equal(dark(h), 0, `all lit at ${h}`);
  for (const h of [1, 2, 4, 5]) assert.equal(dark(h), 200, `all dark at ${h}`);
  const steps = [21.5, 22, 22.5, 23, 23.5, 24, 0.5].map((h) => dark(h));
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] > steps[i - 1], `going out by degrees: ${steps}`);
  assert.ok(steps[0] > 5 && steps[3] > 80 && steps[3] < 150, `spread evenly: ${steps}`);
  const dawn = dark(5.5); assert.ok(dawn > 50 && dawn < 150, `coming on one by one: ${dawn}`);
  assert.equal(dark(5.8), 0);
});

test('a window keeps its own time, whatever the seed and however the hour is written', () => {
  for (const seed of [7, 'window-12', '12:4', 0]) {
    for (let h = 0; h < 24; h += 0.25) assert.equal(lightsOutAt(seed, h), lightsOutAt(seed, h), 'stable');
    let was = false, changes = 0; for (let h = 12; h < 36; h += 0.05) { const now = lightsOutAt(seed, h); if (now !== was) changes++; was = now; }
    assert.equal(changes, 2, 'out once and lit once in the day'); assert.equal(lightsOutAt(seed, 23), lightsOutAt(seed, 47));
  }
  assert.notEqual(new Set(Array.from({ length: 30 }, (_, i) => [20, 21, 22, 23, 24].findIndex((h) => lightsOutAt(i, h)))).size, 1);
  assert.equal(lightsOutAt(1, NaN), false);
});

// ---- The layer ----------------------------------------------------------------------------------------------------------
const anyCall = new Proxy(function () {}, { get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : anyCall), apply: () => anyCall, set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => anyCall }) };
function fakes() {
  const made = [], canvases = [];
  const list = () => ({ kids: [], addChild(s) { this.kids.push(s); s.parent = this; } });
  const PIXI = {
    Texture: { from: (c) => { canvases.push(c); return { baseTexture: { destroyed: false } }; } },
    Sprite: class { constructor(t) { this.texture = t; this.visible = true; this.anchor = { set() {} }; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; this.moves = (this.moves ?? 0) + 1; } }; this.scale = { set() {} }; made.push(this); } destroy() { this.destroyed = true; } },
  };
  const floor = list(), sky = list(), high = list();
  return { PIXI, made, canvases, floor, sky, high, layer: createTownLife({ PIXI, floor: () => floor, sky: () => sky, high: () => high }) };
}
const STREET = Array.from({ length: 20 }, (_, i) => ({ x: i * 200, y: 300 }));
const TOPS = [{ ax: 0, ay: 0, bx: 900, by: 0 }, { ax: 0, ay: 0, bx: 10, by: 0 }];
const run = (layer, seconds, opts) => { for (let i = 0; i < seconds * 20; i++) layer.tick(0.05, opts); };

test('the layer places what it is given, by how busy, and nothing past that', () => {
  const { layer, made } = fakes();
  assert.equal(layer.busy, false); layer.tick(0.05, {});
  layer.populate({ spots: STREET, wallTops: TOPS, grid: 100, busy: 'busy', random: () => 0.5 });
  assert.equal(layer.busy, true);
  let c = layer.counts; assert.equal(c.level, 'busy'); assert.equal(c.pigeons, 8); assert.equal(c.chickens, 5); assert.equal(c.cat, 1); assert.equal(c.dog, 1);
  assert.ok(made.length <= 2 * (9 + 5 + 1 + 1), `a few dozen at most: ${made.length}`);
  layer.populate({ spots: STREET, wallTops: TOPS, grid: 100, busy: 'quiet', random: () => 0.5 });
  c = layer.counts; assert.equal(c.level, 'quiet'); assert.equal(c.dog, 0); assert.ok(c.pigeons <= 5); assert.ok(c.chickens <= 3); assert.equal(c.cat, 1);
  layer.populate({ spots: [], wallTops: [], grid: 100, busy: 'busy' }); assert.equal(layer.busy, false);
  layer.populate({ spots: [{ x: 0, y: 0 }], wallTops: [{ ax: 0, ay: 0, bx: 20, by: 0 }], grid: 100, busy: 'busy' }); assert.equal(layer.busy, false, 'a stub of wall is no place for a cat');
  layer.populate({ spots: STREET, wallTops: TOPS, busy: 'busy' }); layer.clear();
  assert.equal(layer.busy, false); assert.ok(made.every((s) => s.destroyed), 'cleared away');
});

test('the art is drawn once however long it runs, and only for what is there', () => {
  const { layer, canvases } = fakes();
  layer.populate({ spots: [], wallTops: TOPS, grid: 100, busy: 'quiet' });
  const catOnly = canvases.length; assert.ok(catOnly > 0 && catOnly < 40, `just the cat: ${catOnly}`);
  layer.populate({ spots: STREET, wallTops: TOPS, grid: 100, busy: 'busy' });
  const drawn = canvases.length;
  run(layer, 20, { near: [{ x: 0, y: 300 }], day: 1 });
  assert.equal(canvases.length, drawn);
});

test('pigeons and chickens keep the daylight; the cat and the dog stay out at night', () => {
  const { layer, made } = fakes();
  layer.populate({ spots: STREET, wallTops: TOPS, grid: 100, busy: 'busy', random: () => 0.5 });
  run(layer, 3, { day: 1, night: 0 });
  const shown = made.filter((s) => s.visible).length; assert.equal(shown, 2 * 15, `everything out by day: ${shown}`);
  run(layer, 3, { day: 0, night: 1 });
  const body = made.filter((s) => s.visible).length; assert.equal(body, 4, `the cat and the dog and their shadows: ${body}`);
  assert.ok(['sit', 'walk', 'slink', 'away'].includes(layer.counts.catMode));
});

test('a flock flushes together with one wings sound, and lands back elsewhere nearby', () => {
  const { layer, floor, high } = fakes(), sounds = [];
  layer.populate({ spots: STREET.slice(0, 5), wallTops: [], grid: 100, busy: 'quiet', random: () => 0.5 });
  const sound = (kind, at, urgent) => sounds.push({ kind, at, urgent });
  run(layer, 2, { day: 1, sound });
  sounds.length = 0;
  const birds = () => layer.counts.pigeonModes;
  layer.tick(0.05, { day: 1, sound, near: [{ x: 400, y: 300 }] });
  assert.ok(birds().every((m) => m === 'fly'), `all up in the one step: ${birds()}`);
  assert.equal(sounds.filter((s) => s.kind === 'wingsUp').length, 1); assert.equal(sounds.find((s) => s.kind === 'wingsUp').urgent, true);
  run(layer, 2, { day: 1, sound });
  assert.ok(high.kids.length > 0, 'over the roofs');
  run(layer, 20, { day: 1, sound });
  assert.ok(birds().every((m) => m === 'ground'), `all down: ${birds()}`);
  assert.ok(floor.kids.length > 0);
});

test('a noise puts the flock up and sends the chickens running', () => {
  const { layer } = fakes();
  layer.populate({ spots: STREET, wallTops: [], grid: 100, busy: 'quiet', random: () => 0.5 });
  run(layer, 2, { day: 1 });
  layer.noise({ x: 1000, y: 300, radius: 3000 });
  run(layer, 1, { day: 1 });
  assert.ok(layer.counts.pigeonModes.every((m) => m === 'fly')); assert.ok(layer.counts.chickenModes.every((m) => m === 'panic'));
});

test('in heavy rain the flock sits tucked', () => {
  const { layer } = fakes();
  layer.populate({ spots: STREET, wallTops: [], grid: 100, busy: 'quiet', random: () => 0.5 });
  run(layer, 1, { day: 1, rain: 1 });
  assert.ok(layer.counts.pigeonModes.every((m) => m === 'tucked'));
});

test('only the two sounds there are files for are ever asked for', () => {
  const { layer } = fakes(), kinds = new Set(); let n = 0;
  layer.populate({ spots: STREET, wallTops: TOPS, grid: 100, busy: 'busy', random: () => (n++ * 0.6180339) % 1 });
  const sound = (kind) => kinds.add(kind);
  for (let i = 0; i < 40; i++) run(layer, 10, { day: 1, sound, near: i % 2 ? [{ x: i * 100, y: 300 }, { x: 450, y: 20 }] : [] });
  assert.ok(kinds.has('wingsUp'));
  const known = new Set(['wingsUp', 'pigeonCoo', 'henCluck', 'catMeow', 'dogBark']);
  assert.deepEqual([...kinds].filter((k) => !known.has(k)), []);
});

test('nothing is drawn off view or where seen says no', () => {
  const { layer, made } = fakes();
  layer.populate({ spots: STREET, wallTops: TOPS, grid: 100, busy: 'busy', random: () => 0.5 });
  run(layer, 3, { day: 1 });
  for (const s of made) s.moves = 0;
  run(layer, 3, { day: 1, view: { x: 90000, y: 90000, w: 500, h: 500 } });
  assert.ok(made.every((s) => !s.visible), 'all hidden');
  const last = made.map((s) => s.moves); run(layer, 1, { day: 1, view: { x: 90000, y: 90000, w: 500, h: 500 } });
  assert.deepEqual(made.map((s) => s.moves), last, 'and not moved while off view');
  run(layer, 1, { day: 1 }); assert.ok(made.some((s) => s.visible), 'back in view');
  run(layer, 1, { day: 1, seen: () => false }); assert.ok(made.every((s) => !s.visible), 'unseen');
  run(layer, 1, { day: 1, seen: () => { throw new Error('nope'); } }); assert.ok(made.some((s) => s.visible), 'a bad look shows it rather than breaking');
});

test('its creatures keep to the kinds of ground the scene says, by kind', () => {
  const { layer } = fakes(), kinds = new Set();
  layer.populate({ spots: STREET, wallTops: TOPS, grid: 100, busy: 'busy', random: () => 0.5 });
  run(layer, 3, { day: 1, ok: (kind) => { kinds.add(kind); return true; }, barred: (kind) => { kinds.add(kind); return false; } });
  assert.ok(kinds.has('pigeons') && kinds.has('chickens') && kinds.has('dog'), [...kinds].join());
});
