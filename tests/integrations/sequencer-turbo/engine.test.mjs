import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOriginalEngine } from '../../fixtures/sequencer-engine/original-engine.mjs';
import { turboizeEngine, installEngineCapture } from '../../../scripts/integrations/sequencer-turbo/engine.mjs';

// Minimal Foundry globals the engine touches.
const ticker = {
  elapsedMS: 16,
  deltaMS: 16,
  listeners: [],
  add(fn) {
    this.listeners.push(fn);
  },
};
let idCounter = 0;
globalThis.foundry = {
  utils: { randomID: () => `id${idCounter++}` },
  canvas: { animation: { CanvasAnimation: { ticker } } },
};

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTargets() {
  return Array.from({ length: 4 }, (_, i) => ({
    id: `target${i}`,
    alpha: 1,
    rotation: 0,
    position: { x: 100 * i, y: 50 * i },
    scale: { x: 1, y: 1 },
    width: 200,
    _tint: 0,
    setTint(v) {
      this._tint = v;
    },
  }));
}

const PROPS = ['alpha', 'rotation', 'position.x', 'position.y', 'scale.x', 'scale.y', 'width'];
const EASES = ['linear', 'easeInOutQuad', 'easeOutCubic', (x) => x * x];

function randomAttribute(rand, target) {
  const propertyName = PROPS[Math.floor(rand() * PROPS.length)];
  const ease = EASES[Math.floor(rand() * EASES.length)];
  const duration = 50 + Math.floor(rand() * 600);
  const delay = rand() < 0.3 ? Math.floor(rand() * 300) : 0;
  const kind = rand();
  if (kind < 0.4) {
    return {
      target, propertyName, ease, duration, delay,
      from: rand() < 0.3 ? undefined : rand() * 10,
      to: rand() * 10,
      absolute: rand() < 0.4,
    };
  }
  const values = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => rand() * 5);
  return {
    target, propertyName, ease, delay, values,
    looping: true,
    duration: duration * 3,
    loopDuration: duration,
    loops: Math.floor(rand() * 3),
    pingPong: rand() < 0.5,
    indefinite: rand() < 0.25,
    absolute: rand() < 0.3,
  };
}

function snapshot(targets) {
  return targets.map((t) => ({
    alpha: t.alpha, rotation: t.rotation, x: t.position.x, y: t.position.y,
    sx: t.scale.x, sy: t.scale.y, width: t.width, tint: t._tint,
  }));
}

async function runScenario(seed, useTurbo) {
  const rand = mulberry32(seed);
  const engine = createOriginalEngine();
  if (useTurbo) turboizeEngine(engine);
  engine.ticker = ticker;
  const targets = makeTargets();
  const frames = [];
  let resolved = 0;

  for (let frame = 0; frame < 240; frame++) {
    if (rand() < 0.15) {
      const target = targets[Math.floor(rand() * targets.length)];
      const attrs = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => randomAttribute(rand, target));
      if (rand() < 0.1) attrs.push({ target, propertyName: 'setTint', from: 0, to: 9, duration: 120, delay: 0 });
      const timeDifference = rand() < 0.2 ? Math.floor(rand() * 200) : 0;
      engine.addAnimation(target.id, attrs, timeDifference).then(() => resolved++);
    }
    if (rand() < 0.02) engine.endAnimations(targets[Math.floor(rand() * targets.length)].id);
    ticker.elapsedMS = ticker.deltaMS = 8 + Math.floor(rand() * 25);
    engine.nextFrame();
    await Promise.resolve();
    frames.push({ state: snapshot(targets), remaining: engine._animations.length, resolved });
  }
  return frames;
}

test('turbo engine matches the original frame-for-frame', async () => {
  for (let seed = 1; seed <= 60; seed++) {
    const original = await runScenario(seed, false);
    const turbo = await runScenario(seed, true);
    assert.deepEqual(turbo, original, `scenario ${seed} diverged`);
    assert.notDeepEqual(original.at(-1).state, original[0].state, `scenario ${seed} never animated`);
    assert.ok(original.at(-1).resolved > 0, `scenario ${seed} never resolved`);
  }
});

test('disabling turbo delegates to the original methods', async () => {
  const state = { enabled: false };
  const engine = createOriginalEngine();
  turboizeEngine(engine, state);
  engine.ticker = ticker;
  const target = makeTargets()[0];
  engine.addAnimation(target.id, { target, propertyName: 'alpha', from: 0, to: 1, duration: 100, delay: 0, absolute: true });
  assert.equal(engine._animations[0].attributes[0]._turboPath, undefined);
  ticker.elapsedMS = ticker.deltaMS = 50;
  engine.nextFrame();
  assert.equal(target.alpha, 0.5);
});

test('bind capture swaps in the turbo frame function once', () => {
  const engine = createOriginalEngine();
  let captured = null;
  installEngineCapture({ enabled: true }, (e) => (captured = e));
  ticker.listeners.length = 0;
  engine.start();
  assert.equal(captured, engine);
  assert.equal(typeof engine.__turbo, 'object');
  assert.equal(ticker.listeners.length, 1);
  assert.equal(ticker.listeners[0].name, 'bound nextFrame');
  // Hook removed itself: unrelated binds are native again.
  assert.equal(Function.prototype.bind.name, 'bind');
  assert.match(Function.prototype.bind.toString(), /native code/);
});
