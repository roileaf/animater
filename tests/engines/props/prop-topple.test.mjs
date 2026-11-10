import test from "node:test";
import assert from "node:assert/strict";
import { propGuesses, propTraits, breakStyle } from "../../../scripts/engines/props/prop-traits.mjs";
import { guessMaterial } from "../../../scripts/engines/props/prop-material.mjs";
import { toppleStrip, stripPolygon, rubbleRegionData, tokensUnderStrip, toppleWhisper, toppleLayout, TOPPLE_MS } from "../../../scripts/engines/props/prop-topple.mjs";
import { propSound, BREAK_SOUNDS, TOPPLE_SOUNDS } from "../../../scripts/engines/props/prop-sounds.mjs";
import { flatMark } from "../../../scripts/engines/props/prop-wreck-layout.mjs";
import { validBreakRequest, breakNoteFor, undoUpdates, repairUpdates } from "../../../scripts/engines/props/prop-requests.mjs";
import { readNote } from "../../../scripts/engines/props/prop-break.mjs";
import { propSceneFieldsHTML, propTileFieldsHTML } from "../../../scripts/ui/prop-config.mjs";

const rect = { x: 200, y: 200, width: 100, height: 200 };
const strip = () => toppleStrip(rect, 0);

test("tall stone props topple from force or a big slam", () => {
  for (const s of ["Statue_Stone_Knight.webp", "Pillar_Stone.webp", "Column_Broken.webp", "Obelisk.webp"]) assert.equal(propGuesses(s).style, "topple", s);
  assert.equal(guessMaterial("Obelisk.webp"), "stone");
  assert.equal(breakStyle({ style: "topple" }, { damageType: "force" }), "topple");
  assert.equal(breakStyle({ style: "topple" }, { slam: { size: 2 } }), "topple");
  assert.equal(breakStyle({ style: "topple" }, { damageType: "fire" }), "shatter");
  // a statue the GM made wood does not topple on its own
  const wooden = { texture: { src: "Statue_Knight.webp" }, width: 100, height: 200, flags: { animater: { prop: { material: "wood" } } } };
  assert.equal(propTraits(wooden, 100).style, "shatter");
  assert.equal(propTraits({ ...wooden, flags: { animater: { prop: { material: "wood", style: "topple" } } } }, 100).style, "topple");
  assert.equal(propTraits({ ...wooden, flags: {} }, 100).style, "topple");
  assert.equal(propGuesses("Rock.webp").style, "shatter");
});
test("the strip runs from the centre along the hit, as long as the longer side", () => {
  const s = strip();
  assert.deepEqual(s, { from: { x: 250, y: 300 }, angle: 0, length: 200, width: 100 });
  assert.deepEqual(stripPolygon(s), [250, 250, 450, 250, 450, 350, 250, 350]);
  const down = stripPolygon(toppleStrip(rect, Math.PI / 2));
  assert.deepEqual(down.map(Math.round), [300, 300, 300, 500, 200, 500, 200, 300]);
});
test("the rubble region doubles walking cost, on the statue's level", () => {
  const d = rubbleRegionData({ strip: strip(), tileId: "t1", levels: ["l1"], bottom: 0, top: 10 });
  assert.deepEqual(d.behaviors, [{ type: "modifyMovementCost", name: "Rubble", system: { difficulties: { walk: 2 } } }]);
  assert.deepEqual([d.shapes[0].type, d.levels, d.flags.animater.propRubble], ["polygon", ["l1"], "t1"]);
  assert.deepEqual([d.name, d.color, d.elevation], ["Rubble", "#7a6a55", { bottom: 0, top: 10 }]);
  assert.deepEqual(d.shapes[0].points, [250, 250, 450, 250, 450, 350, 250, 350]);
});
test("rubble: the tile's choice beats the scene's", () => {
  const t = (rubble) => ({ texture: { src: "Statue_Stone.webp" }, width: 100, height: 200, flags: { animater: { prop: { rubble } } } });
  const on = { flags: { animater: { rubbleDifficult: true } } }, off = { flags: {} };
  assert.equal(propTraits(t(""), 100, on).rubble, true);
  assert.equal(propTraits(t(""), 100, off).rubble, false);
  assert.equal(propTraits(t("yes"), 100, off).rubble, true);
  assert.equal(propTraits(t("no"), 100, on).rubble, false);
});
test("whisper names who is under it; nobody, no whisper", () => {
  const s = strip();
  const tk = (name, x, y, level) => ({ name, x, y, w: 100, h: 100, level });
  assert.deepEqual(tokensUnderStrip([tk("Kyra", 350, 250), tk("Far", 900, 900)], s), ["Kyra"]);
  // a token that only touches the strip's edge is not under it; one that overlaps a corner is
  assert.deepEqual(tokensUnderStrip([tk("Edge", 450, 250), tk("Corner", 400, 320)], s), ["Corner"]);
  // another level is not under it
  assert.deepEqual(tokensUnderStrip([tk("Up", 350, 250, "l2"), tk("Here", 350, 250, "l1")], s, ["l1"]), ["Here"]);
  assert.equal(toppleWhisper("Statue", []), "");
  const html = toppleWhisper("Statue <b>", ["Kyra", "A&B"]);
  assert.match(html, /Statue &lt;b&gt;/);
  assert.match(html, /Kyra, A&amp;B/);
});

// --- GM validation, notes, undo and Repair ---
const scene = (flags = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...flags } } });
const statue = (extra = {}) => ({ id: "st", x: 200, y: 200, width: 100, height: 200, rotation: 0, hidden: false, texture: { src: "props/Statue_Stone.webp" }, flags: {}, ...extra });
const barrel = () => statue({ texture: { src: "props/Barrel_Wood.webp" }, width: 100, height: 100 });
const force = { kind: "area", damageType: "force", at: { x: 250, y: 150 } };
const sender = { id: "player", viewedScene: "s" };
const ask = (tile, sc, cause = force) => {
  const note = breakNoteFor({ tile, walls: [], grid: 100, cause, seed: 7, from: cause.at, scene: sc });
  return { note, check: validBreakRequest({ cause, note }, { tile, walls: [], scene: sc, grid: 100, sender }) };
};

test("a toppled statue writes a topple note and, with rubble on, a strip along the hit", () => {
  const sc = scene({ rubbleDifficult: true }), { note, check } = ask(statue(), sc);
  assert.equal(note.style, "topple");
  assert.equal(check.ok, true);
  assert.equal(check.note.style, "topple");
  assert.equal(check.rubble.length, 200);
  assert.equal(check.rubble.width, 100);
  assert.deepEqual(check.rubble.from, { x: 250, y: 300 });
  // the hit came from above (y 150): the statue falls away from it, down the page
  assert.ok(Math.abs(check.rubble.angle - Math.PI / 2) < 1e-9);
});
test("no rubble when the setting is off, the tile says no, or it does not topple", () => {
  assert.equal(ask(statue(), scene()).check.rubble, null);
  assert.equal(ask(statue({ flags: { animater: { prop: { rubble: "no" } } } }), scene({ rubbleDifficult: true })).check.rubble, null);
  assert.equal(ask(statue({ flags: { animater: { prop: { rubble: "yes" } } } }), scene()).check.rubble.length, 200);
  assert.equal(ask(barrel(), scene({ rubbleDifficult: true })).check.rubble, null);
  // a statue hit by fire does not topple (stone only breaks from force)
  const fire = { kind: "area", damageType: "fire", at: { x: 250, y: 150 } };
  assert.equal(ask(statue(), scene({ rubbleDifficult: true }), fire).check.ok, false);
});
test("a requester cannot claim topple for a prop that does not topple", () => {
  const sc = scene({ rubbleDifficult: true }), tile = barrel();
  const cause = { kind: "area", damageType: "fire", at: { x: 250, y: 150 } };
  const note = { ...breakNoteFor({ tile, walls: [], grid: 100, cause, seed: 7, from: cause.at, scene: sc }), style: "topple" };
  const r = validBreakRequest({ cause, note }, { tile, walls: [], scene: sc, grid: 100, sender });
  assert.equal(r.ok, true);
  assert.equal(r.note.style, "shatter");
  assert.equal(r.rubble, null);
});
test("a note keeps its region id (at most 32 characters)", () => {
  const { note } = ask(statue(), scene());
  assert.equal(readNote({ ...note, region: "abc123" }).region, "abc123");
  assert.equal("region" in readNote(note), false);
  assert.equal("region" in readNote({ ...note, region: "x".repeat(33) }), false);
  assert.equal("region" in readNote({ ...note, region: 5 }), false);
});

const brokenStatue = (id, region) => {
  const { note } = ask(statue({ id }), scene());
  return statue({ id, hidden: true, flags: { animater: { prop: { broken: region ? { ...note, region } : note } } } });
};
const rubble = (id, tileId) => ({ id, flags: { animater: { propRubble: tileId } } });
test("undo deletes its rubble; Repair deletes every rubble region", () => {
  const a = brokenStatue("A", "r1"), b = brokenStatue("B", "r2"), plain = brokenStatue("C");
  const regions = [rubble("r1", "A"), rubble("r2", "B"), rubble("orphan", "gone"), { id: "gm", flags: {} }];
  assert.deepEqual(undoUpdates(a, [], { regions }).deleteRegions, ["r1"]);
  assert.deepEqual(undoUpdates(plain, [], { regions }).deleteRegions, []);
  // no regions given: nothing can be shown to be its own
  assert.deepEqual(undoUpdates(a, []).deleteRegions, []);
  // a copy of statue A carries A's note (and its region id) but is not A: the region belongs to A
  const copy = { ...a, id: "A-copy" };
  assert.deepEqual(undoUpdates(copy, [], { regions }).deleteRegions, []);
  // a note naming a region the GM made themself (no propRubble flag) is never deleted
  assert.deepEqual(undoUpdates(brokenStatue("D", "gm"), [], { regions }).deleteRegions, []);
  // mixed battle: a statue with rubble, one without, another with rubble, and a leftover from a deleted statue
  const r = repairUpdates([a, b, plain], [], { regions });
  assert.deepEqual(r.deleteRegions, ["r1", "r2", "orphan"]);
  assert.equal(r.tiles.length, 3);
  assert.deepEqual(repairUpdates([], [], { regions: [{ id: "gm", flags: {} }] }).deleteRegions, []);
  assert.deepEqual(repairUpdates([a], []).deleteRegions, []);
});

const lamp = (id, x, y, hidden) => ({ id, x, y, hidden, levels: [], flags: {} });
test("undo and Repair unhide only named lights still in the tile's own reach", () => {
  const note = ask(statue(), scene()).note, withLights = (id) => statue({ id, hidden: true, flags: { animater: { prop: { broken: { ...note, lights: ["near", "far"] } } } } });
  const lights = [lamp("near", 250, 250, true), lamp("far", 900, 900, true)];
  assert.deepEqual(undoUpdates(withLights("st"), [], { lights }).lights, [{ _id: "near", hidden: false }]);
  assert.deepEqual(repairUpdates([withLights("st")], [], { lights }).lights, [{ _id: "near", hidden: false }]);
  // a copied tile elsewhere names the same lights: from its own place it reaches neither
  const copy = { ...withLights("copy"), x: 1200, y: 1200 };
  assert.deepEqual(undoUpdates(copy, [], { lights }).lights, []);
  assert.deepEqual(repairUpdates([copy], [], { lights }).lights, []);
});
test("a toppled statue always has a fall strip for the whisper, rubble or not", () => {
  const off = ask(statue(), scene()).check, on = ask(statue(), scene({ rubbleDifficult: true })).check;
  assert.equal(off.rubble, null);
  assert.deepEqual(off.fall, on.rubble);
  assert.equal(ask(barrel(), scene()).check.fall, null);
});

test("scene and tile Rubble fields", () => {
  assert.doesNotMatch(propSceneFieldsHTML({}), /rubbleDifficult"[^>]*checked/);
  assert.match(propSceneFieldsHTML({ rubble: true }), /rubbleDifficult"[^>]*checked/);
  assert.match(propSceneFieldsHTML({}), /Rubble is difficult terrain/);
  const tile = propTileFieldsHTML({ src: "Statue_Stone.webp" });
  assert.match(tile, /name="flags\.animater\.prop\.rubble"/);
  assert.match(tile, /<option value="" selected>Scene default<\/option>/);
  assert.match(tile, /data-show-for="topple"(?![^>]*hidden)/);
  assert.match(propTileFieldsHTML({ src: "Barrel.webp" }), /data-show-for="topple" hidden/);
  assert.match(propTileFieldsHTML({ src: "Barrel.webp", style: "topple" }), /data-show-for="topple"(?![^>]*hidden)/);
  assert.match(propTileFieldsHTML({ src: "Barrel.webp", rubble: "yes" }), /<option value="yes" selected>/);
  assert.match(tile, /<option value="topple">Topple<\/option>/);
  // Automatic follows the Material select: a wooden statue does not topple, a stone one does
  const wood = propTileFieldsHTML({ src: "Statue_Knight.webp", material: "wood" });
  assert.match(wood, /Automatic \(shatter\)/);
  assert.match(wood, /data-show-for="topple" hidden/);
  assert.match(propTileFieldsHTML({ src: "Statue_Knight.webp", material: "stone" }), /Automatic \(topple\)/);
  assert.match(tile, /data-guess-material="stone"/);
});

// --- the topple look (toppleLayout) ---
const note = { seed: 4242, cutAngle: 0.3, pattern: "crush", pieces: 2, spread: 0.2, spin: 40, tint: "none", mark: "dust", from: { x: 0, y: 0 }, walls: [], style: "topple", lights: [] };
const centroidOf = (poly) => { let x = 0, y = 0; for (let i = 0; i < poly.length; i += 2) { x += poly[i]; y += poly[i + 1]; } return { x: (x * 2) / poly.length, y: (y * 2) / poly.length }; };
// A point in the strip's own frame: along the fall from its start, and across it.
const inStrip = (s, p) => { const dx = p.x - s.from.x, dy = p.y - s.from.y, c = Math.cos(s.angle), n = Math.sin(s.angle); return { along: dx * c + dy * n, across: -dx * n + dy * c }; };

test("5-8 big chunks lie along the strip; same note, same fall", () => {
  const n = { ...note, style: "topple", cutAngle: 0 };
  const L = toppleLayout(n, { width: 100, height: 200, grid: 100 });
  assert.ok(L.chunks.length >= 5 && L.chunks.length <= 8);
  assert.ok(L.chunks.every((c) => c.to.x >= 50 - 25 && c.to.x <= 250 + 25 && c.to.y >= 50 - 25 && c.to.y <= 150 + 25));
  assert.equal(L.fall.ms, 600);
  assert.deepEqual(toppleLayout(n, { width: 100, height: 200, grid: 100 }), L);
});
test("the fall lengthens from the plinth's edge to the strip's end, and the chunks are that figure cut across", () => {
  assert.equal(TOPPLE_MS, 600);
  const L = toppleLayout({ ...note, cutAngle: 0 }, { width: 240, height: 240, grid: 100 });
  assert.deepEqual(L.fall.from, { rot: 0 });
  // it starts as long as the figure seen from above and ends reaching the strip's end (the tile's longer side from its centre)
  assert.ok(L.fall.to.stretch > 1.2 && L.fall.to.stretch < 3, `stretch ${L.fall.to.stretch}`);
  assert.ok(Math.abs(L.fall.at.x + L.fall.length - (120 + 240)) < 1e-6);
  assert.ok(L.fall.at.x > 120 && L.fall.at.x < 240, "it breaks off at the plinth's edge");
  assert.ok(Math.abs(L.fall.length - L.fall.along * L.fall.to.stretch) < 1e-6);
  assert.ok(L.fall.width > 0 && L.fall.width <= 240 * 0.85);
  // the outline is a lying figure: closed, along the fall from 0 to its length, narrower at the feet than the shoulders
  const o = L.fall.outline, xs = o.filter((_, i) => i % 2 === 0), w = (u) => { const i = Math.round(u * 40) * 2; return Math.abs(o[i + 1] - o[o.length - 1 - i]); };
  assert.equal(Math.min(...xs), 0); assert.ok(Math.abs(Math.max(...xs) - L.fall.length) < 1e-6);
  assert.ok(w(0.02) < w(0.5), "the feet are narrower than the shoulders");
  // the chunks: cut across the figure in order from the plinth, the first with no fresh break at its start, the rest with one
  for (let i = 1; i < L.chunks.length; i++) assert.ok(L.chunks[i].home.x > L.chunks[i - 1].home.x);
  assert.equal(L.chunks[0].edge, undefined);
  assert.ok(L.chunks.slice(1).every((c) => Array.isArray(c.edge) && c.edge.length >= 4));
  // they jolt apart: the further from the plinth, the further they go on average; none spins much
  const push = L.chunks.map((c) => c.to.x - c.home.x);
  assert.ok(push.at(-1) > push[0]);
  assert.ok(L.chunks.every((c) => Math.abs(c.to.rot) <= 0.25 && c.delay === 0 && c.dur > 0 && c.dur <= 1));
  // each chunk's polygon is tile-local and holds its home
  for (const c of L.chunks) { const m = centroidOf(c.poly); assert.ok(Math.hypot(m.x - c.home.x, m.y - c.home.y) < 1e-6); }
});
test("the stump stays inside the plinth; dust, chips and a stone mark along the fall", () => {
  const L = toppleLayout({ ...note, cutAngle: 0 }, { width: 240, height: 240, grid: 100, box: [0.2, 0.2, 0.8, 0.8] });
  const xs = L.stump.poly.filter((_, i) => i % 2 === 0), ys = L.stump.poly.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...xs) > 48 && Math.max(...xs) < 192 && Math.min(...ys) > 48 && Math.max(...ys) < 192);
  assert.deepEqual(L.stump.ring, [48, 48, 192, 48, 192, 192, 48, 192]);
  assert.ok(L.stump.cracks.length === 5 && L.stump.cracks.every((c) => c.length === 4));
  // the figure breaks off at the plinth's (painted) edge, not the tile's
  assert.ok(L.fall.at.x > 120 && L.fall.at.x < 192);
  assert.equal(L.dust.length, 12);
  assert.ok(L.dust.every((p) => p.at >= 0 && p.at < 100 && p.life > 1000 && p.r1 > p.r0));
  assert.ok(L.chips.length === 100 && L.chips.filter((c) => c.small).length === 60);
  const mid = L.fall.at.x + L.fall.length * 0.55;
  assert.ok(Math.abs(L.mark.x - mid) < 1e-6 && L.mark.squash === 0.42 && L.mark.angle === 0);
});
test("a turned tile falls along the hit in its own frame; chunks stay on the rubble strip", () => {
  for (const [cutAngle, rotation] of [[Math.PI / 2, 0], [Math.PI, 0], [2.4, 30], [-0.7, -45]]) {
    const L = toppleLayout({ ...note, cutAngle }, { width: 100, height: 200, grid: 100, rotation });
    const a = cutAngle - (rotation * Math.PI) / 180, s = toppleStrip({ x: 0, y: 0, width: 100, height: 200 }, a);
    assert.ok(Math.abs(Math.atan2(Math.sin(L.fall.angle - a), Math.cos(L.fall.angle - a))) < 1e-9);
    assert.ok(L.chunks.length >= 5 && L.chunks.length <= 8);
    for (const c of L.chunks) {
      const p = inStrip(s, c.to);
      assert.ok(p.along >= -25 && p.along <= s.length + 25 && Math.abs(p.across) <= s.width / 2 + 25, JSON.stringify({ cutAngle, rotation, p }));
    }
  }
});
test("a topple sounds of stone, whatever the prop is made of", () => {
  assert.deepEqual(TOPPLE_SOUNDS, BREAK_SOUNDS.stone);
  for (const r of [0, 0.5, 0.99]) {
    const s = propSound("wood", "none", () => r, { style: "topple" });
    assert.ok(TOPPLE_SOUNDS.includes(s.file)); assert.equal(s.splash, undefined);
  }
  assert.ok(BREAK_SOUNDS.wood.includes(propSound("wood", "none", () => 0).file));
});
test("the stone mark: pale grey lobes, flattened and turned", () => {
  const m = flatMark("stone", { x: 10, y: 20, r: 50, squash: 0.42, angle: 0, lobes: 9 }, () => 0.5);
  assert.equal(m.kind, "stone");
  assert.deepEqual(m.blobs[0].steps.map((s) => s.color), [0x9a948a, 0xb3ada3]);
  assert.equal(m.blobs[0].steps[0].polys.length, 9);
  assert.equal(flatMark("dust", { x: 0, y: 0, r: 10 }, () => 0.5).blobs[0].steps[0].polys.length, 7);
});
