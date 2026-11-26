import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { iceFreezeUpdates, iceRepairUpdates, iceThawIds, iceSettingsOf, MELTED, SPELL_ICE } from "../../../scripts/engines/regions/thin-ice.mjs";
import { areaOutline, clipToRing, flatArea, icePatchShapes, icePatchData } from "../../../scripts/engines/regions/ice-patch.mjs";
import { propSceneFieldsHTML } from "../../../scripts/ui/prop-config.mjs";

const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const FLAG = "flags.animater.thinIce";
const ice = (id, thinIce, extra = {}) => ({ id, flags: { animater: { iceThin: true, iceHolds: "med", thinIce, ...extra } } });
const body = (name) => { const at = main.indexOf(`function ${name}(`); return main.slice(at, main.indexOf("\n}", at)); };
const disc = (cx, cy, r) => (p) => Math.hypot(p.x - cx, p.y - cy) <= r;
const box = (x, y, w, h) => ({ x, y, w, h });

// Roi, 2026-11-25, of the elements meeting the world: "cold freezing pond". Asked whether cold should only mend ice
// that is already there or also freeze open water: "both".
test("cold mends the thin ice it covers: its holes and its cracks go, by name, and the rest is left", () => {
  const [u] = iceFreezeUpdates([{ ...ice("reg1", { cracks: { "1,1": 1, "9,9": 1 }, holes: { "1,2": 2, "1,3": MELTED, "8,8": 1 } }), squares: ["1,1", "1,2", "1,3", "1,4"] }]);
  assert.equal(u._id, "reg1");
  assert.equal(u[`${FLAG}.cracks.-=1,1`], null);
  assert.equal(u[`${FLAG}.holes.-=1,2`], null, "a hole a creature fell through freezes over");
  assert.equal(u[`${FLAG}.holes.-=1,3`], null, "and one fire melted");
  assert.deepEqual(Object.keys(u).sort(), ["_id", `${FLAG}.cracks.-=1,1`, `${FLAG}.holes.-=1,2`, `${FLAG}.holes.-=1,3`].sort(), "what it does not cover, and whole ice, is not touched");
});

test("cold over whole ice, over open water, or over nothing changes no region", () => {
  assert.deepEqual(iceFreezeUpdates([{ ...ice("reg1", {}), squares: ["1,1"] }]), []);
  assert.deepEqual(iceFreezeUpdates([{ ...ice("reg1", { holes: { "1,1": 1 } }), squares: [] }]), []);
  assert.deepEqual(iceFreezeUpdates([{ ...ice("reg1", { holes: { "1,1": 1 } }), squares: ["junk", "2,2"] }]), []);
  assert.deepEqual(iceFreezeUpdates([{ id: "p1", flags: { animater: { floor: "water" } }, squares: ["1,1"] }]), [], "a pond is never turned to ice itself: its ice is a sheet laid over it");
  assert.deepEqual(iceFreezeUpdates([{ flags: {}, squares: ["1,1"] }]), [], "a region with no id");
  assert.deepEqual(iceFreezeUpdates(), []);
});

// The whole pond freezing was built first and Roi was asked to choose: "Want partial".
test("a spell's edge is found from inside it: a ring of points on a burst's rim", () => {
  const ring = areaOutline({ bounds: box(100, 100, 400, 400), testPoint: disc(300, 300, 200) });
  assert.equal(ring.length, 48);
  for (const p of ring) assert.ok(Math.abs(Math.hypot(p.x - 300, p.y - 300) - 200) < 0.5, `on the rim: ${JSON.stringify(p)}`);
  // A cone's box holds more than the cone: its middle may be outside, and a place known to be inside starts it.
  const wedge = (p) => p.x >= 0 && p.y >= 0 && p.x + p.y <= 100;
  assert.deepEqual(areaOutline({ bounds: box(0, 0, 400, 400), testPoint: wedge }), [], "no inside found from the middle alone");
  const found = areaOutline({ bounds: box(0, 0, 400, 400), testPoint: wedge, seeds: [{ x: 20, y: 20 }] });
  assert.equal(found.length, 48);
  assert.ok(found.every((p) => p.x >= -0.5 && p.y >= -0.5 && p.x + p.y <= 100.5));
  assert.deepEqual(areaOutline({ bounds: null, testPoint: () => true }), []);
  assert.deepEqual(areaOutline({ bounds: box(0, 0, 0, 10), testPoint: () => true }), []);
  assert.deepEqual(areaOutline({ bounds: box(0, 0, 10, 10), testPoint: () => { throw new Error("no"); } }), [], "an area that cannot be asked has no edge");
});

test("a pond is cut down to the spell: only the water under it, with the bank's own line where it meets the land", () => {
  const pond = [0, 0, 600, 0, 600, 400, 0, 400];
  const square = [{ x: 300, y: -100 }, { x: 900, y: -100 }, { x: 900, y: 200 }, { x: 300, y: 200 }];
  const cut = clipToRing(pond, square);
  assert.equal(flatArea(cut), 300 * 200, "the right-hand top of the pond and no more");
  const xs = cut.filter((_, i) => i % 2 === 0), ys = cut.filter((_, i) => i % 2 === 1);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [300, 600, 0, 200], "never past the bank, never past the spell");
  assert.equal(flatArea(clipToRing(pond, [...square].reverse())), 300 * 200, "whichever way round the spell's ring runs");
  assert.deepEqual(clipToRing(pond, [{ x: 700, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 100 }, { x: 700, y: 100 }]), [], "a spell beside the pond freezes none of it");
  assert.equal(flatArea(clipToRing(pond, [{ x: -50, y: -50 }, { x: 700, y: -50 }, { x: 700, y: 500 }, { x: -50, y: 500 }])), 600 * 400, "a spell over all of it freezes all of it");
  assert.deepEqual(clipToRing([0, 0, 1, 1], square), []);
  assert.deepEqual(clipToRing(pond, []), []);
});

test("the sheet is the pond under the spell; an island in it stays a hole; a lick at the bank is no sheet", () => {
  const pond = Object.assign([0, 0, 600, 0, 600, 400, 0, 400], { holes: [[100, 100, 200, 100, 200, 200, 100, 200], [500, 300, 550, 300, 550, 350, 500, 350]] });
  const ring = areaOutline({ bounds: box(-100, -100, 500, 500), testPoint: disc(150, 150, 250) });
  const shapes = icePatchShapes({ areas: [pond], outline: ring, least: 5000 });
  assert.equal(shapes.length, 2, "the sheet, and the one island under the spell");
  assert.deepEqual(shapes.map((s) => [s.type, s.hole]), [["polygon", false], ["polygon", true]]);
  assert.equal(flatArea(shapes[1].points), 100 * 100);
  const [sheet] = shapes;
  for (let i = 0; i < sheet.points.length; i += 2) {
    const x = sheet.points[i], y = sheet.points[i + 1];
    assert.ok(x >= 0 && x <= 600 && y >= 0 && y <= 400, "inside the pond");
    assert.ok(Math.hypot(x - 150, y - 150) <= 251, "and inside the spell");
  }
  assert.ok(flatArea(sheet.points) > 100000 && flatArea(sheet.points) < 600 * 400);
  assert.deepEqual(icePatchShapes({ areas: [pond], outline: areaOutline({ bounds: box(-80, -80, 100, 100), testPoint: disc(-30, -30, 50) }), least: 5000 }), [], "too little water under it");
  assert.deepEqual(icePatchShapes({ areas: [pond], outline: [] }), []);
  assert.deepEqual(icePatchShapes(), []);
});

test("the sheet is a region of thin ice of its own, standing where its pond stands, marked as a spell's", () => {
  const pond = { id: "p1", name: "Mill pond", levels: ["lvl1"], elevation: { bottom: 0, top: 10 }, flags: { animater: { floor: "water", imageRegion: { source: "map" }, waterDepth: 3 } } };
  const shapes = [{ type: "polygon", points: [0, 0, 100, 0, 100, 100], hole: false }];
  const data = icePatchData({ pond, shapes });
  assert.equal(data.name, "Mill pond (frozen)");
  assert.deepEqual(data.shapes, shapes);
  assert.deepEqual(data.levels, ["lvl1"]);
  assert.deepEqual(data.elevation, { bottom: 0, top: 10 });
  assert.deepEqual(data.flags.animater, { floor: "water", iceThin: true, iceHolds: "med", texture: "on", [SPELL_ICE]: true, imageRegion: { source: "map" } }, "ice painted whatever the map shows; none of the pond's own water settings");
  assert.equal(iceSettingsOf(data).thin, true, "it is thin ice as any other: it holds, cracks, breaks, melts and mends");
  assert.equal(icePatchData({ pond: {}, shapes }).name, "(frozen)");
  assert.equal(icePatchData({ pond, shapes: [] }), null);
  assert.equal(icePatchData({ pond, shapes: [{ type: "polygon", points: [0, 0, 1, 0, 1, 1], hole: true }] }), null, "an island alone is no sheet");
});

test("Repair takes a spell's sheets away whole, and only mends the GM's own thin ice", () => {
  const sheet = { id: "s1", flags: { animater: { floor: "water", iceThin: true, [SPELL_ICE]: true, thinIce: { holes: { "1,1": 1 } } } } };
  const own = ice("reg1", { holes: { "1,1": 1 } });
  assert.deepEqual(iceThawIds([sheet, own, { id: "p1", flags: {} }, null]), ["s1"]);
  assert.deepEqual(iceThawIds(), []);
  assert.ok(!("flags.animater.iceThin" in iceRepairUpdates([own])[0]));
});

test("the scene's switch: Cold freezes water, off until ticked", () => {
  assert.match(propSceneFieldsHTML({}), /<label>Cold freezes water<\/label><div class="form-fields"><input type="checkbox" name="flags\.animater\.coldFreezes">/);
  assert.match(propSceneFieldsHTML({ coldFreezes: true }), /name="flags\.animater\.coldFreezes" checked>/);
  assert.match(main, /coldFreezes: flags\.coldFreezes === true/);
});

test("wired: a cold area asks the GM once, who checks it as it checks a melt, mends the ice and lays the sheets", () => {
  const t = body("breakAreaThings");
  assert.ok(t.includes('const freezing = types.includes("cold") && sceneCanFreeze(scene) && propAreas.claim(area.templateId, "freeze");'));
  assert.ok(t.includes('askClaimed({ ask: () => askIceFreeze(area, messageId), release: () => propAreas.release(area.templateId, "freeze"), wait: CLAIM_SETTLE_MS'));
  assert.ok(t.includes("return iceFreezeOf(scene, area).length === 0 && icePatchesOf(scene, area).length === 0;"));
  assert.ok(t.includes("return quenching || lighting || melting || freezing;"));
  assert.match(main, /const sceneCanFreeze = \(scene\) => sceneHasThinIce\(scene\) \|\| coldFreezesOn\(scene\);/);
  assert.match(main, /const coldFreezesOn = \(scene\) => scene\?\.flags\?\.\[ID\]\?\.coldFreezes === true;/);
  const sheets = body("icePatchesOf");
  assert.match(sheets, /if \(!coldFreezesOn\(scene\) \|\| !area\?\.bounds\) return \[\];/, "only where the scene says so");
  assert.match(sheets, /regionFloor\(\{ name: doc\.name, flag: floorFlagOf\(doc\) \}\) !== "water" \|\| waterKindOf\(stepFlags\(own\) \?\? \{\}\) !== "still"/, "still water, by the floor's own word");
  assert.match(sheets, /mids\.every\(\(p\) => sheets\.some\(\(within\) => within\(p\)\)\)/, "no second sheet where one already lies");
  assert.match(sheets, /icePatchShapes\(\{ areas, outline, least: grid \* grid \* 0\.5 \}\)/);
  const apply = body("applyIceFreeze");
  assert.match(apply, /if \(!game\.users\.activeGM\?\.isSelf \|\| !scene\) return false;/);
  assert.match(apply, /damageType: "cold"/, "the GM reads for itself that the spell deals cold");
  assert.match(apply, /areaRefusal\(/);
  const write = body("freezeIceWrite");
  assert.match(write, /if \(!game\.user\?\.isGM \|\| !scene\) return false;/);
  assert.match(write, /scene\.updateEmbeddedDocuments\("Region", updates\.map\(\(u\) => withDeletes\(u, propDel\(\)\)\), \{ animater: \{ thinIce: true \} \}\)/);
  assert.match(write, /scene\.createEmbeddedDocuments\("Region", sheets, \{ animater: \{ thinIce: true \} \}\)/);
  assert.match(main, /if \(data\?\.type === ICE_FREEZE_MESSAGE\) \{ void receiveIceFreeze\(data, senderId\)/);
  assert.match(body("repairAllProps"), /const thawed = iceThawIds\(sceneRegions\(scene\)\);\n\s+if \(thawed\.length\) await scene\.deleteEmbeddedDocuments\("Region", thawed, \{ animater: \{ thinIce: true \} \}\);/);
});

// Seen live: a creature standing on a spell's sheet was mirrored in the pond under it, its reflection lying on the ice.
test("a spell's sheet covers the water under it as a deck does: nothing standing on it is mirrored there", () => {
  assert.ok(main.includes("drawnRegions().filter((r) => r.flags?.[ID]?.overWater === true || r.flags?.[ID]?.[SPELL_ICE] === true).flatMap("));
});

// Roi, 2026-11-25, of a fire cone over a frozen pond, which showed melted pools square by square under a brown scorch:
// "where fire and ice interact it should just show the water no?"
test("fire takes its own shape out of a spell's sheet: a hole in it, where the pond shows again", async () => {
  const { icePatchMelt, ringHasNoDents } = await import("../../../scripts/engines/regions/ice-patch.mjs");
  const sheet = [{ type: "polygon", points: [0, 0, 600, 0, 600, 400, 0, 400], hole: false }];
  const fire = areaOutline({ bounds: box(200, 100, 200, 200), testPoint: disc(300, 200, 100) });
  const melted = icePatchMelt({ shapes: sheet, outline: fire, least: 2500 });
  assert.equal(melted.gone, false);
  assert.equal(melted.shapes.length, 2);
  assert.deepEqual(melted.shapes[0], sheet[0], "the sheet itself is as it was");
  assert.equal(melted.shapes[1].hole, true);
  assert.ok(Math.abs(flatArea(melted.shapes[1].points) - Math.PI * 100 * 100) < 400, "the hole is the fire's own round shape, not squares");
  // A fire over nearly all of it leaves nothing worth keeping.
  assert.equal(icePatchMelt({ shapes: sheet, outline: [{ x: -10, y: -10 }, { x: 700, y: -10 }, { x: 700, y: 390 }, { x: -10, y: 390 }], least: 2500 }).gone, true);
  assert.equal(icePatchMelt({ shapes: sheet, outline: areaOutline({ bounds: box(-40, -40, 60, 60), testPoint: disc(-10, -10, 30) }), least: 2500 }), null, "a lick at its edge melts nothing");
  assert.equal(icePatchMelt({ shapes: sheet, outline: [] }), null);
  assert.equal(icePatchMelt(), null);
  assert.equal(ringHasNoDents(fire), true);
  assert.equal(ringHasNoDents([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 5, y: 2 }, { x: 0, y: 10 }]), false);
  assert.equal(ringHasNoDents([{ x: 0, y: 0 }, { x: 1, y: 1 }]), false);
});

test("a scorch is left off the water under it: the mark's shape has the water taken out", async () => {
  const { markCuts } = await import("../../../scripts/engines/marks/mark-paint.mjs");
  const cone = { points: [0, 0, 400, 0, 400, 400, 0, 400] }, pond = [200, -100, 900, -100, 900, 200, 200, 200];
  const holes = markCuts(cone, [pond, [1000, 1000, 1100, 1000, 1100, 1100]]);
  assert.equal(holes.length, 1, "only the water that is under the mark");
  assert.equal(flatArea(holes[0]), 200 * 200, "and only as far as the mark's own edge");
  assert.deepEqual(markCuts(cone, []), []);
  assert.deepEqual(markCuts(cone, undefined), []);
  assert.deepEqual(markCuts({ points: [0, 0, 10, 0, 10, 10, 5, 2, 0, 10] }, [pond]), [], "a shape with a dent in it is drawn whole");
  assert.ok(main.includes('if (Array.isArray(shape) && ["scorch", "rime", "streaks"].includes(tag?.mark)) { try { shape.cuts = regionsHere().filter((r) => plainFloorOf(r) === "water" && r.flags?.[ID]?.[SPELL_ICE] !== true)'), "scorch and frost: neither lies on water or on the ice over it; a sheet lies on its pond, which is cut already");
  const melt = body("iceSheetMeltOf");
  assert.match(melt, /if \(doc\.flags\?\.\[ID\]\?\.\[SPELL_ICE\] !== true/);
  assert.match(melt, /if \(melted\.gone\) \{ out\.deletes\.push\(doc\.id\); continue; \}/);
  assert.match(body("iceMeltOf"), /if \(!iceSettingsOf\(doc\)\.thin \|\| doc\.flags\?\.\[ID\]\?\.\[SPELL_ICE\] === true\) continue;/, "a sheet is never melted square by square");
});

// Roi, shown the cut: a thin strip of scorch still lay across the pond along the cone's edge. A hole cut in the area's
// own shape shares an edge with it; so the water is cut from a box round the whole mark instead, where it touches no edge.
test("the water is cut from a box round the mark, whole, and only the water that reaches under it", async () => {
  const { markKeep } = await import("../../../scripts/engines/marks/mark-paint.mjs");
  const cone = { points: [0, 0, 400, 0, 400, 400, 0, 400] }, pond = [200, -100, 900, -100, 900, 200, 200, 200], far = [1000, 1000, 1100, 1000, 1100, 1100];
  const keep = markKeep([cone], [pond, far]);
  assert.deepEqual(keep.holes, [pond], "the pond as it is, not cut down to the mark");
  assert.ok(keep.rect.x < 0 && keep.rect.y < -100 && keep.rect.x + keep.rect.w > 900 && keep.rect.y + keep.rect.h > 400, "the box holds the mark and the pond with room to spare");
  assert.equal(markKeep([cone], [far]), null);
  assert.equal(markKeep([cone], undefined), null);
  const paint = readFileSync(new URL("../../../scripts/engines/marks/mark-paint.mjs", import.meta.url), "utf8");
  assert.ok(paint.includes("paint.mask = clip;") && paint.includes("root.mask = rest;"), "two masks: the area's on the blotches, the water's round them");
  assert.ok(!/clip\.beginHole/.test(paint), "never a hole in the area's own shape");
});

// Roi, the same day: "i also dont see steam when the fire touches the water".
test("fire landing on water steams: a puff over each stretch of water under its mark", async () => {
  const { markSteam } = await import("../../../scripts/engines/marks/mark-paint.mjs");
  const { createReactionHost } = await import("../../../scripts/engines/marks/reactions.mjs");
  const cone = { points: [0, 0, 400, 0, 400, 400, 0, 400] };
  const mask = Object.assign([cone], { cuts: [[200, -100, 900, -100, 900, 200, 200, 200], [0, 300, 100, 300, 100, 500, 0, 500], [1000, 1000, 1100, 1000, 1100, 1100]] });
  const spots = markSteam(mask);
  assert.equal(spots.length, 2, "the two waters under it, not the one far off");
  assert.deepEqual([spots[0].x, spots[0].y], [300, 100], "the middle of the water that is under the fire");
  assert.ok(spots[0].r > spots[1].r && Math.abs(spots[0].r - Math.sqrt(40000 / Math.PI)) < 0.01, "the widest first, as wide as the water it covers");
  assert.deepEqual(markSteam(Object.assign([cone], { cuts: [] })), []);
  assert.deepEqual(markSteam([cone]), [], "a mark on dry ground steams nothing");
  assert.deepEqual(markSteam(null), []);
  assert.equal(markSteam(mask, 1).length, 1);
  // Shown through the reactions' own host: their switch, their count.
  const shown = []; let on = true;
  const host = createReactionHost({ near: () => [], remove: () => {}, spawn: (r) => { shown.push(r); return { update: () => true, destroy: () => {} }; }, enabled: () => on, max: 2 });
  assert.equal(host.play({ kind: "steam", at: { x: 1, y: 2 }, radius: 50, seed: 1, durationMs: 1800 }), true);
  assert.equal(host.play({ kind: "steam", at: { x: 1, y: 2 }, radius: 50, seed: 2, durationMs: 1800 }), true);
  assert.equal(host.play({ kind: "steam", at: { x: 1, y: 2 }, radius: 50, seed: 3, durationMs: 1800 }), false, "no more than the reactions' own most");
  assert.equal(host.count(), 2);
  host.clear(); on = false;
  assert.equal(host.play({ kind: "steam", at: { x: 1, y: 2 }, radius: 50 }), false, "off with Element reactions");
  assert.equal(host.play(null), false);
  assert.ok(main.includes('const spots = markSteam(record.mask), until = Date.now() + areaPlayLeft(record.tag.regionId)'));
  assert.ok(main.includes('spots.forEach((s, n) => markReactions.play({ kind: "steam"'));
  // It goes on steaming while the fire's animation still plays.
  assert.ok(main.includes('if (spots.length && Date.now() + 1100 < until) setTimeout(() => propSafe("steam", () => puff(round + 1)), 1100);'));
});

test("Cold freezes water works on a scene with Breakable props off: only the ice answers there", () => {
  const src = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(src.includes("const areasActOn = (scene) => propsOn(scene) || coldFreezesOn(scene);"));
  const i = src.indexOf("function breakAreaThings("), body = src.slice(i, src.indexOf("\n}\n", i));
  assert.ok(body.includes("!areasActOn(scene)"), "the area is heard with either switch");
  assert.ok(body.includes("quenching = props && !!quench"), "nothing is put out without Breakable props");
  assert.ok(body.includes("const lighting = props && "), "nor set alight");
  assert.ok(body.indexOf("if (!props) return melting || freezing;") > body.indexOf("const freezing ="), "and nothing breaks: it stops after the ice");
  const play = src.slice(src.indexOf("function breakAreaOnPlay("), src.indexOf("function breakAreaProps("));
  assert.ok(play.includes("if (!area || !areasActOn(area.scene)) return;"), "the animation's impact reaches it");
});

test("a spell's sheet is seen to spread from where the spell came, and is whole at the end", async () => {
  const { iceGrowFar, iceGrowRadius, iceGrown } = await import("../../../scripts/engines/regions/ice-patch.mjs");
  const sheet = Object.assign([0, 0, 400, 0, 400, 200, 0, 200], { holes: [[300, 50, 350, 50, 350, 100, 300, 100]] }), from = { x: 0, y: 100 };
  const far = iceGrowFar([sheet], from);
  assert.ok(Math.abs(far - Math.hypot(400, 100)) < 1e-9);
  assert.equal(iceGrowFar([sheet], null), 0);
  assert.ok(iceGrowRadius(far, 0) > 0 && iceGrowRadius(far, 0) < far * 0.2, "a little ice at once");
  assert.ok(iceGrowRadius(far, 0.5) > far * 0.6, "quick at first");
  assert.equal(iceGrowRadius(far, 1), far);
  assert.equal(iceGrowRadius(far, 7), far);
  const early = iceGrown([sheet], from, 120), late = iceGrown([sheet], from, far * 1.01);
  assert.equal(early.length, 1);
  assert.ok(flatArea(early[0]) < flatArea(sheet) * 0.4 && flatArea(early[0]) > 0);
  for (let i = 0; i + 1 < early[0].length; i += 2) assert.ok(Math.hypot(early[0][i] - from.x, early[0][i + 1] - from.y) <= 121, "within its reach");
  assert.deepEqual(early[0].holes, [], "the island is not reached yet");
  assert.ok(Math.abs(flatArea(late[0]) - flatArea(sheet)) < 1, "whole at the end");
  assert.equal(late[0].holes.length, 1, "with its island");
  assert.equal(iceGrown([sheet], null, 50)[0], sheet, "nothing to grow from: as it is");
  assert.deepEqual(iceGrown([sheet], { x: 5000, y: 5000 }, 50), [], "not reached at all yet");
  // The sheet remembers where it came from and whose area laid it.
  const data = icePatchData({ pond: { name: "Pond" }, shapes: [{ type: "polygon", points: [0, 0, 10, 0, 10, 10], hole: false }], from: { x: 12.4, y: 7.6 }, area: "abc" });
  assert.deepEqual(data.flags.animater.iceFrom, [12, 8]);
  assert.equal(data.flags.animater.iceArea, "abc");
  assert.equal("iceFrom" in icePatchData({ pond: {}, shapes: [{ type: "polygon", points: [0, 0, 10, 0, 10, 10], hole: false }] }).flags.animater, false);
  const src = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.ok(src.includes("return growing ? iceGrown(cut, growing.from, iceGrowRadius(growing.far, (performance.now() - growing.t0) / growing.ms)) : cut;"));
  assert.ok(src.includes("const ms = Math.max(ICE_GROW_LEAST, areaPlayLeft(own.iceArea)), id = doc.id;"), "for as long as the spell is seen");
});
