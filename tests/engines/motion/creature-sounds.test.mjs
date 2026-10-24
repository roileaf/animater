import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BODIES, creatureBody } from '../../../scripts/engines/motion/creature-gait.mjs';
import {
  GAIT_STEP_FILES, MIN_FAMILY_FILES, BODY_STEP_FILES, BODY_PEAK_MS, gaitStep, gaitStepFiles, bodyStep, bodyStepFiles, footstepFile, FOOTSTEP_FILES,
} from '../../../scripts/engines/motion/movement-feel.mjs';

const pf2 = (traits, name = '', type = 'npc') => ({ system: 'pf2e', actor: { type, name, system: { traits: { value: traits } } }, name });
const dnd = (value, name = '', subtype = '') => ({ system: 'dnd5e', actor: { type: 'npc', name, system: { details: { type: { value, subtype } } } }, name });

test('creatureBody: PF2e traits', () => {
  assert.equal(creatureBody(pf2(['undead', 'mindless', 'skeleton'], 'Guard')), 'bone');
  assert.equal(creatureBody(pf2(['elemental', 'water'], 'Living Tide')), 'water');
  assert.equal(creatureBody(pf2(['elemental', 'fire'], 'Cinder Rat')), 'fire');
  assert.equal(creatureBody(pf2(['elemental', 'air'], 'Zephyr')), 'air');
  assert.equal(creatureBody(pf2(['elemental', 'earth'], 'Sod Hound')), 'stone');
  assert.equal(creatureBody(pf2(['construct', 'clockwork'], 'Spy')), 'metal');
  assert.equal(creatureBody(pf2(['construct', 'mindless'], 'Iron Golem')), 'metal');
  assert.equal(creatureBody(pf2(['construct', 'mindless'], 'Stone Golem')), 'stone');
  assert.equal(creatureBody(pf2(['construct'], 'Animated Armor')), 'metal');
  assert.equal(creatureBody(pf2(['construct'], 'Animated Broom')), null, 'a construct of no stated material');
  assert.equal(creatureBody(pf2(['plant'], 'Arboreal Warden')), 'plant');
  assert.equal(creatureBody(pf2(['leshy', 'plant'], 'Gourd Leshy')), 'plant');
  assert.equal(creatureBody(pf2(['fungus', 'plant'], 'Myconid Sovereign')), null, 'fungi do not rustle');
  assert.equal(creatureBody(pf2(['humanoid', 'human'], 'Guard')), null);
  assert.equal(creatureBody(pf2(['undead', 'zombie'], 'Zombie Shambler')), null, 'flesh undead have no bone body');
});

test('creatureBody: D&D 5e types and names', () => {
  assert.equal(creatureBody(dnd('undead', 'Skeleton')), 'bone');
  assert.equal(creatureBody(dnd('undead', 'Minotaur Skeleton')), 'bone');
  assert.equal(creatureBody(dnd('elemental', 'Water Elemental')), 'water');
  assert.equal(creatureBody(dnd('elemental', 'Water Weird')), 'water');
  assert.equal(creatureBody(dnd('elemental', 'Fire Elemental')), 'fire');
  assert.equal(creatureBody(dnd('elemental', 'Salamander')), 'fire');
  assert.equal(creatureBody(dnd('elemental', 'Air Elemental')), 'air');
  assert.equal(creatureBody(dnd('monstrosity', 'Invisible Stalker')), 'air');
  assert.equal(creatureBody(dnd('elemental', 'Earth Elemental')), 'stone');
  assert.equal(creatureBody(dnd('elemental', 'Gargoyle')), 'stone');
  assert.equal(creatureBody(dnd('construct', 'Iron Golem')), 'metal');
  assert.equal(creatureBody(dnd('construct', 'Helmed Horror')), 'metal');
  assert.equal(creatureBody(dnd('construct', 'Stone Golem')), 'stone');
  assert.equal(creatureBody(dnd('construct', 'Flesh Golem')), null);
  assert.equal(creatureBody(dnd('construct', 'Clay Golem')), null);
  assert.equal(creatureBody(dnd('plant', 'Treant')), 'plant');
  assert.equal(creatureBody(dnd('plant', 'Shambling Mound')), 'plant');
  assert.equal(creatureBody(dnd('plant', 'Violet Fungus')), null);
  assert.equal(creatureBody(dnd('dragon', 'Adult Brass Dragon')), null, 'a metal word without a construct');
  assert.equal(creatureBody(dnd('giant', 'Stone Giant')), null, 'a stone giant is flesh');
  assert.equal(creatureBody(dnd('fiend', 'Bone Devil')), null, 'a bone devil is not a skeleton');
  assert.equal(creatureBody(dnd('humanoid', 'Bandit')), null);
});

test('creatureBody: names alone (Daggerheart, unknown systems), first match wins', () => {
  const dh = (name) => ({ system: 'daggerheart', actor: { type: 'adversary', name, system: { traits: { value: ['construct'] } } }, name });
  assert.equal(creatureBody(dh('Skeleton Archer')), 'bone');
  assert.equal(creatureBody(dh('Clockwork Sentry')), 'metal');
  assert.equal(creatureBody(dh('Living Statue')), 'stone');
  assert.equal(creatureBody(dh('Treant Sapling')), 'plant');
  assert.equal(creatureBody(dh('Iron Wolf')), null, 'Daggerheart traits are not read: a bare metal word needs a construct');
  assert.equal(creatureBody({ name: 'Bone Golem' }), 'bone', 'bone before metal or stone');
  assert.equal(creatureBody({ name: 'Fire Elemental' }), 'fire');
  assert.equal(creatureBody({}), null);
  for (const b of ['bone', 'metal', 'stone', 'plant', 'water', 'fire', 'air']) assert.ok(BODIES.includes(b));
});

test('gaitStep: a family or variant with fewer than three recordings steps as people do', () => {
  for (const [gait, family] of Object.entries(GAIT_STEP_FILES)) {
    for (const [variant, files] of Object.entries(family)) assert.ok(files.length >= MIN_FAMILY_FILES, `${gait}.${variant} is usable`);
  }
  // Paws and hooves have no recordings: the floor's own footsteps.
  for (const gait of ['paws', 'hooves', 'boots', 'unknown']) {
    for (const floor of ['stone', 'dirt']) assert.equal(gaitStep(gait, floor, 3, { seed: 's' }).file, footstepFile(floor, 3, { seed: 's' }), `${gait} on ${floor}`);
  }
  // Dragons have soft recordings only: on stone they step as people do, on dirt as dragons.
  assert.equal(gaitStep('dragon', 'stone', 1, { seed: 's' }).file, footstepFile('stone', 1, { seed: 's' }));
  assert.ok(GAIT_STEP_FILES.dragon.soft.includes(gaitStep('dragon', 'dirt', 1, { seed: 's' }).file));
  assert.equal(gaitStep('none', 'stone', 0), null);
});

test('gaitStep: slither and claws', () => {
  const slither = gaitStep('slither', 'dirt', 0, { seed: 's' });
  if (GAIT_STEP_FILES.slither) {
    const all = Object.values(GAIT_STEP_FILES.slither).flat();
    for (let n = 0; n < 12; n++) assert.ok(all.includes(gaitStep('slither', 'stone', n, { seed: 's' }).file));
  } else assert.equal(slither, null, 'no snake family: snakes stay silent');
  const claws = gaitStep('claws', 'stone', 0, { seed: 's' });
  assert.ok(claws?.file, 'lizards always make a step');
  if (GAIT_STEP_FILES.claws) {
    const all = Object.values(GAIT_STEP_FILES.claws).flat(), dragon = Object.values(GAIT_STEP_FILES.dragon).flat();
    for (let n = 0; n < 12; n++) {
      const f = gaitStep('claws', n % 2 ? 'stone' : 'dirt', n, { seed: 's' }).file;
      assert.ok(all.includes(f) || Object.values(FOOTSTEP_FILES).flat().includes(f), f);
      assert.ok(!dragon.includes(f), 'claws are not the dragon family');
    }
  }
});

test('bodyStep: layers and replacements, seeded, never the same recording twice running', () => {
  assert.equal(bodyStep(null, 0), null);
  assert.equal(bodyStep('nonsense', 0), null);
  for (const body of BODIES) {
    const files = BODY_STEP_FILES[body];
    if (files.length < MIN_FAMILY_FILES) { assert.equal(bodyStep(body, 0, { seed: 't' }), null, `${body}: too few recordings, no body sound`); continue; }
    const run = Array.from({ length: 24 }, (_, n) => bodyStep(body, n, { seed: 't' }));
    for (let i = 0; i < run.length; i++) {
      assert.ok(files.includes(run[i].file));
      assert.ok(run[i].gain > 0 && run[i].gain <= 1);
      assert.equal(run[i].replaces, ['water', 'fire', 'air'].includes(body), `${body} replaces?`);
      if (i) assert.notEqual(run[i].file, run[i - 1].file);
    }
    assert.deepEqual(run, Array.from({ length: 24 }, (_, n) => bodyStep(body, n, { seed: 't' })), 'the same on every screen');
    if (!run[0].replaces) assert.ok(run.every((r) => r.gain < 1), 'a layer is quieter than the step');
    if (!run[0].replaces) assert.ok(run.every((r) => r.peakMs !== BODY_PEAK_MS && r.peakMs > 0), 'each layered recording has its measured peak');
  }
});

test('creature and body families: bundled, on disk, credited, each file its own', () => {
  const credits = readFileSync(new URL('../../../assets/sounds/surfaces/freesound/License.txt', import.meta.url), 'utf8');
  const seen = new Set();
  const check = (file) => {
    assert.ok(existsSync(fileURLToPath(new URL(`../../../${file.replace('modules/animater/', '')}`, import.meta.url))), file);
    const name = file.split('/').pop(), id = name.match(/-(\d+)-\d+\.ogg$/)[1];
    assert.match(credits, new RegExp(`^${name}: ".+" by \\S+, https://freesound\\.org/people/\\S+/sounds/${id}/\\r?$`, 'm'), name);
    assert.ok(!seen.has(file), `${file} is used once`);
    seen.add(file);
  };
  for (const file of gaitStepFiles()) check(file);
  for (const body of BODIES) {
    const files = BODY_STEP_FILES[body];
    assert.ok(files.length === 0 || files.length >= MIN_FAMILY_FILES, `${body}: none or three or more`);
    for (const file of files) { assert.match(file, new RegExp(`/body-${body}-\\d+-\\d+\\.ogg$`)); check(file); }
  }
  assert.equal(bodyStepFiles().length, Object.values(BODY_STEP_FILES).flat().length);
});
