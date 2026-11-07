import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IdleLife, idleKind, SWIM_PERIOD } from '../../../scripts/engines/motion/idle-life.mjs';
import { applyWindowEdge, closesWindow, nextWindowState, windowIconAlpha, windowSenses } from '../../../scripts/engines/motion/window-state.mjs';
import { windowOpening } from '../../../scripts/engines/motion/wall-shadows.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');

test('a map can do without the sun\'s shadows and keep its light', () => {
  for (const gate of [/wallShadowsOn = \(\) => \{ try \{ return !shadowsOffHere\(\)/, /treeShade: canopyOn\(\) && !shadowsOffHere\(\)/, /roofLightOn\(\) && !shadowsOffHere\(\) \? roof/, /sun: \(\) => \(shadowsOffHere\(\) \? null : flashSun \?\? sunNow\)/, /sun = shadowsOffHere\(\) \? null : sunNow/]) assert.match(main, gate);
  assert.match(main, /name="flags\.\$\{ID\}\.noShadows"/);
});

test('a creature in the water bobs, flying first and down not at all', () => {
  const actor = { type: 'character', system: {} };
  assert.equal(idleKind({ actor, swimming: true }), 'idle-swim');
  assert.equal(idleKind({ actor, swimming: true, movementAction: 'fly' }), 'idle-hover');
  assert.equal(idleKind({ actor, swimming: true, statuses: ['unconscious'] }), null);
  assert.equal(idleKind({ actor: { type: 'character', system: { traits: { value: ['undead'] } } }, swimming: true }), 'idle-swim', 'no breath, still floats');
  assert.equal(idleKind({ actor }), 'idle-breathe');
});

test('swimmers follow the hover switch and play slowly', () => {
  const added = [], token = { document: { id: 'a', width: 1 }, actor: { type: 'character', system: {} }, visible: true, x: 0, y: 0, w: 1, h: 1 };
  const life = new IdleLife({ body: { add: (...a) => added.push(a), remove() {} }, tokens: () => [token], swimming: () => true });
  life.sync();
  assert.equal(added[0][2], 'idle-swim');
  assert.equal(added[0][3].period, SWIM_PERIOD);
  const off = new IdleLife({ body: { add() { assert.fail('none'); }, remove() {} }, tokens: () => [token], swimming: () => true, kinds: () => ({ hover: false }) });
  off.sync();
});

test('window icons: faint, only when near, and always under the pointer', () => {
  assert.equal(windowIconAlpha({}), 0.8);
  assert.equal(windowIconAlpha({ style: 'faint' }), 0.3);
  assert.equal(windowIconAlpha({ style: 'faint', near: true }), 0.8);
  assert.equal(windowIconAlpha({ style: 'near' }), 0);
  assert.equal(windowIconAlpha({ style: 'near', gm: true }), 0.3, 'a GM can still find them');
  assert.equal(windowIconAlpha({ style: 'near', near: true }), 0.8);
  assert.equal(windowIconAlpha({ style: 'near', hovered: true }), 1);
});

test('a window icon has an outline under the pointer, as a door does', () => {
  assert.match(main, /control\.windowBorder = control\.addChild\(new PIXI\.Graphics\(\)/);
  assert.match(main, /control\.windowBorder\.visible = control\.windowHover === true/);
});

test('a window can be climbed through when fully open, and only then', () => {
  const edge = () => ({ move: 20 });
  const open = edge(); applyWindowEdge(open, 'woodWindow', true, false, true); assert.equal(open.move, 0); assert.equal(open.sound, 0);
  const shut = edge(); applyWindowEdge(shut, 'woodWindow', false, false, true); assert.equal(shut.move, 20);
  const plain = edge(); applyWindowEdge(plain, 'woodWindow', true); assert.equal(plain.move, 20, 'unasked, as before');
  const slats = edge(); applyWindowEdge(slats, 'shutterWindow', false, true, true); assert.equal(slats.move, 20, 'slats are not open');
});

test('curtains: shut only a dim light, open the full light', () => {
  assert.equal(closesWindow('curtainWindow'), true);
  assert.deepEqual(windowSenses('curtainWindow', false), { light: 20, sight: 20, sound: 20 });
  assert.deepEqual(windowSenses('curtainWindow', true), { light: 0, sight: 0, sound: 0 });
  assert.deepEqual(nextWindowState('curtainWindow', { open: false }), { open: true, slats: false });
  const shut = windowOpening({ kind: 'curtainWindow', open: false }), open = windowOpening({ kind: 'curtainWindow', open: true });
  assert.equal(shut.kind, 'curtained'); assert.equal(shut.alpha, 0.4);
  assert.equal(open.kind, 'open'); assert.equal(open.alpha, 1);
});

test('weather eases: the same kind across, another kind out then in', async () => {
  const { fadedFall, fadedValue } = await import('../../../scripts/engines/motion/sky-light.mjs');
  assert.ok(Math.abs(fadedFall([1, 0.2, 1, 0], [1, 1, 1, 0], 0.5)[1] - 0.6) < 1e-9);
  assert.deepEqual(fadedFall([0, 0, 1, 0], [2, 1, 1, 0], 0.25), [2, 0.25, 1, 0], 'from nothing, it comes in');
  assert.deepEqual(fadedFall([2, 1, 1, 0], [0, 0, 1, 0], 0.75), [2, 0.25, 1, 0], 'to nothing, it goes');
  assert.deepEqual(fadedFall([1, 1, 1, 0], [2, 1, 2, 0], 0.25), [1, 0.5, 1, 0], 'the old thinning');
  assert.deepEqual(fadedFall([1, 1, 1, 0], [2, 1, 2, 0], 0.75), [2, 0.5, 2, 0], 'then the new');
  assert.deepEqual(fadedValue([0, 1], [1, 1], 0.5), [0.5, 1]);
  assert.equal(fadedValue(0, 1, 0.25), 0.25);
});

test('the sky never snaps a change while fading, and a drag or preview shows at once', () => {
  assert.match(main, /fade: weatherPreview \|\| tuneDragged \? 0 : Number\(hotSetting\("weatherFade"\)\)/);
});

test('all scenes come under each scene\'s own', () => {
  assert.equal((main.match(/canvas\?\.scene\?\.weather(?!Tune)/g) ?? []).length, 0, 'every look goes by weatherWordOf');
  assert.match(main, /const weatherWordOf = \(scene\) => levelOf\(scene\)\.weather \|\| scene\?\.weather \|\| globalWeatherNow\(\)\.weather/);
  assert.match(main, /globalWeatherNow\(\)\.off === true && !scene\?\.weather/);
  assert.match(main, /name: "animaterWeatherAll"/);
});

test('fungus under a creature stays steadily dim, and brightens once they have gone', async () => {
  const { fungusTouches } = await import('../../../scripts/engines/motion/cavern.mjs');
  const here = [{ x: 100, y: 100 }];
  let touches = [];
  for (let now = 0; now <= 6000; now += 120) { touches = fungusTouches(touches, here, now, 100); assert.equal(touches.length, 1, 'one mark, not a new one each second and a half'); assert.equal(touches[0].at, now, 'kept fresh: no flash'); }
  touches = fungusTouches(touches, [], 7000, 100); assert.equal(touches.length, 1, 'still fading');
  touches = fungusTouches(touches, [], 10001, 100); assert.equal(touches.length, 0);
  assert.equal(fungusTouches([], [{ x: 0, y: 0 }, { x: 500, y: 0 }], 1, 100).length, 2);
});

test('mist is there when a map or level opens, as it was left', () => {
  assert.match(main, /const arrived = !mistAir;[\s\S]{0,160}if \(arrived\) mistAir\.fill\(\);/);
  assert.doesNotMatch(readFileSync(new URL('../../../scripts/engines/motion/cavern.mjs', import.meta.url), 'utf8'), /time \/ 40/);
});

test('a big cobwebbed room has spiders through it, not just one', async () => {
  const { spiderHomes, MOST_SPIDERS } = await import('../../../scripts/engines/motion/webs.mjs');
  assert.deepEqual(spiderHomes(0), []);
  assert.equal(spiderHomes(1).length, 1);
  assert.equal(spiderHomes(12).length, 4);
  assert.equal(new Set(spiderHomes(12)).size, 4, 'each its own web');
  assert.ok(spiderHomes(12).every((home) => home >= 0 && home < 12));
  assert.equal(spiderHomes(500).length, MOST_SPIDERS);
});

test('drawing clouds lays them over the shadows already falling, adding none', async () => {
  const { bodiesShown, CLOUD_SHADE } = await import('../../../scripts/engines/motion/drawn-clouds.mjs');
  assert.ok(CLOUD_SHADE >= 0.6, 'a cloud\'s shadow plainly darkens the ground');
  assert.match(main, /drawnClouds\.look\(\{ on: cloudLayerOn, drawn: cloudsDrawn,/);
  assert.equal((main.match(/clouds: !cloudLayerOn && \(cloudsOn\(\)/g) ?? []).length, 2, 'the sky and the trees throw no second set');
  assert.equal(bodiesShown(0, true, 2.5), 1); assert.equal(bodiesShown(1, false, 2.5), 0); assert.equal(bodiesShown(0.5, true, 0), 0.5);
});

test('portrait blood grows with the wound and keeps its place', async () => {
  const { bloodCss, portraitBloodLevel, portraitMarks } = await import('../../../scripts/ui/portrait-blood.mjs');
  assert.equal(bloodCss(0x7a0d0d), '#7a0d0d', 'a number');
  assert.equal(bloodCss('#9ab83a'), '#9ab83a');
  assert.equal(bloodCss('9ab83a'), '#9ab83a');
  assert.equal(bloodCss(undefined), '#7a0d0d');
  assert.equal(portraitBloodLevel(null), 0);
  assert.equal(portraitBloodLevel({ value: 100, max: 100 }), 0);
  assert.equal(portraitBloodLevel({ value: 75, max: 100 }), 0);
  assert.equal(portraitBloodLevel({ value: 0, max: 100 }), 1);
  assert.equal(portraitBloodLevel({ value: 5, max: 100, down: true }), 1);
  assert.ok(portraitBloodLevel({ value: 25, max: 100 }) > portraitBloodLevel({ value: 60, max: 100 }));
  const some = portraitMarks('a', 0.3), more = portraitMarks('a', 1);
  assert.ok(more.blots.length > some.blots.length);
  assert.deepEqual(some.blots[0], more.blots[0], 'the first wound stays where it was');
  assert.deepEqual(portraitMarks('a', 0), { blots: [], specks: [] });
});

test('a region says its own climate and weather; Arms Reach decides when it is on', () => {
  assert.match(main, /cold = regionClimateAt\(feet, d\.elevation \?\? 0\) \?\?/);
  assert.match(main, /select\("regionWeather"/);
  assert.match(main, /game\.modules\.get\("arms-reach"\)/);
});
