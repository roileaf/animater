import test from 'node:test';
import assert from 'node:assert/strict';
import { heroPointWatch, heroPointsOf, HERO_GLOW, HERO_GLOW_MS } from '../../scripts/systems/hero-points.mjs';
import { compileAnimations } from '../../scripts/engines/tokenshade/animation.mjs';

const pc = (value, uuid = 'Actor.a') => ({ uuid, system: { resources: { heroPoints: { value, max: 3 } } } });
const award = { system: { resources: { heroPoints: { value: 2 } } } };

test('a Hero Point awarded glows; spent, unchanged or unrelated changes do not', () => {
  const watch = heroPointWatch();
  watch.seen(pc(1));
  assert.equal(watch.changed(pc(2), award), 1, 'awarded one');
  assert.equal(watch.changed(pc(1), award), 0, 'spent one');
  assert.equal(watch.changed(pc(1), { system: { attributes: { hp: { value: 3 } } } }), 0, 'an HP change');
  assert.equal(watch.changed(pc(3), { 'system.resources.heroPoints.value': 3 }), 2, 'a flat update path counts too');
});

test('a first sighting only remembers the value', () => {
  const watch = heroPointWatch();
  assert.equal(watch.changed(pc(2), award), 0);
  assert.equal(watch.changed(pc(3), award), 1);
});

test('actors are told apart, and actors without Hero Points are ignored', () => {
  const watch = heroPointWatch();
  watch.seen(pc(0, 'Actor.a'));
  watch.seen(pc(2, 'Actor.b'));
  assert.equal(watch.changed(pc(1, 'Actor.a'), award), 1);
  assert.equal(watch.changed(pc(2, 'Actor.b'), award), 0);
  assert.equal(heroPointsOf({ uuid: 'Actor.npc', system: {} }), null);
  assert.equal(watch.changed({ uuid: 'Actor.npc', system: {} }, award), 0);
});

test('the glow swells and fades back to nothing', () => {
  const p = HERO_GLOW.params[0];
  const anim = compileAnimations(p.animated, p);
  const at = (local) => anim.sample({}, { local, world: 0 }).outerStrength;
  assert.equal(at(0), 0);
  assert.ok(at(HERO_GLOW_MS / 4) > 5, 'bright mid-pulse');
  assert.ok(Math.abs(at(HERO_GLOW_MS + 500)) < 1e-9, 'dark once both pulses are done');
});
