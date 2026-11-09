import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FIRE_SOUNDS, FIRE_VOICES, FIRE_REACH, FIRE_VOLUME, POT_FIRE, fireHeard, fireFile, fireVoiceOf, soundsLight } from '../../../scripts/engines/sound/fire-sound.mjs';
import { FIRE_KINDS, fireKindOf, fireTongues } from '../../../scripts/engines/motion/light-flames.mjs';

// Roi: "lets add sfx to torches, lanterns, campfires and braziers and cooking pots too"; of the audition, "4 sounds bad the rest are great".
const onDisk = (file) => existsSync(new URL(`../../../${file.replace('modules/animater/', '')}`, import.meta.url));

test('every kind of fire has its loops on disk, credited, and the bad lantern buzz (#4) is not among them', () => {
  const credits = readFileSync(new URL('../../../assets/sounds/places/fire/License.txt', import.meta.url), 'utf8');
  for (const voice of FIRE_VOICES) {
    assert.ok(FIRE_SOUNDS[voice].length > 0, voice);
    for (const file of FIRE_SOUNDS[voice]) {
      assert.ok(onDisk(file), file);
      const id = file.match(/-(\d+)-0\.ogg$/)[1];
      assert.match(credits, new RegExp(`sounds/${id}/ \\(CC0 1\\.0\\)`), id);
    }
  }
  assert.deepEqual(FIRE_SOUNDS.lantern, FIRE_SOUNDS.torch, 'a lantern plays a torch loop');
  assert.ok(!Object.values(FIRE_SOUNDS).flat().some((f) => f.includes('185419')));
  assert.equal(FIRE_SOUNDS.bonfire.length, 4);
  assert.equal(FIRE_SOUNDS.pot.length, 4);
});

test('a fire is heard close by and fades within its reach; a lantern quieter and shorter than a torch, a campfire furthest', () => {
  const at = (kind, x) => fireHeard([{ kind, x: 0, y: 0 }], [{ x, y: 0 }], { grid: 100 })[fireVoiceOf(kind)].level;
  assert.equal(at('torch', 0), 1);
  assert.ok(at('torch', 200) > 0 && at('torch', 450) === 0);
  assert.ok(FIRE_REACH.lantern < FIRE_REACH.torch && FIRE_VOLUME.lantern < FIRE_VOLUME.torch);
  assert.ok(FIRE_REACH.bonfire > FIRE_REACH.brazier && at('bonfire', 800) > 0);
  const heard = fireHeard([{ kind: 'torch', x: 0, y: 0 }, { kind: 'torch', x: 1000, y: 0 }], [{ x: 950, y: 0 }], { grid: 100 });
  assert.deepEqual(heard.torch.at, { x: 1000, y: 0 }, 'the nearest fire of its kind');
});

test('a cooking pot bubbles over a quiet brazier', () => {
  const heard = fireHeard([{ kind: 'pot', x: 0, y: 0 }], [{ x: 0, y: 0 }], { grid: 100 });
  assert.equal(heard.pot.level, 1);
  assert.equal(heard.brazier.level, POT_FIRE);
});

test('a light sounds by its own choice, else when it burns; one loop a scene', () => {
  assert.equal(soundsLight({}, true), true);
  assert.equal(soundsLight({}, false), false);
  assert.equal(soundsLight({ fireSound: 'false' }, true), false);
  assert.equal(soundsLight({ fireSound: true }, false), true);
  assert.equal(fireFile('bonfire', 'scene-a'), fireFile('bonfire', 'scene-a'));
  assert.equal(fireVoiceOf('nonsense'), 'torch');
});

test('lantern and cooking pot are fire kinds; a pot burns a brazier\'s bed, a lantern one tongue', () => {
  assert.ok(FIRE_KINDS.includes('lantern') && FIRE_KINDS.includes('pot'));
  assert.equal(fireKindOf('pot'), 'pot');
  assert.deepEqual(fireTongues('pot', 100), fireTongues('brazier', 100));
  assert.equal(fireTongues('lantern', 100).length, 1);
});

test('main plays them: a Fire sounds setting with its volume, a Sound switch and the new kinds on the light', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /skyPair\("fireSounds", "fireSoundsLocal", "Fire sounds"/);
  assert.match(main, /registerSetting\("fireVolume"/);
  assert.match(main, /autoOnOff\("fireSound", "Sound"/);
  assert.match(main, /\["pot", "Cooking pot", /);
  assert.match(main, /\["lantern", "Lantern", /);
  assert.match(main, /if \(kind !== "torch" && kind !== "lantern"\) continue;/, 'held torches and lanterns are heard');
  const ui = readFileSync(new URL('../../../scripts/ui/settings-window.mjs', import.meta.url), 'utf8');
  assert.match(ui, /\{ world: "fireSounds", local: "fireSoundsLocal", extras: \["fireVolume"\] \}/);
});
