import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wakeStrength, createGiantWakes, waterRipples, WATERS_RUNG, BANK_SHARE, RIPPLE_RINGS, RIPPLE_GAP_MS, RIPPLE_FALL, WAKE_LINGER_MS, SCARE_EVERY } from '../../../scripts/engines/motion/giant-wake.mjs';
import { SETTINGS_TABS } from '../../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const registration = (key) => main.match(new RegExp(`registerSetting\\("${key}", \\{[\\s\\S]*?\\n  \\}\\);`))?.[0] ?? '';

test('only Huge and bigger wings move the air: harder for a Gargantuan, less from higher up, none from far above', () => {
  assert.equal(wakeStrength({ weight: 3.75, height: 0 }), 0, 'a Large one, however heavy, makes none');
  assert.equal(wakeStrength({ weight: 4, height: 0 }), 0.6);
  assert.equal(wakeStrength({ weight: 5, height: 1 }), 1);
  assert.equal(wakeStrength({ weight: 5.75, height: 2 }), 1);
  const mid = wakeStrength({ weight: 5, height: 7 });
  assert.ok(mid > 0.4 && mid < 0.6);
  assert.equal(wakeStrength({ weight: 5, height: 12 }), 0);
  assert.equal(wakeStrength({ weight: 5, height: 40 }), 0);
});

const rig = () => {
  const calls = { add: [], move: [], end: [], scare: [] }, timers = new Map(); let n = 0, t = 0;
  const gusts = { add: (g) => { calls.add.push(g); return calls.add.length; }, move: (id, at) => { calls.move.push({ id, ...at }); return true; }, end: (id) => calls.end.push(id) };
  const wakes = createGiantWakes({ gusts, scare: (s) => calls.scare.push(s), grid: () => 100,
    later: (fn, ms) => { timers.set(++n, { fn, at: t + ms }); return n; }, cancel: (id) => timers.delete(id) });
  const pass = (ms) => { t += ms; for (const [id, timer] of [...timers]) if (timer.at <= t) { timers.delete(id); timer.fn(); } };
  return { calls, wakes, pass, timers };
};
const dragon = { id: 'd', width: 300 };

test('a flier holds one gust that goes with it, and lets it go half a second after it stops', () => {
  const { calls, wakes, pass } = rig();
  wakes.fly(dragon, { x: 0, y: 0, heading: 0 }, { weight: 4, height: 1 });
  assert.equal(calls.add.length, 1);
  assert.deepEqual({ x: calls.add[0].x, y: calls.add[0].y, heading: calls.add[0].heading, strength: calls.add[0].strength }, { x: 0, y: 0, heading: 0, strength: 0.6 });
  assert.ok(calls.add[0].width >= 300 && calls.add[0].length > calls.add[0].width, 'as wide as its wings, longer behind');
  assert.equal(calls.add[0].ms ?? null, null, 'it blows until told to stop');
  pass(100); wakes.fly(dragon, { x: 60, y: 0, heading: 0 }, { weight: 4, height: 1 });
  pass(100); wakes.fly(dragon, { x: 120, y: 10, heading: 0.1 }, { weight: 4, height: 1 });
  assert.equal(calls.add.length, 1, 'the same gust');
  assert.deepEqual(calls.move.at(-1), { id: 1, x: 120, y: 10, heading: 0.1 });
  pass(WAKE_LINGER_MS - 10);
  assert.equal(calls.end.length, 0);
  pass(20);
  assert.deepEqual(calls.end, [1]);
  assert.equal(wakes.count, 0);
  wakes.fly(dragon, { x: 500, y: 0, heading: 0 }, { weight: 4, height: 1 });
  assert.equal(calls.add.length, 2, 'moving again, a new one');
});

test('too small or too high makes no gust; with gusts off it still scares', () => {
  const { calls, wakes } = rig();
  wakes.fly({ id: 'wyvern', width: 200 }, { x: 0, y: 0, heading: 0 }, { weight: 3, height: 1 });
  wakes.fly(dragon, { x: 0, y: 0, heading: 0 }, { weight: 5, height: 20 });
  assert.equal(calls.add.length, 0);
  assert.equal(calls.scare.length, 0, 'and what makes no wind scares nothing');
  wakes.fly(dragon, { x: 0, y: 0, heading: 0 }, { weight: 5, height: 1, gust: false });
  assert.equal(calls.add.length, 0);
  assert.equal(calls.scare.length, 1);
});

test('the animals are scared as it comes, again every few squares it travels, and not at all with that off', () => {
  const { calls, wakes, pass } = rig();
  wakes.fly(dragon, { x: 0, y: 0, heading: 0 }, { weight: 5, height: 1 });
  assert.deepEqual(calls.scare, [{ x: 0, y: 0, radius: 600 }], 'at once, reaching twice its width');
  for (let x = 60; x <= 100 * SCARE_EVERY - 60; x += 60) { pass(50); wakes.fly(dragon, { x, y: 0, heading: 0 }, { weight: 5, height: 1 }); }
  assert.equal(calls.scare.length, 1);
  pass(50); wakes.fly(dragon, { x: 100 * SCARE_EVERY + 20, y: 0, heading: 0 }, { weight: 5, height: 1 });
  assert.equal(calls.scare.length, 2);
  const quiet = rig();
  quiet.wakes.fly(dragon, { x: 0, y: 0, heading: 0 }, { weight: 5, height: 1, scare: false });
  assert.equal(quiet.calls.scare.length, 0);
  assert.equal(quiet.calls.add.length, 1);
});

test('clear lets every gust go and forgets the timers', () => {
  const { calls, wakes, timers } = rig();
  wakes.fly(dragon, { x: 0, y: 0, heading: 0 }, { weight: 5, height: 1 });
  wakes.clear();
  assert.deepEqual(calls.end, [1]);
  assert.equal(timers.size, 0);
  assert.equal(wakes.count, 0);
});

test('Huge creatures scare animals: a world switch under Gusts of wind', () => {
  assert.match(registration('giantsScare'), /name: "Huge creatures scare animals"[\s\S]*scope: "world", config: true, type: Boolean, default: true/);
  const rows = SETTINGS_TABS.flatMap((t) => t.rows);
  assert.ok(rows.some((r) => r.world === 'localGusts' && r.extras?.includes('giantsScare')));
});

test('wired: a winged flier this screen perceives stirs the air on each stride; a giant\'s tread scares on its beat', () => {
  const step = main.slice(main.indexOf('footstep: (floor, at, token, kind = "step")')), body = step.slice(0, step.indexOf('\n  },'));
  assert.match(body, /if \(kind === "wing" && !token\.preview\) giantFlies\(at, token\);/);
  assert.ok(body.indexOf('giantFlies(at, token)') < body.indexOf('const mix = movementSoundMix'), 'before anything silences or paces the sound: the air moves on every stride');
  assert.match(main, /const giantFlies = \(at, token\) => \{[\s\S]{0,700}?giantWakes\.fly\(token, at, \{ weight, height, gust: gustsOn\(\), scare: giantsScareOn\(\) \}\);/);
  assert.match(main, /height = \(\(Number\(token\.elevation\) \|\| 0\) - \(Number\(token\.base\) \|\| 0\)\) \/ \(canvas\.dimensions\?\.distance \|\| 5\)/);
  assert.match(body, /if \(walking && weight >= 4 && !sneak && !token\.preview && giantsScareOn\(\)\) noiseScares\(\{ x: at\.x, y: at\.y, radius: token\.width \}\);/);
  assert.ok(body.indexOf('if (step === null) return;') < body.indexOf('giantsScareOn()) noiseScares('), 'on the beat');
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{ giantWakes\.clear\(\); gusts\.clear\(\); \}\);/);
});

// A giant's weight shakes the water (Roi, 2026-11-25: "it steps on the ground next to water (can also be from afar)
// and the weight is making the ripples"; "a big ripple spreading through the water from its center"). The first build
// rang the bank in eight small rings round the foot: wrong picture.
const pond = { x: 1000, y: 500, radius: 200, test: (x, y) => Math.hypot(x - 1000, y - 500) <= 200 };

test('a heavy step near a pond: one big ripple from the pond\'s middle, big enough to run to its banks', () => {
  const ripples = waterRipples({ at: { x: 600, y: 500 }, grid: 100, weight: 4, bodies: [pond] });
  assert.equal(ripples.length, 1, 'one ripple, not a scatter of small ones');
  assert.deepEqual({ x: ripples[0].x, y: ripples[0].y }, { x: 1000, y: 500 }, 'from its middle, wherever the creature stands');
  // It runs all the way to the bank (Roi, of the first one, which died out half way: "shouldnt the ripples go from
  // the center until the water edge?"), and is gone just short of it, not on it ("the ripple should fade slightly
  // before the water edge"): how far it is sent is nearly the pond's own half-width.
  assert.ok(ripples[0].reach >= 180 && ripples[0].reach < 200, `${ripples[0].reach}`);
  assert.ok(BANK_SHARE > 0.88 && BANK_SHARE < 1);
  assert.ok(ripples[0].strength > 0.5 && ripples[0].strength <= 1, `${ripples[0].strength}`);
  const small = { ...pond, radius: 100, test: (x, y) => Math.hypot(x - 1000, y - 500) <= 100 }, wide = { ...pond, radius: 200, span: 500, test: () => true };
  const little = waterRipples({ at: { x: 700, y: 500 }, grid: 100, weight: 4, bodies: [small] })[0];
  assert.ok(little.reach >= 90 && little.reach < 100, 'a small pond\'s is sent only as far as its own bank');
  assert.ok(little.strength >= ripples[0].strength, 'and rings as hard');
  assert.ok(waterRipples({ at: { x: 400, y: 500 }, grid: 100, weight: 4, bodies: [wide] })[0].reach >= 450, 'an oval one, toward its further bank');
  // One swell a step: a step is one blow. (Three of them, three crests each, was nine crests; Roi: "isnt it too many
  // ripples per step?")
  assert.equal(RIPPLE_RINGS, 1);
  assert.ok(RIPPLE_GAP_MS > 0 && RIPPLE_FALL > 0 && RIPPLE_FALL * (RIPPLE_RINGS - 1) < 1);
  assert.ok(ripples[0].delay >= 0);
  assert.deepEqual(waterRipples({ at: { x: 600, y: 500 }, grid: 100, weight: 3, bodies: [pond] }), [], 'only Huge and bigger');
  assert.deepEqual(waterRipples({ at: { x: 600, y: 500 }, grid: 100, weight: 4, bodies: [] }), [], 'no water, no ripple');
});

test('from afar too: fainter and later the further off, and not at all past its reach; a Gargantuan one reaches further', () => {
  const at = (squares) => ({ x: 1000 - 200 - squares * 100, y: 500 });
  const near = waterRipples({ at: at(1), grid: 100, weight: 4, bodies: [pond] })[0], far = waterRipples({ at: at(7), grid: 100, weight: 4, bodies: [pond] })[0];
  assert.ok(near && far, 'seven squares from the bank still shakes it');
  assert.ok(far.strength < near.strength && far.delay > near.delay);
  assert.equal(far.reach, near.reach, 'fainter, but it still runs to the bank');
  assert.deepEqual(waterRipples({ at: at(9), grid: 100, weight: 4, bodies: [pond] }), [], 'nine squares is past a Huge step');
  const garg = waterRipples({ at: at(9), grid: 100, weight: 5, bodies: [pond] })[0];
  assert.ok(garg, 'not past a Gargantuan one');
  assert.ok(waterRipples({ at: at(1), grid: 100, weight: 5, bodies: [pond] })[0].strength > near.strength, 'and it shakes it harder');
  assert.deepEqual(waterRipples({ at: at(13), grid: 100, weight: 5, bodies: [pond] }), []);
});

test('the reach is reckoned from the creature\'s edge to the water\'s', () => {
  const at = { x: 1000 - 200 - 850, y: 500 };
  assert.deepEqual(waterRipples({ at, grid: 100, weight: 4, bodies: [pond] }), [], 'eight and a half squares from its middle to the bank');
  assert.equal(waterRipples({ at, grid: 100, weight: 4, wide: 300, bodies: [pond] }).length, 1, 'but only seven from the edge of a body three squares across');
});

test('each water near enough rings once, the nearest first, a few at most', () => {
  const ponds = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 600 + i * 200, y: 500, radius: 100, test: () => true }));
  const ripples = waterRipples({ at: { x: 100, y: 500 }, grid: 100, weight: 5, bodies: ponds });
  assert.equal(ripples.length, WATERS_RUNG);
  assert.deepEqual(ripples.map((r) => r.x), ponds.slice(0, WATERS_RUNG).map((p) => p.x));
  assert.ok(ripples[0].delay <= ripples[1].delay);
});

test('water too wide to have a middle (a river, the sea) rings where the blow reaches it, a square in from the near edge', () => {
  // Everything right of x = 1000 is sea; its "middle" is far off to the right.
  const sea = { x: 6000, y: 500, radius: 2500, span: 5000, test: (x) => x >= 1000 };
  const ripples = waterRipples({ at: { x: 700, y: 500 }, grid: 100, weight: 4, bodies: [sea] });
  assert.equal(ripples.length, 1);
  assert.ok(ripples[0].x >= 1000 && ripples[0].x <= 1250, `${ripples[0].x}: just inside the near edge, not thousands of pixels out at its middle`);
  assert.ok(Math.abs(ripples[0].y - 500) < 1);
  assert.ok(ripples[0].reach >= 500, 'a big one, running well out from the bank');
  // A ring-shaped moat's middle is dry land: it rings where it is reached, too.
  const moat = { x: 1000, y: 500, radius: 300, test: (x, y) => { const d = Math.hypot(x - 1000, y - 500); return d <= 300 && d >= 150; } };
  const ring = waterRipples({ at: { x: 400, y: 500 }, grid: 100, weight: 4, bodies: [moat] })[0];
  assert.ok(ring && moat.test(ring.x, ring.y), 'on its water, not on the island in its middle');
  // A river: narrow, but far too long to have a middle. A giant beside it rings it there, not sixty squares off.
  const river = { x: 3000, y: 500, radius: 50, span: 3000, test: (x, y) => y >= 450 && y <= 550 && x >= 0 && x <= 6000 };
  const here = waterRipples({ at: { x: 500, y: 200 }, grid: 100, weight: 4, bodies: [river] })[0];
  assert.ok(here && Math.abs(here.x - 500) <= 150 && river.test(here.x, here.y), `${here?.x}: beside the giant`);
});

test('wired: a giant\'s tread, and a landing, shake the waters near them, with their own switch', () => {
  const step = main.slice(main.indexOf('footstep: (floor, at, token, kind = "step")')), body = step.slice(0, step.indexOf('\n  },'));
  assert.match(body, /if \(walking && weight >= 4 && !sneak && !token\.preview && giantRipplesOn\(\)\) shakeWaters\(at, weight, token\.width\);/);
  assert.ok(body.indexOf('if (step === null) return;') < body.indexOf('shakeWaters(at, weight, token.width)'), 'on the beat');
  assert.match(main, /const shakeWaters = \(at, weight, wide = 0\) => \{[\s\S]{0,400}?waterRipples\(\{ at, grid, weight, wide, bodies: waterBodies\(\) \}\)[\s\S]{0,400}?for \(let i = 0; i < RIPPLE_RINGS; i\+\+\) setTimeout\(\(\) => \{[\s\S]{0,200}?swellWater\(ripple\.x, ripple\.y, ripple\.reach, ripple\.strength \* \(1 - i \* RIPPLE_FALL\)\);[\s\S]{0,120}?ripple\.delay \+ i \* RIPPLE_GAP_MS\);/);
  // Drawn with the rings that fade out where the water ends (wake-ripples.mjs), so a big one never runs up the bank.
  assert.match(main, /const waterBodies = \(\) => \{[\s\S]{0,600}?regionFloor\(\{ name: region\.name, flag: floorFlagOf\(region\) \}\) !== "water"[\s\S]{0,900}?radius: Math\.min\(x1 - x0, y1 - y0\) \/ 2, span: Math\.max\(x1 - x0, y1 - y0\) \/ 2, test: \(x, y\) => region\.testPoint\(\{ x, y, elevation \}\)/);
  assert.match(main, /if \(giantRipplesOn\(\)\) shakeWaters\(spot, weight \+ 1, call\.squares \* grid\);/, 'a landing shakes them too');
  assert.match(registration('giantRipples'), /name: "Giant footfalls ring the water"[\s\S]*scope: "world", config: true, type: Boolean, default: true/);
  assert.ok(SETTINGS_TABS.flatMap((t) => t.rows).some((r) => r.extras?.includes('giantRipples')));
});
