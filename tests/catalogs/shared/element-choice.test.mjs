import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEventElement, markElementChoice, offersElementChoice, twoeEventElement, dnd5eEventElement, normalizeElement } from '../../../scripts/catalogs/shared/element-choice.mjs';
import { validateRecipe } from '../../../scripts/core/model.mjs';

const base = () => validateRecipe({ id: 'orb', name: 'Orb', trigger: 'attack', stages: [
  { kind: 'cast', assets: ['jb2a.cast_generic.01.dark_purple'], duration: 600 },
  { kind: 'travel', assets: ['jb2a.spell_projectile.skull.pinkpurple'], duration: 1500 },
  { kind: 'impact', assets: ['jb2a.impact.002.pinkpurple'], duration: 900, elementAssets: { fire: ['jb2a.impact.fire.01.orange'] } },
] });

test('choice text is detected and only energy stages become element-dependent', () => {
  assert.ok(offersElementChoice('Choose acid, cold, fire, lightning, poison, or thunder for the type of orb you create.'));
  assert.ok(offersElementChoice('You exhale energy of a damage type you choose: acid, cold, electricity or fire.'));
  assert.ok(!offersElementChoice('A roaring blast of fire detonates at a spot you designate.'));
  const marked = markElementChoice(base(), 'Choose acid, cold, fire, lightning, poison, or thunder.');
  assert.equal(marked.elementChoice, true);
  assert.deepEqual(marked.stages.map(s => Boolean(s.elementTint)), [false, true, true]);
  // Flags survive validation (saved/customized recipes).
  const again = validateRecipe(marked);
  assert.equal(again.elementChoice, true);
  assert.equal(again.stages[1].elementTint, true);
  assert.deepEqual(again.stages[2].elementAssets, { fire: ['jb2a.impact.fire.01.orange'] });
});
test('chosen element swaps per-element art or tints; unflagged recipes never change', () => {
  const marked = markElementChoice(base(), 'Choose acid, cold, fire, lightning, poison, or thunder.');
  const fire = applyEventElement(marked, 'fire');
  assert.equal(fire.chosenElement, 'fire');
  assert.equal(fire.stages[1].tint, '#ff9a4d');
  assert.deepEqual(fire.stages[2].assets, ['jb2a.impact.fire.01.orange']);
  assert.equal(fire.stages[0].tintEnabled, false);
  const cold = applyEventElement(marked, 'cold');
  assert.equal(cold.stages[2].tint, '#8cdcff');
  const plain = base();
  assert.equal(applyEventElement(plain, 'fire'), plain);
  assert.equal(applyEventElement(marked, 'slashing'), marked);
});
test('element is read from native rolls and selections', () => {
  assert.equal(normalizeElement('Lightning'), 'electricity');
  assert.equal(normalizeElement('necrotic'), 'void');
  assert.equal(twoeEventElement({ flags: { pf2e: { context: { options: ['item:damage:type:cold'] } } } }), 'cold');
  assert.equal(twoeEventElement({ flags: { pf2e: {} }, rolls: [{ instances: [{ type: 'electricity' }] }] }), 'electricity');
  assert.equal(twoeEventElement({ flags: { pf2e: {} }, item: { flags: { pf2e: { rulesSelections: { elementalGift: 'water' } } } } }), 'water');
  assert.equal(twoeEventElement({ flags: { pf2e: {} } }), null);
  assert.equal(dnd5eEventElement({ damage: { parts: [{ types: new Set(['acid', 'fire']) }] } }, [{ options: { type: 'thunder' } }]), 'sonic');
  assert.equal(dnd5eEventElement({ damage: { parts: [{ types: ['fire'] }] } }, []), 'fire');
  assert.equal(dnd5eEventElement({ damage: { parts: [{ types: ['acid', 'fire'] }] } }, []), null);
});
