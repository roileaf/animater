import test from 'node:test';
import assert from 'node:assert/strict';
import { sunFromClock, sceneSun, sunReach, clockSource, COMPASS, DEFAULT_SUN, DEFAULT_SUN_SETTING } from '../../../scripts/engines/motion/sun.mjs';
import { sunValues, clockChoices } from '../../../scripts/ui/sun-settings.mjs';
import { shadowFall } from '../../../scripts/engines/motion/movement-feel.mjs';

test('the sun rises in the east, crosses the south at noon and sets in the west; none at night', () => {
  const dawn = sunFromClock({ day: 0.27, sunrise: 0.25, sunset: 0.75 });
  const noon = sunFromClock({ day: 0.5, sunrise: 0.25, sunset: 0.75 });
  const dusk = sunFromClock({ day: 0.73, sunrise: 0.25, sunset: 0.75 });
  assert.ok(Math.abs(dawn.angle - COMPASS.e) < 10 && Math.abs(noon.angle - COMPASS.s) < 1e-9 && Math.abs(dusk.angle - COMPASS.w) < 10);
  assert.ok(noon.height > dawn.height && noon.strength === 1 && dawn.strength < 1, 'low and faint at dawn');
  assert.equal(sunFromClock({ day: 0.1, sunrise: 0.25, sunset: 0.75 }), null);
  assert.equal(sunFromClock({ day: 0.9 }), null);
  // A map turned so its east is up: the sun rises at the top.
  assert.ok(Math.abs(sunFromClock({ day: 0.26, east: COMPASS.n }).angle - COMPASS.n) < 5);
});

test('a scene keeps the world default, or follows the clock, stays where it is fixed, or has no sun', () => {
  const clock = { day: 0.5, sunrise: 0.25, sunset: 0.75 }, follows = { ...DEFAULT_SUN_SETTING, mode: 'time' };
  assert.deepEqual(sceneSun({}, { clock }), DEFAULT_SUN, 'nothing set anywhere: the old top-left sun');
  assert.equal(sceneSun({}, { defaults: follows, clock }).angle, COMPASS.s, 'the world default follows the clock');
  assert.equal(sceneSun({}, { defaults: follows, clock: { ...clock, day: 0.95 } }), null, 'night');
  assert.deepEqual(sceneSun({}, { defaults: { mode: 'fixed', from: 45, height: 20, strength: 0.4 } }), { angle: 45, height: 20, strength: 0.4 }, 'a fixed world default, in exact degrees');
  assert.equal(sceneSun({}, { defaults: { mode: 'none' } }), null);
  assert.deepEqual(sceneSun({ mode: 'fixed', from: 'e', height: 'low', strength: 0.5 }, { defaults: follows, clock }), { angle: COMPASS.e, height: 15, strength: 0.5 }, 'the scene\'s own wins');
  assert.equal(sceneSun({ mode: 'none' }, { defaults: follows, clock }), null);
  assert.equal(sceneSun({ mode: 'fixed', strength: 0 }), null, 'strength 0: none');
  assert.equal(sceneSun({ mode: 'time', strength: 0.5 }, { clock }).strength, 0.5);
  assert.deepEqual(sceneSun({ mode: 'time' }, { clock: null }), DEFAULT_SUN, 'no clock to read: the fixed sun');
});

test('shadows lengthen as the sun sinks, point away from it, and fade when they grow too long', () => {
  assert.ok(sunReach(100, 15) > sunReach(100, 60));
  assert.ok(Math.abs(sunReach(100, 45) - 100) < 1e-9);
  const at = (sun) => shadowFall({ width: 100, lift: 4, darkness: 0, sun, grid: 100 });
  const noon = at({ angle: COMPASS.s, height: 60, strength: 1 }), evening = at({ angle: COMPASS.w, height: 15, strength: 1 });
  assert.ok(noon.dy < 0 && Math.abs(noon.dx) < 1e-6, 'sun in the south: the shadow points north');
  assert.ok(evening.dx > 0 && Math.abs(evening.dx) > Math.abs(noon.dy), 'evening sun in the west: long, to the east');
  assert.ok(evening.alpha < noon.alpha, 'past six squares it fades');
  assert.equal(at(null).alpha, 0, 'no sun, no light: no shadow');
  // Standing creatures: a short shadow from their feet.
  const standing = shadowFall({ width: 100, lift: 0.5, darkness: 0, sun: { angle: COMPASS.w, height: 30, strength: 1 }, grid: 100, grounded: true });
  assert.ok(standing.dx > 0 && standing.dx < 100 && standing.alpha > 0);
});

test('the calendar: the chosen one when active, else Foundry; automatic prefers Calendaria, then Simple Calendar Reborn', () => {
  const on = (...ids) => (id) => ids.includes(id);
  assert.equal(clockSource('auto', on('calendaria', 'foundryvtt-simple-calendar-reborn')), 'calendaria');
  assert.equal(clockSource('auto', on('foundryvtt-simple-calendar-reborn')), 'foundryvtt-simple-calendar-reborn');
  assert.equal(clockSource('auto', on()), 'foundry');
  assert.equal(clockSource('foundryvtt-simple-calendar-reborn', on('calendaria', 'foundryvtt-simple-calendar-reborn')), 'foundryvtt-simple-calendar-reborn');
  assert.equal(clockSource('calendaria', on()), 'foundry', 'not active: Foundry\'s clock');
  assert.equal(clockSource('foundry', on('calendaria')), 'foundry');
  assert.ok(clockChoices(on('calendaria')).find((c) => c.value === 'foundryvtt-simple-calendar-reborn').label.includes('not active'));
});

test('the default sun saves as numbers, with only real modes', () => {
  assert.deepEqual(sunValues({ mode: 'time', from: '-135', height: '40', east: '0', strength: '0.5' }), { mode: 'time', from: -135, height: 40, east: 0, strength: 0.5 });
  assert.equal(sunValues({ mode: '' }).mode, 'fixed', 'the world default has no "World default"');
  assert.equal(sunValues({ strength: '3' }).strength, 1);
});
