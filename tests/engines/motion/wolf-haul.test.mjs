import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wolfGrip, wolfStep } from '../../../scripts/engines/motion/field-life.mjs';

const hauling = (over = {}) => ({ x: 0, y: 0, a: 0, v: 0, mode: 'drag', t: 0, tx: -1000, ty: 0, pulling: true, goingTo: { x: 300, y: 0, reach: 75 }, ...over });
const step = (w, options = {}) => wolfStep(w, { dt: 0.1, grid: 100, near: [], blocked: () => false, kept: () => false, fires: [], prey: [], leader: null, time: 0, ok: () => true, random: () => 0.5, ...options });

test('the grip is mouth to middle, shrinking with the animals', () => {
  assert.equal(wolfGrip(100), 75, 'as it always was at the usual size');
  assert.ok(wolfGrip(100, 0.35, 0.35) < 30, 'small animals touch too');
  assert.ok(wolfGrip(100, 3, 3) > wolfGrip(100));
});

test('a wolf goes up to what it will haul before it hauls', () => {
  let w = hauling(), steps = 0;
  while (w.goingTo && steps < 100) { w = step(w); steps += 1; }
  assert.ok(steps > 1 && steps < 100, 'it walked');
  assert.ok(w.x <= 225 && w.x > 210, 'and came up with its mouth at the deer, never past it, then began to pull away');
  assert.equal(w.pulling, true, 'then it hauls');
  const after = step(w);
  assert.ok(after.x < w.x, 'off toward the way out');
});

test('walled off from it, it leaves it lying', () => {
  let w = hauling({ goingTo: { x: 500, y: 0, reach: 75 } }), steps = 0;
  while (w.goingTo && steps < 200) { w = step(w, { blocked: () => true }); steps += 1; }
  assert.equal(w.goingTo, null);
  assert.equal(w.pulling, false);
});

test('the deer only follows once the wolf has come up to it', () => {
  const source = readFileSync(new URL('../../../scripts/engines/motion/field-life.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes("if (puller?.pulling && puller.mode === 'drag') { if (!puller.goingTo) {"));
});

test('a right click on an icon is not about the region under it', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.ok(main.includes('if (overControlIcon(event.global)) return;'));
  assert.ok(main.includes('[windowControlRoot, canvas.controls?.doors]'));
});
