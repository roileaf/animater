import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SELECT_ACTS } from '../../scripts/ui/decor-brush-bar.mjs';

// The Select tab of the Map painting bar. What each edit makes of a decoration is decor-select.mjs (tested on its
// own); this is that the bar offers it, the pointer and keys drive it, and every edit can be taken back.
const bar = readFileSync(new URL('../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
const select = shell.slice(shell.indexOf('const selectOn = '), shell.indexOf('const draw = () => {'));

// Roi, of the first Select tab — a row of "Turn", "Turn", "Smaller", "Bigger" and a paragraph of keys: "seriously.. is
// this the most intuitive way you could think of???". What is picked now shows its own handles on the map, and the
// few things left to do to it float beside it there; the bar holds nothing for it but the prefabs.
test('Select is the first tool, and what is picked is worked on the map: handles on it, actions beside it', async () => {
  const { MAP_TOOLS } = await import('../../scripts/ui/decor-brush-bar.mjs');
  assert.deepEqual(MAP_TOOLS.map((t) => [t[0], t[2]]), [['select', 'Select'], ['floors', 'Ground'], ['paths', 'Paths'], ['walls', 'Buildings'], ['decor', 'Decorate'], ['heights', 'Heights']], 'the tools in the order a map is made');
  assert.match(bar, /tab === 'select'\) && !lock \? tab : 'decor'/);
  assert.match(shell, /first: "select"/, 'the bar opens on Select the first time');
  // No row of buttons in the bar for it.
  const body = bar.slice(bar.indexOf('} else if (select) {'), bar.indexOf('} else if (paths) {'));
  assert.ok(!body.includes('SELECT_ACTS') && !body.includes("'Smaller'"), 'turning and sizing are handles, not buttons');
  assert.match(bar, /const SELECT_HINT = 'Click anything on the map to pick it up, then drag it; its round handle turns it, its square one sizes it · /, 'said once, as the one line of help');
  // The handles: a box, a round one above it that turns, a square one at its corner that sizes.
  assert.match(shell, /if \(box && on\(box\.turn\)\) \{ sl\.spin = \{ box, from: p, by: 0 \}; return; \}/);
  assert.match(shell, /if \(box && on\(box\.size\)\) \{ sl\.grow = \{ box, from: p, k: 1 \}; return; \}/);
  assert.match(shell, /if \(by\) selectEdit\(\(ds\) => turnedBy\(ds, by\)\);/);
  assert.match(shell, /selectEdit\(\(ds\) => scaledAbout\(ds, k\)\);/);
  // The rest float beside what is picked, as icons with their names in their tooltips.
  assert.match(shell, /floatBar\.id = "an-map-float";/);
  const acts = shell.slice(shell.indexOf('const floatActs = '), shell.indexOf('const floatPlace = '));
  for (const act of ['flip', 'copy', 'all', 'savePrefab', 'remove']) assert.ok(acts.includes(`["${act}", "fa-solid `), act);
  assert.ok(!acts.includes('turnLeft') && !acts.includes('bigger'));
  assert.match(shell, /state\.float\?\.remove\(\);/, 'and go when the brush is put away');
  assert.deepEqual(SELECT_ACTS.map((a) => a[0]), ['turnLeft', 'turnRight', 'smaller', 'bigger', 'flip', 'copy', 'remove', 'all'], 'the keys and the wheel still do all of them');
  // The bar draws itself as it opens, and on the Select tab that asks for the prefabs at once: before the brush has
  // set anything else up. Asked of something defined further down, the bar would not open at all.
  assert.match(shell, /prefabs: \(\) => prefabsOf\(game\.user\?\.getFlag\?\.\(ID, "prefabs"\)\)\.map\(/);
  const opening = shell.slice(shell.indexOf('state.bar = openBrushBar({'), shell.indexOf('const sizeNow = '));
  assert.ok(!/prefabs: \(\) => prefabsNow\(\)/.test(opening));
  assert.match(bar, /act\(`placePrefab:\$\{which\}`, 'fa-solid fa-stamp', 'Set down'/);
  assert.match(shell, /onSelectAct: \(act\) => \(act === "fillMap" \? void pathFillMap\(\) : selectAct\(act\)\),/);
});

test('one line of help under every tool, and the rest behind a question mark', () => {
  assert.match(bar, /const whole = keys\.textContent, \[first, \.\.\.rest\] = whole\.split\(' · '\);/);
  assert.match(bar, /keys\.textContent = remembered\.help \? whole : first;/);
  assert.match(bar, /ask\.addEventListener\('click', \(\) => \{ remembered\.help = !remembered\.help; draw\(\); \}\);/);
});

test('the box round what is picked, and what its handles do', async () => {
  const { selectionBox, turnTo, sizeTo, scaledAbout, whereOnMap, SELECT_TURN } = await import('../../scripts/engines/mapbuild/decor-select.mjs');
  const a = { kind: 'crate', x: 100, y: 100, size: 1, turn: 0, seed: 1 }, b = { kind: 'crate', x: 300, y: 200, size: 1, turn: 0, seed: 2 };
  const box = selectionBox([a, b], 100, 30);
  assert.deepEqual([box.x0, box.y0, box.x1, box.y1, box.cx, box.cy], [55, 55, 345, 245, 200, 150]);
  assert.deepEqual(box.turn, [200, 25], 'the turn handle above the middle of the top'); assert.deepEqual(box.size, [345, 245], 'the size handle at the bottom right');
  assert.equal(selectionBox([], 100), null);
  // Turned in steps unless asked not to be.
  assert.ok(Math.abs(turnTo(box, { x: 200, y: 25 }, { x: 325, y: 150 }) - Math.PI / 2) < 1e-9, 'a quarter turn');
  assert.equal(turnTo(box, { x: 200, y: 25 }, { x: 210, y: 25 }), 0, 'a nudge is not yet a step');
  assert.ok(turnTo(box, { x: 200, y: 25 }, { x: 210, y: 25 }, { free: true }) > 0 && SELECT_TURN > 0);
  // Sized by how far the corner is dragged from the middle, within a quarter and four times.
  assert.ok(Math.abs(sizeTo(box, { x: 345, y: 245 }, { x: 490, y: 340 }) - 2) < 0.01); assert.equal(sizeTo(box, { x: 345, y: 245 }, { x: 5000, y: 5000 }), 4); assert.equal(sizeTo(box, { x: 345, y: 245 }, { x: 200, y: 150 }), 0.25);
  const big = scaledAbout([a, b], 2);
  assert.deepEqual(big.map((d) => [d.x, d.y, d.size]), [[0, 50, 1.6], [400, 250, 1.6]].map(([x, y]) => [x, y, big[0].size]), 'further from the middle, and bigger');
  assert.equal(scaledAbout([a], 2)[0].x, 100, 'one alone stays where it stands');
  assert.equal(whereOnMap(100, 100, { x: 0, y: 0, width: 3000, height: 2000 }), 'north-west'); assert.equal(whereOnMap(1500, 1000, { x: 0, y: 0, width: 3000, height: 2000 }), 'centre'); assert.equal(whereOnMap(2900, 1000, { x: 0, y: 0, width: 3000, height: 2000 }), 'east'); assert.equal(whereOnMap(1, 1, null), '');
});

test('a click picks one, Shift adds or lets go of one, open ground starts a box, and what is picked drags', () => {
  assert.match(select, /if \(!hit\) \{ if \(!e\.shiftKey\) sl\.picked = \[\]; sl\.box = \{ a: p, b: p, add: e\.shiftKey \}; return; \}/);
  assert.match(select, /if \(e\.shiftKey\) sl\.picked = has\(hit\) \? sl\.picked\.filter/);
  assert.match(select, /if \(moved\) selectEdit\(\(ds\) => ds\.map\(\(d\) => movedBy\(d, dx, dy\)\)\);/, 'a click that did not move is not a move');
  assert.match(shell, /if \(selectOn\(\)\) \{ state\.at = p; selectDown\(p, e\); draw\(\); refreshStatus\(\); return; \}/);
});

test('every edit is written through the region\'s own list, one step of undo, in turn', () => {
  assert.match(select, /sl\.busy = sl\.busy\.then\(async \(\) => \{/, 'a spin of the wheel is written in order');
  assert.match(select, /const list = listAfter\(s\.brushed, r\.changes, r\.added\)/);
  assert.match(select, /rememberDecorStep\(\{ kind: "edits", changed \}\)/);
  assert.match(select, /own\.floor \|\| own\.height != null \|\| own\.ramp \? \[\] : growFor\(/, 'a floor\'s region is never grown to hold a chair');
  assert.equal([...shell.matchAll(/step\.kind === "edits"/g)].length, 2, 'taken back and put back');
});

test('the keys: arrows nudge, Delete removes, Ctrl+D copies, Esc lets go before it puts the brush away', () => {
  assert.match(shell, /ArrowLeft: \[-step, 0\], ArrowRight: \[step, 0\], ArrowUp: \[0, -step\], ArrowDown: \[0, step\]/);
  assert.match(shell, /e\.key === "Delete" \|\| e\.key === "Backspace" \? "remove" : ctrl && \(e\.key === "d" \|\| e\.key === "D"\) \? "copy"/);
  assert.match(shell, /if \(selectOn\(\)\) \{ if \(sl\.picked\.length && !e\.shiftKey\) selectAct\(e\.altKey \? \(up \? "bigger" : "smaller"\) : \(up \? "turnLeft" : "turnRight"\)\); return; \}/);
});
