import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe } from '../../scripts/core/model.mjs';
import { withBodyLooks } from '../../scripts/catalogs/shared/catalog-fx.mjs';

// A stage marked with a body look (the skin turning to stone, chains binding a creature) becomes that Tokenshade look
// on the same creature, at the same time, where Tokenshade can play it; elsewhere its JB2A clip plays as before.
const recipe = () => validateRecipe({ id: 'r', name: 'Stoneskin', trigger: 'use', stages: [
  { kind: 'cast', stageId: 'c', assets: ['jb2a.shimmer.01.blue'], duration: 900 },
  { kind: 'aura', stageId: 'skin', label: 'Skin turns to stone', assets: ['jb2a.shield.01.complete.01.white'], subject: 'targets', afterStage: 'c', timingAnchor: 'start', startOffset: 300, duration: 2000, tintEnabled: true, tint: '#a09080', bodyLook: 'Petrified' },
  { kind: 'impact', stageId: 'bind', label: 'Chains wrap the target', assets: ['jb2a.markers.chain.standard.complete.02.grey'], duration: 1500, bodyLook: 'Chained' },
] });
const catalog = (names) => ({ tokenReady: true, presets: names.map((name) => ({ name, library: 'tokenshade' })) });

test('a marked stage becomes its Tokenshade body look on the same creature, at the same time', () => {
  const out = withBodyLooks(recipe(), catalog(['Petrified', 'Chained']));
  const skin = out.stages.find((s) => s.stageId === 'skin');
  assert.equal(skin.kind, 'tokenfx');
  assert.equal(skin.fxPreset, 'Petrified');assert.equal(skin.fxLibrary, 'tokenshade');
  assert.equal(skin.subject, 'targets');
  assert.deepEqual([skin.afterStage, skin.timingAnchor, skin.startOffset, skin.duration], ['c', 'start', 300, 2000]);
  assert.equal(skin.optionalTargets, true, 'a missing target skips it, as the clip did');
  const bind = out.stages.find((s) => s.stageId === 'bind');
  assert.equal(bind.kind, 'tokenfx');assert.equal(bind.subject, 'targets', 'an impact lands on its target');
  assert.equal(out.stages.find((s) => s.stageId === 'c').kind, 'cast', 'unmarked stages stay');
});

test('a tinted body look keeps its colour (a golden glow stays golden)', () => {
  const r = validateRecipe({ id: 'g', name: 'g', trigger: 'use', stages: [{ kind: 'aura', stageId: 'v', assets: ['jb2a.shimmer.01.blue'], duration: 1500, subject: 'targets', tintEnabled: true, tint: '#ffe9a8', bodyLook: 'glow' }] });
  assert.equal(withBodyLooks(r, catalog(['glow'])).stages[0].fxTint, '#ffe9a8');
  // A material brings its own colours: the old clip's tint is not laid over stone.
  assert.equal(withBodyLooks(recipe(), catalog(['Petrified'])).stages.find((s) => s.stageId === 'skin').fxTint, '');
});

test('without Tokenshade, or without that preset, the JB2A clip plays as before', () => {
  assert.equal(withBodyLooks(recipe(), { tokenReady: false, presets: [] }).stages.find((s) => s.stageId === 'skin').kind, 'aura');
  const partial = withBodyLooks(recipe(), catalog(['Chained']));
  assert.equal(partial.stages.find((s) => s.stageId === 'skin').kind, 'aura');
  assert.equal(partial.stages.find((s) => s.stageId === 'bind').kind, 'tokenfx');
});

test('every body look offered is a Tokenshade token preset (not a region look that never reaches a creature)', async () => {
  const { BODY_LOOKS } = await import('../../scripts/core/stage-options.mjs');
  const { PRESETS } = await import('../../scripts/engines/tokenshade/presets.mjs');
  for (const name of Object.keys(BODY_LOOKS).filter(Boolean)) assert.ok(PRESETS.some((p) => p.name === name && p.library === 'tokenshade'), name);
});

test('the mark survives validation and is absent when unset', () => {
  assert.equal(recipe().stages.find((s) => s.stageId === 'skin').bodyLook, 'Petrified');
  assert.equal('bodyLook' in recipe().stages.find((s) => s.stageId === 'c'), false);
});
