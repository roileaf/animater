import test from "node:test";
import assert from "node:assert/strict";
import { qualityBadgeHTML, qualityLabel, plugModeHTML } from "../../../scripts/catalogs/shared/catalog-terms.mjs";
import { lastingChoiceHTML, lastingChange } from "../../../scripts/catalogs/shared/lasting-choice.mjs";
import { catalogListText } from "../../../scripts/catalogs/shared/catalog-system.mjs";

test("one quality badge, explained on hover, in every catalog", () => {
  assert.match(qualityBadgeHTML("signature"), /class="an-treatment is-signature" data-tooltip="Made for this entry[^"]*">Signature</);
  assert.equal(qualityLabel("unconfigured"), "Needs setup");
  assert.equal(qualityLabel("mystery"), "Symbolic", "unknown values read as Symbolic");
});

test("the Plug & play chip says whether the whole catalog plays or only picked entries", () => {
  assert.match(plugModeHTML({ enabled: true, scope: "all", excluded: ["a", "b"] }, 500), /is-all[^>]*>Plug &amp; play: All on · 2 left out <small>of 500/);
  assert.match(plugModeHTML({ enabled: true, scope: "selected", selected: ["a"], customized: ["a", "b"], excluded: [] }), /is-picked[^>]*>Plug &amp; play: 2 hand-picked/);
  assert.match(plugModeHTML({ enabled: false, scope: "all", excluded: [] }), /is-off[^>]*>Plug &amp; play: Off<\/span>/, "no count when nothing plays");
});

test("Lasting animation is three choices side by side, and notes a device override", () => {
  const html = lastingChoiceHTML({ fade: true, turn: false }, "state-fade", { deviceMode: "always" });
  assert.deepEqual([...html.matchAll(/data-choice="(\w+)" aria-pressed="(\w+)"/g)].map((m) => `${m[1]}:${m[2]}`), ["lasting:false", "once:true", "turn:false"]);
  assert.match(html, /On this device: Always visible/);
  assert.doesNotMatch(lastingChoiceHTML({}, "x", { deviceMode: "world" }), /On this device/);
  assert.deepEqual(lastingChange("turn"), { fade: true, turn: true });
  assert.equal(lastingChange("nope"), null);
});

test("welcome and Setup name the system's own catalogs", () => {
  assert.equal(catalogListText({ systemId: "daggerheart" }), "domain cards, weapons and conditions");
  assert.doesNotMatch(catalogListText({ systemId: "dnd5e" }), /actions/);
});

test("an entry panel shows one status line with its buttons, and both previews in one row", async () => {
  const { catalogStatusHTML, previewRowHTML, entryDetailsHTML, stageListHTML } = await import("../../../scripts/catalogs/shared/catalog-terms.mjs");
  const html = catalogStatusHTML({ tone: "on", title: "Plays automatically", text: "On: Area placed", buttons: [{ label: "Customize", action: "copy-spell" }, null, { label: "Leave out of Plug & play", action: "catalog-exclude", disabled: true }] });
  assert.match(html, /an-entry-status is-on[\s\S]*Plays automatically<\/b><small>On: Area placed/);
  assert.equal((html.match(/<button/g) ?? []).length, 2, "empty slots are skipped");
  assert.match(html, /data-action="catalog-exclude" class="an-quiet"\s+disabled/);
  assert.match(previewRowHTML({ duration: 4500 }), /▶ Preview<\/button><span data-preview-time>0\.0 \/ 4\.5s<\/span><button class="an-quiet" data-action="preview"/);
  assert.equal(entryDetailsHTML(["", null]), "", "nothing to fold: no Details");
  assert.match(stageListHTML([{ label: "Burst", delay: 540, duration: 1600 }]), /from 0\.54 s · 1\.60 s/);
});
