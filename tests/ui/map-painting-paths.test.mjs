import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brushChoices } from '../../scripts/ui/decor-brush-bar.mjs';
import { PATH_KINDS } from '../../scripts/engines/mapbuild/path-lay.mjs';

// The Paths tab of the Map painting bar: a line clicked point by point and laid as a road, a stream or a fence. The
// laying is path-lay.mjs (tested on its own); this is that the bar offers it and the brush's pointer drives it.
const bar = readFileSync(new URL('../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');

test('the bar has a Paths tab, a tile for every kind, and says how a path is drawn', () => {
  assert.match(bar, /\['paths', 'fa-solid fa-route', 'Paths', /);
  assert.match(bar, /tab === 'walls' \|\| tab === 'paths' \|\| /, 'the tab can be switched to');
  assert.match(bar, /for \(const id of PATH_IDS\)/);
  assert.match(bar, /Enter or double-click lays it · Backspace: back a point · Esc: start again · Shift: on the grid/);
  const choices = brushChoices();
  assert.ok(PATH_KINDS[choices.pathKind], 'a kind is always picked'); assert.ok(choices.pathWide > 0); assert.equal(typeof choices.pathSmooth, 'boolean');
});

test('a click adds a point, Enter or a second click on the spot lays it, and it can be taken back', () => {
  const paths = shell.slice(shell.indexOf('const pathsOn = '), shell.indexOf('// Held and dragged, it draws freehand'));
  assert.match(paths, /now - pt\.clickAt < 400 && Math\.hypot\(q\[0\] - last\[0\], q\[1\] - last\[1\]\) < grid\(\) \* 0\.3\) \{ void pathFinish\(\)/, 'a double-click ends the line');
  assert.match(paths, /pathRegion\(c\.pathKind, drawn, \{ grid: grid\(\), wide: c\.pathWide, smooth: c\.pathSmooth/);
  assert.match(paths, /rememberDecorStep\(\{ kind: "create", id: made\.id, data \}\)/, 'one path, one step of undo');
  assert.match(shell, /if \(pathsOn\(\)\) \{ state\.at = p; pathDown\(p, e\); draw\(\); refreshStatus\(\); return; \}/);
  assert.match(shell, /e\.key === "Enter" \|\| e\.key === "Backspace" \|\| e\.key === "Escape"/);
  assert.match(shell, /3: "paths"/, 'and the tab has its key');
});

test('nothing of a path reads the map\'s picture, so one is drawn on a scene that has none', () => {
  const paths = shell.slice(shell.indexOf('const pathsOn = '), shell.indexOf('// Held and dragged, it draws freehand'));
  assert.ok(!paths.includes('readMap') && !paths.includes('fl.map'));
  assert.match(shell, /onTab: \(\) => \{ pathClear\(\);/, 'a half-drawn line is dropped with its tab');
});
