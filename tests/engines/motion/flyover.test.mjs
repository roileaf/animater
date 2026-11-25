import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flyoverCall, flyoverReach, flyoverPlace, flyoverLandsAt, flyoverLook, flyoverBeat, flyoverWeight, flyoverGust, shapeFor, shapePolygons, tokenRotation, tokenCorner, spreadColumn, FLYOVER_SHAPES, ALOFT } from '../../../scripts/engines/motion/flyover.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const near = (a, b, by = 1e-6) => Math.abs(a - b) < by;

test('a call is cleaned before it is flown: bad places refused, unknown choices put right, sizes kept sane', () => {
  assert.equal(flyoverCall(null), null);
  assert.equal(flyoverCall({ x: 'a', y: 2 }), null);
  const plain = flyoverCall({ x: 100, y: 200 });
  assert.deepEqual({ shape: plain.shape, height: plain.height, pass: plain.pass, faces: plain.faces, spread: plain.spread, wings: plain.wings, squares: plain.squares, art: plain.art, actor: plain.actor, voice: plain.voice },
    { shape: 'dragon', height: 'low', pass: 'straight', faces: 'down', spread: true, wings: true, squares: 3, art: null, actor: null, voice: null });
  const odd = flyoverCall({ x: 1, y: 2, angle: 9, shape: 'kraken', height: 'orbit', pass: 'loop', faces: 'sideways', squares: 900, artScale: -3, art: 5, actor: 7, voice: 'x'.repeat(999) });
  assert.deepEqual({ shape: odd.shape, height: odd.height, pass: odd.pass, faces: odd.faces, squares: odd.squares, artScale: odd.artScale, art: odd.art, actor: odd.actor, voice: odd.voice },
    { shape: 'dragon', height: 'low', pass: 'straight', faces: 'down', squares: 12, artScale: 1, art: null, actor: null, voice: null });
  const full = flyoverCall({ x: 1, y: 2, angle: 1, shape: 'bat', height: 'high', pass: 'land', faces: 'left', squares: 4, artScale: 1.5, art: 'tokens/dragon.webm', actor: 'Actor.abc', voice: 'group:dragon', spread: false, wings: false });
  assert.deepEqual({ shape: full.shape, height: full.height, pass: full.pass, faces: full.faces, squares: full.squares, artScale: full.artScale, art: full.art, actor: full.actor, voice: full.voice, spread: full.spread, wings: full.wings },
    { shape: 'bat', height: 'high', pass: 'land', faces: 'left', squares: 4, artScale: 1.5, art: 'tokens/dragon.webm', actor: 'Actor.abc', voice: 'group:dragon', spread: false, wings: false });
  assert.deepEqual(FLYOVER_SHAPES, ['dragon', 'bird', 'bat', 'insect', 'wingless']);
});

const across = flyoverCall({ x: 1000, y: 500, angle: 0 }), reach = flyoverReach({ width: 2000, height: 1000 }, 100);

test('straight across: it comes in from off the map, passes over the spot and goes out the far side', () => {
  assert.ok(reach > 1000, 'from beyond the map\'s edge');
  const start = flyoverPlace(across, 0, { grid: 100, reach });
  assert.ok(near(start.x, 1000 - reach) && near(start.y, 500) && start.heading === 0 && start.down === 0 && !start.done);
  let over = null, t = 0; for (; t < 60 && !over; t += 0.05) { const p = flyoverPlace(across, t, { grid: 100, reach }); if (p.x >= 1000) over = p; }
  assert.ok(over && near(over.y, 500), 'over the spot');
  const end = flyoverPlace(across, t * 2 + 1, { grid: 100, reach });
  assert.ok(end.done && end.x > 1000 + reach * 0.9);
  const slow = flyoverPlace(across, 1, { grid: 100, reach }).x, fast = flyoverPlace({ ...across, height: 'high' }, 1, { grid: 100, reach }).x;
  assert.ok(fast > slow, 'faster from higher up');
});

test('circles: in along its line, once round the spot, and on the way it was going', () => {
  const call = { ...across, pass: 'circle' }; let turned = 0, last = 0, doneAt = null, out = null;
  for (let t = 0; t < 120 && doneAt === null; t += 0.02) { const p = flyoverPlace(call, t, { grid: 100, reach }); turned = Math.max(turned, p.heading); if (p.heading < last - 1) out = p; last = p.heading; if (p.done) doneAt = t; }
  assert.ok(turned > Math.PI * 1.9 && turned <= Math.PI * 2 + 1e-6, 'a whole turn');
  assert.ok(doneAt !== null);
  assert.ok(out && near(out.heading, 0), 'and out the way it came in');
});

test('comes down: it slows to the spot, comes down over the last of the way, and stays there landed', () => {
  const call = { ...across, pass: 'land' }; let landedAt = null, speedEarly = 0, speedLate = 0, half = null;
  for (let t = 0; t < 60 && landedAt === null; t += 0.02) { const p = flyoverPlace(call, t, { grid: 100, reach }), q = flyoverPlace(call, t + 0.02, { grid: 100, reach });
    if (t < 0.1) speedEarly = q.x - p.x; if (p.down > 0.5 && half === null) { half = p; speedLate = q.x - p.x; } if (p.landed) landedAt = t; }
  assert.ok(landedAt !== null);
  assert.ok(speedLate < speedEarly * 0.6, 'slowing');
  assert.ok(half.x < 1000 && half.x > 1000 - reach * 0.3, 'coming down only near the spot');
  const down = flyoverPlace(call, landedAt, { grid: 100, reach });
  assert.ok(near(down.x, 1000) && near(down.y, 500) && down.down === 1 && !down.done);
  assert.ok(flyoverPlace(call, landedAt + 0.5, { grid: 100, reach }).landed && near(flyoverPlace(call, landedAt + 0.5, { grid: 100, reach }).x, 1000), 'it does not fly on');
  assert.ok(flyoverPlace(call, landedAt + 5, { grid: 100, reach }).done);
});

// A hidden tab draws a frame every second or two. The landing lasts 1.6 s, so on a live map (2026-11-25) a frame fell
// before it and the next after it was over: the flyover ended without ever having landed, and its token stayed put.
test('a landing is never skipped, however far apart the frames come', () => {
  const call = { ...across, pass: 'land' }, at = flyoverLandsAt(call, { grid: 100, reach });
  assert.ok(at > 1);
  assert.equal(flyoverPlace(call, at - 0.05, { grid: 100, reach }).landed, false);
  assert.equal(flyoverPlace(call, at + 0.001, { grid: 100, reach }).landed, true);
  assert.equal(flyoverLandsAt(across, { grid: 100, reach }), null, 'one that flies on never lands');
  const late = flyoverPlace(call, at + 30, { grid: 100, reach });
  assert.ok(late.done && late.landed, 'a frame that comes after it is all over still says it landed');
  assert.match(main, /if \(\(at\.landed \|\| \(at\.done && call\.pass === "land"\)\) && run\.landed === null\) \{/);
  const tick = main.slice(main.indexOf('const tickFlyovers'), main.indexOf('const flyoverHere'));
  assert.ok(tick.indexOf('run.landed === null) {') < tick.indexOf('if (at.done) {'), 'it lands before it is let go');
  // And the token does not wait on a frame at all: a timer set for the moment of touchdown puts it down, once.
  assert.match(main, /run\.placing = setTimeout\(\(\) => placeFlyoverOnce\(run\), flyoverLandsAt\(call, \{ grid, reach: run\.reach \}\) \* 1000 \+ 250\);/);
  assert.match(main, /const placeFlyoverOnce = \(run\) => \{ if \(run\.placed\) return; run\.placed = true; clearTimeout\(run\.placing\); void placeFlyoverToken\(run\.call\); \};/);
  assert.match(main, /for \(const run of flyovers\.values\(\)\) \{ clearTimeout\(run\.placing\);/, 'a scene left mid-flight puts nothing down');
});

test('its shadow: big aloft, more from higher, down to the token\'s own size, under it and folded, as it lands', () => {
  const low = flyoverLook(across, { down: 0 }), high = flyoverLook({ ...across, height: 'high' }, { down: 0 });
  assert.equal(low.scale, ALOFT.low); assert.equal(high.scale, ALOFT.high);
  assert.ok(ALOFT.low >= 2 && ALOFT.high > ALOFT.low);
  assert.ok(high.blur > low.blur && high.alpha < low.alpha && high.offset > low.offset, 'softer, paler and further aside from higher');
  assert.equal(low.fold, 0);
  const mid = flyoverLook(across, { down: 0.5 }), ground = flyoverLook(across, { down: 1 });
  assert.ok(mid.scale < low.scale && mid.scale > 1);
  assert.equal(ground.scale, 1, 'exactly the token\'s size');
  assert.equal(ground.offset, 0, 'right under it');
  assert.equal(ground.fold, 1, 'wings in');
  assert.ok(ground.blur < low.blur && ground.alpha >= low.alpha);
  assert.equal(flyoverLook({ ...across, height: 'high' }, { down: 1 }).scale, 1);
});

test('its wings beat slower the bigger it is; each down-stroke is counted once', () => {
  const huge = flyoverBeat({ ...across, squares: 3 }, 10).count, garg = flyoverBeat({ ...across, squares: 4 }, 10).count, small = flyoverBeat({ ...across, squares: 1 }, 10).count;
  assert.ok(small > huge && huge > garg && garg >= 3);
  const b = flyoverBeat(across, 0.37); assert.ok(b.beat >= -1 && b.beat <= 1);
  assert.equal(flyoverBeat(across, 0).count, 0);
});

test('how heavy it is, and the air it moves, go by its size and height', () => {
  assert.deepEqual([1, 2, 3, 4, 6].map((squares) => flyoverWeight({ squares })), [2, 3, 4, 5, 5]);
  const g = flyoverGust({ ...across, squares: 3 }, { push: 1 }, 100), garg = flyoverGust({ ...across, squares: 4 }, { push: 1 }, 100), high = flyoverGust({ ...across, squares: 3, height: 'high' }, { push: 1 }, 100);
  assert.equal(g.strength, 0.6); assert.equal(garg.strength, 1); assert.ok(high.strength < g.strength && high.strength > 0);
  assert.ok(g.width >= 300 && g.length > g.width);
  assert.equal(flyoverGust({ ...across, squares: 1 }, { push: 1 }, 100).strength, 0.3, 'a Medium thing still stirs a little: the GM sent it');
  assert.ok(flyoverGust({ ...across, squares: 3 }, { push: 1.6 }, 100).strength <= 1);
});

test('the shape that suits a creature with no outline of its own', () => {
  assert.equal(shapeFor({ name: 'Adult Red Dragon', traits: ['dragon'] }), 'dragon');
  assert.equal(shapeFor({ name: 'Roc', traits: ['animal'] }), 'bird');
  assert.equal(shapeFor({ name: 'Giant Eagle' }), 'bird');
  assert.equal(shapeFor({ name: 'Balor', traits: ['fiend', 'demon'] }), 'bat');
  assert.equal(shapeFor({ name: 'Gargoyle' }), 'bat');
  assert.equal(shapeFor({ name: 'Giant Wasp' }), 'insect');
  assert.equal(shapeFor({ name: 'Purple Worm', flight: 'flight' }), 'wingless');
  assert.equal(shapeFor({ name: 'Something', flight: 'wing' }), 'dragon');
  assert.equal(shapeFor({}), 'dragon');
});

test('every shape draws as closed outlines about its middle, wider with its wings out', () => {
  for (const shape of FLYOVER_SHAPES) {
    const out = shapePolygons(shape, 1, 0), inn = shapePolygons(shape, 0.72, 0);
    assert.ok(out.length >= 1, shape);
    for (const poly of out) { assert.ok(poly.length >= 6 && poly.length % 2 === 0, `${shape}: flat x,y pairs`); assert.ok(poly.every(Number.isFinite)); }
    const wide = (polys) => Math.max(...polys.flatMap((p) => p.filter((_, i) => i % 2 === 1).map(Math.abs)));
    const long = Math.max(...out.flatMap((p) => p.filter((_, i) => i % 2 === 0).map(Math.abs)));
    assert.ok(long > 0.5 && long < 2, `${shape}: about a body long`);
    if (shape !== 'wingless') assert.ok(wide(out) > wide(inn) * 1.15, `${shape}: wings out are wider`);
  }
  assert.notDeepEqual(shapePolygons('wingless', 1, 0), shapePolygons('wingless', 1, 0.5), 'a wingless thing winds as it goes');
});

test('the art\'s sides are pulled out as wings, its middle left alone, and not at all once folded', () => {
  assert.equal(spreadColumn(0, { beat: 1, fold: 0 }).at, 0);
  assert.equal(spreadColumn(0.15, { beat: 1, fold: 0 }).at, 0.15, 'the body is not stretched');
  const tip = spreadColumn(1, { beat: 1, fold: 0 }), tipIn = spreadColumn(1, { beat: -1, fold: 0 });
  assert.ok(tip.at > 1.3 && tipIn.at > 1.15 && tip.at > tipIn.at);
  assert.equal(spreadColumn(-1, { beat: 1, fold: 0 }).at, -tip.at, 'both sides alike');
  assert.ok(tip.sweep !== 0 && Math.sign(tip.sweep) !== Math.sign(tipIn.sweep), 'tips back, then forward');
  assert.deepEqual(spreadColumn(1, { beat: 1, fold: 1 }), { at: 1, sweep: 0 });
});

test('the token is put centred on the spot, snapped to the grid, facing the way it flew', () => {
  assert.deepEqual(tokenCorner({ x: 1049, y: 530 }, { width: 3, height: 3 }, 100), { x: 900, y: 400 });
  assert.deepEqual(tokenCorner({ x: 1010, y: 510 }, { width: 2, height: 2 }, 100), { x: 900, y: 400 });
  assert.equal(tokenRotation({ angle: Math.PI / 2, faces: 'down' }), 0, 'art drawn facing down, flying down: as drawn');
  assert.equal(tokenRotation({ angle: 0, faces: 'down' }), 270);
  assert.equal(tokenRotation({ angle: 0, faces: 'right' }), 0);
  assert.equal(tokenRotation({ angle: Math.PI, faces: 'up' }), 270);
});

test('wired: only a GM sends one, every screen on the scene plays it, and only the sender puts the token down', () => {
  assert.match(main, /flyover: \(asked = \{\}\) => \{ if \(!game\.user\?\.isGM\) return null; return flyoverHere\(asked\); \},/);
  assert.match(main, /if \(data\?\.type === FLYOVER_MESSAGE\) \{ if \(data\.sender !== clientId\) flyoverHeard\(data, senderId\); return; \}/);
  assert.match(main, /const flyoverHeard = \(data, senderId\) => \{[\s\S]{0,300}?data\.sceneId !== canvas\.scene\?\.id\) return;\s*if \(!game\.users\.get\(senderId\)\?\.isGM\) return;\s*const call = flyoverCall\(data\.call\);\s*if \(call\) flyoverShow\(call, \{ place: false \}\);/);
  assert.match(main, /if \(asked\?\.here !== true\) \{ try \{ game\.socket\.emit\(`module\.\$\{ID\}`, \{ type: FLYOVER_MESSAGE, sender: clientId, sceneId: canvas\.scene\?\.id \?\? null, call \}\); \}/);
  assert.match(main, /return flyoverShow\(call, \{ place: asked\?\.place !== false \}\);/);
  assert.match(main, /if \(run\.place && call\.pass === "land" && call\.actor\) placeFlyoverOnce\(run\);/);
  assert.match(main, /if \(flyovers\.size\) tickFlyovers\(seconds\);/);
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{ clearFlyovers\(\); \}\);/);
});

test('wired: its shadow stays off the floors of rooms, and is not drawn at all underground', () => {
  assert.match(main, /const flyoverOutOfRooms = \(\) => \{[\s\S]{0,500}?const rooms = indoorPolygons\(\)\.filter\(\(p\) => p\.length >= 6\);\s*if \(!rooms\.length\) return;[\s\S]{0,900}?hole\.blendMode = PIXI\.BLEND_MODES\.ERASE;[\s\S]{0,500}?bakeInto\(stage, picture\);[\s\S]{0,400}?root\.addChild\(edge\); clip\.mask = edge;/);
  // The mask is a picture beside the holder it masks: a shape with holes, set on the root itself, hid the whole shadow live.
  assert.match(main, /const flyoverLayer = createFlyoverLayer\(\{ PIXI: globalThis\.PIXI, root: flyoverClipOf \}\);/);
  assert.ok(!/root\.mask = /.test(main.slice(main.indexOf('const flyoverOutOfRooms'), main.indexOf('const clearFlyovers'))));
  assert.match(main, /if \(flyovers\.size === 1\) flyoverOutOfRooms\(\);/);
  assert.match(main, /run\.shown = !undergroundScene\(\) && flyoverLayer\.show\(id, \{ texture \}\);/);
});

test('wired: a token of that actor already on the scene is brought there; else one is made from its prototype', () => {
  assert.match(main, /const placeFlyoverToken = async \(call\) => \{[\s\S]{0,900}?const waiting = here\.find\(\(t\) => t\.hidden\) \?\? here\[0\] \?\? null;[\s\S]{0,700}?await waiting\.update\(\{ \.\.\.at, hidden: false, [\s\S]{0,200}?\{ animate: false[\s\S]{0,200}?createEmbeddedDocuments\("Token", \[\{ \.\.\.\(await actor\.getTokenDocument\(\{ \.\.\.at, hidden: false/);
});

// Roi, 2026-11-25: "we need more of a BOOM when the creature lands, not just thud, maybe use some of the cave-in
// sounds, combine it with something else".
test('a landing booms: a slowed blast at once, a cave-in\'s roar under it, lower and louder for a bigger creature', async () => {
  const { landingBoom, LANDING_BOOMS } = await import('../../../scripts/engines/motion/flyover.mjs');
  const { existsSync } = await import('node:fs');
  const huge = landingBoom({ weight: 5, seed: 3 }), garg = landingBoom({ weight: 6, seed: 3 });
  assert.equal(huge.length, 2);
  assert.ok(LANDING_BOOMS.includes(huge[0].file) && /cave-in/.test(huge[1].file), 'a blast, and a cave-in');
  assert.equal(huge[0].delay, 0); assert.ok(huge[1].delay > 0 && huge[1].delay < 200, 'the ground gives a moment after');
  assert.ok(huge[0].rate < 0.7 && huge[0].lowpass < 900, 'slowed and darkened until it is a boom with no crack in it');
  assert.ok(huge[0].volume > huge[1].volume, 'the roar sits under it');
  assert.ok(garg[0].rate < huge[0].rate && garg[1].rate < huge[1].rate && garg[1].volume > huge[1].volume);
  for (const layer of [...huge, ...garg, ...landingBoom({ weight: 5, seed: 0 }), ...landingBoom({ weight: 5, seed: 7 })]) {
    assert.ok(existsSync(new URL(`../../../${layer.file.replace('modules/animater/', '')}`, import.meta.url)), `${layer.file} is shipped`);
  }
  assert.notEqual(landingBoom({ seed: 0 })[1].file, landingBoom({ seed: 1 })[1].file, 'not the same roar every time');
  assert.match(main, /for \(const layer of landingBoom\(\{ weight: weight \+ 1, seed: id \}\)\) setTimeout\(\(\) => flyoverSound\(layer\.file, spot, layer\), layer\.delay\);/);
});
