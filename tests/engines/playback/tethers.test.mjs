import test from 'node:test';
import assert from 'node:assert/strict';
import { tetherState, tetherTag, tetherPoint, TETHER_STYLES } from '../../../scripts/engines/playback/tethers.mjs';
import { validateRecipe } from '../../../scripts/core/model.mjs';

// A rope, vine or tongue reaches out, holds and draws back; a thrown snare flies and stays where it lands.
test('a reaching tether shoots out, holds, then draws back; a thrown one lands and stays', () => {
  assert.equal(tetherState('rope', 0, 1000).reach, 0);
  assert.ok(tetherState('rope', 400, 1000).reach > 0.99, 'reached by a third of its time');
  assert.ok(tetherState('rope', 700, 1000).reach > 0.99, 'holds');
  assert.ok(tetherState('rope', 950, 1000).reach < 0.5, 'drawn back at the end');
  assert.equal(tetherState('tongue', 800, 1000).reach, 1, 'a whip holds out longer…');
  assert.equal(tetherState('tongue', 1000, 1000).reach, 0, '…then snaps all the way back');
  assert.equal(tetherState('snare', 0, 1000).head, 0);
  assert.equal(tetherState('snare', 700, 1000).head, 1);
  assert.equal(tetherState('snare', 700, 1000).landed, true);
  assert.equal(tetherState('nothing', 0, 1000), null);
  const mid = tetherPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.5, 0, { sag: 0.1 });
  assert.equal(mid.x, 50);assert.equal(Math.round(Math.abs(mid.y)), 10);
});

test('a stage drawn by Tokenshade tags its style and both ends; anything else plays its clip', () => {
  const caster = { document: { id: 'A' }, center: { x: 0, y: 0 } }, target = { document: { id: 'B' }, center: { x: 300, y: 0 } };
  const tag = tetherTag({ kind: 'travel', travelLook: 'tokenshade', tetherStyle: 'vine', origin: caster, endpoint: target, tintEnabled: true, tint: '#336622' }, 1200);
  assert.deepEqual(tag, { style: 'vine', ms: 1200, from: { token: 'A' }, to: { token: 'B' }, color: 0x336622 });
  assert.equal(tetherTag({ kind: 'travel', travelLook: 'tokenshade', origin: caster, endpoint: { x: 5, y: 6 } }, 900).style, 'rope', 'a rope by default');
  assert.deepEqual(tetherTag({ kind: 'travel', travelLook: 'tokenshade', origin: caster, endpoint: { x: 5, y: 6 } }, 900).to, { x: 5, y: 6 });
  assert.equal(tetherTag({ kind: 'travel', origin: caster, endpoint: target }, 900), null, 'JB2A by default');
  assert.equal(tetherTag({ kind: 'impact', travelLook: 'tokenshade', origin: caster, endpoint: target }, 900), null);
});

test('the travel look survives validation on travel and projectile stages only, and is absent when unset', () => {
  const r = validateRecipe({ id: 'r', name: 'r', trigger: 'use', stages: [
    { kind: 'travel', stageId: 't', assets: ['jb2a.energy_strands.range.standard.dark_green.01'], travelLook: 'tokenshade', tetherStyle: 'vine' },
    { kind: 'projectile', stageId: 'p', assets: ['jb2a.web.02'], travelLook: 'tokenshade', tetherStyle: 'rope' },
    { kind: 'impact', stageId: 'i', assets: ['jb2a.impact.001.orange'], travelLook: 'tokenshade', tetherStyle: 'vine' },
  ] });
  const [t, p, i] = r.stages;
  assert.deepEqual([t.travelLook, t.tetherStyle], ['tokenshade', 'vine']);
  assert.equal(p.travelLook, 'tokenshade');assert.equal('tetherStyle' in p, false, 'rope is the unset default');
  assert.equal('travelLook' in i, false);
  for (const name of Object.keys(TETHER_STYLES)) assert.ok(['reach', 'thrown', 'stream'].includes(TETHER_STYLES[name].kind), name);
});
