import test from 'node:test';
import assert from 'node:assert/strict';
import { isOrbEffect, heldLightKind, orbPose, orbColor, orbMotes, orbCount } from '../../../scripts/engines/motion/light-orb.mjs';

test('a Light spell makes the light an orb; a fire light a torch; the token can choose', () => {
  for (const n of ['Spell Effect: Light', 'Spell Effect: Everlight', 'Light', 'Effect: Dancing Lights', 'Continual Flame']) assert.ok(isOrbEffect(n), n);
  for (const n of ['Spell Effect: Cloak of Light', 'Lightning', 'Draw the Lightning', 'Light Armor']) assert.ok(!isOrbEffect(n), n);
  assert.equal(heldLightKind({ fire: true }), 'torch');
  assert.equal(heldLightKind({ effects: ['Spell Effect: Light'] }), 'orb');
  assert.equal(heldLightKind({ effects: ['Frightened'] }), null, 'any other light stays as Foundry draws it');
  assert.equal(heldLightKind({ choice: 'orb', fire: true }), 'orb');
  assert.equal(heldLightKind({ choice: 'torch' }), 'torch');
  assert.equal(heldLightKind({ choice: 'none', fire: true }), null);
  assert.equal(heldLightKind({ fire: true, held: ['Lantern (Hooded)'] }), 'lantern', 'a held lantern, not a torch, even with a torch-animated light');
  assert.equal(heldLightKind({ held: ['Lantern Archon Plushie?'] , fire: false }), 'lantern');
  assert.equal(heldLightKind({ fire: true, held: ['Longsword'] }), 'torch');
  assert.equal(heldLightKind({ choice: 'lantern' }), 'lantern');
  assert.equal(heldLightKind({ effects: ['Spell Effect: Light'], held: ['Lantern (Hooded)'] }), 'orb', 'a Light spell wins over a lantern in hand');
  assert.equal(heldLightKind({ effects: ['Spell Effect: Light'], fire: true }), 'orb');
  // PF2e: a Torch gives a 'flame' light, a Hooded Lantern a 'torch' one; the lit one decides.
  const torch = { name: 'Torch', light: { animation: 'flame', bright: 20, dim: 40 } }, lantern = { name: 'Lantern (Hooded)', light: { animation: 'torch', bright: 30, dim: 60 } };
  assert.equal(heldLightKind({ fire: true, held: [torch, lantern], light: { animation: 'flame', bright: 20, dim: 40 } }), 'torch', 'a lit torch beside a lantern');
  assert.equal(heldLightKind({ fire: true, held: [torch, lantern], light: { animation: 'torch', bright: 30, dim: 60 } }), 'lantern', 'a lit lantern beside a torch');
  assert.equal(heldLightKind({ fire: true, held: ['Torch', 'Lantern (Hooded)'] }), 'torch', 'no light to match: the torch in hand');
  assert.equal(heldLightKind({ fire: false, held: ['Torch', 'Lantern (Hooded)'] }), 'lantern');
});

test('the orb floats above the shoulder on its side, bobbing; its light hangs still', () => {
  const a = orbPose({ x: 500, y: 500, width: 100, key: 'k' }, 100, 0), b = orbPose({ x: 500, y: 500, width: 100, key: 'k' }, 100, 0.7);
  assert.ok(a.rest.x > 520 && a.rest.y < 480, 'up and to the right');
  assert.deepEqual(a.rest, b.rest);
  assert.notDeepEqual(a.at, b.at, 'it bobs');
  assert.ok(Math.abs(b.at.y - b.rest.y) <= 3.01);
  const left = orbPose({ x: 500, y: 500, width: 100, side: -1 }, 100, 0);
  assert.ok(left.rest.x < 480);
  assert.ok(orbPose({ x: 0, y: 0, width: 800 }, 100).radius <= 18.71, 'a Huge creature\'s orb stays orb-sized');
});

test('colour from the light, warm white without one; motes circle and twinkle', () => {
  assert.equal(orbColor('#e7f3f1'), 0xe7f3f1);
  assert.equal(orbColor(0x3366ff), 0x3366ff);
  assert.equal(orbColor(null), 0xfff1d0);
  const motes = orbMotes('k', 1.2);
  assert.equal(motes.length, 4);
  assert.ok(motes.every((m) => Math.hypot(m.x, m.y) > 0.5 && m.alpha > 0 && m.alpha <= 1));
  assert.notDeepEqual(orbMotes('k', 1.2), orbMotes('k', 2.2), 'they move');
});

test('Dancing Lights: several smaller wisps circling the creature, each on its own part of the ring', () => {
  assert.equal(orbCount(['Spell Effect: Dancing Lights']), 4);
  assert.equal(orbCount(['Spell Effect: Light']), 1);
  const at = (i, t) => orbPose({ x: 500, y: 500, width: 100, key: 'd', wisp: { i, of: 4 } }, 100, t);
  const spread = [0, 1, 2, 3].map((i) => at(i, 1).at);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.ok(Math.hypot(spread[i].x - spread[j].x, spread[i].y - spread[j].y) > 30, 'apart');
  assert.notDeepEqual(at(0, 1).at, at(0, 3).at, 'circling');
  assert.ok(at(0, 1).radius < orbPose({ x: 500, y: 500, width: 100 }, 100).radius, 'smaller than one orb');
  assert.deepEqual(at(0, 1).rest, { x: 500, y: 500 }, 'the light stays at the creature’s middle');
});
