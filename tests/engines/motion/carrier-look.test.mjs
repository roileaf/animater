import test from 'node:test';
import assert from 'node:assert/strict';
import { lookFor, coatOf, rollPhase, framePath, groupOf, isPainted, teamStep, packSize, SETS, headingOf, travelOf, lookStep, lookSize, trueSquares, bodyRide, leanTurn, CARRIER_LOOKS, COATS, ROLL_FRAMES, LOOK, breathAt, BREATH_PERIOD, BREATH_SWELL } from '../../../scripts/engines/motion/carrier-look.mjs';
import { readFileSync } from 'node:fs';

// Roi: "where is the wagon model it's supposed to get" — so a carrier wears the baked wagon, not its own picture.
test('which set a carrier wears: the GM chooses, or its kind decides, and the rest keep their picture', () => {
  assert.equal(lookFor('wagon'), 'wagon');
  assert.equal(lookFor('cart'), 'cart');
  assert.equal(lookFor('wagon', 'tilt'), 'tilt', 'the GM asked for the covered one');
  assert.equal(lookFor('wagon', 'none'), '', 'the GM wants its own picture');
  // Every kind has a look of its own now: the vehicles are painted, and a boat wears the decorations' own rowboat.
  assert.equal(lookFor('boat'), 'boat');
  assert.equal(lookFor('sled'), 'sled');
  assert.ok(isPainted('wagon') && isPainted('cart') && isPainted('sled') && isPainted('boat'));
  assert.ok(!isPainted('horse'), 'the horses are still baked frames; the animals are their own system');
  assert.equal(lookFor(''), '', 'not a carrier at all');
  assert.equal(lookFor('wagon', 'nonsense'), 'wagon', 'a look nobody offers falls back to the kind');
  // A mount wears a horse: Roi set a token to Mount and got nothing, twice. The horse is the farm sheet's, which has
  // had riding horses and draught horses in it all along, so nothing new had to be baked for it.
  assert.equal(lookFor('mount'), 'horse');
  assert.equal(framePath('horse', 1, null, 2), 'horses/1/idle/2', 'standing, it goes round its standing round');
  assert.equal(framePath('horse', 1, 2), 'horses/1/walk/2');
  assert.equal(groupOf('horse'), 'farm');
  assert.equal(groupOf('wagon'), 'vehicles');
  assert.deepEqual(Object.keys(CARRIER_LOOKS), ['', 'wagon', 'tilt', 'cart', 'sled', 'boat', 'horse', 'none']);
  assert.equal(LOOK, 'carrierLook');
});

test('each wagon keeps its own coat, and the coats are spread', () => {
  assert.equal(coatOf('abc'), coatOf('abc'), 'the same wagon is the same every time');
  const seen = new Set(Array.from({ length: 60 }, (_, i) => coatOf(`token${i}`)));
  assert.equal(seen.size, COATS, 'all three coats turn up');
  assert.ok([...seen].every((c) => c >= 0 && c < COATS));
});

test('the wheels turn with the distance rolled, and stand still when it stops', () => {
  assert.equal(rollPhase(0), 0);
  assert.equal(rollPhase(0.3), 1);
  assert.equal(rollPhase(0.6), 2);
  assert.equal(rollPhase(0.9), 3);
  assert.equal(rollPhase(1.1), 0, 'round again after one turn of the wheel');
  assert.equal(rollPhase(5.3), 1, 'and still in step far down the road');
  assert.equal(rollPhase(3.7, false), null, 'standing: the standing frame, not a frame of the turn');
  assert.ok(Array.from({ length: 40 }, (_, i) => rollPhase(i / 10)).every((p) => p >= 0 && p < ROLL_FRAMES));
});

// Roi, watching a wagon cross the map: "it doesnt actually animate the movement". Foundry draws a moving token twice in
// the same frame (its own refresh, and our ticker) and both reached the drawing, so the second read found the wagon
// exactly where the first had left it, called it stopped, and put the standing frame back. The wheels flicked between
// rolling and standing all the way down the road and never came round. The road is read once a frame now.
test('the drawing reads the road once a frame, however many times it is called', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  const draw = main.slice(main.indexOf('const drawCarrierLook'), main.indexOf('const tickCarrierLooks'));
  assert.ok(/state\.beat/.test(draw), 'it remembers which frame it last read the road in');
  assert.ok(/paintCarrierLook\(token, doc, state\.step, grid\);\s*return;/.test(draw), 'a second call in the same frame repaints what the first worked out');
  assert.ok(draw.indexOf('state.beat = beat') < draw.indexOf('state.last = at'), 'and the road is only measured once that is settled');
  // The two reads also halved every step, so a wagon rolling at a walk looked like one barely moving.
  const state = {};
  const one = lookStep({ id: 'w', kind: 'wagon', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, grid: 100 }, state);
  assert.equal(one.rolled, 1, 'one square rolled is one turn of the wheel');
});

// Roi: "you can see the horse is in front of the wagon, so the shadows arent good", and zoomed in, "SUPER low quality".
// A wagon and its horse used to be one baked picture seven metres across: the wagon got a third of the pixels and the
// pair cast one shadow from the empty air between them. The vehicle is baked alone now and the team is its own picture.
test('a wagon has a team of its own, walking its own stride out in front of it', () => {
  const team = teamStep('wagon', 1, 0, true);
  assert.equal(team.length, 1, 'one in the shafts');
  assert.equal(team[0].group, 'farm', 'the horses the farm sheet already holds');
  assert.match(team[0].path, /^draughtHorses\/1\/walk\/[0-3]$/);
  assert.ok(team[0].ahead > 10, 'out past the bed and the shafts');
  const over = Array.from({ length: 10 }, (_, i) => teamStep('wagon', 1, i * 0.4, true)[0].path);
  assert.ok(new Set(over).size > 1, 'its legs keep their own time down the road');
  // Roi: "lets have idle animation to the horse". Stopped, it goes round a standing round instead of freezing.
  assert.match(teamStep('wagon', 1, 3, false, 0, 'w')[0].path, /^draughtHorses\/1\/idle\/[0-3]$/);
  const waiting = Array.from({ length: 8 }, (_, i) => teamStep('wagon', 1, 3, false, i * 1000, 'w')[0].path);
  assert.ok(new Set(waiting).size > 2, 'and it shifts while it waits');
  assert.equal(teamStep('wagon', 1, 3, false, 0, 'a')[0].path === teamStep('wagon', 1, 3, false, 0, 'b')[0].path, false, 'two horses do not breathe as one');
  assert.equal(teamStep('cart', 0, 1, true), null, 'nothing is in the shafts of a hand cart');
  assert.equal(teamStep('horse', 0, 1, true), null, 'and nothing pulls a riding horse');
  const step = lookStep({ id: 'w', kind: 'wagon', from: { x: 0, y: 0 }, to: { x: 60, y: 0 }, grid: 100 }, {});
  assert.equal(step.group, 'vehicles');
  assert.ok(step.team?.[0]?.path, 'the step carries its team with it');
  assert.equal(lookStep({ id: 'm', kind: 'mount', from: { x: 0, y: 0 }, to: { x: 60, y: 0 }, grid: 100 }, {}).team, null);
});

// Roi: "give it 2-4 wolves that pull?" A sled is roped to a pack, not harnessed to one animal in shafts.
test('a sled is pulled by a pack of wolves, two to four of them', () => {
  const sizes = new Set(Array.from({ length: 40 }, (_, i) => packSize('sled', `s${i}`)));
  assert.ok([...sizes].every((n) => n >= 2 && n <= 4), 'never fewer than two, never more than four');
  assert.ok(sizes.size > 1, 'and not the same team on every sled');
  assert.equal(packSize('sled', 's1'), packSize('sled', 's1'), 'one sled keeps its own pack');
  assert.equal(packSize('wagon', 's1'), 1, 'a wagon still has the one in the shafts');
  assert.equal(packSize('cart', 's1'), 0, 'and a hand cart has nobody');
  const pack = teamStep('sled', 0, 0, true, 0, 's1');
  assert.equal(pack.length, packSize('sled', 's1'));
  assert.ok(pack.every((w) => w.group === 'field'), 'the wolves the field sheet already holds');
  assert.ok(pack.every((w) => /^wolf\/[0-2]\/trot\/[0-7]$/.test(w.path)), JSON.stringify(pack.map((w) => w.path)));
  // Not one animal copied: each takes its own coat and its own moment of the stride.
  assert.ok(new Set(pack.map((w) => w.path)).size === pack.length, 'no two of them move as one');
  // Two abreast, the pairs one behind the other, all of them out in front of the sled.
  assert.ok(pack.every((w) => w.ahead > SETS.sled.span * 0.33 + 2), 'clear of the sled\'s nose, out on the rope');
  if (pack.length > 1) assert.ok(pack[0].across < 0 && pack[1].across > 0, 'the first pair runs side by side');
  if (pack.length > 2) assert.ok(pack[2].ahead > pack[0].ahead, 'and the next pair runs ahead of them');
  // Roi: "i think the wolves scale is weird, they are also low quality (blurry)". Both were one fault: a frame with
  // no size baked in was drawn at a draught horse's ten feet, so a wolf came out double size and stretched soft.
  assert.ok(pack.every((w) => w.feet === 5), 'a wolf is five feet nose to tail, not a horse');
  assert.ok(teamStep('wagon', 0, 0, true).every((h) => h.feet === 10), 'and the horse keeps its own length');
  // Roi: "shouldnt there be a rope holding them to the sled?" A sled is roped; a wagon's horse is in shafts.
  assert.ok(pack.every((w) => w.rope === true));
  // Roi: "it doesnt touch the sled lol", and then "traces to corners". Each trace is made fast to a front corner of
  // the deck itself, measured off the painted sled: its deck ends 2.19 feet ahead of the middle and is 1.47 feet
  // wide to each side, where the frame's half-span is 5.5.
  assert.ok(SETS.sled.hitch.ahead > 1.5 && SETS.sled.hitch.ahead < SETS.sled.span / 2, 'on the deck, not out in the air');
  assert.ok(SETS.sled.hitch.across > 0.5 && SETS.sled.hitch.across < 2, 'at its corners, not down its middle');
  assert.ok(teamStep('wagon', 0, 0, true).every((h) => h.rope === false));
  // Standing, a wolf waits on its feet rather than going round a horse's standing round.
  const still = teamStep('sled', 0, 0, false, 0, 's1');
  assert.ok(still.every((w) => /^wolf\/[0-2]\/rest\/0$/.test(w.path)), JSON.stringify(still.map((w) => w.path)));
});

// The horses are the only carrier frames still taken from a sheet; every vehicle is painted.
test('the horse frames are the ones the farm sheet was baked with', () => {
  const map = JSON.parse(readFileSync(new URL('../../../assets/animals/farm.json', import.meta.url), 'utf8'));
  const paths = new Set(Object.keys(map.frames));
  for (let coat = 0; coat < COATS; coat++) {
    for (let p = 0; p < ROLL_FRAMES; p++) assert.ok(paths.has(framePath('horse', coat, p)), `${framePath('horse', coat, p)} is in the sheet`);
    for (let i = 0; i < 6; i++) assert.ok(paths.has(framePath('horse', coat, null, i)), `${framePath('horse', coat, null, i)} is in the sheet`);
    for (const animal of teamStep('wagon', coat, 0, true)) assert.ok(paths.has(animal.path), `${animal.path} is in the sheet`);
  }
});

// The sled's pack comes off the field sheet, which has had wolves trotting and resting in it all along.
test('the wolf frames a sled asks for are the ones the field sheet was baked with', () => {
  const map = JSON.parse(readFileSync(new URL('../../../assets/animals/field.json', import.meta.url), 'utf8'));
  const paths = new Set(Object.keys(map.frames));
  for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6']) {
    for (const rolled of [0, 0.3, 0.7, 1.4, 2.9]) {
      for (const animal of teamStep('sled', 0, rolled, true, 0, seed)) assert.ok(paths.has(animal.path), `${animal.path} is in the sheet`);
    }
    for (const animal of teamStep('sled', 0, 0, false, 0, seed)) assert.ok(paths.has(animal.path), `${animal.path} is in the sheet`);
  }
});

test('it points the way it is going, and keeps pointing there when it stops', () => {
  const quarter = Math.PI / 2;
  assert.equal(headingOf(100, 0), quarter, 'the pictures face up the sheet, so going east is a quarter turn');
  assert.ok(Math.abs(headingOf(0, -100) - 0) < 1e-9, 'going north it is drawn as baked');
  assert.equal(headingOf(0, 0, 1.23), 1.23, 'a nudge that moves it nowhere does not spin it');
  assert.equal(travelOf({ x: 0, y: 0 }, { x: 300, y: 400 }, 100), 5);
});

test('one step down the road: the frame, the heading and the distance all carry over', () => {
  const state = {};
  const first = lookStep({ id: 'w1', kind: 'wagon', from: { x: 0, y: 0 }, to: { x: 300, y: 0 }, grid: 100 }, state);
  assert.equal(first.set, 'wagon');
  assert.equal(first.rolled, 3);
  assert.equal(first.turn, Math.PI / 2, 'east');
  // A painted carrier has no frame to name: it is drawn from its set and how far it has rolled.
  assert.equal(first.path, null);
  assert.ok(first.painted && first.paint === 'wagon' && first.span === 20);
  const second = lookStep({ id: 'w1', kind: 'wagon', from: { x: 300, y: 0 }, to: { x: 350, y: 0 }, grid: 100 }, state);
  assert.equal(second.rolled, 3.5, 'the distance adds up across moves');
  const stopped = lookStep({ id: 'w1', kind: 'wagon', from: { x: 350, y: 0 }, to: { x: 350, y: 0 }, grid: 100, moving: false }, state);
  assert.equal(stopped.phase, null, 'standing still, nothing is turning');
  assert.equal(stopped.turn, Math.PI / 2, 'standing where it stopped, still facing east');
  // A boat wears the decorations' own painted rowboat, and rides as the rest do.
  const boat = lookStep({ id: 'b', kind: 'boat', from: { x: 0, y: 0 }, to: { x: 200, y: 0 }, grid: 100 }, {});
  assert.equal(boat.set, 'boat');
  assert.equal(boat.decor, 'rowboat');
  assert.equal(boat.path, null, 'nothing baked to name');
  assert.equal(boat.rolled, 2);
  assert.ok(Number.isFinite(boat.jolt) && Number.isFinite(boat.sway));
});

// Roi's mock: "wheels jolt with the ground, the body sways behind them, and the load leans a beat later".
test('the body sways as it rolls, and a rutted track throws it further than a paved road', () => {
  const road = [], track = [];
  for (let r = 0; r < 4; r += 0.05) { road.push(bodyRide(r, { rough: 0 }).sway); track.push(bodyRide(r, { rough: 1 }).sway); }
  const widest = (a) => Math.max(...a.map(Math.abs));
  assert.ok(widest(road) > 0, 'it is never dead still while rolling');
  assert.ok(widest(track) > widest(road) * 1.5, 'a rutted track throws it about');
  assert.ok(widest(track) < 0.08, 'but it sways; it does not spin');
  assert.ok(road.some((v) => v > 0) && road.some((v) => v < 0), 'it swings both ways');
  assert.equal(bodyRide(1.3, { rough: 1 }).sway, bodyRide(1.3, { rough: 1 }).sway, 'the same on every screen');
  // A loaded wagon swings further and slower than an empty one.
  const empty = widest(Array.from({ length: 80 }, (_, i) => bodyRide(i / 20, { load: 0 }).sway));
  const laden = widest(Array.from({ length: 80 }, (_, i) => bodyRide(i / 20, { load: 1 }).sway));
  assert.ok(laden > empty);
});

test('a wheel drops now and then, kicking the body sideways, and never for long', () => {
  const rides = Array.from({ length: 800 }, (_, i) => bodyRide(i / 40, { rough: 1 }));
  const kicks = rides.filter((r) => r.jolt > 0);
  assert.ok(kicks.length > 0, 'wheels do drop');
  assert.ok(kicks.length < rides.length * 0.2, 'but it is a jolt, not a permanent shudder');
  assert.ok(kicks.every((r) => r.jolt <= 1.6 && r.shove !== 0), 'a drop always throws it somewhere');
  assert.ok(kicks.some((r) => r.shove > 0) && kicks.some((r) => r.shove < 0), 'and not always the same way');
  assert.equal(bodyRide(3, { rough: 0 }).jolt < bodyRide(3, { rough: 1 }).jolt || bodyRide(3, { rough: 1 }).jolt === 0, true);
});

test('coming round, it swings wide and comes straight after', () => {
  const east = Math.PI / 2, south = Math.PI;
  const first = leanTurn(east, south, 0.3);
  assert.ok(first > east && first < south, 'part of the way round, not all of it');
  let now = east;
  for (let i = 0; i < 12; i++) now = leanTurn(now, south, 0.3);
  assert.ok(Math.abs(now - south) < 0.01, 'and straight again a moment later');
  assert.equal(leanTurn(undefined, south), south, 'with nowhere to lean from, it simply points the right way');
  // The short way round: from just west of north to just east of it, never the long way about.
  assert.ok(leanTurn(-3.0, 3.0, 0.2) < -3.0, 'it turns the short way');
});

test('a step down the road carries the ride with it', () => {
  const state = {};
  const step = lookStep({ id: 'w', kind: 'wagon', from: { x: 0, y: 0 }, to: { x: 260, y: 0 }, grid: 100 }, state);
  assert.ok(Number.isFinite(step.drawn) && Number.isFinite(step.jolt));
  assert.notEqual(step.drawn, step.turn, 'what is drawn leans off the way it is going');
  const stopped = lookStep({ id: 'w', kind: 'wagon', from: { x: 260, y: 0 }, to: { x: 260, y: 0 }, grid: 100, moving: false }, state);
  assert.equal(stopped.jolt, 0, 'standing still, nothing jolts it');
  assert.equal(stopped.sway, 0, 'and it does not sway on the spot');
});

test('the picture is as long as the token is, and never shorter than the vehicle really is', () => {
  assert.deepEqual(lookSize(2, 1, 100), { w: 200, h: 200 });
  assert.deepEqual(lookSize(1, 3, 100), { w: 300, h: 300 });
  assert.deepEqual(lookSize(1, 1, 150), { w: 150, h: 150 });
  // Roi: "something about the scale still doesnt fit". A wagon is ten feet by ten in the game's own vehicle list, so on
  // a five-foot grid its bed is two squares whatever size token the GM gave it — fitted to one square, the horse in
  // front of it came out smaller than the man standing beside it.
  assert.deepEqual(lookSize(1, 1, 100, { set: 'wagon' }), { w: 200, h: 200 }, 'a wagon on a one-square token is still a wagon');
  assert.deepEqual(lookSize(1, 1, 100, { set: 'tilt' }), { w: 200, h: 200 });
  assert.deepEqual(lookSize(1, 1, 100, { set: 'cart' }), { w: 200, h: 200 }, 'a cart is ten feet long too, and five wide');
  assert.deepEqual(lookSize(3, 1, 100, { set: 'wagon' }), { w: 300, h: 300 }, 'a bigger token still makes a bigger wagon');
  assert.deepEqual(lookSize(1, 1, 100, { set: 'wagon', feet: 10 }), { w: 100, h: 100 }, 'on a ten-foot grid it is one square');
  assert.deepEqual(lookSize(1, 1, 100, { set: '' }), { w: 100, h: 100 }, 'nothing baked, nothing claimed');
  assert.deepEqual(trueSquares('wagon', 5), { long: 2, wide: 2 });
  assert.deepEqual(trueSquares('cart', 5), { long: 2, wide: 1 });
  assert.equal(trueSquares('', 5), null);
});

// Roi, of the sled's pack standing still: "no idle animation". The wolves have one `rest` frame baked and no more,
// so the standing round cannot come off the sheet — it comes from the body, as Animater's idle life breathes a
// creature: one slow swell across the ribs, each animal on its own clock.
test('a waiting team breathes, each on its own clock, and a moving one does not', () => {
  const still = teamStep('sled', 0, 0, false, 0, 's1');
  assert.ok(still.length >= 2);
  assert.ok(still.every((a) => Number.isFinite(a.breath)), 'every one of them has a breath');
  assert.equal(new Set(still.map((a) => a.breath)).size, still.length, 'and no two breathe as one body');
  assert.ok(still.every((a) => a.breath >= 0 && a.breath <= 1));
  // Moving, its legs are its life: nothing swells.
  assert.ok(teamStep('sled', 0, 2, true, 0, 's1').every((a) => a.breath === 0));
  // One breath, there and back, over its period.
  const quarter = BREATH_PERIOD * 1000 / 4;
  const round = [0, quarter, quarter * 2, quarter * 3, quarter * 4].map((ms) => breathAt(ms, 'w'));
  assert.ok(Math.abs(round[0] - round[4]) < 1e-9, 'it comes back round');
  assert.ok(round[1] !== round[3], 'and breathes out as well as in');
  assert.ok(BREATH_SWELL > 0 && BREATH_SWELL <= 0.03, 'a breath, not a bellows');
  // The same shape and size as any other body's idle breathing (condition-body idle-breathe).
  const body = readFileSync(new URL('../../../scripts/engines/motion/condition-body.mjs', import.meta.url), 'utf8');
  assert.match(body, /case 'idle-breathe': return \{ sy: 1 - 0\.025 \* k/);
});
