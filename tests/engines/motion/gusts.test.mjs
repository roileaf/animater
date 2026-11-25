import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGusts, gustShare, windAt, GUST_EASE_MS } from '../../../scripts/engines/motion/gusts.mjs';
import { createTreeSway, swayOf } from '../../../scripts/engines/motion/canopy-light.mjs';
import { SETTINGS_TABS } from '../../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const decorations = readFileSync(new URL('../../../scripts/engines/motion/decorations.mjs', import.meta.url), 'utf8');

const clock = () => { let t = 0; return { now: () => t, pass: (ms) => { t += ms; } }; };

test('a gust is strongest just behind its head, dying away to the sides, behind it, and sharply ahead', () => {
  const g = { x: 1000, y: 500, heading: 0, width: 300, length: 600 };
  const behind = gustShare(g, 900, 500), far = gustShare(g, 200, 500), side = gustShare(g, 900, 900), ahead = gustShare(g, 1300, 500);
  assert.ok(behind > 0.8, `${behind}`);
  assert.ok(far < behind * 0.5 && far > 0);
  assert.ok(side < behind * 0.3);
  assert.ok(ahead < 0.05, 'the air ahead of it is not yet moved');
  // Turned, it blows the way it heads.
  const down = { ...g, heading: Math.PI / 2 };
  assert.ok(gustShare(down, 1000, 400) > 0.8 && gustShare(down, 900, 500) < 0.5);
});

test('gusts rise and fall over a third of a second, follow what moves them, and are forgotten when done', () => {
  const c = clock(), gusts = createGusts({ now: c.now });
  assert.equal(gusts.busy, false);
  assert.deepEqual(gusts.at(0, 0), { x: 0, y: 0 });
  const id = gusts.add({ x: 1000, y: 500, heading: 0, strength: 1, width: 300, length: 600 });
  assert.equal(gusts.busy, true);
  assert.equal(gusts.at(900, 500).x, 0, 'nothing snaps: it starts from still');
  c.pass(GUST_EASE_MS / 2);
  const half = gusts.at(900, 500).x;
  c.pass(GUST_EASE_MS);
  const full = gusts.at(900, 500);
  assert.ok(half > 0 && half < full.x && full.x > 0.8 && Math.abs(full.y) < 1e-9);
  gusts.move(id, { x: 3000, y: 500 });
  assert.ok(gusts.at(900, 500).x < 0.02, 'it went with the creature');
  assert.ok(gusts.at(2900, 500).x > 0.8);
  gusts.end(id);
  c.pass(GUST_EASE_MS / 2);
  assert.ok(gusts.at(2900, 500).x < full.x && gusts.busy);
  c.pass(GUST_EASE_MS);
  assert.equal(gusts.busy, false);
  assert.deepEqual(gusts.at(2900, 500), { x: 0, y: 0 });
});

test('a gust given a time ends by itself; strength scales it; two add up; clear drops them all', () => {
  const c = clock(), gusts = createGusts({ now: c.now });
  gusts.add({ x: 0, y: 0, heading: 0, strength: 0.5, ms: 1000 });
  gusts.add({ x: 0, y: 0, heading: Math.PI / 2, strength: 0.5, ms: 5000 });
  c.pass(600);
  const both = gusts.at(-80, -80);
  assert.ok(both.x > 0.1 && both.y > 0.1 && both.x < 0.51);
  c.pass(1000);
  assert.ok(Math.abs(gusts.at(-80, -80).x) < 1e-9 && gusts.at(-80, -80).y > 0.1, 'the first is spent');
  assert.equal(gusts.count, 1);
  gusts.clear();
  assert.equal(gusts.busy, false);
});

test('the wind at a place: the scene\'s and the gust there, added as they blow, never over a gale', () => {
  assert.deepEqual(windAt({ wind: 0.3, angle: 1 }, { x: 0, y: 0 }), { wind: 0.3, angle: 1, gust: 0 });
  const across = windAt({ wind: 0.3, angle: 0 }, { x: 0, y: 0.4 });
  assert.ok(Math.abs(across.wind - 0.5) < 1e-9 && across.angle > 0.9 && across.angle < 0.95);
  assert.ok(Math.abs(across.gust - 0.4) < 1e-9);
  assert.equal(windAt({ wind: 0.8, angle: 0 }, { x: 0.9, y: 0 }).wind, 1);
  const still = windAt({ wind: 0, angle: 2 }, { x: -0.6, y: 0 });
  assert.ok(Math.abs(still.wind - 0.6) < 1e-9 && Math.abs(still.angle - Math.PI) < 1e-9);
});

test('trees: each bends by the wind where it stands while a gust blows, and all alike when none does', () => {
  class Filter { constructor(v, f, u) { this.uniforms = u; } destroy() {} }
  const near = { filters: null, x: 100, y: 0 }, far = { filters: null, x: 5000, y: 0 };
  const sway = createTreeSway({ PIXI: { Filter }, grid: () => 100 });
  sway.attach([near, far]);
  const view = { x: 0, y: 0, scale: 1 };
  sway.set({ wind: 0.2, angle: 0, view });
  assert.equal(near.filters[0].uniforms.uAmp, swayOf(0.2, 100));
  assert.equal(near.filters[0].uniforms.uLean, 0);
  sway.set({ wind: 0.2, angle: 0, view, gustAt: (mesh) => (mesh === near ? { wind: 0.9, angle: Math.PI / 2, gust: 0.7 } : { wind: 0.2, angle: 0, gust: 0 }) });
  assert.equal(near.filters[0].uniforms.uAmp, swayOf(0.9, 100));
  assert.ok(near.filters[0].uniforms.uLean > 0.5, 'it leans over, not only shakes');
  assert.ok(Math.abs(near.filters[0].uniforms.uDir[1] - 1) < 1e-9);
  assert.equal(far.filters[0].uniforms.uAmp, swayOf(0.2, 100));
  assert.equal(far.filters[0].uniforms.uLean, 0);
  sway.set({ wind: 0.2, angle: 0, view });
  assert.equal(near.filters[0].uniforms.uLean, 0, 'and stands again when it has passed');
});

test('Gusts of wind: a world switch and an on-my-screen one, beside the trees in the wind', () => {
  assert.match(main, /skyPair\("localGusts", "localGustsLocal", "Gusts of wind", /);
  const rows = SETTINGS_TABS.flatMap((t) => t.rows);
  assert.ok(rows.some((r) => r.world === 'localGusts' && r.local === 'localGustsLocal'));
});

test('wired: trees, flames and cloth ask the wind where they stand, only while a gust blows', () => {
  assert.match(main, /const gustsOn = \(\) => bothSettingsOn\("localGusts"\);/);
  assert.match(main, /treeSway\.set\(\{ wind: skyWindNow, angle: skyWindAngle, view: [^\n]*gustAt: gusts\.busy \? \(mesh\) => windHere\(mesh\.x, mesh\.y\) : null \}\);/);
  // (How a sheltered flame is treated is wind-spell.test.mjs's: only a gust that came inside reaches it.)
  assert.match(main, /const air = !gusts\.busy \? \{ wind: skyWindNow, angle: skyWindAngle \} : shelter \? [^\n]* : windHere\(x, y\);\s*return flameWind\(\{ wind: air\.wind, angle: air\.angle, /);
  assert.match(main, /decorations\.wind\(\{ strength: undergroundScene\(\) \? 0 : skyWindNow, angle: skyWindAngle, at: gusts\.busy \? decorWindAt : null \}\);/);
  assert.match(decorations, /const a = airAt \? airAt\(s\.decor\) \?\? air : air, m = clothMotion\(s\.decor, a, clock, s\.rotation\)/);
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{ giantWakes\.clear\(\); gusts\.clear\(\); \}\);/);
  assert.match(main, /gustHere: \(x, y, heading = 0, strength = 1\) => /);
});

test('a gust does not reach cloth under a ceiling, looked at once a thing', () => {
  assert.match(main, /const decorWindAt = \(d\) => \{[\s\S]{0,400}?decorRoofed\.set\(d, underCeiling\(\{ x: d\.x, y: d\.y \}\)\)[\s\S]{0,300}?windHere\(d\.x, d\.y\)/);
});
