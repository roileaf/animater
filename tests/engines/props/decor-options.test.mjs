import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanDecorProp, decorOptionApplies, resolveDecorProp, decorPropDefaults, DECOR_CONTAINERS, DECOR_TIPPERS } from "../../../scripts/engines/props/decor-options.mjs";
import { DECOR_BREAKS, decorBreakOf, decorDefaultsOf, decorView, decorKeyed, decorFingerprint, createDecorIndex, validDecorBreakRequest, decorSourceView, decorLightOut } from "../../../scripts/engines/props/decor-break.mjs";
import { decorSettings, decorPlacements } from "../../../scripts/engines/motion/decor-regions.mjs";
import { decorShown, decorLightList } from "../../../scripts/engines/motion/decorations.mjs";
import { propTraits, breakStyle } from "../../../scripts/engines/props/prop-traits.mjs";
import { propMaterial, canBreak } from "../../../scripts/engines/props/prop-material.mjs";
import { breakNoteFor } from "../../../scripts/engines/props/prop-requests.mjs";
import { blastFrom, blastTargets } from "../../../scripts/engines/props/prop-blast.mjs";

const grid = 100, square = [0, 0, 1000, 0, 1000, 1000, 0, 1000];
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const at = (x = {}) => ({ id: "R1", levels: ["L1"], ...x });
const D = (kind, x = {}) => ({ kind, x: 500, y: 500, size: 1, turn: 0, seed: 1, flip: false, ...x });
const view = (kind, own, regionProp) => decorView({ d: D(kind, own ? { prop: own } : {}), key: "k" }, at({ prop: regionProp }), grid);

test("defaults by kind (Amendment 3): what each container holds, what carries a light, what tips over", () => {
  const contents = (kind) => propTraits(view(kind), grid).contents;
  assert.deepEqual(["barrel", "crate", "produce", "urns", "sacks", "trough", "washtub", "bookshelf", "coffin", "cage", "strongbox"].map(contents),
    ["water", "goods", "goods", "grain", "grain", "water", "water", "books", "none", "none", "none"]);
  assert.equal(propTraits(decorView({ d: D("bathtub", { seed: 3 }), key: "k" }, at(), grid), grid).contents, "water");
  assert.equal(propTraits(view("lampPost"), grid).light, true);
  assert.equal(propTraits(view("brazier"), grid).light, true);
  assert.equal(propTraits(view("crate"), grid).light, false);
  assert.equal(propTraits(view("brazier"), grid).tips, true);
  assert.equal(propTraits(view("lampPost"), grid).tips, false);
  assert.equal(propTraits(view("crate"), grid).burst, 2);
  // Never a name guess: the street lamp's name reads as a lamp's oil, and it holds none.
  assert.equal(propTraits(view("lampPost"), grid).contents, "none");
  assert.deepEqual(decorPropDefaults("crate", DECOR_BREAKS.crate), { material: "wood", style: "shatter", contents: "goods", burst: 2, light: false, tips: false });
});

test("precedence: the painted decoration's own choice, then the region's, then the kind's default", () => {
  assert.equal(propTraits(view("barrel", null, { contents: "wine" }), grid).contents, "wine", "the region's");
  assert.equal(propTraits(view("barrel", { contents: "powder" }, { contents: "wine" }), grid).contents, "powder", "its own beats the region's");
  assert.equal(propTraits(view("barrel", { contents: "" }, { contents: "wine" }), grid).contents, "wine", "its own Automatic takes the region's");
  assert.equal(propTraits(view("barrel", null, { contents: "" }), grid).contents, "water", "both Automatic: the kind's");
  assert.equal(propMaterial(view("crate", null, { material: "stone" }), grid), "stone");
  assert.equal(propMaterial(view("crate", { material: "metal" }, { material: "stone" }), grid), "metal");
  assert.equal(propTraits(view("crate", null, { style: "burn" }), grid).style, "burn");
  assert.equal(propTraits(view("lampPost", { light: "no" }), grid).light, false);
  assert.equal(propTraits(view("crate", null, { light: "yes" }), grid).light, true);
  assert.equal(propTraits(view("barrel", { contents: "powder", burst: 4 }, { burst: 1 }), grid).burst, 4);
  assert.equal(propTraits(view("barrel", { contents: "powder" }, { burst: 3 }), grid).burst, 3);
  // A region's choice reaches only the kinds it is offered for: no wine in a bush, no crate tips over.
  assert.equal(propTraits(view("bush", null, { contents: "wine" }), grid).contents, "none");
  assert.equal(propTraits(view("crate", null, { tips: "yes" }), grid).tips, false);
  assert.equal(propTraits(view("brazier", null, { tips: "no" }), grid).tips, false);
  assert.equal(decorOptionApplies("barrel", "contents"), true); assert.equal(decorOptionApplies("bush", "contents"), false);
  assert.equal(decorOptionApplies("brazier", "tips"), true); assert.equal(decorOptionApplies("crate", "tips"), false);
  assert.equal(decorOptionApplies("bush", "material"), true);
  assert.ok(DECOR_CONTAINERS.has("bookshelf") && DECOR_TIPPERS.has("lampPost"));
});

test("only valid choices are kept; Automatic is left out", () => {
  assert.deepEqual(cleanDecorProp({ material: "cheese", style: "tip", contents: "beer", burst: 9, light: "maybe", tips: "yes", evil: 1 }), { burst: 4, tips: "yes" });
  assert.deepEqual(cleanDecorProp({ material: "", contents: "", burst: "" }), {});
  assert.deepEqual(cleanDecorProp({ burst: "3" }), { burst: 3 });
  assert.deepEqual(cleanDecorProp(null), {});
  // The region's cleaned options travel with its settings.
  assert.deepEqual(decorSettings({ on: true, kinds: {}, prop: { contents: "wine", style: "nope" } }).prop, { contents: "wine" });
  assert.deepEqual(decorSettings({ on: true, kinds: {} }).prop, {});
});

test("tile rules for a changed material: a crate made Burn away burns from fire; stone needs force; plant only burns; the kind's rule goes with its material", () => {
  const burning = view("crate", null, { style: "burn" });
  assert.equal(breakStyle(propTraits(burning, grid), { damageType: "fire" }), "burn");
  assert.equal(breakStyle(propTraits(burning, grid), { damageType: "bludgeoning" }), "shatter");
  const stone = view("crate", { material: "stone" });
  assert.equal(canBreak(propMaterial(stone, grid), { damageType: "bludgeoning" }), false);
  assert.equal(canBreak(propMaterial(stone, grid), { damageType: "force" }), true);
  const plant = view("crate", { material: "plant" });
  assert.equal(canBreak(propMaterial(plant, grid), { damageType: "bludgeoning" }), false);
  assert.equal(propTraits(view("lampPost"), grid).rule, "heavy");
  assert.equal(propTraits(view("lampPost", { material: "wood" }), grid).rule, null, "a wooden street lamp breaks by wood's rules");
  assert.equal(resolveDecorProp("sacks", DECOR_BREAKS.sacks, {}, { material: "plant" }).rule, "torn", "the same material keeps the rule");
});

test("the painted kinds: a throne's default follows its picture; the panel's names come from the kind", () => {
  const d = D("throne"); const b = decorBreakOf(d);
  assert.equal(propMaterial(decorView({ d, key: "k" }, at(), grid), grid), b.material);
  assert.equal(decorDefaultsOf("throne").material, null, "painted: no single default to name");
  assert.equal(decorDefaultsOf("barrel").contents, "water");
  assert.equal(decorDefaultsOf("rock"), null);
});

// ---- the options never move anything ----
const raw = (x = {}) => ({ on: true, where: "surface", density: 1, scale: 1, seed: 7, kinds: { crate: {}, barrel: {}, bush: {} }, brushed: [], erased: [], ...x });
const region = (x = {}, extra = {}) => ({ id: "R1", levels: ["L1"], settings: decorSettings(raw(x)), areas: [square], ...extra });
const hand = { kind: "barrel", x: 300, y: 300, size: 0.8, turn: 0, seed: 5, flip: false };

test("options never move placements: the same placements, keys and fingerprint with or without them", () => {
  const plain = region({ brushed: [hand] }), dressed = region({ brushed: [{ ...hand, prop: { contents: "powder", burst: 3 } }], prop: { contents: "wine", material: "stone", light: "yes" } });
  const strip = (list) => list.map(({ prop: _p, ...d }) => d);
  assert.deepEqual(strip(decorPlacements({ ...dressed, grid })), strip(decorPlacements({ ...plain, grid })));
  assert.deepEqual(decorKeyed(dressed, grid).map((k) => k.key), decorKeyed(plain, grid).map((k) => k.key));
  assert.equal(decorFingerprint(dressed, grid), decorFingerprint(plain, grid));
  assert.deepEqual(strip(decorShown({ id: "R1", settings: dressed.settings, areas: [square], broken: ["x"] }, grid).shown), strip(decorShown({ id: "R1", settings: plain.settings, areas: [square], broken: ["x"] }, grid).shown));
  // The index follows a change of options (the views must), keeping the same keys.
  const index = createDecorIndex(), a = index(plain, grid), b = index(dressed, grid);
  assert.notEqual(a, b); assert.deepEqual([...b.keys], [...a.keys]);
  assert.equal(b.views.find((v) => v.decor.key === "barrel:300:300:h").flags.animater.prop.contents, "powder");
  // The painter's rebuild leaves the region's options out, as it does the switch.
  assert.match(read("scripts/engines/motion/decorations.mjs"), /const \{ canBreak: _switch, prop: _options, \.\.\.drawn \} = spec\.settings \?\? \{\};/);
});

// ---- the GM's own judgement ----
const scene = (flags = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...flags } } });
const gm = { id: "gm", isGM: true, viewedScene: "s" }, player = { id: "p", viewedScene: "s" };
const index = createDecorIndex();
const on = (x = {}, extra = {}) => region({ canBreak: true, ...x }, extra);
const viewOf = (r, key) => index(r, grid).views.find((v) => v.decor.key === key);
const hit = (v, damageType = "bludgeoning") => ({ kind: "area", damageType, at: { x: v.x + v.width / 2, y: v.y + v.height / 2 } });
const ask = (v, cause = hit(v), note = {}) => ({ key: v.decor.key, cause, note: { ...breakNoteFor({ tile: v, walls: [], grid, cause, seed: 42, from: cause.at, scene: scene() }), ...note } });
const ctx = (r, x = {}) => ({ region: r, scene: scene(), grid, sender: gm, now: 5000, index, ...x });

test("the GM derives every option from the region's stored settings and brushed entries, never from the request", () => {
  const r = on({ brushed: [hand], prop: { contents: "powder" } }), barrel = viewOf(r, "barrel:300:300:h");
  const out = validDecorBreakRequest(ask(barrel, hit(barrel, "fire")), ctx(r));
  assert.equal(out.ok, true); assert.equal(out.explode, true);
  assert.deepEqual([out.entry.note.powder, out.entry.note.burst], ["exploded", 2]);
  // A request that claims powder for a barrel of water gets none: the GM's view of the region says water.
  const water = on({ brushed: [hand] }), plain = viewOf(water, "barrel:300:300:h");
  const forged = validDecorBreakRequest(ask(plain, hit(plain, "fire"), { powder: "exploded", burst: 4, fire: true }), ctx(water));
  assert.equal(forged.ok, true); assert.equal(forged.explode, false);
  assert.equal(forged.entry.note.powder, undefined); assert.equal(forged.entry.note.fire, undefined);
  // The brushed entry's own choice is the GM's to read too.
  const own = on({ brushed: [{ ...hand, prop: { contents: "powder", burst: 3 } }], prop: { contents: "wine" } });
  assert.equal(validDecorBreakRequest(ask(viewOf(own, "barrel:300:300:h"), hit(plain, "fire")), ctx(own)).entry.note.burst, 3);
  // A barrel of lamp oil broken by fire catches.
  const oil = on({ brushed: [{ ...hand, prop: { contents: "lampoil" } }] }), lamp = viewOf(oil, "barrel:300:300:h");
  const lit = validDecorBreakRequest(ask(lamp, hit(lamp, "fire")), ctx(oil));
  assert.equal(lit.fire, true); assert.equal(lit.entry.note.fire, true);
});

test("a powder decoration explodes and its blast chains to a neighbouring powder decoration", () => {
  const keg = { ...hand, prop: { contents: "powder" } }, next = { ...hand, x: 420, y: 300, seed: 9, prop: { contents: "powder" } };
  const r = on({ brushed: [keg, next] }), a = viewOf(r, "barrel:300:300:h"), b = viewOf(r, "barrel:420:300:h");
  const first = validDecorBreakRequest(ask(a, hit(a, "fire")), ctx(r));
  assert.equal(first.explode, true);
  const stored = { ...r, broken: [first.entry] };
  // Its blast reads the stored break: the source is the decoration, exploded, with its burst.
  const source = decorSourceView(stored, a.id, grid, index);
  assert.deepEqual(blastFrom(source), { centre: { x: 300, y: 300 }, burst: 2 });
  assert.equal(decorSourceView(r, a.id, grid, index), null, "not exploded yet: no blast");
  assert.equal(decorSourceView(stored, "decor:R2:" + a.decor.key, grid, index), null, "another region's id");
  const targets = blastTargets({ centre: { x: 300, y: 300 }, burst: 2, grid, tiles: index(stored, grid).views, scene: scene(), levels: ["L1"], sourceId: a.id });
  assert.ok(targets.some((t) => t.id === b.id));
  const chain = validDecorBreakRequest(ask(b, { kind: "blast", sourceId: a.id }), ctx(stored, { source, levels: ["L1"] }));
  assert.equal(chain.ok, true); assert.equal(chain.explode, true, "the neighbour goes off in turn");
  assert.deepEqual(validDecorBreakRequest(ask(b, { kind: "blast", sourceId: a.id }), ctx(stored, { sender: player, source })), { ok: false, why: "sender" });
});

test("a decoration set to Light prop puts its lights out; one set to No keeps them", () => {
  const crateLit = on({ brushed: [{ ...hand, kind: "crate", prop: { light: "yes" } }] }), v = viewOf(crateLit, "crate:300:300:h");
  const lights = [{ id: "L1a", x: 300, y: 300, hidden: false, levels: ["L1"] }, { id: "far", x: 900, y: 900, hidden: false, levels: ["L1"] }];
  const out = validDecorBreakRequest(ask(v), ctx(crateLit, { lights }));
  assert.deepEqual(out.entry.note.lights, ["L1a"]); assert.deepEqual(out.lightUpdates, [{ _id: "L1a", hidden: true }]);
  const dark = on({ brushed: [{ ...hand, kind: "crate" }] });
  assert.deepEqual(validDecorBreakRequest(ask(viewOf(dark, "crate:300:300:h")), ctx(dark, { lights })).lightUpdates, []);
  // Its own light (decorations.lights()): out while broken when it is a light prop, still lit when set to No.
  const lamp = D("lampPost", { x: 100, y: 100 }), keepLit = D("lampPost", { x: 700, y: 700, seed: 2, prop: { light: "no" } });
  assert.equal(decorLightOut(lamp, {}), true); assert.equal(decorLightOut(keepLit, {}), false); assert.equal(decorLightOut(lamp, { light: "no" }), false);
  const placements = [lamp, keepLit], shown = [];
  assert.deepEqual(decorLightList("R1", placements, shown, {}).map((l) => l.x), [700]);
  assert.deepEqual(decorLightList("R1", placements, placements, {}).map((l) => l.x), [100, 700]);
  assert.deepEqual(decorLightList("R1", placements, shown, { light: "no" }).map((l) => l.x), [100, 700]);
});

// ---- spilled powder set off later (as a keg tile's) ----
import { decorSpilled, decorBrokenAfter, decorIgnites, decorBrokenViews } from "../../../scripts/engines/props/decor-break.mjs";

test("a decoration's spilled powder goes off once from a later fire area, and its blast chains", () => {
  const keg = { ...hand, prop: { contents: "powder" } }, next = { ...hand, x: 420, y: 300, seed: 9, prop: { contents: "powder" } };
  const r = on({ brushed: [keg, next] }), a = viewOf(r, "barrel:300:300:h"), b = viewOf(r, "barrel:420:300:h");
  // An axe spills it.
  const spilt = validDecorBreakRequest(ask(a, hit(a, "slashing")), ctx(r));
  assert.equal(spilt.explode, false); assert.equal(spilt.entry.note.powder, "spilled");
  const stored = { ...r, broken: [spilt.entry] };
  assert.deepEqual(decorSpilled([stored], grid, index).map((v) => v.id), [a.id]);
  assert.deepEqual(decorSpilled([{ ...stored, settings: { ...stored.settings, canBreak: false } }], grid, index), [], "switched off: nothing to set off");
  assert.equal(decorSourceView(stored, a.id, grid, index), null, "spilled is no blast yet");
  // A fire area over it sets it off: the entry comes back exploded, and the GM runs its blast.
  const fire = { kind: "ignite", damageType: "fire", at: { x: 300, y: 300 } };
  const lit = validDecorBreakRequest({ key: a.decor.key, cause: fire, note: spilt.entry.note }, ctx(stored));
  assert.equal(lit.ok, true); assert.equal(lit.ignite, true); assert.equal(lit.explode, true);
  assert.equal(lit.entry.note.powder, "exploded"); assert.equal(lit.entry.note.seed, spilt.entry.note.seed, "the same wreck, now blown up");
  // The write lets that one rewrite through, and nothing else.
  const after = decorBrokenAfter(stored.broken, [lit.entry], index(r, grid).keys);
  assert.equal(after.length, 1); assert.equal(after[0].note.powder, "exploded");
  assert.equal(decorBrokenAfter(after, [{ ...lit.entry, note: { ...lit.entry.note, powder: "spilled" } }], index(r, grid).keys)[0].note.powder, "exploded");
  assert.equal(decorBrokenAfter(stored.broken, [{ ...spilt.entry, note: { ...spilt.entry.note, style: "burn" } }], index(r, grid).keys)[0].note.style, spilt.entry.note.style);
  // Once: set off, it is no longer spilled.
  const blown = { ...r, broken: after };
  assert.deepEqual(validDecorBreakRequest({ key: a.decor.key, cause: fire, note: lit.entry.note }, ctx(blown)), { ok: false, why: "broken" });
  assert.deepEqual(decorSpilled([blown], grid, index), []);
  // Its blast chains: the source reads the rewritten entry, the neighbour goes off in turn.
  const source = decorSourceView(blown, a.id, grid, index);
  assert.deepEqual(blastFrom(source), { centre: { x: 300, y: 300 }, burst: 2 });
  assert.equal(validDecorBreakRequest(ask(b, { kind: "blast", sourceId: a.id }), ctx(blown, { source, levels: ["L1"] })).explode, true);
  assert.equal(decorBrokenViews(blown, grid, index)[0].flags.animater.prop.broken.powder, "exploded");
});

test("a forged or wrong ignite is refused: not fire, not spilled, a player with no area, an area that does not hold it", () => {
  const keg = { ...hand, prop: { contents: "powder" } }, r = on({ brushed: [keg] }), a = viewOf(r, "barrel:300:300:h");
  const spilt = validDecorBreakRequest(ask(a, hit(a, "slashing")), ctx(r)), stored = { ...r, broken: [spilt.entry] };
  const ignite = (cause, x = {}) => validDecorBreakRequest({ key: a.decor.key, cause: { kind: "ignite", at: { x: 300, y: 300 }, ...cause }, note: spilt.entry.note }, ctx(stored, x));
  assert.deepEqual(ignite({ damageType: "cold" }), { ok: false, why: "material" });
  assert.deepEqual(ignite({ damageType: "fire" }, { region: r }), { ok: false, why: "cause" }, "never broken: nothing spilled to set off");
  const water = on({ brushed: [hand] }), plain = viewOf(water, "barrel:300:300:h"), wet = validDecorBreakRequest(ask(plain, hit(plain, "slashing")), ctx(water));
  assert.deepEqual(validDecorBreakRequest({ key: plain.decor.key, cause: { kind: "ignite", damageType: "fire" }, note: wet.entry.note }, ctx({ ...water, broken: [wet.entry] })), { ok: false, why: "broken" }, "a barrel of water has no powder");
  assert.equal(ignite({ damageType: "fire" }, { sender: player }).ok, false, "a player must name a placed area");
  const AREA = "Scene.s.Region.a", area = { uuid: AREA, sceneId: "s", authorId: "p", rememberedAt: 1000, damageTypes: ["fire"], testPoint: () => false, levels: ["L1"] };
  assert.deepEqual(ignite({ damageType: "fire", areaUuid: AREA }, { sender: player, area }), { ok: false, why: "area" });
  assert.equal(ignite({ damageType: "fire", areaUuid: AREA }, { sender: player, area: { ...area, testPoint: () => true } }).ok, true);
  assert.deepEqual(validDecorBreakRequest({ key: a.decor.key, cause: { kind: "ignite", damageType: "fire" }, note: spilt.entry.note }, ctx({ ...stored, settings: { ...stored.settings, canBreak: false } })), { ok: false, why: "off" });
});

test("every screen plays the ignite over the spilled wreck it drew; a fire area looks for spilled decorations, a cold one does not", () => {
  const shown = new Map([["d1", 5], ["d2", 6], ["d3", 7]]), powders = new Map([["d1", "spilled"], ["d2", "exploded"], ["d3", "spilled"]]);
  assert.deepEqual(decorIgnites([{ id: "d1", note: { seed: 5, powder: "exploded" } }, { id: "d2", note: { seed: 6, powder: "exploded" } }, { id: "d3", note: { seed: 7, powder: "spilled" } }, { id: "d4", note: { seed: 1, powder: "exploded" } }], shown, powders), ["d1"]);
  const main = read("scripts/main.mjs"), area = main.slice(main.indexOf("function breakAreaThings"), main.indexOf("function breakAreaOnPlay"));
  assert.match(area, /const decorSpills = !types\.includes\("fire"\) \? \[\] : \(propSafe\("area decoration powder", \(\) => ignitableInArea\(tilesOnLevel\(decorSpilled\(decorRegionsOf\(scene, \{ breaking: true \}\), grid, decorIndex\), area\.levels\), area\.testPoint\)\) \?\? \[\]\)\.filter\(\(v\) => propAreas\.claim\(area\.templateId, `ignite:\$\{v\.id\}`\)\);/);
  assert.match(area, /askDecor\(scene, v, \{ kind: "ignite", damageType: "fire", at: area\.at, areaUuid, \.\.\.roll \}, area\.at\)/);
  const apply = main.slice(main.indexOf("async function applyDecorBreak"), main.indexOf("async function receiveDecorBreak"));
  assert.match(apply, /if \(view && check\.explode\) void runBlastAt\(/);
  assert.match(main, /for \(const id of decorIgnites\(wanted, decorWrecksShown, decorWreckPowder\)\)/);
});
