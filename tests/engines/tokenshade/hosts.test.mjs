import test from 'node:test';
import assert from 'node:assert/strict';
import { hostKind, hostMesh, hostSize } from '../../../scripts/engines/tokenshade/hosts.mjs';
import { TokenFxEngine, tokenFxSize } from '../../../scripts/engines/tokenshade/engine.mjs';
import { builtinPreset } from '../../../scripts/engines/tokenshade/presets.mjs';

// Roi: Tokenshade on drawings and tiles, the same looks as on tokens.
class Filter { constructor(vertex, fragment, uniforms) { this.uniforms = uniforms; this.enabled = true; this.destroyed = false; } destroy() { this.destroyed = true; } }
const PIXI = { Filter, Texture: { EMPTY: {} } };
const display = (extra = {}) => ({ filters: null, visible: true, renderable: true, worldAlpha: 1, destroyed: false, worldTransform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, parent: { worldTransform: { a: 1, b: 0 } }, ...extra });
const fakeTile = (doc = {}) => ({ visible: true, destroyed: false, document: { documentName: 'Tile', width: 400, height: 200, ...doc }, mesh: display({ texture: { orig: { width: 800, height: 400 } }, anchor: { x: 0.5, y: 0.5 } }) });
// (A drawing's shape is graphics: no texture, its box comes from its bounds.)
const fakeDrawing = () => ({ visible: true, destroyed: false, document: { documentName: 'Drawing', shape: { width: 300, height: 120 } }, mesh: undefined, shape: display({ getLocalBounds: () => ({ x: -2, y: -2, width: 304, height: 124 }) }) });
const engineOf = (extra = {}) => new TokenFxEngine({ PIXI, ticker: () => ({ add() {}, remove() {} }), now: () => 0, world: () => 0, ...extra });

test('a tile is drawn on its mesh, a drawing on its shape, anything else as a token', () => {
  const tile = fakeTile(), drawing = fakeDrawing(), token = { mesh: {}, w: 100, h: 100, document: { documentName: 'Token' } };
  assert.deepEqual([hostKind(tile), hostKind(drawing), hostKind(token), hostKind({}), hostKind(null)], ['tile', 'drawing', 'token', 'token', 'token']);
  assert.equal(hostMesh(tile), tile.mesh);
  assert.equal(hostMesh(drawing), drawing.shape);
  assert.equal(hostMesh(token), token.mesh);
  assert.equal(hostMesh({}), null);
});

test('a look is sized by the tile or drawing itself, a mirrored tile (a negative size) all the same', () => {
  assert.deepEqual(hostSize(fakeTile()), { width: 400, height: 200 });
  assert.deepEqual(hostSize(fakeTile({ width: -400 })), { width: 400, height: 200 });
  assert.deepEqual(hostSize(fakeDrawing()), { width: 300, height: 120 });
  assert.equal(hostSize(fakeTile({ width: 0 })), null);
  assert.equal(hostSize({ w: 100, h: 100 }), null, 'a token is sized by its art (engine.mjs)');
  assert.deepEqual(tokenFxSize(fakeTile()), { width: 400, height: 200 });
  assert.deepEqual(tokenFxSize({ w: 100, h: 50 }), { width: 100, height: 50 });
});

test('a look on a tile sits beside the filters already on its mesh (a tree\'s sway) and leaves them when it goes', () => {
  const engine = engineOf(), tile = fakeTile(), sway = { sway: true };
  tile.mesh.filters = [sway];
  const remove = engine.apply(tile, builtinPreset('glow'));
  assert.equal(tile.mesh.filters[0], sway);
  assert.equal(tile.mesh.filters.length, 2);
  assert.deepEqual([...tile.mesh.filters[1].tokenSize ? [tile.mesh.filters[1].tokenSize.width] : []], [400]);
  // Something sets the mesh's filters anew (the sway put on again): the look comes back, the newcomer stays.
  const again = { sway: 2 };
  tile.mesh.filters = [again];
  engine.tick();
  assert.equal(tile.mesh.filters[0], again);
  assert.equal(tile.mesh.filters.length, 2);
  remove();
  assert.deepEqual(tile.mesh.filters, [again]);
});

test('a look on a drawing sits on its shape, follows a redrawn shape and goes with the drawing', () => {
  const engine = engineOf(), drawing = fakeDrawing();
  engine.apply(drawing, builtinPreset('glow'));
  assert.equal(drawing.shape.filters.length, 1);
  engine.tick();
  assert.equal(drawing.shape.filters[0].enabled, true);
  assert.ok(drawing.shape.filters[0].uniforms.uArtSize[0] > 300, 'measured from the shape\'s bounds');
  const old = drawing.shape;
  drawing.shape = fakeDrawing().shape;
  engine.tick();
  assert.equal(old.filters, null);
  assert.equal(drawing.shape.filters.length, 1);
  drawing.visible = false; engine.tick();
  assert.equal(drawing.shape.filters[0].enabled, false);
  drawing.destroyed = true; engine.tick();
  assert.equal(engine.entries.size, 0);
});

test('a creature\'s extras stay off tiles: no top-down form is asked for, and a tile\'s video keeps its own pace', () => {
  let asked = 0;
  const engine = engineOf({ cutOut: () => { asked++; return true; } }), tile = fakeTile();
  const video = { paused: false, playbackRate: 1, pause() { this.paused = true; } };
  tile.mesh.texture.baseTexture = { resource: { source: video } };
  engine.apply(tile, { name: 'Petrified', params: [{ filterType: 'adjustment', saturation: 0.1 }] });
  assert.equal(asked, 0);
  assert.equal(video.paused, false);
  // (On a token the same look holds its animated art still.)
  const token = { visible: true, destroyed: false, w: 100, h: 100, mesh: display({ texture: { orig: { width: 100, height: 100 }, baseTexture: { resource: { source: { paused: false, playbackRate: 1, pause() { this.paused = true; } } } } }, anchor: { x: 0.5, y: 0.5 } }) };
  engine.apply(token, { name: 'Petrified', params: [{ filterType: 'adjustment', saturation: 0.1 }] });
  assert.equal(asked, 1);
  assert.equal(token.mesh.texture.baseTexture.resource.source.paused, true);
});
