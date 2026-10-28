import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceWatch, heroPointsOf, glowResources, HERO_GLOW, HERO_GLOW_MS, MYTHIC_GLOW, MYTHIC_GLOW_MS, MYTHIC_SPENT, INSPIRATION_SPENT, INSPIRATION_SPENT_MS } from '../../scripts/systems/hero-points.mjs';
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
  assert.deepEqual(glowResources('daggerheart'), []);
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
