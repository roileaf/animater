import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');

// A river's, the surf's or a waterfall's loop that dips to silence for a moment (the river's outline redrawn as it is placed,
// the listener settling as a scene loads) is faded out and kept going, not stopped and started again from its beginning.
test('a quiet loop fades and holds before it stops, and is never left playing unstopped', () => {
  const at = main.match(/const voiceAt = \(voice, volume, fadeMs = \d+\) => \{([\s\S]*?)\n\};/);
  assert.ok(at, 'voiceAt is there');
  assert.match(at[1], /fadeVoice\(voice, 0, 700\)/, 'gone quiet, it fades out');
  assert.match(at[1], /now - voice\.quietSince > QUIET_HOLD_MS\) \{[^}]*stopVoice\(voice/, 'and stops only after the hold');
  assert.match(main, /const QUIET_HOLD_MS = (\d+);/);
  assert.ok(Number(main.match(/const QUIET_HOLD_MS = (\d+);/)[1]) >= 5000, 'a hold of some seconds');
  const rivers = main.match(/const tickRivers = \(\) => \{([\s\S]*?)\n\};/)[1], places = main.match(/const tickPlaces = \(\) => \{([\s\S]*?)\n\};/)[1];
  for (const [name, body] of [['rivers', rivers], ['places', places]]) {
    assert.match(body, /voiceAt\(voice, volume\)/, `${name} hold their loops`);
    assert.doesNotMatch(body, /catch \{ voice\.sound = null; \}/, `${name} never drop a playing loop without stopping it`);
  }
  assert.match(rivers, /groundOf\(\)\.now\.ice > 0\.5/, 'a river goes silent only once frozen over, as the surf and falls do');
});

// Foundry's Sound#fade cancels a fade under way and starts from the gain's reading; a fade asked every 0.4 s against a longer
// one cut each short, so the loop pulsed 2.5 times a second (Paulomat's video). Each loop now eases from the level last set,
// lets a fade finish, and leaves a change too small to hear.
test('a loop is faded from the level last set, a fade let finish, and no loop is faded every check', () => {
  const fade = main.match(/const fadeVoice = \(voice, volume, ms\) => \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(fade, 'fadeVoice is there');
  assert.match(fade, /voice\.rampEnd \?\? 0\) > now\) return/, 'a fade under way is let finish');
  assert.match(fade, /Math\.abs\(volume - last\) <= /, 'a change too small to hear is let be');
  assert.match(fade, /fade\(volume, \{ duration: ms, from: last \}\)/, 'it fades from the level last set');
  // every looping sound goes through it: none fades itself straight off a check
  for (const name of ['tickRivers', 'tickPlaces', 'tickPools']) {
    const body = main.match(new RegExp(`const ${name} = \\(\\) => \\{([\\s\\S]*?)\\n\\};`))[1];
    assert.doesNotMatch(body, /(voice|poolSound)\.sound?\.?fade\(volume/, `${name} never fades a loop straight off a check`);
  }
  assert.doesNotMatch(main, /nightVoice\.sound\.fade\(volume/);
  assert.doesNotMatch(main, /voice\.sound\.fade\(volume, \{ duration: 2500 \}\)/, 'nor do the weather loops');
});
