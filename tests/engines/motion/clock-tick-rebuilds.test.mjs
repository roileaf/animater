import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCanopyLight } from '../../../scripts/engines/motion/canopy-light.mjs';
import { createHeatShimmer } from '../../../scripts/engines/motion/sky-light.mjs';
import { createWindowShafts } from '../../../scripts/engines/motion/wall-shadows.mjs';

// Just enough of PIXI to build the layers without a screen.
class Thing { constructor() { this.children = []; this.position = { set() {} }; this.anchor = { set() {} }; } addChild(c) { this.children.push(c); c.parent = this; return c; } removeChild(c) { this.children = this.children.filter((k) => k !== c); } destroy() { this.destroyed = true; } }
class Graphics extends Thing { beginFill() { return this; } drawPolygon() { return this; } endFill() { return this; } beginHole() { return this; } endHole() { return this; } }
class Geometry { addAttribute() { return this; } addIndex() { return this; } }
class Mesh extends Thing { constructor(geometry, shader) { super(); this.shader = shader; } }
const PIXI = { Container: Thing, Sprite: Thing, Graphics, Geometry, Mesh, Texture: { WHITE: {}, EMPTY: {} }, BLEND_MODES: { ADD: 1 }, BlurFilter: class {}, Filter: class { constructor(v, f, uniforms) { this.uniforms = uniforms; } }, RenderTexture: { create: () => new Thing() }, Shader: { from: (v, f, uniforms) => ({ uniforms }) } };

test('baked again as the sun moves, the trees keep their clock and their clouds', () => {
  const root = new Thing(), canopy = createCanopyLight({ PIXI, root: () => root, render() {} });
  const tiles = { trees: [{ x: 0, y: 0, width: 10, height: 10, texture: {} }], bounds: { x: 0, y: 0, width: 100, height: 100 } };
  canopy.build(tiles);
  canopy.clouds({ clouds: 0.8, deck: [1, 2, 3, 4], shift: { x: -694, y: -85 }, angle: 0, wind: 0.2 });
  canopy.tick(60);
  canopy.build(tiles);
  const shader = root.children[0].shader.uniforms;
  assert.equal(shader.uTime, 60, 'the flecks and the leaves carry on');
  assert.deepEqual(shader.uCloudShift, [-694, -85], 'not a frame without its clouds');
  assert.equal(shader.uCloudsOn, 1);
});

test('the heat shimmer stays on through a look at the same ground, and is baked again for new ground', () => {
  let attaches = 0, detaches = 0, bakes = 0;
  const shimmer = createHeatShimmer({ PIXI, attach: () => attaches++, detach: () => detaches++, render: () => bakes++ });
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  shimmer.build({ hot: [[0, 0, 10, 0, 10, 10]], bounds });
  shimmer.set({ heat: 0.5, view: { x: 0, y: 0, scale: 1 } });
  shimmer.build({ hot: [[0, 0, 10, 0, 10, 10]], bounds });
  assert.equal(detaches, 0, 'never off the map');
  assert.equal(bakes, 1);
  assert.equal(shimmer.on, true);
  shimmer.build({ hot: [[0, 0, 20, 0, 20, 20]], bounds });
  assert.equal(bakes, 2);
  shimmer.clear();
  shimmer.build({ hot: [[0, 0, 20, 0, 20, 20]], bounds });
  assert.equal(bakes, 3, 'after clearing it bakes again');
});

test('the window dust carries on when the shafts are baked again for the sun', () => {
  const root = new Thing(), Sprite = class extends Thing { constructor() { super(); this.scale = { set() {} }; } }, Fake = { ...PIXI, Sprite, Color: class { constructor() { this.red = 1; this.green = 1; this.blue = 1; } } };
  class Graphic extends Graphics {}
  Fake.Graphics = Graphic;
  const shafts = createWindowShafts({ PIXI: Fake, root: () => root, render() {} });
  const args = { shafts: [{ points: [0, 0, 10, 0, 10, 10, 0, 10], alpha: 1 }], indoors: [[0, 0, 50, 0, 50, 50]], bounds: { x: 0, y: 0, width: 100, height: 100 } };
  shafts.build(args);
  shafts.tick(60);
  shafts.build(args);
  const motes = root.children.find((c) => c.shader);
  assert.equal(motes.shader.uniforms.uTime, 60);
});

test("the game's clock saved as a setting builds none of the map's layers again", () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  for (const call of ['lampSoon', 'draftSoon', 'floorLooksSoon', 'drawTracks', 'lifeSoon', 'syncCalendariaFlash', 'scheduleIdle', 'scheduleWounds']) assert.match(main, new RegExp(`if \\(!isClockSave\\([^)]*\\)\\) ${call}\\(`), call);
  assert.match(main, /if \(isClockSave\(first\)\) return; canopySoon\(\); glowsSoon\(\);/);
});
