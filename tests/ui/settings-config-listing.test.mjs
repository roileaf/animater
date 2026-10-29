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
