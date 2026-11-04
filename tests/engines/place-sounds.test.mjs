import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PLACE_SOUNDS, PLACE_VOLUME, PLACE_REACH, placeHeard, spotsHeard, placeFile } from '../../scripts/engines/motion/place-sounds.mjs';
import { wildSound } from '../../scripts/engines/motion/wildlife.mjs';

const onDisk = (file) => existsSync(new URL(`../../${file.replace('modules/animater/', '')}`, import.meta.url));
const room = [0, 0, 400, 0, 400, 400, 0, 400];

test('every place sound and town call is a file that ships, with its credit beside it', () => {
  for (const [kind, files] of Object.entries(PLACE_SOUNDS)) {
    assert.ok(files.length >= 1, kind); assert.ok(PLACE_VOLUME[kind] > 0 && PLACE_REACH[kind] > 0, kind);
    for (const file of files) assert.ok(onDisk(file), file);
  }
  for (const kind of ['henCluck', 'catMeow', 'dogBark', 'pigeonCoo']) assert.ok(onDisk(wildSound(kind)), kind);
  assert.ok(existsSync(new URL('../../assets/sounds/places/License.txt', import.meta.url)));
  assert.ok(existsSync(new URL('../../assets/sounds/wildlife/town/License.txt', import.meta.url)));
});

test('a place is fullest inside it, fades with distance and stops at its reach', () => {
  assert.equal(placeHeard('tavern', [room], [{ x: 200, y: 200 }]).level, 1);
  const near = placeHeard('tavern', [room], [{ x: 500, y: 200 }]).level, far = placeHeard('tavern', [room], [{ x: 900, y: 200 }]).level;
  assert.ok(near > far && far > 0);
  assert.equal(placeHeard('tavern', [room], [{ x: 5000, y: 200 }]).level, 0);
  assert.equal(placeHeard('nothing', [room], [{ x: 200, y: 200 }]).level, 0);
});

test('flies are as loud as they are many, and only close by', () => {
  const ear = [{ x: 0, y: 0 }];
  assert.equal(spotsHeard('flies', [{ x: 0, y: 0, strength: 0 }], ear).level, 0);
  assert.equal(spotsHeard('flies', [{ x: 0, y: 0, strength: 1 }], ear).level, 1);
  assert.ok(spotsHeard('flies', [{ x: 100, y: 0, strength: 1 }], ear).level > spotsHeard('flies', [{ x: 100, y: 0, strength: 0.4 }], ear).level);
  assert.equal(spotsHeard('flies', [{ x: 1000, y: 0, strength: 1 }], ear).level, 0);
});

test('a scene keeps its recording from visit to visit', () => {
  assert.equal(placeFile('tavern', 'scene-a'), placeFile('tavern', 'scene-a'));
  assert.equal(placeFile('nothing', 'scene-a'), null);
});
