import test from "node:test";
import assert from "node:assert/strict";
import { awarenessLevel, normalizeMoment, mergeMoments, momentForViewer, captionFor, UNSEEN_NAME } from "../../../scripts/engines/flash/recap.mjs";
import { planReel } from "../../../scripts/engines/flash/recap-reel.mjs";

const person = (name, tokenId, extra = {}) => ({ name, img: `${name}.webp`, src: `tokens/${name}.webp`, tokenId, actorId: `a${tokenId}`, x: 0, y: 0, w: 100, h: 100, ...extra });
const moment = (awareness, extra = {}) => normalizeMoment({
  badges: ["crit"], actor: person("Hero", "h1"), targets: [person("Lurker", "f1", { x: 400 })], amount: 12, sceneId: "s1", attackMessageId: "m1", at: 1, awareness, ...extra,
});

test("awareness classification follows movement's perceive()", () => {
  assert.equal(awarenessLevel({ states: ["observed"] }), "seen");
  assert.equal(awarenessLevel({ states: ["concealed"] }), "seen");
  assert.equal(awarenessLevel({ states: ["hidden"] }), "heard");
  assert.equal(awarenessLevel({ states: ["undetected"] }), "unknown");
  assert.equal(awarenessLevel({ states: ["unnoticed"] }), "unknown");
  assert.equal(awarenessLevel({ states: ["undetected", "hidden"] }), "heard", "the most aware of the player's tokens counts");
  // No Visioner: the creature's conditions, else seen when not GM-hidden.
  assert.equal(awarenessLevel({ conditions: ["invisible"] }), "heard");
  assert.equal(awarenessLevel({ conditions: ["hidden"] }), "heard");
  assert.equal(awarenessLevel({ conditions: ["undetected"] }), "unknown");
  assert.equal(awarenessLevel({}), "seen");
  assert.equal(awarenessLevel({ docHidden: true }), "unknown");
});

test("awareness survives normalizing, keeps only valid entries, and merging keeps the least aware", () => {
  const m = moment({ f1: { u1: "heard", u2: "seen", "bad id!": "seen", u3: "bogus" }, h1: { u1: "seen" } });
  assert.deepEqual(m.awareness, { f1: { u1: "heard", u2: "seen" }, h1: { u1: "seen" } });
  const later = moment({ f1: { u1: "seen", u2: "unknown" } }, { damageMessageId: "d1" });
  assert.deepEqual(mergeMoments(m, later).awareness.f1, { u1: "heard", u2: "unknown" });
  assert.equal(moment(undefined).awareness, undefined, "old moments have none");
});

test("per user: skipped when a creature is unknown, masked when only heard, GM and old data untouched", () => {
  const m = moment({ f1: { u1: "unknown", u2: "heard", u3: "seen" }, h1: { u1: "seen", u2: "seen", u3: "seen" } });
  assert.equal(momentForViewer(m, { userId: "u1", stealth: true }), null);
  assert.equal(momentForViewer(m, { userId: "u3", stealth: true }), m);
  assert.equal(momentForViewer(m, { userId: "u1", gm: true, stealth: true }), m);
  assert.equal(momentForViewer(m, { userId: "u1", stealth: false }), m, "Movement respects stealth off: as before");
  assert.equal(momentForViewer(m, { userId: "u9", stealth: true }), m, "no data for this user");
  const old = moment(undefined);
  assert.equal(momentForViewer(old, { userId: "u1", stealth: true }), old);

  const masked = momentForViewer(m, { userId: "u2", stealth: true });
  assert.equal(masked.masked, true);
  assert.equal(masked.actor.name, "Hero");
  assert.equal(masked.targets[0].name, UNSEEN_NAME);
  assert.equal(masked.target.name, UNSEEN_NAME);
  for (const k of ["img", "src", "tokenId", "x", "trueName"]) assert.ok(!masked.target[k], k);
  assert.match(captionFor(masked).detail, /vs something unseen/);
  assert.doesNotMatch(JSON.stringify(captionFor(masked)), /Lurker/);
});

test("the reel: a player skips an unknown creature's moment and sees a heard one only as a card", () => {
  const tokens = { h1: { center: { x: 150, y: 150 }, w: 100, h: 100 }, f1: { center: { x: 550, y: 350 }, w: 100, h: 100 } };
  const look = (id) => tokens[id] ?? null;
  const args = { tokens: look, view: { x: 0, y: 0, scale: 1 }, screen: { w: 1920, h: 1080 }, maxZoom: 3 };
  const m = moment({ f1: { u1: "unknown", u2: "heard" } });
  assert.equal(planReel({ moments: [m], viewer: { sceneId: "s1", quality: "full", userId: "u1", stealth: true }, ...args }), null);
  const plan = planReel({ moments: [m], viewer: { sceneId: "s1", quality: "full", userId: "u2", stealth: true }, ...args });
  assert.equal(plan.steps[0].mode, "card");
  assert.equal(plan.steps[0].caption.targetImg, "");
  assert.equal(plan.steps[0].caption.img, "Hero.webp", "the seen attacker still shows");
  assert.deepEqual(plan.steps[0].ghosts, []);
  assert.doesNotMatch(JSON.stringify(plan), /Lurker/);
  const gm = planReel({ moments: [m], viewer: { sceneId: "s1", quality: "full", gm: true, userId: "g", stealth: true }, ...args });
  assert.equal(gm.steps[0].mode, "replay");
  const off = planReel({ moments: [m], viewer: { sceneId: "s1", quality: "full", userId: "u1", stealth: false }, ...args });
  assert.equal(off.steps[0].mode, "replay");
});
