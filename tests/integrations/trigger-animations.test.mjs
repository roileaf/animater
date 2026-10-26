import test from 'node:test';
import assert from 'node:assert/strict';
import { taNames, taAnimates, taEvent, registerTATakeover } from '../../scripts/integrations/trigger-animations.mjs';

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

test('taEvent: the animation-events Trove posts, in Animater terms; checks, chains and missing items are none', () => {
  const sword = { type: 'weapon', slug: 'longsword', uuid: 'Actor.a.Item.s', actor: { id: 'a' } };
  const token = { object: { id: 't' } };
  const attack = taEvent({ name: 'attack:Actor.a.Item.s,attack:longsword', item: sword, sources: [token], targets: new Set([{ id: 'v' }]) }, { systemId: 'pf2e' });
  assert.equal(attack.type, 'attack');
  assert.equal(attack.moment, 'attack');
  assert.equal(attack.item, sword);
  assert.equal(attack.actor, sword.actor);
  assert.deepEqual(attack.source, { id: 't' });
  assert.deepEqual(attack.targets, [{ id: 'v' }]);
  assert.equal(taEvent({ name: 'action:x', item: sword }).type, 'use');
  assert.equal(taEvent({ name: 'condition:frightened', item: { type: 'condition' } }).type, 'effect');
  assert.equal(taEvent({ name: 'attack:Actor.a.Item.s', item: 'Actor.a.Item.s' }, { fromUuid: () => sword }).item, sword, 'a uuid read back');
  assert.equal(taEvent({ name: 'check:demoralize', item: sword }), null);
  assert.equal(taEvent({ name: 'attack:longsword', item: sword, sequence: {} }), null, 'chained from another animation');
  assert.equal(taEvent({ name: 'attack:longsword' }), null);
});

test('registerTATakeover: drops what Animater plays, keeps triggers made for the item, survives Trigger Animations resetting it', () => {
  const played = [];
  const target = { matchTrigger: api('attack:Actor.a.Item.own').matchTrigger, runFromTrigger: (p) => played.push(p.name) };
  let on = true;
  assert.equal(registerTATakeover({ api: () => target, enabled: () => on, resolve: (e) => e.item.slug !== 'dagger', systemId: () => 'pf2e' }), true);
  assert.equal(registerTATakeover({ api: () => target, enabled: () => on, resolve: () => true, systemId: () => 'pf2e' }), false, 'once');
  const run = (slug, uuid = `Actor.a.Item.${slug}`) => target.runFromTrigger({ name: `attack:${uuid},attack:${slug}`, item: { slug, uuid } });
  run('longsword');
  run('dagger');
  run('own');
  target.runFromTrigger({ name: 'check:x', item: { slug: 'x' } });
  assert.deepEqual(played, ['attack:Actor.a.Item.dagger,attack:dagger', 'attack:Actor.a.Item.own,attack:own', 'check:x']);
  // Trigger Animations sets its handler again (enable/disable): it stays behind Animater's.
  const later = [];
  target.runFromTrigger = (p) => later.push(p.name);
  run('longsword');
  run('dagger');
  assert.deepEqual(later, ['attack:Actor.a.Item.dagger,attack:dagger']);
  on = false;
  run('longsword');
  assert.equal(later.length, 2, 'switched off: everything plays');
  assert.equal(registerTATakeover({ api: () => undefined, enabled: () => true, resolve: () => true, systemId: () => 'pf2e' }), false);
});

test('main: a world switch listed with Trigger Animations, wired like the Automated Animations takeover', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /registerSetting\(TA_TAKEOVER, \{\s*name: "Take over from Trigger Animations when Animater has an animation"[\s\S]*?default: false,/);
  assert.match(main, /enabled: \(\) => acceptsEvents\(\) && taTakeover\(\) && !taFillGaps\(\)/);
  assert.match(main, /if \(game\.modules\.get\(TA_ID\)\?\.active && !registerTATakeover\(taTakeoverOptions\)\) Hooks\.once\("triggerAnimations\.ready"/);
});
