import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEATHER_LOOPS, THUNDER, weatherLevels, weatherIsOurs, thunderFor, weatherFile } from '../../../scripts/engines/motion/weather-sound.mjs';

test('every weather sound is there and credited', () => {
  for (const f of [...Object.values(WEATHER_LOOPS).flat(), ...Object.values(THUNDER).flat()]) {
    const here = new URL(`../../../${f.replace('modules/animater/', '')}`, import.meta.url);
    assert.ok(fs.existsSync(here), f);
    assert.ok(fs.readFileSync(new URL('License.txt', here), 'utf8').includes(f.split('/').at(-1)), `${f} credited`);
  }
});

test('light rain gives way to heavy as it comes down harder, and a storm rains hard', () => {
  const light = weatherLevels({ rain: 0.3 }), heavy = weatherLevels({ rain: 1 });
  assert.ok(light.rainLight > 0); assert.equal(light.rainHeavy, 0);
  assert.equal(heavy.rainLight, 0); assert.ok(heavy.rainHeavy > 0);
  const storm = weatherLevels({ rain: 0.4, storm: 0.6 }); assert.ok(storm.rainHeavy > storm.rainLight);
  assert.deepEqual(Object.values(weatherLevels()), [0, 0, 0, 0, 0], 'a still dry day is silent');
});

test('a breeze gives way to a gale, and calm is silent', () => {
  assert.equal(weatherLevels({ wind: 0.05 }).windLight, 0);
  const breeze = weatherLevels({ wind: 0.4 }), gale = weatherLevels({ wind: 1 });
  assert.ok(breeze.windLight > 0); assert.equal(breeze.windStrong, 0);
  assert.equal(gale.windLight, 0); assert.ok(gale.windStrong > 0);
});

test('hail is heard by name, over quieter rain, and all is muffled under a roof', () => {
  const hail = weatherLevels({ rain: 0.8, words: 'hail' }), rain = weatherLevels({ rain: 0.8 });
  assert.ok(hail.hail > 0); assert.equal(rain.hail, 0);
  assert.ok(hail.rainHeavy + hail.rainLight < rain.rainHeavy + rain.rainLight);
  assert.ok(weatherLevels({ wind: 1, inside: true }).windStrong < weatherLevels({ wind: 1 }).windStrong * 0.4);
});

test('Calendaria keeps its fantasy weathers', () => {
  for (const id of ['rain', 'thunderstorm', 'blizzard', 'hail']) assert.ok(weatherIsOurs(id), id);
  for (const id of ['gravewind', 'black-sun', 'veilfall', 'clear', null]) assert.equal(weatherIsOurs(id), false, String(id));
});

test('near thunder is loud and quick, far thunder later and quieter', () => {
  const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };
  const near = thunderFor({ storm: 1, random: seq([0.1, 0.5, 0.5, 0.5, 0.5]) }), far = thunderFor({ storm: 0, random: seq([0.9, 0.2, 0.5, 0.5, 0.5, 0.5]) });
  assert.ok(near.near && !far.near); assert.ok(near.wait < 1000 && far.wait > 1500); assert.ok(near.volume > far.volume);
  for (let i = 0; i < 200; i++) { const t = thunderFor({ storm: Math.random() }); assert.ok(t.file && t.volume > 0 && t.rate > 0.5, JSON.stringify(t)); }
});

test('a scene keeps its recording', () => {
  assert.equal(weatherFile('hail', 'abc'), weatherFile('hail', 'abc'));
  assert.ok(WEATHER_LOOPS.hail.includes(weatherFile('hail', 'abc')));
  assert.equal(weatherFile('nothing'), null);
});
