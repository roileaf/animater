import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const block = (from, span = 1400) => {
  const at = main.indexOf(from);
  assert.ok(at > 0, from);
  return main.slice(at, at + span);
};

test('one wall is put back by the same engine the scene-wide Repair uses', () => {
  const one = block('async function repairOneWall(');
  assert.match(one, /if \(!game\.user\?\.isGM \|\| !scene \|\| !doc\) return false;/, 'a GM only, as every other repair is');
  assert.match(one, /wallRepairPlan\(wallRepairGroup\(wallView\(doc\), views\)\)/,
    'the plan is the engine’s, so one wall and the whole scene can never put a wall back differently');
  assert.match(one, /if \(!updates\.length && !deletes\.length\) return false;/, 'nothing to do is said, not written');
  // A breach's part B goes before the wall is put back whole, the order the scene-wide Repair goes in.
  assert.ok(one.indexOf('deleteEmbeddedDocuments("Wall"') < one.indexOf('updateEmbeddedDocuments("Wall"'));
  assert.match(one, /animater: \{ wallRepair: true \}/, 'flagged as a repair, so the break hooks let it through');
  // It touches walls and nothing else: no tiles, no regions, no lights, no smoke — that is Repair all's job.
  for (const other of ['"Tile"', '"Region"', 'AmbientLight', 'clearSmokeNow']) {
    assert.ok(!one.includes(other), `${other} is left alone`);
  }
});

test('the button is on the wall’s own sheet, and the sheet closes behind it', () => {
  // The Breakable fieldset's own hook: the wall config has several, and this is the one that drew the button.
  const hook = block('if (!root || root.querySelector("[data-animater-break-wall]")) return;', 2400);
  assert.match(hook, /\[data-action="animater-repair-wall"\]/, 'the field the form drew');
  assert.match(hook, /repair\.disabled = game\.user\?\.isGM !== true;/, 'a player can see it and cannot press it');
  assert.match(hook, /await repairOneWall\(doc\?\.parent, doc\)/);
  assert.match(hook, /if \(done\) await app\.close\?\.\(\);/,
    'the form is showing a wall that no longer exists in that state, and saving it would write the old reading back');
});
