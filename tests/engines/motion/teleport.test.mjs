import test from "node:test";
import assert from "node:assert/strict";
import { teleportPlan, teleportVisuals, playTeleport, itemRangeFeet, withinReach } from "../../../scripts/engines/motion/teleport.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";

test("known teleport spells teleport by default; a recipe can turn it off or change it", () => {
  assert.deepEqual(teleportPlan({ match: "Misty Step,misty-step" }), { who: "source", range: 30, adjacent: false });
  assert.deepEqual(teleportPlan({ match: "Friendfetch" }), { who: "target", range: 0, adjacent: true });
  assert.equal(teleportPlan({ match: "Fireball,fireball" }), null);
  assert.equal(teleportPlan({ match: "Translocate", teleport: "none" }), null, "off wins");
  assert.deepEqual(teleportPlan({ match: "Fireball", teleport: "source", teleportRange: 60 }), { who: "source", range: 60, adjacent: false });
});

test("ranges come from the spell: PF2e text, D&D value and units", () => {
  assert.equal(itemRangeFeet({ system: { range: { value: "120 feet" } } }), 120);
  assert.equal(itemRangeFeet({ system: { range: { value: "touch" } } }), 5);
  assert.equal(itemRangeFeet({ system: { range: { value: 30, units: "ft" } } }), 30);
  assert.equal(itemRangeFeet({ system: { range: { value: 1, units: "mi" } } }), 5280);
  assert.equal(itemRangeFeet({ system: { range: { units: "self" } } }), null);
});

test("reach counts from the caster's edge to the mover's edge", () => {
  const base = { from: { x: 0, y: 0 }, fromSize: 100, toSize: 100, gridSize: 100, gridDistance: 5 };
  assert.ok(withinReach({ ...base, to: { x: 700, y: 0 }, feet: 30 }), "6 squares away plus both halves");
  assert.ok(!withinReach({ ...base, to: { x: 800, y: 0 }, feet: 30 }));
  assert.ok(withinReach({ ...base, to: { x: 100, y: 100 }, feet: 5 }), "adjacent diagonally");
  assert.ok(withinReach({ ...base, to: { x: 99999, y: 0 }, feet: Infinity }));
});

test("recipes keep their teleport settings", () => {
  const r = validateRecipe({ id: "t", name: "T", trigger: "use", stages: [{ kind: "cast", assets: ["jb2a.misty_step.01.blue"] }], teleport: "target", teleportRange: 45, teleportAdjacent: true });
  assert.deepEqual([r.teleport, r.teleportRange, r.teleportAdjacent], ["target", 45, true]);
  assert.equal(validateRecipe({ id: "t", name: "T", trigger: "use", stages: [{ kind: "cast", assets: ["jb2a.misty_step.01.blue"] }], teleport: "everyone" }).teleport, undefined);
});

test('teleport appearance survives validation and rejects unsafe media', () => {
  const base = { id: 't', name: 'T', trigger: 'use', stages: [{ kind: 'motion', motion: 'pulse' }] };
  const r = validateRecipe({ ...base, teleportOut: 'jb2a.portals.vertical.vortex.purple', teleportIn: 'modules/my-art/arrival.webm', teleportTint: '#aa33ff', teleportScale: 2.5 });
  assert.equal(r.teleportOut, 'jb2a.portals.vertical.vortex.purple');
  assert.equal(r.teleportIn, 'modules/my-art/arrival.webm');
  assert.equal(r.teleportTint, '#aa33ff');
  assert.equal(r.teleportScale, 2.5);
  assert.equal(validateRecipe({ ...base, teleportOut: 'none' }).teleportOut, 'none');
  assert.throws(() => validateRecipe({ ...base, teleportTint: 'purple' }), /Teleport tint/);
  for (const teleportOut of ['https://bad.test/a.webm', '../escape.webm', 'modules/sound.mp3']) {
    assert.throws(() => validateRecipe({ ...base, teleportOut }), /Teleport.*effect/);
  }
});

test('teleport keeps default blue mist, resolves custom art and allows either puff off', () => {
  const catalog = ['jb2a.misty_step.01.blue', 'jb2a.misty_step.02.blue', 'jb2a.teleport.01.yellow'].map(key => ({ key }));
  assert.deepEqual(teleportVisuals({}, catalog), { out: catalog[0].key, in: catalog[1].key, scale: 1.8, tint: '' });
  assert.deepEqual(teleportVisuals({ teleportOut: 'none', teleportIn: 'jb2a.teleport.01.yellow', teleportTint: '#aa33ff', teleportScale: 2 }, catalog), { out: null, in: catalog[2].key, scale: 2, tint: '#aa33ff' });
  assert.equal(teleportVisuals({ teleportOut: 'jb2a.missing' }, catalog).out, null, 'unavailable customization never silently uses blue mist');
});

test('actual teleport playback uses chosen effects around token move, without default puffs', async () => {
  const calls = [], mover = { w: 100, h: 200, center: { x: 50, y: 100 } };
  await playTeleport({ mover, x: 300, y: 400, visuals: { out: 'custom.out', in: 'custom.in', scale: 2, tint: '#aa33ff' } }, {
    wait: async ms => calls.push(['wait', ms]),
    effect: (asset, point, size, tint) => calls.push(['effect', asset, point, size, tint]),
    move: async (token, x, y) => calls.push(['move', token, x, y]),
  });
  assert.deepEqual(calls, [
    ['wait', 450], ['effect', 'custom.out', { x: 50, y: 100 }, 200, '#aa33ff'],
    ['wait', 700], ['move', mover, 300, 400], ['effect', 'custom.in', { x: 350, y: 500 }, 200, '#aa33ff'],
  ]);
  calls.length = 0;
  await playTeleport({ mover, x: 1, y: 2, visuals: { out: null, in: null, scale: 1.8, tint: '' } }, {
    wait: async () => {}, effect: () => assert.fail('disabled puffs should never play'), move: async () => calls.push('moved'),
  });
  assert.deepEqual(calls, ['moved']);
});
