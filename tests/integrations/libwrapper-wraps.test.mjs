import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A player's console: "libWrapper: module Animater and module Animater modify the same FoundryVTT functionality ...
// Detected non-libWrapper wrapping of 'CONFIG.Token.documentClass.prototype._preUpdate'". Every Foundry method Animater
// wraps goes through wrapMethod (libWrapper when it is on), none by assigning over the prototype.
test('Foundry methods are wrapped through libWrapper, never by assigning over them', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /if \(globalThis\.libWrapper\) \{ libWrapper\.register\(ID, target, wrap, type\); return; \}/);
  assert.doesNotMatch(main, /\bproto\.[_a-zA-Z]+ = /, 'no method assigned over a prototype');
  assert.doesNotMatch(main, /\.prototype\.[_a-zA-Z]+ = function/, 'no method assigned over a prototype');
  for (const target of ['CONFIG.Token.documentClass.prototype._preUpdate', 'foundry.canvas.geometry.ClockwiseSweepPolygon.testCollision',
    'foundry.canvas.geometry.ClockwiseSweepPolygon.prototype._testEdgeInclusion', 'CONFIG.Canvas.lightSourceClass.prototype._createShapes',
    'CONFIG.Wall.documentClass.prototype.initializeEdge', 'CONFIG.AmbientLight.objectClass.prototype._getLightSourceData',
    'CONFIG.Token.objectClass.prototype._prepareAnimation', 'CONFIG.Token.objectClass.prototype._getLightSourceData',
    'CONFIG.Token.objectClass.prototype._drawEffect', 'foundry.canvas.containers.DoorControl.prototype._onRightDown',
    'CONFIG.Token.rulerClass.prototype._getGridHighlightStyle', 'foundry.audio.Sound.prototype._createNodes'])
    assert.ok(main.includes('"' + target + '"'), target);
});
