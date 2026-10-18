import test from "node:test";
import assert from "node:assert/strict";
import { planFinisher, playFinisher, previewFinisher, seekWall } from "../../scripts/engines/finishers/finisher-play.mjs";
import { wallDistance } from "../../scripts/engines/motion/displacement.mjs";
import { normalizeFinisher } from "../../scripts/core/model.mjs";

// Wall slam seeks the nearest wall within reach, in the half facing away from the attacker.
const kf = (at, x = 0, y = 0) => ({ at, x, y, rotation: 0, scale: 1, alpha: 1, ease: "linear", sharp: false });
const keyframes = [kf(0), kf(1, 6, 0)];
const slamRecipe = (wall = "slam") => ({ id: "s", name: "Wall slam", trigger: "manual", finisher: normalizeFinisher({ knockback: 5, wall }), stages: [
  { stageId: "fly", kind: "motion", motion: "path", subject: "targets", motionEnd: "hold", duration: 1000, delay: 100, keyframes },
  { stageId: "wall-crack", kind: "impact", assets: ["jb2a.impact.005.white"], delay: 1100, duration: 1500 },
  { stageId: "wall-shake", kind: "motion", motion: "shake", subject: "targets", assets: [], delay: 1100, duration: 500 },
  { stageId: "landing", kind: "impact", assets: ["jb2a.impact.003.white"], delay: 1100, duration: 1200 },
] });
const at = (name, x, y) => ({ name, center: { x: x + 50, y: y + 50 }, document: { x, y } });
const deg = (d) => ({ x: Math.cos((d * Math.PI) / 180), y: Math.sin((d * Math.PI) / 180) });
const angleOf = (d) => (Math.atan2(d.y, d.x) * 180) / Math.PI;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// Walls as { angle (degrees, world), squares }: a direction at that angle hits it `squares` out
// and lands there; any other direction walks its full reach. Both lie along the direction itself.
const wallHost = (walls = [], { seeks = true } = {}) => {
  const log = [];
  const hit = (d, squares) => {
    const w = walls.find((wall) => near(((angleOf(d) - wall.angle + 540) % 360) - 180, 0));
    return w && w.squares < squares ? w.squares : null;
  };
  const host = { log, gridSize: () => 100,
    landing: (m, d, squares) => { const steps = hit(d, squares) ?? squares; return { x: m.document.x + d.x * steps * 100, y: m.document.y + d.y * steps * 100 }; },
    play: async (r) => { log.push(["stages", r.stages]); return r.stages.map((s) => ({ ...s, delay: s.delay ?? 0 })); },
    wait: async () => {}, fade: async () => {},
    commit: async (_t, data) => log.push(["commit", data]), trace: (s, d) => log.push([s, d]) };
  if (seeks) host.wallHit = (m, d, squares) => { log.push(["probe", angleOf(d)]); return hit(d, squares); };
  return host;
};
const mover = () => at("Orc", 100, 100), attacker = () => at("Hero", 0, 100); // away = +x
const plan = (host, recipe = slamRecipe(), extra = {}) => planFinisher({ recipe, mover: mover(), attacker: attacker(), dead: false, ...extra }, host);
const byId = (stages, id) => stages.find((s) => s.stageId === id);

test("seekWall samples 25 directions from -90° to +90° around away, 0° included", () => {
  const seen = [];
  assert.equal(seekWall({ x: 1, y: 0 }, (d) => { seen.push(Math.round(angleOf(d) * 1000) / 1000); return null; }, { reach: 6 }), null);
  assert.equal(seen.length, 25);
  assert.equal(seen[0], 0, "straight away is tried first");
  assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => -90 + 7.5 * i));
});

test("seekWall picks the nearest wall within reach; a tie goes to the direction closest to away", () => {
  const walls = (list) => (d) => list.find(([a]) => near(angleOf(d), a))?.[1] ?? null;
  assert.ok(near(angleOf(seekWall({ x: 1, y: 0 }, walls([[0, 5], [60, 2]]), { reach: 6 }).aim), 60));
  assert.ok(near(angleOf(seekWall({ x: 1, y: 0 }, walls([[0, 4], [30, 4]]), { reach: 6 }).aim), 0));
  assert.ok(near(angleOf(seekWall({ x: 1, y: 0 }, walls([[-45, 3], [30, 3]]), { reach: 6 }).aim), 30));
  assert.equal(seekWall({ x: 1, y: 0 }, walls([[30, 7]]), { reach: 6 }), null, "out of reach");
  assert.ok(near(angleOf(seekWall(deg(90), walls([[135, 2]]), { reach: 6 }).aim), 135), "turns around any away aim");
});

test("a wall 3 squares to the side and none straight away: the aim turns to it, the slam cuts at 3 and crashes there", async () => {
  const host = wallHost([{ angle: 90, squares: 3 }]);
  await playFinisher({ recipe: slamRecipe(), mover: mover(), attacker: attacker(), dead: false }, host);
  const stages = host.log.find((e) => e[0] === "stages")[1], fly = byId(stages, "fly"), { cos, sin, k } = fly.motionFrame;
  assert.ok(near(cos, 0) && near(sin, 1), "aimed to the side");
  const last = fly.keyframes.at(-1);
  assert.ok(near(Math.hypot(last.x, last.y) * k, 3, 0.01), "cut at 3 squares");
  assert.ok(Math.abs(fly.duration - 500) <= 2, `cut at full speed: ${fly.duration}`);
  const commit = host.log.find((e) => e[0] === "commit")[1];
  assert.ok(near(commit.x, 100) && near(commit.y, 400), "lands against the wall, along the aim");
  const crack = byId(stages, "wall-crack");
  assert.ok(near(crack.offsetX, 0) && near(crack.offsetY, 3.6), "the crash plays at the wall");
  assert.ok(byId(stages, "wall-shake"));
  assert.equal(byId(stages, "landing"), undefined);
});

test("a wall 5 squares straight away and another 2 squares out at 60°: the 60° one wins", () => {
  const host = wallHost([{ angle: 0, squares: 5 }, { angle: 60, squares: 2 }]);
  const { to, composed } = plan(host);
  assert.ok(near(to.x, 100 + 200 * Math.cos(Math.PI / 3)) && near(to.y, 100 + 200 * Math.sin(Math.PI / 3)));
  const crack = byId(composed.stages, "wall-crack");
  assert.ok(near(crack.offsetX, 2.6 * 0.5) && near(crack.offsetY, 2.6 * Math.sin(Math.PI / 3)));
});

test("a wall only behind the attacker is outside the cone: no seek, the straight shove", () => {
  const host = wallHost([{ angle: 180, squares: 1 }]);
  const { to, composed } = plan(host);
  assert.ok(host.log.filter((e) => e[0] === "probe").every(([, a]) => Math.abs(a) <= 90 + 1e-9), "never probes back toward the attacker");
  assert.deepEqual(to, { x: 700, y: 100 });
  assert.ok(!composed.stages.some((s) => s.stageId.startsWith("wall")));
});

test("no walls: the straight shove, composed exactly as before", () => {
  const seeking = plan(wallHost()), before = plan(wallHost([], { seeks: false }));
  assert.deepEqual(seeking.composed, before.composed);
  assert.deepEqual(seeking.to, { x: 700, y: 100 });
});

test("a tie between straight away and 30°: straight away wins", () => {
  const { to } = plan(wallHost([{ angle: 0, squares: 4 }, { angle: 30, squares: 4 }]));
  assert.deepEqual(to, { x: 500, y: 100 });
});

test("no attacker: the mover's facing is the away direction of the cone", () => {
  const host = wallHost([{ angle: 135, squares: 2 }, { angle: -60, squares: 3 }]);
  const turned = { ...mover(), document: { x: 100, y: 100, rotation: 90 } };
  const { to } = planFinisher({ recipe: slamRecipe(), mover: turned, attacker: null, dead: false }, host);
  assert.ok(near(to.x, 100 - 200 * Math.SQRT1_2) && near(to.y, 100 + 200 * Math.SQRT1_2), "135° is within 90° of facing 90°; -60° is not");
});

test("other finishers do not seek: fit mode and a knockback shove", () => {
  const fit = wallHost([{ angle: 90, squares: 3 }]);
  assert.deepEqual(plan(fit, slamRecipe("fit")).to, { x: 700, y: 100 });
  assert.ok(!fit.log.some((e) => e[0] === "probe"));
  const shove = wallHost([{ angle: 90, squares: 1 }]);
  const knock = { id: "k", name: "Slice", trigger: "manual", finisher: normalizeFinisher({ knockback: 2, wall: "slam" }), stages: [{ stageId: "cut", kind: "impact", subject: "targets", assets: [] }] };
  assert.deepEqual(plan(shove, knock).to, { x: 300, y: 100 });
  assert.ok(!shove.log.some((e) => e[0] === "probe"));
});

test("a studio test play of Wall slam flies to the nearest wall too", async () => {
  const host = wallHost([{ angle: -90, squares: 2 }]), plays = [];
  await previewFinisher(slamRecipe(), { source: attacker(), targets: [mover()] }, host, async (composed) => { plays.push(composed); return true; });
  const fly = byId(plays[0].stages, "fly");
  assert.ok(near(fly.motionFrame.cos, 0) && near(fly.motionFrame.sin, -1));
  assert.ok(byId(plays[0].stages, "wall-crack"));
});

test("wallDistance walks the landing's steps: the middle of the first blocked step, null at the edge or with no wall", () => {
  const base = { from: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, squares: 6, grid: 100, size: { w: 100, h: 100 } };
  assert.equal(wallDistance({ ...base, collides: (a, b) => a.x < 375 && b.x > 375 }), 3.5);
  assert.equal(wallDistance(base), null);
  assert.equal(wallDistance({ ...base, bounds: { x: 0, y: 0, width: 300, height: 1000 } }), null, "the scene edge is not a wall");
  assert.equal(wallDistance({ ...base, squares: 2, collides: (a, b) => a.x < 375 && b.x > 375 }), null, "beyond reach");
});

// The scene edge stops the landing but is not a wall: with no Wall in reach the path shrinks to
// fit the landing (no cut, no crash), as "Stop short smoothly" would.
test("the scene edge is not a wall: a slam path that stops at the edge shrinks to fit instead of crashing", () => {
  const edge = { ...wallHost(), landing: (m, d, squares) => { const steps = Math.min(squares, 3); return { x: m.document.x + d.x * steps * 100, y: m.document.y + d.y * steps * 100 }; } };
  const { composed, to } = plan(edge);
  assert.deepEqual(to, { x: 400, y: 100 }, "still stops at the edge");
  assert.ok(!composed.stages.some((s) => s.stageId.startsWith("wall")), "no crash at the edge");
  assert.ok(byId(composed.stages, "landing"), "lands there instead");
  const fly = byId(composed.stages, "fly");
  assert.equal(fly.duration, 1000, "the path is not cut");
  assert.ok(near(fly.motionFrame.k, 0.5), "it shrinks to the 3 squares it can go");
  const fit = plan(edge, slamRecipe("fit")).composed;
  assert.deepEqual(composed.stages, fit.stages, "composed exactly as Stop short smoothly");
});

test("a real wall short of the edge still slams", () => {
  const { composed } = plan(wallHost([{ angle: 0, squares: 3 }]));
  assert.ok(byId(composed.stages, "wall-crack"), "crash at the wall");
  assert.ok(byId(composed.stages, "fly").duration < 1000, "cut at the wall");
});
