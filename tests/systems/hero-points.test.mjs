import test from 'node:test';
import assert from 'node:assert/strict';
import { heroicChoiceOf, heroicChoices, heroicRecipe, resourceWatch, heroPointsOf, glowResources, HERO_GLOW, HERO_GLOW_MS, MYTHIC_GLOW, MYTHIC_GLOW_MS, MYTHIC_SPENT, INSPIRATION_SPENT, INSPIRATION_SPENT_MS } from '../../scripts/systems/hero-points.mjs';
import { compileAnimations } from '../../scripts/engines/tokenshade/animation.mjs';

const pc = (hero, uuid = 'Actor.a', mythic = 0) => ({ uuid, system: { resources: { heroPoints: { value: hero, max: 3 }, mythicPoints: { value: mythic, max: 3 } } } });
const award = { system: { resources: { heroPoints: { value: 2 } } } };
const mythicChange = { system: { resources: { mythicPoints: { value: 1 } } } };
const hero5e = (inspiration, uuid = 'Actor.d') => ({ uuid, system: { attributes: { inspiration } } });
const toggle = { 'system.attributes.inspiration': true };
const looks = (events) => events.map((e) => `${e.resource.id}:${e.look}:${e.by}`);

test('a Hero Point awarded glows; spent, unchanged or unrelated changes do not', () => {
  const watch = resourceWatch('pf2e');
  watch.seen(pc(1));
  assert.deepEqual(looks(watch.changed(pc(2), award)), ['hero:gained:1'], 'awarded one');
  assert.deepEqual(watch.changed(pc(1), award), [], 'spent one: the reroll plays instead');
  assert.deepEqual(watch.changed(pc(1), { system: { attributes: { hp: { value: 3 } } } }), [], 'an HP change');
  assert.deepEqual(looks(watch.changed(pc(3), { 'system.resources.heroPoints.value': 3 })), ['hero:gained:2'], 'a flat update path counts too');
});

test('SF2e has Hero Points but no Mythic Points', () => {
  assert.deepEqual(glowResources('sf2e').map((r) => r.id), ['hero']);
  assert.deepEqual(glowResources('pf2e').map((r) => r.id), ['hero', 'mythic']);
  assert.deepEqual(glowResources('dnd5e').map((r) => r.id), ['inspiration']);
  assert.deepEqual(glowResources('daggerheart').map((r) => r.id), ['hope']);
  assert.deepEqual(glowResources('draw-steel').map((r) => r.id), ['victory']);
  assert.deepEqual(glowResources('crucible'), []);
});

test('a Mythic Point gained pulses and one spent flares', () => {
  const watch = resourceWatch('pf2e');
  watch.seen(pc(1, 'Actor.a', 1));
  assert.deepEqual(looks(watch.changed(pc(1, 'Actor.a', 3), mythicChange)), ['mythic:gained:2']);
  const [spent] = watch.changed(pc(1, 'Actor.a', 2), mythicChange);
  assert.equal(spent.look, 'spent');
  assert.equal(spent.resource.spent[0], MYTHIC_SPENT);
  assert.equal(spent.resource.gained[0], MYTHIC_GLOW);
});

test('D&D 5e Heroic Inspiration received glows and spent flares', () => {
  const watch = resourceWatch('dnd5e');
  watch.seen(hero5e(false));
  const [got] = watch.changed(hero5e(true), toggle);
  assert.equal(got.look, 'gained');
  assert.equal(got.resource.gained[0], HERO_GLOW);
  const [used] = watch.changed(hero5e(false), { system: { attributes: { inspiration: false } } });
  assert.equal(used.look, 'spent');
  assert.equal(used.resource.spent[0], INSPIRATION_SPENT);
  assert.deepEqual(watch.changed(hero5e(false), { system: { attributes: { hp: { value: 1 } } } }), [], 'unrelated');
});

test('a first sighting only remembers the value; actors are told apart', () => {
  const watch = resourceWatch('pf2e');
  assert.deepEqual(watch.changed(pc(2), award), []);
  assert.equal(watch.changed(pc(3), award).length, 1);
  watch.seen(pc(2, 'Actor.b'));
  assert.deepEqual(watch.changed(pc(2, 'Actor.b'), award), []);
  assert.equal(heroPointsOf({ uuid: 'Actor.npc', system: {} }), null);
  assert.deepEqual(watch.changed({ uuid: 'Actor.npc', system: {} }, award), []);
});

const sample = (preset, i, param, local) => {
  const p = preset.params[i];
  return compileAnimations(p.animated, p).sample({}, { local, world: 0 })[param];
};
test('each look swells from nothing and ends dark', () => {
  for (const [preset, ms] of [[HERO_GLOW, HERO_GLOW_MS], [MYTHIC_GLOW, MYTHIC_GLOW_MS], [MYTHIC_SPENT, 1000], [INSPIRATION_SPENT, INSPIRATION_SPENT_MS]]) {
    assert.ok(Math.abs(sample(preset, 0, 'outerStrength', 0)) < 1e-9, `${preset.name} starts dark`);
    assert.ok(Math.max(...[0.1, 0.25, 0.5].map((f) => sample(preset, 0, 'outerStrength', ms * f))) > 5, `${preset.name} glows`);
    assert.ok(Math.abs(sample(preset, 0, 'outerStrength', ms + 500)) < 1e-9, `${preset.name} ends dark`);
  }
  assert.ok(Math.abs(sample(INSPIRATION_SPENT, 1, 'brightness', INSPIRATION_SPENT_MS + 500) - 1) < 1e-9, 'the flare leaves the art as it was');
});

test('Hope and Victories are read from each system\'s own fields', () => {
  const hope = glowResources('daggerheart')[0], victory = glowResources('draw-steel')[0];
  assert.equal(hope.read({ system: { resources: { hope: { value: 3 } } } }), 3);
  assert.equal(hope.changed({ 'system.resources.hope.value': 2 }), true);
  assert.equal(hope.changed({ system: { resources: { hope: { value: 2 } } } }), true);
  assert.equal(victory.read({ system: { hero: { victories: 2 } } }), 2);
  assert.equal(victory.changed({ system: { hero: { victories: 3 } } }), true);
  assert.equal(victory.spent, undefined, 'Victories are not spent');
});

test('the recipe trigger offers what each system has', () => {
  assert.deepEqual(heroicChoices('pf2e'), { 'hero:gained': 'Hero Point gained', 'mythic:gained': 'Mythic Point gained', 'mythic:spent': 'Mythic Point spent' });
  assert.deepEqual(heroicChoices('dnd5e'), { 'inspiration:gained': 'Heroic Inspiration gained', 'inspiration:spent': 'Heroic Inspiration spent' });
  assert.deepEqual(heroicChoices('draw-steel'), { 'victory:gained': 'Victory gained' });
  assert.deepEqual(heroicChoices('crucible'), {});
});

test('a heroic recipe is found for its moment; one left unset means the first on the list', () => {
  const on = { id: 'a', trigger: 'heroic', enabled: true, heroic: 'mythic:spent' }, unset = { id: 'b', trigger: 'heroic', enabled: true }, off = { id: 'c', trigger: 'heroic', enabled: false, heroic: 'hero:gained' };
  assert.equal(heroicRecipe([on], 'pf2e', 'mythic:spent'), on);
  assert.equal(heroicRecipe([on], 'pf2e', 'hero:gained'), null);
  assert.equal(heroicRecipe([off, unset], 'pf2e', 'hero:gained'), unset, 'a disabled one is passed over');
  assert.equal(heroicRecipe([{ id: 'd', trigger: 'use' }], 'pf2e', 'hero:gained'), null);
  assert.equal(heroicChoiceOf({ heroic: 'hope:gained' }, 'dnd5e'), 'inspiration:gained', 'from another system: the first here');
  assert.equal(heroicChoiceOf({}, 'crucible'), null);
});
