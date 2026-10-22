import test from 'node:test';
import assert from 'node:assert/strict';
import { createDistortionHost, canDistort, attachFilter, detachFilter } from '../../../scripts/engines/distortion/distortion-host.mjs';
import { sceneWarpUniforms } from '../../../scripts/engines/tokenshade/filters/scene-warp.mjs';

const shock = (x = 500, y = 500, extra = {}) => ({ kind: 'shock', at: { x, y }, radius: 600, startMs: 0, lengthMs: 700, strength: 1, follow: false, ...extra });
const haze = (x = 500, y = 500, extra = {}) => ({ kind: 'haze', at: { x, y }, radius: 300, startMs: 0, lengthMs: null, strength: 1, follow: false, area: { type: 'circle' }, ...extra });
const warp = (x = 500, y = 500) => ({ kind: 'warp', at: { x, y }, radius: 200, startMs: 0, lengthMs: 500, strength: 1, follow: false });

function effect(tag, { x, y, sceneId = 's1', moduleName = 'animater' } = {}) {
  return { data: { moduleName, sceneId, ...(tag ? { animaterWarp: tag } : {}) }, worldPosition: { x: x ?? tag?.at?.x ?? 0, y: y ?? tag?.at?.y ?? 0 } };
}

function make({ allowed = true, tight = false, failFilter = false } = {}) {
  const out = { t: 0, allowed, tight, made: 0, attached: [], detached: [], filters: [], destroyed: 0 };
  const host = createDistortionHost({
    makeFilter: () => {
      out.made++;
      if (failFilter) throw new Error('compile failed');
      const f = { uniforms: sceneWarpUniforms(), enabled: true, destroy: () => { out.destroyed++; } };
      out.filters.push(f);
      return f;
    },
    attach: (f) => out.attached.push(f),
    detach: (f) => out.detached.push(f),
    allowed: () => out.allowed,
    tight: () => out.tight,
    sceneId: () => 's1',
    // A 2000 x 1000 world view at zoom 1, screen = world.
    view: () => ({ x: 0, y: 0, w: 2000, h: 1000, zoom: 1, worldToScreen: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } }),
    now: () => out.t,
  });
  return { host, out };
}

const u = (out) => out.filters[0].uniforms;
const quiet = (fn) => {
  const warn = console.warn, warnings = [];
  console.warn = (...args) => warnings.push(args);
  try { fn(); } finally { console.warn = warn; }
  return warnings;
};

test('first distortion attaches, last one detaches', () => {
  const { host, out } = make();
  host.tick();
  assert.equal(out.made, 0, 'nothing is built while idle');
  host.onEffect(effect(shock()));
  out.t = 10;
  host.tick();
  assert.equal(out.attached.length, 1);
  host.onEffect(effect(warp(900, 500)));
  out.t = 100;
  host.tick();
  assert.equal(out.attached.length, 1, 'one filter for every distortion');
  assert.equal(out.made, 1);
  out.t = 800;
  host.tick();
  assert.equal(out.detached.length, 1, 'both have run their course');
  assert.equal(out.detached[0], out.attached[0]);
  // A later distortion attaches again.
  host.onEffect(effect(warp()));
  out.t = 820;
  host.tick();
  assert.equal(out.attached.length, 2);
});

test('uniforms carry up to 4 slots', () => {
  const { host, out } = make();
  for (let i = 0; i < 5; i++) host.onEffect(effect(shock(200 + i * 300, 500)));
  out.t = 350;
  host.tick();
  const uni = u(out);
  assert.equal(uni.uSlots, 4);
  assert.deepEqual([...uni.uKind], [0, 0, 0, 0]);
  // The one farthest from the view's centre (x 1000) is left out.
  assert.deepEqual([0, 2, 4, 6].map((i) => uni.uCentre[i]), [500, 800, 1100, 1400]);
  assert.equal(uni.uCentre[1], 500);
  assert.ok(uni.uRing[0] > 0 && uni.uRing[0] < 600, 'the ring is on its way out');
  assert.ok(uni.uAmp[0] > 0 && uni.uAmp[0] < 12);
  assert.deepEqual([...uni.uWorldToScreen], [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(out.filters[0].enabled, true);
});

test('kinds share the slots: haze and warp sit beside a shock', () => {
  const { host, out } = make();
  host.onEffect(effect(haze(300, 300)));
  host.onEffect(effect(warp(900, 300)));
  out.t = 250;
  host.tick();
  const uni = u(out);
  assert.equal(uni.uSlots, 2);
  assert.deepEqual([...uni.uKind.slice(0, 2)], [1, 2]);
  assert.equal(uni.uRadius[0], 300);
  assert.ok(Math.abs(uni.uAmp[1] - 10) < 1e-6, 'the warp peaks halfway');
});

test('a line of fire hazes along its capsule', () => {
  const { host, out } = make();
  host.onEffect(effect(haze(500, 500, { radius: 350, area: { type: 'capsule', a: { x: 200, y: 500 }, b: { x: 800, y: 500 }, width: 100 } })));
  out.t = 20;
  host.tick();
  const uni = u(out);
  assert.deepEqual([...uni.uSeg.slice(0, 4)], [200, 500, 800, 500]);
  assert.equal(uni.uRadius[0], 50, 'half the width around the line');
});

test('following haze reads the anchor\'s live position', () => {
  const { host, out } = make();
  const e = effect(haze(500, 500, { follow: true }));
  host.onEffect(e);
  out.t = 20;
  host.tick();
  assert.deepEqual([...u(out).uCentre.slice(0, 2)], [500, 500]);
  e.worldPosition = { x: 800, y: 450 };
  out.t = 40;
  host.tick();
  assert.deepEqual([...u(out).uCentre.slice(0, 2)], [800, 450]);
  assert.deepEqual([...u(out).uSeg.slice(0, 4)], [800, 450, 800, 450]);
  // Carried off-screen with its token: no slot, no pass.
  e.worldPosition = { x: 5000, y: 450 };
  out.t = 60;
  host.tick();
  assert.equal(u(out).uSlots, 0);
  assert.equal(out.filters[0].enabled, false);
  assert.equal(out.detached.length, 0, 'still lasting: kept for when it returns');
  e.worldPosition = { x: 900, y: 450 };
  out.t = 80;
  host.tick();
  assert.equal(u(out).uSlots, 1);
  assert.equal(out.filters[0].enabled, true);
});

test('a still haze ignores its anchor\'s position', () => {
  const { host, out } = make();
  host.onEffect(effect(haze(500, 500), { x: 1500, y: 900 }));
  out.t = 20;
  host.tick();
  assert.deepEqual([...u(out).uCentre.slice(0, 2)], [500, 500]);
});

test('a one-shot shock runs its full time after its anchor ends', () => {
  const { host, out } = make();
  const e = effect(shock());
  host.onEffect(e);
  out.t = 100;
  host.tick();
  host.onEnded(e);
  out.t = 650;
  host.tick();
  assert.equal(u(out).uSlots, 1);
  assert.equal(out.detached.length, 0);
  out.t = 701;
  host.tick();
  assert.equal(out.detached.length, 1);
});

test('a shock waits for its contact moment on the anchor\'s clock', () => {
  const { host, out } = make();
  host.onEffect(effect(shock(500, 500, { startMs: 400 })));
  out.t = 200;
  host.tick();
  assert.equal(u(out).uSlots, 0);
  assert.equal(out.filters[0].enabled, false, 'no pass before the ring starts');
  out.t = 500;
  host.tick();
  assert.equal(u(out).uSlots, 1);
  out.t = 1050;
  host.tick();
  assert.equal(u(out).uSlots, 1, 'the ring runs 700 ms from its start');
  out.t = 1101;
  host.tick();
  assert.equal(out.detached.length, 1);
});

test('haze ends with its anchor, fading quickly', () => {
  const { host, out } = make();
  const e = effect(haze());
  host.onEffect(e);
  out.t = 5000;
  host.tick();
  const full = u(out).uAmp[0];
  host.onEnded(e);
  out.t = 5150;
  host.tick();
  assert.ok(u(out).uAmp[0] > 0 && u(out).uAmp[0] < full, 'fading');
  out.t = 5400;
  host.tick();
  assert.equal(out.detached.length, 1, 'gone within a moment');
});

test('a haze whose anchor was destroyed without an end hook still goes', () => {
  const { host, out } = make();
  const e = effect(haze());
  host.onEffect(e);
  out.t = 100;
  host.tick();
  e.destroyed = true;
  out.t = 200;
  host.tick();
  out.t = 600;
  host.tick();
  assert.equal(out.detached.length, 1);
});

test('tight skips new one-shots but keeps haze', () => {
  const { host, out } = make({ tight: true });
  host.onEffect(effect(shock()));
  host.onEffect(effect(warp()));
  out.t = 100;
  host.tick();
  assert.equal(out.attached.length, 0, 'no one-shot while the frame budget is tight');
  host.onEffect(effect(haze()));
  out.t = 120;
  host.tick();
  assert.equal(out.attached.length, 1);
  assert.equal(u(out).uSlots, 1);
  assert.equal(u(out).uKind[0], 1);
});

test('only Animater effects on this scene with a valid tag distort', () => {
  const { host, out } = make();
  host.onEffect(effect(shock(), { moduleName: 'other' }));
  host.onEffect(effect(shock(), { sceneId: 's2' }));
  host.onEffect(effect(null));
  host.onEffect(effect({ ...shock(), kind: 'spin' }));
  host.onEffect(effect({ ...shock(), radius: -1 }));
  host.onEffect(effect({ ...shock(), at: { x: NaN, y: 0 } }));
  host.onEffect(effect({ ...shock(), lengthMs: 'long' }));
  host.onEffect(null);
  out.t = 100;
  host.tick();
  assert.equal(out.made, 0);
});

test('other filters keep their order', () => {
  const ambience = { name: 'ambience' }, other = { name: 'other' }, ours = { name: 'ours' };
  const screen = { width: 2000, height: 1000 };
  const primary = { filters: [ambience], filterArea: screen };
  attachFilter(primary, ours, screen);
  attachFilter(primary, ours, screen);
  assert.deepEqual(primary.filters, [ambience, ours], 'added once, last');
  primary.filters.push(other);
  detachFilter(primary, ours);
  assert.deepEqual(primary.filters, [ambience, other]);
  detachFilter(primary, ours);
  assert.deepEqual(primary.filters, [ambience, other]);
  // A group without filters gets a list and the screen as its area.
  const bare = { filters: null, filterArea: null };
  attachFilter(bare, ours, screen);
  assert.deepEqual(bare.filters, [ours]);
  assert.equal(bare.filterArea, screen);
});

test('tear-down removes the filter', () => {
  const { host, out } = make();
  host.onEffect(effect(haze()));
  out.t = 20;
  host.tick();
  host.clear();
  assert.equal(out.detached.length, 1);
  assert.equal(out.destroyed, 1);
  out.t = 40;
  host.tick();
  assert.equal(out.attached.length, 1, 'nothing comes back after the scene is gone');
});

test('compile failure disables quietly', () => {
  const { host, out } = make({ failFilter: true });
  const warnings = quiet(() => {
    host.onEffect(effect(haze()));
    out.t = 20;
    assert.doesNotThrow(() => host.tick());
    host.onEffect(effect(shock()));
    out.t = 40;
    host.tick();
  });
  assert.equal(warnings.length, 1, 'one warning for the session');
  assert.equal(out.made, 1, 'never tried again');
  assert.equal(out.attached.length, 0);
});

test('not Full or local setting off: never attaches', () => {
  const { host, out } = make({ allowed: false });
  host.onEffect(effect(shock()));
  out.t = 100;
  host.tick();
  assert.equal(out.made, 0);
  // Turned off while one is showing: it goes at once.
  out.allowed = true;
  host.onEffect(effect(haze()));
  out.t = 120;
  host.tick();
  assert.equal(out.attached.length, 1);
  out.allowed = false;
  out.t = 140;
  host.tick();
  assert.equal(out.detached.length, 1);
  assert.equal(canDistort('full', true), true);
  assert.equal(canDistort('full', false), false);
  for (const level of ['light', 'balanced', 'low', 'off']) assert.equal(canDistort(level, true), false, level);
});

test('the tick never throws', () => {
  const { host, out } = make();
  const e = effect(haze(500, 500, { follow: true }));
  Object.defineProperty(e, 'worldPosition', { get() { throw new Error('gone'); } });
  host.onEffect(e);
  out.t = 20;
  assert.doesNotThrow(() => host.tick());
  assert.deepEqual([...u(out).uCentre.slice(0, 2)], [500, 500], 'falls back to its tagged place');
});
