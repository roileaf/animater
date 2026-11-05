import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherScene, weatherDrawn, WEATHERS, FALL_KINDS } from '../../../scripts/engines/motion/sky-weather.mjs';

const CALENDARIA = ['clear', 'partly-cloudy', 'cloudy', 'overcast', 'drizzle', 'rain', 'fog', 'mist', 'windy', 'sunshower', 'snow', 'sleet', 'heat-wave',
  'thunderstorm', 'blizzard', 'hail', 'tornado', 'hurricane', 'ice-storm', 'monsoon', 'ashfall', 'sandstorm', 'luminous-sky', 'sakura-bloom',
  'autumn-leaves', 'rolling-fog', 'wildfire-smoke', 'dust-devil', 'black-sun', 'ley-surge', 'aether-haze', 'nullfront', 'permafrost-surge',
  'gravewind', 'veilfall', 'arcane-winds', 'acid-rain', 'blood-rain', 'meteor-shower', 'spore-cloud', 'divine-light', 'plague-miasma'];

test('every one of Calendaria’s weathers has its own look; only the clear and cloudy skies draw nothing but clouds', () => {
  for (const id of CALENDARIA) assert.ok(WEATHERS.includes(id), id);
  for (const id of CALENDARIA.filter((i) => !['clear', 'partly-cloudy', 'cloudy', 'overcast'].includes(i))) assert.ok(weatherDrawn(weatherScene({ id })), `${id} draws something`);
  assert.equal(weatherDrawn(weatherScene({ id: 'clear' })), false);
});

test('rain falls as rain, snow as snow, sleet as both; a heavier preset rains harder', () => {
  assert.equal(weatherScene({ id: 'rain' }).falls[0].kind, FALL_KINDS.rain);
  assert.equal(weatherScene({ id: 'snow' }).falls[0].kind, FALL_KINDS.snow);
  assert.deepEqual(weatherScene({ id: 'sleet' }).falls.map((f) => f.kind), [FALL_KINDS.rain, FALL_KINDS.snow]);
  assert.ok(weatherScene({ id: 'rain', precipitation: { type: 'rain', intensity: 1 } }).falls[0].amount > weatherScene({ id: 'rain', precipitation: { type: 'rain', intensity: 0.3 } }).falls[0].amount);
});

test('a preset\'s intensity never falls thicker than the weather\'s own recipe', () => {
  const recipe = weatherScene({ id: 'blizzard' }).falls[0].amount;
  assert.equal(weatherScene({ id: 'blizzard', precipitation: { type: 'snow', intensity: 1 } }).falls[0].amount, recipe);
  assert.ok(weatherScene({ id: 'blizzard', precipitation: { type: 'snow', intensity: 0.2 } }).falls[0].amount < recipe);
});

test('blood rain is red, acid rain green; a custom preset falls by its precipitation', () => {
  const blood = weatherScene({ id: 'blood-rain' }).falls[0].color, acid = weatherScene({ id: 'acid-rain' }).falls[0].color;
  assert.ok(blood[0] > blood[1] && acid[1] > acid[0]);
  assert.equal(weatherScene({ id: 'my-own', precipitation: { type: 'snow', intensity: 0.5 } }).falls[0].kind, FALL_KINDS.snow);
  assert.equal(weatherScene({ id: 'my-own' }).falls.length, 0);
});

test('a scene can pick one of Animater\u2019s weathers itself', async () => {
  const { sceneWeatherId, weatherLabel } = await import('../../../scripts/engines/motion/sky-weather.mjs');
  assert.equal(sceneWeatherId('animater.blizzard'), 'blizzard');
  assert.equal(sceneWeatherId('rain'), null, 'Foundry\u2019s own');
  assert.equal(sceneWeatherId('animater.nothing'), null);
  assert.equal(weatherLabel('ice-storm'), 'Ice Storm');
});

test('the plain skies draw no cloud layer of their own, and a sunshower is light rain', async () => {
  const { weatherScene } = await import('../../../scripts/engines/motion/sky-weather.mjs');
  for (const id of ['partly-cloudy', 'cloudy', 'overcast', 'drizzle', 'rain']) { assert.equal(weatherScene({ id }).clouds[3], 0, id); assert.equal(weatherScene({ id }).deck, 0, id); assert.equal(weatherScene({ id }).fog[3], 0, id); }
  assert.ok(weatherScene({ id: 'ashfall' }).clouds[3] > 0);
  assert.equal(weatherScene({ id: 'sunshower' }).falls[0].amount, 0.3);
});
