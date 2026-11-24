import test from "node:test";
import assert from "node:assert/strict";
import { listedClientSettings, organizeConfigCategory } from "../../scripts/ui/settings-config-listing.mjs";

const reg = (key, scope, type, extra = {}) => [`animater.${key}`, { key, scope, type, ...extra }];
const registry = new Map([
  reg("quality", "client", String, { choices: { full: "Full", low: "Low" } }),
  reg("screenTint", "world", Boolean),
  reg("screenTintLocal", "client", Boolean),
  reg("screenTintStrength", "client", Number, { range: { min: 0.25, max: 2 } }),
  reg("cameraShakeLocal", "client", Boolean),
  reg("lensBloodLocal", "client", Boolean),
  reg("lensBloodAmount", "client", String, { choices: { off: "Off", subtle: "Subtle" } }),
  reg("lensTunnel", "client", Boolean),
  reg("movementGmPerception", "client", Boolean),
  reg("waitForDice", "client", Boolean),
  reg("heroPointGlowLocal", "client", Boolean),
  reg("lastingMode", "client", Object),
  reg("creatureVoiceFolder", "client", String),
]);

test("each player's own settings are listed by the settings window's tabs, in its order", () => {
  const tabs = listedClientSettings({ registry, systemId: "pf2e", modules: [] });
  assert.deepEqual(tabs.map((t) => t.id), ["look", "motion", "drama"]);
  assert.deepEqual(tabs[0].keys, ["quality", "screenTintLocal", "screenTintStrength"], "world settings stay out");
  assert.deepEqual(tabs[2].keys, ["heroPointGlowLocal", "lensBloodLocal", "lensBloodAmount", "lensTunnel"], "listed once, though two rows share it");
  const all = tabs.flatMap((t) => t.keys);
  assert.ok(!all.includes("movementGmPerception"), "a GM-only setting");
  assert.ok(!all.includes("waitForDice"), "Dice So Nice is not active");
  assert.ok(!all.includes("lastingMode"), "Configure Settings cannot draw an object");
  assert.ok(listedClientSettings({ registry, systemId: "pf2e", modules: ["dice-so-nice"] }).flatMap((t) => t.keys).includes("waitForDice"));
});

// Just enough DOM for the section Configure Settings draws: rows with a named input, appended in order.
function fakeSection(names) {
  const doc = { createElement: (tag) => ({ tag, className: "", innerHTML: "", textContent: "", remove() { section.children.splice(section.children.indexOf(this), 1); } }) };
  const row = (name) => { const group = { tag: "div", className: "form-group", name }; return { input: { closest: () => group }, group }; };
  const rows = Object.fromEntries(names.map((n) => [n, row(n)]));
  const section = {
    ownerDocument: doc,
    children: names.map((n) => rows[n].group),
    querySelector: (sel) => rows[/name="([^"]+)"/.exec(sel)?.[1]]?.input ?? null,
    querySelectorAll: () => section.children.filter((c) => String(c.className).includes("animater-config-tab")),
    append(...nodes) { for (const n of nodes) { const at = section.children.indexOf(n); if (at >= 0) section.children.splice(at, 1); section.children.push(n); } },
  };
  return section;
}
const order = (section) => section.children.map((c) => c.name ?? (c.tag === "h3" ? `# ${c.innerHTML.replace(/<[^>]+>/g, "").trim()}` : "note"));

test("the listed rows go under a heading per tab, after Animater's own entries, and again on a re-render", () => {
  const tabs = listedClientSettings({ registry, systemId: "pf2e", modules: [] });
  const section = fakeSection(["menu", "animater.lensTunnel", "animater.quality", "animater.screenTintLocal", "animater.cameraShakeLocal", "animater.lensBloodLocal"]);
  const expected = ["menu", "# Look &amp; light", "note", "animater.quality", "animater.screenTintLocal", "# Motion", "animater.cameraShakeLocal", "# Combat drama", "animater.lensBloodLocal", "animater.lensTunnel"];
  assert.equal(organizeConfigCategory(section, tabs), 5);
  assert.deepEqual(order(section), expected);
  organizeConfigCategory(section, tabs);
  assert.deepEqual(order(section), expected, "no doubled headings");
  assert.equal(organizeConfigCategory(null, tabs), 0);
});

// Reported: Animation quality set to Off in Animater settings, then Save Changes pressed in the Configure Settings
// window open behind it, and it was Full again.
test("an open Configure Settings follows a setting saved elsewhere, so Save Changes does not write the old value back", async () => {
  const { syncConfigFields } = await import("../../scripts/ui/settings-config-listing.mjs");
  const fields = [
    { name: "animater.quality", tagName: "SELECT", value: "full" },
    { name: "animater.screenTintLocal", type: "checkbox", checked: true },
    { name: "animater.screenTintStrength", tagName: "RANGE-PICKER", value: 1 },
    { name: "animater.lastingMode", tagName: "INPUT", value: "x" },
  ];
  const section = { querySelectorAll: (q) => (q === '[name^="animater."]' ? fields : []) };
  const now = { quality: "off", screenTintLocal: false, screenTintStrength: 1, lastingMode: { a: 1 } };
  // Only the one that changed, when it is known which.
  assert.equal(syncConfigFields(section, (k) => now[k], "animater", "quality"), 1);
  assert.equal(fields[0].value, "off");
  assert.equal(fields[1].checked, true, "another field is left as the user has it");
  // All of them otherwise; what is already right, or cannot be shown, is not touched.
  assert.equal(syncConfigFields(section, (k) => now[k]), 1);
  assert.equal(fields[1].checked, false);
  assert.equal(fields[3].value, "x");
  assert.equal(syncConfigFields(section, () => { throw new Error("not registered"); }), 0);
  assert.equal(syncConfigFields(null, (k) => now[k]), 0);
  const { readFileSync } = await import("node:fs");
  const main = readFileSync(new URL("../../scripts/main.mjs", import.meta.url), "utf8");
  // Whether or not a lock module lists the rest: Animation quality is always in Configure Settings.
  const at = main.indexOf('for (const hook of ["clientSettingChanged", "updateSetting"]) Hooks.on(hook, (first) => {');
  assert.ok(at > 0 && at < main.indexOf("if (LOCK_TOOLS.some((module) => game.modules.get(module)?.active)) {"));
  assert.match(main, /syncConfigFields\(section, \(key\) => game\.settings\.get\(ID, key\), ID, full \? full\.slice\(ID\.length \+ 1\) : null\);/);
});
