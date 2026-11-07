import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('only a creature set to swim bobs on the water; one standing in a water region holds still', () => {
  const main = fs.readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /swimming: \(token\) => token\.document\?\.movementAction === "swim",/);
});
