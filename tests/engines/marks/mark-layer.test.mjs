import test from 'node:test';
import assert from 'node:assert/strict';
import { areaMaskFor, createMarkLayer, markTextures } from '../../../scripts/engines/marks/mark-paint.mjs';
import { layoutBlotches } from '../../../scripts/engines/marks/ground-marks.mjs';

const spot = (extra = {}) => ({ mark: 'rime', shape: 'spot', at: { x: 500, y: 500 }, radius: 50, seed: 7, delayMs: 400, lasting: false, level: 'L1', sceneId: 's1', ...extra });
const circle = (extra = {}) => ({ mark: 'scorch', shape: 'circle', at: { x: 900, y: 900 }, radius: 200, seed: 11, delayMs: 0, lasting: false, level: 'L1', sceneId: 's1', ...extra });

function effect(tag, { moduleName = 'animater', sceneId = 's1' } = {}) {
  return { data: { moduleName, sceneId, ...(tag ? { animaterMark: tag } : {}) } };
}

// A fake sprite that counts every alpha write, so a test can tell untouched marks from updated ones.
function fakeSprite(tag, blotches, mask) {
  let alpha = 1;
  const s = { tag, blotches, mask, visible: true, writes: 0, removed: false, rims: tag.mark === 'scorch' ? [{ alpha: 1 }] : [] };
  Object.defineProperty(s, 'alpha', { get: () => alpha, set: (v) => { alpha = v; s.writes++; } });
  return s;
}

function make({ enabled = () => true, cap = () => 60, mask, viewed = 'L1', timing } = {}) {
  const out = { t: 0, sprites: [], viewed, makes: 0 };
  const layer = createMarkLayer({
    makeSprite: (tag, blotches, m) => { out.makes++; const s = fakeSprite(tag, blotches, m); out.sprites.push(s); return s; },
    addToScene: (s) => { s.added = true; },
    removeFromScene: (s) => { s.removed = true; },
    viewedLevel: () => out.viewed,
    sceneId: () => 's1',
    gridSize: () => 100,
    now: () => out.t,
    cap,
    enabled,
    ...(mask ? { mask } : {}),
    ...(timing ? { timing } : {}),
  });
  const at = (t) => { out.t = t; layer.tick(); };
  return { layer, out, at };
}

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('paints at the landing, not before', () => {
  const { layer, out, at } = make();
  layer.onEffect(effect(spot()));
  at(399);
  assert.equal(out.sprites.length, 0, 'nothing before the landing');
  at(400);
  assert.equal(out.sprites.length, 1);
  const [s] = out.sprites;
  assert.equal(s.added, true);
  assert.deepEqual(s.blotches, layoutBlotches(spot(), 100), 'the shared seed lays out the blotches');
  assert.equal(s.alpha, 0, 'fades in from nothing');
  at(550);
  close(s.alpha, 0.5);
  at(700);
  assert.equal(s.alpha, 1);
  // Holding at full: no writes at all.
  const writes = s.writes;
  for (const t of [1000, 5000, 60000, 120399]) at(t);
  assert.equal(s.writes, writes, 'a holding mark is untouched');
  at(400 + 120000 + 90000);
  close(s.alpha, 0.5);
  at(400 + 300000);
  assert.equal(s.removed, true);
  assert.equal(layer.count(), 0);
});

test('a custom timing sets when a mark fades and goes', () => {
  const { layer, out, at } = make({ timing: () => ({ holdMs: 1000, fadeMs: 2000 }) });
  layer.onEffect(effect(spot({ delayMs: 0 })));
  at(0);
  const [s] = out.sprites;
  at(1000 - 1);
  assert.equal(s.alpha, 1);
  at(1000 + 1000);
  close(s.alpha, 0.5);
  at(3000);
  assert.equal(s.removed, true);
  assert.equal(layer.count(), 0);
});

test('a lifetime of 0 never removes a mark and schedules no per-frame work', () => {
  const { layer, out, at } = make({ timing: () => ({ holdMs: Infinity, fadeMs: 0 }) });
  layer.onEffect(effect(spot({ delayMs: 0 })));
  at(0);
  at(500);
  const [s] = out.sprites;
  const writes = s.writes;
  for (const t of [1000, 3600000, 86400000]) at(t);
  assert.equal(s.writes, writes);
  assert.equal(s.alpha, 1);
  assert.equal(s.removed, false);
  assert.equal(layer.count(), 1);
});

test('lasting marks hold until the anchor ends', () => {
  const { layer, out, at } = make();
  const e = effect(spot({ lasting: true, delayMs: 0 }));
  layer.onEffect(e);
  at(0); at(400);
  const [s] = out.sprites;
  at(600000);
  assert.equal(s.alpha, 1, 'still full ten minutes on');
  layer.onEnded(e);
  at(600000 + 120000);
  assert.equal(s.alpha, 1, 'its two minutes start when the anchor ends');
  at(600000 + 210000);
  close(s.alpha, 0.5);
  at(600000 + 300000);
  assert.equal(s.removed, true);
});

test('anchor gone before landing still paints', () => {
  const { layer, out, at } = make();
  const once = effect(spot({ delayMs: 1000 }));
  const lasting = effect(spot({ delayMs: 1000, lasting: true, at: { x: 2000, y: 2000 } }));
  layer.onEffect(once); layer.onEffect(lasting);
  at(500);
  layer.onEnded(once); layer.onEnded(lasting);
  at(1000);
  assert.equal(out.sprites.length, 2);
  at(1000 + 120000 + 90000);
  for (const s of out.sprites) close(s.alpha, 0.5);
});

test('cap fades the oldest', () => {
  const first = spot({ delayMs: 0 }), second = spot({ delayMs: 0, seed: 99, at: { x: 1500, y: 500 } });
  // Room for either one, not both.
  const n = Math.max(layoutBlotches(first, 100).length, layoutBlotches(second, 100).length);
  const { layer, out, at } = make({ cap: () => n });
  layer.onEffect(effect(first));
  at(0); at(1000);
  layer.onEffect(effect(second));
  at(1000);
  const [old, young] = out.sprites;
  at(1300);
  at(2000);
  close(old.alpha, 0.5);
  assert.equal(young.alpha, 1);
  at(3000);
  assert.equal(old.removed, true);
  assert.equal(young.removed, false);
  assert.equal(layer.count(), 1);
});

test('marks show only on their level', () => {
  const { layer, out, at } = make({ viewed: 'L1' });
  layer.onEffect(effect(spot({ delayMs: 0, level: 'L1' })));
  layer.onEffect(effect(spot({ delayMs: 0, level: 'L2', at: { x: 1500, y: 500 } })));
  layer.onEffect(effect(spot({ delayMs: 0, level: undefined, at: { x: 2500, y: 500 } })));
  at(0);
  const [one, two, any] = out.sprites;
  assert.deepEqual([one.visible, two.visible, any.visible], [true, false, true]);
  out.viewed = 'L2';
  at(16);
  assert.deepEqual([one.visible, two.visible, any.visible], [false, true, true]);
});

test('tear-down clears every mark', () => {
  const { layer, out, at } = make();
  layer.onEffect(effect(spot({ delayMs: 0 })));
  layer.onEffect(effect(circle()));
  layer.onEffect(effect(spot({ delayMs: 5000, at: { x: 3000, y: 500 } })));
  at(0);
  assert.equal(out.sprites.length, 2);
  layer.clear();
  assert.equal(layer.count(), 0);
  assert.ok(out.sprites.every((s) => s.removed));
  at(6000);
  assert.equal(out.sprites.length, 2, 'a pending mark is gone too');
});

test('local setting off paints nothing', () => {
  const { layer, out, at } = make({ enabled: () => false });
  layer.onEffect(effect(spot({ delayMs: 0 })));
  at(0); at(1000);
  assert.equal(out.sprites.length, 0);
  assert.equal(layer.count(), 0);
});

test('foreign and untagged effects ignored', () => {
  const { layer, out, at } = make();
  layer.onEffect(effect(spot({ delayMs: 0 }), { moduleName: 'other-module' }));
  layer.onEffect(effect(null));
  layer.onEffect(effect(spot({ delayMs: Number.NaN })));
  layer.onEffect(effect(spot({ mark: 'blood' })));
  layer.onEffect(effect(spot({ at: { x: 'a', y: 1 } })));
  layer.onEffect(effect(spot({ delayMs: 0, sceneId: 'elsewhere' }), { sceneId: 'elsewhere' }));
  layer.onEffect(null);
  at(0); at(1000);
  assert.equal(out.sprites.length, 0);
  const e = effect(spot({ delayMs: 0 }));
  layer.onEffect(e); layer.onEffect(e);
  at(1000);
  assert.equal(out.sprites.length, 1, 'one mark per effect');
});

test('areas are clipped to their template', () => {
  const polygon = { points: [0, 0, 1, 0, 1, 1] };
  const asked = [];
  const { layer, out, at } = make({ mask: (tag) => { asked.push(tag.shape); return polygon; } });
  layer.onEffect(effect(circle()));
  layer.onEffect(effect(spot({ delayMs: 0 })));
  at(0);
  assert.deepEqual(asked, ['circle'], 'only areas ask for a mask');
  assert.equal(out.sprites[0].mask, polygon);
  assert.equal(out.sprites[1].mask, null);
});

test('scorch embers cool over the first ten seconds', () => {
  const { layer, out, at } = make();
  layer.onEffect(effect(circle()));
  at(0);
  const [s] = out.sprites;
  at(5000);
  close(s.rims[0].alpha, 0.5);
  at(10000);
  assert.equal(s.rims[0].alpha, 0);
});

test('a failing sprite is dropped and the frame goes on', () => {
  let calls = 0;
  const out = { t: 0 };
  const layer = createMarkLayer({
    makeSprite: () => { calls++; throw new Error('no texture'); },
    addToScene: () => {}, removeFromScene: () => {}, viewedLevel: () => 'L1', now: () => out.t,
  });
  const warn = console.warn; console.warn = () => {};
  try {
    layer.onEffect(effect(spot({ delayMs: 0 })));
    assert.doesNotThrow(() => layer.tick());
    assert.doesNotThrow(() => layer.tick());
  } finally { console.warn = warn; }
  assert.equal(calls, 1);
  assert.equal(layer.count(), 0);
});

// A fake PIXI that records what each texture draws.
function fakePixi() {
  const log = [];
  class Graphics {
    constructor() { this.calls = []; log.push(this.calls); this.position = { set: () => {} }; }
    destroy() {}
  }
  for (const name of ['beginFill', 'endFill', 'lineStyle', 'drawPolygon', 'drawCircle', 'drawEllipse', 'moveTo', 'lineTo']) {
    Graphics.prototype[name] = function (...args) { this.calls.push([name, ...args]); return this; };
  }
  const RenderTexture = { create: (o) => ({ ...o, id: Symbol('texture') }) };
  return { PIXI: { Graphics, RenderTexture }, log };
}

test('mark textures are drawn once per mark and variant, the same every time', () => {
  const a = fakePixi(), b = fakePixi();
  const renders = [];
  const renderer = { render: (g, o) => renders.push(o.renderTexture) };
  const ta = markTextures(a.PIXI, renderer), tb = markTextures(b.PIXI, { render: () => {} });
  for (const mark of ['scorch', 'rime', 'residue', 'streaks', 'stain', 'cracks', 'withered']) {
    for (let v = 0; v < 4; v++) {
      const tex = ta.get(mark, v);
      assert.equal(tex.width, 256);
      assert.equal(ta.get(mark, v), tex, 'cached');
      tb.get(mark, v);
    }
  }
  assert.deepEqual(a.log, b.log, 'deterministic');
  assert.notDeepEqual(a.log[0], a.log[a.log.length - 1]);
  assert.ok(ta.rim('scorch', 0), 'scorch has an ember rim');
  assert.equal(ta.rim('rime', 0), null);
  assert.equal(ta.get('nothing', 0), null);
});

// A strict point-in-polygon, like PIXI's: a point on the outline is outside.
const poly = (...pts) => ({ pts, contains(x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
} });
const region = (id, shapes, polygons) => ({ id, shapes, polygons });
const opts = (regions) => ({ regions, grid: 100, polygonsOf: (r) => r.polygons });

test('an area mask is found by its Region id', () => {
  const own = region('rg1', [{ type: 'circle', x: 0, y: 0, radius: 200 }], [poly([0, 0], [1, 0], [1, 1])]);
  const other = region('rg2', [{ type: 'circle', x: 900, y: 900, radius: 200 }], [poly([800, 800], [1000, 800], [900, 1000])]);
  assert.equal(areaMaskFor(circle({ regionId: 'rg1' }), opts([other, own]))[0], own.polygons[0]);
  assert.equal(areaMaskFor(circle({ regionId: 'gone' }), opts([other, own])), null, 'a deleted Region leaves it unclipped');
});

test('without an id, a cone finds its Region facing either way', () => {
  // Origin (500, 500) sits on the outline; the middle of the cone is well inside.
  const left = region('L', [{ type: 'cone', x: 500, y: 500, radius: 400, angle: 53 }], [poly([500, 500], [100, 300], [100, 700])]);
  const right = region('R', [{ type: 'cone', x: 500, y: 500, radius: 400, angle: 53 }], [poly([500, 500], [900, 300], [900, 700])]);
  // A big terrain area under everything, of another type and starting elsewhere.
  const terrain = region('T', [{ type: 'rectangle', x: 0, y: 0, width: 2000, height: 2000 }], [poly([0, 0], [2000, 0], [2000, 2000], [0, 2000])]);
  const cone = (x) => ({ mark: 'scorch', shape: 'cone', at: { x: 500, y: 500 }, endpoint: { x, y: 500 }, angle: 53, length: 400, seed: 1, delayMs: 0 });
  assert.equal(areaMaskFor(cone(100), opts([terrain, right, left]))[0], left.polygons[0]);
  assert.equal(areaMaskFor(cone(900), opts([terrain, left, right]))[0], right.polygons[0]);
  // A cone of the wrong size loses to the matching one.
  const small = region('S', [{ type: 'cone', x: 500, y: 500, radius: 150, angle: 53 }], [poly([500, 500], [80, 280], [80, 720])]);
  assert.equal(areaMaskFor(cone(100), opts([small, left]))[0], left.polygons[0]);
  assert.equal(areaMaskFor(cone(100), opts([terrain])), null, 'never the terrain');
});

test('a Region that arrives late still clips the mark', () => {
  let found = null;
  const { layer, out, at } = make({ mask: () => found });
  layer.onEffect(effect(circle({ delayMs: 500 })));
  at(0);
  found = [poly([0, 0], [1, 0], [1, 1])];
  at(500);
  assert.equal(out.sprites[0].mask, found);
});

test('settings changes: off wipes the floor, a smaller cap fades the oldest', () => {
  let on = true, most = 60;
  const { layer, out, at } = make({ enabled: () => on, cap: () => most });
  const first = spot({ delayMs: 0 }), second = spot({ delayMs: 0, seed: 99, at: { x: 1500, y: 500 } });
  layer.onEffect(effect(first)); at(0);
  layer.onEffect(effect(second)); at(100);
  most = Math.max(layoutBlotches(first, 100).length, layoutBlotches(second, 100).length);
  layer.refresh();
  at(1100);
  close(out.sprites[0].alpha, 0.5);
  assert.equal(out.sprites[1].alpha, 1);
  on = false;
  layer.refresh();
  assert.equal(layer.count(), 0);
  assert.ok(out.sprites.every((s) => s.removed));
});

// Sequencer fires its create hook before the clip loads: `ready` turns true once the effect shows.
const loading = (tag) => Object.assign(effect(tag), { ready: false, _ended: false, destroyed: false });

test('a mark waits for its anchor clip to load, then counts its delay from there', () => {
  const { layer, out, at } = make();
  const e = loading(spot({ delayMs: 400 }));
  layer.onEffect(e);
  at(400); at(2000);
  assert.equal(out.sprites.length, 0, 'nothing while the clip is still loading');
  e.ready = true;
  at(2100);
  assert.equal(out.sprites.length, 0, 'the delay starts when the anchor shows');
  at(2499);
  assert.equal(out.sprites.length, 0);
  at(2500);
  assert.equal(out.sprites.length, 1);
});

test('an anchor that ends or never loads still lets its mark land', () => {
  const { layer, out, at } = make();
  const ended = loading(spot({ delayMs: 0 }));
  const stuck = loading(spot({ delayMs: 0, at: { x: 1500, y: 500 } }));
  layer.onEffect(ended); layer.onEffect(stuck);
  at(100);
  ended._ended = true;
  at(200);
  assert.equal(out.sprites.length, 1, 'an ended anchor releases its mark');
  at(4999);
  assert.equal(out.sprites.length, 1, 'a loading anchor still holds');
  at(5000);
  assert.equal(out.sprites.length, 2, 'released after five seconds anyway');
});

test('the cap fades other marks before a lasting mark whose area still lives', () => {
  const area = spot({ delayMs: 0, lasting: true }), first = spot({ delayMs: 0, seed: 99, at: { x: 1500, y: 500 } });
  const second = spot({ delayMs: 0, seed: 5, at: { x: 2500, y: 500 } });
  const n = (t) => layoutBlotches(t, 100).length;
  // Room for the area and one more.
  const { layer, out, at } = make({ cap: () => n(area) + Math.max(n(first), n(second)) });
  const anchor = effect(area);
  layer.onEffect(anchor); at(0);
  layer.onEffect(effect(first)); at(1000);
  layer.onEffect(effect(second)); at(2000);
  const [held, old, young] = out.sprites;
  at(5000);
  assert.equal(held.removed, false, 'the oldest mark is kept while its area lives');
  assert.equal(old.removed, true, 'the oldest other mark goes');
  assert.equal(young.removed, false);
});

test('lasting marks alone may go past the cap', () => {
  const a = spot({ delayMs: 0, lasting: true }), b = spot({ delayMs: 0, lasting: true, seed: 99, at: { x: 1500, y: 500 } });
  const { layer, out, at } = make({ cap: () => 1 });
  layer.onEffect(effect(a)); layer.onEffect(effect(b));
  at(0); at(5000);
  assert.equal(out.sprites.length, 2);
  assert.ok(out.sprites.every((s) => !s.removed && s.alpha === 1));
});
