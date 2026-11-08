import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');

// A river's, the surf's or a waterfall's loop that dips to silence for a moment (the river's outline redrawn as it is placed,
// the listener settling as a scene loads) is faded out and kept going, not stopped and started again from its beginning.
test('a quiet loop fades and holds before it stops, and is never left playing unstopped', () => {
  const at = main.match(/const voiceAt = \(voice, volume, fadeMs = 450\) => \{([\s\S]*?)\n\};/);
  assert.ok(at, 'voiceAt is there');
  assert.match(at[1], /fade\(0, \{ duration: 700 \}\)/, 'gone quiet, it fades out');
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
