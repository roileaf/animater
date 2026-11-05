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

test('still water freezes in a hard frost, faster the colder, and thaws above freezing', () => {
  const at = (air, hours, start = 0) => { const g = createGroundWeather({ load: () => ({ wet: 0, snow: 0, ice: start, at: 0 }) }); return g.update({ now: hours * 3600, air }).ice; };
  assert.equal(at(0, 10), 0, 'just below zero: open');
  assert.ok(at(-5, 4) > 0 && at(-5, 4) < 1, 'a frost freezes it over some hours');
  assert.ok(at(-20, 4) > at(-5, 4), 'faster the colder');
  assert.equal(at(-15, 24), 1, 'a day at −15 °C locks it');
  assert.ok(at(10, 3, 1) < 1, 'it thaws once warm');
  const deep = createGroundWeather({ load: () => ({ wet: 0, snow: 0.9, ice: 0, at: 0 }) });
  assert.ok(deep.update({ now: 6 * 3600, air: null }).ice > 0, 'no temperature known: deep snow lying freezes it');
});

test('the ground through the year: a colour for each season, leaves lying deep in autumn and blown off in a wind', async () => {
  const { seasonGround } = await import('../../../scripts/engines/motion/ambient-life.mjs');
  for (const s of ['spring', 'summer', 'autumn', 'winter']) assert.ok(seasonGround(s).tint[3] > 0, s);
  assert.ok(seasonGround('autumn').litter > seasonGround('winter').litter && seasonGround('summer').litter === 0);
  assert.ok(seasonGround('autumn', { wind: 1 }).litter < seasonGround('autumn').litter, 'a wind blows them off');
  assert.deepEqual(seasonGround(null), { tint: [0, 0, 0, 0], litter: 0 }, 'no season known: nothing');
});

test('a scene nobody is looking at freezes on in a frost, step by step, and thaws when it warms', async () => {
  const { groundStep, groundInputs, groundMoved } = await import('../../../scripts/engines/motion/ambient-life.mjs');
  const cold = groundInputs({ temperature: -10 }), warm = groundInputs({ temperature: 12, sun: 1 });
  let kept = groundStep(null, { now: 0, ...cold });
  assert.equal(kept.ice, 0, 'starts bare');
  for (let h = 1; h <= 6; h++) kept = groundStep(kept, { now: h * 3600, ...cold });
  assert.ok(kept.ice > 0.5, 'six hours of hard frost: mostly frozen');
  const frozen = kept.ice;
  kept = groundStep(kept, { now: 9 * 3600, ...warm });
  assert.ok(kept.ice < frozen, 'thawing');
  assert.ok(groundMoved({ wet: 0, snow: 0, ice: 0, at: 0 }, kept) && !groundMoved(kept, { ...kept }), 'written only when it moved');
  assert.equal(groundInputs({ scene: 'blizzard', temperature: 20 }).air, -5, 'a blizzard on the scene freezes whatever the calendar says');
});

test('water takes the GM\'s time to freeze, each scene its own; snow on the ground takes minutes', async () => {
  const { createGroundWeather, iceHours, groundStep } = await import('../../../scripts/engines/motion/ambient-life.mjs');
  let kept = { wet: 0, snow: 0, ice: 0, at: 0 };
  const ground = createGroundWeather({ load: () => kept, save: (s) => { kept = s; }, pace: () => 24 });
  const cold = { rain: 0, snow: 0.7, temperature: -10, air: -10, sun: 0 }, warm = { rain: 0, snow: 0, temperature: 12, air: 12, sun: 1 };
  ground.update({ now: 300, ...cold });
  assert.ok(Math.abs(kept.snow - 0.5) < 1e-9, 'half the snow in five minutes');
  ground.update({ now: 12 * 3600, ...cold });
  assert.equal(kept.snow, 1);
  assert.ok(Math.abs(kept.ice - 0.5) < 1e-9, 'half the ice in 12 of 24 hours');
  ground.update({ now: 24 * 3600, ...cold });
  assert.equal(kept.ice, 1);
  ground.update({ now: 24 * 3600 + 600, ...warm });
  assert.ok(Math.abs(kept.snow - 0.5) < 1e-9, 'half melted in ten minutes');
  ground.update({ now: 36 * 3600 + 600, ...warm });
  assert.equal(kept.snow, 0);
  assert.ok(kept.ice > 0.49 && kept.ice < 0.51, 'and the ice half way out in 12 hours');
  const a = iceHours('scene-a'), b = iceHours('scene-b-other');
  for (const h of [a, b]) assert.ok(h >= 24 && h <= 48, String(h));
  assert.equal(iceHours('scene-a'), a, 'always the same for a scene');
  assert.notEqual(a, b);
  assert.equal(iceHours('x', 30, 30), 30);
  assert.equal(iceHours('x', 50, 10), 50, 'a most under the least is the least');
  assert.ok(Math.abs(groundStep({ wet: 0, snow: 0, ice: 0, at: 0 }, { now: 6 * 3600, pace: 24, ...cold }).ice - 0.25) < 1e-9, 'scenes away too');
  assert.equal(groundStep({ wet: 0, snow: 0, ice: 0, at: 0 }, { now: 3600, pace: 24, rain: 1, snow: 0, temperature: 15, air: 15, sun: 0 }).wet, 1, 'rain is no slower');
});

test('a storm of sand or snow brings no rain; a rainstorm and a thunderstorm do', async () => {
  const { fallingOf } = await import('../../../scripts/engines/motion/ambient-life.mjs');
  assert.deepEqual(fallingOf({ scene: 'animater.sandstorm' }), { rain: 0, snow: 0 });
  assert.equal(fallingOf({ scene: 'snowStorm' }).rain, 0);
  assert.ok(fallingOf({ scene: 'snowStorm' }).snow > 0);
  assert.ok(fallingOf({ scene: 'rainStorm' }).rain > 0);
  assert.ok(fallingOf({ scene: 'animater.thunderstorm' }).rain > 0);
});
