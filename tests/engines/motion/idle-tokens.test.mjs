import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMovementFeel, STRIDE } from '../../../scripts/engines/motion/movement-feel.mjs';
import { ratFar, RAT_FAR, RAT_FAR_EVERY, RAT_FAR_STEP } from '../../../scripts/engines/motion/vermin.mjs';

// Reported from a GM's map of 84 tokens, 68 of them hidden: the movement listener walked every one of them every frame
// with nothing moving, and asked Foundry for each token's size several times a token a frame.
const feelOf = (tokens, { groundShadows = true } = {}) => {
  let time = 0; const log = { added: 0 };
  const layer = { addParticle() { log.added++; return {}; }, updateParticle() {}, removeParticle() {}, addShadow() { return {}; }, updateShadow() {}, removeShadow() {}, clear() {} };
  const feel = createMovementFeel({ tokens: () => tokens, floorAt: () => 'dirt', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => time, layer, cap: 200, footstep() {}, groundShadows: () => groundShadows });
  return { feel, log, advance: (ms) => { time += ms; } };
};

test('a token at rest that casts no shadow is looked at once, then left until something about it changes', () => {
  let looks = 0;
  const tok = { id: 't1', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, shadow: false, order: () => { looks++; return 0; } };
  const h = feelOf([tok]);
  for (let i = 0; i < 5; i++) { h.advance(16); h.feel.tick(); }
  assert.equal(looks, 1, 'the full look happened once');
  // It moves: looked at again, and its dust is laid as ever.
  tok.x = 2 * STRIDE * 100; h.advance(16); h.feel.tick();
  assert.equal(looks, 2);
  assert.ok(h.log.added >= 3, 'dust from the stride');
  // Playing an animation, or taken away: looked at in full.
  tok.skip = true; h.advance(16); h.feel.tick(); h.advance(16); h.feel.tick();
  assert.equal(looks, 4);
  tok.skip = false;
  // A new view of the same token (the caller makes one whenever the token changes): looked at in full.
  const again = { ...tok };
  const h2 = feelOf([again]);
  h2.feel.tick(); h2.feel.tick();
  const before = looks; h2.feel.tick();
  assert.equal(looks, before, 'at rest again');
});

test('a token that casts a shadow is looked at every frame while shadows are on, and rests while they are off', () => {
  let looks = 0;
  const tok = { id: 't1', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, order: () => { looks++; return 0; } };
  const on = feelOf([tok], { groundShadows: true });
  for (let i = 0; i < 4; i++) { on.advance(16); on.feel.tick(); }
  assert.equal(looks, 4, 'its lights may move: every frame');
  looks = 0;
  const off = feelOf([tok], { groundShadows: false });
  for (let i = 0; i < 4; i++) { off.advance(16); off.feel.tick(); }
  assert.equal(looks, 1);
});

test('a rat well outside the view is far; one near its edge or with no view given is not', () => {
  const view = { x: 1000, y: 1000, w: 800, h: 600 };
  assert.equal(ratFar({ x: 1400, y: 1300 }, view, 100), false);
  assert.equal(ratFar({ x: 1000 - 100 * RAT_FAR + 1, y: 1300 }, view, 100), false, 'within the margin');
  assert.equal(ratFar({ x: 1000 - 100 * RAT_FAR - 1, y: 1300 }, view, 100), true);
  assert.equal(ratFar({ x: 1400, y: 1600 + 100 * RAT_FAR + 1 }, view, 100), true);
  assert.equal(ratFar({ x: -9999, y: -9999 }, null, 100), false, 'no view: the whole map is seen');
  assert.ok(RAT_FAR_EVERY > 1 && RAT_FAR_STEP >= RAT_FAR_EVERY / 120);
  const vermin = readFileSync(new URL('../../../scripts/engines/motion/vermin.mjs', import.meta.url), 'utf8');
  // One on an errand (told where to go, making for a hole) is never slowed; the time skipped is made up.
  assert.match(vermin, /if \(view && !\(was\.under > 0\) && !was\.order && !was\.chasing && !was\.toHole && ratFar\(was, view, grid\)\) \{/);
  assert.match(vermin, /if \(\(frame \+ i\) % RAT_FAR_EVERY\) \{ was\.owed = owed; return was; \}/);
  assert.match(vermin, /dt = Math\.min\(RAT_FAR_STEP, owed\); was\.owed = 0;/);
});

test('main: sizes are asked of Foundry once a token; hidden creatures frighten nothing; skyTick can be timed by part', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  const feel = main.slice(main.indexOf('const movementFeel = createMovementFeel({'), main.indexOf('  footstep: (floor, at, token, kind = "step") => {'));
  assert.ok(feel.length > 0);
  // The per-frame part of a token's view: no size asked, nothing built.
  const perFrame = feel.slice(feel.indexOf('return placeables.map((t) => {'), feel.indexOf('const c = { x: cx, y: cy }, signature = ['));
  assert.ok(perFrame.length > 0);
  assert.doesNotMatch(perFrame, /getCenterPoint|\bt\.w\b|\bt\.h\b|signature\.every|\[cx/);
  assert.match(perFrame, /size = heldSizeOf\(t\), cx = d\.x \+ size\.cx, cy = d\.y \+ size\.cy;/);
  assert.match(main, /if \(!s \|\| s\.width !== d\.width \|\| s\.height !== d\.height \|\| s\.shape !== d\.shape \|\| s\.grid !== grid \|\| s\.type !== type\) \{/);
  assert.match(main, /const creaturesNow = \(\) => \{[^\n]*if \(t\.visible && t\.actor && t\.document\?\.hidden !== true\) \{ const size = heldSizeOf\(t\);/);
  // Timed only when asked.
  assert.match(main, /const skyMark = \(name\) => \{\r?\n  const p = skyProbe; if \(!p\) return;/);
  assert.match(main, /skyCost: \(ms\) => skyCost\(ms\),/);
  const tick = main.slice(main.indexOf('function skyTick() {'), main.indexOf('const wallShadowsSoon = '));
  assert.ok((tick.match(/skyMark\("/g) ?? []).length >= 20);
  assert.match(tick, /skyMark\(null\);\r?\n\}/);
});
