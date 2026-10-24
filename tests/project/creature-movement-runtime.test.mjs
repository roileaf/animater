import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import * as movement from '../../scripts/engines/motion/movement-feel.mjs';
import * as profiles from '../../scripts/engines/motion/movement-profile.mjs';
import { GAITS, creatureGait, creatureBody, creatureFlight } from '../../scripts/engines/motion/creature-gait.mjs';

// Exercise the real Foundry callback with a local sound host: no world documents or audio devices touched.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const tree = parse(main, { ecmaVersion: 'latest', sourceType: 'module' });
const declaration = tree.body.flatMap((n) => n.declarations ?? []).find((n) => n.id.name === 'movementFeel');
const callback = declaration.init.arguments[0].properties.find((p) => p.key.name === 'footstep').value;
function host({ tremorOn = false } = {}) {
  const played = [], timers = [], shapes = [], tremors = [];
  let time = 0;
  const dependencies = {
    ...movement, ...profiles, ID: 'animater', LATE_BEAT_MS: 1000, performance: { now: () => time },
    stepPacer: movement.createStepPacer(), movementSneaking: () => false, movementFeelSettingOn: (key) => key === 'footfallTremor' && tremorOn,
    darker: (...values) => values.filter(Boolean).sort((a, b) => a - b)[0],
    game: { settings: { get: () => 1 }, modules: new Map() }, Hooks: { callAll: (hook, shape) => shapes.push(shape) },
    setTimeout: (fn) => timers.push(fn), cameraShake: { tremor: (step) => tremors.push(step) },
    canvas: { grid: { size: 100 }, dimensions: { distance: 5 }, scene: { id: 'test' },
      sounds: { playAtPosition: (file, where, reach, options) => {
        played.push({ file, options }); return { sourceNode: { playbackRate: { value: 1 } } };
      } } },
  };
  const invoke = new Function(...Object.keys(dependencies), `return (${main.slice(callback.start, callback.end)});`)(...Object.values(dependencies));
  return { invoke, played, timers, shapes, tremors, advance: (ms) => { time += ms; } };
}

test('every classified creature gait has creature audio on every supported floor', () => {
  for (const gait of GAITS.filter((g) => !['boots', 'unknown', 'none'].includes(g))) {
    const family = movement.GAIT_STEP_FILES[gait === 'claws' ? 'paws' : gait];
    for (const floor of Object.keys(movement.FOOTSTEP_FILES)) {
      const pick = movement.gaitStep(gait, floor, 0);
      assert.ok(Object.values(family).flat().includes(pick?.file), `${gait}/${floor}`);
    }
  }
});

test('real runtime callback schedules one tremor for every Huge/Gargantuan audible step', async () => {
  for (const size of ['huge', 'grg']) {
    const h = host({ tremorOn: true });
    for (let n = 0; n < 8; n++) {
      h.invoke('stone', { x: 4100 + n * 10, y: 1000 }, { id: 'giant', width: 400, gait: 'boots', bulk: { size } });
      await new Promise(setImmediate);
      for (const timer of h.timers.splice(0)) timer();
      assert.equal(h.tremors.length, n + 1, `${size} step ${n}`);
      h.advance(1500);
    }
    assert.equal(new Set(h.tremors.map((t) => t.seed)).size, 8, 'one distinct shake per accepted step');
  }
});

test('Riding Horse on the live scene wood floor keeps a clear natural-pitch clop without a giant stomp', async () => {
  const h = host();
  h.invoke('wood', { x: 0, y: 0 }, { id: 'YzDI33Dv6FhhWIXN', width: 200,
    gait: creatureGait({ name: 'Riding Horse' }), bulk: { size: 'lg', heavy: false } });
  await Promise.resolve();
  assert.ok(h.shapes[0].rate >= 0.95 && h.shapes[0].rate <= 1.05, 'recorded horse-size clops retain their attack');
  assert.equal(h.timers.length, 0, 'ordinary riding horses do not add a giant bass stomp');
  assert.equal(h.played.length, 1);
  assert.ok(h.played[0].file.includes('hooves-wood-187610'), 'wooden clop uses its exact surface family');
});

test('contact, weight and tremor are independent layers in real playback', async () => {
  for (const sound of [{ contact: 0, weight: 1, tremor: 1 }, { contact: 1, weight: 0, tremor: 1 }, { contact: 1, weight: 1, tremor: 0 }, { contact: 0, weight: 0, tremor: 1 }]) {
    const h = host({ tremorOn: true });
    h.invoke('stone', { x: 0, y: 0 }, { id: 'giant', width: 400, gait: 'boots', bulk: { size: 'huge' }, sound });
    await new Promise(setImmediate);
    for (const timer of h.timers.splice(0)) timer();
    assert.equal(h.played.some((p) => movement.THUD_FILES.includes(p.file)), sound.weight > 0, JSON.stringify(sound));
    assert.equal(h.played.some((p) => movement.FOOTSTEP_FILES.stone.includes(p.file)), sound.contact > 0, JSON.stringify(sound));
    assert.equal(h.tremors.length, sound.tremor > 0 ? 1 : 0, JSON.stringify(sound));
    if (sound.tremor) assert.equal(h.tremors[0].scale, sound.tremor);
  }
  const silent = host({ tremorOn: true });
  silent.invoke('stone', { x: 0, y: 0 }, { id: 'ghost', gait: 'boots', width: 400, sound: { silent: true } });
  await new Promise(setImmediate);
  assert.equal(silent.played.length, 0); assert.equal(silent.timers.length, 0);
});

test('real playback keeps Stone/Wood hoof files separate and applies Wood shaping to shared creature contacts', () => {
  const stone = host(), wood = host();
  const horse = { id: 'horse', width: 200, gait: 'hooves', bulk: { size: 'lg' } };
  stone.invoke('stone', { x: 0, y: 0 }, horse); wood.invoke('wood', { x: 0, y: 0 }, horse);
  assert.ok(stone.played[0].file.includes('hooves-hard-843303'));
  assert.ok(wood.played[0].file.includes('hooves-wood-187610'));
  const pawStone = host(), pawWood = host();
  const dog = { id: 'dog', width: 100, gait: 'paws' };
  pawStone.invoke('stone', { x: 0, y: 0 }, dog); pawWood.invoke('wood', { x: 0, y: 0 }, dog);
  assert.equal(pawStone.shapes[0].lowpass, undefined);
  assert.equal(pawWood.shapes[0].lowpass, 2800);
  assert.equal(pawWood.shapes[0].bass, 2.5);
  assert.ok(pawWood.played[0].options.volume < pawStone.played[0].options.volume, 'bass shaping retains headroom');
});

test('Grass/Dirt playback uses distinct terrain textures and respects contact mute', async () => {
  for (const [floor, files] of [['grass', movement.BODY_STEP_FILES.foliage], ['dirt', movement.GAIT_STEP_FILES.slither.forest]]) {
    const h = host();
    h.invoke(floor, { x: 0, y: 0 }, { id: 'horse', width: 200, gait: 'hooves', bulk: { size: 'lg' } });
    await new Promise(setImmediate);
    for (const timer of h.timers.splice(0)) timer();
    assert.ok(h.played.some((p) => files.includes(p.file)), floor);
    assert.ok(h.played.every((p) => !movement.FOOTSTEP_FILES[floor].includes(p.file)), 'no human footstep texture');
    const muted = host();
    muted.invoke(floor, { x: 0, y: 0 }, { id: 'horse', width: 200, gait: 'hooves', bulk: { size: 'lg' }, sound: { contact: 0 } });
    await new Promise(setImmediate);
    for (const timer of muted.timers.splice(0)) timer();
    assert.equal(muted.played.length, 0, 'contact mute covers terrain too');
  }
});

test('real runtime callback plays padded/webbed feet and each snake surface family', () => {
  for (const [name, floor, expected] of [
    ['Elephant', 'stone', 'padded-any'], ['Giant Frog', 'stone', 'webbed-any'],
    ['Snake', 'wood', 'slither-hard'], ['Snake', 'water', 'slither-wet'],
    ['Snake', 'snow', 'slither-snow'], ['Snake', 'sand', 'slither-sand'], ['Snake', 'dirt', 'slither-forest'],
  ]) {
    const h = host();
    h.invoke(floor, { x: 0, y: 0 }, { id: name, width: 100, gait: creatureGait({ name }) });
    assert.ok(h.played[0].file.includes(expected), `${name}/${floor}`);
    if (name === 'Snake') assert.equal(h.played.length, 1, 'no shoe layer');
  }
});

test('real runtime callback uses body textures for elemental flight, air passes for magic and wings for birds', () => {
  for (const name of ['Air Elemental', 'Fire Elemental', 'Water Elemental', 'Flying Sword', 'Giant Eagle']) {
    const h = host(), body = creatureBody({ name }), flight = creatureFlight({ name });
    const kind = movement.movementSound('fly', { flight });
    h.invoke('stone', { x: 0, y: 0 }, { id: name, width: 100, gait: creatureGait({ name }), body, flight }, kind);
    assert.equal(h.played.length, 1, `${name}: one flight sound; no floor/body stacking`);
    const expected = body ? movement.BODY_STEP_FILES[body] : movement.MOVE_SOUND_FILES[kind];
    assert.ok(expected.includes(h.played[0].file), name);
    if (body) assert.ok(!movement.MOVE_SOUND_FILES.wing.includes(h.played[0].file));
    assert.equal(h.timers.length, 0, 'no flight thuds or tremors');
  }
});

test('all completed clips are in runtime preload lists and retain verified per-file licenses', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../assets/sounds/creatures/completed/catalog.json', import.meta.url)));
  const preload = new Set([...movement.gaitStepFiles(), ...movement.bodyStepFiles(), ...Object.values(movement.MOVE_SOUND_FILES).flat()]);
  assert.equal(catalog.clips.length, 21);
  for (const clip of catalog.clips) {
    assert.ok(preload.has(`modules/animater/${clip.path}`), clip.file);
    assert.ok(clip.peakDb <= -1 && clip.tail5Db < -30, clip.file);
    assert.match(clip.license, /creativecommons.org\/(publicdomain\/zero\/1.0|licenses\/by\/[34].0)\/$/);
  }
});
