import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptiveHost, nextCombatantActor } from '../../../scripts/engines/playback/adaptive-host.mjs';

const freshState = () => ({
  enabled: true, preload: true, stagger: true, lod: true, budget: true,
  stats: { preloaded: 0, staggered: 0, droppedSize: 0, droppedBudget: 0, lightened: 0 },
});

function makeHost({ state = freshState(), quality = 'full', recipes = [], catalog = [] } = {}) {
  const ended = [], preloaded = [];
  const host = createAdaptiveHost({
    state,
    quality: () => quality,
    catalog: () => catalog,
    weaponRecipes: () => recipes,
    preload: async (files) => { preloaded.push(...files); },
    endLocally: (effect) => ended.push(effect),
    sceneId: () => 's',
    hidden: () => false,
    view: () => ({ zoom: 1, gridSize: 100, targetMs: 1000 / 60, tokenSize: () => null }),
  });
  return { host, state, ended, preloaded };
}

const big = { width: 3, height: 3, gridUnits: true };
// Turn preparation is deferred, and the queue rests between batches.
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const combatWith = (actor, sceneId = 's') => ({ nextCombatant: { token: { parent: { id: sceneId } }, actor } });

// Foundry's default 60 fps cap on a display refreshing at `hz` (PIXI Ticker.update's frame gating),
// with `work` ms of main-thread work in every frame that runs.
function runDisplay(host, { hz, work, from = 3000, seconds = 3 }) {
  const vsync = 1000 / hz, min = 1000 / 60;
  let lastFrame = -1, intervals = [], last = null;
  for (let t = from; t < from + seconds * 1000; t += vsync) {
    const delta = (t - lastFrame) | 0;
    if (delta < min) continue;
    lastFrame = t - (delta % min);
    if (last !== null) intervals.push(t - last);
    last = t;
    host.onFrameStart(t);
    host.onFrameEnd(t + work);
  }
  intervals.sort((a, b) => a - b);
  return intervals[Math.floor(0.75 * intervals.length)];
}

test('light work is never tight, whatever the display cadence', () => {
  for (const hz of [30, 60, 75, 90, 144]) {
    const { host, ended } = makeHost();
    host.onCanvasReady(0);
    runDisplay(host, { hz, work: 5 });
    host.onEffect({ data: { moduleName: 'animater', animaterTier: 2, name: `big${hz}`, size: { ...big } } });
    assert.deepEqual(ended, [], `${hz} Hz`);
    assert.equal(host.stats().typicalMs, 5);
  }
  // The frame interval alone would have read 75 Hz and 30 fps as overloaded.
  const { host } = makeHost();
  assert.ok(runDisplay(host, { hz: 75, work: 5 }) > 1.25 * (1000 / 60));
  assert.ok(runDisplay(host, { hz: 30, work: 5 }) > 1.25 * (1000 / 60));
});

test('heavy work at a 60 fps target is tight', () => {
  const { host, ended, state } = makeHost();
  host.onCanvasReady(0);
  runDisplay(host, { hz: 60, work: 15 });
  host.onEffect({ data: { moduleName: 'animater', animaterTier: 2, name: 'heavy', size: { ...big } } });
  assert.equal(ended.length, 1);
  assert.equal(state.stats.droppedBudget, 1);
});

test('frames are not sampled while hidden, warming up or switched off', () => {
  const hiddenHost = createAdaptiveHost({
    state: freshState(), quality: () => 'full', catalog: () => [], weaponRecipes: () => [],
    preload: async () => {}, endLocally: () => {}, sceneId: () => 's', hidden: () => true,
  });
  runDisplay(hiddenHost, { hz: 60, work: 20 });
  assert.equal(hiddenHost.stats().typicalMs, null);
  const warm = makeHost();
  warm.host.onCanvasReady(3000);
  runDisplay(warm.host, { hz: 60, work: 20, seconds: 2.9 });
  assert.equal(warm.host.stats().typicalMs, null);
  const off = makeHost();
  off.state.enabled = false;
  runDisplay(off.host, { hz: 60, work: 20 });
  assert.equal(off.host.stats().typicalMs, null);
});

test('onEffect drops a tier 2 effect when the client ran slow, and only Animater effects', () => {
  const { host, ended, state } = makeHost();
  host.onCanvasReady(0);
  runDisplay(host, { hz: 60, work: 40 });
  const effect = { data: { moduleName: 'animater', animaterTier: 2, name: 's', size: { ...big } } };
  host.onEffect(effect);
  assert.deepEqual(ended, [effect]);
  host.onEffect({ data: { moduleName: 'other', animaterTier: 2, name: 'f', size: { ...big } } });
  assert.equal(ended.length, 1);
  assert.equal(state.stats.droppedBudget, 1);
  assert.equal(state.stats.droppedSize, 0);
  assert.ok(host.stats().typicalMs >= 40);
});

test('onEffect drops a tiny tier 2 effect for size', () => {
  const { host, ended, state } = makeHost();
  host.onEffect({ data: { moduleName: 'animater', animaterTier: 2, name: 'tiny', size: { width: 0.2, height: 0.2, gridUnits: true } } });
  assert.equal(ended.length, 1);
  assert.equal(state.stats.droppedSize, 1);
  assert.equal(state.stats.droppedBudget, 0);
});

test('onEffect strips blur and glow from tiny tier 0', () => {
  const { host, ended, state } = makeHost();
  const data = { moduleName: 'animater', animaterTier: 0, name: 't', size: { width: 0.2, height: 0.2, gridUnits: true }, filters: [{ className: 'Glow' }, { className: 'ColorMatrix' }] };
  host.onEffect({ data });
  assert.deepEqual(data.filters, [{ className: 'ColorMatrix' }]);
  assert.equal(ended.length, 0);
  assert.equal(state.stats.lightened, 1);
});

test('onEffect never adapts the preview and survives odd input', () => {
  const { host, ended } = makeHost();
  host.onEffect({ data: { moduleName: 'animater', animaterTier: 2, animaterPreview: true, name: 'p', size: { width: 0.2, height: 0.2, gridUnits: true } } });
  host.onEffect(null);
  host.onEffect({});
  assert.equal(ended.length, 0);
});

test('switches off: nothing adapts, nothing preloads', async () => {
  const state = freshState();
  state.enabled = false;
  const recipes = [{ stages: [{ kind: 'impact', assets: ['jb2a.a'] }] }];
  const { host, ended, preloaded } = makeHost({ state, recipes, catalog: [{ key: 'jb2a.a', file: 'a.webm' }] });
  host.onEffect({ data: { moduleName: 'animater', animaterTier: 2, name: 'tiny', size: { width: 0.2, height: 0.2, gridUnits: true } } });
  assert.equal(ended.length, 0);
  host.onTurn(combatWith({ id: 'A1' }));
  await settle();
  assert.deepEqual(preloaded, []);
  assert.equal(host.adaptive().stagger, false);
  state.enabled = true;
  state.stagger = false;
  assert.equal(host.adaptive().stagger, false);
  state.stagger = true;
  assert.equal(host.adaptive().stagger, true);
});

test('per-feature switches gate size, budget and preload', async () => {
  const state = freshState();
  state.lod = false;
  state.preload = false;
  const recipes = [{ stages: [{ kind: 'impact', assets: ['jb2a.a'] }] }];
  const { host, ended, preloaded } = makeHost({ state, recipes, catalog: [{ key: 'jb2a.a', file: 'a.webm' }] });
  host.onEffect({ data: { moduleName: 'animater', animaterTier: 2, name: 'tiny', size: { width: 0.2, height: 0.2, gridUnits: true } } });
  assert.equal(ended.length, 0);
  host.onTurn(combatWith({ id: 'A1' }));
  await settle();
  assert.deepEqual(preloaded, []);
});

test('onTurn preloads the next combatant: weapons + recently used, minus tiers above this client quality', async () => {
  const catalog = [
    { key: 'jb2a.sword', file: 'mods/sword.webm' },
    { key: 'jb2a.fire', file: 'mods/fire.webm' },
    { key: 'jb2a.sparkle', file: 'mods/sparkle.webm' },
  ];
  const recipes = [{ stages: [{ kind: 'melee', assets: ['jb2a.sword'] }, { kind: 'sound', assets: ['x.ogg'] }] }];
  const { host, preloaded, state } = makeHost({ quality: 'balanced', recipes, catalog });
  for (const [file, tier] of [['jb2a.fire', 1], ['jb2a.sparkle', 2], ['mods/raw.webm', 0]])
    host.onEffect({ data: { moduleName: 'animater', animaterTier: tier, animaterActor: 'A1', file, name: `s-${file}` } });
  host.onTurn(combatWith({ id: 'A1' }));
  await settle();
  assert.deepEqual(preloaded, ['mods/sword.webm', 'mods/fire.webm', 'mods/raw.webm']);
  assert.equal(state.stats.preloaded, 3);
  // Already warmed this session: not loaded again.
  host.onTurn(combatWith({ id: 'A1' }));
  await settle();
  assert.equal(preloaded.length, 3);
});

test('an effect started by another client is remembered for its actor and warmed on their next turn', async () => {
  const catalog = [{ key: 'jb2a.fire', file: 'mods/fire.webm' }];
  // This client started nothing: the effects arrive through Sequencer's sync.
  const { host, preloaded } = makeHost({ catalog });
  host.onEffect({ data: { moduleName: 'animater', animaterTier: 0, animaterActor: 'A1', file: 'jb2a.fire', name: 'remote' } });
  host.onEffect({ data: { moduleName: 'animater', animaterTier: 0, animaterActor: 'A1', file: 'mods/aura.webm', animaterLasting: true, name: 'aura' } });
  host.onEffect({ data: { moduleName: 'animater', animaterTier: 0, animaterActor: 'A1', file: 'mods/preview.webm', animaterPreview: true, name: 'p' } });
  host.onEffect({ data: { moduleName: 'other', animaterTier: 0, animaterActor: 'A1', file: 'mods/foreign.webm', name: 'f' } });
  host.onEffect({ data: { moduleName: 'animater', animaterActor: 'A1', file: 'mods/untagged.webm', name: 'u' } });
  host.onEffect({ data: { moduleName: 'animater', animaterTier: 0, file: 'mods/no-actor.webm', name: 'n' } });
  host.onTurn(combatWith({ id: 'A1' }));
  await settle();
  assert.deepEqual(preloaded, ['mods/fire.webm']);
});

test('onTurn never throws, and prepares the preload off the combat hook', async () => {
  const warn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args);
  try {
    const throwing = createAdaptiveHost({
      state: freshState(), quality: () => 'full', catalog: () => { throw Error('x'); },
      weaponRecipes: () => { throw Error('y'); }, preload: async () => {}, endLocally: () => {}, sceneId: () => 's',
    });
    assert.doesNotThrow(() => throwing.onTurn(combatWith({ id: 'A1' })));
    assert.doesNotThrow(() => throwing.onTurn(null));
    assert.equal(warned.length, 0);
    await settle();
    assert.equal(warned.length, 1);
  } finally {
    console.warn = warn;
  }
  let resolved = 0;
  const recipes = [{ stages: [{ kind: 'melee', assets: ['jb2a.sword'] }] }];
  const lazy = createAdaptiveHost({
    state: freshState(), quality: () => 'full', catalog: () => [], sceneId: () => 's', hidden: () => false,
    weaponRecipes: () => { resolved++; return recipes; }, preload: async () => {}, endLocally: () => {},
  });
  lazy.onTurn(combatWith({ id: 'A1' }));
  assert.equal(resolved, 0);
  await settle();
  assert.equal(resolved, 1);
});

test('the runtime counts staggered copies through adaptive()', () => {
  const { host, state } = makeHost();
  host.adaptive().staggered(4);
  assert.equal(state.stats.staggered, 4);
});

test('nextCombatantActor returns null safely', () => {
  assert.equal(nextCombatantActor(null, 's'), null);
  assert.equal(nextCombatantActor({ nextCombatant: null }, 's'), null);
  assert.equal(nextCombatantActor({ nextCombatant: { token: { parent: { id: 'other' } }, actor: {} } }, 's'), null);
  assert.equal(nextCombatantActor({ nextCombatant: { token: { parent: { id: 's' } }, actor: null } }, 's'), null);
  const actor = { id: 'A1' };
  assert.equal(nextCombatantActor(combatWith(actor), 's'), actor);
});
