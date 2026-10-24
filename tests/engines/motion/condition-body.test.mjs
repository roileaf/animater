import test from "node:test";
import assert from "node:assert/strict";
import { ConditionBody, bodyTreatment, bodyPose, shownTreatment, BODY_PRIORITY } from "../../../scripts/engines/motion/condition-body.mjs";

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

test('prone does not adopt a temporary action rotation as its upright baseline',()=>{
 const {body,step}=runner(),t=token();t.document={rotation:0};
 body.add('prone',t,'prone');step(500);
 t.mesh.rotation=Math.PI/2; // Another action animation writes a quarter turn while prone.
 step(16);
 assert.ok(Math.abs(t.mesh.rotation-80*Math.PI/180)<1e-9,'one prone turn, not 170 degrees');
 body.remove('prone');step(500);
 assert.equal(t.mesh.rotation,0,'stands upright after the condition is removed');
});

test('a genuine document rotation while prone becomes the new upright direction',()=>{
 const {body,step}=runner(),t=token();t.document={rotation:0};
 body.add('prone',t,'prone');step(500);
 t.document.rotation=45;t.mesh.rotation=Math.PI/4;step(16);
 body.remove('prone');step(500);
 assert.equal(t.mesh.rotation,Math.PI/4);
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

test("a body treatment that moves the token says so; stone and stillness do not", () => {
  const { body } = runner();
  const frightened = token(), stone = token(), free = token();
  body.add("Frightened", frightened, "tremble");
  body.add("Petrified", stone, "stone");
  assert.equal(body.moves(frightened), true);
  assert.equal(body.moves(stone), false);
  assert.equal(body.moves(free), false);
  body.remove("Frightened");
  assert.equal(body.moves(frightened), false);
});

test("idle life: breathing pulses about 2.5% and hovering bobs about 5% of the token height (visible at table zoom)", () => {
  let lo = 1, hi = 0, top = 0, bottom = 0;
  for (let t = 0; t < 6; t += 0.05) {
    const b = bodyPose("idle-breathe", t, 1, { period: 4 }).sy;
    lo = Math.min(lo, b); hi = Math.max(hi, b);
    const h = bodyPose("idle-hover", t).yh;
    top = Math.min(top, h); bottom = Math.max(bottom, h);
  }
  assert.ok(hi <= 1 && lo >= 0.97 && lo < 0.98, `breath ${lo}..${hi}`);
  assert.ok(top <= -0.049 && bottom >= 0.049 && bottom <= 0.051, `hover ${top}..${bottom}`);
  // A stronger setting scales it.
  assert.ok(bodyPose("idle-breathe", 2, 2, { period: 4 }).sy < bodyPose("idle-breathe", 2, 1, { period: 4 }).sy);
  assert.ok(Math.abs(bodyPose("idle-hover", 0.3).yh - bodyPose("idle-hover", 2.7).yh) < 1e-9, "bobs over 2.4 s");
});

test("idle life kinds are the lowest priority: any condition treatment wins", () => {
  assert.equal(shownTreatment(["idle-breathe", "sag"]), "sag");
  assert.equal(shownTreatment(["idle-hover", "tremble"]), "tremble");
  assert.equal(shownTreatment(["idle-breathe", "stone"]), null, "stone holds an idle token still");
  assert.equal(shownTreatment(["idle-breathe", "idle-hover"]), "idle-hover");
  assert.ok(BODY_PRIORITY.indexOf("idle-hover") > BODY_PRIORITY.indexOf("sag"));
});

test("idle tokens breathe out of step (phase), hover by their height, and do not claim the token from other motions", () => {
  const { body, step } = runner(), a = token(), b = token(), c = { ...token(), h: 200 };
  body.add("idle:a", a, "idle-breathe", { phase: 0, period: 4 });
  body.add("idle:b", b, "idle-breathe", { phase: 0.5, period: 4 });
  body.add("idle:c", c, "idle-hover", { phase: 0.6 });
  step(16);
  assert.notEqual(a.mesh.scale.y, b.mesh.scale.y, "a different phase is at a different point of its breath");
  assert.ok(Math.abs(c.mesh.position.y - 300) > 5, "hover moves by height");
  assert.equal(body.moves(a), false, "idle does not count as a moving treatment");
  body.remove("idle:a"); body.remove("idle:b"); body.remove("idle:c");
  assert.equal(a.mesh.scale.y, 1); assert.equal(b.mesh.scale.y, 1); assert.equal(c.mesh.position.y, 300);
});

test("wounded: a limp bobs unevenly and tilts on a stride cadence; a hunch leans and squashes a little", () => {
  const dips = [];
  for (let t = 0; t < 1.2; t += 0.01) dips.push(bodyPose("limp", t));
  const ys = dips.map((p) => p.y ?? 0), rs = dips.map((p) => p.r ?? 0);
  const firstStep = Math.max(...ys.slice(0, 55)), secondStep = Math.max(...ys.slice(55, 110));
  assert.ok(firstStep > 0 && secondStep > 0, "bobs on both steps");
  assert.ok(Math.abs(firstStep - secondStep) > 0.005, "the bad leg dips deeper: uneven");
  assert.ok(Math.max(...rs) > 2, "tilts toward the bad side");
  assert.ok(Math.max(...ys) < 0.06, "subtle");
  const h = bodyPose("hunch", 1);
  assert.ok(h.r > 0 && h.r < 6, "leans slightly");
  assert.ok(h.sy < 1 && h.sy > 0.94, "squashes slightly");
});

test("wounded kinds rank above idle life and below every condition treatment; a hunch does not claim the token", () => {
  assert.ok(BODY_PRIORITY.indexOf("limp") > BODY_PRIORITY.indexOf("sag"));
  assert.ok(BODY_PRIORITY.indexOf("hunch") > BODY_PRIORITY.indexOf("sag"));
  assert.ok(BODY_PRIORITY.indexOf("hunch") < BODY_PRIORITY.indexOf("idle-hover"));
  assert.ok(BODY_PRIORITY.indexOf("limp") < BODY_PRIORITY.indexOf("idle-hover"));
  assert.equal(shownTreatment(["idle-breathe", "hunch"]), "hunch");
  assert.equal(shownTreatment(["limp", "tremble"]), "tremble");
  assert.equal(shownTreatment(["hunch", "limp"]), "limp", "moving: the limp wins");
  const { body, step } = runner(), t = token();
  body.add("w", t, "hunch");
  step(500);
  assert.notEqual(t.mesh.rotation, 0, "hunched");
  assert.equal(body.moves(t), false, "a hunch is a pose, not a motion");
  body.remove("w");
  assert.deepEqual([t.mesh.rotation, t.mesh.scale.y], [0, 1]);
});
