import test from 'node:test';
import assert from 'node:assert/strict';
import { wallRuns, materialOf, wallPainted, wallLook, roomFor, workedFor, alongStretch, DEFAULT_MATERIAL } from '../../../scripts/engines/motion/wall-looks.mjs';
import { wallSeg, offsetSide, offsetClosed, runOutline, subdivide, ragged, runBox, signedArea, joinEnds, smoothRun, paintRunPicture, WALL_MATERIALS, WALL_MATERIAL_CHOICES, WORKED, LIT, LIGHT, litFrom, underLight, tinted, tintedKind } from '../../../scripts/engines/motion/wall-paint.mjs';
import { createPaintedWalls } from '../../../scripts/engines/motion/painted-walls.mjs';

// Roi: "what about underground walls?" — and before that, that the first try looked "super cartoony". Both are
// settled by geometry as much as by colour, so the geometry is what is pinned down here.

// A wall is only painted once it has been drawn with a material, so every wall in these tests carries one.
const wall = (id, x1, y1, x2, y2, extra = {}) => ({ id, c: [x1, y1, x2, y2], move: 1, ...extra, animater: { material: 'dressed', ...(extra.animater ?? {}) } });

// ---------------------------------------------------------------------------------------------------- what is painted

test('a door or a window is a gap in the stone, not a wall to paint', () => {
  assert.equal(wallPainted(wall('a', 0, 0, 100, 0)), true);
  assert.equal(wallPainted(wall('b', 0, 0, 100, 0, { door: 1 })), false);
  assert.equal(wallPainted(wall('c', 0, 0, 100, 0, { door: 2 })), false);
  // Painted as wall as well as a window, the stone was laid over the window.
  assert.equal(wallPainted(wall('d', 0, 0, 100, 0, { animater: { material: 'dressed', window: 'glassWindow' } })), false);
});

test('a run stops at a window and picks up on the other side', () => {
  const runs = wallRuns([
    wall('a', 0, 0, 100, 0),
    wall('b', 100, 0, 200, 0, { animater: { material: 'dressed', window: 'glassWindow' } }),
    wall('c', 200, 0, 300, 0),
  ]);
  assert.equal(runs.length, 2, 'two runs of stone, with the window between them');
  assert.deepEqual(runs.flatMap((r) => r.walls).sort(), ['a', 'c']);
});

test("nothing a map came with is painted over: no material, no paint", () => {
  assert.equal(wallPainted({ id: 'a', c: [0, 0, 100, 0], move: 1 }), false, 'a plain Foundry wall is left alone');
  assert.equal(wallPainted({ id: 'b', c: [0, 0, 100, 0], animater: { material: '' } }), false);
  assert.equal(wallPainted({ id: 'c', c: [0, 0, 100, 0], animater: { material: 'cheese' } }), false, 'nor a material nobody has heard of');
  assert.equal(wallPainted(wall('d', 0, 0, 100, 0)), true);
});

test('a wall with no length, or no numbers, is left alone', () => {
  assert.equal(wallPainted(wall('a', 50, 50, 50, 50)), false);
  assert.equal(wallPainted(wall('b', 0, 0, Number.NaN, 0)), false);
  assert.equal(wallPainted({ id: 'c' }), false);
});

// ---------------------------------------------------------------------------------------------------- material

test('a wall is painted as what it was drawn with', () => {
  assert.equal(materialOf(wall('a', 0, 0, 1, 0, { animater: { material: 'timber' } })), 'timber');
  assert.equal(materialOf(wall('a', 0, 0, 1, 0)), DEFAULT_MATERIAL);
  assert.equal(materialOf({ animater: { material: 'cheese' } }), DEFAULT_MATERIAL, 'a name nobody has heard of falls back');
  for (const choice of WALL_MATERIAL_CHOICES) assert.ok(WALL_MATERIALS[choice.id], `${choice.id} is offered and exists`);
});

// ---------------------------------------------------------------------------------------------------- runs

test('segments that share an end become one run, walked from a loose end', () => {
  const runs = wallRuns([wall('b', 100, 0, 200, 0), wall('a', 0, 0, 100, 0), wall('c', 200, 0, 200, 100)]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].walls.length, 3);
  assert.deepEqual(runs[0].points[0], [0, 0]);
  assert.deepEqual(runs[0].points.at(-1), [200, 100]);
  assert.equal(runs[0].closed, false);
});

test('two materials never join into one run, however they touch', () => {
  const runs = wallRuns([wall('a', 0, 0, 100, 0), wall('b', 100, 0, 200, 0, { animater: { material: 'timber' } })]);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map((r) => r.material).sort(), ['dressed', 'timber']);
});

// Roi, on an inside wall meeting an outside one: "why inside walls break the coherently of outside walls?" A T used
// to end everybody's run, so the outside wall became two stretches of stone with their own outlines, ink and texture,
// and the join showed. The wall that runs straight through carries on; only the wall built against it starts afresh.
test('a wall carries straight through a T, and the wall built against it is its own run', () => {
  const runs = wallRuns([wall('a', 0, 0, 100, 0), wall('b', 100, 0, 200, 0), wall('c', 100, 0, 100, 100)]);
  assert.equal(runs.length, 2, 'the wall that goes through, and the branch');
  const through = runs.find((r) => r.walls.length === 2);
  assert.deepEqual(through.walls.slice().sort(), ['a', 'b'], 'the outside wall is one unit, partition or no partition');
  assert.deepEqual(runs.find((r) => r.walls.length === 1).walls, ['c'], 'the inside wall on its own');
});

test('a corner is still one run, and a T that turns on both sides is not', () => {
  const corner = wallRuns([wall('a', 0, 0, 100, 0), wall('b', 100, 0, 100, 100)]);
  assert.equal(corner.length, 1, 'two walls meeting is a corner, whatever the angle');
  // Three arms and no two of them in line: nothing carries through, so each is its own.
  const star = wallRuns([wall('a', 100, 100, 0, 0), wall('b', 100, 100, 200, 0), wall('c', 100, 100, 100, 200)]);
  assert.equal(star.length, 3, 'nothing to carry through');
});

test('a ring has no loose end, and is still painted once', () => {
  const runs = wallRuns([wall('a', 0, 0, 100, 0), wall('b', 100, 0, 100, 100), wall('c', 100, 100, 0, 100), wall('d', 0, 100, 0, 0)]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].closed, true);
  assert.equal(runs[0].walls.length, 4);
  // A ring arrives back where it began, so its last point is its first: that is how the painter knows it is a ring
  // (Roi, looking at one: "when walls come full circle it doesnt look coherent").
  assert.equal(runs[0].points.length, 5, 'four corners and back to the first');
  assert.deepEqual(runs[0].points.at(-1), runs[0].points[0]);
});

test('a ring is mitred where it closes, like every other corner', () => {
  const segs = [wallSeg([0, 0], [200, 0]), wallSeg([200, 0], [200, 200]), wallSeg([200, 200], [0, 200]), wallSeg([0, 200], [0, 0])];
  const open = offsetSide(segs, 20, 1), ring = offsetSide(segs, 20, 1, true);
  assert.equal(ring.length, 5, 'a ring has one point per corner, and comes back to the first to close itself');
  assert.deepEqual(ring[4], ring[0], 'which is the first corner over again');
  assert.equal(open.length, 5, 'an open run has one per corner and one for its far end');
  // Every corner of a square turns 90 degrees, so a mitred one lies half the wall out along the diagonal.
  const want = 20 * Math.SQRT2;
  for (const [i, corner] of [[0, [0, 0]], [1, [200, 0]], [2, [200, 200]], [3, [0, 200]]]) {
    const p = ring[i];
    assert.ok(Math.abs(Math.hypot(p[0] - corner[0], p[1] - corner[1]) - want) < 1e-9, `corner ${i} is mitred, not butted`);
  }
  // Walked as though it were open, the closing corner was not: that is the seam that showed.
  assert.ok(Math.abs(Math.hypot(open[0][0], open[0][1]) - want) > 1, 'the open walk butts where the ring joins');
});

test('a room is walled all the way round, wherever the ring happens to start', () => {
  // Roi: "making a rectangle of a room\house still leaves an opening on it's own". A ring is walked from whichever
  // wall it was found at, so its seam can land in the middle of a straight run — and there the missing last edge
  // showed as a hole a whole segment wide. Walked from a corner the mitre hid it, which is why it came and went.
  const corners = [[0, 0], [600, 0], [600, 500], [0, 500]];
  const ringFrom = (start) => {
    const pts = [];
    for (let i = 0; i <= 4; i++) pts.push(corners[(start + i) % 4]);
    return pts;
  };
  // Seam in the middle of the top wall: the same ring, begun half way along it.
  const midWall = [[300, 0], [600, 0], [600, 500], [0, 500], [0, 0], [300, 0]];
  for (const [what, points] of [['a corner', ringFrom(0)], ['the middle of a wall', midWall]]) {
    const segs = [];
    for (let i = 0; i < points.length - 1; i++) segs.push(wallSeg(points[i], points[i + 1]));
    const side = offsetSide(segs, 20, 1, true);
    assert.deepEqual(side.at(-1), side[0], `${what}: the side closes on itself`);
    const out = runOutline(segs, 20, true);
    // Every edge of the room must appear in the outline. Walk the outer side and check each corner is reached.
    for (const corner of corners) {
      const near = side.some(([x, y]) => Math.hypot(x - corner[0], y - corner[1]) < 40);
      assert.ok(near, `${what}: the outline reaches ${corner.join(',')}`);
    }
    assert.ok(out.length >= side.length * 2, `${what}: both sides are walked`);
  }
});

test('the light comes from where the sun is, not from the top left for ever', () => {
  // Roi: "i noticed the sun doesnt really affect the roof". It did not: everything was lit from one frozen corner
  // whatever the hour, while the floor under it moved with the sun all day.
  assert.deepEqual(litFrom(0).map((n) => +n.toFixed(3)), [1, 0], 'a sun due east');
  assert.deepEqual(litFrom(90).map((n) => +n.toFixed(3)), [0, 1], 'and one a quarter turn on');
  assert.equal(Math.hypot(...litFrom(217)), 1, 'always a unit vector, whatever the angle');
  // While a picture is painted the light is where it was asked to be, and afterwards it is back as it was.
  const before = LIGHT.at;
  const seen = underLight(litFrom(90), () => LIGHT.at);
  assert.deepEqual(seen, [Math.cos(Math.PI / 2), Math.sin(Math.PI / 2)], 'painted under the sun it was given');
  assert.equal(LIGHT.at, before, 'and put back after');
  assert.equal(underLight(null, () => LIGHT.at), LIT, 'with no sun, the painters keep their own light');
  assert.equal(underLight('elsewhere', () => LIGHT.at), LIT, 'and nonsense is not a direction');
  // It survives a painter that throws, or one bad wall would light the rest of the map wrongly.
  try { underLight(litFrom(10), () => { throw new Error('no canvas'); }); } catch { /* the point is what follows */ }
  assert.equal(LIGHT.at, before, 'put back even when the painting fell over');
});

test('a wall lit from the other side throws its shadow the other way', () => {
  // A canvas that remembers where the painter shoved the picture to lay a shadow down.
  const shoves = [];
  const watching = (w, h) => {
    const sheet = quietCanvas(w, h);
    sheet.getContext = () => { const g = quietContext(); g.translate = (x, y) => shoves.push([Math.round(x), Math.round(y)]); return g; };
    return sheet;
  };
  const points = [[0, 0], [400, 0], [400, 300]];
  const paint = (lit) => { shoves.length = 0; paintRunPicture(points, 'dressed', { grid: 100, seed: 5, lit }, watching); return shoves.slice(); };
  const east = paint(litFrom(0)), west = paint(litFrom(180));
  assert.ok(east.length && west.length, 'both laid a shadow');
  // The shadow is thrown away from the light, so turning the sun right round turns every shove round with it.
  const same = (p) => p.map((n) => n + 0); // -0 and 0 are the same shove
  assert.deepEqual(same(west[0]), same(east[0].map((n) => -n)), 'the sun on the other side puts the shadow on the other side');
  const fixed = paint(null); // no sun overhead: underground, or a scene that keeps its own light
  assert.notDeepEqual(fixed[0], east[0], 'and with no sun it falls where the painters always put it');
});

test('a colour is mixed into the stuff, never laid over it', () => {
  // Roi: "lets also add possibility to tint the roofs\walls". Mixed in before a stone is drawn, so a tinted wall
  // is still stone with its blotches and its darks; a fill over the top would flatten all of that.
  const stone = WALL_MATERIALS.dressed.base;
  const red = tinted(stone, '#b03a2e');
  assert.notEqual(red, stone, 'it takes the colour');
  assert.notEqual(red.toLowerCase(), '#b03a2e', 'but is not replaced by it');
  assert.equal(tinted(stone, null), stone, 'no colour, no change');
  assert.equal(tinted(stone, 'rouge'), stone, 'and nonsense is not a colour');
  assert.equal(tinted(stone, '#b03a2e', 0), stone, 'none of it mixed in is none of it');
  // A whole material takes it on its face and, more gently, on the dark of its edges.
  const kind = tintedKind(WALL_MATERIALS.dressed, '#b03a2e');
  assert.equal(kind.base, red, 'the face');
  assert.notEqual(kind.edge, WALL_MATERIALS.dressed.edge, 'the edges too');
  assert.equal(kind.grain, WALL_MATERIALS.dressed.grain, 'and everything else is left as it was');
  assert.equal(tintedKind(WALL_MATERIALS.dressed, null), WALL_MATERIALS.dressed, 'untinted is the material itself');
});

test('ends that are a hair apart still count as touching', () => {
  const runs = wallRuns([wall('a', 0, 0, 100, 0), wall('b', 100.02, 0, 200, 0)]);
  assert.equal(runs.length, 1, 'a hundredth of a pixel is the same corner');
});

test('a run paints the same way every time the scene is opened', () => {
  const walls = [wall('a', 0, 0, 100, 0), wall('b', 100, 0, 200, 0)];
  assert.equal(wallRuns(walls)[0].key, wallRuns(walls.slice().reverse())[0].key, 'the key does not depend on the order they were read in');
});

test('an end that meets another wall is a join; an end that meets nothing is not', () => {
  // Roi, looking at a corner on the map: "the walls doesnt seem like one unit". Every run was capping off against
  // its neighbour with its own dark end.
  const runs = wallRuns([wall('a', 0, 0, 100, 0), wall('b', 100, 0, 200, 0), wall('c', 100, 0, 100, 100)]);
  const branch = runs.find((r) => r.walls[0] === 'c');
  assert.deepEqual(branch.join, [true, false], 'joined where the three meet, loose at its far end');
  // The wall that carries through is loose at both ends: the T it passes is no longer an end of anything.
  const through = runs.find((r) => r.walls.length === 2);
  assert.deepEqual(through.join, [false, false]);
  const alone = wallRuns([wall('a', 0, 0, 100, 0)])[0];
  assert.deepEqual(alone.join, [false, false], 'a wall on its own joins nothing');
});

test('a joined end is carried past the corner; a loose one keeps its edge', () => {
  const points = [[0, 0], [300, 0]];
  assert.deepEqual(joinEnds(points, 17, null), points, 'no join, no change');
  assert.deepEqual(joinEnds(points, 17, [false, false]), points);
  const [start, end] = joinEnds(points, 17, [true, true]);
  assert.ok(start[0] < 0, 'the start runs back past the corner');
  assert.ok(end[0] > 300, 'and the end runs on past its own');
  assert.ok(Math.abs(start[0]) < 17 * 1.5 && end[0] - 300 < 17 * 1.5, 'by about half the wall, not by a square');
  assert.deepEqual(joinEnds(points, 17, [true, false])[1], [300, 0], 'the loose end is left exactly where it was');
});

test('a wall that is dragged is painted again', () => {
  // Found in Foundry, not here: the key was the wall ids alone, so moving a wall left its old picture behind at its
  // old place. Where a run GOES has to be part of what says it has changed.
  const was = wallRuns([wall('a', 0, 0, 100, 0), wall('b', 100, 0, 200, 0)])[0];
  const now = wallRuns([wall('a', 0, 0, 100, 0), wall('b', 100, 0, 260, 40)])[0];
  assert.deepEqual(now.walls, was.walls, 'the same two walls');
  assert.notEqual(now.key, was.key, 'and a different key, so the picture is painted again');
});

test('every wall is painted once and only once', () => {
  const walls = [wall('a', 0, 0, 100, 0), wall('b', 100, 0, 200, 0), wall('c', 300, 0, 400, 0), wall('d', 0, 0, 0, 100), wall('e', 0, 100, 100, 100)];
  const ids = wallRuns(walls).flatMap((r) => r.walls);
  assert.deepEqual(ids.slice().sort(), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(new Set(ids).size, ids.length, 'no wall is in two runs');
});

test('a run carries the years and the thickness it was drawn with', () => {
  const old = wall('a', 0, 0, 100, 0, { animater: { material: 'dressed', age: 0.8, thick: 0.3 } });
  const run = wallRuns([old])[0];
  assert.equal(run.age, 0.8);
  assert.equal(run.thick, 0.3);
  assert.equal(wallRuns([wall('b', 0, 0, 100, 0)])[0].age, 0, 'a wall laid today has no years on it');
  const kept = wallRuns([wall('c', 0, 0, 100, 0)])[0];
  assert.notEqual(run.key, kept.key, 'and the years are part of what says it has changed');
});

// ---------------------------------------------------------------------------------------------------- geometry

test('the two sides of a run never cross at a corner', () => {
  // The first try built its outline by walking each segment in turn, which crossed at every corner and flooded the
  // panel with a dark wedge. A mitred outline stays simple: no two of its edges may intersect.
  const segs = [wallSeg([0, 200], [0, 50]), wallSeg([0, 50], [300, 50])];
  const out = runOutline(segs, 17);
  const cross = (p1, p2, p3, p4) => {
    const d = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0]);
    return d(p1, p2, p3) * d(p1, p2, p4) < 0 && d(p3, p4, p1) * d(p3, p4, p2) < 0;
  };
  for (let i = 0; i < out.length; i++) for (let j = i + 2; j < out.length; j++) {
    if (i === 0 && j === out.length - 1) continue;
    assert.equal(cross(out[i], out[(i + 1) % out.length], out[j], out[(j + 1) % out.length]), false, `edges ${i} and ${j} cross`);
  }
});

test('a hairpin makes a blunt corner instead of shooting off the map', () => {
  const segs = [wallSeg([0, 0], [100, 0]), wallSeg([100, 0], [2, 1])];
  const reach = Math.max(...offsetSide(segs, 17, 1).map(([x, y]) => Math.hypot(x - 50, y)));
  assert.ok(reach < 17 * 10, `the mitre is clamped, not infinite: got ${reach.toFixed(1)}`);
});

test('the sides of a run sit a wall apart, and on opposite sides of it', () => {
  const segs = [wallSeg([0, 0], [300, 0])];
  const up = offsetSide(segs, 17, 1), down = offsetSide(segs, 17, -1);
  assert.ok(up.every(([, y]) => Math.abs(y - 17) < 1e-9));
  assert.ok(down.every(([, y]) => Math.abs(y + 17) < 1e-9));
});

test('a closed outline pushed out grows, and pulled in shrinks', () => {
  const room = [[0, 0], [200, 0], [200, 200], [0, 200]];
  const span = (p) => Math.max(...p.map(([x]) => x)) - Math.min(...p.map(([x]) => x));
  assert.ok(span(offsetClosed(room, 20)) > span(room) + 30, 'out is outward whichever way the room was wound');
  assert.ok(span(offsetClosed(room, -20)) < span(room) - 30);
  assert.ok(span(offsetClosed(room.slice().reverse(), 20)) > span(room) + 30, 'and the other winding too');
});

test('signed area knows which way a shape is wound', () => {
  const room = [[0, 0], [200, 0], [200, 200], [0, 200]];
  assert.ok(signedArea(room) * signedArea(room.slice().reverse()) < 0);
  assert.equal(Math.abs(signedArea(room)), 40000);
});

test('subdividing keeps the shape and adds somewhere for the wobble to show', () => {
  const box = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const fine = subdivide(box, 10);
  assert.ok(fine.length >= 40, `got ${fine.length} points`);
  for (const [x, y] of fine) assert.ok(x >= -1e-9 && x <= 100 + 1e-9 && y >= -1e-9 && y <= 100 + 1e-9, 'every new point is on the shape');
});

test('the hand-drawn edge wobbles, but never wanders off the wall', () => {
  const box = subdivide([[0, 0], [400, 0], [400, 60], [0, 60]], 7);
  const rough = ragged(box, 6, 3);
  const moved = rough.map((p, i) => Math.hypot(p[0] - box[i][0], p[1] - box[i][1]));
  assert.ok(Math.max(...moved) > 1, 'it does wobble');
  assert.ok(Math.max(...moved) <= 6 * 1.36, `and never further than it was told: ${Math.max(...moved).toFixed(2)}`);
  assert.deepEqual(ragged(box, 6, 3), rough, 'the same wall wobbles the same way every time');
  assert.notDeepEqual(ragged(box, 6, 4), rough, 'a different wall wobbles differently');
});

test('a run claims room for its shadow as well as itself', () => {
  const box = runBox([[100, 100], [400, 100]], 100);
  assert.ok(box.x < 100 && box.y < 100, 'the box starts before the wall');
  assert.ok(box.x + box.w > 400 && box.y + box.h > 100);
  assert.ok(box.h > 100, 'there is room above and below for the shadow');
});

test('a curved run bends through the corners it was drawn with', () => {
  const drawn = [[0, 0], [200, 0], [200, 200]];
  const curve = smoothRun(drawn, 20);
  assert.ok(curve.length > 15, `cut into chords: got ${curve.length}`);
  assert.deepEqual(curve[0], [0, 0], 'it starts where the drag started');
  const [lx, ly] = curve.at(-1);
  assert.ok(Math.hypot(lx - 200, ly - 200) < 1e-6, 'and ends where it ended');
  // Every corner it was dragged through is still on the line (Catmull-Rom passes through its points).
  for (const [x, y] of drawn) assert.ok(curve.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 1e-6), `passes through ${x},${y}`);
  // And it does not simply cut the corner: something is out past the straight line between the first and last.
  assert.ok(curve.some(([x, y]) => Math.abs(y - x) > 20), 'it bows, rather than running straight across');
});

test('too few corners to bend are left exactly as drawn', () => {
  assert.deepEqual(smoothRun([[0, 0], [100, 0]], 20), [[0, 0], [100, 0]]);
  assert.deepEqual(smoothRun([], 20), []);
  assert.deepEqual(smoothRun(null, 20), []);
});

// ---------------------------------------------------------------------------------------------------- weather

test('a wall laid this morning has no moss on it, whatever the season', () => {
  // Roi: "why is summer showing moss on all walls?" Moss is what the years put there, not what the season does.
  for (const season of ['spring', 'summer', 'autumn', 'winter', null]) assert.equal(wallLook({ age: 0 }, { season }).moss, 0, `${season}: a new wall is clean`);
  assert.ok(wallLook({ age: 0.6 }, { season: 'summer' }).moss > 0, 'an old one is not');
});

test('the season says how well what is there is doing', () => {
  const old = (season) => wallLook({ age: 0.8 }, { season }).moss;
  assert.ok(old('summer') > old('autumn'), 'poorer in autumn');
  assert.equal(old('winter'), 0, 'and gone in a frost');
  assert.equal(wallLook({ age: 1, underground: true }, { season: 'summer' }).moss, 0, 'nothing grows in the dark');
  assert.equal(wallLook({ underground: true }, { season: 'winter' }).snow, 0, 'nor does it snow down there');
});

test('an old wall grows more and starts to go', () => {
  const young = wallLook({ age: 0.2 }, { season: 'summer' }), old = wallLook({ age: 1 }, { season: 'summer' });
  assert.ok(old.moss > young.moss);
  assert.equal(young.ruin, 0, 'a wall in use is not crumbling');
  assert.equal(old.ruin, 1);
  assert.equal(wallLook({ age: 0.5 }, {}).ruin, 0, 'it only starts to go once it is well past its prime');
});

test('snow lies in winter above ground, and the scene can say how deep', () => {
  assert.ok(wallLook({}, { season: 'winter' }).snow > 0);
  assert.equal(wallLook({}, { season: 'summer' }).snow, 0);
  assert.equal(wallLook({ snow: 0.2 }, { season: 'winter' }).snow, 0.2);
});

// ---------------------------------------------------------------------------------------------------- rooms

test('how a room was worked follows what faces it', () => {
  assert.equal(workedFor('natural'), WORKED.raw);
  assert.equal(workedFor('hewn'), WORKED.cut);
  assert.equal(workedFor('dressed'), WORKED.faced);
  assert.ok(WORKED.raw > WORKED.cut && WORKED.cut > WORKED.faced, 'the less it was worked the more its edge wanders');
});

test('only a room someone built is faced and floored', () => {
  const cave = roomFor([[0, 0], [10, 0], [10, 10]], 'natural'), hall = roomFor([[0, 0], [10, 0], [10, 10]], 'dressed');
  assert.equal(cave.coursed, false);
  assert.equal(cave.laid, false, 'nobody laid a cave a floor');
  assert.equal(hall.coursed, true);
  assert.equal(hall.laid, true);
  assert.equal(roomFor([[0, 0]], 'hewn').coursed, false, 'a hewn hall is cut, not faced');
});

// ---------------------------------------------------------------------------------------------------- the picture

test('a run that is not a run paints nothing', () => {
  assert.equal(paintRunPicture([], 'dressed'), null);
  assert.equal(paintRunPicture([[0, 0]], 'dressed'), null);
  assert.equal(paintRunPicture(null, 'dressed'), null);
});

// A canvas that accepts every call and remembers nothing, so the painter can be run without a browser.
const quietContext = () => ({
  canvas: null, save() {}, restore() {}, scale() {}, translate() {}, clip() {}, fill() {}, stroke() {}, beginPath() {},
  moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {}, ellipse() {}, fillRect() {},
  createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  set fillStyle(v) {}, get fillStyle() { return ''; }, set strokeStyle(v) {}, get strokeStyle() { return ''; },
  set lineWidth(v) {}, get lineWidth() { return 1; }, set lineCap(v) {}, get lineCap() { return ''; },
  set lineJoin(v) {}, get lineJoin() { return ''; }, set filter(v) {}, get filter() { return 'none'; },
  set globalAlpha(v) {}, get globalAlpha() { return 1; }, set globalCompositeOperation(v) {}, get globalCompositeOperation() { return 'source-over'; },
});
const quietCanvas = (w, h) => ({ width: w, height: h, getContext: () => quietContext() });

// Roi: "why left side is not connecting seamlessly? (its the end of the stroke)". A ring's outline is two loops, and
// the one polygon that holds both is slit open where the run began so they can be joined. The ink used to walk that
// polygon, so it drew the slit: a line straight across the wall at that corner.
// Roi: "this is NOT 3 squares wide". A wall is drawn a square at a time, so an opening cut from the one square under
// the pointer could never be wider than that square. It is cut from the straight stretch instead.
test('a wall drawn a square at a time is one straight stretch to cut from', () => {
  const row = [
    wall('a', 100, 100, 200, 100), wall('b', 200, 100, 300, 100), wall('c', 300, 100, 400, 100),
    wall('d', 400, 100, 400, 300),
  ];
  const run = alongStretch(row, 'b');
  assert.deepEqual(run.a, [100, 100], 'it begins where the straight part begins');
  assert.equal(run.length, 300, 'and is as long as all three squares');
  assert.deepEqual(run.parts.map((p) => p.id), ['a', 'b', 'c'], 'the corner is not part of it');
  assert.deepEqual(run.parts.map((p) => [p.from, p.to]), [[0, 100], [100, 200], [200, 300]]);
  assert.equal(alongStretch(row, 'd').length, 200, 'the wall round the corner is a stretch of its own');
  // Drawn the other way round, or in another material, changes nothing and stops it respectively.
  const back = [wall('a', 100, 100, 200, 100), wall('b', 300, 100, 200, 100)];
  assert.equal(alongStretch(back, 'a').length, 200, 'a wall drawn backwards still carries on');
  const other = [wall('a', 100, 100, 200, 100), wall('b', 200, 100, 300, 100, { animater: { material: 'brick' } })];
  assert.equal(alongStretch(other, 'a').length, 100, 'brick is not the same wall as stone');
  // A T is nobody's straight line: three walls meeting stops the stretch there.
  const tee = [wall('a', 100, 100, 200, 100), wall('b', 200, 100, 300, 100), wall('c', 200, 100, 200, 200)];
  assert.equal(alongStretch(tee, 'a').length, 100, 'the stretch stops where a third wall joins');
  assert.equal(alongStretch([wall('a', 0, 0, 100, 0)], 'nope'), null, 'a wall that is not there has no stretch');
});

const INK = 'rgba(14,11,6,0.92)'; // the ink every painter draws its outline in

test("a ring's ink goes round it, and never across it", () => {
  const strokes = [];
  const recorder = () => {
    let at = [], paint = '';
    const g = quietContext();
    g.beginPath = () => { at = []; };
    g.moveTo = (x, y) => at.push([x, y]);
    g.lineTo = (x, y) => at.push([x, y]);
    g.stroke = () => { if (at.length > 1) strokes.push({ pts: at.slice(), paint }); };
    Object.defineProperty(g, 'strokeStyle', { configurable: true, get: () => paint, set: (v) => { paint = v; } });
    return g;
  };
  const sheet = (w, h) => ({ width: w, height: h, getContext: recorder });
  // A square room, drawn as a ring, and the middle of each of its walls.
  const ring = [[200, 200], [600, 200], [600, 600], [200, 600], [200, 200]];
  assert.ok(paintRunPicture(ring, 'timber', { grid: 100, seed: 3, closed: true }, sheet), 'the ring painted');
  // Only the drawn outline is in question here: planks, grain and moss run over the wall as they please. The outline
  // is walked in short steps, so a stroke as long as the wall is thick can only be one that jumped from the outside
  // of the wall to the inside — the slit, drawn.
  const outline = strokes.filter((s) => s.paint === INK);
  assert.ok(outline.length > 4, 'the outline was drawn');
  const thick = 100 * 0.2; // the wall's own half-thickness at this grid, from WALL_THICK
  let longest = 0;
  for (const s of outline) {
    for (let i = 0; i + 1 < s.pts.length; i++) longest = Math.max(longest, Math.hypot(s.pts[i + 1][0] - s.pts[i][0], s.pts[i + 1][1] - s.pts[i][1]));
  }
  assert.ok(longest < thick, `no ink reaches across the wall (longest stroke ${longest.toFixed(1)}, wall ${thick})`);
});

test('a picture covers its run and is kept to a size a map can hold', () => {
  const make = quietCanvas;
  const picture = paintRunPicture([[0, 0], [600, 0]], 'dressed', { grid: 100, seed: 7 }, make);
  assert.ok(picture, 'it painted something');
  assert.equal(picture.box.x < 0, true);
  assert.ok(picture.canvas.width >= 600, 'the picture is at least as long as the wall');
  const huge = paintRunPicture([[0, 0], [40000, 0]], 'dressed', { grid: 100 }, make, 2048);
  assert.ok(huge.canvas.width <= 2048 && huge.scale < 1, 'a wall across a whole map is painted smaller, not at 40000 pixels');
});

test('every material paints without falling over', () => {
  for (const { id } of WALL_MATERIAL_CHOICES) {
    const picture = paintRunPicture([[0, 300], [0, 60], [400, 60]], id, { grid: 100, seed: 3, snow: 0.6, moss: 0.6, soot: 0.4, ruin: 0.6 }, quietCanvas);
    assert.ok(picture, `${id} painted`);
  }
});

// ---------------------------------------------------------------------------------------------------- the layer

class Sprite {
  constructor(texture) { this.texture = texture; this.alpha = 1; this.width = 0; this.height = 0; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }; }
  destroy() { this.destroyed = true; }
}
const PIXI = { Sprite, Texture: { from: (canvas) => ({ canvas, destroy() { this.destroyed = true; } }) } };
const newRoot = () => ({
  children: [],
  addChild(c) { c.parent = this; this.children.push(c); return c; },
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; },
});
const newLayer = () => {
  const root = newRoot();
  return { root, layer: createPaintedWalls({ PIXI, root: () => root, grid: () => 100, make: quietCanvas }) };
};
const RUNS = [
  { id: 'dressed:a', key: 'a', material: 'dressed', points: [[0, 0], [300, 0]] },
  { id: 'timber:b', key: 'b', material: 'timber', points: [[0, 200], [300, 200]] },
];

test('nothing is painted until it is stepped, so a big map does not hold the frame', () => {
  const { layer, root } = newLayer();
  assert.equal(layer.populate({ runs: RUNS }), 2, 'both are waiting');
  assert.equal(root.children.length, 0, 'and none is on the map yet');
  layer.step(1);
  assert.equal(root.children.length, 1);
  assert.equal(layer.settle(), 0);
  assert.equal(root.children.length, 2);
});

test('a wall that has not changed is left where it is', () => {
  const { layer, root } = newLayer();
  layer.populate({ runs: RUNS }); layer.settle();
  const was = root.children.slice();
  assert.equal(layer.populate({ runs: RUNS }), 0, 'nothing to repaint');
  assert.deepEqual(root.children, was, 'the same sprites, untouched');
});

test('a wall that is gone is taken off the map', () => {
  const { layer, root } = newLayer();
  layer.populate({ runs: RUNS }); layer.settle();
  layer.populate({ runs: [RUNS[0]] }); layer.settle();
  assert.equal(root.children.length, 1);
  assert.deepEqual(layer.state.keys, ['a']);
});

test('a wall painted again keeps the one it has until the new one is up', () => {
  // The same stones under a sun that has moved: a different picture of the same run, so the run must not vanish
  // while the new picture is being made.
  const { layer, root } = newLayer();
  // `id` is the run itself; `key` is this picture of it. The sun moving changes the second, never the first.
  const run = { ...RUNS[0], id: 'dressed:w1' };
  layer.populate({ runs: [run] }); layer.step(4);
  const was = root.children[0];
  assert.ok(was, 'painted once');
  layer.populate({ runs: [{ ...run, key: `${run.key}:s3` }] });
  assert.equal(root.children.length, 1, 'still up while the new one is painted');
  assert.equal(root.children[0], was);
  layer.step(4);
  assert.equal(root.children.length, 1, 'and only the new one is left after');
  assert.notEqual(root.children[0], was);
});

test('a change of season repaints the lot, since every wall wears it', () => {
  const { layer } = newLayer();
  layer.populate({ runs: RUNS, look: { snow: 0 } }); layer.settle();
  assert.equal(layer.populate({ runs: RUNS, look: { snow: 1 } }), 2, 'both painted again');
  // The old pictures used to be let go first, which left the map bare until the queue reached them. They stay up
  // now until their replacements are ready, and come down one at a time as each is.
  assert.equal(layer.state.painted, 2, 'the walls are still on the map while the snow is painted on');
  layer.settle();
  assert.equal(layer.state.painted, 2, 'and still two walls after, not four');
});

test('dropping a scene takes everything with it, queue and all', () => {
  const { layer, root } = newLayer();
  layer.populate({ runs: RUNS }); layer.step(1);
  layer.drop();
  assert.equal(root.children.length, 0);
  assert.deepEqual(layer.state, { painted: 0, waiting: 0, alpha: 1, keys: [] });
});

test('the layer can be faded, now and later', () => {
  const { layer, root } = newLayer();
  layer.populate({ runs: RUNS }); layer.settle();
  layer.fade(0.4);
  assert.ok(root.children.every((s) => s.alpha === 0.4));
  layer.populate({ runs: [...RUNS, { key: 'c', material: 'brick', points: [[0, 400], [300, 400]] }] });
  layer.settle();
  assert.ok(root.children.every((s) => s.alpha === 0.4), 'a wall painted after the fade is faded too');
});

test('with no canvas to draw on, nothing is painted and nothing is lost', () => {
  const layer = createPaintedWalls({ PIXI, root: () => null, grid: () => 100, make: quietCanvas });
  layer.populate({ runs: RUNS });
  assert.equal(layer.step(2), 2, 'both are still waiting for a canvas');
  assert.equal(layer.state.painted, 0);
});
