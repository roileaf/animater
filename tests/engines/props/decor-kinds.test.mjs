// The town and dungeon decorations (spec amendment, 2026-11-10): which break, as what, and the rules the prop rules lacked.
import test from "node:test";
import assert from "node:assert/strict";
import { DECOR_BREAKS, DECOR_NAMES, decorView, createDecorIndex, decorTargets, validDecorBreakRequest, decorDrawn, decorToppledPrune, decorRubbleId } from "../../../scripts/engines/props/decor-break.mjs";
import { decorRuleBreaks, decorRuleStyle } from "../../../scripts/engines/props/decor-rules.mjs";
import { decorSettings } from "../../../scripts/engines/motion/decor-regions.mjs";
import { DECOR_KINDS } from "../../../scripts/engines/motion/decor-paint.mjs";
import { canBreak, propMaterial, propShape } from "../../../scripts/engines/props/prop-material.mjs";
import { propTraits, breakStyle } from "../../../scripts/engines/props/prop-traits.mjs";
import { propsInArea, propsOnPath, tipsOver } from "../../../scripts/engines/props/prop-pick.mjs";
import { breakNoteFor } from "../../../scripts/engines/props/prop-requests.mjs";

const grid = 100, at = { id: "R1", levels: ["L1"] };
const view = (kind, x = {}) => decorView({ d: { kind, x: 500, y: 500, size: 1, turn: 0, seed: 1, flip: false, ...x }, key: kind }, at, grid);
const traits = (v) => propTraits(v, grid);
const breaks = (v, cause) => canBreak(propMaterial(v, grid), cause, { cuttable: traits(v).cuttable, rule: traits(v).rule });
const hit = (damageType) => ({ damageType });

test("the approved map: material, style, shape and contents of each new kind", () => {
  const want = {
    cart: ["wood", "shatter", "boxy", "none"], coffin: ["wood", "shatter", "boxy", "none"], kennel: ["wood", "shatter", "boxy", "none"], produce: ["wood", "shatter", "boxy", "goods"],
    washtub: ["wood", "shatter", "round", "water"], firewood: ["wood", "shatter", "round", "none"], trough: ["wood", "shatter", "boxy", "water"],
    fence: ["wood", "collapse", "round", "none"], bench: ["wood", "collapse", "round", "none"], signpost: ["wood", "topple", "round", "none"],
    urns: ["clay", "shatter", "round", "grain"], planter: ["clay", "shatter", "boxy", "none"],
    tombstone: ["stone", "topple", "round", "none"], sarcophagus: ["stone", "shatter", "boxy", "none"],
    brazier: ["metal", "shatter", "round", "none"], cage: ["metal", "shatter", "boxy", "none"],
    haystack: ["plant", "burn", "round", "none"], tent: ["plant", "burn", "round", "none"], bedroll: ["plant", "burn", "round", "none"], beehive: ["plant", "burn", "round", "none"], nest: ["plant", "burn", "round", "none"],
    sacks: ["plant", "burn", "round", "grain"], candles: ["wood", "shatter", "round", "none"],
  };
  for (const [kind, [material, style, shape, contents]] of Object.entries(want)) {
    const v = view(kind), t = traits(v);
    assert.deepEqual([propMaterial(v, grid), t.style, propShape(v.texture.src), t.contents], [material, style, shape, contents], kind);
    assert.ok(v.texture.src.startsWith(`decor/${kind}`), kind);
  }
  assert.equal(traits(view("bench")).legs, true); assert.equal(traits(view("fence")).legs, false);
  assert.equal(traits(view("brazier")).tips, true); assert.equal(traits(view("cage")).tips, false);
  // Never break: the ground, the already broken, the too big or too heavy, and kinds the map left out.
  for (const k of ["well", "cobbles", "burrow", "anthill", "carcass", "feathers", "tracks", "rails", "pickaxe", "chains", "treasure", "papers", "bloodstain", "anvil", "timbers", "pump", "rubbish",
    "brokenPillar", "boneRubble", "strawBed", "stakeFence", "tableStools", "marketStall", "lampPost"]) assert.equal(view(k), null, k);
  // Every kind that is offered and listed breaks as a real decoration kind.
  for (const k of ["fence", "sacks", "tombstone", "sarcophagus", "coffin", "cage", "urns", "produce", "tent", "washtub", "trough", "planter", "bench", "bedroll", "brazier", "haystack"]) assert.ok(DECOR_KINDS[k], k);
  assert.equal(DECOR_NAMES.signpost, "A signpost"); assert.equal(DECOR_NAMES.tombstone, "A gravestone");
});

test("the rules the props lacked: sacks tear, candles fall to anything, a sarcophagus only to force", () => {
  assert.equal(decorRuleBreaks(null, hit("fire")), null);
  for (const d of ["slashing", "piercing", "fire"]) assert.equal(decorRuleBreaks("torn", hit(d)), true, d);
  for (const d of ["bludgeoning", "cold", "force"]) assert.equal(decorRuleBreaks("torn", hit(d)), false, d);
  assert.equal(decorRuleBreaks("torn", { slam: { size: 3 } }), false);
  assert.equal(decorRuleBreaks("torn", { blast: true }), true);
  for (const d of ["bludgeoning", "cold", "sonic", "fire"]) assert.equal(decorRuleBreaks("any", hit(d)), true, d);
  assert.equal(decorRuleBreaks("any", hit("mental")), false);
  assert.equal(decorRuleBreaks("any", { slam: { size: 0 } }), true);
  assert.equal(decorRuleBreaks("noSlam", hit("force")), true);
  assert.equal(decorRuleBreaks("noSlam", hit("bludgeoning")), false);
  assert.equal(decorRuleBreaks("noSlam", { slam: { size: 4 } }), false);
  assert.equal(decorRuleStyle("torn", hit("piercing")), "split"); assert.equal(decorRuleStyle("torn", hit("fire")), "burn"); assert.equal(decorRuleStyle("any", hit("fire")), null);
  // A tile never carries a rule: plant and stone keep their own.
  const tile = { x: 0, y: 0, width: 100, height: 100, texture: { src: "Sack.webp" }, flags: { animater: { prop: { material: "plant" } } } };
  assert.equal(propTraits(tile, grid).rule, null);
  assert.equal(canBreak("plant", hit("piercing")), false);
  assert.equal(canBreak("stone", { slam: { size: 2 } }), true);
});

test("each style breaks the way the map says, through the prop rules", () => {
  const sacks = view("sacks"), candles = view("candles"), sarc = view("sarcophagus"), cage = view("cage"), brazier = view("brazier"), hay = view("haystack"), tomb = view("tombstone"), sign = view("signpost");
  assert.deepEqual(["slashing", "piercing", "fire", "bludgeoning"].map((d) => breaks(sacks, hit(d))), [true, true, true, false]);
  assert.equal(breaks(sacks, { slam: { size: 2 } }), false);
  assert.deepEqual(["slashing", "piercing", "fire"].map((d) => breakStyle(traits(sacks), hit(d))), ["split", "split", "burn"]);
  assert.equal(breaks(candles, hit("cold")) && breaks(candles, { slam: { size: 1 } }), true);
  assert.deepEqual([breaks(sarc, hit("force")), breaks(sarc, hit("bludgeoning")), breaks(sarc, { slam: { size: 3 } })], [true, false, false]);
  assert.deepEqual([breaks(cage, hit("bludgeoning")), breaks(cage, hit("slashing")), breaks(cage, { slam: { size: 1 } }), breaks(cage, { slam: { size: 2 } })], [true, false, false, true]);
  assert.equal(tipsOver(brazier, grid, { slam: { size: 1 } }), true);
  assert.equal(breakStyle(traits(brazier), { slam: { size: 1 } }), "tip");
  assert.deepEqual([breaks(hay, hit("fire")), breaks(hay, hit("slashing")), breaks(hay, { slam: { size: 3 } })], [true, false, false]);
  assert.equal(breakStyle(traits(tomb), hit("force")), "topple"); assert.equal(breaks(tomb, { slam: { size: 1 } }), false); assert.equal(breaks(tomb, { slam: { size: 2 } }), true);
  assert.equal(breakStyle(traits(sign), { slam: { size: 1 } }), "topple"); assert.equal(breakStyle(traits(sign), hit("slashing")), "shatter");
  // The shared pickers agree: a piercing area takes the sacks, a club's does not; a small shove takes the candles and tips the brazier.
  assert.deepEqual(propsInArea([sacks, sarc], () => true, grid, "piercing").map((v) => v.decor.kind), ["sacks"]);
  assert.deepEqual(propsInArea([sacks], () => true, grid, "bludgeoning"), []);
  const path = [{ x: 200, y: 500 }, { x: 800, y: 500 }];
  for (const v of [candles, brazier]) assert.ok(propsOnPath(path, 1, [v], grid).includes(v), v.decor.kind);
  assert.deepEqual(propsOnPath(path, 1, [sacks, sarc, cage], grid), []);
  assert.deepEqual(propsOnPath(path, 2, [sacks, sarc, cage], grid).map((v) => v.decor.kind), ["cage"]);
});

test("the GM agrees: a torn sack splits and spills grain; a club on sacks is refused; a requester's style is corrected", () => {
  const brushed = [{ kind: "sacks", x: 300, y: 300, size: 1.4, turn: 0, seed: 1, flip: false }, { kind: "sarcophagus", x: 700, y: 700, size: 1.7, turn: 0, seed: 2, flip: false }];
  const region = { id: "R1", levels: ["L1"], settings: decorSettings({ on: true, where: "cave", density: 0, seed: 3, kinds: {}, brushed, canBreak: true }), areas: [[0, 0, 1000, 0, 1000, 1000, 0, 1000]] };
  const index = createDecorIndex(), views = index(region, grid).views, of = (k) => views.find((v) => v.decor.kind === k);
  const scene = { id: "s", flags: { animater: { breakableProps: true } } }, gm = { id: "gm", isGM: true, viewedScene: "s" };
  const ask = (v, damageType, style) => { const cause = { kind: "area", damageType, at: { x: v.decor.d.x, y: v.decor.d.y } }; const note = breakNoteFor({ tile: v, walls: [], grid, cause, seed: 4, from: cause.at, scene }); return { key: v.decor.key, cause, note: style ? { ...note, style } : note }; };
  const ctx = { region, scene, grid, sender: gm, now: 1, index };
  const torn = validDecorBreakRequest(ask(of("sacks"), "piercing"), ctx);
  assert.equal(torn.ok, true); assert.equal(torn.entry.note.style, "split");
  assert.equal(breakNoteFor({ tile: of("sacks"), walls: [], grid, cause: { damageType: "slashing" }, seed: 1, scene }).style, "split");
  assert.equal(validDecorBreakRequest(ask(of("sacks"), "piercing", "shatter"), ctx).entry.note.style, "split");
  assert.deepEqual(validDecorBreakRequest(ask(of("sacks"), "bludgeoning"), ctx), { ok: false, why: "material" });
  assert.deepEqual(validDecorBreakRequest(ask(of("sarcophagus"), "bludgeoning"), ctx), { ok: false, why: "material" });
  assert.equal(validDecorBreakRequest(ask(of("sarcophagus"), "force"), ctx).entry.note.style, "shatter");
  assert.equal(decorTargets([region], grid, index).length, 2);
});

test("only what is drawn breaks: underground crystals need the cavern's crystals, cobwebs a web the web engine drew", () => {
  const cave = { id: "R1", levels: [], where: "cave" }, web = decorView({ d: { kind: "cobweb", x: 500, y: 500, size: 1, turn: 0, seed: 1 }, key: "w" }, cave, grid);
  const crystal = decorView({ d: { kind: "crystals", x: 500, y: 500, size: 0.6, turn: 0, seed: 1 }, key: "c" }, cave, grid);
  assert.equal(web.decor.where, "cave");
  // A corner at (420, 420) between walls running right and down: its web reaches out to (470, 470), inside the cobweb's ring.
  const corner = { x: 420, y: 420, u: [1, 0], v: [0, 1], L: 100 };
  assert.equal(decorDrawn(web, { webs: [corner], grid }), true);
  assert.equal(decorDrawn(web, { webs: [{ ...corner, x: 1400, y: 1400 }], grid }), false, "open floor: no web drawn there");
  assert.equal(decorDrawn(web, { webs: [], grid }), false);
  assert.equal(decorDrawn(web, { grid }), true, "not known (another scene): left to the rules");
  assert.equal(decorDrawn(crystal, { crystals: false, grid }), false);
  assert.equal(decorDrawn(crystal, { crystals: true, grid }), true);
  // Above ground (or not a cavern kind) everything is painted.
  assert.equal(decorDrawn(decorView({ d: { kind: "cobweb", x: 0, y: 0, size: 1, turn: 0, seed: 1 }, key: "s" }, { id: "R1", where: "surface" }, grid), { webs: [], grid }), true);
  assert.equal(decorDrawn(decorView({ d: { kind: "crate", x: 0, y: 0, size: 1, turn: 0, seed: 1 }, key: "k" }, cave, grid), { webs: [], crystals: false, grid }), true);
  // decorTargets leaves out the undrawn ones; the GM refuses them.
  const brushed = [{ kind: "cobweb", x: 500, y: 500, size: 1, turn: 0, seed: 1, flip: false }, { kind: "crate", x: 200, y: 200, size: 0.8, turn: 0, seed: 2, flip: false }];
  const region = { id: "R9", levels: [], settings: decorSettings({ on: true, where: "cave", density: 0, seed: 3, kinds: {}, brushed, canBreak: true }), areas: [[0, 0, 1000, 0, 1000, 1000, 0, 1000]] };
  const index = createDecorIndex(), drawn = (v) => decorDrawn(v, { webs: [], grid });
  assert.deepEqual(decorTargets([region], grid, index, drawn).map((v) => v.decor.kind), ["crate"]);
  assert.deepEqual(decorTargets([region], grid, index).map((v) => v.decor.kind).sort(), ["cobweb", "crate"]);
  const w = index(region, grid).views.find((v) => v.decor.kind === "cobweb"), scene = { id: "s", flags: { animater: { breakableProps: true } } };
  const cause = { kind: "area", damageType: "fire", at: { x: 500, y: 500 } }, note = breakNoteFor({ tile: w, walls: [], grid, cause, seed: 2, from: cause.at, scene });
  const ctx = { region, scene, grid, sender: { id: "gm", isGM: true, viewedScene: "s" }, now: 1, index };
  assert.deepEqual(validDecorBreakRequest({ key: w.decor.key, cause, note }, { ...ctx, drawn }), { ok: false, why: "undrawn" });
  assert.equal(validDecorBreakRequest({ key: w.decor.key, cause, note }, ctx).ok, true);
});

test("an edit that moves a toppled decoration takes its stale entry and its rubble away; other stale breaks stay (undo)", () => {
  const n = (region) => ({ seed: 1, cutAngle: 0, pattern: "diced", pieces: 3, spread: 0.4, spin: 70, tint: "none", mark: "dust", from: { x: 0, y: 0 }, walls: [], style: "topple", lights: [], ...(region ? { region } : {}) });
  const live = { key: "live", kind: "stalagmite", x: 0, y: 0, note: n("rubA") }, fell = { key: "old", kind: "stalagmite", x: 1, y: 1, note: n("rubB") };
  const crate = { key: "oldCrate", kind: "crate", x: 2, y: 2, note: { ...n(), style: "shatter" } }, foreign = { key: "old2", kind: "column", x: 3, y: 3, note: n("rubX") };
  const regions = [{ id: "rubA", flags: { animater: { propRubble: decorRubbleId("R1") } } }, { id: "rubB", flags: { animater: { propRubble: decorRubbleId("R1") } } }, { id: "rubX", flags: { animater: { propRubble: "tile1" } } }];
  const out = decorToppledPrune([live, fell, crate, foreign], new Set(["live"]), regions, "R1");
  assert.deepEqual(out.deleteRegions, ["rubB"]);
  assert.deepEqual(out.keep.map((e) => e.key), ["live", "oldCrate", "old2"]);
  assert.equal(decorToppledPrune([live, crate], new Set(["live"]), regions, "R1"), null, "nothing to take away: no write");
});
