import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFrameMonitor,
  effectScreenSize,
  adaptEffect,
  createSessionDecisions,
  staggerDelays,
  createAssetMemory,
  preloadFiles,
  createPreloadQueue,
} from '../../../scripts/engines/playback/adaptive.mjs';

test('frame monitor reports the 75th percentile of the last 3 s', () => {
  const m = createFrameMonitor();
  for (let i = 0; i < 40; i++) m.sample(i < 30 ? 16 : 40, 5000 + i * 16);
  assert.equal(m.typicalMs(), 40);
  assert.equal(m.isTight(16.7), true);
});

test('frame monitor ignores hidden and warm-up samples', () => {
  const m = createFrameMonitor();
  m.warmup(0);
  for (let i = 0; i < 40; i++) m.sample(80, 100 + i); // inside warm-up
  for (let i = 0; i < 40; i++) m.sample(80, 4000 + i, { hidden: true });
  for (let i = 0; i < 40; i++) m.sample(16, 5000 + i * 16);
  assert.equal(m.isTight(16.7), false);
});

test('frame monitor needs 10 samples and drops old ones', () => {
  const m = createFrameMonitor();
  for (let i = 0; i < 9; i++) m.sample(80, 5000 + i);
  assert.equal(m.typicalMs(), null);
  assert.equal(m.isTight(16.7), false);
  for (let i = 0; i < 20; i++) m.sample(80, 5000 + i);
  for (let i = 0; i < 20; i++) m.sample(16, 9000 + i);
  assert.equal(m.typicalMs(), 16);
});

test('effectScreenSize scales size, grid units and token-scaled effects by zoom', () => {
  assert.equal(effectScreenSize({ size: { width: 2, height: 1, gridUnits: true }, scale: { x: 1, y: 1 } }, { gridSize: 100, zoom: 0.5 }), 100);
  assert.equal(effectScreenSize({ scaleToObject: { scale: 1.5 }, source: 'Scene.a.Token.t' }, { gridSize: 100, zoom: 0.2, tokenSize: () => ({ width: 100, height: 100 }) }), 30);
});

test('effectScreenSize returns null when unknown', () => {
  for (const data of [{ stretchTo: {} }, { copySprite: true }, { screenSpace: true }, { moves: {} }, {}])
    assert.equal(effectScreenSize(data, { gridSize: 100, zoom: 1 }), null);
  assert.equal(effectScreenSize({ scaleToObject: { scale: 1 }, source: 'x' }, { gridSize: 100, zoom: 1, tokenSize: () => null }), null);
});

test('adaptEffect keeps untagged and foreign effects', () => {
  const decisions = createSessionDecisions();
  assert.equal(adaptEffect({ moduleName: 'other', animaterTier: 2, name: 's' }, { tight: true, zoom: 0.1, gridSize: 100, decisions }), 'keep');
  assert.equal(adaptEffect({ moduleName: 'animater', name: 's2' }, { tight: true, zoom: 0.1, gridSize: 100, decisions }), 'keep');
  assert.equal(adaptEffect({ moduleName: 'animater', animaterTier: 2, animaterLasting: true, name: 's3' }, { tight: true, zoom: 1, gridSize: 100, decisions }), 'keep');
});

test('tier 0 is never dropped; tiny tier 0-1 lose blur and glow; tiny or tight tier 2 drops', () => {
  const tiny = { moduleName: 'animater', size: { width: 0.2, height: 0.2, gridUnits: true } };
  const decisions = createSessionDecisions();
  assert.equal(adaptEffect({ ...tiny, animaterTier: 0, name: 'a' }, { tight: true, zoom: 1, gridSize: 100, decisions }), 'lighten');
  assert.equal(adaptEffect({ ...tiny, animaterTier: 2, name: 'b' }, { tight: false, zoom: 1, gridSize: 100, decisions }), 'drop');
  assert.equal(adaptEffect({ moduleName: 'animater', animaterTier: 2, name: 'c', size: { width: 3, height: 3, gridUnits: true } }, { tight: true, zoom: 1, gridSize: 100, decisions }), 'drop');
});

test('one decision per animation: later effects follow the first', () => {
  const decisions = createSessionDecisions();
  const opts = (tight) => ({ tight, zoom: 1, gridSize: 100, decisions });
  const big = { moduleName: 'animater', animaterTier: 2, name: 'spell', size: { width: 3, height: 3, gridUnits: true } };
  assert.equal(adaptEffect(big, opts(false)), 'keep');
  assert.equal(adaptEffect(big, opts(true)), 'keep'); // became tight mid-animation: no vanishing
});

test('lod and budget switches turn their rules off', () => {
  const decisions = createSessionDecisions();
  const tiny = { moduleName: 'animater', animaterTier: 2, name: 'x', size: { width: 0.2, height: 0.2, gridUnits: true } };
  assert.equal(adaptEffect(tiny, { tight: false, zoom: 1, gridSize: 100, decisions, lod: false }), 'keep');
  const big = { moduleName: 'animater', animaterTier: 2, name: 'y', size: { width: 3, height: 3, gridUnits: true } };
  assert.equal(adaptEffect(big, { tight: true, zoom: 1, gridSize: 100, decisions, budget: false }), 'keep');
});

test('session decisions are bounded', () => {
  const d = createSessionDecisions(3);
  for (const s of ['a', 'b', 'c', 'd']) d.decide(s, () => ({ s }));
  let recomputed = false;
  d.decide('a', () => (recomputed = true, {}));
  assert.equal(recomputed, true);
});

test('unnamed effects do not share a decision', () => {
  const decisions = createSessionDecisions();
  const opts = { tight: false, zoom: 1, gridSize: 100, decisions };
  const tiny = { moduleName: 'animater', animaterTier: 2, size: { width: 0.2, height: 0.2, gridUnits: true } };
  const big = { moduleName: 'animater', animaterTier: 2, size: { width: 3, height: 3, gridUnits: true } };
  assert.equal(adaptEffect(tiny, opts), 'drop');
  assert.equal(adaptEffect(big, opts), 'keep');
});

test('effectScreenSize is null for a size without dimensions', () => {
  assert.equal(effectScreenSize({ size: {} }, { gridSize: 100, zoom: 1 }), null);
});

test('staggerDelays spreads only copies of one stage, first on time, capped at 50 ms', () => {
  const copies = Array.from({ length: 5 }, () => ({ stageId: 'hit', kind: 'impact' }));
  const ring = { stageId: 'ring', kind: 'impact' };
  const delays = staggerDelays([...copies, ring]);
  assert.deepEqual(copies.map((s) => delays.get(s) ?? 0), [0, 16, 32, 48, 50]);
  assert.equal(delays.has(ring), false);
  assert.equal(staggerDelays(copies.slice(0, 3)).size, 0);
});

test('staggerDelays ignores sounds, motion and optional layers', () => {
  const sounds = Array.from({ length: 5 }, () => ({ stageId: 'hit', kind: 'sound' }));
  const motion = Array.from({ length: 5 }, () => ({ stageId: 'hit', kind: 'motion' }));
  const fx = Array.from({ length: 5 }, () => ({ stageId: 'hit', kind: 'tokenfx' }));
  assert.equal(staggerDelays([...sounds, ...motion, ...fx]).size, 0);
});

test('asset memory keeps the newest 24 per actor', () => {
  const m = createAssetMemory();
  m.remember('A', Array.from({ length: 30 }, (_, i) => ({ asset: `f${i}`, tier: 0 })));
  m.remember('A', [{ asset: 'f5', tier: 1 }]);
  assert.equal(m.recall('A').length, 24);
  assert.deepEqual(m.recall('A').at(-1), { asset: 'f5', tier: 1 });
  m.remember(undefined, [{ asset: 'x', tier: 0 }]);
  assert.deepEqual(m.recall('B'), []);
});

test('preloadFiles puts weapons first, resolves keys, skips cached and unknown', () => {
  const files = preloadFiles({
    weaponAssets: ['jb2a.sword'],
    recentAssets: ['jb2a.fire', 'jb2a.sword', 'missing'],
    toFile: (k) => (k === 'missing' ? null : `${k}.webm`),
    has: (f) => f === 'jb2a.fire.webm',
  });
  assert.deepEqual(files, ['jb2a.sword.webm']);
});

const settle = async (done) => {
  for (let i = 0; i < 200 && !done(); i++) await new Promise((r) => setImmediate(r));
};

test('preload queue loads two at a time and waits while hidden', async () => {
  const batches = [];
  let hidden = true;
  const pauses = [];
  const queue = createPreloadQueue({
    load: async (files) => { batches.push(files); },
    hidden: () => hidden,
    pause: async (ms) => { pauses.push(ms); if (pauses.length === 2) hidden = false; },
  });
  queue.add(['a', 'b', 'c', 'd', 'e']);
  await settle(() => batches.length === 3);
  assert.deepEqual(batches, [['a', 'b'], ['c', 'd'], ['e']]);
  assert.ok(pauses.length >= 2);
  assert.equal(queue.size(), 0);
});

test('a failing preload batch is dropped without throwing', async () => {
  const batches = [];
  const queue = createPreloadQueue({
    load: async (files) => {
      batches.push(files);
      if (batches.length === 1) throw new Error('boom');
    },
    hidden: () => false,
    pause: async () => {},
  });
  queue.add(['a', 'b', 'c']);
  await settle(() => batches.length === 2);
  assert.deepEqual(batches, [['a', 'b'], ['c']]);
});

test('a synchronously throwing load does not escape the queue', async () => {
  let calls = 0;
  const queue = createPreloadQueue({
    load: () => { calls++; throw new Error('sync'); },
    hidden: () => false,
    pause: async () => {},
  });
  queue.add(['a', 'b', 'c']);
  await settle(() => calls === 2);
  assert.equal(calls, 2);
});
