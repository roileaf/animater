import test from 'node:test';
import assert from 'node:assert/strict';
import { taNames, taAnimates } from '../../scripts/integrations/trigger-animations.mjs';

// Trigger Animations' matcher: comma-separated names, literal patterns only when asked.
const api = (...patterns) => ({ matchTrigger: (name, { literalOnly } = {}) => {
  const given = name.split(',');
  return patterns.some(p => (!literalOnly || !p.includes('*')) && (p.endsWith('*') ? given.some(g => g.startsWith(p.slice(0, -1))) : given.includes(p))) ? { id: 't' } : undefined;
} });

test('taNames: the moment of the event, by slug, uuid, and for weapons base item and group', () => {
  const sword = { type: 'weapon', slug: 'longsword', uuid: 'Actor.a.Item.s', system: { baseItem: 'longsword', group: 'sword' } };
  assert.deepEqual(taNames({ type: 'attack', item: sword }), ['attack:longsword', 'attack:Actor.a.Item.s', 'attack:sword']);
  assert.deepEqual(taNames({ type: 'effect', item: { type: 'condition', slug: 'frightened' } }), ['condition:frightened']);
  assert.deepEqual(taNames({ type: 'use', skillCheck: true, item: { type: 'action', name: 'Demoralize', slug: 'demoralize' } }), ['check:demoralize']);
  assert.deepEqual(taNames({ type: 'use', item: { type: 'spell', name: 'Fire Ball' } }).slice(0, 2), ['template:fire-ball', 'attack:fire-ball']);
  assert.deepEqual(taNames({ type: 'attack' }), []);
});

test('taAnimates: a trigger naming the item claims it; wildcards and a missing module never do', () => {
  const fireball = { type: 'template', item: { type: 'spell', slug: 'fireball', uuid: 'Actor.a.Item.f' } };
  assert.equal(taAnimates(fireball, api('template:fireball')), true);
  assert.equal(taAnimates(fireball, api('template:Actor.a.Item.f')), true);
  assert.equal(taAnimates(fireball, api('template:*')), false, 'Trove-style wildcard');
  assert.equal(taAnimates(fireball, api('attack:fireball')), false, 'another moment');
  assert.equal(taAnimates(fireball, undefined), false);
  assert.equal(taAnimates(fireball, { matchTrigger: () => { throw Error('x'); } }), false);
});
