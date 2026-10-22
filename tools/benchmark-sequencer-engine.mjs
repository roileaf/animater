// Sequencer's animation engine, original vs Animater's speed-up, on the same workload.
// `node tools/benchmark-sequencer-engine.mjs [--effects=200] [--frames=3000]`
// The original is the verbatim copy in tests/fixtures/sequencer-engine, so both run real engine code.
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { createOriginalEngine } from '../tests/fixtures/sequencer-engine/original-engine.mjs';
import { turboizeEngine } from '../scripts/integrations/sequencer-turbo/engine.mjs';

const arg = (name, fallback) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const EFFECTS = arg('effects', 200), FRAMES = arg('frames', 3000), ROUNDS = arg('rounds', 5);

const ticker = { elapsedMS: 16.7, deltaMS: 16.7, add() {} };
let ids = 0;
globalThis.foundry = { utils: { randomID: () => `id${ids++}` }, canvas: { animation: { CanvasAnimation: { ticker } } } };

// What persistent Sequencer effects typically run: an endless pulse, spin and bob on parts of each effect,
// plus a one-off fade-in. Several attributes write the same property, as Sequencer's stacking does.
function effectTarget(i) {
  return { id: `effect${i}`, alpha: 1, rotation: 0, position: { x: i, y: i }, scale: { x: 1, y: 1 } };
}
function persistentAnimations(target) {
  const loop = (propertyName, values, loopDuration, extra = {}) =>
    ({ target, propertyName, values, loopDuration, duration: loopDuration, looping: true, indefinite: true, pingPong: true, delay: 0, ease: 'easeInOutQuad', ...extra });
  return [
    loop('alpha', [0.6, 1], 1200),
    loop('scale.x', [0.95, 1.05], 900),
    loop('scale.y', [0.95, 1.05], 900),
    loop('rotation', [0, Math.PI * 2], 4000, { pingPong: false, ease: 'linear' }),
    loop('position.y', [-4, 4], 1500),
    { target, propertyName: 'alpha', from: 0, to: 1, duration: 500, delay: 0, ease: 'linear', absolute: true },
  ];
}

function setup(useTurbo) {
  const engine = createOriginalEngine();
  if (useTurbo) turboizeEngine(engine);
  engine.ticker = ticker;
  const targets = Array.from({ length: EFFECTS }, (_, i) => effectTarget(i));
  const t0 = performance.now();
  for (const target of targets) engine.addAnimation(target.id, persistentAnimations(target));
  return { engine, targets, addMs: performance.now() - t0 };
}

const gc = { count: 0, ms: 0 };
new PerformanceObserver((list) => { for (const e of list.getEntries()) { gc.count++; gc.ms += e.duration; } }).observe({ entryTypes: ['gc'] });

async function run(useTurbo) {
  const { engine, targets, addMs } = setup(useTurbo);
  for (let i = 0; i < 300; i++) engine.nextFrame(); // warm up the JIT
  await new Promise((r) => setTimeout(r, 50));
  gc.count = 0; gc.ms = 0;
  const heap0 = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  for (let i = 0; i < FRAMES; i++) engine.nextFrame();
  const ms = performance.now() - t0;
  await new Promise((r) => setTimeout(r, 50)); // let gc entries arrive
  return { frameMs: ms / FRAMES, addMs, gcCount: gc.count, gcMs: gc.ms, heapDeltaMB: (process.memoryUsage().heapUsed - heap0) / 1048576, check: targets[7].alpha + targets[7].scale.x + targets[7].rotation };
}

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const results = { original: [], speedup: [] };
for (let round = 0; round < ROUNDS; round++) {
  results.original.push(await run(false));
  results.speedup.push(await run(true));
}
const summary = Object.fromEntries(Object.entries(results).map(([name, runs]) => [name, {
  'ms per frame': +median(runs.map((r) => r.frameMs)).toFixed(4),
  'GC pauses': median(runs.map((r) => r.gcCount)),
  'GC ms': +median(runs.map((r) => r.gcMs)).toFixed(2),
  'addAnimation ms (all effects)': +median(runs.map((r) => r.addMs)).toFixed(2),
}]));
if (results.original[0].check !== results.speedup[0].check) throw Error('Original and speed-up disagree on the final state');
console.log(`${EFFECTS} persistent effects × 6 animated attributes, ${FRAMES} frames, median of ${ROUNDS} rounds`);
console.table(summary);
const o = summary.original, s = summary.speedup;
console.log(`Frame loop: ${(o['ms per frame'] / s['ms per frame']).toFixed(2)}× faster; addAnimation: ${(o['addAnimation ms (all effects)'] / s['addAnimation ms (all effects)']).toFixed(2)}× faster`);
