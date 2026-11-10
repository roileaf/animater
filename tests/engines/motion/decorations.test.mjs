import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VARIANTS, crownOpen, pictureOf, shadowReach, turnOf } from '../../../scripts/engines/motion/decorations.mjs';

test('decorations share a few pictures a kind: a look by seed, a size step, and the weather that changes its paint', () => {
  const a = pictureOf({ kind: 'rock', seed: 3, size: 0.4 }), b = pictureOf({ kind: 'rock', seed: 3 + VARIANTS, size: 0.41 });
  assert.equal(a.key, b.key, 'same look and size step');
  assert.notEqual(pictureOf({ kind: 'rock', seed: 4, size: 0.4 }).key, a.key, 'another look');
  assert.notEqual(pictureOf({ kind: 'rock', seed: 3, size: 0.8 }).key, a.key, 'another size step');
  assert.notEqual(pictureOf({ kind: 'oak', seed: 3, size: 2.6 }, { season: 'autumn' }).key, pictureOf({ kind: 'oak', seed: 3, size: 2.6 }, { season: 'summer' }).key, 'its season');
});

test('a crown opens over a creature under it and stays shut for one beside it', () => {
  const tree = { x: 500, y: 500, size: 2.6 };
  assert.equal(crownOpen(tree, [{ x: 500, y: 500, width: 100 }], 100), 1);
  assert.equal(crownOpen(tree, [{ x: 900, y: 500, width: 100 }], 100), 0);
  const edge = crownOpen(tree, [{ x: 640, y: 500, width: 100 }], 100);
  assert.ok(edge > 0 && edge <= 1);
});

test('a shadow reaches as far as the thing is tall and the sun is low', () => {
  assert.equal(shadowReach(0, 2, 100), 0);
  assert.ok(shadowReach(2, 2, 100) > shadowReach(1, 2, 100));
  assert.ok(shadowReach(1, 2.5, 100) > shadowReach(1, 0.4, 100));
});

test('a light throws a decoration\'s shadow away from it: longer the nearer the light and the taller the thing, fading with distance', async () => {
  const { lampShadow } = await import('../../../scripts/engines/motion/decorations.mjs');
  const boulder = { x: 500, y: 500 }, torch = (x, y, extra = {}) => ({ x, y, radius: 600, strength: 1, ...extra });
  const s = lampShadow(boulder, 1.2, torch(300, 500));
  assert.ok(s && Math.abs(s.angle) < 1e-9, 'away from the light (east)');
  assert.ok(lampShadow(boulder, 1.2, torch(500, 300)).angle > 1.5, 'a light to the north throws it south');
  assert.ok(lampShadow({ x: 500, y: 500 }, 0.3, torch(300, 500)).reach < s.reach, 'a low thing throws a short shadow');
  assert.ok(lampShadow(boulder, 1.2, torch(480, 500)).reach >= 1.2 * 100 * 0.9 - 1e-9, 'a light right beside a tall rock still throws a long shadow');
  assert.ok(lampShadow(boulder, 1.2, torch(100, 500)).alpha < s.alpha, 'fainter further away');
  assert.ok(lampShadow(boulder, 3, torch(400, 500)).reach <= 600 - 100 + 1e-9, 'never past the light\'s reach');
  assert.equal(lampShadow(boulder, 1.2, torch(-200, 500)), null, 'out of its reach');
  assert.equal(lampShadow(boulder, 1.2, torch(300, 500, { strength: 0 })), null, 'a light lost in daylight');
  assert.equal(lampShadow(boulder, 0, torch(300, 500)), null, 'flat things none');
});

test('lights are wired to the decorations a few times a second, weighed against the sky', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /decorations\.lamps\(shadowsOffHere\(\) \? \[\] : floorLightSources\(\)\)/);
});

test('solid things only turn a little; crowns and plants any way', () => {
  assert.equal(turnOf({ kind: 'oak', turn: 2 }), 2);
  assert.ok(Math.abs(turnOf({ kind: 'crate', turn: 2 })) < 1);
});

import { decorShown, decorWreckTile } from "../../../scripts/engines/motion/decorations.mjs";
import { decorKeyed } from "../../../scripts/engines/props/decor-break.mjs";
import { decorSettings } from "../../../scripts/engines/motion/decor-regions.mjs";
test("broken decorations are not drawn; the water keeps its ids", () => {
  const settings = decorSettings({ on: true, seed: 3, density: 1, kinds: { crate: {}, puddle: {} } }), areas = [[0, 0, 1000, 0, 1000, 1000, 0, 1000]];
  const spec = { id: "R1", settings, areas }, crate = decorKeyed(spec, 100).find((k) => k.d.kind === "crate");
  const { placements, shown } = decorShown({ ...spec, broken: [crate.key] }, 100), same = (d) => d.kind === "crate" && d.x === crate.d.x && d.y === crate.d.y;
  assert.ok(placements.some(same) && !shown.some(same));
  assert.equal(shown.length, placements.length - 1);
  const src = readFileSync(new URL("../../../scripts/engines/motion/decorations.mjs", import.meta.url), "utf8");
  assert.match(src, /water\(\) \{[\s\S]*?r\.placements\.forEach/);
});
test("a wreck tile stands, turns and mirrors as the decoration is drawn", () => {
  const d = { kind: "cobweb", x: 300, y: 200, size: 1, turn: 1, seed: 1, flip: true };
  const view = { id: "decor:R1:k", levels: ["L1"], texture: { src: "decor/cobweb.webp" }, flags: { animater: { prop: { material: "plant", style: "burn" } } }, decor: { regionId: "R1", key: "k", kind: "cobweb", d } };
  const art = { texture: {}, canvas: {}, width: 124, key: "pic" }, t = decorWreckTile(view, art);
  assert.deepEqual([t.x, t.y, t.width, t.height, t.texture.scaleX, t.texture.anchorX], [300, 200, 124, 124, -1, 0.5]);
  assert.equal(t.art, art); assert.ok(Math.abs(t.rotation - 180 / Math.PI) < 1e-9); // flat kinds turn freely
  assert.equal(decorWreckTile({ ...view, decor: { ...view.decor, d: { ...d, kind: "crate" } } }, art).texture.scaleX, 1);
});
test("flipping Decorations can break never rebuilds a region; a new break does", async () => {
  const { createDecorations } = await import("../../../scripts/engines/motion/decorations.mjs");
  class Container { constructor() { this.children = []; } addChild(c) { this.children.push(c); return c; } removeChild() {} destroy() {} }
  const shadows = new Container(), layer = () => new Container(), deco = createDecorations({ PIXI: { Container }, shadows: () => shadows, ground: layer, above: layer });
  const settings = decorSettings({ on: true, seed: 3, density: 1, kinds: {} }), areas = [[0, 0, 100, 0, 100, 100, 0, 100]], builds = () => shadows.children.length;
  deco.sync([{ id: "R1", settings, areas, look: {} }]); const once = builds();
  assert.ok(once > 0);
  deco.sync([{ id: "R1", settings: { ...settings, canBreak: true }, areas, look: {} }]);
  assert.equal(builds(), once);
  deco.sync([{ id: "R1", settings: { ...settings, canBreak: true }, areas, look: {}, broken: ["crate:1:2:h"] }]);
  assert.equal(builds(), once * 2);
});
