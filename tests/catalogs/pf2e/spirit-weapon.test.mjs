import test from 'node:test';
import assert from 'node:assert/strict';
import { weaponFamily, spiritWeaponFamily, withSpiritWeapon, SPIRIT_WEAPON_FAMILIES } from '../../../scripts/catalogs/pf2e/spells/spirit-weapon.mjs';
import { PF2E_SPELLS, spellRecipe } from '../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import { validateRecipe } from '../../../scripts/core/model.mjs';

const weapon = (system) => ({ type: 'weapon', system: { traits: { value: [] }, equipped: { carryType: 'held' }, ...system } });
const actor = (weapons, deityWeapons) => ({ itemTypes: { weapon: weapons }, ...(deityWeapons ? { deity: { system: { weapons: deityWeapons } } } : {}) });

test('the spirit weapon takes the shape of the weapon the caster holds', () => {
  assert.equal(weaponFamily(weapon({ baseItem: 'warhammer', group: 'hammer' })), 'warhammer');
  assert.equal(weaponFamily(weapon({ baseItem: 'battle-axe', group: 'axe' })), 'greataxe');
  assert.equal(weaponFamily(weapon({ baseItem: 'longspear', group: 'spear' })), 'spear');
  assert.equal(weaponFamily(weapon({ baseItem: 'staff', group: 'club' })), 'quarterstaff');
  assert.equal(weaponFamily(weapon({ group: 'sword', usage: { value: 'held-in-two-hands' } })), 'greatsword', 'an unknown two-handed sword');
  assert.equal(weaponFamily(weapon({ group: 'sword', usage: { value: 'held-in-one-hand' } })), 'longsword');
  assert.equal(weaponFamily(weapon({ group: 'bow' })), null, 'a bow has no spirit melee weapon');
  for (const f of SPIRIT_WEAPON_FAMILIES) assert.match(f, /^[a-z]+$/);
});

test('a held weapon wins, then the deity, then nothing', () => {
  const stowed = weapon({ baseItem: 'spear', equipped: { carryType: 'worn' } });
  assert.equal(spiritWeaponFamily(actor([stowed, weapon({ baseItem: 'scimitar' })])), 'scimitar');
  assert.equal(spiritWeaponFamily(actor([stowed], ['warhammer'])), 'warhammer', 'nothing held: the favored weapon');
  assert.equal(spiritWeaponFamily(actor([weapon({ baseItem: 'longbow', group: 'bow', range: 100 })])), null);
  assert.equal(spiritWeaponFamily(null), null);
});

test('Spiritual Armament flings the caster\'s weapon and leaves it hovering while sustained', () => {
  const recipe = validateRecipe(spellRecipe(PF2E_SPELLS.find((s) => s.slug === 'spiritual-armament')));
  const spirit = recipe.stages.filter((s) => s.spiritWeapon);
  assert.deepEqual(spirit.map((s) => s.kind), ['projectile', 'projectile', 'aura']);
  const hover = spirit.at(-1);
  assert.equal(hover.persist, true);
  assert.equal(hover.sustain, true);
  assert.equal(hover.subject, 'source');
  const axe = withSpiritWeapon(recipe, actor([weapon({ baseItem: 'greataxe', group: 'axe' })]));
  for (const s of axe.stages.filter((x) => x.spiritWeapon)) {
    assert.equal(s.assets[0], 'jb2a.spiritual_weapon.greataxe.01.astral.01.purple');
    assert.ok(s.assets.includes('jb2a.spiritual_weapon.club.01.astral.01.purple'), 'its own art stays as a fallback');
  }
  assert.equal(withSpiritWeapon(recipe, actor([])), recipe, 'no weapon: unchanged');
  const other = validateRecipe(spellRecipe(PF2E_SPELLS.find((s) => s.slug === 'hand-of-the-apprentice')));
  assert.ok(!other.stages.some((s) => s.spiritWeapon || s.sustain), 'Hand of the Apprentice throws a real weapon and stays as it was');
});
