import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { UNDERGROUND_SOUNDS, undergroundSound, heardFrom } from '../../../scripts/engines/motion/underground-sounds.mjs';

test('every underground sound is a file Animater ships', () => {
  for (const [kind, files] of Object.entries(UNDERGROUND_SOUNDS)) {
    assert.ok(files.length, `${kind} has recordings`);
    for (const f of files) assert.ok(existsSync(f.replace('modules/animater/', '')), f);
  }
});

test('the same recording never plays twice running', () => {
  const zero = () => 0;
  assert.notEqual(undergroundSound('drip', zero), undergroundSound('drip', zero));
  assert.equal(undergroundSound('nothing'), null);
});

test('a sound fades out with distance, a box heard from its nearest edge', () => {
  assert.equal(heardFrom({ x: 0, y: 0 }, [{ x: 0, y: 0 }], 100), 1);
  assert.equal(heardFrom({ x: 0, y: 0 }, [{ x: 200, y: 0 }], 100), 0);
  assert.equal(heardFrom({ x: 0, y: 0 }, [], 100), 0);
  assert.equal(heardFrom({ x: 0, y: 0, w: 100, h: 100 }, [{ x: 50, y: 50 }], 100), 1, 'inside the box');
  assert.ok(Math.abs(heardFrom({ x: 0, y: 0, w: 100, h: 100 }, [{ x: 150, y: 50 }], 100) - 0.25) < 1e-9, 'half way out');
});
