import test from 'node:test';
import assert from 'node:assert/strict';
import { clipToBox, ringArea, insideOf, roofOpenings, openingKey } from '../../../scripts/engines/motion/roof-sight.mjs';

// Roi: "can we show the insides based on the sight polygon?" — so a roof comes off the room you are standing in and
// whatever you can see from it, instead of the whole building at once.

const ROOM = { x: 200, y: 200, w: 500, h: 400 };
const rect = (x, y, w, h) => [x, y, x + w, y, x + w, y + h, x, y + h];

test("a sight polygon is cut down to the room it is seen from", () => {
  // Sight sweeps the whole scene; only the part inside this room may lift the roof.
  const cut = clipToBox(rect(0, 0, 4000, 3000), ROOM);
  assert.deepEqual(
    [Math.min(...cut.filter((_, i) => i % 2 === 0)), Math.min(...cut.filter((_, i) => i % 2 === 1))],
    [200, 200],
    'starts at the room',
  );
  assert.equal(Math.max(...cut.filter((_, i) => i % 2 === 0)), 700, 'and stops at its far wall');
});

test("sight that never reaches the room cuts nothing", () => {
  assert.deepEqual(clipToBox(rect(1200, 1200, 300, 300), ROOM), [], 'a different building entirely');
});

test("a polygon already inside comes back as it was", () => {
  const inside = rect(300, 300, 100, 100);
  assert.equal(ringArea(clipToBox(inside, ROOM)), 10000, 'whole, not trimmed');
});

test("the inside of a room stops short of its walls, so the eaves are never nibbled", () => {
  const box = insideOf(ROOM, 30);
  assert.deepEqual([box.x, box.y, box.w, box.h], [230, 230, 440, 340]);
  // A creature standing in the garden sees the outside face of the wall. That must not open the roof.
  assert.deepEqual(roofOpenings(ROOM, [rect(120, 120, 100, 600)], { inset: 30 }), [], 'the garden sees no further');
});

// Roi: "with our indoor vision polygon methods players cant see the actual walls". Cut to the inside of the room, an
// opening showed the floor and left the stone hidden under the roof. A negative inset reaches out past the walls.
test("a cut can reach out past the walls, so the room shows the stone it is made of", () => {
  const box = insideOf(ROOM, -22);
  assert.deepEqual([box.x, box.y, box.w, box.h], [178, 178, 544, 444], 'the box is pushed out, not pulled in');
  const [cut] = roofOpenings(ROOM, [rect(0, 0, 4000, 3000)], { inset: -22 });
  assert.equal(Math.min(...cut.filter((_, i) => i % 2 === 0)), 178, 'and the opening goes with it');
  assert.equal(Math.max(...cut.filter((_, i) => i % 2 === 0)), 722);
});

// Roi, with a token in the street and every door shut: "when the door is closed and theres no sight into the
// building, that it looks like i have nothing selected and the roof is not seethrough". The reach past the walls is
// for somebody already inside; on its own it must not let anybody in.
test("a creature that cannot see into the room opens nothing, reach or no reach", () => {
  // Its sight runs along the outside of the south wall and stops there: it meets the room at the wall line only.
  const street = rect(150, 600, 600, 200);
  assert.deepEqual(roofOpenings(ROOM, [street], { inset: -22 }), [], 'the street sees no further than the stone');
  // The same creature once a door is open: a wedge of the room itself is in view, and that does open the roof.
  const throughTheDoor = [400, 700, 420, 700, 480, 400, 360, 400];
  const [cut] = roofOpenings(ROOM, [throughTheDoor], { inset: -22 });
  assert.ok(cut && ringArea(cut) > 0, 'what it can see of the room comes off');
  assert.ok(Math.max(...cut.filter((_, i) => i % 2 === 1)) > 600, 'and reaches past the wall it looks through');
});

test("standing inside still lifts the roof, out to the stone", () => {
  const [cut] = roofOpenings(ROOM, [rect(250, 250, 300, 250)], { inset: -22 });
  assert.ok(cut && ringArea(cut) >= 300 * 250, 'the room it stands in opens');
});

test("a room smaller than the inset has no inside to open", () => {
  assert.deepEqual(roofOpenings({ x: 0, y: 0, w: 40, h: 40 }, [rect(-500, -500, 2000, 2000)], { inset: 30 }), []);
});

test("one opening a creature, and a sliver at a doorway is not worth a flicker", () => {
  const two = roofOpenings(ROOM, [rect(250, 250, 200, 200), rect(500, 300, 150, 150)], { inset: 20 });
  assert.equal(two.length, 2, 'both creatures lift their own part');
  const sliver = roofOpenings(ROOM, [rect(250, 250, 3, 3)], { inset: 20, least: 64 });
  assert.deepEqual(sliver, [], 'too small to be a room opening up');
});

test("a roof with nobody looking at it is left whole", () => {
  assert.deepEqual(roofOpenings(ROOM, [], { inset: 20 }), [], 'no sight, no hole');
  assert.deepEqual(roofOpenings(null, [rect(0, 0, 900, 900)]), [], 'and no room, no hole');
});

test("the word for a set of openings changes only when what is shown does", () => {
  const a = roofOpenings(ROOM, [rect(250, 250, 200, 200)], { inset: 20 });
  const nudged = roofOpenings(ROOM, [rect(250.3, 250.2, 200, 200)], { inset: 20 });
  const moved = roofOpenings(ROOM, [rect(300, 250, 200, 200)], { inset: 20 });
  assert.equal(openingKey(a), openingKey(nudged), 'a fraction of a pixel is not a change');
  assert.notEqual(openingKey(a), openingKey(moved), 'a step across the room is');
  assert.equal(openingKey([]), '', 'and nothing open has nothing to say');
});

test("rubbish in is nothing out, rather than a thrown error", () => {
  assert.deepEqual(clipToBox(null, ROOM), []);
  assert.deepEqual(clipToBox([1, 2], ROOM), [], 'two points are not a polygon');
  assert.deepEqual(clipToBox(rect(0, 0, 10, 10), { x: 0, y: 0, w: 0, h: 0 }), []);
  assert.equal(ringArea([1, 2]), 0);
});
