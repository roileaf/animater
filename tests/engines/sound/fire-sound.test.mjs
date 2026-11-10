import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FIRE_SOUNDS, FIRE_VOICES, FIRE_REACH, FIRE_VOLUME, FIRE_PITCH, FIRES_HEARD, POT_FIRE, FIRE_CROSSFADE, firesHeard, fireVoiceFor, fireStart, fireNextIn, fireVoiceOf, soundsLight } from '../../../scripts/engines/sound/fire-sound.mjs';
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
  const at = (kind, x) => firesHeard([{ key: 'a', kind, x: 0, y: 0 }], [{ x, y: 0 }], { grid: 100 })[0]?.level ?? 0;
  assert.equal(at('torch', 0), 1);
  assert.ok(at('torch', 200) > 0 && at('torch', 450) === 0);
  assert.ok(FIRE_REACH.lantern < FIRE_REACH.torch && FIRE_VOLUME.lantern < FIRE_VOLUME.torch);
  assert.ok(FIRE_REACH.bonfire > FIRE_REACH.brazier && at('bonfire', 800) > 0);
  assert.equal(firesHeard([{ key: 'a', kind: 'lantern', x: 0, y: 0 }], [{ x: 0, y: 0 }])[0].voice, 'lantern');
});

// Roi: "it randomizes the sounds a bit so they dont all sound the same right?" Now each fire is its own loop.
test('each nearby fire is its own voice, the nearest few, with its own recording, pitch and start', () => {
  const hall = Array.from({ length: 8 }, (_, i) => ({ key: `light:${i}`, kind: 'torch', x: i * 60, y: 0 }));
  const heard = firesHeard(hall, [{ x: 0, y: 0 }], { grid: 100 });
  assert.equal(heard.length, FIRES_HEARD, 'only the nearest few play');
  assert.deepEqual(heard.map((h) => h.id), ['light:0', 'light:1', 'light:2', 'light:3'], 'the nearest, loudest first');
  for (const h of heard) {
    assert.ok(FIRE_SOUNDS.torch.includes(h.file));
    assert.ok(Math.abs(h.rate - 1) <= FIRE_PITCH + 1e-9);
  }
  const many = Array.from({ length: 40 }, (_, i) => fireVoiceFor(`light:${i}`, 'torch'));
  assert.ok(new Set(many.map((v) => v.file)).size > 1, 'fires spread over the recordings');
  assert.ok(new Set(many.map((v) => v.rate.toFixed(3))).size > 20, 'and their pitches differ');
  assert.deepEqual(fireVoiceFor('light:7', 'torch'), fireVoiceFor('light:7', 'torch'), 'a fire always sounds the same');
  assert.equal(fireStart(30, () => 0.5), 15);
  assert.equal(fireStart(undefined, () => 0.5), 0);
});

test('a cooking pot bubbles over a quiet brazier', () => {
  const heard = firesHeard([{ key: 'p', kind: 'pot', x: 0, y: 0 }], [{ x: 0, y: 0 }], { grid: 100 });
  assert.deepEqual(heard.map((h) => [h.voice, h.level]).sort(), [['brazier', POT_FIRE], ['pot', 1]]);
});

test('a light sounds by its own choice, else when it burns', () => {
  assert.equal(soundsLight({}, true), true);
  assert.equal(soundsLight({}, false), false);
  assert.equal(soundsLight({ fireSound: 'false' }, true), false);
  assert.equal(soundsLight({ fireSound: true }, false), true);
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
  assert.match(ui, /\{ world: "fireSounds", local: "fireSoundsLocal", extras: \["fireVolume", "heldFireSounds"\] \}/);
});

// Sherp: "Is there a way to remove torch/fire sounds for held torches? The sound gets a little repetitive when its being held for a long period."
test('held torches can be quieted on their own screen, leaving fires on the map', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /registerSetting\("heldFireSounds", \{ name: "Held torches crackle",[^}]*scope: "client", config: true, type: Boolean, default: true \}\)/);
  assert.match(main, /if \(kind !== "torch" && kind !== "lantern"\) continue;\s*if \(hotSetting\("heldFireSounds"\) === false\) continue;/, 'only the held ones are skipped');
});

test('no short torch loop; a long-burning fire crossfades from one recording into the next', () => {
  assert.equal(FIRE_SOUNDS.torch.length, 2);
  assert.ok(!FIRE_SOUNDS.torch.some((f) => f.includes('497195')), 'the nine-second loop is gone');
  assert.ok(!existsSync(new URL('../../../assets/sounds/places/fire/fire-torch-497195-0.ogg', import.meta.url)));
  for (const voice of FIRE_VOICES) {
    const turns = [0, 1, 2, 3].map((turn) => fireVoiceFor('token:abc', voice, turn));
    for (let i = 1; i < turns.length; i++) assert.notEqual(turns[i].file, turns[i - 1].file, `${voice}: each turn another recording`);
    assert.ok(turns.every((t) => t.rate === turns[0].rate), `${voice}: the same fire keeps its pitch`);
  }
  assert.deepEqual(fireVoiceFor('light:7', 'torch', 0), fireVoiceFor('light:7', 'torch'), 'turn 0 is the fire as before');
  assert.equal(fireNextIn(30, 15, 1), 15 - FIRE_CROSSFADE, 'begins the crossfade as the recording nears its end');
  assert.equal(fireNextIn(30, 0, 2), 15 - FIRE_CROSSFADE, 'sooner when it plays faster');
  assert.equal(fireNextIn(30, 29.5, 1), FIRE_CROSSFADE, 'never at once');
  assert.equal(fireNextIn(undefined), null, 'unknown length: it just loops');
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /now >= voice\.nextAt && !voice\.starting && volume > 0\.004\) startFireVoice\(voice, h, \(voice\.turn \?\? 0\) \+ 1\)/);
  assert.match(main, /if \(voice\.sound\) stopVoice\(voice, fade\);\s*voiceStarted\(voice, sound, voice\.volume, turn \? fade : 1200\);/, 'the old fades out as the new fades in');
});
