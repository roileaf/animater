import test from "node:test";
import assert from "node:assert/strict";
import { fragmentsControlsHTML, fragmentsPreviewSVG, resetPiecesOnPattern } from "../../scripts/ui/fragments-ui.mjs";

const s = { kind: "motion", motion: "fragments", duration: 1400, pattern: "shards", pieces: 7, seed: 3 };

test("the fragments editor has every control and a scrubbable preview", () => {
  const html = fragmentsControlsHTML({ ...s, cut: "fixed" }, 2);
  for (const key of ["pattern", "cut", "angle", "pieces", "spread", "spin", "fall", "drift", "fade"]) assert.match(html, new RegExp(`data-field="${key}" data-index="2"`), key);
  assert.match(html, /data-fragments-scrub/);
  assert.equal((fragmentsPreviewSVG(s, 0.6).match(/data-fragment=/g) ?? []).length, 7);
  assert.equal((fragmentsPreviewSVG({ ...s, pattern: "halves" }, 0).match(/data-fragment=/g) ?? []).length, 2);
});

test("switching pattern clears the stored piece count; other edits keep it", () => {
  const a = { motion: "fragments", pattern: "halves", pieces: 2 };
  resetPiecesOnPattern(a, "pattern");
  assert.equal("pieces" in a, false);
  const b = { motion: "fragments", pieces: 5 }; resetPiecesOnPattern(b, "spin"); assert.equal(b.pieces, 5);
  const c = { motion: "lunge", pieces: 5 }; resetPiecesOnPattern(c, "pattern"); assert.equal(c.pieces, 5);
});

const has = (html, key) => new RegExp(`data-field="${key}"`).test(html);
test("fields that do nothing for the pattern or cut are hidden", () => {
  assert.equal(has(fragmentsControlsHTML({ ...s, cut: "attack" }, 0), "angle"), false, "angle hidden while following the attack");
  assert.equal(has(fragmentsControlsHTML({ ...s, cut: "fixed" }, 0), "angle"), true);
  for (const pattern of ["halves", "topBottom"]) assert.equal(has(fragmentsControlsHTML({ ...s, pattern }, 0), "pieces"), false, pattern);
  for (const pattern of ["shards", "dust"]) assert.equal(has(fragmentsControlsHTML({ ...s, pattern }, 0), "pieces"), true, pattern);
  assert.equal(has(fragmentsControlsHTML({ ...s, pattern: "dust" }, 0), "fade"), false, "dust fades per speck");
  assert.equal(has(fragmentsControlsHTML({ ...s, pattern: "shards" }, 0), "fade"), true);
});
test("the preview says which way the sample attack comes from; the hold hint is for finishers only", () => {
  assert.match(fragmentsControlsHTML({ ...s, cut: "attack" }, 0), /Preview: attack from the left/);
  assert.doesNotMatch(fragmentsControlsHTML({ ...s, cut: "fixed" }, 0), /attack from the left/);
  assert.doesNotMatch(fragmentsControlsHTML(s, 0), /End: hold/);
  assert.match(fragmentsControlsHTML(s, 0, 0.6, { finisher: true }), /Use End: hold in a finisher/);
});

import { Workspace } from "../../scripts/ui/workspace.mjs";
test("the motion controls hide Distance and Intensity for fragments and pass the finisher hint on", () => {
  const frag = { kind: "motion", motion: "fragments", duration: 1400, pattern: "halves" };
  const html = Workspace.prototype.motionControlsHTML(frag, 0);
  assert.equal(has(html, "distance"), false);
  assert.equal(has(html, "intensity"), false);
  assert.doesNotMatch(html, /End: hold/);
  assert.match(Workspace.prototype.motionControlsHTML(frag, 0, { finisher: { on: "kill" } }), /Use End: hold in a finisher/);
  const lunge = Workspace.prototype.motionControlsHTML({ kind: "motion", motion: "lunge", duration: 600 }, 0);
  assert.ok(has(lunge, "distance") && has(lunge, "intensity"));
});

test("behaviour and tint selects, with the chosen behaviour's hint", () => {
  const html = fragmentsControlsHTML({ ...s, behavior: "absorb", tint: "ghost" }, 1);
  assert.match(html, /<select data-field="behavior" data-index="1">/);
  assert.match(html, /<select data-field="tint" data-index="1">/);
  assert.match(html, /<option value="absorb" selected>Drawn to the attacker<\/option>/);
  assert.match(html, /<option value="ghost" selected>Ghostly<\/option>/);
  const plain = fragmentsControlsHTML({ ...s, tint: "#ffffff" }, 0);
  assert.match(plain, /<option value="burst" selected>Burst apart<\/option>/);
  assert.match(plain, /<option value="none" selected>None<\/option>/, "the generic colour tint shows as None");
  assert.doesNotMatch(plain, /data-behavior-hint/);
  const hints = { implode: "Pieces collapse into the centre.", absorb: "Pieces stream into the attacker.", rise: "Pieces float away upward.", bounce: "Pieces fall, bounce once and settle.", drip: "Pieces stretch and slide down." };
  for (const [behavior, hint] of Object.entries(hints)) assert.ok(fragmentsControlsHTML({ ...s, behavior }, 0).includes(`<p class="an-hint" data-behavior-hint>${hint}</p>`), behavior);
});

test("the Pieces field follows the pattern's range and names what it counts", () => {
  const input = (stage) => /<label>([^<]+)<input type="number" min="(\d+)" max="(\d+)" step="1" data-field="pieces" data-index="0" value="(\d+)">/.exec(fragmentsControlsHTML(stage, 0))?.slice(1);
  const fresh = (pattern) => ({ ...s, pattern, pieces: undefined });
  assert.deepEqual(input(fresh("diced")), ["Per side", "2", "6", "4"]);
  assert.deepEqual(input(fresh("rings")), ["Rings", "2", "4", "3"]);
  assert.deepEqual(input(fresh("starburst")), ["Pieces", "6", "16", "10"]);
  assert.deepEqual(input(fresh("pixelate")), ["Pieces", "16", "64", "36"]);
  assert.deepEqual(input(fresh("ribbons")), ["Pieces", "6", "16", "10"]);
  assert.deepEqual(input(fresh("dust")), ["Pieces", "16", "64", "48"]);
  assert.deepEqual(input(s), ["Pieces", "4", "10", "7"]);
  for (const pattern of ["cross", "claw"]) assert.equal(has(fragmentsControlsHTML(fresh(pattern), 0), "pieces"), false, `${pattern} always cuts four`);
});

test("Fade shows whenever pieces fade with the stage", () => {
  assert.equal(has(fragmentsControlsHTML({ ...s, pattern: "pixelate" }, 0), "fade"), false, "pixels fade per cell");
  assert.equal(has(fragmentsControlsHTML({ ...s, pattern: "dust", behavior: "rise" }, 0), "fade"), true, "rising dust fades with the stage");
  assert.equal(has(fragmentsControlsHTML({ ...s, pattern: "starburst" }, 0), "fade"), true);
  assert.equal(has(fragmentsControlsHTML({ ...s, behavior: "absorb" }, 0), "fade"), false, "absorb fades over its own last quarter");
  assert.equal(has(fragmentsControlsHTML({ ...s, pattern: "dust", behavior: "absorb" }, 0), "fade"), false);
});

test("the mini preview shrinks and stretches pieces only when a behaviour does", () => {
  assert.match(fragmentsPreviewSVG({ ...s, behavior: "implode" }, 1), /scale\(0\.050 0\.050\)/);
  assert.match(fragmentsPreviewSVG({ ...s, behavior: "drip" }, 1), /scale\(1\.000 2\.200\)/);
  assert.doesNotMatch(fragmentsPreviewSVG(s, 0.6), /scale\(/);
  assert.equal((fragmentsPreviewSVG({ ...s, pattern: "rings", pieces: 2 }, 0.5).match(/data-fragment=/g) ?? []).length, 16);
});

test("crumble is offered in the Behaviour select, with its hint, and keeps the stage's Fade field", () => {
  const html = fragmentsControlsHTML({ ...s, pattern: "dust", behavior: "crumble" }, 0);
  assert.match(html, /<option value="crumble" selected>Crumble to a heap<\/option>/);
  assert.ok(html.includes(`<p class="an-hint" data-behavior-hint>Pieces fall from the top down and pile up at its feet.</p>`));
  assert.match(html, /data-field="fade"/);
  assert.doesNotMatch(fragmentsPreviewSVG({ ...s, behavior: "crumble" }, 0.7), /NaN/);
});

test("the damage patterns' Pieces field names what it counts; lightning has none", () => {
  const label = (pattern) => /<label>([^<]+)<input type="number" min="\d+" max="\d+" step="1" data-field="pieces"/.exec(fragmentsControlsHTML({ ...s, pattern, pieces: undefined }, 0))?.[1];
  assert.deepEqual(["perforate", "slashes", "crush"].map(label), ["Punctures", "Cuts", "Rings"]);
  assert.equal(has(fragmentsControlsHTML({ ...s, pattern: "lightning", pieces: undefined }, 0), "pieces"), false);
});

test("the mini preview squashes flatten pieces wide and flat", () => {
  assert.match(fragmentsPreviewSVG({ ...s, pattern: "crush", behavior: "flatten" }, 1), /scale\(1\.150 0\.350\)/);
  assert.doesNotMatch(fragmentsPreviewSVG({ ...s, pattern: "lightning" }, 0.6), /scale\(|NaN/);
});
