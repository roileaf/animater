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
  assert.match(main, /const soundOn = \(key\) => \{ try \{ return hotSetting\(key\) !== false; \} catch \{ return true; \} \};\s*if \(!\(\(token\.preview \|\| soundOn\("footstepSounds"\)\) && soundOn\("footstepSoundsLocal"\)\)\) level = 0;[\s\S]{0,800}?level \*= calm\.gain;[\s\S]{0,300}?if \(!\(level > 0\) && !\(mix\.tremor > 0\) && !marked\) return;/);
});

// A ridden horse holds its own hooves (engines/sound/carrier-sound.mjs), so its size-paced footstep is silenced the
// same way the switch silences one: level 0, with its timing and its tremor left alone.
test('a mount silences its footstep rather than skipping it, and only while the carrier sounds are on', () => {
  assert.match(main, /if \(!token\.preview && token\.carrier === "mount" && carriersOn\(\) && bothSettingsOn\("carrierSounds"\)\) level = 0;/);
  const step = main.slice(main.indexOf('footstep: (floor, at, token, kind = "step")'));
  const body = step.slice(0, step.indexOf('\n  },'));
  assert.ok(!/token\.carrier === "mount"[^\n]*return;/.test(body), 'silenced, never skipped: the tread still shakes the ground');
});

test('Footsteps outside combat: a world choice listed in Sound, skipped by the showcase, narrowing the range', () => {
  assert.match(registration('footstepsOutsideCombat'), /scope: "world", config: true, type: String, default: "normal"/);
  assert.ok(SETTINGS_TABS.find((t) => t.id === 'sound').rows.some((r) => r.world === 'footstepsOutsideCombat'));
  assert.match(main, /if \(!token\.preview\) calm = stepCalm\(hotSetting\("footstepsOutsideCombat"\), game\.combat\)/);
  assert.match(main, /range = calm\.range \?\? hotSetting\("footstepRange"\)/);
});
