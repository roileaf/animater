import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Roi, of a village built on an empty scene: "when hovering over a roof i dont see the insides of the house... we
// need to fix it (at least as the gm)". A roof stood aside only for a held creature under it or a placing layer, so a
// GM with nothing selected could not look into a house they had just furnished.
const shell = readFileSync(new URL('../../scripts/shell/painted-buildings.mjs', import.meta.url), 'utf8');

test('the roof under a GM\'s pointer stands aside', () => {
  const hover = shell.slice(shell.indexOf('const hoverNow = () => {'), shell.indexOf('const sightFrom ='));
  assert.match(hover, /if \(globalThis\.game\?\.user\?\.isGM !== true\) return;/, 'the GM only: a player sees a room from their creature');
  assert.match(hover, /globalThis\.canvas\?\.mousePosition/);
  assert.match(hover, /underRoof\(r\.room, p\.x, p\.y\)/);
  assert.match(hover, /if \(at === hoverAt\) return;/, 'a pointer at rest asks nothing');
  assert.match(hover, /if \(now\.join\('\|'\) !== hovered\.join\('\|'\)\) \{ hovered = now; coverSoon\(\); \}/, 'the roofs change only as it crosses an eave');
});

test('the hovered roof is one of those that fade, with a creature held or without', () => {
  const covering = shell.slice(shell.indexOf('const covering = () => {'), shell.indexOf('let hovered = []'));
  assert.match(covering, /if \(placing\(\)\) return allRoofs\(\);/);
  assert.match(covering, /if \(!mine\.length\) return \[\.\.\.hovered\];/);
  assert.match(covering, /new Set\(\[\.\.\.hovered, /);
  const tick = shell.slice(shell.indexOf('lightRoofs();'), shell.indexOf('walls.step();'));
  assert.match(tick, /hoverNow\(\)/, 'looked at each frame');
});
