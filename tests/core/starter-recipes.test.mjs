import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starterGivesWay, starterRecipes, starterUnchanged } from '../../scripts/core/presets.mjs';

const nova = () => starterRecipes().find((r) => r.name === 'Fire nova');

test('a starter stays one until you change what it is', () => {
  assert.equal(nova().match, 'fireball');
  assert.ok(starterUnchanged(nova()));
  assert.ok(starterUnchanged({ ...nova(), enabled: false }), 'turned off');
  assert.ok(starterUnchanged({ ...nova(), stages: nova().stages.map((s) => ({ ...s, duration: 1 })) }), 'timing from another version');
  assert.equal(starterUnchanged({ ...nova(), match: 'fire nova' }), false, 'renamed items');
  assert.equal(starterUnchanged({ ...nova(), stages: nova().stages.map((s) => ({ ...s, assets: ['x'] })) }), false, 'other media');
  assert.equal(starterUnchanged({ id: 'mine', name: 'Fire nova' }), false);
});

test('an unchanged starter gives way to the catalog, on or off, and plays only where nothing else would', () => {
  const catalog = { id: 'catalog' }, on = nova(), off = { ...nova(), enabled: false };
  // As the resolvers work: your recipes first, a disabled one blocking the catalog.
  const resolve = (hasEntry) => (list) => { const r = list.find((x) => x.match === 'fireball'); if (r) return r.enabled ? r : null; return hasEntry ? catalog : null; };
  assert.equal(starterGivesWay([on], resolve(true)), catalog, 'Fireball plays Fireball');
  assert.equal(starterGivesWay([off], resolve(true)), catalog, 'turning Fire nova off takes nothing from it');
  assert.equal(starterGivesWay([on], resolve(false)).id, on.id, 'a homebrew fireball with no catalog entry');
  assert.equal(starterGivesWay([off], resolve(false)), null);
  const mine = { ...on, match: 'fireball', name: 'My fireball' };
  assert.equal(starterGivesWay([mine], resolve(true)), mine, 'one you made your own still wins');
  const waiting = { skipReason: 'no target yet' };
  assert.equal(starterGivesWay([on], () => null, waiting), null, 'waiting for targets is not nothing');
});
