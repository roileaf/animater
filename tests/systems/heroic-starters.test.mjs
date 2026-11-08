import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heroicStarters, heroicRecipe, HERO_GLOW, INSPIRATION_SPENT, HEROIC_STARTER_IDS } from '../../scripts/systems/hero-points.mjs';
import { validateRecipe } from '../../scripts/core/model.mjs';

// Discord (y_deda_povis): Heroic Inspiration as a ready recipe, so it is plain that its look can be changed.
test('D&D 5e gets Heroic Inspiration gained and spent as recipes, looking just like the glow', () => {
  const list = heroicStarters('dnd5e').map((r) => validateRecipe(r));
  assert.deepEqual(list.map((r) => r.heroic), ['inspiration:gained', 'inspiration:spent']);
  assert.equal(list[0].name, 'Heroic Inspiration gained'); assert.equal(list[0].trigger, 'heroic');
  assert.deepEqual(list[0].stages[0].fxLayers.map((l) => l.filterType), HERO_GLOW.params.map((l) => l.filterType));
  assert.equal(list[0].stages[0].fxLayers[0].color, HERO_GLOW.params[0].color);
  assert.deepEqual(list[1].stages[0].fxLayers.map((l) => l.filterType), INSPIRATION_SPENT.params.map((l) => l.filterType));
  for (const r of list) assert.ok(HEROIC_STARTER_IDS.includes(r.id));
});

test('each system its own: PF2e Hero and Mythic Points, nothing where there are none', () => {
  assert.deepEqual(heroicStarters('pf2e').map((r) => r.heroic), ['hero:gained', 'mythic:gained', 'mythic:spent']);
  assert.deepEqual(heroicStarters('daggerheart').map((r) => r.heroic), ['hope:gained', 'hope:spent']);
  assert.deepEqual(heroicStarters('nosuch'), []);
});

test('only this world\'s system gets its starters', async () => {
  globalThis.game = { system: { id: 'dnd5e' } };
  try {
    const { starterRecipes } = await import('../../scripts/core/presets.mjs');
    const heroic = starterRecipes().filter((r) => r.trigger === 'heroic');
    assert.deepEqual(heroic.map((r) => r.heroic), ['inspiration:gained', 'inspiration:spent']);
    assert.equal(heroicRecipe(heroic, 'dnd5e', 'inspiration:spent'), heroic[1]);
  } finally { delete globalThis.game; }
});

test('left as it came, the starter is the glow itself (each screen\'s own switch kept); changed, it plays instead', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /heroicRecipe\(recipes\(\)\.filter\(\(r\) => !untouchedStarterRecipe\(r\)\), game\.system\.id/);
  assert.match(main, /registerSetting\("heroicStartersAdded"/);
});
