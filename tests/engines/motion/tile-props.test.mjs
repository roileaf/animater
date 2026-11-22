import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tileProp, propHeight, propBurning, tileProps, PROP_CHOICE, PROP_MOST_SQUARES } from '../../../scripts/engines/motion/tile-props.mjs';
import { createDecorations, decorHeight, LAMP_GLINT_LEAST } from '../../../scripts/engines/motion/decorations.mjs';

const FA = 'https://example.test/assets/!Core_Settlements/Storage/';

test('a tile stands as a thing only where the scene says so, or the tile itself does', () => {
  const barrel = { solid: 0.6, squares: 1, src: FA + 'Barrel_Wood_Light_E_1x1.webp' };
  assert.equal(tileProp({ ...barrel, on: false }), false, 'off unless turned on');
  assert.equal(tileProp({ ...barrel, on: true }), true);
  assert.equal(tileProp({ ...barrel, on: false, choice: PROP_CHOICE }), true, 'its own say counts with the scene off');
  for (const choice of ['none', 'tree', 'roof']) assert.equal(tileProp({ ...barrel, on: true, choice }), false);
});

test('floors, roofs, big pictures and what lies flat are left alone', () => {
  const on = true;
  assert.equal(tileProp({ on, solid: 0.99, squares: 2, src: 'floor_stone.webp' }), false, 'a picture filling its rectangle is a floor');
  assert.equal(tileProp({ on, solid: 0.5, squares: 2, overhead: true, src: 'thing.webp' }), false, 'overhead is the canopy\'s');
  assert.equal(tileProp({ on, solid: 0.5, squares: PROP_MOST_SQUARES + 1, src: 'thing.webp' }), false, 'too big to be a thing');
  for (const name of ['Rug_Rectangle_Huge_DesignB_Yellow_A1_5x4', 'Blood_Stain_A3', 'Puddle_Mud_B1', 'Crack_Ground_C2']) assert.equal(tileProp({ on, solid: 0.6, squares: 2, src: FA + name + '.webp' }), false, name);
  // A big one all the same, if the GM says so.
  assert.equal(tileProp({ choice: PROP_CHOICE, solid: 0.99, squares: 20, overhead: true }), true);
});

test('a picture that could not be read is a thing when small', () => {
  assert.equal(tileProp({ on: true, solid: null, squares: 2, src: 'crate.webp' }), true);
  assert.equal(tileProp({ on: true, solid: null, squares: 7, src: 'crate.webp' }), false);
});

test('height: its own first, else by its name, never much more than it is wide', () => {
  assert.equal(propHeight({ own: 10, per: 5 }), 2);
  assert.equal(propHeight({ own: 0, per: 5 }), 0, 'told to stand no height: casts nothing');
  assert.equal(propHeight({ src: FA + 'Cart_Wood_Light_Filled_A3_2x3.webp', squares: 3 }), 1);
  assert.equal(propHeight({ src: FA + 'Sack_Olive_Leaking_Grain_A1_1x1.webp', squares: 1 }), 0.3);
  assert.equal(propHeight({ src: FA + 'Barrel_Wood_Light_E_1x1.webp', squares: 1 }), 0.6);
  assert.ok(propHeight({ src: 'Boulder_tiny.webp', squares: 0.25 }) <= 0.3);
  for (const own of [null, '']) assert.equal(propHeight({ own, src: 'crate.webp' }), 0.6);
});

test('a fire is told by its name, an unlit one is not one', () => {
  assert.equal(propBurning(FA + 'Campfire_Wood_Ashen_Stone_Earthy_Lit_C1_2x2.webp'), true);
  assert.equal(propBurning(FA + 'Campfire_Unlit_A1.webp'), false);
  assert.equal(propBurning(FA + 'Barrel_Wood.webp'), false);
});

test('the scene\'s tiles become the engine\'s list: hidden ones out, degrees to radians, heights and fires worked out', () => {
  const tex = {}, tile = (more) => ({ id: 'a', src: FA + 'Barrel_Wood_E_1x1.webp', choice: '', own: null, hidden: false, overhead: false, solid: 0.6, texture: tex, x: 500, y: 300, width: 100, height: 100, rotation: 90, alpha: 0.8, indoors: false, ...more });
  const out = tileProps([tile(), tile({ id: 'b', hidden: true }), tile({ id: 'c', src: FA + 'Rug_Red.webp' }), tile({ id: 'd', src: FA + 'Campfire_Lit_A.webp', indoors: true, width: -200 }), tile({ id: 'e', texture: null })], { on: true, grid: 100, per: 5 });
  assert.deepEqual(out.map((p) => p.id), ['a', 'd']);
  assert.ok(Math.abs(out[0].rotation - Math.PI / 2) < 1e-9); assert.equal(out[0].high, 0.6); assert.equal(out[0].alpha, 0.8); assert.equal(out[0].snowless, false);
  assert.equal(out[1].snowless, true); assert.equal(out[1].indoors, true); assert.equal(out[1].width, -200); assert.equal(out[1].high, 0.3);
  assert.deepEqual(tileProps([tile()], { on: false }), []);
});

// A PIXI just big enough for the decorations' shadows.
function fakePIXI() {
  class Container {
    constructor() { this.children = []; this.parent = null; this.alpha = 1; this.visible = true; this.rotation = 0; this.destroyed = false; const self = this; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y ?? x; } }; this.scale = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y ?? x; } }; void self; }
    addChild(c) { c.parent?.removeChild(c); c.parent = this; this.children.push(c); return c; }
    addChildAt(c, i) { c.parent = this; this.children.splice(i, 0, c); return c; }
    getChildIndex(c) { return this.children.indexOf(c); }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parent = null; return c; }
    destroy() { this.destroyed = true; }
  }
  class Sprite extends Container { constructor(texture) { super(); this.texture = texture; this.tint = 0xffffff; this.isSprite = true; this.anchor = { set() {} }; } }
  return { Container, Sprite };
}
const world = () => {
  const PIXI = fakePIXI(), layers = { shadows: new PIXI.Container(), ground: new PIXI.Container(), above: new PIXI.Container(), flat: new PIXI.Container() };
  return { PIXI, layers, decorations: createDecorations({ PIXI, shadows: () => layers.shadows, ground: () => layers.ground, above: () => layers.above, flat: () => layers.flat, grid: () => 100 }) };
};
const texture = () => ({ width: 200, height: 200, destroyed: false });
const piece = (more = {}) => ({ id: 't1', texture: texture(), x: 1000, y: 800, width: 100, height: 100, rotation: 0, high: 0.6, alpha: 1, ...more });

test('a tile says its own height to the decorations', () => {
  assert.equal(decorHeight({ high: 0.7 }), 0.7); assert.equal(decorHeight({ high: -1 }), 0); assert.equal(decorHeight({ kind: 'no-such-kind', size: 1 }), 0);
});

test('a tile standing as a thing gets a foot, a cast shadow and its own picture over them', () => {
  const { layers, decorations } = world(), tex = texture();
  decorations.props([piece({ texture: tex })]);
  const [contactFloor, castFloor, lampFloor] = layers.shadows.children;
  assert.equal(contactFloor.children[0].children.length, 1, 'the dark at its foot'); assert.equal(castFloor.children[0].children.length, 1, 'its cast shadow');
  assert.equal(lampFloor.children[0].children.length, 0);
  const foot = contactFloor.children[0].children[0];
  assert.equal(foot.texture, tex, 'the shadow is its own picture'); assert.equal(foot.tint, 0x06070c, 'made dark');
  const copy = layers.ground.children[0];
  assert.equal(copy.texture, tex); assert.equal(copy.position.x, 1000); assert.equal(copy.scale.x, 0.5, 'drawn at the tile\'s own size');
  assert.equal(decorations.busy, true);
});

test('the sun turns and stretches its shadow; none indoors, none with no sun', () => {
  const { layers, decorations } = world();
  decorations.props([piece(), piece({ id: 't2', x: 2000, indoors: true })]);
  const cast = layers.shadows.children[1].children[0].children;
  decorations.light({ sun: { angle: 0, length: 2, strength: 1 } });
  assert.equal(cast[0].visible, true); assert.ok(cast[0].position.x > 1000 && cast[0].position.y === 800, 'away from the sun'); assert.ok(cast[0].scale.x > 1, 'stretched');
  assert.equal(cast[1].visible, false, 'under a roof');
  const x = cast[0].position.x; decorations.light({ sun: { angle: 0, length: 3, strength: 1 } }); assert.ok(cast[0].position.x > x, 'a lower sun, a longer shadow');
  decorations.light({ sun: null }); assert.equal(cast[0].visible, false);
});

test('a lamp near it throws its shadow away from the lamp', () => {
  const { layers, decorations } = world();
  decorations.props([piece()]); decorations.lamps([{ x: 900, y: 800, radius: 600, strength: 1 }]);
  const lamp = layers.shadows.children[2].children[0].children;
  assert.equal(lamp.length, 1); assert.equal(lamp[0].visible, true); assert.ok(lamp[0].position.x > 1000);
});

test('a tile that stands no height casts nothing but is still drawn; mirrored and squashed ones keep their shape', () => {
  const { layers, decorations } = world();
  decorations.props([piece({ high: 0 }), piece({ id: 't2', width: -100, height: 50 })]);
  assert.equal(layers.shadows.children[0].children[0].children.length, 1); assert.equal(layers.ground.children.length, 2);
  const wide = layers.ground.children[1]; assert.equal(wide.scale.x, -0.5); assert.equal(wide.scale.y, 0.25);
});

test('rain darkens it, another picture of it is the one drawn, and its shadow is still its own', () => {
  const { layers, decorations } = world(), tex = texture(), autumn = texture();
  decorations.props([piece({ texture: tex, art: autumn })], { wet: 1 });
  const copy = layers.ground.children[0]; assert.equal(copy.texture, autumn); assert.ok(copy.tint < 0xffffff);
  assert.equal(layers.shadows.children[0].children[0].children[0].texture, tex);
});

// The same, with what a lit mesh needs.
const litWorld = () => {
  const PIXI = fakePIXI();
  PIXI.Geometry = class { addAttribute() { return this; } addIndex() { return this; } };
  PIXI.Shader = { from: (vert, frag, uniforms) => ({ uniforms }) };
  PIXI.Mesh = class extends PIXI.Container { constructor(geometry, shader) { super(); this.shader = shader; this.worldAlpha = 1; } };
  const layers = { shadows: new PIXI.Container(), ground: new PIXI.Container() };
  return { layers, decorations: createDecorations({ PIXI, shadows: () => layers.shadows, ground: () => layers.ground, above: () => layers.ground, flat: () => layers.ground, grid: () => 100 }) };
};
const amounts = (mesh) => [0, 1, 2, 3].map((i) => mesh.shader.uniforms.uCol[i * 4 + 3]);

test('with its relief a tile is drawn lit: only its glints by default, the sun and a torch handed to it', () => {
  const { layers, decorations } = litWorld(), maps = texture();
  decorations.props([piece({ maps }), piece({ id: 't2', x: 3000, maps, indoors: true })]);
  const [mesh, roofed] = layers.ground.children, u = mesh.shader.uniforms;
  assert.equal(mesh.lit, true); assert.equal(u.uMaps, maps); assert.equal(u.uShade, 0, 'no shading of its form unless asked'); assert.ok(u.uGlint > 1, 'its metal still glints'); assert.ok(u.uRelief > 0);
  assert.equal(mesh.position.x, 1000); assert.equal(mesh.scale.x, 0.5);
  assert.deepEqual(amounts(mesh), [0, 0, 0, 0], 'no light yet');
  decorations.light({ sun: { angle: 0, length: 1, strength: 0.8, color: [1, 0.6, 0.3] } });
  assert.ok(Math.abs(amounts(mesh)[0] - 0.8) < 1e-6, 'the sun'); assert.deepEqual([0, 1, 2].map((i) => +u.uCol[i].toFixed(2)), [1, 0.6, 0.3], 'in its own colour'); assert.ok(u.uDir[0] < 0, 'which stands the other way from its shadows');
  assert.deepEqual(amounts(roofed), [0, 0, 0, 0], 'none under a roof');
  decorations.lamps([{ x: 900, y: 800, radius: 600, strength: 1 }]);
  assert.ok(amounts(mesh)[1] > 0.3, 'and a torch near it'); assert.ok(amounts(roofed)[0] === 0, 'too far for the other');
  decorations.lamps([]); assert.equal(amounts(mesh)[1], 0, 'carried away again');
});

test('by day a lamp throws no shadow of a tile but its metal still answers the flame', () => {
  const { layers, decorations } = litWorld(), maps = texture();
  decorations.props([piece({ maps })]);
  // (Against a noon sky a lamp's strength is next to nothing.)
  decorations.lamps([{ x: 900, y: 800, radius: 600, strength: 0.01 }]);
  assert.equal(layers.shadows.children[2].children[0].children.length, 0, 'no shadow from it');
  const day = amounts(layers.ground.children[0])[0];
  assert.ok(day > 0.2, `the flame in its metal (${day})`);
  decorations.lamps([{ x: 900, y: 800, radius: 600, strength: 1 }]);
  assert.ok(amounts(layers.ground.children[0])[0] > day, 'and more of it after dark');
  assert.ok(LAMP_GLINT_LEAST > 0.2 && LAMP_GLINT_LEAST < 0.7);
});

test('the scene\'s relief is how much of the shading is laid on, and rain goes into the lit picture', () => {
  const { layers, decorations } = litWorld(), maps = texture();
  decorations.props([piece({ maps })], { shade: 0.6, wet: 1 });
  const u = layers.ground.children[0].shader.uniforms;
  assert.equal(u.uShade, 0.6); assert.ok(u.uTint[0] < 1 && u.uTint[2] >= u.uTint[0]);
  const first = layers.ground.children[0];
  decorations.props([piece({ maps })], { shade: 0.2, wet: 1 }); assert.notEqual(layers.ground.children[0], first, 'a new relief: drawn again');
  // A tile whose picture could not be read has no relief and is drawn plain.
  decorations.props([piece()], {}); assert.equal(layers.ground.children[0].lit, undefined);
});

test('nothing is rebuilt when nothing changed, and the regions\' own sync leaves the tiles standing', () => {
  const { layers, decorations } = world(), list = [piece()];
  decorations.props(list); const copy = layers.ground.children[0];
  decorations.props(list.map((p) => ({ ...p }))); assert.equal(layers.ground.children[0], copy, 'the same sprite');
  decorations.sync([]); assert.equal(decorations.busy, true); assert.equal(copy.destroyed, false);
  decorations.props([{ ...list[0], x: 1200 }]); assert.equal(copy.destroyed, true, 'moved: drawn again');
  decorations.props([]); assert.equal(decorations.busy, false);
});

test('main wires it: a scene switch off by default, a tile\'s own choice, and tiles told to be things kept from the canopy', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /flags\?\.\[ID\]\?\.tileProps === true/);
  assert.match(main, /name="flags\.\$\{ID\}\.tileProps"/);
  assert.match(main, /\[PROP_CHOICE, "Object: its own shadow, snow and rain"\]/);
  assert.match(main, /sunlight === PROP_CHOICE\) continue;/);
  assert.match(main, /decorations\.sync\(list\);\r?\n  syncTileProps\(\);/);
  // The sun's own colour goes with it, so what glints is gold at dusk and silver under the moon.
  assert.match(main, /directSun\(skyCoverNow\), color: sunlightColor\(\) \} : null;/);
  // Its relief read from its picture, and the scene's own Relief (nothing by default).
  assert.match(main, /reliefPixels\(ctx\.getImageData\(0, 0, w, h\)\.data, w, h\)/);
  assert.match(main, /name="flags\.\$\{ID\}\.tileRelief"/);
  assert.match(main, /Number\(canvas\?\.scene\?\.flags\?\.\[ID\]\?\.tileRelief\) \|\| 0/);
  // A growing tile turns with the season: only mostly-green ones, never a big one, summer left as it is.
  assert.match(main, /if \(!season \|\| season === "summer"\) return null;/);
  assert.match(main, /Math\.max\(w, h\) <= TILE_SEASON_MOST/);
  assert.match(main, /greenShare\(px\.data, w, h\) > 0\.3\) \{ ctx\.putImageData\(new ImageData\(underConditions\(px\.data, w, h, \{ season \}\)/);
});
