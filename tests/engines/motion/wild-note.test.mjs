import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');

// Outdoor life on and no animal anywhere (Chylin's scene): the Animals panel says why, not nothing.
test('the Animals panel names why no animal shows', () => {
  const body = main.match(/const wildNote = \(\) => \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(body, 'wildNote is there');
  assert.match(body, /hotSetting\("wildlife"\) === false \|\| hotSetting\("wildlifeLocal"\) === false/, 'the settings off');
  assert.match(body, /quality < 2/, 'this screen\'s quality too low');
  assert.match(body, /wildOpen\.spots\.length \|\| wildOpen\.waters\.length/, 'only when no ground and no water was found');
  assert.match(body, /WILD_FLOORS\.has\(floor\)/, 'a floor they do not live on, or all roofed');
  assert.match(body, /Scene configuration → Animater/, 'and where to fix it');
  assert.match(main, /note: \(\) => wildNote\(\),/, 'the panel shows it');
});
