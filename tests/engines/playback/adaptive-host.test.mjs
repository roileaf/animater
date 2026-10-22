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
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const combatWith = (actor, sceneId = 's') => ({ nextCombatant: { token: { parent: { id: sceneId } }, actor } });

test('onEffect drops a tier 2 effect when the client ran slow, and only Animater effects', () => {
  const { host, ended, state } = makeHost();
  host.onCanvasReady(0);
  for (let i = 0; i < 40; i++) host.onTick(40, 3000 + i * 40);
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
  host.rememberAssets('A1', [{ asset: 'jb2a.fire', tier: 1 }, { asset: 'jb2a.sparkle', tier: 2 }, { asset: 'mods/raw.webm', tier: 0 }]);
  host.onTurn(combatWith({ id: 'A1' }));
  await settle();
  assert.deepEqual(preloaded, ['mods/sword.webm', 'mods/fire.webm', 'mods/raw.webm']);
  assert.equal(state.stats.preloaded, 3);
  // Already warmed this session: not loaded again.
  host.onTurn(combatWith({ id: 'A1' }));
  await settle();
  assert.equal(preloaded.length, 3);
});

test('rememberAssets and onTurn never throw', async () => {
  const { host } = makeHost();
  assert.doesNotThrow(() => host.rememberAssets('A1', null));
  const throwing = createAdaptiveHost({
    state: freshState(), quality: () => 'full', catalog: () => { throw Error('x'); },
    weaponRecipes: () => { throw Error('y'); }, preload: async () => {}, endLocally: () => {}, sceneId: () => 's',
  });
  assert.doesNotThrow(() => throwing.onTurn(combatWith({ id: 'A1' })));
  assert.doesNotThrow(() => throwing.onTurn(null));
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
