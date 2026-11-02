import test from 'node:test';
import assert from 'node:assert/strict';
import { sunFromClock, sunGlow, moonFromClock, fixedAt, skyClear, moonLit, phaseLit, sceneSun, sunReach, clockSource, COMPASS, DEFAULT_SUN, DEFAULT_SUN_SETTING } from '../../../scripts/engines/motion/sun.mjs';
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
test('dawn and dusk colour: golden as the sun sinks, deep orange at the horizon, a rose afterglow, nothing at noon or midnight', () => {
  const at = (day) => sunGlow({ day, sunrise: 0.25, sunset: 0.75 });
  assert.equal(at(0.5), null, 'noon');
  assert.equal(at(0), null, 'midnight');
  assert.equal(sunGlow(null), null, 'no clock');
  const golden = at(0.72), horizon = at(0.749), after = at(0.76), late = at(0.79);
  assert.ok(golden && horizon && after);
  assert.ok(horizon.amount > golden.amount, 'stronger as it sinks');
  assert.ok(horizon.color[2] < golden.color[2], 'redder at the horizon');
  assert.ok(after.color[2] > after.color[1], 'rose after sunset');
  assert.equal(late, null, 'gone once twilight ends');
  assert.ok(at(0.245) && at(0.255), 'dawn too');
});
test('moonlight: silver-blue by night as the moon is lit, and faint shadows from a moon crossing the night sky', () => {
  assert.equal(moonLit(0), 0); assert.equal(moonLit(0.5), 1); assert.ok(Math.abs(moonLit(0.25) - 0.5) < 1e-9);
  assert.equal(phaseLit('waxing-gibbous'), 0.75); assert.equal(phaseLit('Full Moon'), 1); assert.equal(phaseLit('New Moon'), 0); assert.equal(phaseLit(''), null);
  const night = (moon) => sunGlow({ day: 0, sunrise: 0.25, sunset: 0.75, moon });
  assert.equal(night(0), null, 'new moon: nothing');
  const full = night(1), half = night(0.5);
  assert.ok(full.amount > half.amount, 'brighter moon, stronger tint');
  assert.ok(full.color[2] > full.color[0], 'blue');
  assert.equal(moonFromClock({ day: 0.5, moon: 1 }), null, 'not by day');
  assert.equal(moonFromClock({ day: 0, moon: 0.05 }), null, 'a thin moon casts none');
  const midnight = moonFromClock({ day: 0, moon: 1 });
  assert.ok(midnight.moon && midnight.height > 40 && midnight.strength <= 0.35);
  const scene = sceneSun({ mode: 'time' }, { clock: { day: 0, sunrise: 0.25, sunset: 0.75, moon: 1 } });
  assert.ok(scene?.moon, 'the scene sun is the moon by night');
  assert.equal(sceneSun({ mode: 'time' }, { clock: { day: 0, sunrise: 0.25, sunset: 0.75 } }), null, 'no moon known: no night shadows');
});
test('a fixed sun stays where it is set and follows the clock: the moon there by night, none under a new moon', () => {
  const fixed = sceneSun({ mode: 'fixed', from: 'nw', height: 'mid' }, { clock: { day: 0, sunrise: 0.25, sunset: 0.75, moon: 1 } });
  assert.ok(fixed.moon && fixed.angle === -135 && fixed.height === 40 && fixed.strength <= 0.35);
  assert.equal(sceneSun({ mode: 'fixed' }, { clock: { day: 0, sunrise: 0.25, sunset: 0.75, moon: 0 } }), null);
  assert.equal(sceneSun({ mode: 'fixed', from: 'nw' }, { clock: { day: 0.5, sunrise: 0.25, sunset: 0.75 } }).strength, 1, 'by day');
  assert.equal(fixedAt({ angle: 0, height: 30, strength: 1 }, null).strength, 1, 'no clock: always the sun');
});
test('clouds hide the sun and the moon: fainter under clouds, none under a storm, by the calendar or the scene weather', () => {
  assert.equal(skyClear(null), 1); assert.equal(skyClear({ id: 'clear' }), 1); assert.equal(skyClear({ id: 'thunderstorm' }), 0);
  assert.equal(skyClear('rainStorm'), 0, 'Foundry scene weather');
  assert.ok(skyClear({ id: 'homebrew-drizzle', precipitation: { intensity: 0.5 } }) < 0.6, 'unknown: by how hard it falls');
  const day = { day: 0.5, sunrise: 0.25, sunset: 0.75 };
  assert.ok(Math.abs(sceneSun({ mode: 'time' }, { clock: { ...day, sky: 0.35 } }).strength - sceneSun({ mode: 'time' }, { clock: day }).strength * 0.35) < 1e-9);
  assert.equal(sceneSun({ mode: 'time' }, { clock: { ...day, sky: 0 } }), null, 'storm: no shadows');
  assert.equal(sceneSun({ mode: 'fixed' }, { clock: { day: 0, sunrise: 0.25, sunset: 0.75, moon: 1, sky: 0 } }), null, 'no moon behind the clouds');
  assert.equal(sunGlow({ day: 0, sunrise: 0.25, sunset: 0.75, moon: 1, sky: 0 }), null, 'no moonlit tint either');
  assert.ok(sunGlow({ day: 0.74, sunrise: 0.25, sunset: 0.75, sky: 0.35 }).amount < sunGlow({ day: 0.74, sunrise: 0.25, sunset: 0.75 }).amount, 'a greyer dusk');
});
