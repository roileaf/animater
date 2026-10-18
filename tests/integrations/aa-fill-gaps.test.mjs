import test from "node:test";
import assert from "node:assert/strict";
import { aaAnimates } from "../../scripts/integrations/automated-animations.mjs";

const menus = {
  "aaAutorec-melee": [{ label: "Sword", menu: "melee" }, { label: "Mace", menu: "melee", advanced: { excludedTerms: ["Light"] } }],
  "aaAutorec-range": [{ label: "Fire Ray", menu: "range" }, { label: "Bolt", menu: "range", advanced: { exactMatch: true } }],
  "aaAutorec-ontoken": [{ label: "Heal", menu: "ontoken" }],
  "aaAutorec-templatefx": [{ label: "Fireball", menu: "templatefx" }],
  "aaAutorec-aura": [],
  "aaAutorec-preset": [],
  "aaAutorec-aefx": [{ label: "Frightened", menu: "aefx" }],
  disableAutoRec: false,
};
const setting = (overrides = {}) => (key) => ({ ...menus, ...overrides })[key];
const animates = (event, overrides) => aaAnimates(event, setting(overrides));
const item = (name, flags) => ({ name, ...(flags ? { flags: { autoanimations: flags } } : {}) });

test("Automatic Recognition decides, like AA: the label inside the name, minus excluded terms", () => {
  assert.equal(animates({ type: "attack", item: item("Longsword") }), true);
  assert.equal(animates({ type: "attack", item: item("Heavy Mace") }), true);
  assert.equal(animates({ type: "attack", item: item("Light Mace") }), false, "excluded term");
  assert.equal(animates({ type: "attack", item: item("Jaws") }), false, "nothing in AA's menus");
  assert.equal(animates({ type: "attack", item: item("Crossbow Bolt") }), false, "exact-match labels need the whole name");
  assert.equal(animates({ type: "attack", item: item("Bolt") }), true);
});

test("an item's own AA settings come first", () => {
  assert.equal(animates({ type: "attack", item: item("Jaws", { isEnabled: true, isCustomized: true }) }), true, "customized in AA");
  assert.equal(animates({ type: "attack", item: item("Longsword", { killAnim: true }) }), false, "turned off in AA: Animater fills it");
  assert.equal(animates({ type: "attack", item: item("Longsword", { isEnabled: false }) }), false);
  assert.equal(animates({ type: "use", item: item("Longsword"), activity: { flags: { autoanimations: { killAnim: true } } } }), false);
  assert.equal(animates({ type: "use", item: item("Jaws"), activity: { flags: { autoanimations: { isCustomized: true } } } }), true);
});

test("with AA's Automatic Recognition off, only customized items are AA's", () => {
  assert.equal(animates({ type: "attack", item: item("Longsword") }, { disableAutoRec: true }), false);
  assert.equal(animates({ type: "attack", item: item("Jaws", { isCustomized: true }) }, { disableAutoRec: true }), true);
});

test("areas look in AA's template menu and effects in its active effect menu", () => {
  assert.equal(animates({ type: "template", item: item("Fireball") }), true);
  assert.equal(animates({ type: "template", item: item("Fire Ray") }), false, "a ray has no template animation in AA");
  assert.equal(animates({ type: "effect", item: item("Frightened") }), true);
  assert.equal(animates({ type: "effect", item: item("Heal") }), false, "effects use only the active effect menu");
});

test("no item or unreadable AA settings never block Animater", () => {
  assert.equal(animates({ type: "attack" }), false);
  assert.equal(aaAnimates({ type: "attack", item: item("Longsword") }, () => { throw Error("not registered"); }), false);
});
