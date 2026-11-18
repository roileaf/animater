import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VARIANTS, crownOpen, pictureOf, shadowReach, shadowLayerShown, boxWith, turnOf } from '../../../scripts/engines/motion/decorations.mjs';

// A farm map ran at 26.8 FPS with 576 render passes a frame. 58 of those passes were blurred shadow layers: 34 with
// nothing at all in them, and 24 standing off the bottom corner of the screen. Leaving those undrawn put the same map
// at 59.8 FPS and 54 passes.
test('a blurred shadow layer with nothing in it, nothing on it, or nothing near the screen is not drawn', () => {
  const view = { x: 0, y: 0, w: 1000, h: 800 }, box = (x, y) => ({ x, y, w: 200, h: 200 });
  const layer = (over) => ({ count: 3, alpha: 0.5, box: box(100, 100), ...over });
  assert.equal(shadowLayerShown(layer(), view, 300), true, 'on the screen, with shadows in it');
  assert.equal(shadowLayerShown(layer({ count: 0 }), view, 300), false, 'nothing in it: the blur runs over nothing');
  assert.equal(shadowLayerShown(layer({ alpha: 0 }), view, 300), false, 'cast shadows with no sun on them');
  assert.equal(shadowLayerShown(layer({ box: box(1250, 100) }), view, 300), true, 'just within the margin, so it is ready before it is seen');
  assert.equal(shadowLayerShown(layer({ box: box(1350, 100) }), view, 300), false, 'off to the side, past the margin');
  assert.equal(shadowLayerShown(layer({ box: box(100, 1150) }), view, 300), false, 'and off the bottom');
  // It comes back on its own: the same layer, once the view has moved toward it.
  assert.equal(shadowLayerShown(layer({ box: box(1350, 100) }), { ...view, x: 300 }, 300), true);
  // A rule that cannot see must not hide anything: no view yet, or a layer whose box is not known.
  assert.equal(shadowLayerShown(layer(), null, 300), true);
  assert.equal(shadowLayerShown(layer({ box: null }), view, 300), true);
  assert.equal(shadowLayerShown(undefined, view, 300), false, 'and nothing at all is nothing to draw');

  // The box is kept as the shadows are drawn, growing to hold each one and what it throws round itself.
  assert.deepEqual(boxWith(null, { x: 100, y: 100 }, 20), { x: 80, y: 80, w: 40, h: 40 });
  assert.deepEqual(boxWith({ x: 80, y: 80, w: 40, h: 40 }, { x: 200, y: 100 }, 20), { x: 80, y: 80, w: 140, h: 40 });
  assert.deepEqual(boxWith({ x: 80, y: 80, w: 40, h: 40 }, { x: 90, y: 90, y1: 0 }, 5), { x: 80, y: 80, w: 40, h: 40 }, 'one well inside leaves it as it was');

  // The frame loop hands the engine what is on the screen, and the layers are set from it there.
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /decorations\.tick\(seconds, viewNow\(\)\);/);
  const decor = readFileSync(new URL('../../../scripts/engines/motion/decorations.mjs', import.meta.url), 'utf8');
  assert.match(decor, /layer\.renderable = shadowLayerShown\(\{ count: layer\.children\.length, alpha: layer\.alpha, box: r\.box \}, view, margin\)/);
  assert.match(decor, /show\(r\.contact, near\); show\(r\.castLayer, cast\); show\(r\.lampLayer, lamp\);/,
    'all three of a region’s blurred layers, each with its own reach');
});

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
test("flipping Decorations can break never rebuilds a region; a break or a new hole does", async () => {
  const { createDecorations } = await import("../../../scripts/engines/motion/decorations.mjs");
  class Container { constructor() { this.children = []; } addChild(c) { this.children.push(c); return c; } removeChild() {} destroy() {} }
  const shadows = new Container(), layer = () => new Container(), deco = createDecorations({ PIXI: { Container }, shadows: () => shadows, ground: layer, above: layer });
  // Underground crystals go to the cavern engine (nothing painted here), so cavern() shows what the region draws.
  const settings = decorSettings({ on: true, where: "cave", seed: 3, density: 0, kinds: {}, brushed: [{ kind: "crystals", x: 50, y: 50, size: 0.6, turn: 0, seed: 1 }] });
  const areas = [[0, 0, 100, 0, 100, 100, 0, 100]], builds = () => shadows.children.length, region = { id: "R1", settings, areas, look: {} };
  const key = decorKeyed(region, 100)[0].key;
  deco.sync([region]); const once = builds();
  assert.ok(once > 0); assert.equal(deco.cavern().crystals.length, 1);
  deco.sync([{ ...region, settings: { ...settings, canBreak: true } }]);
  assert.equal(builds(), once);
  deco.sync([{ ...region, settings: { ...settings, canBreak: true }, broken: [key] }]);
  assert.equal(builds(), once * 2); assert.equal(deco.cavern().crystals.length, 0);
  // A hole cut round the crystals (only the hole changes): the region rebuilds and they are gone.
  const holed = [Object.assign([...areas[0]], { holes: [[30, 30, 70, 30, 70, 70, 30, 70]] })];
  deco.sync([{ ...region, areas: holed }]); const three = builds();
  assert.equal(deco.cavern().crystals.length, 1); // (brushed ones stay: they are put down by hand)
  deco.sync([{ ...region, areas: [Object.assign([...areas[0]], { holes: [[20, 20, 80, 20, 80, 80, 20, 80]] })] }]);
  assert.equal(builds(), three + once);
});

test('only the cloth stirs in the wind: a masked ripple over the fabric, the frame and wares left still; none in a calm', async () => {
  const { clothMotion, CLOTH_SHADER_SOURCES } = await import('../../../scripts/engines/motion/decorations.mjs');
  const { DECOR_KINDS } = await import('../../../scripts/engines/motion/decor-paint.mjs');
  assert.ok(DECOR_KINDS.marketStall.cloth && DECOR_KINDS.tent.cloth && !DECOR_KINDS.crate.cloth);
  const d = { seed: 42 };
  assert.equal(clothMotion(d, { strength: 0 }, 3).push, 0);
  const most = (strength) => Math.max(...Array.from({ length: 200 }, (_, i) => clothMotion(d, { strength, angle: 0.5 }, i * 0.05).push));
  assert.ok(most(0.3) > 0 && most(0.3) < most(1) && most(1) <= 1);
  // In the picture's own frame: a stall turned with the wind feels it straight along.
  const m = clothMotion(d, { strength: 0.5, angle: 1 }, 1, 1); assert.ok(Math.abs(m.dir[0] - 1) < 1e-9 && Math.abs(m.dir[1]) < 1e-9);
  // The shader moves only what the mask calls cloth (smoothstep on the mask), never the whole picture.
  assert.match(CLOTH_SHADER_SOURCES[0][1], /float m = mix\(mix\(smoothstep\(0\.5, 1\.0, mask\),/);
  assert.match(CLOTH_SHADER_SOURCES[0][1], /\* wave \* uPush\) \* m \* uAmp\)/);
});

test('wet decorations go darker while the ground is soaked, leafy crowns and water seeing to their own', () => {
  const src = readFileSync(new URL('../../../scripts/engines/motion/decor-paint.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(o\.wet > 0 && !k\.water && !k\.tree && kind !== 'bush'\)/);
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /decorations\.wind\(\{ strength: undergroundScene\(\) \? 0 : skyWindNow, angle: skyWindAngle \}\)/);
});

test('decorations follow the ground as snow builds or melts, rain soaks in or dries, or the season turns, not only when the clock jumps', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const decorWeatherNow = \(\) => \{ try \{ const g = groundOf\(\)\.now; return `\$\{snowCoverOn\(\) \? Math\.round\(\(g\.snow \?\? 0\) \* 20\) : 0\}/);
  assert.match(main, /decorWeatherAt \+= seconds; if \(decorWeatherAt >= 1\) \{ decorWeatherAt = 0; const key = decorWeatherNow\(\); if \(key !== decorWeatherKey\) \{ decorWeatherKey = key; try \{ syncDecorations\(\);/);
});

test('plants and tree crowns sway in the wind from their middle out (the trunk and root stay put); nothing sways underground', async () => {
  const { PLANTS, CLOTH_SHADER_SOURCES } = await import('../../../scripts/engines/motion/decorations.mjs');
  for (const id of ['bush', 'fern', 'grass', 'reeds', 'flowers', 'agave']) assert.ok(PLANTS.has(id));
  assert.ok(!PLANTS.has('crate') && !PLANTS.has('rock'));
  assert.match(CLOTH_SHADER_SOURCES[0][1], /smoothstep\(0\.06, 0\.48, length\(vUv - 0\.5\)\), uRadial\)/);
  const src = readFileSync(new URL('../../../scripts/engines/motion/decorations.mjs', import.meta.url), 'utf8');
  assert.match(src, /where !== 'cave' && PIXI\.Mesh \? clothMesh\(pic, d, scale, 'crown'\)/);
  assert.match(src, /PLANTS\.has\(d\.kind\) && where !== 'cave' && PIXI\.Mesh/);
});

test('a stronger wind sways things further, hardly faster', async () => {
  const { CLOTH_SHADER_SOURCES } = await import('../../../scripts/engines/motion/decorations.mjs');
  assert.match(CLOTH_SHADER_SOURCES[0][1], /time \* \(1\.4 \+ 0\.5 \* uPush\)/);
  assert.match(CLOTH_SHADER_SOURCES[0][1], /\* wave \* uPush\) \* m \* uAmp\)/);
});

test('a decoration turned with the brush (Shift+wheel) breaks where it is drawn: its wreck takes the painter\'s own turn', async () => {
  const { stampDecor } = await import('../../../scripts/engines/motion/decor-paint.mjs');
  const { decorView } = await import('../../../scripts/engines/props/decor-break.mjs');
  const turned = stampDecor({ x: 400, y: 400, radius: 10, grid: 100, kinds: ['crate'], seed: 3, turn: 1.2 }), free = { ...turned, turn: 1.2, fixed: undefined };
  const settings = decorSettings({ on: true, seed: 1, density: 0, kinds: {}, brushed: [turned, { ...free, x: 700 }] });
  const keyed = decorKeyed({ id: 'R1', settings, areas: [[0, 0, 1000, 0, 1000, 1000, 0, 1000]] }, 100);
  const tile = (k) => decorWreckTile(decorView(k, { id: 'R1', levels: [] }, 100), { texture: {}, canvas: {}, width: 80, key: 'p' });
  const a = keyed.find((k) => k.d.x === turned.x), b = keyed.find((k) => k.d.x === 700);
  assert.equal(a.d.fixed, true, 'the stored stamp keeps its whole turn');
  assert.ok(Math.abs(tile(a).rotation - (1.2 * 180) / Math.PI) < 1e-9);
  assert.ok(Math.abs(tile(b).rotation - (1.2 * 0.4 * 180) / Math.PI) < 1e-9, 'a crate laid without a turn stays near square, wreck and all');
  // The painter turns each sprite, mesh and shadow by the same turnOf.
  const src = readFileSync(new URL('../../../scripts/engines/motion/decorations.mjs', import.meta.url), 'utf8');
  assert.match(src, /const place = \(sprite, d, pic, scale\) => \{ sprite\.anchor\.set\(0\.5\); sprite\.position\.set\(d\.x, d\.y\); sprite\.rotation = turnOf\(d\);/);
  assert.match(src, /rotation: \(turnOf\(d\) \* 180\) \/ Math\.PI/);
});

test('loose papers flutter in the wind: their edges lift, their middles stay down', async () => {
  const { DECOR_KINDS } = await import('../../../scripts/engines/motion/decor-paint.mjs');
  const { CLOTH_SHADER_SOURCES } = await import('../../../scripts/engines/motion/decorations.mjs');
  assert.equal(DECOR_KINDS.papers.cloth, 'paper');
  assert.match(CLOTH_SHADER_SOURCES[0][1], /smoothstep\(0\.08, 0\.4, mask\) \* \(1\.0 - smoothstep\(0\.55, 0\.95, mask\)\), uEdge\)/);
});


// Roi: painting with the brush sometimes dropped the frame rate hard. Two reasons, both measured, both pinned here.

// One: the lamps. A light whose id changes is destroyed, built again, and Foundry asked to redo its lighting and every
// creature's vision. The ids used to count through the placement list, so a single dab renamed every lamp after it (of
// twelve lamps in a test region, one dab kept none of them). An id now says where its light stands.
test('a lamp keeps its id when another decoration is laid beside it', async () => {
  const { decorLightList } = await import('../../../scripts/engines/motion/decorations.mjs');
  const lamp = { kind: 'lampPost', x: 300, y: 300, size: 1, turn: 0, seed: 11 };
  const other = { kind: 'lampPost', x: 800, y: 300, size: 1, turn: 0, seed: 12 };
  const before = decorLightList('R1', [lamp, other], [lamp, other], {}).map((l) => l.id);
  // The same two lamps, with something new sorted in ahead of them and the list in another order.
  const later = [{ kind: 'bush', x: 100, y: 100, size: 1, turn: 0, seed: 99 }, other, lamp];
  const after = decorLightList('R1', later, later, {}).map((l) => l.id);
  assert.deepEqual([...after].sort(), [...before].sort(), 'both lamps answer to the names they had');
  assert.notEqual(before[0], before[1], 'and two lamps are still told apart');
});

// Two: the drawing. A stroke syncs ten times a second, and every sync used to throw the whole region away and build it
// again - every sprite and every shadow - which measured 12 to 18 ms in a region of a few hundred. A stroke that is only
// adding to what it has laid now draws the new dabs alone.
test('a dab draws itself, and leaves the region it lands in standing', async () => {
  const { createDecorations } = await import('../../../scripts/engines/motion/decorations.mjs');
  const { decorSettings } = await import('../../../scripts/engines/motion/decor-regions.mjs');
  let made = 0, killed = 0;
  class Container { constructor() { this.children = []; } addChild(c) { this.children.push(c); return c; } removeChild(c) { this.children = this.children.filter((k) => k !== c); } destroy() { killed++; } }
  class Sprite extends Container { constructor(texture) { super(); made++; this.texture = texture; this.anchor = { set() {} }; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }; this.scale = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y ?? x; } }; this.rotation = 0; } }
  // A canvas that answers every call with nothing: the painter runs, the pictures are shapes nobody looks at.
  const ctx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? null : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 0 }) : () => {}), set: () => true });
  const make = (w, h) => ({ width: w, height: h, getContext: () => ctx });
  const layer = () => stage, stage = new Container();
  const deco = createDecorations({ PIXI: { Container, Sprite, Texture: { from: (c) => ({ width: c?.width ?? 8, height: c?.height ?? 8 }) } }, shadows: layer, ground: layer, above: layer, grid: () => 100, make });
  const bush = (i) => ({ kind: 'bush', x: 200 + i * 200, y: 200, size: 1, turn: 0, seed: i + 1, flip: false });
  // The brush pushes onto one array as it paints; this is that array.
  const brushed = [bush(0), bush(1), bush(2)];
  // As main.mjs hands it over while a stroke paints: the region's settings with the live array itself in place of its brushed.
  const base = decorSettings({ on: true, where: 'surface', seed: 3, density: 0, kinds: {}, brushed: [] });
  const spec = (list = brushed) => ({ id: 'R1', live: true, look: {}, areas: [[0, 0, 1000, 0, 1000, 1000, 0, 1000]], settings: { ...base, brushed: list } });
  deco.sync([spec()]);
  const first = made;
  assert.ok(first >= 3, 'the three it started with are drawn');
  made = 0; killed = 0;
  brushed.push(bush(3));
  deco.sync([spec()]);
  assert.equal(killed, 0, 'nothing already on the map was thrown away');
  assert.ok(made > 0 && made <= first / 2, `only the new dab was drawn (${made} of ${first})`);
  // Rubbing out hands the sync a different array, and that still rebuilds: what it takes away has to go.
  made = 0; killed = 0;
  deco.sync([spec(brushed.slice(0, 2))]);
  assert.ok(killed > 0, 'a stroke that rubs out builds the region again');
});
