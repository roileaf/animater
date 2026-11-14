import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const root = new URL('../../scripts/', import.meta.url);

const sources = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const at = new URL(name, dir);
    if (statSync(at).isDirectory()) walk(new URL(`${name}/`, dir));
    else if (name.endsWith('.mjs')) sources.push([name, readFileSync(at, 'utf8')]);
  }
};
walk(root);

// Reported by RoyRandom on a v14 world (issue #24): Animater worked, but its startup printed two
// compatibility warnings. Foundry drops a deprecated API two majors on, so both are gone for good.
test('nothing asks Foundry for a wall sense type', () => {
  for (const [name, text] of sources) {
    assert.ok(!/WALL_SENSE_TYPES/.test(text), `${name}: CONST.WALL_SENSE_TYPES is a v14 proxy onto CONST.EDGE_SENSE_TYPES, and warns on every read`);
  }
});

test('darkness is read at one elevated point, not a point and an elevation', () => {
  for (const [name, text] of sources) {
    for (const call of text.match(/getDarknessLevel\?*\.?\([^)]*\)/g) ?? []) {
      assert.match(call, /^getDarknessLevel\?*\.?\(\{[^)]*elevation/, `${name}: ${call} — the second argument has been deprecated since v13; pass { x, y, elevation }`);
    }
  }
});
