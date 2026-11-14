import test from 'node:test';
import assert from 'node:assert/strict';
import { seaStrength, rollSeed, shipRoll, onDeck, carriedBy, deckShade, hullWash, tileMiddle, ROLL_PERIOD } from '../../../scripts/engines/motion/ship-roll.mjs';

// Roi chose "C: both, gently": B's light and foam with a much smaller tilt (under a degree calm), tokens lean with it.
test('the sea throws a ship about by wind and storm: calm, choppy, storm', () => {
  // Most scenes carry no wind at all, so a still day is a living sea, not a flat one.
  assert.equal(seaStrength({}), 0.8);
  assert.ok(Math.abs(seaStrength({ wind: 1 }) - 1.4) < 1e-9);
  assert.equal(seaStrength({ wind: 1, storm: 1 }), 2.2);
  assert.ok(Math.abs(seaStrength({ wind: 5, storm: -2 }) - 1.4) < 1e-9, 'out-of-range readings are held to 0–1');
});

// Roi watched a ship in full wind and saw no rocking at all: at 1° the ends of a ship moved 9 px over several seconds,
// which nobody notices from straight above. Over a degree even on a still day, so it reads without ever looking thrown about.
test('a roll you can see: over a degree on a still day, over two in a storm', () => {
  const deg = (r) => (Math.abs(r) * 180) / Math.PI;
  let calm = 0, windy = 0, storm = 0, calmHeel = 0;
  for (let t = 0; t < 60; t += 0.05) {
    const c = shipRoll(t, seaStrength({}), 0.3);
    calm = Math.max(calm, deg(c.tilt)); calmHeel = Math.max(calmHeel, Math.abs(c.heel));
    windy = Math.max(windy, deg(shipRoll(t, seaStrength({ wind: 1 }), 0.3).tilt)); storm = Math.max(storm, deg(shipRoll(t, 2.2, 0.3).tilt));
  }
  assert.ok(calm > 1.1 && calm < 1.6, `calm ${calm}`);
  assert.ok(windy > calm && windy < 2.1, `full wind ${windy}`);
  assert.ok(storm > windy && storm < 2.8, `storm ${storm}`);
  // A 10-square ship is about 1000 px: its ends swing this far each way, over and back every ROLL_PERIOD seconds.
  assert.ok(500 * Math.tan((calm * Math.PI) / 180) > 9, 'the ends of a ship move far enough to notice on a still day');
  assert.ok(calmHeel > 0.5, `calm heel ${calmHeel}: the deck shade shows even on still water`);
  const r = shipRoll(1.3, 1, 0.5);
  assert.ok(Math.sign(r.swing) === -Math.sign(r.heel), 'a lantern swings against the roll');
  assert.equal(shipRoll(2, 0, 0.5).tilt, 0, 'no sea, no roll');
  for (let t = 0; t < 40; t += 0.05) assert.ok(Math.abs(shipRoll(t, 2.2, 0.8).heel) <= 1.15, 'never thrown further than its worst heel');
});

// A single slow sine over several seconds reads as a drift, not as a sea working at a hull: a chop rides on the swell,
// so the hull hurries and eases within each sweep. A pure sine's fastest moment is pi/2 (1.57) times its average pace.
test('a chop rides on the swell, so the roll hurries and eases within each sweep', () => {
  const pace = [];
  for (let t = 0; t < ROLL_PERIOD; t += 0.02) pace.push(Math.abs(shipRoll(t + 0.02, 1.4, 0).heel - shipRoll(t, 1.4, 0).heel));
  const peak = Math.max(...pace), mean = pace.reduce((a, b) => a + b, 0) / pace.length;
  assert.ok(peak / mean > 1.8, `fastest ${(peak / mean).toFixed(2)}x the average pace: a pure sine is 1.57`);
  assert.equal(shipRoll(1, 0, 0).heel, 0, 'no sea, no chop either');
});

test('it keeps rolling back and forth on a period, and two ships roll out of step', () => {
  const a = shipRoll(0.2, 1, rollSeed('ship-a')).heel, b = shipRoll(0.2, 1, rollSeed('ship-b')).heel;
  assert.notEqual(a, b);
  const signs = new Set(); for (let t = 0; t < ROLL_PERIOD; t += 0.1) signs.add(Math.sign(shipRoll(t, 1, 0).heel));
  assert.ok(signs.has(1) && signs.has(-1), 'heels to both sides');
  assert.equal(rollSeed('x'), rollSeed('x'));
});

// Foundry v14 hangs a tile on an anchor: a tile placed there has x, y at the middle of its picture, not its top-left
// corner. Read the old way, a ship's deck came out half a ship away, and nothing standing on it was carried.
test('a tile\'s middle: by its anchor in v14, by its corner for an older tile', () => {
  assert.deepEqual(tileMiddle({ x: 500, y: 400, width: 1000, height: 300, anchorX: 0.5, anchorY: 0.5 }), { x: 500, y: 400 });
  assert.deepEqual(tileMiddle({ x: 0, y: 0, width: 1000, height: 300 }), { x: 500, y: 150 }, 'no anchor: the top-left corner');
  assert.deepEqual(tileMiddle({ x: 100, y: 100, width: 400, height: 200, anchorX: 1, anchorY: 0 }), { x: -100, y: 200 }, 'hung by a corner of its own');
  const ship = { x: 600, y: 600, width: 1000, height: 300, rotation: 0, anchorX: 0.5, anchorY: 0.5 };
  assert.ok(onDeck({ x: 250, y: 550 }, ship), 'a creature well onto the deck');
  assert.ok(!onDeck({ x: 1400, y: 600 }, ship), 'and not half a ship past its bow');
});

test('what stands on the deck: inside the picture, turned tiles too', () => {
  const tile = { x: 0, y: 0, width: 400, height: 100, rotation: 0 };
  assert.ok(onDeck({ x: 390, y: 50 }, tile));
  assert.ok(!onDeck({ x: 200, y: 140 }, tile));
  const turned = { ...tile, rotation: 90 };
  assert.ok(onDeck({ x: 200, y: 220 }, turned), 'turned upright, the long side runs down');
  assert.ok(!onDeck({ x: 390, y: 50 }, turned));
});

test('a token on deck is carried round the middle and drifts with it, back to its place at rest', () => {
  const still = carriedBy({ x: 300, y: 50 }, { x: 200, y: 50 }, { tilt: 0, heel: 0, drift: { x: 0, y: 0 } });
  assert.ok(Math.abs(still.x) < 1e-9 && Math.abs(still.y) < 1e-9 && still.r === 0);
  const off = carriedBy({ x: 300, y: 50 }, { x: 200, y: 50 }, { tilt: 0.02, heel: 1, drift: { x: 0.01, y: 0 } }, 100, 1);
  assert.ok(off.y > 1.9 && off.y < 2.1, 'turned with the deck: 100 px out, 0.02 rad, about 2 px');
  assert.ok(Math.abs(off.x - 1) < 0.05, 'drift 0.01 squares of 100 px');
  assert.ok(off.r > 0.02, 'a creature leans a little further than the deck');
});

test('the deck shade: three painted steps on the low side, a little light on the high side', () => {
  assert.deepEqual(deckShade(0), []);
  const s = deckShade(1);
  assert.equal(s.filter((b) => b.dark).length, 3);
  assert.ok(s.filter((b) => b.dark).every((b) => b.to === 1), 'heeled to the far side, shade there');
  assert.ok(s.find((b) => !b.dark).from === 0, 'light on the near side');
  const other = deckShade(-0.5);
  assert.ok(other.filter((b) => b.dark).every((b) => b.from === 0));
  assert.ok(other[0].alpha < s[0].alpha, 'less heel, fainter');
});

test('the water round the hull: a shadow that shifts with the roll, foam riding up the low side', () => {
  const flat = hullWash(0, 1), low = hullWash(1, 1), high = hullWash(-1, 1);
  assert.ok(flat.shadow.alpha > 0 && flat.foam.alpha > 0, 'a ship at rest still sits in its shadow and a little foam');
  assert.ok(low.shadow.y > flat.shadow.y && high.shadow.y < flat.shadow.y, 'the shadow slides toward the low side');
  assert.ok(low.foam.y > 0 && high.foam.y < 0, 'foam pushes out on the low side');
  assert.ok(low.foam.alpha > flat.foam.alpha, 'more foam the harder it heels');
  assert.ok(hullWash(1, 2.2).foam.y > low.foam.y, 'more in a storm');
  assert.equal(hullWash(NaN, NaN).foam.y, 0);
});
