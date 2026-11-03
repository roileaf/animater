import test from 'node:test';
import assert from 'node:assert/strict';
import { seasonOf, mistOf, firefliesOf, leavesOf, createGroundWeather, fallingOf, settlingTemperature, nextFlockMs, flockPath } from '../../../scripts/engines/motion/ambient-life.mjs';

test('seasonOf reads Calendaria’s season type and Simple Calendar Reborn’s icon', () => {
  assert.equal(seasonOf({ name: 'Summer', seasonalType: 'summer' }), 'summer');
  assert.equal(seasonOf({ name: 'Harvest', icon: 'fall' }), 'autumn');
  assert.equal(seasonOf({ name: 'Deepwinter' }), 'winter');
  assert.equal(seasonOf({ name: 'The Long Night' }), null);
  assert.equal(seasonOf(null), null);
});

test('mist gathers before sunrise and burns off as the sun climbs; fog lies all day', () => {
  const at = (day, height) => mistOf({ day, sunrise: 0.25, sunset: 0.75, sun: height === null ? null : { height } });
  assert.equal(at(0.1, null), 0, 'deep night');
  assert.ok(at(0.2, null) > 0.5 && at(0.2, null) < 1, 'gathering, an hour before sunrise');
  assert.equal(at(0.24, null), 1, 'just before sunrise');
  assert.equal(at(0.27, 5), 0.8, 'the sun 5° up');
  assert.equal(at(0.4, 30), 0, 'burnt off');
  assert.equal(at(0.6, 10), 0, 'afternoon');
  assert.equal(mistOf({ day: 0.6, fog: true }), 0.85);
});

test('fireflies come out after sunset on warm summer evenings only', () => {
  const at = (day, extra = {}) => firefliesOf({ day, sunset: 0.75, season: 'summer', temperature: 22, ...extra });
  assert.equal(at(0.5), 0, 'midday');
  assert.equal(at(0.8), 1, 'an hour after sunset');
  assert.equal(at(0.95), 0, 'late in the night');
  assert.equal(at(0.8, { season: 'winter' }), 0);
  assert.equal(at(0.8, { temperature: 8 }), 0, 'a cold night');
  assert.equal(at(0.8, { season: 'spring' }), 0.5);
  assert.equal(at(0.8, { temperature: null, season: null }), 1, 'nothing known: a warm evening');
});

test('leaves fall most in autumn and in the wind, none in winter', () => {
  assert.equal(leavesOf({ season: 'winter' }).rate, 0);
  assert.ok(leavesOf({ season: 'autumn', wind: 0 }).rate > leavesOf({ season: 'summer', wind: 1 }).rate);
  assert.ok(leavesOf({ season: 'summer', wind: 1 }).rate > leavesOf({ season: 'summer', wind: 0 }).rate);
  assert.ok(leavesOf({ season: 'autumn' }).colors.length > 1);
});

test('the ground wets in the rain and dries after, whitens in the snow and melts above freezing, carried by the clock', () => {
  let kept = null;
  const ground = () => createGroundWeather({ load: () => kept, save: (s) => { kept = s; } });
  const g = ground(), hour = 3600;
  g.update({ now: 0 });
  assert.equal(g.update({ now: hour, rain: 1 }).wet, 1, 'an hour of rain');
  const drying = g.update({ now: 3 * hour, rain: 0, sun: 1, temperature: 25 }).wet;
  assert.ok(drying < 1 && drying >= 0, 'drying');
  assert.equal(g.update({ now: 9 * hour, sun: 1, temperature: 25 }).wet, 0, 'dry again');
  // Kept: a new screen (or a reload) carries on from where it was.
  g.update({ now: 10 * hour, snow: 1, temperature: -3 });
  const after = ground().update({ now: 11 * hour, snow: 1, temperature: -3 }).snow;
  assert.equal(after, 1, 'two hours of snow');
  assert.equal(ground().update({ now: 12 * hour, snow: 0, temperature: -3 }).snow, 1, 'stays while it freezes');
  assert.ok(ground().update({ now: 14 * hour, snow: 0, temperature: 8, sun: 1 }).snow < 1, 'melts once it warms');
  assert.equal(ground().update({ now: 15 * hour, snow: 1, temperature: 10 }).snow < 1, true, 'snow that melts as it lands never lies');
});

test('fallingOf reads Calendaria’s precipitation, else the scene’s weather', () => {
  assert.deepEqual(fallingOf({ calendaria: { precipitation: { type: 'rain', intensity: 0.6 } } }), { rain: 0.6, snow: 0 });
  assert.deepEqual(fallingOf({ calendaria: { precipitation: { type: 'snow', intensity: 0.8 } } }), { rain: 0, snow: 0.8 });
  assert.deepEqual(fallingOf({ calendaria: { precipitation: { type: 'sleet', intensity: 0.5 } } }), { rain: 0.5, snow: 0.5 });
  assert.deepEqual(fallingOf({ calendaria: { id: 'clear', precipitation: { type: 'rain', intensity: 0 } } }), { rain: 0, snow: 0 });
  assert.deepEqual(fallingOf({ scene: 'rainStorm' }), { rain: 0.7, snow: 0 });
  assert.deepEqual(fallingOf({ scene: 'blizzard' }), { rain: 0, snow: 0.7 });
});

test('a flock crosses the whole map, with the wind, every minute or two', () => {
  assert.equal(nextFlockMs(0), 40000);
  assert.equal(nextFlockMs(1), 120000);
  const bounds = { x: 0, y: 0, width: 4000, height: 3000 };
  const path = flockPath(bounds, () => 0.5, 0);
  assert.ok(path.from.x < 0 && path.to.x > 4000, 'from one edge past the other');
  assert.ok(Math.abs(path.angle) < 1e-9, 'with the wind');
  assert.ok(path.ms > 10000, 'it takes a while');
});

test('falling snow settles whatever temperature the calendar gives; sleet only in the cold', () => {
  const warm = { id: 'clear', temperature: 31, precipitation: { type: 'rain', intensity: 0 } };
  assert.equal(settlingTemperature({ calendaria: warm, scene: 'blizzard', temperature: 31 }), null, 'the GM\'s blizzard: freezing');
  assert.equal(settlingTemperature({ calendaria: warm, scene: '', temperature: 31 }), 31);
  assert.equal(settlingTemperature({ calendaria: { id: 'blizzard', precipitation: { type: 'snow', intensity: 1 } }, temperature: 21 }), null, 'the calendar\'s own blizzard at 21 °C still settles');
  assert.equal(settlingTemperature({ calendaria: { precipitation: { type: 'sleet', intensity: 0.6 } }, temperature: 4 }), 4, 'sleet, half rain: only in the cold');
  const ground = createGroundWeather();
  ground.update({ now: 0 });
  assert.ok(ground.update({ now: 3600, snow: 0.7, temperature: settlingTemperature({ calendaria: warm, scene: 'blizzard', temperature: 31 }) }).snow > 0.5, 'an hour of it lies');
});

test('the clock set anew (a jump of more than a month, as a world time read before it is ready) keeps what lies', () => {
  const ground = createGroundWeather({ load: () => ({ wet: 0, snow: 1, at: -396739878 }) });
  assert.equal(ground.update({ now: 0, temperature: 15 }).snow, 1, 'not 48 hours of thaw');
  assert.equal(ground.update({ now: -396739800, temperature: 15 }).snow, 1, 'back to the real time: nothing');
  assert.ok(ground.update({ now: -396739800 + 3600, temperature: 15 }).snow < 1, 'an hour at 15 °C: it melts');
});
