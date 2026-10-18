import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFragments, fragmentPieces, fragmentFlight, fragmentPose, FRAGMENT_BEHAVIORS } from "../../../scripts/engines/fragments/fragments.mjs";
import { fragmentsControlsHTML } from "../../../scripts/ui/fragments-ui.mjs";

const stage = (extra = {}) => ({ kind: "motion", motion: "fragments", duration: 1400, ...normalizeFragments({ seed: 7, ...extra }) });
const onScreen = (p, turn = 0, size = { w: 1, h: 1 }) => {
  const x = p.centroid.x * size.w, y = p.centroid.y * size.h;
  return { x: Math.cos(turn) * x - Math.sin(turn) * y, y: Math.sin(turn) * x + Math.cos(turn) * y };
};
const flights = (s, angle, turn = 0, size) => fragmentPieces(s, angle, turn).map((p, i) => {
  const f = fragmentFlight(s, p, i, angle, turn, size);
  return { p, f, end: fragmentPose(s, p, f, 1), at: (t) => fragmentPose(s, p, f, t) };
});
const NEW = ["flatten", "shudder", "glitch", "sink"];
const PATTERNS = ["halves", "shards", "dust", "rings", "ribbons", "perforate", "slashes", "crush", "lightning"];

test("the damage behaviours are registered and validated; burst stays unstored", () => {
  assert.deepEqual(Object.fromEntries(NEW.map((k) => [k, FRAGMENT_BEHAVIORS[k]])), { flatten: "Crushed flat", shudder: "Shudder apart", glitch: "Glitch out", sink: "Sink and fade" });
  for (const behavior of NEW) assert.equal(normalizeFragments({ behavior }).behavior, behavior);
  assert.equal("behavior" in normalizeFragments({ behavior: "flattened" }), false);
});

test("every pose carries stretchX, 1 unless a behaviour squashes", () => {
  for (const pattern of PATTERNS) for (const { at } of flights(stage({ pattern }), 0.4)) for (const t of [0, 0.5, 1]) assert.equal(at(t).stretchX, 1, pattern);
  for (const { at } of flights(stage({ pattern: "shards", behavior: "drip" }), 0.4)) assert.equal(at(1).stretchX, 1, "drip only stretches down");
});

test("flatten: squashed to 0.35 high and 1.15 wide by a quarter, then skidding low across the floor", () => {
  for (const pattern of ["crush", "shards", "dust"]) {
    const s = stage({ pattern, behavior: "flatten", spread: 0.8 });
    for (const { p, at, end } of flights(s, 0.4)) {
      assert.equal(at(0).stretchY, 1);
      assert.ok(at(0.25).stretchY <= 0.4 && Math.abs(at(0.25).stretchX - 1.15) < 1e-9, `${pattern}: ${at(0.25).stretchY}`);
      assert.ok(end.stretchY <= 0.4 && Math.abs(end.stretchX - 1.15) < 1e-9);
      const y = onScreen(p).y + end.y;
      assert.ok(y >= 0.15 - 1e-9 && y <= 0.5 + 1e-9, `${pattern}: ends at ${y}, near the bottom`);
      assert.ok(Math.abs(end.y - at(0.25).y) < 1e-9, "the skid stays on the floor");
    }
    assert.ok(flights(s, 0.4).some(({ end, at }) => Math.abs(end.x - at(0.25).x) >= 0.4), `${pattern}: skids out by the spread`);
  }
});

// Review focus: a turned or non-square token squashes onto its own bottom on screen.
test("flatten on a turned, wide token lands on the art's bottom on screen", () => {
  for (const [turn, size] of [[Math.PI / 2, { w: 2, h: 1 }], [0.6, { w: 1, h: 2 }], [0, { w: 2, h: 1 }]]) {
    const floor = (Math.abs(Math.cos(turn)) * size.h + Math.abs(Math.sin(turn)) * size.w) / 2;
    for (const { p, end } of flights(stage({ pattern: "diced", pieces: 3, behavior: "flatten" }), 0.4, turn, size)) {
      const y = onScreen(p, turn, size).y + end.y;
      assert.ok(y <= floor + 1e-9 && y >= floor * 0.3 - 1e-9, `turn ${turn} ${JSON.stringify(size)}: ${y} vs floor ${floor}`);
      for (const v of [end.x, end.y, end.rotation]) assert.ok(Number.isFinite(v));
    }
  }
});

test("shudder: the whole token shakes in place for 35%, then bursts with the pattern's own flight", () => {
  for (const pattern of ["halves", "rings", "lightning", "shards"]) {
    const s = stage({ pattern, behavior: "shudder", spread: 1 }), all = flights(s, 0.4), burst = flights(stage({ pattern, spread: 1 }), 0.4);
    let moved = false;
    for (let i = 0; i < 35; i++) {
      const t = i / 100, poses = all.map(({ at }) => at(t));
      for (const pose of poses) {
        assert.ok(Math.abs(pose.x) <= 0.05 && Math.abs(pose.y) <= 0.05, `${pattern} t${t}: ${pose.x}, ${pose.y}`);
        assert.ok(Math.abs(pose.x - poses[0].x) < 1e-12 && Math.abs(pose.y - poses[0].y) < 1e-12, `${pattern} t${t}: together`);
      }
      moved ||= Math.abs(poses[0].x) > 0.005;
    }
    assert.ok(moved, `${pattern}: it shakes`);
    all.forEach(({ end }, i) => {
      assert.ok(Math.abs(end.x - burst[i].end.x) < 1e-9 && Math.abs(end.y - burst[i].end.y) < 1e-9, `${pattern} #${i}: ends where its burst ends`);
      assert.ok(Math.hypot(end.x, end.y) > 0.1, `${pattern} #${i}: travels`);
    });
  }
});

test("glitch: snapped offsets held between 6-8 seeded moments, blinking, each piece gone at its own time", () => {
  const s = stage({ pattern: "pixelate", pieces: 25, behavior: "glitch" }), all = flights(s, 0);
  for (const { f, at } of all) {
    assert.ok(f.steps.length >= 7 && f.steps.length <= 9, `${f.steps.length} steps`);
    assert.equal(at(0).x, 0);
    assert.equal(at(0).alpha, 1);
    f.steps.forEach((k, i) => {
      assert.ok(Math.abs(k.x) <= 0.15 && Math.abs(k.y) <= 0.15);
      assert.ok([1, 0.3, 0].includes(k.alpha));
      const next = f.steps[i + 1]?.at ?? 1;
      if (next - k.at > 2e-6) assert.deepEqual(at(k.at + 1e-6), at(next - 1e-6), "held until the next moment");
    });
    assert.equal(at(1).alpha, 0);
    assert.equal(f.steps.at(-1).alpha, 0);
  }
  assert.ok(new Set(all.map(({ f }) => f.end.toFixed(6))).size > 5, "each piece ends at its own time");
  assert.deepEqual(flights(s, 0).map(({ f }) => f), all.map(({ f }) => f), "deterministic");
});

test("sink: down 0.3, pulled inward, shrinking to 0.85, fading over the last half", () => {
  for (const { p, end, at } of flights(stage({ pattern: "dust", pieces: 36, behavior: "sink" }), 0)) {
    assert.ok(Math.abs(end.y - 0.3) < 1e-9);
    assert.ok(end.x * p.centroid.x <= 1e-12, "inward");
    assert.ok(Math.abs(end.scale - 0.85) < 1e-9);
    assert.equal(at(0.5).alpha, 1);
    assert.ok(at(0.75).alpha > 0 && at(0.75).alpha < 1);
    assert.equal(end.alpha, 0);
  }
});

test("the damage behaviours are deterministic per seed", () => {
  for (const behavior of NEW) {
    const s = stage({ pattern: "shards", behavior }), [p] = fragmentPieces(s, 0.3);
    assert.deepEqual(fragmentFlight(s, p, 0, 0.3, 0.2), fragmentFlight(s, p, 0, 0.3, 0.2), behavior);
  }
});

test("the older behaviours still work on the damage patterns", () => {
  for (const pattern of ["perforate", "slashes", "crush", "lightning"]) for (const { p, end } of flights(stage({ pattern, behavior: "implode" }), 0.4)) {
    const c = onScreen(p);
    assert.ok(Math.hypot(c.x + end.x, c.y + end.y) < 0.05, pattern);
  }
});

test("each damage pattern's own burst", () => {
  const a = 0.4, d = { x: Math.cos(a), y: Math.sin(a) };
  const holes = flights(stage({ pattern: "perforate", pieces: 5, spread: 1 }), a);
  for (const { end } of holes) {
    const off = Math.atan2(end.y, end.x) - a, wrapped = Math.atan2(Math.sin(off), Math.cos(off));
    assert.ok(Math.abs(wrapped) <= (35 * Math.PI) / 180 + 1e-6, `perforate flies within the cone: ${wrapped}`);
  }
  const along = ({ p }) => p.centroid.x * d.x + p.centroid.y * d.y;
  const far = holes.filter((h) => along(h) > 0.2), near = holes.filter((h) => along(h) < -0.2);
  assert.ok(far.length && near.length && Math.max(...far.map((h) => h.f.start)) < Math.min(...near.map((h) => h.f.start)), "the far side leaves first");

  const strips = flights(stage({ pattern: "slashes", pieces: 4, spread: 1 }), 0);
  const slide = strips.map(({ end }) => end.x);
  slide.forEach((x, i) => assert.equal(Math.sign(x), i % 2 ? 1 : -1, `strip ${i} slides its own way`));
  const byHeight = [...strips].sort((u, v) => u.p.centroid.y - v.p.centroid.y);
  assert.ok(Math.abs(byHeight[0].end.x) > Math.abs(byHeight.at(-1).end.x), "the top strip slides farthest");

  const web = flights(stage({ pattern: "crush", pieces: 3, spread: 1 }), 0.4);
  for (const { p, end } of web) {
    if (p.ring === 0) assert.ok(Math.abs(end.x) < 1e-9 && end.y > 0 && end.scale < 1, "the inner ring stays and sinks");
    else assert.ok(end.y > 0 && Math.hypot(end.x, end.y) > 0.3, "outer rings scatter low");
  }

  const bolt = flights(stage({ pattern: "lightning", spread: 1 }), a), n = { x: -Math.sin(a), y: Math.cos(a) };
  for (const g of [0, 1]) {
    const ends = bolt.filter(({ p }) => p.group === g).map(({ end }) => end);
    assert.ok(ends.every((e) => Math.abs(e.x - ends[0].x) < 1e-12 && Math.abs(e.y - ends[0].y) < 1e-12 && e.rotation === 0), `group ${g} moves as one`);
    assert.ok((ends[0].x * n.x + ends[0].y * n.y) * (g ? 1 : -1) > 0.4, `group ${g} jerks away from the bolt`);
  }
  const path = bolt[0].f.keyframes;
  assert.ok(path.filter((k) => k.sharp).length >= 3, "two quick kinks before it settles");
});

test("the studio offers the damage behaviours with their hints; glitch and sink fade on their own", () => {
  const base = { kind: "motion", motion: "fragments", duration: 1400, pattern: "shards", pieces: 7, seed: 3 };
  const hints = { flatten: "Pieces squash down, then skid low across the floor.", shudder: "It vibrates hard, then bursts.", glitch: "Pieces jitter out of place and blink away.", sink: "Pieces sag into the ground and fade." };
  for (const [behavior, hint] of Object.entries(hints)) {
    const html = fragmentsControlsHTML({ ...base, behavior }, 0);
    assert.match(html, new RegExp(`<option value="${behavior}" selected>${FRAGMENT_BEHAVIORS[behavior]}</option>`));
    assert.ok(html.includes(`<p class="an-hint" data-behavior-hint>${hint}</p>`), behavior);
    assert.equal(/data-field="fade"/.test(html), !["glitch", "sink"].includes(behavior), `${behavior}: Fade field`);
  }
});
