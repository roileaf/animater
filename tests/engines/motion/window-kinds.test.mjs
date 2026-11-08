import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLOSING_WINDOWS, closesWindow, drawWindowIcon, windowSenses } from '../../../scripts/engines/motion/window-state.mjs';
import { WINDOW_KINDS, WINDOW_PATTERN, panesAcross, patternScaleOf, windowOpening, windowPrint, windowShafts } from '../../../scripts/engines/motion/wall-shadows.mjs';

const sun = { angle: 180, height: 30, strength: 1 }, at = (kind, more = {}) => windowShafts({ walls: [{ c: [0, 200, 0, 400], light: 20, move: 20, kind, ...more }], sun, grid: 100 })[0];

test('the new glass windows open and close; frosted keeps sight out', () => {
  for (const k of ['mosaicWindow', 'leadedWindow', 'roseWindow', 'frostedWindow']) { assert.ok(closesWindow(k), k); assert.ok(CLOSING_WINDOWS[k]); }
  assert.deepEqual(windowSenses('mosaicWindow', false), { light: 0, sight: 0, sound: 20 });
  assert.deepEqual(windowSenses('frostedWindow', false), { light: 0, sight: 20, sound: 20 });
  assert.deepEqual(windowSenses('frostedWindow', true), { light: 0, sight: 0, sound: 0 });
});

test('each prints its own light, and thrown open lets it in whole', () => {
  assert.equal(at('mosaicWindow').panes, 'mosaic');
  assert.equal(at('leadedWindow').panes, 'leaded');
  assert.equal(at('roseWindow').panes, 'rose');
  assert.equal(at('frostedWindow').panes, 'frosted'); assert.equal(at('frostedWindow').soft, true);
  assert.deepEqual(windowPrint('frosted'), [], 'no lines of its own');
  assert.ok(windowPrint('frosted', 1, { leaves: true }).some(([u0, , u1, , w]) => u0 === 0.5 && u1 === 0.5 && w > 1), 'two leaves: the bar where they meet');
  assert.ok(windowPrint('rose', 1, { leaves: true }).some(([u0, , u1, , w]) => u0 === 0.5 && u1 === 0.5 && w > 1));
  assert.equal(at('mosaicWindow', { open: true }).panes, false);
  assert.equal(at('lattice').panes, 'lattice');
  assert.equal(at('bars').panes, 'bars');
  for (const k of ['cross', 'bar', 'bars', 'lattice', 'leaded', 'mosaic', 'rose']) { const lines = windowPrint(k); assert.ok(lines.length > 0, k); assert.ok(lines.every((l) => l.every((v) => v >= -1e-9 && v <= 1 + 1e-9)), `${k} inside its window`); }
  assert.deepEqual(windowPrint('nothing'), []);
});

test('the window light is baked fine enough for its panes and colours', () => {
  const src = readFileSync(new URL('../../../scripts/engines/motion/wall-shadows.mjs', import.meta.url), 'utf8');
  assert.match(src, /SHAFT_RESOLUTION = 0\.5/);
  assert.match(src, /Math\.min\(SHAFT_RESOLUTION, MAX_TEXTURE/);
  assert.ok(WINDOW_KINDS.mosaic >= 0.8 && WINDOW_KINDS.rose >= 0.8, 'coloured glass lets most of the light through');
});

test('a window\'s pattern size: smaller for more panes, bigger for fewer; the cross keeps its own', () => {
  assert.equal(patternScaleOf(undefined), 1); assert.equal(patternScaleOf(9), WINDOW_PATTERN.max); assert.equal(patternScaleOf(0.1), WINDOW_PATTERN.min);
  assert.equal(panesAcross(6, 1), 6); assert.equal(panesAcross(6, 0.5), 12); assert.equal(panesAcross(6, 2), 3);
  assert.ok(windowPrint('lattice', 0.5).length > windowPrint('lattice', 1).length);
  assert.ok(windowPrint('leaded', 2).length < windowPrint('leaded', 1).length);
  assert.deepEqual(windowPrint('cross', 2), windowPrint('cross', 1));
  assert.equal(at('mosaicWindow', { pattern: 1.5 }).scale, 1.5);
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /name="flags\.\$\{ID\}\.windowPattern"/);
  // (A region's skyPattern is set from the right-click panel: tests/ui/region-panel.test.mjs.)
});

test('a window that opens is two leaves in its light: the bar where they meet, each leaf\'s panes its own', () => {
  const two = windowPrint('leaded', 1, { leaves: true }), one = windowPrint('leaded', 1);
  assert.ok(two.some(([u0, v0, u1, v1, w]) => u0 === 0.5 && u1 === 0.5 && v0 === 0 && v1 === 1 && w > 1), 'a heavier bar down the middle');
  assert.ok(two.filter((l) => l.length < 5 || l[4] === undefined).every(([u0, , u1]) => (u0 <= 0.5 && u1 <= 0.5) || (u0 >= 0.5 && u1 >= 0.5)), 'no diamond crosses the meeting');
  assert.ok(!one.some((l) => l[4] > 1), 'a fixed one is one sheet');
  assert.equal(at('leadedWindow').leaves, true); assert.equal(at('lattice').leaves, false);
  assert.deepEqual(windowPrint('lattice', 1, { leaves: true }), windowPrint('lattice', 1), 'a lattice does not open');
});

test('an arrow slit lets only a thin blade in', () => {
  const slit = at('slit'), glass = at('glassWindow');
  assert.ok(Math.abs(slit.points[3] - slit.points[1]) < Math.abs(glass.points[3] - glass.points[1]) * 0.25);
  assert.equal(WINDOW_KINDS.slit, 1);
  assert.equal(windowOpening({ c: [0, 0, 0, 100], kind: 'bars' }).kind, 'bars');
});

test('the wall settings offer them all', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  for (const k of ['lattice', 'bars', 'slit']) assert.match(main, new RegExp(`\\["${k}", "`));
  assert.match(readFileSync(new URL('../../../scripts/engines/motion/air-seep.mjs', import.meta.url), 'utf8'), /\/Window\$\/\.test\(w\.kind\)/);
});

test('thrown open, shutters show as wooden leaves swung out, not as tilted slats', () => {
  const fills = (opts) => { const seen = []; class Graphics { beginFill(c) { seen.push(c); return this; } lineStyle() { return this; } drawPolygon() { return this; } drawRect() { return this; } endFill() { return this; } moveTo() { return this; } lineTo() { return this; } arc() { return this; } drawCircle() { return this; } drawRoundedRect() { return this; } } drawWindowIcon({ Graphics }, opts); return seen; };
  assert.ok(fills({ kind: 'shutterWindow', open: true }).includes(0xb98a55), 'wood');
  assert.ok(!fills({ kind: 'shutterWindow', open: true }).includes(0xf0dcae), 'not the slats-open look');
  assert.ok(fills({ kind: 'shutterWindow', slats: true }).includes(0xf0dcae), 'slats open: light between them');
  for (const kind of ['mosaicWindow', 'leadedWindow', 'roseWindow', 'frostedWindow']) assert.ok(fills({ kind }).length > 0, kind);
});
