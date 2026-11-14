import test from 'node:test';
import assert from 'node:assert/strict';
import { boarding, boardList, stillAboard, ridePlan, landPlan, aroundSpots, boardLabel, carrierAt, pulledOff, carrierKind, kindLabel, capacityOf, overCapacity, tooBig, CARRIER_KINDS, ABOARD, KIND, STOW, RIDING } from '../../../scripts/engines/motion/carriers.mjs';

// Roi: a wagon the GM "can put and remove quickly and put all tokens inside".
const wagon = { id: 'w', x: 1000, y: 1000, elevation: 0 };
const party = [
  { id: 'a', x: 900, y: 940, elevation: 0 },
  { id: 'b', x: 1060, y: 940, elevation: 0 },
  { id: 'c', x: 900, y: 1080, elevation: 0 },
];

test('who may get on: not the carrier, not twice, and never a wagon inside a wagon', () => {
  const all = [...party, wagon, { id: 'cart', x: 1200, y: 1000, carries: [{ id: 'z' }] }];
  assert.deepEqual(boarding(wagon, all).map((t) => t.id), ['a', 'b', 'c']);
  // A carrier is not cargo, loaded or empty. An empty cart on a barge used to be allowed, and then the barge moved the
  // cart as a carrier's own doing — which is exactly what the hook that would have moved the cart's passengers steps
  // aside for, so they were left standing on the bank. Two carriers can also be told to carry each other.
  assert.deepEqual(boarding(wagon, [...party, { id: 'empty', x: 1000, y: 1000, kind: 'cart' }]).map((t) => t.id), ['a', 'b', 'c']);
  const aboard = boardList(wagon, party);
  assert.deepEqual(boarding(wagon, all, aboard).map((t) => t.id), [], 'already aboard, so nobody is added twice');
  assert.equal(boardList(wagon, party, aboard).length, 3, 'loading again adds nobody');
});

test('getting on remembers where each one stood, so it can be put back there', () => {
  const aboard = boardList(wagon, party);
  assert.deepEqual(aboard.map((p) => [p.id, p.dx, p.dy]), [['a', -100, -60], ['b', 60, -60], ['c', -100, 80]]);
  assert.ok(aboard.every((p) => p.hidden === false), 'none of them was hidden before');
  const dark = boardList(wagon, [{ id: 'd', x: 1000, y: 1000, hidden: true }]);
  assert.equal(dark[0].hidden, true, 'one the GM had hidden is remembered as hidden');
});

// Roi: "when boarding all tokens should gather ON the carrier square and move with it". They used to ride at whatever
// offset they happened to be standing at when they got on, strung out behind the wagon and beside it.
//
// They used to ride hidden as well, which cost them the three things the wagon was for. Foundry 14, read in a running
// world: Token#_isLightSource opens `if (hidden) return false`, so every torch aboard goes out; _isVisionSource has
// "Only display hidden tokens for the GM", so they see nothing out of it unless the system's party-vision setting is
// on, and it is off by default; and isVisible has no owner exemption, so a player cannot even see their own token. A
// party that boarded at night put out its own lights and went blind. So riding is in plain sight, and hiding is a
// thing the GM asks for by name.
test('riding: they gather onto the carrier, in plain sight, and never drift from it', () => {
  const aboard = boardList(wagon, party, [], 100);
  const moved = { ...wagon, x: 2400, y: 1600, elevation: 20 };
  const plan = ridePlan(aboard, moved);
  assert.deepEqual(plan[0], { _id: 'a', x: 2400, y: 1600, elevation: 20 }, 'on the carrier, not where it stood');
  // Rolling down the road says nothing about who can be seen. It used to say it on every move, in the middle of
  // Foundry's own movement traffic, and now and then the answer that came back from the server was the one from
  // before the move — so a party in plain sight blinked out somewhere down the road, live, for no visible reason.
  assert.ok(plan.every((p) => !('hidden' in p)), 'the ride does not touch it at all');
  // Drawn over the carrier, not under it: a rider you cannot see on the horse is not mounted.
  assert.equal(ridePlan(aboard, moved, { sort: 7 })[0].sort, 8);
  assert.equal(ridePlan(aboard, moved)[0].sort, undefined, 'and nothing is written where the caller said nothing');
  // Stow is the GM asking for it, and then it holds for everyone aboard.
  assert.ok(ridePlan(aboard, moved, { stow: true }).every((p) => p.hidden === true));
  // Getting on, and unticking Stow, are the moments it is settled: as visible as they were standing in the road.
  assert.ok(ridePlan(aboard, moved, { show: true }).every((p) => p.hidden === false));
  // One the GM had hidden himself before it got on stays hidden through all of it.
  const dark = boardList(wagon, [{ id: 'd', x: 1000, y: 1000, hidden: true }], [], 100);
  assert.equal(ridePlan(dark, moved, { show: true })[0].hidden, true);
  assert.ok(!('hidden' in ridePlan(dark, moved)[0]));
  // A one-square wagon seats them all in its one square; a wider one gives them a square each.
  assert.ok(plan.every((p) => p.x === 2400 && p.y === 1600));
  const big = boardList({ ...wagon, width: 2, height: 2 }, party, [], 100);
  const seats = ridePlan(big, { ...wagon, width: 2, height: 2 });
  assert.deepEqual(seats.map((p) => [p.x - wagon.x, p.y - wagon.y]), [[0, 0], [100, 0], [0, 100]], 'a square each, across the ground it covers');
  // Ten moves later they are still exactly where they sit on the deck, not a pixel further.
  let now = moved;
  for (let i = 0; i < 10; i++) { now = { ...now, x: now.x + 137, y: now.y - 91 }; }
  const after = ridePlan(aboard, now);
  assert.deepEqual([after[0].x - now.x, after[0].y - now.y], [0, 0]);
  // Where they got on is still kept, because that is where they are put down again.
  assert.deepEqual([aboard[0].dx, aboard[0].dy], [-100, -60]);
});

// Roi: "when disembarking the carried tokens should exit next to the carrier not in their original place".
test('getting off: out beside the carrier wherever it stopped, off anything in the way', () => {
  const aboard = boardList(wagon, party, [], 100);
  const stopped = { ...wagon, x: 500, y: 500 };
  const plain = landPlan(aboard, stopped, { grid: 100 });
  assert.ok(plain.every((p) => Math.hypot(p.x - 500, p.y - 500) <= 150), 'all of them within a square of it');
  assert.ok(plain.every((p) => !(p.x === 500 && p.y === 500)), 'and none left standing on it');
  assert.ok(plain.every((p) => p.hidden === false), 'and shown again');
  assert.equal(new Set(plain.map((p) => `${p.x}|${p.y}`)).size, plain.length, 'nobody on top of anybody');
  // Nowhere they got on matters any more: the wagon has gone a long way since.
  assert.ok(plain.every((p, i) => Math.hypot(p.x - (1000 + aboard[i].dx), p.y - (1000 + aboard[i].dy)) > 300));
  // A wall across one side of it: they go round, and still nobody lands on anybody.
  const blocked = landPlan(aboard, stopped, { grid: 100, free: (x, y) => x >= 500 });
  assert.ok(blocked.every((p) => p.x >= 500), 'off the far side');
  assert.ok(blocked.every((p, i) => blocked.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) >= 50)));
  // Nowhere free at all: they still get off, beside the carrier, rather than being left aboard.
  const nowhere = landPlan(aboard, stopped, { grid: 100, free: () => false });
  assert.ok(nowhere.every((p) => Math.hypot(p.x - 500, p.y - 500) <= 150));
});

// The two halves of getting out, which pulled against each other until the place they got on at was read as an offset
// from the carrier rather than a place on the map: someone who stepped up from the roadside goes back to the roadside
// in the formation they had, and someone who boarded from across the field is not thrown back across it.
test('getting off: the formation they got on in where it still fits, the ring where it does not', () => {
  const close = boardList(wagon, [{ id: 'a', x: 1000, y: 900 }], [], 100);
  const stopped = { ...wagon, x: 500, y: 500 };
  assert.deepEqual(landPlan(close, stopped, { grid: 100 }).map((p) => [p.x, p.y]), [[500, 400]], 'the roadside it stepped off, beside the wagon again');
  const far = boardList(wagon, [{ id: 'a', x: 1000, y: 400 }], [], 100);
  const out = landPlan(far, stopped, { grid: 100 })[0];
  assert.ok(Math.hypot(out.x - 500, out.y - 500) <= 150, 'six squares back is not a formation, it is a field');
  // Dropped onto the deck in the first place: there is no roadside to go back to, so it takes the ring.
  const deck = boardList(wagon, [{ id: 'a', x: 1000, y: 1000 }], [], 100);
  const off = landPlan(deck, stopped, { grid: 100 })[0];
  assert.ok(!(off.x === 500 && off.y === 500));
});

// The side matters: in a fight it is the difference between stepping out into cover and stepping out into the archers.
test('getting off: the side the GM is pointing at is tried first', () => {
  const aboard = boardList(wagon, [{ id: 'a', x: 1000, y: 1000 }], [], 100);
  const east = landPlan(aboard, wagon, { grid: 100, toward: 0 })[0];
  const west = landPlan(aboard, wagon, { grid: 100, toward: Math.PI })[0];
  assert.ok(east.x > wagon.x && west.x < wagon.x, `east ${east.x} west ${west.x}`);
  const north = landPlan(aboard, wagon, { grid: 100, toward: -Math.PI / 2 })[0];
  assert.ok(north.y < wagon.y);
});

// Hex and gridless maps are exactly where wagons live. A ring of squares laid out in grid steps is not a ring there,
// so the places round the carrier are a real ring instead, and everyone rides at the carrier's own place.
test('on a grid that is not squares, the seats stack and the ring is a ring', () => {
  const spots = aroundSpots({ x: 0, y: 0, width: 1, height: 1 }, 100, 2, { square: false });
  assert.equal(spots.length, 6 + 12, 'six places close in, twelve further out');
  const reach = spots.slice(0, 6).map((s) => Math.hypot(s.dx, s.dy));
  assert.ok(reach.every((r) => Math.abs(r - reach[0]) < 1e-9), 'the near ones are all the same distance out');
  assert.ok(Math.hypot(spots[6].dx, spots[6].dy) > reach[0], 'and the far ones are further');
  const aboard = boardList({ ...wagon, width: 2, height: 2 }, party, [], 100, { square: false });
  assert.ok(aboard.every((p) => p.ax === 0 && p.ay === 0), 'no row of seats to lay out: they ride where it rides');
});

// PF2e gives every vehicle a Crew and a Passengers line. Nothing here refuses the GM — it tells them once that this
// is nine people in a rowboat, and lets them have their nine people in a rowboat.
test('what each kind holds, and who is plainly too big for it', () => {
  assert.equal(capacityOf('cart'), 2);
  assert.equal(capacityOf('mount'), 1);
  assert.equal(capacityOf('party'), Infinity, 'a token merely told to carry holds what the GM puts in it');
  assert.equal(capacityOf('nonsense'), Infinity);
  assert.equal(overCapacity('boat', 4), 0);
  assert.equal(overCapacity('boat', 9), 5);
  assert.equal(tooBig({ width: 1, height: 1 }, { width: 2, height: 1 }), true, 'a horse does not get into a hand cart');
  assert.equal(tooBig({ width: 2, height: 2 }, { width: 1, height: 1 }), false);
});

test('a passenger keeps the height it had over the carrier, riding and landing', () => {
  const aboard = boardList({ ...wagon, elevation: 5 }, [{ id: 'a', x: 1000, y: 1000, elevation: 15 }]);
  assert.equal(aboard[0].dz, 10);
  assert.equal(ridePlan(aboard, { ...wagon, elevation: 30 })[0].elevation, 40);
  assert.equal(landPlan(aboard, { ...wagon, elevation: 30 })[0].elevation, 40);
});

test('a passenger whose token is gone simply stops being aboard; nothing is ever deleted', () => {
  const aboard = boardList(wagon, party);
  const left = stillAboard(aboard, (id) => id !== 'b');
  assert.deepEqual(left.map((p) => p.id), ['a', 'c']);
  assert.equal(stillAboard(aboard).length, 3, 'with no check, everyone stays');
});

test('the button says what the next press does', () => {
  assert.deepEqual(boardLabel([], 4), { action: 'load', who: 'picked', label: 'Load 4', count: 4 });
  assert.deepEqual(boardLabel([{ id: 'a' }, { id: 'b' }], 0), { action: 'unload', label: 'Unload 2', count: 2 });
  assert.equal(boardLabel([{ id: 'a' }], 3).action, 'unload', 'with passengers aboard, unloading comes first');
  assert.equal(boardLabel([], 0).action, 'none');
  // Roi: "when i have no token selected i want to press the button to carry all party members".
  assert.deepEqual(boardLabel([], 0, 5), { action: 'load', who: 'party', label: 'Load the party (5)', count: 5 });
  assert.equal(boardLabel([], 2, 5).who, 'picked', 'what the GM picked out beats the whole party');
  assert.equal(boardLabel([{ id: 'a' }], 0, 5).action, 'unload', 'and a loaded carrier still unloads first');
  assert.equal(ABOARD, 'aboard');
});

// Roi: "it needs to be more intuitive" — so a token dropped on a wagon gets in, and one pulled off it gets out. Only a
// token told it is a carrier takes anyone, or walking past a cart would stow you in it.
test('a token dropped on a carrier finds it, and nothing else takes passengers', () => {
  const wagon = { id: 'w', kind: 'wagon', x: 1000, y: 1000, width: 2, height: 1 };
  const rock = { id: 'r', kind: '', x: 1000, y: 1000, width: 4, height: 4 };
  assert.equal(carrierAt({ x: 1050, y: 1050 }, [wagon, rock], 100)?.id, 'w');
  assert.equal(carrierAt({ x: 1150, y: 1050 }, [wagon, rock], 100)?.id, 'w', 'the far square of a two-wide wagon');
  assert.equal(carrierAt({ x: 1350, y: 1050 }, [wagon, rock], 100), null, 'past its end is not aboard');
  assert.equal(carrierAt({ x: 1050, y: 1050 }, [rock], 100), null, 'a token that is not a carrier takes nobody');
});

test('a cart standing on a barge takes the passenger, not the barge under it', () => {
  const barge = { id: 'b', kind: 'boat', x: 900, y: 900, width: 6, height: 3 };
  const cart = { id: 'c', kind: 'cart', x: 1000, y: 1000, width: 1, height: 1 };
  assert.equal(carrierAt({ x: 1050, y: 1050 }, [barge, cart], 100)?.id, 'c');
  assert.equal(carrierAt({ x: 950, y: 950 }, [barge, cart], 100)?.id, 'b', 'off the cart, the barge has it');
});

test('a passenger pulled clear of the wagon is getting out; one dropped back on it is not', () => {
  const wagon = { x: 1000, y: 1000, width: 2, height: 1 };
  assert.equal(pulledOff({ x: 1400, y: 1000 }, wagon, 100), true);
  assert.equal(pulledOff({ x: 1100, y: 1050 }, wagon, 100), false, 'still on the deck');
});

test('the kinds are a short list, and anything unknown is simply not a carrier', () => {
  assert.equal(carrierKind('wagon'), 'wagon');
  assert.equal(carrierKind('spaceship'), '');
  assert.equal(carrierKind(undefined), '');
  assert.equal(kindLabel('boat'), 'Boat');
  assert.equal(kindLabel('nonsense'), 'Not a carrier');
  // The drawn one is a barrow and it sounds like a barrow, so the list says so: a GM picking "Cart" off the game's
  // own vehicle list means a thing an ox pulls, and was getting a wheelbarrow without being told.
  assert.equal(kindLabel('cart'), 'Cart (hand cart)');
  assert.equal(STOW, 'carrierStow');
  assert.equal(RIDING, 'ridingOn');
  assert.deepEqual(Object.keys(CARRIER_KINDS), ['', 'party', 'wagon', 'cart', 'boat', 'sled', 'mount']);
  // Roi: "it's really hard to mount currently" — so pressing Load on a plain token makes it one, with nothing added.
  assert.equal(carrierKind('party'), 'party');
  assert.equal(kindLabel('party'), 'Carries (nothing added)');
  assert.equal(KIND, 'carrier');
});
