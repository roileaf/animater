import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installSoundPitch } from '../../../scripts/engines/sound/sound-pitch.mjs';
import { SETTINGS_TABS } from '../../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8').split(/\r?\n/);

test('everything main plays asks the switch first, near where it plays', () => {
  const plays = /new foundry\.audio\.Sound\(|canvas\.sounds\??\.playAtPosition|game\.audio\.play\(/;
  const found = [];
  main.forEach((line, i) => { if (!plays.test(line) || /\.load\(\)\.catch/.test(line)) return; found.push(i + 1); assert.ok(main.slice(Math.max(0, i - 13), i + 1).join('\n').includes('soundsOn()'), `main.mjs:${i + 1} plays with no soundsOn() near it`); });
  assert.ok(found.length >= 11, 'it found the places sounds are played');
});

test('the switch is both the table\'s and each player\'s, first in the Sound tab', () => {
  const text = main.join('\n');
  assert.ok(text.includes('registerSetting("animaterSounds", {') && text.includes('registerSetting("animaterSoundsLocal", {'));
  assert.ok(text.includes('hotSetting("animaterSounds") !== false && hotSetting("animaterSoundsLocal") !== false'));
  assert.deepEqual(SETTINGS_TABS.find((tab) => tab.id === 'sound').rows[0], { world: 'animaterSounds', local: 'animaterSoundsLocal' });
});

test('an animation\'s sound goes quiet on a screen with the switch off, and another module\'s does not', () => {
  const handlers = new Map(), hooks = { on: (name, fn) => { handlers.set(name, fn); return name; }, off: () => {} };
  class Sound { _createNodes() { return null; } }
  let off = true;
  const remove = installSoundPitch({ hooks, Sound, silent: () => off });
  const ours = { animaterSound: true, volume: 0.6, file: 'a.ogg' }, theirs = { volume: 0.6, file: 'b.ogg' };
  handlers.get('createSequencerSound')(ours); handlers.get('createSequencerSound')(theirs);
  assert.equal(ours.volume, 0);
  assert.equal(theirs.volume, 0.6);
  off = false;
  const back = { animaterSound: true, volume: 0.6, file: 'a.ogg' };
  handlers.get('createSequencerSound')(back);
  assert.equal(back.volume, 0.6, 'back on, it plays');
  remove();
});

test('every sound of an animation is marked as Animater\'s, except a preview someone clicked', () => {
  const runtime = readFileSync(new URL('../../../scripts/engines/playback/runtime.mjs', import.meta.url), 'utf8');
  assert.ok(runtime.includes('...(preview ? {} : { animaterSound: true })'));
  const flash = readFileSync(new URL('../../../scripts/engines/flash/flash-combat.mjs', import.meta.url), 'utf8');
  assert.ok(flash.includes('host.silent?.()'));
});
