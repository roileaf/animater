import test from 'node:test';
import assert from 'node:assert/strict';
import { isFireLight, hazesLight, sparksLight, fireHazeTag } from '../../../scripts/engines/distortion/fire-haze.mjs';
import { slotParams } from '../../../scripts/engines/distortion/scene-distortion.mjs';

test('torch and flame lights are fires; a light can opt its haze in or out', () => {
  assert.ok(isFireLight({ animation: { type: 'torch' } }));
  assert.ok(isFireLight({ animation: { type: 'Flame' } }));
  assert.ok(!isFireLight({ animation: { type: 'pulse' } }));
  assert.ok(!isFireLight({}));
  assert.ok(hazesLight({ animation: { type: 'pulse' } }, { heatHaze: true }));
  assert.ok(!hazesLight({ animation: { type: 'torch' } }, { heatHaze: false }));
});

test('the haze sits round the flame, a bigger fire a little wider, and rides on the light', () => {
  const small = fireHazeTag({ x: 300, y: 200, bright: 0, dim: 100 }, { grid: 100 });
  const big = fireHazeTag({ x: 300, y: 200, bright: 1200, dim: 2400 }, { grid: 100, level: 'L1' });
  assert.equal(small.at.x, 300);
  assert.ok(small.at.y < 200, 'a little above the flame, where the heat rises');
  const held = fireHazeTag({ x: 300, y: 200, bright: 400, dim: 800 }, { grid: 100, carried: true, at: { x: 350, y: 150 } });
  assert.ok(held.radius <= 35 && held.at.x === 350 && held.at.y < 150, 'a carried torch: small, at its flame, not over the creature');
  assert.ok(big.radius > small.radius && big.radius <= 200 && small.radius >= 50);
  assert.equal(small.lengthMs, null, 'lasting');
  assert.ok(small.follow);
  assert.equal(big.level, 'L1');
  assert.equal(slotParams(small, 1000).kind, slotParams({ kind: 'haze', at: { x: 0, y: 0 }, radius: 10, startMs: 0, lengthMs: null }, 0).kind, 'drawn as a haze');
});

import { smokesLight } from '../../../scripts/engines/distortion/fire-haze.mjs';
test('a light smokes and shimmers by its animation, or by its own On and Off, each on its own', () => {
  const torch = { animation: { type: 'torch' } }, plain = { animation: { type: 'pulse' } };
  assert.equal(smokesLight(torch, {}), true);
  assert.equal(smokesLight(torch, { smoke: 'false' }), false, 'Off, as the form saves it');
  assert.equal(smokesLight(plain, { smoke: 'true' }), true, 'On for any light');
  assert.equal(smokesLight(torch, { heatHaze: false }), true, 'no haze still smokes');
  assert.equal(hazesLight(torch, { heatHaze: 'false' }), false);
  assert.equal(hazesLight(torch, { smoke: false }), true, 'no smoke still shimmers');
  assert.equal(smokesLight(torch, { smoke: '' }), true, 'Auto');
});

// Roi: sparks went only by the Heat haze switch. Each has its own now, and a light with its haze off is still a fire:
// its flame, smoke, sparks, moths and soot keep to their own switches.
test('sparks and heat haze are switched apart', () => {
  const torch = { animation: { type: 'torch' } }, plain = { animation: { type: 'pulse' } };
  assert.equal(sparksLight(torch, { heatHaze: 'false' }), true, 'no haze still sparks');
  assert.equal(hazesLight(torch, { sparks: 'false' }), true, 'no sparks still shimmers');
  assert.equal(sparksLight(torch, { sparks: 'false' }), false);
  assert.equal(sparksLight(plain, { sparks: 'true' }), true, 'On for any light');
  assert.equal(sparksLight(plain, { sparks: '' }), false, 'Auto: only a fire');
  assert.equal(isFireLight(torch, { heatHaze: 'false' }), true, 'still a fire');
});
