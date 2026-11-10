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
    urns: ["clay", "shatter", "round", "grain"], planter: ["wood", "shatter", "boxy", "none"],
    tombstone: ["stone", "topple", "round", "none"], sarcophagus: ["stone", "shatter", "boxy", "none"],
    brazier: ["metal", "shatter", "round", "none"], cage: ["wood", "shatter", "boxy", "none"],
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
    "brokenPillar", "boneRubble"]) assert.equal(view(k), null, k);
  // Every kind that is offered and listed breaks as a real decoration kind.
  for (const k of ["fence", "sacks", "tombstone", "sarcophagus", "coffin", "cage", "urns", "produce", "tent", "washtub", "trough", "planter", "bench", "bedroll", "brazier", "haystack"]) assert.ok(DECOR_KINDS[k], k);
  assert.equal(DECOR_NAMES.signpost, "A signpost"); assert.equal(DECOR_NAMES.tombstone, "A gravestone");
});

test("Roi's extra kinds (2026-11-10): street lamps, tables, market stalls, stake fences and straw beds", () => {
  const want = {
    lampPost: ["metal", "topple", "round", "none"], tableStools: ["wood", "collapse", "boxy", "none"], marketStall: ["wood", "collapse", "boxy", "none"],
    stakeFence: ["wood", "collapse", "round", "none"], strawBed: ["plant", "burn", "round", "none"],
  };
  for (const [kind, [material, style, shape, contents]] of Object.entries(want)) {
    const v = view(kind), t = traits(v);
    assert.ok(DECOR_KINDS[kind], kind + " is a placeable kind");
    assert.deepEqual([propMaterial(v, grid), t.style, propShape(v.texture.src), t.contents], [material, style, shape, contents], kind);
  }
  // A table collapses with its legs left standing; a stall and a stake fence fall flat.
  assert.equal(traits(view("tableStools")).legs, true); assert.equal(traits(view("marketStall")).legs, false); assert.equal(traits(view("stakeFence")).legs, false);
  for (const k of ["tableStools", "marketStall", "stakeFence"]) assert.deepEqual([breaks(view(k), hit("bludgeoning")), breaks(view(k), hit("fire")), breaks(view(k), { slam: { size: 1 } })], [true, true, true], k);
  assert.equal(breakStyle(traits(view("tableStools")), hit("bludgeoning")), "collapse");
  // A straw bed burns away; nothing else takes it.
  const bed = view("strawBed");
  assert.deepEqual([breaks(bed, hit("fire")), breaks(bed, hit("slashing")), breaks(bed, { slam: { size: 3 } })], [true, false, false]);
  assert.equal(breakStyle(traits(bed), hit("fire")), "burn");
  // A street lamp: iron on a post. Only force or a Large+ slam topples it; a club, acid or a small shove does not.
  const lamp = view("lampPost");
  assert.equal(traits(lamp).rule, "heavy"); assert.equal(traits(lamp).tips, false);
  assert.deepEqual([breaks(lamp, hit("force")), breaks(lamp, hit("bludgeoning")), breaks(lamp, hit("acid")), breaks(lamp, { slam: { size: 1 } }), breaks(lamp, { slam: { size: 2 } }), breaks(lamp, { blast: true })], [true, false, false, false, true, true]);
  assert.equal(breakStyle(traits(lamp), hit("force")), "topple"); assert.equal(breakStyle(traits(lamp), { slam: { size: 2 } }), "topple");
  assert.equal(DECOR_NAMES.lampPost, "A street lamp");
  assert.deepEqual(propsOnPath([{ x: 200, y: 500 }, { x: 800, y: 500 }], 1, [lamp], grid), [], "a Medium shove passes it by");
  // Broken pillars and bones in rubble never break.
  assert.equal(view("brokenPillar"), null); assert.equal(view("boneRubble"), null);
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
  assert.deepEqual([decorRuleBreaks("heavy", hit("force")), decorRuleBreaks("heavy", hit("bludgeoning")), decorRuleBreaks("heavy", { slam: { size: 1 } }), decorRuleBreaks("heavy", { slam: { size: 2 } }), decorRuleBreaks("heavy", { blast: true })], [true, false, false, true, true]);
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
  // Cages and planters are painted wood (ruling): wood's rules, and any shove breaks one.
  assert.deepEqual([breaks(cage, hit("bludgeoning")), breaks(cage, hit("slashing")), breaks(cage, hit("cold")), breaks(cage, { slam: { size: 1 } })], [true, true, false, true]);
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
  assert.deepEqual(propsOnPath(path, 2, [sacks, sarc], grid), []);
  assert.deepEqual(propsOnPath(path, 1, [sacks, sarc, cage], grid).map((v) => v.decor.kind), ["cage"]);
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

test("breaking one cave web never moves, adds or lengthens another: the corners are laid out with it, then its web left out", async () => {
  const { keptWebCorners } = await import("../../../scripts/engines/props/decor-break.mjs");
  const { webCorners } = await import("../../../scripts/engines/motion/webs.mjs");
  // Eight wall corners in a row, a cobweb's ring at each (every corner's middle lies in its own ring only).
  const walls = [], rings = [], ring = (x, y, r) => Array.from({ length: 12 }, (_, i) => [x + Math.cos(i / 12 * 6.283) * r, y + Math.sin(i / 12 * 6.283) * r]).flat();
  for (let i = 0; i < 8; i++) { const x = 300 + i * 400; walls.push({ c: [x, 300, x, 600], move: 20, door: 0 }, { c: [x, 300, x + 300, 300], move: 20, door: 0 }); rings.push(ring(x + 40, 340, 120)); }
  const lay = (areas) => webCorners({ walls, areas, grid: 100, seed: "scene" });
  const whole = lay(rings), mid = (c) => [c.x + (c.u[0] + c.v[0]) * 25, c.y + (c.u[1] + c.v[1]) * 25];
  assert.ok(whole.length >= 3, "enough webs drawn to tell");
  const inRing = (c, i) => Math.hypot(mid(c)[0] - (300 + i * 400 + 40), mid(c)[1] - 340) < 120;
  for (const [i] of whole.map((c) => [rings.findIndex((_, k) => inRing(c, k))])) {
    const kept = keptWebCorners(lay(rings), { keep: rings.filter((_, k) => k !== i), gone: [rings[i]], grid: 100 });
    assert.deepEqual(kept, whole.filter((c) => !inRing(c, i)), `breaking web ${i} leaves every other web as it was`);
  }
  // (Laying out without the broken one's area instead would shift the stream: the old way, shown here for contrast.)
  const first = rings.findIndex((_, k) => whole.some((c) => inRing(c, k)));
  const without = lay(rings.filter((_, k) => k !== first));
  assert.notDeepEqual(without, whole.filter((c) => !inRing(c, first)));
  // A web whose corner also lies in a standing cobweb's (or a webs region's) area stays.
  assert.deepEqual(keptWebCorners(whole, { keep: rings, gone: rings, grid: 100 }), whole);
  assert.deepEqual(keptWebCorners(whole, { keep: [], gone: [], grid: 100 }), whole);
});

test("the cavern feed hands a broken cave cobweb apart (websGone), and leaves a broken crystal out (each crystal is its own stream)", async () => {
  const { createDecorations } = await import("../../../scripts/engines/motion/decorations.mjs");
  const { decorKeyed } = await import("../../../scripts/engines/props/decor-break.mjs");
  class Container { constructor() { this.children = []; } addChild(c) { this.children.push(c); return c; } removeChild() {} destroy() {} }
  const layer = () => new Container(), deco = createDecorations({ PIXI: { Container }, shadows: layer, ground: layer, above: layer });
  const brushed = [{ kind: "cobweb", x: 200, y: 200, size: 1, turn: 0, seed: 1 }, { kind: "cobweb", x: 600, y: 600, size: 1, turn: 0, seed: 2 }, { kind: "crystals", x: 400, y: 400, size: 0.6, turn: 0, seed: 3 }, { kind: "crystals", x: 800, y: 300, size: 0.6, turn: 0, seed: 4 }];
  const region = { id: "R1", settings: decorSettings({ on: true, where: "cave", seed: 3, density: 0, kinds: {}, brushed }), areas: [[0, 0, 1000, 0, 1000, 1000, 0, 1000]], look: {} };
  const keys = decorKeyed(region, 100), web = keys.find((k) => k.d.kind === "cobweb" && k.d.x === 200).key, gem = keys.find((k) => k.d.kind === "crystals" && k.d.x === 400).key;
  deco.sync([region]);
  const before = deco.cavern();
  assert.deepEqual([before.webs.length, before.websGone.length, before.crystals.length], [2, 0, 2]);
  deco.sync([{ ...region, broken: [web, gem] }]);
  const after = deco.cavern();
  assert.deepEqual([after.webs.length, after.websGone.length, after.crystals.length], [1, 1, 1]);
  assert.deepEqual(after.websGone[0], before.webs[0], "the broken one's own ring, as it was laid out");
  assert.deepEqual(after.crystals[0], before.crystals[1], "the other crystal unchanged (one cavern entry each)");
});
