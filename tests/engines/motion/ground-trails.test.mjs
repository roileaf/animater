import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARRY, carryStep, carriedPrints, bleedsBlood, bloodDue, bloodDrop, bloodColor, BLOOD_COLOR, sceneWeather, weatherMarks,
  isCold, createGroundTrails,
} from '../../../scripts/engines/motion/ground-trails.mjs';
import { PARTICLE_KINDS } from '../../../scripts/engines/motion/movement-feel.mjs';

const at = (index) => ({ x: 0, y: 0, heading: 0, index });

test('carry: water, mud and snow are carried for their own number of strides', () => {
  assert.equal(CARRY.water.strides, 6);
  assert.equal(CARRY.mud.strides, 8);
  assert.equal(CARRY.snow.strides, 4);
  for (const floor of ['water', 'mud', 'snow']) {
    let state = carryStep(null, floor).state;
    const strengths = [];
    for (let i = 0; i < 12; i++) {
      const step = carryStep(state, 'stone');
      state = step.state;
      if (step.print) { assert.equal(step.print.floor, floor); strengths.push(step.print.strength); }
    }
    assert.equal(strengths.length, CARRY[floor].strides, floor);
    for (let i = 1; i < strengths.length; i++) assert.ok(strengths[i] < strengths[i - 1], `${floor} fades stride by stride`);
    assert.equal(strengths[0], 1);
    assert.equal(state, null);
  }
});

test('carry: walking in the floor itself prints nothing carried, refreshes the load, and a new floor replaces it', () => {
  let { state, print } = carryStep(null, 'mud');
  assert.equal(print, null);
  state = carryStep(state, 'stone').state;
  state = carryStep(state, 'mud').state;
  assert.equal(state.left, CARRY.mud.strides);
  ({ state, print } = carryStep(state, 'water'));
  assert.equal(print, null);
  assert.equal(state.floor, 'water');
  assert.deepEqual(carryStep(null, 'stone'), { state: null, print: null });
});

test('carriedPrints: each carried floor has its own colour and life, in the gait shape, fainter as it fades', () => {
  const water = carriedPrints({ floor: 'water', strength: 1 }, at(1), { seed: 'a', grid: 100, width: 100, gait: 'boots' });
  const mud = carriedPrints({ floor: 'mud', strength: 1 }, at(1), { seed: 'a', grid: 100, width: 100, gait: 'boots' });
  const snow = carriedPrints({ floor: 'snow', strength: 1 }, at(1), { seed: 'a', grid: 100, width: 100, gait: 'boots' });
  for (const [list, floor] of [[water, 'water'], [mud, 'mud'], [snow, 'snow']]) {
    assert.ok(list.length >= 1, floor);
    for (const p of list) {
      assert.equal(p.kind, 'print');
      assert.equal(p.color, CARRY[floor].color);
      assert.equal(p.life, CARRY[floor].life);
      assert.equal(p.gait, 'boots');
    }
  }
  assert.ok(CARRY.water.life >= 7000 && CARRY.water.life <= 9000);
  assert.ok(CARRY.mud.life >= 11000 && CARRY.mud.life <= 13000);
  assert.ok(CARRY.snow.life >= 4000 && CARRY.snow.life <= 6000);
  assert.notEqual(CARRY.water.color, CARRY.mud.color);
  assert.ok((CARRY.snow.color & 0xff) > 0xe0, 'snow prints are white');
  const faint = carriedPrints({ floor: 'mud', strength: 0.25 }, at(1), { seed: 'a', grid: 100, width: 100, gait: 'boots' });
  assert.ok(faint[0].alpha < mud[0].alpha);
  // A quadruped carries four-footed prints.
  const paws = carriedPrints({ floor: 'mud', strength: 1 }, at(1), { seed: 'a', grid: 100, width: 100, gait: 'paws' });
  assert.equal(paws.length, 2);
  assert.ok(paws.every((p) => p.gait === 'paws'));
});

test('carriedPrints: only gaits that leave prints carry them; grooves, smears, unknown and incorporeal do not', () => {
  for (const gait of ['slither', 'ooze', 'unknown', 'none', 'wheels']) {
    assert.deepEqual(carriedPrints({ floor: 'mud', strength: 1 }, at(1), { grid: 100, width: 100, gait }), [], gait);
  }
  // A dragon's tail drag is not a print.
  const dragon = carriedPrints({ floor: 'mud', strength: 1 }, at(1), { grid: 100, width: 100, gait: 'dragon' });
  assert.ok(dragon.length && dragon.every((p) => p.kind === 'print'));
  assert.deepEqual(carriedPrints(null, at(1), { gait: 'boots' }), []);
});

test('bleedsBlood: living creatures bleed; constructs, elementals, oozes, incorporeal things and objects do not', () => {
  assert.equal(bleedsBlood({ type: 'npc', system: { traits: { value: ['humanoid'] } } }), true);
  assert.equal(bleedsBlood({ type: 'character', system: {} }), true);
  for (const trait of ['construct', 'elemental', 'ooze', 'incorporeal', 'skeleton']) {
    assert.equal(bleedsBlood({ type: 'npc', system: { traits: { value: [trait] } } }), false, trait);
  }
  assert.equal(bleedsBlood({ type: 'npc', system: { details: { type: { value: 'construct' } } } }), false);
  assert.equal(bleedsBlood({ type: 'hazard', system: {} }), false);
  assert.equal(bleedsBlood({ type: 'vehicle', system: {} }), false);
  assert.equal(bleedsBlood(null), false);
});

test('bloodDue: about every third stride, seeded, one drop in each run of three', () => {
  let count = 0;
  for (let i = 0; i < 300; i++) if (bloodDue('tok', i)) count++;
  assert.equal(count, 100);
  for (let b = 0; b < 100; b++) assert.equal([0, 1, 2].filter((k) => bloodDue('tok', b * 3 + k)).length, 1);
  const a = Array.from({ length: 30 }, (_, i) => bloodDue('tok', i)), again = Array.from({ length: 30 }, (_, i) => bloodDue('tok', i));
  assert.deepEqual(a, again);
  const other = Array.from({ length: 30 }, (_, i) => bloodDue('other', i));
  assert.notDeepEqual(a, other);
});

test('bloodDrop: a small dark red splat that lasts about 20 s and counts as lasting', () => {
  const specs = bloodDrop(at(4), { seed: 's', grid: 100, width: 100 });
  assert.ok(specs.length >= 1);
  assert.equal(specs[0].kind, 'blob');
  for (const p of specs) {
    assert.ok(PARTICLE_KINDS.includes(p.kind));
    assert.equal(p.color, BLOOD_COLOR);
    assert.equal(p.life, 20000);
    assert.equal(p.lasting, true);
    assert.ok(p.radius < 10);
  }
  assert.equal(BLOOD_COLOR, 0x7a0d0d);
  assert.deepEqual(bloodDrop(at(4), { seed: 's' }), bloodDrop(at(4), { seed: 's' }));
  assert.equal(bloodDrop(at(4), { seed: 's', color: 0x123456 })[0].color, 0x123456);
});

test('bloodColor: a Splatter colour flag (#rrggbb or #rrggbbaa) or the default', () => {
  assert.equal(bloodColor('#a51414'), 0xa51414);
  assert.equal(bloodColor('#a51414d8'), 0xa51414);
  assert.equal(bloodColor(''), BLOOD_COLOR);
  assert.equal(bloodColor('nonsense'), BLOOD_COLOR);
  assert.equal(bloodColor(undefined), BLOOD_COLOR);
});

test('sceneWeather: Foundry scene weather and FXMaster effects map to rain or snow', () => {
  assert.equal(sceneWeather({ weather: 'rain' }), 'rain');
  assert.equal(sceneWeather({ weather: 'rainStorm' }), 'rain');
  assert.equal(sceneWeather({ weather: 'snow' }), 'snow');
  assert.equal(sceneWeather({ weather: 'blizzard' }), 'snow');
  for (const weather of ['', 'fog', 'leaves', undefined, null]) assert.equal(sceneWeather({ weather }), null, String(weather));
  assert.equal(sceneWeather({ fxmaster: { core_rain: { type: 'rain' } } }), 'rain');
  assert.equal(sceneWeather({ fxmaster: { core_snowstorm: { type: 'snowstorm' } } }), 'snow');
  assert.equal(sceneWeather({ fxmaster: { core_snow: { type: 'snow' } } }), 'snow');
  assert.equal(sceneWeather({ fxmaster: { core_hail: { type: 'hail' } } }), 'rain');
  assert.equal(sceneWeather({ fxmaster: { core_birds: { type: 'birds' } } }), null);
  assert.equal(sceneWeather({ fxmaster: [{ type: 'rain' }] }), 'rain');
  // Snow in FXMaster alongside rain: the snow.
  assert.equal(sceneWeather({ fxmaster: { a: { type: 'rain' }, b: { type: 'snow' } } }), 'snow');
  // The scene's own weather first.
  assert.equal(sceneWeather({ weather: 'rain', fxmaster: { b: { type: 'snow' } } }), 'rain');
  assert.equal(sceneWeather(), null);
});

test('weatherMarks: rain splashes every floor, wets soft-floor prints; snow dusts every floor but water', () => {
  const opts = { seed: 'w', grid: 100, width: 100, gait: 'boots' };
  for (const floor of ['stone', 'wood', 'grass', 'ice', 'water']) {
    const marks = weatherMarks('rain', floor, at(1), opts);
    assert.ok(marks.some((p) => p.kind === 'drop'), floor);
    assert.ok(marks.some((p) => p.kind === 'ring'), floor);
    assert.ok(!marks.some((p) => p.kind === 'print'), `${floor}: no wet print`);
  }
  for (const floor of ['sand', 'mud', 'dirt']) {
    const wet = weatherMarks('rain', floor, at(1), opts).filter((p) => p.kind === 'print');
    assert.ok(wet.length >= 1 && wet.every((p) => p.wet === true), floor);
  }
  // A snake gets its splash but no wet prints.
  assert.ok(!weatherMarks('rain', 'mud', at(1), { ...opts, gait: 'slither' }).some((p) => p.kind === 'print'));
  for (const floor of ['stone', 'grass', 'dirt', 'ice']) {
    const dust = weatherMarks('snow', floor, at(1), opts);
    assert.ok(dust.length >= 1 && dust.every((p) => p.kind === 'puff' && (p.color & 0xff) > 0xe0), floor);
  }
  assert.deepEqual(weatherMarks('snow', 'water', at(1), opts), []);
  assert.deepEqual(weatherMarks(null, 'stone', at(1), opts), []);
  assert.deepEqual(weatherMarks('rain', 'stone', at(1), { ...opts, gait: 'none' }), []);
  for (const p of [...weatherMarks('rain', 'mud', at(1), opts), ...weatherMarks('snow', 'stone', at(1), opts)]) assert.ok(PARTICLE_KINDS.includes(p.kind));
  assert.deepEqual(weatherMarks('rain', 'stone', at(3), opts), weatherMarks('rain', 'stone', at(3), opts));
});

test('isCold: snow weather, a snow or ice floor, or the scene flag; the flag set false wins', () => {
  assert.equal(isCold({ weather: 'snow' }), true);
  assert.equal(isCold({ floor: 'snow' }), true);
  assert.equal(isCold({ floor: 'ice' }), true);
  assert.equal(isCold({ flag: true }), true);
  assert.equal(isCold({ weather: 'rain', floor: 'stone' }), false);
  assert.equal(isCold({ weather: 'snow', flag: false }), false);
  assert.equal(isCold(), false);
});

test('createGroundTrails: carries, bleeds and weathers per token, each behind its own switch', () => {
  let tracked = true, blood = true, weather = null;
  const trails = createGroundTrails({ tracked: () => tracked, blood: () => blood, weather: () => weather });
  const tok = { id: 't', width: 100, gait: 'boots' };
  const opts = { seed: 't', grid: 100, width: 100, gait: 'boots' };
  assert.deepEqual(trails.marks(tok, at(1), 'mud', opts, 'step'), []);
  const out = trails.marks(tok, at(2), 'stone', opts, 'step');
  assert.ok(out.length && out.every((p) => p.kind === 'print' && p.color === CARRY.mud.color));
  // Switched off: nothing carried shows (the load is still counted down).
  tracked = false;
  assert.deepEqual(trails.marks(tok, at(3), 'stone', opts, 'step'), []);
  tracked = true;
  // A burrower drops its load.
  trails.marks(tok, at(4), 'mud', opts, 'burrow');
  assert.deepEqual(trails.marks(tok, at(5), 'stone', opts, 'step'), []);
  // Bleeding: a drop on about one stride in three, only while bleeding.
  const bleeder = { id: 'b', width: 100, gait: 'boots', bleeding: true };
  let drops = 0;
  for (let i = 1; i <= 30; i++) drops += trails.marks(bleeder, at(i), 'stone', { ...opts, seed: 'b' }, 'step').filter((p) => p.kind === 'blob').length;
  assert.equal(drops, 10);
  blood = false;
  for (let i = 31; i <= 60; i++) assert.equal(trails.marks(bleeder, at(i), 'stone', { ...opts, seed: 'b' }, 'step').length, 0);
  // Weather.
  weather = 'rain';
  assert.ok(trails.marks({ id: 'r', width: 100 }, at(1), 'stone', opts, 'step').some((p) => p.kind === 'ring'));
  // A swimmer in the water or a burrower underground: no splash.
  assert.deepEqual(trails.marks({ id: 'r', width: 100 }, at(2), 'water', opts, 'swim'), []);
  assert.deepEqual(trails.marks({ id: 'r', width: 100 }, at(3), 'dirt', opts, 'burrow'), []);
  trails.forget('t');
  trails.clear();
});

test('createMovementFeel with trails: muddy feet print on stone after leaving the mud, only where the token is seen', async () => {
  const { createMovementFeel, STRIDE } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const added = [];
  const layer = {
    addParticle: (spec) => { added.push(spec); return spec; }, updateParticle() {}, removeParticle() {},
    addShadow: () => ({}), updateShadow() {}, removeShadow() {}, clear() {},
  };
  let time = 0;
  const tok = { id: 't', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, gait: 'boots' };
  const feel = createMovementFeel({
    tokens: () => [tok], floorAt: (p) => (p.x < 300 ? 'mud' : 'stone'), enabled: () => true, density: () => 1, grid: () => 100,
    distance: () => 5, now: () => time, layer, trails: createGroundTrails(),
  });
  feel.tick();
  for (let i = 0; i < 20; i++) { tok.x += STRIDE * 100; time += 16; feel.tick(); }
  const carried = added.filter((p) => p.carried === 'mud');
  assert.ok(carried.length >= 4, `carried prints: ${carried.length}`);
  assert.ok(carried.every((p) => p.x >= 300));
  // Unseen: still counted, nothing drawn.
  const before = added.length;
  tok.visible = false; tok.audible = true;
  tok.x = 0; time += 1000; feel.tick();
  for (let i = 0; i < 10; i++) { tok.x += STRIDE * 100; time += 16; feel.tick(); }
  assert.equal(added.length, before);
  feel.clear();
});
