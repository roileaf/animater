import test from 'node:test';
import assert from 'node:assert/strict';
import { BESPOKE } from '../../scripts/catalogs/bespoke/index.mjs';

// Sound poured out as a cone or line has no fitting JB2A footage: these play Tokenshade's waves (the clip only keeps
// time). Sound that does have fitting art keeps it.
const build = (key) => BESPOKE[key].build({ recipe: { id: 'r', stages: [] }, entry: {}, options: {} });
const areas = (key) => build(key).filter((s) => s.kind === 'template');

test('sound poured out as a cone or line with no footage of its own is drawn as Tokenshade waves', () => {
  for (const [key, label] of [['pf2e:r82rqcm0MmGaBFkM', 'Sonic cone'], ['pf2e:AUZPwEorddewm0x1', 'Piercing cone'], ['pf2e:hDvjODvJXdFjZJ81', 'Sonic cone'], ['sf2e:sf2e-feat-actions-Pdam8vyOw6KSQvRe', 'Sonic cone'], ['pf2e:npc-generic:cone-sonic', 'Blast'], ['pf2e:npc-generic:line-sonic', 'Blast']]) {
    const cone = areas(key).find((s) => s.label === label);
    assert.equal(cone?.areaLook, 'tokenshade', `${key} ${label}`);
  }
  // The bellow's cone pulse is one faint disc off to one side (the full audit): it is drawn as waves too.
  assert.equal(areas('dnd5e:dnd5e-monsterfeatures24-mmThunderousBell').find((s) => s.label === 'Bellowing cone').areaLook, 'tokenshade');
  // Round sound rings keep JB2A's soundwaves.
  assert.equal(areas('pf2e:r82rqcm0MmGaBFkM').find((s) => s.label === 'Vibrations').areaLook, undefined);
});
