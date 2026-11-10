import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { freshWaterFor, duckStep } from '../../../scripts/engines/motion/pond-life.mjs';

// Roi: "why are ducks show on sea?" A duck put up from the river came down on the sea; one paddled out of the river mouth.

const river = { x: 100, y: 100 }, sea = { x: 900, y: 100 };
const isSea = (p) => p.x >= 500;

test('fresh water for a kind: any spot that is not the sea and not kept from it', () => {
  assert.equal(freshWaterFor([river, sea], { sea: isSea }), true);
  assert.equal(freshWaterFor([sea], { sea: isSea }), false, 'a sea-only map: ducks may wait on the sea');
  assert.equal(freshWaterFor([river, sea], { sea: isSea, kept: (p) => p === river }), false, 'the river kept from them');
});

test('a duck put up over the coast does not come down on the sea while there is fresh water', () => {
  const ok = (x, y) => (x < 500 ? true : !freshWaterFor([river, sea], { sea: isSea }));
  // Flown out over the sea, its flight done: it turns back for the river rather than landing there.
  const q = duckStep({ x: 800, y: 100, mode: 'fly', vx: 1, vy: 0, t: 3.6, h: 0.1, tries: 0, fromX: 100, fromY: 100, a: 0 }, { dt: 0.01, ok, random: () => 0.5 });
  assert.equal(q.mode, 'fly');
  assert.ok(q.vx < 0, 'heads back toward the river');
});

test('main keeps ducks and frogs off the sea when the map has fresh water for them', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /if \(\(kind === "ducks" \|\| kind === "frogs"\) && ground\?\.inWater\(x, y\) && freshFor\(ground, kind\) && seaHere\(ground, x, y\)\) return false;/);
  assert.match(main, /freshWaterFor\(ground\.waters, \{ sea: \(p\) => seaHere\(ground, p\.x, p\.y\), kept: \(p\) => keptOut\(kind, p\) \}\)/);
});
