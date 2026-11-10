import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { duckStep } from '../../../scripts/engines/motion/pond-life.mjs';

// Roi: "i think the duck is mising the 'head in the water' idle animatiob". It played, but its picture was the
// swimming duck with the head left off, which hardly shows from above.
test('a paddling duck tips up to feed now and then, and stops while it does', () => {
  let seed = 7; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let q = { x: 500, y: 500, a: 0, turn: 0, wait: 0, hen: false, mode: 'swim', up: 0, h: 0 }, tipped = 0, stillWhileUp = true;
  for (let i = 0; i < 60 * 120; i++) {
    const before = { x: q.x, y: q.y };
    q = duckStep(q, { dt: 1 / 60, grid: 100, random });
    if (q.up > 0) { tipped += 1 / 60; if (q.x !== before.x || q.y !== before.y) stillWhileUp = false; }
  }
  assert.ok(tipped > 10, `tipped up ${tipped.toFixed(1)} s of two minutes`);
  assert.ok(stillWhileUp, 'it does not paddle along while its head is under');
});

test('tipped up it draws its own pose: rump and tail up, head under, feet kicking in two strokes', () => {
  const src = readFileSync(new URL('../../../scripts/engines/motion/pond-life.mjs', import.meta.url), 'utf8');
  assert.match(src, /function duckTipped\(hen, kick\)/);
  assert.match(src, /duckUp: \[false, true\]\.map\(\(h\) => \[0\.25, 0\.8\]\.map\(\(kick\) => tex\(duckTipped\(h, kick\)\)\)\)/);
  assert.match(src, /feeding \? t\.duckUp\[q\.hen \? 1 : 0\]\[Math\.floor\(time \* 5 \+ q\.phase\) % 2\]/);
  assert.doesNotMatch(src, /if \(feeding\) return;/, 'no longer the swimming duck with its head left off');
});
