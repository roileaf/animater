import test from "node:test";
import assert from "node:assert/strict";
import { ConditionBody, bodyTreatment, bodyPose, shownTreatment } from "../scripts/condition-body.mjs";

const token = () => ({ w: 100, mesh: { position: { x: 500, y: 300 }, rotation: 0, scale: { x: 1, y: 1 }, filters: null } });
function runner(extra = {}) {
  let time = 0, queued = null;
  const body = new ConditionBody({ now: () => time, frame: (cb) => (queued = cb, 1), cancel: () => (queued = null), tokenFx: () => null, ...extra });
  return { body, step: (ms) => { time += ms; const cb = queued; queued = null; cb?.(); } };
}

test("condition names map to body treatments across systems", () => {
  assert.equal(bodyTreatment("Frightened"), "tremble");
  assert.equal(bodyTreatment("Frightened 3"), "tremble");
  assert.equal(bodyTreatment("Petrified"), "stone");
  assert.equal(bodyTreatment("Grabbed"), "struggle");
  assert.equal(bodyTreatment("Heavily Encumbered"), "sag");
  assert.equal(bodyTreatment("Half Cover"), null);
  assert.ok(Math.abs(bodyPose("tremble", 0.03).x) > 0);
});

test("a treatment moves the sprite and removal restores it exactly", () => {
  const { body, step } = runner(), t = token();
  body.add("s1", t, "sway");
  step(650);
  assert.notEqual(t.mesh.rotation, 0, "sways");
  body.remove("s1");
  assert.deepEqual([t.mesh.position.x, t.mesh.position.y, t.mesh.rotation, t.mesh.scale.y], [500, 300, 0, 1]);
});

test("Foundry refreshing the token mid-treatment is respected, not undone", () => {
  const { body, step } = runner(), t = token();
  body.add("s1", t, "tremble");
  step(30);
  t.mesh.position.x = 800; // token moved: Foundry set a new natural position
  step(30);
  body.remove("s1");
  assert.equal(Math.round(t.mesh.position.x), 800);
});

test("one-off motions take priority and petrified drains colour without moving", () => {
  let busy = false;
  const { body, step } = runner({ busy: () => busy }), t = token();
  body.add("s1", t, "wobble");
  busy = true; step(400);
  assert.equal(t.mesh.rotation, 0, "steps aside during an attack motion");
  const stone = { ...token(), mesh: { ...token().mesh, tint: 0xffffff } };
  body.add("s2", stone, "stone");
  step(400);
  assert.equal(stone.mesh.tint, 0xa39e94, "without the FX engine the sprite is tinted stone grey");
  assert.deepEqual([stone.mesh.position.x, stone.mesh.rotation], [500, 0]);
  body.remove("s2");
  assert.equal(stone.mesh.tint, 0xffffff);
});

test("petrified uses the engine's local desaturating filter, kept even with decorative FX off", () => {
  const calls = [];
  const tokenFx = () => ({ apply: (token, preset, opts) => { calls.push(["add", preset.params[0].filterType, preset.params[0].saturation, opts.always]); return () => calls.push(["remove"]); } });
  const { body } = runner({ tokenFx }), t = token();
  body.add("s3", t, "stone");
  assert.equal(t.mesh.tint, undefined, "no grey tint when the filter is on");
  body.remove("s3");
  assert.deepEqual(calls, [["add", "adjustment", 0.08, true], ["remove"]]);
});

test("two conditions on one token share a pose instead of compounding (PF2e Dying + Unconscious)", () => {
  const { body, step } = runner(), t = token();
  body.add("dying", t, "breathe");
  body.add("unconscious", t, "breathe");
  for (let i = 0; i < 2000; i++) step(16);
  assert.ok(t.mesh.scale.y > 0.95 && t.mesh.scale.y <= 1, `scale stays a breath, got ${t.mesh.scale.y}`);
  body.remove("dying");
  for (let i = 0; i < 50; i++) step(16);
  assert.ok(t.mesh.scale.y > 0.95);
  body.remove("unconscious");
  assert.equal(t.mesh.scale.y, 1);
  assert.deepEqual(t.mesh.position, { x: 500, y: 300 });
});

test("several conditions: the token shows the most telling one, stone and stillness freeze it", () => {
  assert.equal(shownTreatment(["tremble", "struggle"]), "struggle", "a grapple outweighs fear");
  assert.equal(shownTreatment(["tremble", "breathe"]), "breathe", "unconscious and frightened only breathes");
  assert.equal(shownTreatment(["sway", "stone"]), null, "petrified does not sway");
  assert.equal(shownTreatment(["sway", "still"]), null, "paralyzed does not sway");
  assert.equal(shownTreatment(["sag", "search"]), "search");
  assert.equal(shownTreatment([]), null);
  // Frightened then Restrained: struggles; once free, trembles again.
  const { body, step } = runner(), t = token();
  body.add("frightened", t, "tremble");
  body.add("restrained", t, "struggle");
  step(16); step(400);
  assert.equal(body.poses.size, 1);
  body.add("paralyzed", t, "still");
  step(16);
  assert.deepEqual(t.mesh.position, { x: 500, y: 300 }, "held still in its natural pose");
  assert.equal(t.mesh.rotation, 0);
  body.remove("paralyzed"); body.remove("restrained");
  step(16); step(30);
  assert.notEqual(t.mesh.position.x, 500, "trembling again");
  body.clear();
  assert.deepEqual(t.mesh.position, { x: 500, y: 300 });
});

test("D&D, PF2e and SF2e condition names share the treatments", () => {
  for (const [name, kind] of [["Dead", "still"], ["Stable", "breathe"], ["Dehydration", "sag"], ["Slowed 1", "sag"], ["Controlled", "sway"], ["Glitching 2", "tremble"], ["Untethered", "sway"], ["Dying 3", "breathe"]])
    assert.equal(bodyTreatment(name), kind, name);
});

test("prone tips the token onto its side and outranks the breathing of Unconscious", () => {
  assert.equal(bodyTreatment("Prone"), "prone");
  assert.equal(bodyPose("prone", 0).r, 0, "it falls over smoothly");
  assert.equal(bodyPose("prone", 1).r, 80);
  assert.equal(shownTreatment(["breathe", "prone"]), "prone");
  assert.equal(shownTreatment(["prone", "still"]), null, "the dead stay as they are");
});

test("a prone token falls over, then stands back up smoothly when it ends", () => {
  const { body, step } = runner(), t = token();
  body.add("p", t, "prone");
  step(1000);
  assert.ok(Math.abs(t.mesh.rotation - (80 * Math.PI) / 180) < 1e-9, "lying on its side");
  body.remove("p");
  step(200);
  const mid = t.mesh.rotation;
  assert.ok(mid > 0 && mid < (80 * Math.PI) / 180, "rising, not snapped upright");
  step(250);
  assert.deepEqual([t.mesh.rotation, t.mesh.position.y, t.mesh.scale.y], [0, 300, 1], "upright again exactly");
  assert.equal(body.records.size, 0);
});
