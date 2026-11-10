import test from "node:test";
import assert from "node:assert/strict";
import { propTileFieldsHTML, propSceneFieldsHTML } from "../../scripts/ui/prop-config.mjs";

test("tile fields show the guess and keep the GM's choice", () => {
  const html = propTileFieldsHTML({ src: "Barrel_Wood_A.webp", material: "", contents: "wine" });
  assert.match(html, /Automatic \(wood\)/);
  assert.match(html, /name="flags\.animater\.prop\.material"/);
  assert.match(html, /<option value="wine" selected>/);
});
test("contents use the spec's words: Nothing ... Loose goods", () => {
  const html = propTileFieldsHTML({ src: "x.webp" }).split("prop.contents")[1];
  const labels = [...html.matchAll(/<option value="(none|water|wine|oil|grain|goods|books|potions)"[^>]*>([^<]*)</g)].map((m) => m[2]);
  assert.deepEqual(labels, ["Nothing", "Water", "Wine", "Oil", "Grain", "Loose goods", "Books", "Potions"]);
});
test("tile fields keep a chosen material and escape the file name", () => {
  const html = propTileFieldsHTML({ src: 'a"<b>.webp', material: "glass" });
  assert.match(html, /<option value="glass" selected>/);
  assert.match(html, /Won't break/);
  assert.doesNotMatch(html, /<b>/);
});
test("scene fields default to off and 25%", () => {
  const html = propSceneFieldsHTML({});
  assert.doesNotMatch(html, /breakableProps"[^>]*checked/);
  assert.match(html, /name="flags\.animater\.propMissChance"[^>]*value="25"/);
  assert.match(html, /data-action="animater-repair-props"/);
  assert.match(html, /type="button"/);
  assert.match(html, /data-action="animater-breakable-all"[^>]*>[^<]*<i[^>]*><\/i> Make all doors and windows breakable/);
  assert.match(html, /data-action="animater-breakable-none"[^>]*>[^<]*<i[^>]*><\/i> Make none breakable/);
  assert.equal((html.match(/type="button"/g) ?? []).length, 3);
});
test("scene fields keep on and a chosen chance, including 0", () => {
  assert.match(propSceneFieldsHTML({ on: true, chance: 10 }), /breakableProps"[^>]*checked[\s\S]*value="10"/);
  assert.match(propSceneFieldsHTML({ chance: 0 }), /propMissChance"[^>]*value="0"/);
});
test("Breaks as shows the guess; contents guess and new kinds", () => {
  const html = propTileFieldsHTML({ src: "Bookshelf_A.webp" });
  assert.match(html, /name="flags\.animater\.prop\.style"/);
  assert.match(html, /<option value="" selected>Automatic \(collapse\)</);
  assert.match(html, /Automatic \(Books\)/);
  assert.match(html, /<option value="potions"[^>]*>Potions</);
});
test("Breaks as keeps the GM's pick and offers Shatter and Collapse", () => {
  const html = propTileFieldsHTML({ src: "Table.webp", style: "shatter" });
  assert.match(html, /<option value="shatter" selected>Shatter</);
  assert.match(html, /<option value="collapse">Collapse</);
  assert.match(html, /<label>Breaks as</);
});

import { wallBreakFieldsHTML } from "../../scripts/ui/prop-config.mjs";
test("door fieldset defaults: automatic, wood, Force Open on", () => {
  const html = wallBreakFieldsHTML({ door: 1 });
  assert.match(html, /<legend>Breakable<\/legend>/);
  assert.match(html, /data-animater-break-wall/);
  assert.match(html, /data-group="door"/);
  assert.match(html, /name="flags\.animater\.breakWall\.door"[\s\S]*<option value="" selected>Automatic/);
  assert.match(html, /<option value="wood" selected>Wood</);
  assert.match(html, /name="flags\.animater\.breakWall\.forceOpen"[^>]*checked/);
  assert.doesNotMatch(wallBreakFieldsHTML({ door: 1, own: { forceOpen: false } }), /forceOpen"[^>]*checked/);
  assert.match(wallBreakFieldsHTML({ door: 1, own: { door: "never", material: "stone" } }), /<option value="never" selected>Never[\s\S]*<option value="stone" selected>Stone/);
});
test("door fieldset: Can be forced open, and a Force open DC that shows its automatic value", () => {
  const html = wallBreakFieldsHTML({ door: 1, system: "pf2e" });
  assert.match(html, /<label>Can be forced open<\/label>/);
  assert.doesNotMatch(html, /Force Open breaks it/);
  assert.match(html, /<input type="number" name="flags\.animater\.breakWall\.forceDC"[^>]*placeholder="Automatic \(15\)"/);
  assert.match(html, /name="flags\.animater\.breakWall\.forceDC"[^>]*value=""/);
  // the DC field sits in the door group, not the window group
  assert.match(html, /data-group="door"[\s\S]*breakWall\.forceDC[\s\S]*data-group="window"/);
  assert.equal((html.match(/breakWall\.forceDC/g) ?? []).length, 1);
  // each material's automatic DC rides on the field, so the placeholder follows the Material select
  assert.match(html, /data-dc-wood="15" data-dc-reinforced="20" data-dc-metal="20" data-dc-stone="25"/);
  assert.match(wallBreakFieldsHTML({ door: 1, system: "pf2e", own: { material: "metal" } }), /placeholder="Automatic \(20\)"/);
  assert.match(wallBreakFieldsHTML({ door: 1, system: "daggerheart", own: { material: "stone" } }), /placeholder="Automatic \(19\)"/);
  assert.match(wallBreakFieldsHTML({ door: 1, system: "dnd5e", own: { forceDC: 18 } }), /forceDC"[^>]*value="18"/);
  assert.match(wallBreakFieldsHTML({ door: 1, system: "dnd5e", own: { forceDC: "junk" } }), /forceDC"[^>]*value=""/);
  // a window's form keeps the door group's inputs disabled, the DC too
  assert.match(wallBreakFieldsHTML({ door: 0, system: "pf2e" }), /breakWall\.forceDC"[^>]*disabled/);
});
test("door fieldset: no DC field where the system has none", () => {
  const ds = wallBreakFieldsHTML({ door: 1, system: "draw-steel" });
  assert.doesNotMatch(ds, /breakWall\.forceDC/);
  assert.match(ds, /tier 2 or 3/);
  const other = wallBreakFieldsHTML({ door: 1, system: "crucible" });
  assert.doesNotMatch(other, /breakWall\.forceDC/);
  assert.match(other, /Shift\+right-click/);
  assert.match(other, /<label>Can be forced open<\/label>/);
});
test("scene: Doors and windows break is on unless turned off", () => {
  assert.match(propSceneFieldsHTML({}), /name="flags\.animater\.breakWalls"[^>]*checked/);
  assert.match(propSceneFieldsHTML({}), /Doors and windows break/);
  assert.doesNotMatch(propSceneFieldsHTML({ breakWalls: false }), /breakWalls"[^>]*checked/);
});
test("window fieldset: Automatic by default (yes for a glass window), glass by default", () => {
  const html = wallBreakFieldsHTML({ door: 0 });
  assert.ok(html.includes('<option value="" selected>Automatic (no)</option>'));
  assert.ok(wallBreakFieldsHTML({ door: 0, windowKind: "leaded" }).includes('<option value="" selected>Automatic (yes: a glass window)</option>'));
  assert.ok(wallBreakFieldsHTML({ door: 0, own: { window: "no" }, windowKind: "glass" }).includes('<option value="no" selected>No</option>'));
  assert.match(html, /data-group="window"[\s\S]*<option value="glass" selected>Glass</);
  assert.match(html, /<option value="none">Won't break</);
  // door 0 shows the window group and hides the door group; a door does the reverse
  assert.match(html, /data-group="door" hidden/);
  assert.doesNotMatch(html, /data-group="window" hidden/);
  assert.match(wallBreakFieldsHTML({ door: 1 }), /data-group="window" hidden/);
  assert.doesNotMatch(wallBreakFieldsHTML({ door: 1 }), /data-group="door" hidden/);
  assert.match(wallBreakFieldsHTML({ door: 0, own: { window: true, material: "none" } }), /<option value="yes" selected>Yes<[\s\S]*<option value="none" selected>Won't break</);
});
test("window fieldset: the hidden group's material select is disabled (and has its own name)", () => {
  assert.match(wallBreakFieldsHTML({ door: 0 }), /data-group="door" hidden[\s\S]*?<select name="flags\.animater\.breakWall\.material" disabled>/);
  const doorShown = wallBreakFieldsHTML({ door: 1 });
  assert.match(doorShown, /data-group="window" hidden[\s\S]*?<select name="flags\.animater\.breakWall\.windowMaterial" disabled>/);
  assert.equal((doorShown.match(/breakWall\.(window)?[mM]aterial" disabled/g) ?? []).length, 1);
  assert.equal((wallBreakFieldsHTML({ door: 0 }).match(/breakWall\.(window)?[mM]aterial" disabled/g) ?? []).length, 1);
});

test("Light prop select", () => {
  assert.match(propTileFieldsHTML({ src: "Lantern.webp" }), /name="flags\.animater\.prop\.light"[\s\S]*Automatic \(yes\)/);
  assert.match(propTileFieldsHTML({ src: "Barrel.webp" }), /prop\.light"[\s\S]*Automatic \(no\)/);
  assert.match(propTileFieldsHTML({ src: "Barrel.webp", light: "yes" }), /<option value="yes" selected>Yes</);
});
test("Contents offers Lamp oil, and a lantern guesses it", () => {
  const html = propTileFieldsHTML({ src: "Lantern_A.webp" });
  assert.match(html, /<option value="lampoil"[^>]*>Lamp oil</);
  assert.match(html, /Automatic \(Lamp oil\)/);
  assert.match(propTileFieldsHTML({ src: "Barrel.webp", contents: "lampoil" }), /<option value="lampoil" selected>Lamp oil</);
});
test("Tips over select", () => {
  assert.match(propTileFieldsHTML({ src: "Brazier.webp" }), /name="flags\.animater\.prop\.tips"[\s\S]*Automatic \(yes\)/);
  assert.match(propTileFieldsHTML({ src: "Barrel.webp" }), /prop\.tips"[\s\S]*Automatic \(no\)/);
  assert.match(propTileFieldsHTML({ src: "Barrel.webp" }), /<label>Tips over instead of breaking<\/label>/);
  assert.match(propTileFieldsHTML({ src: "Brazier.webp", tips: "no" }), /prop\.tips">[\s\S]*?<option value="no" selected>No</);
  const tipsSelect = (html) => html.match(/prop\.tips">([\s\S]*?)<\/select>/)[1];
  assert.doesNotMatch(tipsSelect(propTileFieldsHTML({ src: "Brazier.webp", tips: "junk" })), /value="(yes|no)" selected/);
  assert.match(tipsSelect(propTileFieldsHTML({ src: "Brazier.webp", tips: "yes" })), /<option value="yes" selected>Yes</);
});

test("Contents offers Black powder; a powder keg's guess says so", () => {
  assert.match(propTileFieldsHTML({ src: "x.webp" }), /<option value="powder"[^>]*>Black powder</);
  assert.match(propTileFieldsHTML({ src: "Keg_Gunpowder.webp" }), /Automatic \(Black powder\)/);
});
test("Burst field shows for black powder only", () => {
  assert.match(propTileFieldsHTML({ src: "Keg_Powder.webp" }), /data-show-for="powder"(?![^>]*hidden)[\s\S]*name="flags\.animater\.prop\.burst"[^>]*value="2"/);
  assert.match(propTileFieldsHTML({ src: "Barrel_Wood.webp" }), /data-show-for="powder"[^>]*hidden/);
  // the GM's own pick of contents wins over the guess, both ways
  assert.doesNotMatch(propTileFieldsHTML({ src: "Barrel_Wood.webp", contents: "powder" }), /data-show-for="powder"[^>]*hidden/);
  assert.match(propTileFieldsHTML({ src: "Keg_Powder.webp", contents: "wine" }), /data-show-for="powder"[^>]*hidden/);
  // a hidden field does not submit; the label and range
  assert.match(propTileFieldsHTML({ src: "Barrel_Wood.webp" }), /name="flags\.animater\.prop\.burst"[^>]*disabled/);
  assert.doesNotMatch(propTileFieldsHTML({ src: "Keg_Powder.webp" }), /name="flags\.animater\.prop\.burst"[^>]*disabled/);
  const html = propTileFieldsHTML({ src: "Keg_Powder.webp", burst: 3 });
  assert.match(html, /<label>Burst \(squares\)<\/label>/);
  assert.match(html, /<input type="number" name="flags\.animater\.prop\.burst" min="1" max="4" step="1" value="3"/);
  assert.match(propTileFieldsHTML({ src: "Keg_Powder.webp", burst: 12 }), /prop\.burst"[^>]*value="4"/);
  // the guess the toggle falls back to when Contents is Automatic
  assert.match(propTileFieldsHTML({ src: "Keg_Powder.webp" }), /data-animater-prop[^>]*data-guess-contents="powder"/);
});

test("Plant and Burn away in the tile fields", () => {
  const html = propTileFieldsHTML({ src: "Web.webp" });
  assert.match(html, /<option value="plant"[^>]*>Plant</);
  assert.match(html, /<option value="burn"[^>]*>Burn away</);
  assert.match(html, /Automatic \(plant\)/);
  assert.match(html, /Automatic \(burn away\)/);
  assert.match(propTileFieldsHTML({ src: "Web.webp", style: "burn" }), /<option value="burn" selected>Burn away</);
  assert.match(propTileFieldsHTML({ src: "Bush.webp", material: "wood" }), /Automatic \(shatter\)/, "a guessed burn needs the plant material");
});

// Task 21 (D1): Foundry submits disabled inputs too, so the two groups' Material selects carry different names; the
// wall hooks merge them into one material on save (wall-break wallBreakFormMerge).
test("the window group's Material is its own field, so one material name submits per group", () => {
  for (const door of [0, 1]) {
    const html = wallBreakFieldsHTML({ door });
    assert.equal((html.match(/name="flags\.animater\.breakWall\.material"/g) ?? []).length, 1);
    assert.equal((html.match(/name="flags\.animater\.breakWall\.windowMaterial"/g) ?? []).length, 1);
    assert.match(html, /data-group="door"[\s\S]*breakWall\.material"[\s\S]*data-group="window"[\s\S]*breakWall\.windowMaterial"/);
  }
  // a window saved Won't break (or with the old array) shows Won't break
  assert.match(wallBreakFieldsHTML({ door: 0, own: { window: true, material: ["wood", "none"] } }), /windowMaterial"[^>]*>[\s\S]*?<option value="none" selected>/);
  assert.match(wallBreakFieldsHTML({ door: 0, own: { window: true, material: "none" } }), /windowMaterial"[^>]*>[\s\S]*?<option value="none" selected>/);
  // a door saved with the old array shows its metal
  assert.match(wallBreakFieldsHTML({ door: 1, own: { material: ["metal", "glass"] } }), /<option value="metal" selected>Metal/);
});

test("door fieldset: Reinforced wood is a material choice", () => {
  assert.match(wallBreakFieldsHTML({ door: 1 }), /<option value="reinforced">Reinforced wood</);
  assert.match(wallBreakFieldsHTML({ door: 1, own: { material: "reinforced" } }), /<option value="reinforced" selected>Reinforced wood</);
  assert.match(wallBreakFieldsHTML({ door: 1, system: "pf2e", own: { material: "reinforced" } }), /forceDC"[^>]*placeholder="Automatic \(20\)"/);
});
test("door fieldset (PF2e): AC, Hardness, HP and Broken Threshold, blank = Automatic by material", () => {
  const html = wallBreakFieldsHTML({ door: 1, system: "pf2e" });
  for (const [key, label, auto] of [["ac", "AC", 10], ["hardness", "Hardness", 5], ["maxHp", "HP", 20], ["bt", "Broken Threshold", 10]]) {
    assert.match(html, new RegExp(`<label>${label}</label><div class="form-fields"><input type="number" name="flags\\.animater\\.breakWall\\.${key}"[^>]*value=""[^>]*placeholder="Automatic \\(${auto}\\)"`));
  }
  // each material's automatic value rides on the field, so the placeholder follows the Material select
  assert.match(html, /breakWall\.hardness"[^>]*data-auto-wood="5" data-auto-reinforced="10" data-auto-metal="9" data-auto-stone="14"/);
  const iron = wallBreakFieldsHTML({ door: 1, system: "pf2e", own: { material: "metal", ac: 15 } });
  assert.match(iron, /breakWall\.ac"[^>]*value="15"/);
  assert.match(iron, /breakWall\.maxHp"[^>]*placeholder="Automatic \(36\)"/);
  assert.match(iron, /breakWall\.bt"[^>]*placeholder="Automatic \(18\)"/);
  // the stats sit in the door group, disabled on a window's form
  assert.match(html, /data-group="door"[\s\S]*breakWall\.maxHp[\s\S]*data-group="window"/);
  assert.match(wallBreakFieldsHTML({ door: 0, system: "pf2e" }), /breakWall\.maxHp"[^>]*disabled/);
  assert.match(html, /Attack the door/);
  // AC and HP need at least 1 (0 would read as Automatic); Hardness and BT may be 0
  assert.match(html, /breakWall.ac" min="1"/); assert.match(html, /breakWall.maxHp" min="1"/);
  assert.match(html, /breakWall.hardness" min="0"/); assert.match(html, /breakWall.bt" min="0"/);
  // a hit door says how much it has left
  assert.match(wallBreakFieldsHTML({ door: 1, system: "pf2e", own: { hp: 7 } }), /7 of 20 HP left/);
  assert.doesNotMatch(html, /HP left/);
});
test("door fieldset: no attack stats outside PF2e", () => {
  for (const sys of ["dnd5e", "sf2e", "daggerheart", "draw-steel", undefined]) assert.doesNotMatch(wallBreakFieldsHTML({ door: 1, system: sys }), /breakWall\.(ac|hardness|maxHp|bt)"/);
});
