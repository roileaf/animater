import test from 'node:test';
import assert from 'node:assert/strict';
import { createSmokeAirLook, airCover } from '../../../scripts/engines/props/smoke-air-look.mjs';
import { THICK_COVER, THIN_COVER } from '../../../scripts/engines/props/smoke-look.mjs';
import { THICK, THIN } from '../../../scripts/engines/props/smoke-field.mjs';

// The smallest PIXI that lets the pass be built.
function fakePIXI() {
  class Geometry { addAttribute() { return this; } addIndex() { return this; } }
  class Mesh { constructor(g, shader) { this.shader = shader; this.visible = true; } destroy() { this.gone = true; } }
  return {
    Geometry, Mesh,
    Shader: { from: (v, f, uniforms) => ({ uniforms }) },
    Texture: { fromBuffer: () => ({ destroy() {}, baseTexture: { update() {} } }) },
    SCALE_MODES: { LINEAR: 1 },
  };
}
const bounds = { x: 0, y: 0, width: 1000, height: 1000 };

test('the two tiers still read apart at a glance', () => {
  // The sim holds 0-1, where 1 is THICK. Thick smoke must hide what stands in it; thin must only veil it.
  assert.ok(airCover(1) >= THICK_COVER, `${airCover(1)} hides`);
  assert.ok(airCover(THIN / THICK) <= THIN_COVER, `${airCover(THIN / THICK)} only veils`);
  assert.ok(airCover(0) === 0, 'clear air is clear');
  // It only ever rises with the smoke.
  for (let v = 0; v < 1; v += 0.05) assert.ok(airCover(v + 0.05) >= airCover(v));
});

test('nothing is drawn without a layer, a field or any smoke', () => {
  const look = createSmokeAirLook({ PIXI: fakePIXI(), layer: () => null, render: () => {} });
  assert.doesNotThrow(() => look.look({ now: 0, grid: 100, bounds, amount: 1 }));
  assert.doesNotThrow(() => look.clear());
});

test('with a layer and a field the smoke is one mesh over the scene, shown only while there is smoke, gone on clear', () => {
  const added = [];
  const layer = { addChild: (m) => { m.parent = layer; added.push(m); }, removeChild: (m) => { m.parent = null; } };
  const look = createSmokeAirLook({ PIXI: fakePIXI(), layer: () => layer, render: () => {} });
  look.fill(new Uint8Array(4 * 4 * 4), 4, 4);
  look.look({ now: 1, grid: 100, bounds, amount: 1 });
  look.look({ now: 2, grid: 100, bounds, amount: 1 });
  assert.equal(added.length, 1, 'one mesh, not one per frame');
  assert.equal(added[0].visible, true);
  look.look({ now: 3, grid: 100, bounds, amount: 0 });
  assert.equal(added[0].visible, false, 'no smoke, no pass');
  look.clear();
  assert.equal(added[0].gone, true);
});

function shown() {
  const added = [];
  const layer = { addChild: (m) => { m.parent = layer; added.push(m); }, removeChild: (m) => { m.parent = null; } };
  const look = createSmokeAirLook({ PIXI: fakePIXI(), layer: () => layer, render: () => {} });
  look.fill(new Uint8Array(4 * 4 * 4), 4, 4);
  return { look, added };
}

test('a grid or an area with no size draws nothing instead of dividing by it', () => {
  for (const bad of [{ grid: 0 }, { grid: -100 }, { grid: NaN }, { bounds: { x: 0, y: 0, width: 0, height: 1000 } }, { bounds: { x: 0, y: 0, width: 1000, height: -5 } }]) {
    const { look, added } = shown();
    assert.doesNotThrow(() => look.look({ now: 0, grid: 100, bounds, amount: 1, ...bad }));
    assert.equal(added.length, 0, `no mesh for ${JSON.stringify(bad)}`);
  }
  const { look, added } = shown();
  look.look({ now: 0, grid: 100, bounds, amount: 1 });
  look.look({ now: 1, grid: 0, bounds, amount: 1 });
  assert.equal(added[0].visible, false, 'a mesh already up is hidden when the grid goes bad');
});

test('a field of another size reaches the shader, and clearing the field hides the mesh at once', () => {
  const { look, added } = shown();
  look.look({ now: 0, grid: 100, bounds, amount: 1 });
  const first = added[0];
  assert.deepEqual(first.shader.uniforms.uCell, [250, 250]);
  look.fill(new Uint8Array(8 * 5 * 4), 8, 5);
  look.look({ now: 1, grid: 100, bounds, amount: 1 });
  const now = added.at(-1);
  assert.deepEqual(now.shader.uniforms.uCell, [125, 200], 'cell size follows the new field');
  look.fill(null);
  assert.equal(now.visible, false, 'hidden by fill(null), before any look');
});
