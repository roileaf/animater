import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SELECT_ACTS } from '../../scripts/ui/decor-brush-bar.mjs';

// The Select tab of the Map painting bar. What each edit makes of a decoration is decor-select.mjs (tested on its
// own); this is that the bar offers it, the pointer and keys drive it, and every edit can be taken back.
const bar = readFileSync(new URL('../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
const select = shell.slice(shell.indexOf('const selectOn = '), shell.indexOf('const draw = () => {'));

test('the bar has a Select tab with a button for each thing done to what is picked', () => {
  assert.match(bar, /\['select', 'fa-solid fa-arrow-pointer', 'Select'\]/);
  assert.match(bar, /tab === 'select'\) && !lock \? tab : 'decor'/);
  assert.deepEqual(SELECT_ACTS.map((a) => a[0]), ['turnLeft', 'turnRight', 'smaller', 'bigger', 'flip', 'copy', 'remove', 'all']);
  assert.match(bar, /act\('savePrefab', 'fa-solid fa-floppy-disk', 'Save as prefab'/);
  // The bar draws itself as it opens, and on the Select tab that asks for the prefabs at once: before the brush has
  // set anything else up. Asked of something defined further down, the bar would not open at all.
  assert.match(shell, /prefabs: \(\) => prefabsOf\(game\.user\?\.getFlag\?\.\(ID, "prefabs"\)\)\.map\(/);
  const opening = shell.slice(shell.indexOf('state.bar = openBrushBar({'), shell.indexOf('const sizeNow = '));
  assert.ok(!/prefabs: \(\) => prefabsNow\(\)/.test(opening));
  assert.match(bar, /act\(`placePrefab:\$\{which\}`, 'fa-solid fa-stamp', 'Set down'/);
  assert.match(bar, /b\.addEventListener\('click', \(\) => onSelectAct\(act\)\)/);
  assert.match(shell, /onSelectAct: \(act\) => \(act === "fillMap" \? void pathFillMap\(\) : selectAct\(act\)\),/);
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
