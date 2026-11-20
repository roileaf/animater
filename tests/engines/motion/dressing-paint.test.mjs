import test from 'node:test';
import assert from 'node:assert/strict';
import {
  outwardOf, scallop, ropePoints, lanternSpots, bannerShape, bannerSpots, dressingLook, dressingKindOf,
  DRESSING_KINDS, sheltered, windCarries,
} from '../../../scripts/engines/motion/dressing-paint.mjs';

// Roi, on bunting painted flat along the eave: "too straight line.. it should be like a sine wave", then
// "lets also make it move with the wind", then "it should also cast shadows be affected by the sun\weather etc".

const A = [0, 0], B = [400, 0], MIDDLE = [200, 200];
const same = (v) => v.map((n) => n + 0); // -0 and 0 are the same direction

test('a rope hangs away from the building, whichever edge it is on', () => {
  // The top edge of a building whose middle is below it: out is upwards.
  assert.deepEqual(same(outwardOf(A, B, MIDDLE)), [0, -1]);
  // The bottom edge of the same building: out is downwards.
  assert.deepEqual(same(outwardOf([0, 400], [400, 400], MIDDLE)), [0, 1]);
  // And on a wall running the other way, out is sideways. In pixels, not as a share of the way to the middle:
  // a share is a different distance at a corner than half way along a long wall.
  assert.deepEqual(same(outwardOf([0, 0], [0, 400], MIDDLE)), [-1, 0]);
});

test('it scallops: nailed up at the fastenings, swinging in between', () => {
  assert.ok(Math.abs(scallop(0, 3)) < 1e-9, 'nought where it is nailed');
  assert.ok(Math.abs(scallop(1 / 3, 3)) < 1e-9, 'and at the next nail along');
  assert.ok(Math.abs(scallop(1 / 6, 3) - 1) < 1e-9, 'all of it half way between');
  for (const t of [0.07, 0.2, 0.4, 0.9]) { const d = scallop(t, 3); assert.ok(d >= 0 && d <= 1, `${t}: ${d}`); }
});

test('the wind takes the parts that are free to move, and leaves the nails alone', () => {
  const out = outwardOf(A, B, MIDDLE);
  const still = ropePoints(A, B, out, { swags: 2, hang: 2, amp: 10, wind: 0 });
  const blown = ropePoints(A, B, out, { swags: 2, hang: 2, amp: 10, wind: 1, windDir: [1, 0] });
  assert.equal(still.length, blown.length);
  // The ends are nailed to the eave: a gale must not pull them off it.
  for (const i of [0, still.length - 1]) {
    assert.ok(Math.hypot(blown[i][0] - still[i][0], blown[i][1] - still[i][1]) < 1e-6, `point ${i} is nailed down`);
  }
  // Somewhere in the middle of a swag it has moved, and moved downwind.
  const dip = Math.round(still.length / 4);
  assert.ok(blown[dip][0] > still[dip][0] + 1, 'the dip is blown along the wind');
});

test('a lantern hangs at the bottom of each swing, one per swag', () => {
  const out = outwardOf(A, B, MIDDLE);
  const spots = lanternSpots(A, B, out, { swags: 4, hang: 2, amp: 10, lamp: 4 });
  assert.equal(spots.length, 4);
  for (const s of spots) assert.ok(s.at[1] < 0, 'hung out past the eave, not on the roof');
  assert.deepEqual(spots.map((s) => s.lit), [true, false, true, false], 'and they alternate');
});

test('a flag is on a pole: the pole holds still and the cloth works', () => {
  // Roi: "flags on poles sound good" — a banner draped down a wall is all but invisible from straight above, so
  // what hangs out here is a pennant on a pole jutting from the wall, which reads at map zoom.
  const out = outwardOf(A, B, MIDDLE);
  const calm = bannerShape([200, 0], out, { pole: 26, long: 46, wide: 13, wind: 0 });
  // A wind blowing away from the wall, not along it: still, the flag already lies along the wall, so a wind in
  // that same direction would prove nothing.
  const gale = bannerShape([200, 0], out, { pole: 26, long: 46, wide: 13, wind: 1, windDir: [0, -1] });
  // The pole is in the wall and is not going anywhere, however hard it blows.
  assert.deepEqual(calm.pole, gale.pole, 'the pole stands');
  assert.deepEqual(same(calm.pole[1]), [200, -26], 'jutting straight out of its wall');
  assert.equal(calm.cloth.length, gale.cloth.length);
  // Still, it hangs along the wall; blowing, it streams downwind.
  const tip = (shape) => shape.cloth[Math.round(shape.cloth.length / 2) - 1];
  const reach = (shape) => Math.hypot(tip(shape)[0] - shape.pole[1][0], tip(shape)[1] - shape.pole[1][1]);
  // A still flag stays out far enough to be a flag. Drawn truly limp it was a crumpled scrap, which reads as a
  // mistake rather than as stillness — so the wind answers in how far it reaches and how it flutters, not in
  // whether there is anything there at all.
  assert.ok(reach(calm) < reach(gale), 'the wind still pulls it out further');
  // Short enough that the stillness shows, long enough that it is still a flag and not a scrap.
  assert.ok(reach(calm) > reach(gale) * 0.2, `at rest it is still a flag: ${reach(calm).toFixed(1)} of ${reach(gale).toFixed(1)}`);
  assert.ok(reach(calm) < reach(gale) * 0.6, 'and visibly shorter than one that is flying');
  assert.ok(reach(bannerShape([200, 0], out, { pole: 26, long: 46, wide: 13, wind: 0, floor: 0.16 })) < reach(calm), 'and a limper one can still be asked for');
  assert.ok(tip(gale)[1] < tip(calm)[1] - 10, 'blowing, it streams downwind');
  // And it streams downwind whichever wall it is on: flags on a building do not fan out like a compass rose.
  const north = bannerShape([200, 0], [0, -1], { pole: 26, long: 46, wide: 13, wind: 1, windDir: [0, -1] });
  const west = bannerShape([0, 200], [-1, 0], { pole: 26, long: 46, wide: 13, wind: 1, windDir: [0, -1] });
  const way = (s) => { const d = [tip(s)[0] - s.pole[1][0], tip(s)[1] - s.pole[1][1]], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l]; };
  assert.ok(Math.abs(way(north)[1] - way(west)[1]) < 0.25, 'both walls stream the same way');
  // And it is a pennant: broad at the pole, a point at the end.
  const wideAt = (shape, i) => Math.hypot(shape.cloth[i][0] - shape.cloth.at(-1 - i)[0], shape.cloth[i][1] - shape.cloth.at(-1 - i)[1]);
  const last = (shape) => shape.cloth.length / 2 - 1; // however many ribs the cloth is cut into
  assert.ok(wideAt(calm, 0) > wideAt(calm, last(calm)) * 2, 'it tapers from the hoist to the fly');
  // And it is cut into ribs, each knowing which way its fold has turned, so it can be laid down a band at a time.
  assert.equal(calm.ribs.length, last(calm), 'a band between every pair of ribs');
  for (const rib of calm.ribs) { assert.equal(rib.quad.length, 4); assert.ok(rib.lean >= -1 && rib.lean <= 1, `lean ${rib.lean}`); }
  assert.ok(gale.ribs.some((r) => Math.abs(r.lean) > 0.05), 'and in a wind the folds are turned');
});

test('a flag never blows back over the building it is nailed to', () => {
  // Roi: "it's OVER the roof.." — the cloth followed the wind wherever it went, including straight back across
  // the roof behind its own pole. A building is in the way; the cloth slides along the wall instead.
  const out = outwardOf(A, B, MIDDLE); // the top wall of a building: out is upwards
  const tip = (s) => s.cloth[Math.round(s.cloth.length / 2) - 1];
  // Measured as how far inside the wall any of the cloth gets, not as a share of its length: a flag pinned by a
  // head-on wind is short, and a small wander is a large fraction of a short flag but still nowhere near the roof.
  const inside = (p) => (p[0] - 0) * out[0] + (p[1] - 0) * out[1];
  for (const [what, windDir] of [['away', [0, -1]], ['onto the wall', [0, 1]], ['along it', [1, 0]], ['diagonally in', [0.7, 0.7]]]) {
    const flag = bannerShape([200, 0], out, { pole: 26, long: 46, wide: 13, wind: 1, windDir });
    assert.ok(Math.min(...flag.cloth.map(inside)) >= -8, `${what}: the cloth stays out of the roof`);
  }
  // A wind blowing straight out is left completely alone: that one needs no help.
  const free = bannerShape([200, 0], out, { pole: 26, long: 46, wide: 13, wind: 1, windDir: [0, -1] });
  const d = [tip(free)[0] - free.pole[1][0], tip(free)[1] - free.pole[1][1]];
  assert.ok(d[1] / (Math.hypot(...d) || 1) < -0.9, 'straight downwind when downwind is away from the wall');
});

test('every wall in every wind keeps its dressing outside the building', () => {
  // Roi: "i dont think the banner and garland suports all wind directions, can you verify?" — and the check
  // turned one up: the flags were behaving by then, but a wind blowing straight onto a wall still pushed that
  // wall's rope back inside the building. Four walls, eight points of the compass, three strengths.
  const walls = {
    north: [[0, 0], [400, 0]], east: [[400, 0], [400, 400]],
    south: [[400, 400], [0, 400]], west: [[0, 400], [0, 0]],
  };
  for (const [wall, [a, b]] of Object.entries(walls)) {
    const out = outwardOf(a, b, [200, 200]);
    const inside = (p) => (p[0] - a[0]) * out[0] + (p[1] - a[1]) * out[1];
    for (let deg = 0; deg < 360; deg += 45) {
      const windDir = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
      for (const wind of [0, 0.5, 1]) {
        const where = `${wall} ${deg}deg x${wind}`;
        const rope = ropePoints(a, b, out, { swags: 3, hang: 2, amp: 10, wind, windDir, phase: 0.7 });
        assert.ok(rope.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])), `${where}: the rope is somewhere`);
        assert.ok(Math.min(...rope.map(inside)) >= -1, `${where}: the rope stays out of the building`);
        const lamps = lanternSpots(a, b, out, { swags: 3, hang: 2, amp: 10, lamp: 4, wind, windDir, phase: 0.7 });
        assert.ok(Math.min(...lamps.map((s) => inside(s.at))) >= -1, `${where}: so do the lanterns`);
        const flag = bannerShape(bannerSpots(a, b, out, { every: 200, bite: 7 })[0], out, { pole: 22, long: 58, wide: 11, wind, windDir, phase: 0.7 });
        assert.ok(flag.cloth.every((p) => Number.isFinite(p[0])), `${where}: the cloth is somewhere`);
        assert.ok(Math.min(...flag.cloth.map(inside)) >= -8, `${where}: and the cloth is not over the roof`);
      }
    }
  }
});

test('a flag droops shorter, never narrower', () => {
  // Roi: "you made it thin instead of shorter, imagine a flag pushed by the wind...". The hoist is the edge fixed
  // along the pole and that edge is horizontal whatever the wind does, so from overhead its width never changes.
  // What a drooping flag loses is length: the cloth trails downward, and downward is short seen from above.
  const out = outwardOf(A, B, MIDDLE);
  const wideAt = (s) => Math.hypot(s.cloth[0][0] - s.cloth.at(-1)[0], s.cloth[0][1] - s.cloth.at(-1)[1]);
  const tip = (s) => s.cloth[Math.round(s.cloth.length / 2) - 1];
  const longAt = (s) => Math.hypot(tip(s)[0] - s.pole[1][0], tip(s)[1] - s.pole[1][1]);
  const flag = (wind, windDir = [-1, 0]) => bannerShape([200, 0], out, { pole: 22, long: 58, wide: 11, wind, windDir });
  const still = flag(0), blowing = flag(1);
  assert.ok(Math.abs(wideAt(still) - wideAt(blowing)) < 1e-9, 'the same width whether it is blowing or not');
  assert.ok(longAt(blowing) > longAt(still) * 1.5, `and longer when it is (${longAt(still).toFixed(1)} to ${longAt(blowing).toFixed(1)})`);
  // Which way the wind comes from does not change the width either: a flag is as wide as its pole, always.
  for (const way of [[1, 0], [0, -1], [-0.7, -0.7]]) assert.ok(Math.abs(wideAt(flag(1, way)) - wideAt(blowing)) < 1e-9, `width holds from ${way}`);
});

test('a building shelters its own lee, so its far side barely stirs', () => {
  // Roi: "the side that's protected by the wind shouldnt move that much by the wind" — every wall was swinging
  // alike, which is right for none of them.
  const north = outwardOf([0, 0], [400, 0], [200, 200]);   // faces up
  const south = outwardOf([400, 400], [0, 400], [200, 200]); // faces down
  const east = outwardOf([400, 0], [400, 400], [200, 200]);  // faces right
  const fromNorth = [0, 1]; // the wind blows downward, so the north wall is driven at
  const hit = sheltered(1, fromNorth, north), side = sheltered(1, fromNorth, east), lee = sheltered(1, fromNorth, south);
  assert.ok(hit > side && side > lee, `driven ${hit.toFixed(2)} > alongside ${side.toFixed(2)} > lee ${lee.toFixed(2)}`);
  assert.ok(Math.abs(hit - 1) < 1e-9, 'the wall it is driving at takes all of it');
  assert.ok(lee > 0, 'and the lee is never quite still: a building makes eddies');
  assert.ok(lee < 0.3, `but it is a shelter: ${lee.toFixed(2)}`);
  assert.equal(sheltered(0, fromNorth, north), 0, 'no wind is no wind, wherever you stand');
});

test('a wind driving straight at a wall pins its flags short', () => {
  // Roi: "still pointing down.. just shorten it like the wind is coming from the right man". A flag on the wall
  // the wind is hitting has nowhere to stream: the cloth is pressed back against the building, so it hangs short
  // rather than lying full length along the wall. What matters is not how hard it blows but how much of it can
  // carry the cloth anywhere.
  const mid = [200, 200];
  const east = outwardOf([400, 0], [400, 400], mid);   // the wind is driving at this one
  const north = outwardOf([0, 0], [400, 0], mid);      // and sliding along this one
  const windDir = [-1, 0];                             // out of the east, blowing west
  assert.equal(windCarries(windDir, east), 0, 'straight at a wall carries nothing');
  assert.equal(windCarries(windDir, north), 1, 'along a wall carries all of it');
  assert.ok(windCarries([-0.7, -0.7], east) > 0.6, 'and a quartering wind most of it');
  const tip = (s) => s.cloth[Math.round(s.cloth.length / 2) - 1];
  const lengthOn = (out) => {
    const s = bannerShape([0, 0], out, { pole: 22, long: 58, wide: 11, wind: sheltered(1, windDir, out), windDir });
    return Math.hypot(tip(s)[0] - s.pole[1][0], tip(s)[1] - s.pole[1][1]);
  };
  assert.ok(lengthOn(north) > lengthOn(east) * 1.8, `pinned ${lengthOn(east).toFixed(1)} against flying ${lengthOn(north).toFixed(1)}`);
});

test('a sheltered flag hangs shorter than one in the full wind', () => {
  // Roi: "if the wind is coming from the right why the left side is flying freely..?" — the shelter was there,
  // but a flag kept half its length with no wind at all, so being sheltered made no odds to how it looked.
  const windDir = [-1, 0]; // out of the east, blowing west
  const north = outwardOf([0, 0], [400, 0], [200, 200]);     // the wind slides along this one
  const west = outwardOf([0, 400], [0, 0], [200, 200]);      // and this one is in the building's lee
  const tip = (s) => s.cloth[Math.round(s.cloth.length / 2) - 1];
  const longOf = (s) => Math.hypot(tip(s)[0] - s.pole[1][0], tip(s)[1] - s.pole[1][1]);
  const on = (out) => longOf(bannerShape([0, 0], out, { pole: 22, long: 58, wide: 11, wind: sheltered(1, windDir, out), windDir }));
  // Both can stream — the wind reaches along either — so what separates them is the shelter alone.
  assert.ok(on(north) > on(west) * 1.4, `open to it ${on(north).toFixed(1)}, in the lee ${on(west).toFixed(1)}`);
});

test('banners are spaced along a wall, never a row of curtains', () => {
  const out = outwardOf(A, B, MIDDLE);
  assert.equal(bannerSpots(A, B, out, { every: 180 }).length, 2);
  assert.equal(bannerSpots(A, [2000, 0], out, { every: 180, most: 4 }).length, 4, 'a long wall is capped');
  assert.equal(bannerSpots(A, [40, 0], out, { every: 180 }).length, 1, 'and a short one still gets one');
});

test('the sun decides the shadow, and the dark decides the lanterns', () => {
  const noon = dressingLook({ sun: { angle: 90, height: 80, strength: 1 } });
  const dusk = dressingLook({ sun: { angle: 180, height: 4, strength: 0.5 } });
  const night = dressingLook({ sun: null });
  assert.ok(noon.shadow.long < dusk.shadow.long, 'a low sun throws it further');
  assert.ok(noon.glow < dusk.glow && dusk.glow < night.glow, 'and the lanterns earn their keep as it gets dark');
  assert.equal(night.shadow.long, 0, 'no sun, no shadow');
  assert.equal(night.glow, 1, 'and the lanterns are all the light there is');
  // The shadow falls away from the sun, as everything else on the map does.
  assert.ok(dressingLook({ sun: { angle: 0, height: 20, strength: 1 } }).shadow.dir[0] < -0.9);
});

test('the weather is on it too', () => {
  const look = dressingLook({ sun: null, snow: 0.8, wet: 0.5 });
  assert.equal(look.snow, 0.8);
  assert.equal(look.wet, 0.5);
  assert.equal(dressingLook({ snow: 4, wet: -1 }).snow, 1, 'and nonsense is held in range');
});

test('what a building hangs out is one of the three, whatever it was asked for', () => {
  for (const kind of DRESSING_KINDS) assert.equal(dressingKindOf(kind), kind);
  assert.equal(dressingKindOf('fireworks'), 'garlands');
  assert.equal(dressingKindOf(undefined), 'garlands');
});
