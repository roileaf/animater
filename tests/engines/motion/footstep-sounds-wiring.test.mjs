import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETTINGS_TABS } from '../../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const registration = (key) => main.match(new RegExp(`registerSetting\\("${key}", \\{[\\s\\S]*?\\n  \\}\\);`))?.[0] ?? '';

test('Footstep sounds: a world switch and an on-my-screen one, listed in Sound', () => {
  assert.match(registration('footstepSounds'), /name: "Footstep sounds"[\s\S]*scope: "world", config: true, type: Boolean, default: true/);
  assert.match(registration('footstepSoundsLocal'), /name: "Footstep sounds on my screen"[\s\S]*scope: "client", config: true, type: Boolean, default: true/);
  const sound = SETTINGS_TABS.find((t) => t.id === 'sound');
  assert.ok(sound.rows.some((r) => r.world === 'footstepSounds' && r.local === 'footstepSoundsLocal'));
});

test('off silences the step (level 0) but keeps its timing and tremor; the showcase passes the world switch', () => {
  assert.match(main, /const soundOn = \(key\) => \{ try \{ return hotSetting\(key\) !== false; \} catch \{ return true; \} \};\s*if \(!\(\(token\.preview \|\| soundOn\("footstepSounds"\)\) && soundOn\("footstepSoundsLocal"\)\)\) level = 0;\s*if \(!\(level > 0\) && !\(mix\.tremor > 0\)\) return;/);
});
