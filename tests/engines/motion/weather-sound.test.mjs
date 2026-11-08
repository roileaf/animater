import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEATHER_LOOPS, THUNDER, weatherLevels, weatherIsOurs, thunderGain, thunderPan, thunderReaches, thunderShape, weatherFile, weatherLoudness, louder } from '../../../scripts/engines/motion/weather-sound.mjs';

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

test('a scene keeps its recording', () => {
  assert.equal(weatherFile('hail', 'abc'), weatherFile('hail', 'abc'));
  assert.ok(WEATHER_LOOPS.hail.includes(weatherFile('hail', 'abc')));
  assert.equal(weatherFile('nothing'), null);
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

test('thunder follows one curve by distance, nothing about it stepping', () => {
  const at = (squares, span = 40) => thunderShape({ squares, span, random: () => 0.9 });
  let last = null;
  for (let squares = 0; squares <= 40; squares += 0.5) {
    const now = at(squares);
    if (last) {
      assert.ok(now.level <= last.level + 1e-9, 'quieter');
      assert.ok(last.level - now.level < 0.08, `no cliff at ${squares}: ${last.level} to ${now.level}`);
      assert.ok(now.wait >= last.wait, 'later');
      assert.ok(now.wait - last.wait < 150, `no jump in the wait at ${squares}`);
      assert.ok((now.under?.volume ?? 0) <= (last.under?.volume ?? 0) + 1e-9, 'its boom fading');
      assert.ok((now.cutoff ?? 18000) <= (last.cutoff ?? 18000) + 1e-9, 'duller');
    }
    last = now;
  }
  const over = at(0), far = at(40);
  assert.ok(over.wait < 60, 'overhead: at once');
  assert.ok(over.under.volume > 0.5, 'with a boom');
  assert.equal(over.cutoff, null, 'and all its crack');
  assert.equal(far.under, null, 'none far off');
  assert.ok(far.level < over.level / 5, 'far off, much quieter');
  assert.ok(far.level > 0.05, 'and still there');
  assert.ok(thunderShape({ squares: 5000, span: 40, random: () => 0 }).wait <= 6500, 'not forever');
});

test('how far is far goes by the map', () => {
  const small = thunderShape({ squares: 15, span: 16, random: () => 0.9 }), big = thunderShape({ squares: 15, span: 70, random: () => 0.9 });
  assert.ok(small.level < big.level, 'across a small map is far; across a part of a big one is not');
  assert.ok(thunderShape({ squares: 5, span: 2, random: () => 0.9 }).level > 0.1, 'a tiny map is not all far');
});

test('every thunder recording is evened out, and only distance says how loud', () => {
  for (const file of [...THUNDER.close, ...THUNDER.far]) assert.ok(thunderGain(file) > 0.5, file);
  assert.ok(thunderGain(THUNDER.far[0]) > 3, 'the far one is much the quietest as recorded');
  assert.equal(thunderGain('thunderNew-1-0.ogg'), 1, 'one not yet measured plays as it is');
  const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };
  const distant = thunderShape({ squares: 36, span: 40, random: seq([0, 0, 0.5, 0.5]) }), near = thunderShape({ squares: 36, span: 40, random: seq([0.99, 0, 0.5, 0.5]) });
  assert.equal(distant.level, near.level, 'whichever recording it is');
  assert.notEqual(distant.file, near.file);
  assert.ok(Math.abs(distant.volume / thunderGain(distant.file) - near.volume / thunderGain(near.file)) < 1e-9);
});

test('it is heard from its direction, however far', () => {
  const ear = { x: 1000, y: 1000 };
  assert.equal(thunderPan(ear, { x: 1000, y: 200 }), 0, 'straight up the map: both ears');
  assert.ok(Math.abs(thunderPan(ear, { x: 3000, y: 1000 }) - 0.8) < 1e-9, 'to the right');
  assert.ok(Math.abs(thunderPan(ear, { x: -9000, y: 1000 }) + 0.8) < 1e-9, 'to the left, far or not');
  assert.ok(Math.abs(thunderPan(ear, { x: 1200, y: 1000 }) - 0.8) < 1e-9, 'two squares to the right already is');
  assert.ok(Math.abs(thunderPan(ear, { x: 1050, y: 1000 })) < 0.25, 'almost on top: both ears');
  assert.equal(thunderPan(ear, ear), 0);
});

test('near thunder is always heard; far off, not always', () => {
  assert.equal(thunderReaches({ squares: 10, span: 40, random: () => 0.99 }), true);
  assert.equal(thunderReaches({ squares: 38, span: 40, storm: 0, random: () => 0.9 }), false);
  assert.equal(thunderReaches({ squares: 38, span: 40, storm: 1, random: () => 0.9 }), true);
});

test('a strike beside you booms at once', async () => {
  const { thunderOnTopOf } = await import('../../../scripts/engines/motion/weather-sound.mjs');
  const wait = (squares) => thunderShape({ squares, span: 32, random: () => 0.99 }).wait;
  assert.equal(wait(0), 20);
  assert.equal(wait(1), 20, 'the next square: at once');
  assert.ok(wait(1.5) < 100);
  assert.ok(wait(2) <= 160, 'two squares: still all but at once');
  assert.ok(wait(3) > wait(2) && wait(10) > wait(3), 'and further off, later');
  assert.equal(thunderOnTopOf(3), true, 'nothing makes these wait');
  assert.equal(thunderOnTopOf(4), false);
});

test('each player sets how loud the weather is for them: a percent, 100 as recorded', () => {
  assert.equal(weatherLoudness(100), 1);
  assert.equal(weatherLoudness(50), 0.5);
  assert.equal(weatherLoudness(0), 0, 'zero is silent');
  for (const odd of [undefined, null, 'x', NaN]) assert.equal(weatherLoudness(odd), 1, 'unset or broken: as recorded');
  assert.equal(weatherLoudness(-20), 0); assert.equal(weatherLoudness(250), 1, 'never past as recorded');
  const levels = weatherLevels({ rain: 1, wind: 0.9, words: 'hail' }), half = louder(levels, weatherLoudness(50));
  for (const [kind, v] of Object.entries(levels)) assert.equal(half[kind], v * 0.5, kind);
  assert.deepEqual(Object.values(louder(levels, 0)), [0, 0, 0, 0, 0, 0], 'at zero every loop falls silent');
});
