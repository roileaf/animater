import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { thunderHeard, WEATHER_LOOPS, THUNDER, weatherLevels, weatherIsOurs, thunderFor, weatherFile } from '../../../scripts/engines/motion/weather-sound.mjs';

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
  assert.deepEqual(Object.values(weatherLevels()), [0, 0, 0, 0, 0, 0], 'a still dry day is silent');
});

test('a breeze gives way to a gale, and calm is silent', () => {
  for (const calm of [0, 0.2, 0.3]) assert.equal(weatherLevels({ wind: calm }).windLight, 0, `calm, light and a breeze are silent: ${calm}`);
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

test('not every flash is heard, more of them in the thick of a storm', () => {
  assert.equal(thunderHeard({ storm: 0, random: () => 0.6 }), false, 'far off, silent');
  assert.equal(thunderHeard({ storm: 1, random: () => 0.6 }), true);
  assert.equal(thunderHeard({ storm: 1, random: () => 0.9 }), false, 'even then, not every one');
});

test('thunder goes by how near it struck: close is at once, as loud as it goes, with a boom under it', async () => {
  const { strikeNearness, thunderClose } = await import('../../../scripts/engines/motion/weather-sound.mjs');
  assert.equal(strikeNearness({ x: 0, y: 0 }, { x: 0, y: 0 }, 100), 1);
  assert.equal(strikeNearness({ x: 0, y: 0 }, { x: 1400, y: 0 }, 100), 0);
  assert.ok(Math.abs(strikeNearness({ x: 0, y: 0 }, { x: 700, y: 0 }, 100) - 0.5) < 1e-9);
  const on = thunderClose({ near: 1 }), off = thunderClose({ near: 0.3 });
  assert.equal(on.volume, 1);
  assert.ok(on.wait < 30 && off.wait > on.wait);
  assert.ok(on.file && on.under.volume === 1 && on.under.rate < 0.7);
});

test('a blizzard has its own howl in place of the wind, muffled under a roof; plain snow does not', () => {
  const storm = weatherLevels({ wind: 1, words: 'animater.blizzard' }), inside = weatherLevels({ wind: 1, words: 'blizzard', inside: true }), snow = weatherLevels({ wind: 1, words: 'animater.snow' });
  assert.ok(storm.blizzard > 0);
  assert.equal(storm.windStrong, 0);
  assert.equal(storm.windLight, 0);
  assert.ok(inside.blizzard < storm.blizzard);
  assert.ok(weatherLevels({ wind: 0, words: 'snowStorm' }).blizzard > 0, 'whatever the wind says');
  assert.equal(snow.blizzard, 0);
  assert.ok(snow.windStrong > 0);
  assert.equal(WEATHER_LOOPS.blizzard.length, 3);
});
