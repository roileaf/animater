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

// The Light Sources module (light-sources) lights a token with a plain ActiveEffect named after the item the GM
// registered ("Lumière"), with no origin and no slug; its flags["light-sources"].light.sourceId is that item's UUID,
// which main.mjs lightIdentity hands over as the origin.
test('a French Light Sources "Lumière" effect is the Light orb; its "Torche" stays a torch', () => {
  const lumiere = { name: 'Lumière', slug: null, sourceId: null, givesLight: true, origin: { slug: 'light', sourceId: null } };
  assert.ok(isOrbEffect(lumiere), 'by the registered spell\'s identifier');
  assert.ok(isOrbEffect({ name: 'Lumière', givesLight: true, origin: { slug: null, sourceId: 'Compendium.dnd5e.spells.Item.Bnn9Nzajixvow9xi' } }), 'by the D&D 5e Light spell (2014)');
  assert.ok(isOrbEffect({ name: 'Lumière', givesLight: true, origin: { slug: null, sourceId: 'Compendium.dnd5e.spells24.Item.phbsplLight00000' } }), 'and 2024');
  assert.equal(orbCount([{ name: 'Lumières dansantes', origin: { sourceId: 'Compendium.dnd5e.spells.Item.CAxSzHWizrafT033' } }]), 4);
  assert.equal(heldLightKind({ effects: [lumiere], fire: true }), 'orb');
  const torche = { name: 'Torche', slug: null, sourceId: null, givesLight: true, origin: { slug: 'torch', sourceId: 'Compendium.dnd5e.items.Item.TorchIdXXXXXXXXX' } };
  assert.ok(!isOrbEffect(torche));
  assert.equal(heldLightKind({ effects: [torche], fire: true }), 'torch', 'a torch light stays a torch');
  // Hide light icons: the orb's effect icon goes; a drawn torch's Light Sources effect icon goes too.
  assert.deepEqual([...drawnLightIcons({ kind: 'orb', orbs: true, items: [{ ...lumiere, type: 'effect', img: 'lumiere.webp', rules: [] }] })], ['lumiere.webp']);
  assert.deepEqual([...drawnLightIcons({ kind: 'torch', torches: true, items: [{ ...torche, type: 'effect', img: 'torche.webp', rules: [] }] })], ['torche.webp']);
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.ok(main.includes('const lightSourcesFlame = (doc) => doc?.flags?.["light-sources"]?.light ?? null;'), 'reads the module\'s own flag');
  assert.ok(main.includes('!(e.disabled && lightSourcesFlame(e))'), 'a covered Light Sources light is no light');
});
