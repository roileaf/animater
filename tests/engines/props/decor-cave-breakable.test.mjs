// Which underground crystals and cobwebs can break is decided from what every screen shares (the scene's regions, walls,
// lights and the world's switches), never from one screen's Quality, its own Cave crystals / Cave webs switches or its
// sparks and dust (final review I1).
import test from "node:test";
import assert from "node:assert/strict";
import { decorCaveBreakable, lightFloor, createDecorIndex, decorDrawn, decorTargets } from "../../../scripts/engines/props/decor-break.mjs";
import { decorSettings } from "../../../scripts/engines/motion/decor-regions.mjs";
import { webCorners } from "../../../scripts/engines/motion/webs.mjs";

const grid = 100;
// Eight wall corners in a row, a brushed cobweb at each, and two crystals.
const walls = [], brushed = [];
for (let i = 0; i < 8; i++) { const x = 300 + i * 400; walls.push({ c: [x, 300, x, 600], move: 20, door: 0 }, { c: [x, 300, x + 300, 300], move: 20, door: 0 }); brushed.push({ kind: "cobweb", x: x + 40, y: 340, size: 1, turn: 0, seed: i + 1, flip: false }); }
brushed.push({ kind: "crystals", x: 500, y: 800, size: 0.6, turn: 0, seed: 20, flip: false }, { kind: "crate", x: 900, y: 800, size: 0.8, turn: 0, seed: 21, flip: false });
const region = { id: "R1", levels: [], settings: decorSettings({ on: true, where: "cave", density: 0, seed: 3, kinds: {}, brushed, canBreak: true }), areas: [[0, 0, 4000, 0, 4000, 1000, 0, 1000]] };
// A lamp lighting the left half only.
const lights = [[0, 0, 1900, 0, 1900, 1000, 0, 1000]];
// What each screen has set: the world's switches are the same on both, everything of the screen's own differs.
const world = { caveCrystals: true, caveWebs: true };
const gmScreen = { ...world, quality: "full", caveCrystalsLocal: true, caveWebsLocal: true, lampEmbers: true, lampEmbersLocal: true, lampMotes: true, lampMotesLocal: true, regionStepsLocal: true };
const lowPlayer = { ...world, quality: "low", caveCrystalsLocal: false, caveWebsLocal: false, lampEmbers: true, lampEmbersLocal: false, lampMotes: true, lampMotesLocal: false, regionStepsLocal: false };
const read = (screen) => (key) => screen[key];
const layout = (screen, extra = {}) => decorCaveBreakable({ setting: read(screen), decorRegions: [region], walls, lights, grid, seed: "scene", index: createDecorIndex(), ...extra });
const breakable = (cave) => decorTargets([region], grid, createDecorIndex(), (v) => decorDrawn(v, { ...cave, grid })).map((v) => v.decor.key).sort();

test("the GM's and a low-quality player's breakable sets are the same", () => {
  const gm = layout(gmScreen), player = layout(lowPlayer);
  assert.deepEqual(player, gm);
  assert.equal(gm.crystals, true);
  assert.ok(gm.webs.length >= 2, "some webs are laid out to tell");
  const keys = breakable(gm);
  assert.deepEqual(breakable(player), keys);
  assert.ok(keys.some((k) => k.startsWith("crystals:")), "the crystal breaks on both");
  assert.ok(keys.some((k) => k.startsWith("cobweb:")), "a webbed cobweb breaks on both");
  assert.ok(keys.length < brushed.length, "an unwebbed cobweb breaks on neither");
});

test("only the world's switches turn underground crystals and webs off for everyone", () => {
  assert.deepEqual(layout({ ...gmScreen, caveWebs: false }).webs, []);
  assert.equal(layout({ ...gmScreen, caveCrystals: false }).crystals, false);
  assert.equal(layout({ ...lowPlayer, caveCrystals: undefined }).crystals, true, "a setting not yet registered counts as on");
});

test("the layout is the web engine's own, over every cobweb's area with the shared light floor", () => {
  const ring = (x, y, r) => Array.from({ length: 12 }, (_, i) => [x + Math.cos(i / 12 * 6.283) * r, y + Math.sin(i / 12 * 6.283) * r]).flat();
  const areas = brushed.filter((d) => d.kind === "cobweb").map((d) => ring(d.x, d.y, d.size * grid * 1.2));
  assert.deepEqual(layout(gmScreen).webs, webCorners({ walls, areas, grid, seed: "scene", floor: lightFloor(lights) }));
  // A webs region's own areas join the same stream.
  const extra = [[2700, 300, 3000, 300, 3000, 600, 2700, 600]];
  assert.deepEqual(layout(gmScreen, { webAreas: extra }).webs, webCorners({ walls, areas: [...extra, ...areas], grid, seed: "scene", floor: lightFloor(lights) }));
  // Broken or not, every cobweb's area is laid out: the layout never changes as webs break.
  const broke = { ...region, broken: [{ key: "x" }] };
  assert.deepEqual(decorCaveBreakable({ setting: read(gmScreen), decorRegions: [broke], walls, lights, grid, seed: "scene", index: createDecorIndex() }), layout(gmScreen));
  // An above-ground region hands the webs nothing.
  const surface = { ...region, id: "R2", settings: { ...region.settings, where: "surface" } };
  assert.deepEqual(decorCaveBreakable({ setting: read(gmScreen), decorRegions: [surface], walls, lights, grid, seed: "scene", index: createDecorIndex() }).webs, []);
});

test("the light floor: no lights is floor everywhere; otherwise inside a light's shape", () => {
  assert.equal(lightFloor([])({ x: 5000, y: 5000 }), true);
  assert.equal(lightFloor([null])({ x: 5000, y: 5000 }), false, "a light with no shape lights no floor");
  const f = lightFloor(lights);
  assert.equal(f({ x: 100, y: 100 }), true);
  assert.equal(f({ x: 2500, y: 100 }), false);
});

test("a scene lit only by a carried torch: each screen draws main's webs; the breakable set is shared; a wreck shows only where its web is drawn", async () => {
  const { decorWreckChanges } = await import("../../../scripts/engines/props/decor-break.mjs");
  const ring = (x, y, r) => Array.from({ length: 12 }, (_, i) => [x + Math.cos(i / 12 * 6.283) * r, y + Math.sin(i / 12 * 6.283) * r]).flat();
  const areas = brushed.filter((d) => d.kind === "cobweb").map((d) => ring(d.x, d.y, d.size * grid * 1.2));
  // The screen's own floor, as main has it: wherever any light it sees reaches, a creature's torch included (here only
  // the first two corners). No AmbientLight at all: the shared floor is everywhere.
  const torch = [[200, 200, 1100, 200, 1100, 800, 200, 800]];
  const screenWebs = webCorners({ walls, areas, grid, seed: "scene", floor: (pt) => torch.some((s) => lightFloor([s])(pt)) });
  const shared = decorCaveBreakable({ setting: read(gmScreen), decorRegions: [region], walls, lights: [], grid, seed: "scene", index: createDecorIndex() });
  assert.deepEqual(shared, decorCaveBreakable({ setting: read(lowPlayer), decorRegions: [region], walls, lights: [], grid, seed: "scene", index: createDecorIndex() }), "GM and low-quality player agree");
  assert.ok(shared.webs.length > screenWebs.length, "the shared layout reaches past the torch");
  const views = createDecorIndex()(region, grid).views.filter((v) => v.decor.kind === "cobweb");
  const far = views.find((v) => decorDrawn(v, { webs: shared.webs, grid }) && !decorDrawn(v, { webs: screenWebs, grid }));
  assert.ok(far, "a cobweb that can break but this screen draws no web for");
  // Its stored break: this screen does not want its wreck (nothing was drawn there), and one already drawn goes.
  const wantedHere = [far].filter((v) => decorDrawn(v, { webs: screenWebs, grid })).map((v) => ({ id: v.id, note: { seed: 1 }, view: v }));
  const out = decorWreckChanges({ shown: new Map([[far.id, 1]]), wanted: wantedHere, pending: new Map(), late: new Map() });
  assert.deepEqual([out.show, out.hide], [[], [far.id]]);
});
