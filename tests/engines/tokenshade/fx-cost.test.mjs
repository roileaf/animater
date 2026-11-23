// What the looks cost a frame: every filter on a creature is a pass of its own, so the commonest look is one filter,
// and a creature nobody can see has its filters switched off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TokenFxEngine, presetFilters, onScreen, FX_SCREEN_MARGIN, leanVoid, paintOnly } from '../../../scripts/engines/tokenshade/engine.mjs';
import { specFor, resolveParams } from '../../../scripts/engines/tokenshade/filters/index.mjs';
import { shaderSource } from '../../../scripts/engines/tokenshade/filter-factory.mjs';
import { lightAround, litPreset } from '../../../scripts/engines/playback/surrounding-light.mjs';

class Filter { constructor(vertex, fragment, uniforms) { this.uniforms = uniforms; this.enabled = true; } destroy() {} }
const PIXI = { Filter, Texture: { EMPTY: {} } };
const view = { width: 1000, height: 800 };

test('a creature lit by its surroundings is one filter: the tint and the rim in one pass', () => {
  const light = lightAround({ x: 0, y: 0 }, [{ x: 100, y: 0, radius: 400, color: 0xff6020, alpha: 0.5 }], 1);
  const preset = litPreset(light);
  assert.deepEqual(preset.params.map((p) => p.filterType), ['lit']);
  assert.equal(presetFilters(PIXI, preset, { tokenSize: { width: 100, height: 100 } }).length, 1);
  const p = preset.params[0];
  assert.ok(p.red > 1 && p.blue < 1, 'a warm tint');
  assert.equal(p.rotation, 180, 'the rim points from the light toward the creature');
  assert.ok(p.lightAlpha > 0 && p.shadowAlpha > 0);
  // Lit from every side there is no rim, and still one filter.
  const flat = litPreset({ ...light, angle: null }).params;
  assert.equal(flat.length, 1); assert.equal(flat[0].lightAlpha, 0); assert.equal(flat[0].shadowAlpha, 0);
});

test('the lit filter does the sums of the adjustment and the bevel it stands for', () => {
  const spec = specFor('lit'), src = shaderSource(spec);
  assert.ok(spec, 'registered');
  assert.equal(spec.reach(), 0, 'it never reaches beyond the art, so it never widens the pass');
  assert.match(src, /clamp\(unpremul\(base\) \* uChannels, 0\.0, 1\.0\)/);
  assert.match(src, /if \(uLight\.a \+ uShade\.a > 0\.0\)/, 'no rim, no taps');
  // Brightness is folded into the channels, as the adjustment multiplied them.
  const u = spec.uniforms.uChannels[1](resolveParams(spec, { red: 1.2, green: 1, blue: 0.5, brightness: 1.1 }));
  assert.deepEqual(u.map((v) => +v.toFixed(3)), [1.32, 1.1, 0.55]);
  const dir = spec.uniforms.uDir[1](resolveParams(spec, { rotation: 180 }));
  assert.deepEqual(dir.map((v) => Math.round(v)), [-1, 0]);
});

test('what is on the screen, with a margin and the looks\' own reach', () => {
  assert.equal(onScreen({ x: 100, y: 100, width: 50, height: 50 }, view), true);
  assert.equal(onScreen({ x: -40, y: 780, width: 50, height: 50 }, view), true, 'half on');
  assert.equal(onScreen({ x: -50 - FX_SCREEN_MARGIN - 1, y: 100, width: 50, height: 50 }, view), false, 'off the left');
  assert.equal(onScreen({ x: 1000 + FX_SCREEN_MARGIN + 1, y: 100, width: 50, height: 50 }, view), false, 'off the right');
  assert.equal(onScreen({ x: 100, y: 800 + FX_SCREEN_MARGIN + 1, width: 50, height: 50 }, view), false, 'off the bottom');
  assert.equal(onScreen({ x: 1000 + FX_SCREEN_MARGIN + 30, y: 100, width: 50, height: 50 }, view, 40), true, 'a wide look still shows');
  // Nothing to go by: drawn, as before.
  assert.equal(onScreen(null, view), true);
  assert.equal(onScreen({ x: 5000, y: 0, width: 1, height: 1 }, null), true);
  assert.equal(onScreen({ x: NaN, y: 0, width: 1, height: 1 }, view), true);
});

test('a creature off the screen has its filters switched off, and on again when it comes back', () => {
  let box = { x: 100, y: 100, width: 80, height: 80 };
  const mesh = { filters: null, visible: true, renderable: true, worldAlpha: 1, worldTransform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, texture: { orig: { width: 80, height: 80 } }, anchor: { x: 0.5, y: 0.5 }, getBounds: () => box };
  const token = { id: 't', visible: true, mesh, w: 100, h: 100, document: {} };
  const engine = new TokenFxEngine({ PIXI, ticker: () => null, now: () => 0, world: () => 0, view: () => view });
  const remove = engine.apply(token, { name: 'x', params: [{ filterType: 'glow' }] });
  const [f] = remove.filters;
  engine.tick(); assert.equal(f.enabled, true, 'on the screen');
  box = { x: 5000, y: 100, width: 80, height: 80 };
  engine.tick(); assert.equal(f.enabled, false, 'off it: no pass is drawn for it');
  box = { x: 900, y: 700, width: 80, height: 80 };
  engine.tick(); assert.equal(f.enabled, true, 'back');
  // A host whose bounds cannot be read, or an engine told no screen, draws as before.
  box = { x: 5000, y: 100, width: 80, height: 80 };
  const blind = new TokenFxEngine({ PIXI, ticker: () => null, now: () => 0, world: () => 0, view: () => null });
  const other = blind.apply(token, { name: 'y', params: [{ filterType: 'glow' }] });
  blind.tick(); assert.equal(other.filters[0].enabled, true);
  remove(); other();
});

test('Foundry\'s second drawing of a token, for its outline, goes without the looks that only repaint it', () => {
  const seen = [];
  const mesh = { filters: null, visible: true, renderable: true, worldAlpha: 1, worldTransform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, texture: { orig: { width: 80, height: 80 } }, anchor: { x: 0.5, y: 0.5 },
    _renderVoid(renderer) { seen.push((this.filters ?? []).map((f) => f.spec?.type ?? 'theirs')); return renderer; } };
  const token = { id: 't', visible: true, mesh, w: 100, h: 100, document: {} };
  const theirs = { enabled: true };
  mesh.filters = [theirs];
  const engine = new TokenFxEngine({ PIXI, ticker: () => null, now: () => 0, world: () => 0, view: () => null });
  const lit = engine.apply(token, { name: 'Lit by surroundings', params: [{ filterType: 'lit' }] });
  const glow = engine.apply(token, { name: 'g', params: [{ filterType: 'glow' }] });
  assert.equal(mesh._renderVoid('r'), 'r', 'still Foundry\'s own drawing, with what it returns');
  assert.deepEqual(seen.pop(), ['theirs', 'glow'], 'the tint is left out; another module\'s filter and a glow, which widens the outline, stay');
  assert.deepEqual(mesh.filters.map((f) => f.spec?.type ?? 'theirs'), ['theirs', 'lit', 'glow'], 'and the token keeps all of them for its real drawing');
  glow();
  mesh._renderVoid('r'); assert.deepEqual(seen.pop(), ['theirs']);
  mesh.filters = mesh.filters.filter((f) => f !== theirs);
  mesh._renderVoid('r'); assert.deepEqual(seen.pop(), [], 'nothing left to run: no pass at all');
  lit();
  // Which looks only repaint: the spec says so, and a fading adjustment does not count.
  assert.equal(paintOnly({ spec: specFor('lit'), current: {} }), true);
  assert.equal(paintOnly({ spec: specFor('adjustment'), current: { alpha: 1 } }), true);
  assert.equal(paintOnly({ spec: specFor('adjustment'), current: { alpha: 0.5 } }), false);
  assert.equal(paintOnly({ spec: specFor('glow'), current: {} }), false);
  assert.equal(paintOnly({}), false);
  // Wrapped once, and a host with no such drawing (a tile's mesh on an older Foundry, a drawing's shape) is left alone.
  const before = mesh._renderVoid; leanVoid(mesh); assert.equal(mesh._renderVoid, before);
  const plain = {}; leanVoid(plain); assert.equal('_renderVoid' in plain, false);
});

test('the lit look skips creatures hidden from the players, and carriers are not searched for every frame', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /if \(!token\.actor \|\| !token\.mesh \|\| !token\.visible \|\| token\.document\?\.hidden\) continue;/);
  assert.match(main, /if \(now - carrierLookedAt > 250\) \{ carrierLookedAt = now; carrierTokens = all\.filter\(/);
  assert.match(main, /for \(const token of carrierTokens\) \{/);
});
