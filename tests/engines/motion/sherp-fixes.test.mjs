import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mistOf, seasonGround } from '../../../scripts/engines/motion/ambient-life.mjs';
import { sceneFloor, regionFloor, FLOOR_CHOICES, NO_FLOOR } from '../../../scripts/engines/motion/movement-feel.mjs';

test('with no sun on the map, the morning mist still burns off by the clock', () => {
  const at = (day) => mistOf({ day, sunrise: 0.25, sunset: 0.75, sun: null });
  assert.equal(at(0.25), 1, 'thick at sunrise');
  assert.ok(at(0.31) > 0 && at(0.31) < 1, 'thinning');
  assert.equal(at(0.4), 0, 'gone by mid-morning');
  assert.equal(at(0.6), 0, 'none in the afternoon');
  assert.equal(mistOf({ day: 0.5, sun: null, fog: true }), 0.85, 'fog still lies all day');
});

test('with a sun, the mist still burns off as it climbs', () => {
  assert.equal(mistOf({ day: 0.3, sunrise: 0.25, sunset: 0.75, sun: { height: 30 } }), 0);
  assert.ok(mistOf({ day: 0.26, sunrise: 0.25, sunset: 0.75, sun: { height: 5 } }) > 0.7);
});

test('a scene or region can have no floor: no step sounds, no marks', () => {
  assert.ok(FLOOR_CHOICES.some(([v]) => v === NO_FLOOR));
  assert.equal(sceneFloor({ flag: NO_FLOOR }), NO_FLOOR);
  assert.equal(regionFloor({ name: 'Plaza', flag: NO_FLOOR }), NO_FLOOR);
  assert.equal(sceneFloor({ flag: 'nonsense', name: 'Crypt' }), 'stone', 'anything else still falls back');
});

test('the season colour is still given (the shader lays it on the grass only)', () => {
  assert.ok(seasonGround('spring').tint[3] > 0);
});
