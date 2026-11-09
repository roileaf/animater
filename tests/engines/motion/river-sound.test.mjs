import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RIVER_SOUNDS, NIGHT_SOUNDS, NIGHT_VOLUME, distanceToArea, riverHeard, riverFile, nightLevel, nightFile } from '../../../scripts/engines/motion/river-sound.mjs';

const square = [0, 0, 1000, 0, 1000, 1000, 0, 1000];

test('every river sound is there and credited', () => {
  for (const f of [...Object.values(RIVER_SOUNDS).flat(), ...NIGHT_SOUNDS]) {
    const here = new URL(`../../../${f.replace('modules/animater/', '')}`, import.meta.url);
    assert.ok(fs.existsSync(here), f);
    assert.ok(fs.readFileSync(new URL('License.txt', here), 'utf8').includes(f.split('/').at(-1)), `${f} credited`);
  }
});

test('how far from the water: nothing inside, the nearest edge out of it', () => {
  assert.equal(distanceToArea({ x: 500, y: 500 }, square), 0);
  assert.equal(distanceToArea({ x: 1300, y: 500 }, square), 300);
  assert.equal(distanceToArea({ x: 1300, y: 1400 }, square), 500);
});

test('a river is loudest at the bank, fades with distance, and swift water carries further', () => {
  const heard = (speed, x) => riverHeard([{ speed, areas: [square] }], [{ x, y: 500 }], { grid: 100 })[speed].level;
  assert.equal(heard('gentle', 500), 1);
  assert.ok(heard('gentle', 1200) < 1 && heard('gentle', 1200) > heard('gentle', 1600));
  assert.equal(heard('gentle', 2100), 0, 'past 10 squares');
  assert.ok(heard('swift', 2100) > 0, 'swift still heard');
});

test('each current has its own voice, the nearest listener and water deciding it', () => {
  const r = riverHeard([{ speed: 'gentle', areas: [square] }, { speed: 'swift', areas: [[5000, 0, 6000, 0, 6000, 1000, 5000, 1000]] }], [{ x: 1200, y: 500 }, { x: 4500, y: 500 }], { grid: 100 });
  assert.equal(r.gentle.from.x, 1200); assert.equal(r.swift.from.x, 4500);
  assert.equal(riverHeard([{ speed: 'gentle', areas: [square] }], [], { grid: 100 }).gentle.level, 0, 'no ears');
});

test('the night is constant in the dark, gone by day or in the cold, low from indoors', () => {
  assert.equal(nightLevel({ night: 1 }), NIGHT_VOLUME);
  assert.equal(nightLevel({ night: 0 }), 0);
  assert.ok(nightLevel({ night: 0.5 }) < NIGHT_VOLUME, 'fading at dusk');
  assert.equal(nightLevel({ night: 1, warm: false }), 0);
  assert.ok(nightLevel({ night: 1, inside: true }) < NIGHT_VOLUME * 0.4);
  assert.ok(NIGHT_SOUNDS.includes(nightFile('abc'))); assert.equal(nightFile('abc'), nightFile('abc'));
});

test('a scene keeps its recording', () => {
  assert.equal(riverFile('swift', 'abc'), riverFile('swift', 'abc'));
  assert.ok(RIVER_SOUNDS.swift.includes(riverFile('swift', 'abc')));
  assert.equal(riverFile('nothing', 'abc'), null);
});

test('a scene can keep its nights quiet', () => {
  assert.ok(nightLevel({ night: 1 }) > 0);
  assert.equal(nightLevel({ night: 1, quiet: true }), 0);
});

// Roi: still water had no sound. A swamp plays one, from the two picked: insects with slow mud bubbles, or the mud alone.
// Then: "ponds should not play SWAMP!" and "plain ponds should play subtle water like a quiet lake sound": a plain pond laps quietly (#1 picked).
import { RIVER_SOUNDS as WATER_SOUNDS, riverHeard as heardOf, riverFile as fileOf } from '../../../scripts/engines/motion/river-sound.mjs';
import { existsSync, readFileSync as readText } from 'node:fs';
const onDisk = (file) => existsSync(new URL(`../../../${file.replace('modules/animater/', '')}`, import.meta.url));
test('still water is heard close by: a swamp or a quiet lake', () => {
  for (const speed of ['swamp', 'lake']) {
    const pond = { speed, areas: [[0, 0, 200, 0, 200, 200, 0, 200]] };
    const near = heardOf([pond], [{ x: 300, y: 100 }], { grid: 100 }), far = heardOf([pond], [{ x: 900, y: 100 }], { grid: 100 });
    assert.ok(near[speed].level > 0.5 && far[speed].level === 0, `${speed} carries a few squares, not far`);
    assert.equal(near.gentle.level, 0);
    for (const file of WATER_SOUNDS[speed]) assert.ok(onDisk(file), file);
    assert.ok(WATER_SOUNDS[speed].includes(fileOf(speed, 'scene')));
  }
  assert.equal(WATER_SOUNDS.swamp.length, 2);
  assert.deepEqual(WATER_SOUNDS.lake, ['modules/animater/assets/sounds/wildlife/pond/pond-lake-318064-0.ogg']);
  const credits = readText(new URL('../../../assets/sounds/wildlife/pond/License.txt', import.meta.url), 'utf8');
  for (const id of ['547690', '415608', '318064']) assert.match(credits, new RegExp(`sounds/${id}/ \\(CC0 1\\.0\\)`));
});
test('a pond styled as a Swamp plays the swamp, any other pond the lake', () => {
  const main = readText(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const swampWater = \(own\) => own\?\.textureStyles\?\.water === "swamp";/);
  assert.match(main, /speed: !own\.flowTo \? \(swampWater\(region\.flags\?\.\[ID\]\) \? "swamp" : "lake"\) :/);
  assert.match(main, /stopVoice\(riverVoices\.swamp\); stopVoice\(riverVoices\.lake\);/);
});
