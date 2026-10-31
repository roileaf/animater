import test from "node:test";
import assert from "node:assert/strict";
import { lookName, normalizeFlags, toggleFlag, flaggedText, panelRows, panelHTML } from "../../scripts/ui/token-looks.mjs";

test("a look's name drops the Spell Effect: prefix every effect shares", () => {
  assert.equal(lookName("Spell Effect: Bless"), "Bless");
  assert.equal(lookName("Effect: Treat Wounds Immunity"), "Treat Wounds Immunity");
  assert.equal(lookName("Stance: Effect: Inspiring Marshal Stance"), "Inspiring Marshal Stance");
  assert.equal(lookName("Frightened"), "Frightened");
  assert.equal(lookName("Effect:"), "Effect:", "nothing left: keep the name");
});

test("flags toggle per catalog entry and copy as a list to send", () => {
  const bless = { id: "spell-effects-1", name: "Spell Effect: Bless", kind: "effect" }, fear = { id: "c-2", name: "Frightened", kind: "condition" };
  let flags = toggleFlag({}, bless, { by: "gm", now: 5 });
  assert.deepEqual(flags, { "spell-effects-1": { name: "Spell Effect: Bless", kind: "effect", flaggedAt: 5, by: "gm" } });
  flags = toggleFlag(flags, fear, { by: "gm", now: 6 });
  assert.equal(flaggedText(flags, { system: "pf2e", version: "2.2.28" }),
    "Animater 2.2.28 · PF2E looks flagged for a new look (2):\n- Frightened (condition, c-2)\n- Spell Effect: Bless (effect, spell-effects-1)");
  flags = toggleFlag(flags, bless);
  assert.deepEqual(Object.keys(flags), ["c-2"], "toggling again clears it");
  assert.equal(flaggedText({}), "", "nothing flagged: nothing to copy");
  assert.deepEqual(normalizeFlags({ x: null, "": {}, y: { name: 3 } }), { y: { name: "3", kind: "effect", flaggedAt: 0, by: "" } });
});

test("the panel offers Hide here to everyone, Always off and Flag to the GM for catalog looks", () => {
  const states = [{ key: "k1", name: "Spell Effect: Bless", stateEntry: "e1" }, { key: "k2", name: "My aura", stateEntry: null }, { name: "no key" }];
  const entryOf = (s) => (s.stateEntry ? { id: s.stateEntry, name: s.name, kind: "effect" } : null);
  const gm = panelRows(states, { entryOf, flags: { e1: { name: "Bless" } }, isGM: true });
  assert.deepEqual(gm.map((r) => [r.key, r.canAlways, r.canFlag, r.flagged]), [["k1", true, true, true], ["k2", false, false, false]]);
  const player = panelRows(states, { entryOf, isGM: false });
  assert.ok(player.every((r) => !r.canAlways && !r.canFlag));
  const html = panelHTML(gm, { tokenName: "Qaelrin", isGM: true });
  assert.match(html, /<b title="Spell Effect: Bless">Bless<\/b>/);
  assert.equal((html.match(/data-look-action="hide"/g) ?? []).length, 2);
  assert.equal((html.match(/data-look-action="always"/g) ?? []).length, 1);
  assert.match(html, /aria-pressed="true"[^>]*>⚑ Flagged/);
  assert.match(panelHTML([], { tokenName: "X" }), /No lasting looks/);
});
