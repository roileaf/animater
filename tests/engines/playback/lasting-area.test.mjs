import test from "node:test";
import assert from "node:assert/strict";
import { isLastingArea, lastingDuration, lastingAsset, withLastingArea } from "../../../scripts/engines/playback/lasting-area.mjs";

const spell = (name, duration) => ({ type: "spell", name, system: { duration: { value: duration } } });
const recipe = (stages, systemId = "pf2e") => ({ id: "r", systemId, stages });
const area = (assets, extra = {}) => ({ kind: "template", assets, oneShot: true, fadeOut: 180, ...extra });
const exists = (key) => ["jb2a.fog_cloud.01.loop.white", "jb2a.magic_signs.circle.02.abjuration.loop.blue"].includes(key);

test("PF2e/SF2e lasting areas: a standing area with a duration, never a blast or a cast-time effect", () => {
  assert.ok(isLastingArea(spell("Wall of Fire", "1 minute")));
  assert.ok(isLastingArea(spell("Mist", "sustained up to 1 minute")));
  assert.ok(isLastingArea(spell("Web", "1 hour")));
  assert.ok(!isLastingArea(spell("Fireball", "")), "instant blast");
  assert.ok(!isLastingArea(spell("Calm", "1 minute")), "affects creatures, no standing area");
  assert.ok(!isLastingArea(spell("Thunder Burst", "1 minute")), "blast word wins");
  assert.ok(!isLastingArea(spell("Wall of Stone", "permanent")), "reshaped terrain stays as map");
  assert.ok(!isLastingArea({ type: "feat", name: "Wall of Fire", system: { duration: { value: "1 minute" } } }));
  assert.ok(!lastingDuration("instantaneous") && lastingDuration("10 minutes") && !lastingDuration(""));
});

test("the first area layer persists with loop footage and a ground ward instead of a dome", () => {
  const event = { template: { id: "t" }, item: spell("Incendiary Fog", "1 minute") };
  const out = withLastingArea(recipe([{ kind: "cast", assets: ["jb2a.x"] }, area(["jb2a.fog_cloud.01.complete.white"]), area(["jb2a.impact.001.orange"])]), event, { exists });
  assert.deepEqual(out.stages[1].assets, ["jb2a.fog_cloud.01.loop.white"]);
  assert.equal(out.stages[1].persist, true);
  assert.equal(out.stages[1].oneShot, false);
  assert.equal(out.stages[1].fadeOut, 800);
  assert.ok(!out.stages[2].persist, "later flourishes stay one-shot");
  assert.equal(lastingAsset("jb2a.energy_field.02.above.purple", exists), "jb2a.magic_signs.circle.02.abjuration.loop.blue");
});

test("no template, D&D recipes and already-lasting recipes are left alone", () => {
  const item = spell("Wall of Fire", "1 minute");
  const base = recipe([area(["jb2a.a"])]);
  assert.equal(withLastingArea(base, { item }), base);
  const dnd = recipe([area(["jb2a.a"])], "dnd5e");
  assert.equal(withLastingArea(dnd, { item, template: {} }), dnd);
  const lasting = recipe([area(["jb2a.a"], { persist: true })]);
  assert.equal(withLastingArea(lasting, { item, template: {} }), lasting);
});

test("PF2e/SF2e emanations last and follow the caster unless a spell effect draws the aura", () => {
  const emanation = (name, description = "", duration = "1 minute", traits = ["aura"]) => ({ type: "spell", name, system: { traits: { value: traits }, area: { type: "emanation", value: 10 }, duration: { value: duration }, description: { value: description } } });
  const event = (item) => ({ template: { id: "t" }, item });
  const out = withLastingArea(recipe([area(["jb2a.a"])]), event(emanation("Angelic Halo")));
  assert.equal(out.stages[0].persist, true);
  assert.equal(out.stages[0].followSource, true);
  // Bless applies "Spell Effect: Bless", whose Aura rule is already drawn natively.
  const bless = emanation("Bless", '<p>@UUID[Compendium.pf2e.spell-effects.Item.Gqy7K6FnbLtwGpud]{Spell Effect: Bless}</p>');
  assert.equal(withLastingArea(recipe([area(["jb2a.a"])]), event(bless)).stages[0].persist, undefined);
  assert.ok(!isLastingArea(emanation("Thunder Burst")), "a blast stays one-shot");
  assert.ok(!isLastingArea(emanation("Synaptic Pulse", "", "1 round", ["mental"])), "no aura trait: affects whoever is inside when cast");
  assert.ok(!isLastingArea(emanation("Quick Ward", "", "")), "no duration, no loop");
  assert.ok(isLastingArea({ type: "spell", name: "Wall of Wind", system: { duration: { value: "", sustained: true } } }), "sustained counts as lasting");
});
