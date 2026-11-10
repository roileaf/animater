import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Roi: "shouldnt these match?" Scene configuration's amount drop-downs (None, Few, Usual, More, Many) could not show
// the Animals panel's exact counts: Frogs set to 1 showed None, and saving the form would have written None over it.
test('Scene configuration leaves animal counts and sizes to the Animals panel', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.ok(!main.includes('["none", "None"], ["few", "Few"], ["", "Usual number"]'), 'no amount drop-downs that could overwrite a count');
  assert.ok(!main.includes('${row("frogs", "Frogs")}'));
  assert.match(main, /are set in the Animals panel \(the paw button in the scene controls\), kind by kind\./);
});
