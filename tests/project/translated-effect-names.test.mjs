// A translated world (Babele, e.g. French PF2e) renames compendium items and effects but keeps their English slug and
// compendium source. Animater must know them by those, not by the English display name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bodyTreatment } from '../../scripts/engines/motion/condition-body.mjs';
import { isLastingArea } from '../../scripts/engines/playback/lasting-area.mjs';
import { isOrbEffect, heldLightKind, orbCount, drawnLightIcons } from '../../scripts/engines/motion/light-orb.mjs';

const lumiere = { name: 'Effet de sort : Lumière', slug: 'spell-effect-light', sourceId: 'Compendium.pf2e.spell-effects.Item.cVVZXNbV0nElVOPZ', origin: null };

test('a translated Spell Effect: Light is still the Light orb (slug, compendium source or origin spell)', () => {
  assert.ok(isOrbEffect(lumiere));
  assert.ok(isOrbEffect({ name: 'Lumière', slug: 'spell-effect-light' }), 'by slug');
  assert.ok(isOrbEffect({ name: 'Lumière', sourceId: 'Compendium.pf2e.spell-effects.Item.cVVZXNbV0nElVOPZ' }), 'by compendium source');
  assert.ok(isOrbEffect({ name: 'Lumière éternelle', sourceId: 'Compendium.sf2e.spell-effects.Item.hpbCDbDOoVyhOmck' }), 'Everlight, SF2e');
  assert.ok(isOrbEffect({ name: 'Lumière', origin: { slug: 'light' } }), 'by the spell it came from');
  assert.ok(isOrbEffect({ name: 'Lumière', slug: 'light' }), 'D&D identifier');
  assert.ok(!isOrbEffect({ name: 'Lumière' }), 'a translated name alone is not English');
  assert.ok(!isOrbEffect({ name: 'Effet : Manteau de lumière', slug: 'spell-effect-cloak-of-light' }));
  assert.ok(isOrbEffect({ name: 'Spell Effect: Light', slug: null }), 'the English name is still the fallback');
  assert.ok(isOrbEffect('Spell Effect: Light'), 'a bare name still works');
});

test('the translated Light effect makes the light an orb and hides its icon', () => {
  assert.equal(heldLightKind({ effects: [lumiere], fire: true }), 'orb');
  const icons = drawnLightIcons({ kind: 'orb', orbs: true, items: [{ ...lumiere, type: 'effect', img: 'systems/pf2e/icons/spells/light.webp', rules: [] }] });
  assert.deepEqual([...icons], ['systems/pf2e/icons/spells/light.webp']);
  assert.equal(orbCount([{ name: 'Lumières dansantes', slug: 'spell-effect-dancing-lights' }]), 4);
  assert.equal(orbCount([lumiere]), 1);
});

test('a translated torch or lantern in hand is known by its slug', () => {
  assert.equal(heldLightKind({ fire: true, held: [{ name: 'Lanterne (à capote)', slug: 'lantern-hooded' }] }), 'lantern');
  assert.equal(heldLightKind({ fire: true, held: [{ name: 'Torche', slug: 'torch' }, { name: 'Épée longue', slug: 'longsword' }] }), 'torch');
  const torch = { name: 'Torche', slug: 'torch', light: { animation: 'flame', bright: 20, dim: 40 } }, lantern = { name: 'Lanterne', slug: 'lantern-hooded', light: { animation: 'torch', bright: 30, dim: 60 } };
  assert.equal(heldLightKind({ fire: true, held: [torch, lantern], light: { animation: 'torch', bright: 30, dim: 60 } }), 'lantern');
});

test('main.mjs hands the light-orb engine identities (slug, source, origin), not bare names', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.ok(main.includes('const lightIdentity = (doc) =>'));
  assert.ok(main.includes('isOrbEffect(lightIdentity(item))'), 'the state look yields to the orb by identity');
  assert.ok(!main.includes('isOrbEffect(item?.name)'));
  assert.ok(main.includes('const effects = actorLightEffects(actor);'));
});

test('a translated condition still moves the body: PF2e slug, D&D status ids, then the name', () => {
  assert.equal(bodyTreatment({ name: 'Effrayé', system: { slug: 'frightened' } }), 'tremble');
  assert.equal(bodyTreatment({ name: 'Agrippé', system: { slug: 'grabbed' } }), 'struggle');
  assert.equal(bodyTreatment({ name: 'À terre', statuses: new Set(['prone']) }), 'prone');
  assert.equal(bodyTreatment({ name: 'Frightened 2' }), 'tremble', 'the English name is still the fallback');
  assert.equal(bodyTreatment({ name: 'Effrayé' }), null);
  assert.equal(bodyTreatment('Prone'), 'prone', 'a bare name still works');
  const states = readFileSync(new URL('../../scripts/engines/playback/persistent-states.mjs', import.meta.url), 'utf8');
  assert.ok(states.includes('bodyTreatment(r.item)??bodyTreatment(r.recipe.name)'), 'the lasting look hands over the condition itself');
});

test('a translated standing area spell still stays on the map, by its English slug', () => {
  const spell = (name, slug, extra = {}) => ({ type: 'spell', name, system: { slug, duration: { value: '1 minute' }, description: { value: '' }, ...extra } });
  assert.ok(isLastingArea(spell('Mur de feu', 'wall-of-fire')));
  assert.ok(isLastingArea(spell('Brouillard', 'obscuring-mist')));
  assert.ok(!isLastingArea(spell('Mur de pierre', 'wall-of-stone')), 'reshaped terrain stays plain map');
  assert.ok(!isLastingArea(spell('Explosion de tempête', 'storm-blast')), 'a blast plays once');
  assert.ok(!isLastingArea(spell('Brouillard', null)), 'a translated name alone says nothing');
  assert.ok(isLastingArea(spell('Obscuring Mist', null)), 'the English name is still read');
});
