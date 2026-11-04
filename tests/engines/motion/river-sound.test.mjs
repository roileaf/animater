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
