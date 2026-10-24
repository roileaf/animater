import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shakeTagOf, shakeProfile, shakeOffset, createCameraShake, canShake, MAX_SHAKE_PX, tremorProfile } from '../../../scripts/engines/camera/camera-shake.mjs';

const GRID = 100;
// A 2000 x 1000 world view centred on (1000, 500).
const VIEW = { x: 0, y: 0, w: 2000, h: 1000 };
const shock = (over = {}) => ({ kind: 'shock', at: { x: 1000, y: 500 }, radius: 600, startMs: 0, lengthMs: 700, strength: 1, follow: false, ...over });

test('shake tags: a shock from the warp tag or the shake tag, nothing else', () => {
  assert.deepEqual(shakeTagOf({ animaterWarp: shock() }), shock());
  assert.deepEqual(shakeTagOf({ animaterShake: shock() }), shock());
  assert.equal(shakeTagOf({ animaterWarp: { ...shock(), kind: 'haze' } }), null);
  assert.equal(shakeTagOf({ animaterWarp: { ...shock(), at: { x: NaN, y: 0 } } }), null);
  assert.equal(shakeTagOf({ animaterWarp: { ...shock(), radius: 0 } }), null);
  assert.equal(shakeTagOf({}), null);
  assert.equal(shakeTagOf(null), null);
});

test('quality Full or Light, and this client on', () => {
  assert.equal(canShake('full', true), true);
  assert.equal(canShake('light', true), true);
  assert.equal(canShake('balanced', true), false);
  assert.equal(canShake('low', true), false);
  assert.equal(canShake('off', true), false);
  assert.equal(canShake('full', false), false);
});

test('profile: amplitude grows with blast radius, at most ~10 px at strength 1', () => {
  const small = shakeProfile(shock({ radius: 300 }), { view: VIEW, gridPx: GRID });
  const big = shakeProfile(shock({ radius: 1200 }), { view: VIEW, gridPx: GRID });
  const huge = shakeProfile(shock({ radius: 5000 }), { view: VIEW, gridPx: GRID });
  assert.ok(small.amplitude > 0 && small.amplitude < big.amplitude);
  assert.ok(huge.amplitude <= MAX_SHAKE_PX && MAX_SHAKE_PX === 10);
  assert.ok(small.durationMs >= 350 && huge.durationMs <= 600 && small.durationMs < big.durationMs);
});

test('profile: falls off with distance from the view centre, none when off-screen and far', () => {
  const centre = shakeProfile(shock(), { view: VIEW, gridPx: GRID });
  const edge = shakeProfile(shock({ at: { x: 1900, y: 500 } }), { view: VIEW, gridPx: GRID });
  assert.ok(edge.amplitude < centre.amplitude);
  assert.equal(shakeProfile(shock({ at: { x: 9000, y: 500 } }), { view: VIEW, gridPx: GRID }), null);
});

test('profile: strength scales it; delay is the tag start', () => {
  const one = shakeProfile(shock({ startMs: 250 }), { view: VIEW, gridPx: GRID });
  const two = shakeProfile(shock({ startMs: 250 }), { view: VIEW, gridPx: GRID, strength: 2 });
  assert.equal(one.startMs, 250);
  assert.ok(Math.abs(two.amplitude - 2 * one.amplitude) < 1e-9);
  assert.equal(shakeProfile(shock(), { view: VIEW, gridPx: GRID, strength: 0 }), null);
});

test('offset: zero before, decaying within, exactly zero after', () => {
  const p = { amplitude: 10, startMs: 100, durationMs: 400, seed: 7 };
  assert.deepEqual(shakeOffset(p, 50), { x: 0, y: 0 });
  assert.deepEqual(shakeOffset(p, 500), { x: 0, y: 0 });
  assert.deepEqual(shakeOffset(p, 900), { x: 0, y: 0 });
  let early = 0, late = 0;
  for (let t = 100; t < 180; t += 4) early = Math.max(early, Math.hypot(...Object.values(shakeOffset(p, t))));
  for (let t = 420; t < 500; t += 4) late = Math.max(late, Math.hypot(...Object.values(shakeOffset(p, t))));
  assert.ok(early > 2 && early <= 10 * Math.SQRT2, `early ${early}`);
  assert.ok(late < early / 3, `late ${late}`);
  assert.deepEqual(shakeOffset(p, 300), shakeOffset({ ...p }, 300), 'deterministic');
});

// A fake stage position, a clock and the options the host needs.
function fixture(over = {}) {
  const state = { t: 1000, pos: { x: 500, y: 400 }, writes: 0 };
  const host = createCameraShake({
    getPosition: () => ({ ...state.pos }),
    setPosition: (x, y) => { state.pos = { x, y }; state.writes++; },
    view: () => VIEW,
    gridPx: () => GRID,
    now: () => state.t,
    enabled: () => state.enabled !== false,
    strength: () => 1,
    sceneId: () => 's1',
    viewedLevel: () => 'L1',
    ...over,
  });
  return { state, host };
}
const effectOf = (tag, data = {}) => ({ id: 'e1', data: { moduleName: 'animater', sceneId: 's1', animaterWarp: tag, ...data } });
const run = (state, host, ms, step = 16) => { for (let i = 0; i < ms; i += step) { state.t += step; host.tick(); } };

test('host: shakes, then restores the position exactly', () => {
  const { state, host } = fixture();
  host.onEffect(effectOf(shock()));
  state.t += 16; host.tick();
  run(state, host, 100);
  assert.notDeepEqual(state.pos, { x: 500, y: 400 }, 'moved');
  run(state, host, 1000);
  assert.deepEqual(state.pos, { x: 500, y: 400 });
  const writes = state.writes;
  run(state, host, 200);
  assert.equal(state.writes, writes, 'idle: never touches the stage');
});

// Foundry pans by the stage's pivot; only a resize sets its position (to the screen's centre).
test('host: an outside reset of the position (a resize) is the new base, never drifted', () => {
  const { state, host } = fixture();
  host.onEffect(effectOf(shock()));
  run(state, host, 100);
  state.pos = { x: 960, y: 540 }; // a resize recentres the stage
  run(state, host, 1200);
  assert.deepEqual(state.pos, { x: 960, y: 540 });
});

test('host: other scene, other level, other modules, unseen and disabled are ignored', () => {
  const cases = [
    effectOf(shock(), { sceneId: 's2' }),
    effectOf(shock({ level: 'L2' })),
    effectOf(shock(), { moduleName: 'other' }),
    effectOf({ ...shock(), kind: 'haze' }),
  ];
  for (const effect of cases) {
    const { state, host } = fixture();
    host.onEffect(effect);
    run(state, host, 800);
    assert.equal(state.writes, 0);
  }
  const unseen = fixture({ seen: () => false });
  unseen.host.onEffect(effectOf(shock()));
  run(unseen.state, unseen.host, 800);
  assert.equal(unseen.state.writes, 0);
  const off = fixture();
  off.state.enabled = false;
  off.host.onEffect(effectOf(shock()));
  run(off.state, off.host, 800);
  assert.equal(off.state.writes, 0);
});

test('host: the same level shakes; turning off mid-shake restores at once', () => {
  const { state, host } = fixture();
  host.onEffect(effectOf(shock({ level: 'L1' })));
  run(state, host, 100);
  assert.ok(state.writes > 0);
  state.enabled = false;
  state.t += 16; host.tick();
  assert.deepEqual(state.pos, { x: 500, y: 400 });
});

test('host: clear restores; overlapping shakes stay within twice the cap', () => {
  const { state, host } = fixture();
  host.onEffect(effectOf(shock({ radius: 5000 })));
  host.onEffect({ id: 'e2', data: effectOf(shock({ radius: 5000 })).data });
  host.onEffect({ id: 'e3', data: effectOf(shock({ radius: 5000 })).data });
  for (let i = 0; i < 30; i++) {
    state.t += 16; host.tick();
    assert.ok(Math.hypot(state.pos.x - 500, state.pos.y - 400) <= 2 * MAX_SHAKE_PX * Math.SQRT2 + 1e-9);
  }
  host.clear();
  assert.deepEqual(state.pos, { x: 500, y: 400 });
});

test('host: the same effect twice shakes once; a throwing stage never throws', () => {
  const { state, host } = fixture();
  const e = effectOf(shock());
  host.onEffect(e); host.onEffect(e);
  assert.equal(host.size, 1);
  const bad = fixture({ getPosition: () => { throw new Error('gone'); } });
  bad.host.onEffect(effectOf(shock()));
  assert.doesNotThrow(() => run(bad.state, bad.host, 100));
});

test('every Huge and Gargantuan footfall trembles the visible view: heavier more, fading beyond its edge', () => {
  const centre = { x: 1000, y: 500 };
  assert.equal(tremorProfile({ weight: 3.75, at: centre, view: VIEW, gridPx: GRID }), null, 'a heavy Large creature does not');
  const huge = tremorProfile({ weight: 4, at: centre, view: VIEW, gridPx: GRID });
  assert.ok(huge && Math.abs(huge.amplitude - 1) < 1e-9, 'a plain Huge creature: about 1 px');
  const heavyHuge = tremorProfile({ weight: 4.75, at: centre, view: VIEW, gridPx: GRID });
  const gargantuan = tremorProfile({ weight: 5, at: centre, view: VIEW, gridPx: GRID });
  const grg = tremorProfile({ weight: 5.75, at: centre, view: VIEW, gridPx: GRID });
  assert.ok(huge.amplitude < heavyHuge.amplitude && heavyHuge.amplitude < gargantuan.amplitude && gargantuan.amplitude < grg.amplitude, 'heavier, more');
  assert.ok(Math.abs(grg.amplitude - 3) < 1e-9, 'up to 3 px');
  assert.ok(huge.durationMs >= 150 && huge.durationMs <= 220, 'about 180 ms');
  const near = tremorProfile({ weight: 5.75, at: { x: VIEW.x + VIEW.w + 300, y: 500 }, view: VIEW, gridPx: GRID });
  assert.ok(near.amplitude < grg.amplitude && near.amplitude > 0);
  assert.equal(tremorProfile({ weight: 5.75, at: { x: VIEW.x + VIEW.w + 900, y: 500 }, view: VIEW, gridPx: GRID }), null, 'nine squares beyond the view: nothing');
  assert.ok(grg.amplitude < MAX_SHAKE_PX / 2, 'far under a blast');
});

test('zoomed-out live scene: each on-screen Huge/Gargantuan step gets a tremor, including far from view centre', () => {
  const view = { x: 652, y: 782.1, w: 4096, h: 2036.8 };
  for (const weight of [4, 4.75, 5, 5.75]) {
    for (const at of [{ x: 4100, y: 1000 }, { x: 700, y: 800 }, { x: 4600, y: 2700 }]) {
      assert.ok(tremorProfile({ weight, at, view, gridPx: 100 }), `${weight} at ${at.x}/${at.y}`);
    }
  }
});

test('expired tremors cannot consume slots before the next renderer tick', () => {
  const { state, host } = fixture();
  const step = { at: { x: 1000, y: 500 }, weight: 5, sceneId: 's1' };
  assert.equal(host.tremor(step), true);
  assert.equal(host.tremor(step), true);
  state.t += 750;
  assert.equal(host.tremor(step), true, 'a later audible step must not lose its shake to expired entries');
  assert.equal(host.size, 1);
});

test('per-token tremor gain is independent; stopping a preview preserves live tremors', () => {
  const { host, state } = fixture();
  const step = { at: { x: 1000, y: 500 }, weight: 5, sceneId: 's1' };
  assert.equal(host.tremor({ ...step, scale: 0 }), false);
  assert.equal(host.tremor({ ...step, scale: 0.5 }), true);
  const previewId = Symbol('test-preview');
  assert.equal(host.tremor({ ...step, scale: 2, previewId }), true);
  state.t += 16; host.tick();
  host.stopPreview(previewId); assert.equal(host.size, 1);
  host.stopPreview(undefined); assert.equal(host.size, 1);
  host.clear(); assert.deepEqual(state.pos, { x: 500, y: 400 });
});
test('footfall tremors go through the host: on its scene and level, enabled, two at most, then gone', () => {
  const { state, host } = fixture();
  const at = { x: 1000, y: 500 };
  assert.equal(host.tremor({ at, weight: 5, sceneId: 's2' }), false, 'another scene');
  assert.equal(host.tremor({ at, weight: 5, sceneId: 's1', level: 'L2' }), false, 'another level');
  state.enabled = false;
  assert.equal(host.tremor({ at, weight: 5, sceneId: 's1' }), false, 'shake off on this screen');
  state.enabled = true;
  assert.equal(host.tremor({ at, weight: 5, sceneId: 's1', seed: 'a' }), true);
  assert.equal(host.tremor({ at, weight: 5, sceneId: 's1', seed: 'b' }), true);
  assert.equal(host.tremor({ at, weight: 5, sceneId: 's1', seed: 'c' }), false, 'never more than two at once');
  state.t += 40; host.tick();
  assert.ok(state.pos.x !== 500 || state.pos.y !== 400, 'it moves the view');
  assert.ok(Math.abs(state.pos.x - 500) <= 6 && Math.abs(state.pos.y - 400) <= 6, 'a few pixels only');
  state.t += 300; host.tick();
  assert.deepEqual(state.pos, { x: 500, y: 400 }, 'put back exactly');
  assert.equal(host.size, 0);
});
