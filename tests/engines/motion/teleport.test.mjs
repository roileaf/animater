import test from "node:test";
import assert from "node:assert/strict";
import { teleportPlan, teleportVisuals, playTeleport, itemRangeFeet, withinReach, streakToken } from "../../../scripts/engines/motion/teleport.mjs";
import { HEX } from "../../../scripts/engines/playback/color-parity.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";

test("known teleport spells teleport by default; a recipe can turn it off or change it", () => {
  assert.deepEqual(teleportPlan({ match: "Misty Step,misty-step" }), { who: "source", range: 30, adjacent: false, fetch: false });
  assert.deepEqual(teleportPlan({ match: "Friendfetch" }), { who: "target", range: 0, adjacent: false, fetch: true });
  assert.equal(teleportPlan({ match: "Fireball,fireball" }), null);
  assert.equal(teleportPlan({ match: "Translocate", teleport: "none" }), null, "off wins");
  assert.deepEqual(teleportPlan({ match: "Fireball", teleport: "source", teleportRange: 60 }), { who: "source", range: 60, adjacent: false, fetch: false });
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

test('teleport tags its arrival with the trail', async () => {
  const effects = [], mover = { id: 'tok', document: { id: 'tok' }, w: 100, h: 100, center: { x: 50, y: 50 } };
  const host = (out) => ({ wait: async () => {}, move: async () => {}, effect: (asset, point, size, tint, data = null) => out.push([asset, data]) });
  await playTeleport({ mover, x: 400, y: 0, visuals: { out: 'custom.out', in: 'custom.in', scale: 1, tint: '#aa33ff' }, element: 'fire' }, host(effects));
  assert.deepEqual(effects, [
    ['custom.out', { animaterVanish: { tokenId: 'tok', ms: 700 } }],
    ['custom.in', { animaterTrail: { from: { x: 50, y: 50 }, to: { x: 450, y: 50 }, tint: '#aa33ff', tokenId: 'tok' } }],
  ], 'only the arrival carries it, tinted like that effect');
  const tintOf = async (visuals, element) => { const out = []; await playTeleport({ mover, x: 0, y: 0, visuals: { out: null, scale: 1, tint: '', ...visuals }, element }, host(out)); return out[0][1].animaterTrail.tint; };
  assert.equal(await tintOf({ in: 'jb2a.misty_step.02.blue' }, 'fire'), HEX.blue, 'a misty step streaks blue');
  assert.equal(await tintOf({ in: 'modules/art/arrival.webm' }, 'fire'), '#ff9a4d', 'else the spell element');
  assert.equal(await tintOf({ in: 'modules/art/arrival.webm' }), '', 'else the soft white');
});

test('hidden or off-scene mover draws no streak', () => {
  const token = (doc = {}) => ({ mesh: {}, visible: true, document: { hidden: false, ...doc } });
  const scene = (tok) => ({ id: 's1', tokens: new Map(tok ? [['tok', { object: tok }]] : []) });
  const trail = { from: { x: 0, y: 0 }, to: { x: 400, y: 0 }, tint: '', tokenId: 'tok' };
  const shown = token();
  assert.equal(streakToken(trail, { sceneId: 's1', scene: scene(shown) }), shown);
  assert.equal(streakToken(trail, { sceneId: 's2', scene: scene(shown) }), null, 'played on another scene');
  assert.equal(streakToken(trail, { sceneId: 's1', scene: scene() }), null, 'missing token');
  assert.equal(streakToken(trail, { sceneId: 's1', scene: scene(token({ hidden: true })) }), null, 'hidden from players');
  const gmSees = token({ hidden: true });
  assert.equal(streakToken(trail, { sceneId: 's1', scene: scene(gmSees), isGM: true }), gmSees, 'the GM sees hidden tokens');
  assert.equal(streakToken(trail, { sceneId: 's1', scene: scene({ ...token(), visible: false }) }), null, 'out of this screen\'s sight');
  assert.equal(streakToken(null, { sceneId: 's1', scene: scene(shown) }), null);
  assert.equal(streakToken(trail, { sceneId: 's1', scene: null }), null);
});

test('teleport tags out and in with a warp; style none tags nothing', async () => {
  const mover = { id: 'tok', document: { id: 'tok' }, w: 100, h: 100, center: { x: 50, y: 50 } };
  const run = async (visuals, extra = {}) => {
    const effects = [];
    await playTeleport({ mover, x: 400, y: 0, visuals: { scale: 1, tint: '', ...visuals } }, {
      wait: async () => {}, move: async () => {}, gridSize: () => 100, mapDistortion: () => true, ...extra,
      effect: (asset, point, size, tint, data = null) => effects.push([asset, data]),
    });
    return effects;
  };
  const [out, arrival] = await run({ out: 'custom.out', in: 'custom.in' });
  assert.deepEqual(out[1], { animaterVanish: { tokenId: 'tok', ms: 700 }, animaterWarp: { kind: 'warp', at: { x: 50, y: 50 }, radius: 200, startMs: 0, lengthMs: 500, strength: 1, follow: false } },
    'the departure warps at the token, its size plus a square');
  assert.deepEqual(arrival[1].animaterWarp, { kind: 'warp', at: { x: 450, y: 50 }, radius: 200, startMs: 0, lengthMs: 500, strength: 1, follow: false });
  assert.ok(arrival[1].animaterTrail, 'the arrival still carries its streak');
  assert.deepEqual(await run({ out: null, in: null }), [], 'no extra effects: no warp');
  // A token on a level warps on that level only.
  mover.document.level = 'L2';
  const leveled = await run({ out: 'custom.out', in: 'custom.in' });
  assert.deepEqual(leveled.map(([, d]) => d.animaterWarp.level), ['L2', 'L2']);
  delete mover.document.level;
  const off = await run({ out: 'custom.out', in: 'custom.in' }, { mapDistortion: () => false });
  assert.deepEqual(off.map(([, d]) => !!d?.animaterWarp), [false, false], 'the world setting turns it off');
});
