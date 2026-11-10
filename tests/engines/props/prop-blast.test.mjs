import test from "node:test";
import assert from "node:assert/strict";
import { BURST_DEFAULT, explodes, blastDelay, blastTargets, tokensInBurst, blastWhisper, ignitableInArea } from "../../../scripts/engines/props/prop-blast.mjs";
import { propGuesses, propTraits } from "../../../scripts/engines/props/prop-traits.mjs";
import { canBreak } from "../../../scripts/engines/props/prop-material.mjs";
import { validBreakRequest, breakNoteFor } from "../../../scripts/engines/props/prop-requests.mjs";

const grid = 100;
const blastScene = (flags = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...flags } } });
// a 1-square tile whose centre is at (cx, cy)
const prop = (id, src, cx, cy, extra = {}) => ({ id, x: cx - 50, y: cy - 50, width: 100, height: 100, rotation: 0, hidden: false, texture: { src }, flags: {}, levels: [], ...extra });
const door = (id, c, extra = {}) => ({ id, c, door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: {}, ...extra });
const kegNote = (powder, burst = 2) => ({ ...breakNoteFor({ tile: prop("k", "Keg_Powder.webp", 500, 500), grid, cause: { damageType: "fire" }, seed: 3, from: { x: 400, y: 500 } }), powder, burst });
const exploded = (id, cx, cy, burst = 2, extra = {}) => prop(id, "Keg_Powder.webp", cx, cy, { hidden: true, flags: { animater: { prop: { broken: kegNote("exploded", burst) } } }, ...extra });

test("powder explodes from fire, electricity or another blast; an axe spills it", () => {
  assert.equal(explodes({ contents: "powder", damageType: "fire" }), true);
  assert.equal(explodes({ contents: "powder", damageType: "electricity" }), true);
  assert.equal(explodes({ contents: "powder", blast: true }), true);
  assert.equal(explodes({ contents: "powder", damageType: "slashing" }), false);
  assert.equal(explodes({ contents: "powder" }), false, "a shove spills it");
  assert.equal(explodes({ contents: "wine", damageType: "fire" }), false);
  assert.equal(explodes({ contents: "lampoil", blast: true }), false);
  assert.equal(propGuesses("Keg_Gunpowder.webp").contents, "powder");
  for (const src of ["Barrel_Powder.webp", "Crate_Explosives.webp", "Explosive_Barrel.webp"]) assert.equal(propGuesses(src).contents, "powder", src);
  assert.equal(propGuesses("Barrel_Wood.webp").contents, "none");
});

test("a blast breaks every material but Won't break", () => {
  for (const m of ["wood", "glass", "clay", "metal", "stone"]) assert.equal(canBreak(m, { blast: true }), true, m);
  assert.equal(canBreak("none", { blast: true }), false);
  assert.equal(canBreak("nonsense", { blast: true }), false);
});

test("burst: the tile's setting rounded and clamped to 1-4, else 2", () => {
  assert.equal(BURST_DEFAULT, 2);
  const keg = (burst) => prop("k", "Keg_Powder.webp", 500, 500, { flags: { animater: { prop: { burst } } } });
  assert.equal(propTraits(prop("k", "Keg_Powder.webp", 500, 500), grid).burst, 2);
  assert.equal(propTraits(keg(3), grid).burst, 3);
  assert.equal(propTraits(keg("4"), grid).burst, 4, "a form may save it as text");
  assert.equal(propTraits(keg(2.6), grid).burst, 3);
  assert.equal(propTraits(keg(9), grid).burst, 4);
  assert.equal(propTraits(keg(0), grid).burst, 1);
  assert.equal(propTraits(keg("lots"), grid).burst, 2);
  assert.equal(propTraits(keg(""), grid).burst, 2);
  assert.equal(propTraits(prop("k", "Keg_Powder.webp", 500, 500, { flags: { animater: { prop: { contents: "wine" } } } }), grid).contents, "wine");
  assert.equal(propTraits(prop("k", "Barrel.webp", 500, 500, { flags: { animater: { prop: { contents: "powder" } } } }), grid).contents, "powder");
});

test("blastDelay runs 120 ms at the keg to 250 ms at the edge", () => {
  assert.equal(blastDelay(0, 200), 120);
  assert.equal(blastDelay(200, 200), 250);
  assert.equal(blastDelay(100, 200), 185);
  assert.equal(blastDelay(500, 200), 250, "never past the edge");
});

test("burst targets: inside the circle, staggered 120-250 ms by distance, nearest first", () => {
  const tiles = [
    prop("keg", "Keg_Powder.webp", 500, 500),                    // the source
    prop("barrel", "Barrel_Wood.webp", 500, 700),                // 2 squares: on the edge, in
    prop("crate", "Crate_Wood.webp", 600, 500),                  // 1 square
    prop("urn", "Urn_Clay.webp", 200, 500),                      // 3 squares: out
    prop("brokenCrate", "Crate_Wood.webp", 400, 500, { hidden: true, flags: { animater: { prop: { broken: kegNote(undefined) } } } }), // broken: out
    prop("hiddenBarrel", "Barrel_Wood.webp", 500, 400, { hidden: true }), // hidden: out
    prop("rug", "Rug_Red.webp", 550, 550),                       // Won't break: out
  ];
  const walls = [
    door("door", [450, 350, 550, 350]),                          // midpoint (500, 350): 1.5 squares, in
    door("far", [450, 150, 550, 150]),                           // 3.5 squares: out
    door("plain", [450, 600, 550, 600], { door: 0 }),            // a plain wall: out
    door("broken", [600, 450, 600, 550], { door: 0, flags: { animater: { breakWall: { broken: { seed: 1 } } } } }), // already broken: out
  ];
  const out = blastTargets({ centre: { x: 500, y: 500 }, burst: 2, grid, tiles, walls, scene: blastScene(), levels: [], sourceId: "keg" });
  assert.deepEqual(out.map((t) => t.id), ["crate", "door", "barrel"]);
  assert.deepEqual(out.map((t) => t.type), ["tile", "wall", "tile"]);
  assert.deepEqual(out.map((t) => t.delay), [blastDelay(100, 200), blastDelay(150, 200), 250]);
  for (const t of out) assert.ok(t.delay >= 120 && t.delay <= 250, `${t.id} ${t.delay}`);
});

test("burst targets: windows, metal and stone too, Won't break and Never stay, and only on the keg's level", () => {
  const tiles = [
    prop("statue", "Statue_Stone.webp", 600, 500),
    prop("brazier", "Brazier_Iron.webp", 400, 500),
    prop("fixed", "Crate_Wood.webp", 500, 600, { flags: { animater: { prop: { material: "none" } } } }),
    prop("upstairs", "Crate_Wood.webp", 500, 400, { levels: ["up"] }),
    prop("everywhere", "Crate_Wood.webp", 550, 450, { levels: [] }),
  ];
  const walls = [
    door("window", [450, 650, 550, 650], { door: 0, flags: { animater: { breakWall: { window: true } } } }),
    door("pane", [650, 450, 650, 550], { door: 0, flags: { animater: { breakWall: { window: true, material: "none" } } } }),
    door("never", [350, 450, 350, 550], { flags: { animater: { breakWall: { door: "never" } } } }),
    door("iron", [450, 350, 550, 350], { flags: { animater: { breakWall: { material: "metal" } } } }),
    door("upDoor", [400, 300, 400, 400], { levels: ["up"] }),
  ];
  const ids = blastTargets({ centre: { x: 500, y: 500 }, burst: 2, grid, tiles, walls, scene: blastScene(), levels: ["ground"], sourceId: "keg" }).map((t) => t.id).sort();
  assert.deepEqual(ids, ["brazier", "everywhere", "iron", "statue", "window"]);
  // the scene's "Doors and windows break" off: props only
  const off = blastTargets({ centre: { x: 500, y: 500 }, burst: 2, grid, tiles, walls, scene: blastScene({ breakWalls: false }), levels: ["ground"], sourceId: "keg" });
  assert.deepEqual(off.map((t) => t.type).filter((k) => k === "wall"), []);
});

test("tokens inside the burst, by their centres, on its level", () => {
  const tokens = [
    { name: "Valeros", x: 550, y: 450, w: 100, h: 100, level: "ground" },  // centre 1 square away
    { name: "Ezren", x: 650, y: 450, w: 100, h: 100, level: "ground" },    // centre 2 squares away: in
    { name: "Merisiel", x: 750, y: 450, w: 100, h: 100, level: "ground" }, // 3 squares: out
    { name: "Kyra", x: 500, y: 500, w: 100, h: 100, level: "up" },         // another level
    { name: "Ogre", x: 300, y: 300, w: 200, h: 200, level: "ground" },     // Large, centre (400, 400): 1.41 squares
  ];
  assert.deepEqual(tokensInBurst(tokens, { x: 500, y: 500 }, 2, grid, ["ground"]), ["Valeros", "Ezren", "Ogre"]);
  assert.deepEqual(tokensInBurst(tokens, { x: 500, y: 500 }, 1, grid, ["ground"]), ["Valeros"]);
  assert.deepEqual(tokensInBurst([], { x: 0, y: 0 }, 2, grid, []), []);
});

test("the GM's whisper", () => {
  assert.equal(blastWhisper(2, []), "<p><b>Powder keg exploded — 2-square burst.</b></p>");
  assert.match(blastWhisper(3, ["Valeros", "<Ezren>"]), /Inside: Valeros, &lt;Ezren&gt;\./);
  assert.equal(blastWhisper(1, ["A", "B"]), "<p><b>Powder keg exploded — 1-square burst.</b></p><p>Inside: A, B.</p>");
});

test("spilled powder in a fire area: only broken tiles whose powder is spilled and whose centre is inside", () => {
  const spilled = (id, cx, cy) => prop(id, "Keg_Powder.webp", cx, cy, { hidden: true, flags: { animater: { prop: { broken: kegNote("spilled") } } } });
  const tiles = [spilled("in", 500, 500), spilled("outside", 900, 500), exploded("done", 520, 500), prop("whole", "Keg_Powder.webp", 480, 500)];
  const inside = (p) => Math.hypot(p.x - 500, p.y - 500) <= 150;
  assert.deepEqual(ignitableInArea(tiles, inside).map((t) => t.id), ["in"]);
  assert.deepEqual(ignitableInArea([], inside), []);
});

// Review Focus 2: blasts overlap or loop. A GM-side chain run purely: each break is checked by validBreakRequest
// against the tiles as written so far; a keg that explodes sets off its own burst.
const gm = { id: "gm", viewedScene: "s", isGM: true };
const blastCause = (sourceId) => ({ kind: "blast", sourceId });
const blastReq = (tile, sourceId) => ({ cause: blastCause(sourceId), note: breakNoteFor({ tile, grid, cause: { kind: "blast", sourceId, damageType: "fire" }, seed: 5, from: { x: 0, y: 0 } }) });

test("chains end: a prop already broken by one blast is refused by the next", () => {
  // kegs A and B are in each other's burst; A has gone off
  const A = exploded("A", 500, 500), B = prop("B", "Keg_Powder.webp", 600, 500);
  const first = validBreakRequest(blastReq(B, "A"), { tile: B, scene: blastScene(), grid, sender: gm, source: A });
  assert.equal(first.ok, true);
  assert.equal(first.explode, true, "B is set off");
  assert.equal(first.note.powder, "exploded");
  assert.equal(first.note.burst, 2);
  const brokenB = { ...B, hidden: true, flags: { animater: { prop: { broken: first.note } } } };
  // B's blast reaches A, already broken
  assert.deepEqual(validBreakRequest(blastReq(A, "B"), { tile: A, scene: blastScene(), grid, sender: gm, source: brokenB }), { ok: false, why: "broken" });
  // A's blast reaching B a second time (two overlapping bursts)
  assert.deepEqual(validBreakRequest(blastReq(brokenB, "A"), { tile: brokenB, scene: blastScene(), grid, sender: gm, source: A }), { ok: false, why: "broken" });
  // two blasts reach one crate: the second is refused
  const crate = prop("crate", "Crate_Wood.webp", 550, 600);
  const once = validBreakRequest(blastReq(crate, "A"), { tile: crate, scene: blastScene(), grid, sender: gm, source: A });
  assert.equal(once.ok, true);
  assert.equal(once.explode, false);
  const brokenCrate = { ...crate, hidden: true, flags: { animater: { prop: { broken: once.note } } } };
  assert.deepEqual(validBreakRequest(blastReq(brokenCrate, "B"), { tile: brokenCrate, scene: blastScene(), grid, sender: gm, source: brokenB }), { ok: false, why: "broken" });
});

test("chains end: three kegs in a row each go off once, everything in reach breaks once, and the run stops", () => {
  let tiles = [exploded("A", 500, 500), prop("B", "Keg_Powder.webp", 650, 500), prop("C", "Keg_Powder.webp", 800, 500),
    prop("crate", "Crate_Wood.webp", 575, 600), prop("far", "Crate_Wood.webp", 1500, 500)];
  const breaks = new Map(), refused = [], blasts = ["A"];
  const queue = [["A", tiles[0]]];
  let steps = 0;
  while (queue.length && steps++ < 100) {
    const [, source] = queue.shift();
    const c = { x: source.x + 50, y: source.y + 50 };
    for (const t of blastTargets({ centre: c, burst: source.flags.animater.prop.broken.burst, grid, tiles, walls: [], scene: blastScene(), levels: [], sourceId: source.id })) {
      const tile = tiles.find((x) => x.id === t.id);
      const r = validBreakRequest(blastReq(tile, source.id), { tile, scene: blastScene(), grid, sender: gm, source });
      if (!r.ok) { refused.push(r.why); continue; }
      breaks.set(t.id, (breaks.get(t.id) ?? 0) + 1);
      const written = { ...tile, hidden: true, flags: { animater: { prop: { broken: r.note } } } };
      tiles = tiles.map((x) => (x.id === t.id ? written : x));
      if (r.explode) { blasts.push(t.id); queue.push([t.id, written]); }
    }
  }
  assert.ok(steps < 100, "the chain ends");
  assert.deepEqual(blasts, ["A", "B", "C"]);
  assert.deepEqual([...breaks.keys()].sort(), ["B", "C", "crate"]);
  for (const [id, n] of breaks) assert.equal(n, 1, id);
  // blastTargets already leaves out what is broken, so nothing even had to be refused here
  assert.deepEqual(refused, []);
  // and the source itself is never a target
  assert.ok(!blastTargets({ centre: { x: 500, y: 500 }, burst: 2, grid, tiles, walls: [], scene: blastScene(), levels: [], sourceId: "A" }).length);
});

test("blast causes are the GM's only; the source must have exploded", () => {
  // Review Focus 5
  const A = exploded("A", 500, 500), crate = prop("crate", "Crate_Wood.webp", 600, 500);
  const ctx = (extra = {}) => ({ tile: crate, scene: blastScene(), grid, sender: gm, source: A, ...extra });
  assert.deepEqual(validBreakRequest(blastReq(crate, "A"), ctx({ sender: { id: "p", viewedScene: "s", isGM: false } })), { ok: false, why: "sender" });
  assert.deepEqual(validBreakRequest(blastReq(crate, "A"), ctx({ sender: { id: "p", viewedScene: "s" } })), { ok: false, why: "sender" });
  // a source whose powder only spilled, one never broken, or none at all
  const spilled = prop("A", "Keg_Powder.webp", 500, 500, { hidden: true, flags: { animater: { prop: { broken: kegNote("spilled") } } } });
  assert.deepEqual(validBreakRequest(blastReq(crate, "A"), ctx({ source: spilled })), { ok: false, why: "far" });
  assert.deepEqual(validBreakRequest(blastReq(crate, "A"), ctx({ source: prop("A", "Keg_Powder.webp", 500, 500) })), { ok: false, why: "far" });
  assert.deepEqual(validBreakRequest(blastReq(crate, "A"), ctx({ source: undefined })), { ok: false, why: "far" });
  // out of the burst
  const away = prop("crate", "Crate_Wood.webp", 800, 500);
  assert.deepEqual(validBreakRequest(blastReq(away, "A"), ctx({ tile: away })), { ok: false, why: "far" });
  // a 3-square burst reaches it
  assert.equal(validBreakRequest(blastReq(away, "A"), ctx({ tile: away, source: exploded("A", 500, 500, 3) })).ok, true);
  // another level than the source
  const up = prop("crate", "Crate_Wood.webp", 600, 500, { levels: ["up"] });
  assert.deepEqual(validBreakRequest(blastReq(up, "A"), ctx({ tile: up, levels: ["ground"] })), { ok: false, why: "far" });
  assert.deepEqual(validBreakRequest(blastReq(up, "A"), ctx({ tile: up, source: exploded("A", 500, 500, 2, { levels: ["ground"] }) })), { ok: false, why: "far" });
  // good: the GM's blast breaks metal too, even while the GM views another scene
  const r = validBreakRequest(blastReq(crate, "A"), ctx());
  assert.equal(r.ok, true);
  assert.equal(r.explode, false);
  assert.equal(r.note.powder, undefined);
  const statue = prop("statue", "Statue_Stone.webp", 500, 600);
  assert.equal(validBreakRequest(blastReq(statue, "A"), ctx({ tile: statue })).ok, true);
  assert.equal(validBreakRequest(blastReq(crate, "A"), ctx({ sender: { ...gm, viewedScene: "other" } })).ok, true);
  // Won't break still won't
  const fixed = prop("fixed", "Crate_Wood.webp", 600, 500, { flags: { animater: { prop: { material: "none" } } } });
  assert.deepEqual(validBreakRequest(blastReq(fixed, "A"), ctx({ tile: fixed })), { ok: false, why: "material" });
});

const spilledKeg = (extra = {}) => prop("keg", "Keg_Powder.webp", 500, 500, { hidden: true, flags: { animater: { prop: { broken: kegNote("spilled") } } }, ...extra });
const ignite = (damageType = "fire", at = { x: 450, y: 500 }) => ({ cause: { kind: "ignite", damageType, at } });
const player = { id: "p", viewedScene: "s", isGM: false };

test("spilled powder caught by a fire area explodes once", () => {
  const keg = spilledKeg();
  const r = validBreakRequest(ignite(), { tile: keg, scene: blastScene(), grid, sender: player });
  assert.deepEqual(r, { ok: true, note: { ...kegNote("spilled"), powder: "exploded" }, ignite: true, explode: true, wallUpdates: [], lightUpdates: [] });
  // cold does not set it off
  assert.deepEqual(validBreakRequest(ignite("cold"), { tile: keg, scene: blastScene(), grid, sender: player }), { ok: false, why: "material" });
  // the second time it has already gone off
  const gone = spilledKeg({ flags: { animater: { prop: { broken: r.note } } } });
  assert.deepEqual(validBreakRequest(ignite(), { tile: gone, scene: blastScene(), grid, sender: player }), { ok: false, why: "broken" });
  // an area far away, a broken crate (no powder), an unbroken keg
  assert.deepEqual(validBreakRequest(ignite("fire", { x: 500 + 31 * grid, y: 500 }), { tile: keg, scene: blastScene(), grid, sender: player }), { ok: false, why: "far" });
  assert.deepEqual(validBreakRequest(ignite("fire", null), { tile: keg, scene: blastScene(), grid, sender: player }), { ok: false, why: "far" });
  const crate = prop("crate", "Crate_Wood.webp", 500, 500, { hidden: true, flags: { animater: { prop: { broken: kegNote(undefined) } } } });
  assert.deepEqual(validBreakRequest(ignite(), { tile: crate, scene: blastScene(), grid, sender: player }), { ok: false, why: "broken" });
  assert.deepEqual(validBreakRequest(ignite(), { tile: prop("keg", "Keg_Powder.webp", 500, 500), scene: blastScene(), grid, sender: player }), { ok: false, why: "cause" });
  // still off unless on
  assert.deepEqual(validBreakRequest(ignite(), { tile: keg, scene: { id: "s", flags: {} }, grid, sender: player }), { ok: false, why: "off" });
});
