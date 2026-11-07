import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOORS, FLOOR_CHOICES, FLOOR_LOOK, autoFloor, sceneFloor, regionFloor, floorAt, isFlying, shadowGeometry, shadowFalls,
  createStrideTracker, puffsFor, particleState, movementDensity, footstepFile, createMovementFeel, STRIDE,
  FOOTSTEP_FILES, footstepVolume, footstepVariation, PARTICLE_KINDS, stepWeight, stepGap, createStepPacer, thudFile,
  thudLevel, TRACKS, audioPeakMs, thudDelayMs, THUD_PEAK_MS, perceive,
} from '../../../scripts/engines/motion/movement-feel.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {carriedPrints,bloodDrop} from '../../../scripts/engines/motion/ground-trails.mjs';

test('floors: every choice has a look, and the select starts with From the scene', () => {
  assert.deepEqual(FLOORS, ['stone', 'wood', 'dirt', 'grass', 'sand', 'snow', 'water', 'ice', 'mud', 'pebbles', 'glass', 'metal', 'lava']);
  assert.equal(FLOOR_CHOICES[0][0], '');
  assert.match(FLOOR_CHOICES[0][1], /From the scene/);
  for (const floor of FLOORS) {
    assert.ok(FLOOR_LOOK[floor], floor);
    assert.ok(FLOOR_LOOK[floor].parts.length >= 1, floor);
    for (const part of FLOOR_LOOK[floor].parts) assert.ok(PARTICLE_KINDS.includes(part.kind), `${floor} ${part.kind}`);
  }
  assert.ok(FLOOR_CHOICES.some(([v]) => v === 'ice') && FLOOR_CHOICES.some(([v]) => v === 'mud'));
});

// What each floor kicks up over a few strides: its particle kinds (and whether a print shows).
const kindsOf = (floor, strides = 16) => {
  const kinds = new Set();
  for (let index = 0; index < strides; index++) for (const p of puffsFor(floor, { x: 0, y: 0, heading: 0, index }, { seed: 'k', grid: 100 })) kinds.add(p.kind);
  return [...kinds].sort();
};

test('puffsFor: every floor has its own look', () => {
  const expected = {
    stone: ['chip', 'puff'], wood: ['chip', 'fleck'], dirt: ['chip', 'puff'], grass: ['blade', 'fleck', 'trample', 'tuft'], sand: ['chip', 'print', 'puff'],
    snow: ['chip', 'print', 'puff'], water: ['drop', 'ring'], ice: ['chip', 'crack', 'spark', 'streak'], mud: ['blob', 'print'], pebbles: ['chip', 'puff'], glass: ['puff', 'spark'], metal: ['chip', 'spark'], lava: ['chip', 'spark'],
  };
  const signatures = new Set();
  for (const floor of FLOORS) {
    assert.deepEqual(kindsOf(floor, 40), expected[floor], floor);
    const colors = puffsFor(floor, { x: 0, y: 0, heading: 0, index: 1 }, { seed: 'k', grid: 100 }).map((p) => p.color).sort().join();
    signatures.add(`${expected[floor].join()}|${colors}`);
    for (const p of puffsFor(floor, { x: 0, y: 0, heading: 0, index: 2 }, { seed: 'k', grid: 100 })) {
      for (const key of ['x', 'y', 'vx', 'vy', 'radius', 'alpha', 'grow', 'delay', 'life', 'rotation', 'spin']) assert.ok(Number.isFinite(p[key]), `${floor} ${p.kind} ${key}`);
      assert.ok(p.radius > 0 && p.life > 0 && p.alpha > 0 && p.alpha <= 1, `${floor} ${p.kind}`);
    }
  }
  assert.equal(signatures.size, FLOORS.length);
  // Unknown floors look like stone.
  assert.deepEqual(kindsOf('cheese'), kindsOf('stone'));
});

test('puffsFor: prints alternate sides, follow the heading and scale with the token', () => {
  for (const floor of ['sand', 'snow', 'mud']) {
    const heading = Math.PI / 2;
    const print = (index, width = 100) => puffsFor(floor, { x: 500, y: 500, heading, index }, { seed: 'p', grid: 100, width }).find((p) => p.kind === 'print');
    const a = print(1), b = print(2);
    assert.ok(a && b, floor);
    for (const p of [a, b]) assert.ok(Math.abs(p.rotation - heading) <= ((7 + 4) * Math.PI) / 180 + 1e-9, 'near the heading, its own way');
    // Heading straight down (+y): the side offset is along x, opposite for each foot, none along the path.
    assert.ok(Math.abs(a.y - 500) <= 2.5 && Math.abs(b.y - 500) <= 2.5, floor);
    assert.ok(Math.sign(a.x - 500) === -Math.sign(b.x - 500) && a.x !== 500, floor);
    assert.deepEqual([a.vx, a.vy, a.grow], [0, 0, 0]);
    const big = print(1, 300);
    assert.ok(big.radius > a.radius * 2.5);
    assert.ok(Math.abs(big.x - 500) > Math.abs(a.x - 500) * 2.5);
    // A print fades slowly: still most of the way there halfway through its life.
    const half = particleState(a, a.delay + a.life / 2);
    assert.ok(half.alpha > a.alpha * 0.5, floor);
    assert.equal(half.rotation, a.rotation);
  }
  const life = (floor) => puffsFor(floor, { x: 0, y: 0, heading: 0, index: 1 }, { seed: 'p', grid: 100 }).find((p) => p.kind === 'print').life;
  assert.ok(Math.abs(life('sand') - 6000) <= 1000);
  assert.ok(Math.abs(life('mud') - 12000) <= 1500);
  assert.ok(Math.abs(life('snow') - 20000) <= 2500);
});

// The tracks one stride leaves in mud for a gait, as offsets [along, across] from the foot in token widths.
const tracks = (gait, index, { width = 100, heading = 0 } = {}) => puffsFor('mud', { x: 500, y: 500, heading, index }, { seed: 'g', grid: 100, width, gait })
  .filter((p) => p.kind === 'print' || p.kind === 'groove');
const offsets = (list, width = 100) => list.filter((p) => p.kind === 'print').map((p) => [Math.round(((p.x - 500) / width) * 100) / 100, Math.round(((p.y - 500) / width) * 100) / 100]);

test('puffsFor: bipeds (boots, talons) alternate one print per stride, shaped by their gait', () => {
  for (const gait of ['boots', 'talons']) {
    const a = tracks(gait, 1), b = tracks(gait, 2), c = tracks(gait, 3);
    assert.equal(a.length, 1, gait);
    assert.equal(a[0].gait, gait);
    assert.ok(Math.sign(a[0].y - 500) === -Math.sign(b[0].y - 500) && a[0].y !== 500, gait);
    offsets(c).forEach(([d, s], i) => { assert.ok(Math.abs(d - offsets(a)[i][0]) <= 0.06 && Math.abs(s - offsets(a)[i][1]) <= 0.05, gait); });
  }
  // No gait is boots.
  assert.equal(puffsFor('mud', { x: 0, y: 0, heading: 0, index: 1 }, { seed: 'g', grid: 100 }).find((p) => p.kind === 'print').gait, 'boots');
});

test('puffsFor: quadrupeds leave a front and hind print per stride, four per two-stride cycle, smaller prints', () => {
  for (const gait of ['paws', 'hooves', 'claws']) {
    const one = offsets(tracks(gait, 1)), two = offsets(tracks(gait, 2));
    assert.equal(one.length, 2, gait);
    assert.equal(two.length, 2, gait);
    const cycle = [...one, ...two].map(String);
    assert.equal(new Set(cycle).size, 4, `${gait}: four distinct feet`);
    // Front ahead of hind, both on one side, the other side next stride.
    assert.ok(one[0][0] > one[1][0] && Math.sign(one[0][1]) === Math.sign(one[1][1]) && Math.sign(one[0][1]) === -Math.sign(two[0][1]), gait);
    offsets(tracks(gait, 3)).forEach(([d, a], i) => { assert.ok(Math.abs(d - one[i][0]) <= 0.06 && Math.abs(a - one[i][1]) <= 0.05, gait); });
    assert.ok(tracks(gait, 1).find((p) => p.kind === 'print').radius < tracks('boots', 1)[0].radius, gait);
    for (const p of tracks(gait, 1).filter((q) => q.kind === 'print')) assert.equal(p.gait, gait);
  }
  // Claws drag a thin tail line between the prints; paws and hooves do not.
  assert.ok(tracks('claws', 1).some((p) => p.kind === 'groove' && p.gait === 'claws'));
  assert.ok(!tracks('paws', 1).some((p) => p.kind === 'groove'));
});

test('puffsFor: slither and ooze leave a continuous groove or smear, never prints; none leaves nothing', () => {
  for (const [gait, shape] of [['slither', 'slither'], ['ooze', 'ooze']]) {
    for (let index = 0; index < 6; index++) {
      const list = tracks(gait, index);
      assert.equal(list.length, 1, gait);
      assert.equal(list[0].kind, 'groove');
      assert.equal(list[0].gait, shape);
      // Spans the stride just walked: centred half a stride back, a little over half a stride in radius.
      assert.ok(Math.abs(list[0].x - (500 - STRIDE * 50)) < 1e-6 && list[0].radius >= STRIDE * 50, gait);
    }
    // The wave flips every stride so its halves join.
    assert.equal(tracks(gait, 1)[0].flip, -tracks(gait, 2)[0].flip);
  }
  assert.ok(tracks('slither', 1)[0].amp > 0 && tracks('slither', 1)[0].thick > 0);
  assert.ok(tracks('ooze', 1)[0].ry > 0);
  // Many legs: one dot cluster per stride.
  assert.equal(tracks('legs', 1).length, 1);
  assert.equal(tracks('legs', 1)[0].gait, 'legs');
  // None: no prints, no dust either, on any floor.
  for (const floor of FLOORS) assert.deepEqual(puffsFor(floor, { x: 0, y: 0, heading: 0, index: 1 }, { seed: 'g', grid: 100, gait: 'none' }), [], floor);
  // Unknown: the floor's own dust exactly as boots raise it, but no prints or grooves.
  for (const floor of FLOORS) for (const index of [1, 2, 3]) {
    const at = { x: 0, y: 0, heading: 0, index };
    const unknown = puffsFor(floor, at, { seed: 'g', grid: 100, gait: 'unknown' });
    assert.ok(!unknown.some((p) => p.kind === 'print' || p.kind === 'groove'), floor);
    assert.deepEqual(unknown, puffsFor(floor, at, { seed: 'g', grid: 100 }).filter((p) => p.kind !== 'print'), floor);
    assert.ok(unknown.length > 0, floor);
  }
});

test('puffsFor: tracks are seeded and the same on every screen; huge creatures print bigger and less often', () => {
  for (const gait of ['boots', 'paws', 'talons', 'dragon', 'hooves', 'claws', 'slither', 'ooze', 'legs']) {
    assert.deepEqual(tracks(gait, 4, { heading: 0.7 }), tracks(gait, 4, { heading: 0.7 }), gait);
  }
  const strides = (width) => Array.from({ length: 12 }, (_, i) => tracks('boots', i + 1, { width }).length).reduce((a, b) => a + b, 0);
  assert.equal(strides(100), 12);
  assert.equal(strides(300), 6);
  assert.equal(strides(600), 4);
  // Huge prints still alternate sides from one print to the next.
  const huge = [1, 3, 5].map((i) => offsets(tracks('boots', i, { width: 300 }), 300)[0][1]);
  assert.ok(Math.sign(huge[0]) === -Math.sign(huge[1]) && Math.sign(huge[1]) === -Math.sign(huge[2]));
  assert.ok(tracks('boots', 1, { width: 300 })[0].radius > tracks('boots', 1, { width: 50 })[0].radius * 5);
});

test('controller: a token passes its gait; none makes no marks and no steps, grooves share the print cap', () => {
  const ghost = { id: 'g', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, gait: 'none' };
  const steps = [];
  const h = harness({ tokens: [ghost], floor: 'mud', steps });
  h.feel.tick();
  for (let i = 1; i <= 4; i++) { ghost.x = i * STRIDE * 100; h.advance(16); h.feel.tick(); }
  assert.equal(h.log.added, 0);
  assert.equal(steps.length, 0);
  // An unknown creature still raises dust and steps, just leaves no tracks.
  const odd = { id: 'u', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, gait: 'unknown' };
  const oddSteps = [];
  const u = harness({ tokens: [odd], floor: 'mud', steps: oddSteps });
  u.feel.tick();
  for (let i = 1; i <= 4; i++) { odd.x = i * STRIDE * 100; u.advance(16); u.feel.tick(); }
  assert.ok(u.log.added > 0 && oddSteps.length >= 4);
  assert.ok(![...u.live].some((p) => p.spec.kind === 'print' || p.spec.kind === 'groove'));
  const snake = { id: 's', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, gait: 'slither' };
  const s = harness({ tokens: [snake], floor: 'mud', printCap: 2 });
  s.feel.tick();
  for (let i = 1; i <= 6; i++) { snake.x = i * STRIDE * 100; s.advance(16); s.feel.tick(); }
  const live = [...s.live];
  assert.equal(live.filter((p) => p.spec.kind === 'groove').length, 2);
  assert.ok(!live.some((p) => p.spec.kind === 'print'));
  assert.equal(s.feel.prints, 2);
});

test('puffsFor: an ice crack about one stride in eight, the same on every screen', () => {
  const cracks = (seed) => Array.from({ length: 800 }, (_, index) => puffsFor('ice', { x: 0, y: 0, heading: 0, index }, { seed, grid: 100 }).some((p) => p.kind === 'crack'));
  const a = cracks('ice-tok');
  assert.deepEqual(cracks('ice-tok'), a);
  const n = a.filter(Boolean).length;
  assert.ok(n > 60 && n < 150, `${n} cracks in 800 strides`);
  const crack = Array.from({ length: 40 }, (_, index) => puffsFor('ice', { x: 0, y: 0, heading: 0, index }, { seed: 'ice-tok', grid: 100 })).flat().find((p) => p.kind === 'crack');
  assert.ok(Array.isArray(crack.points) && crack.points.length >= 1);
  for (const line of crack.points) {
    assert.ok(line.length >= 4 && line.length % 2 === 0);
    assert.ok(line.every((v) => Number.isFinite(v) && Math.abs(v) <= 1.0001));
  }
  // The skid follows the heading.
  const skid = puffsFor('ice', { x: 0, y: 0, heading: 1.2, index: 3 }, { seed: 's', grid: 100 }).find((p) => p.kind === 'streak');
  assert.equal(skid.rotation, 1.2);
});

test('puffsFor: Low density halves the thrown bits but keeps prints and the foot marks', () => {
  for (const floor of FLOORS) {
    const at = { x: 0, y: 0, heading: 0, index: 5 };
    const full = puffsFor(floor, at, { seed: 'd', grid: 100 }), half = puffsFor(floor, at, { seed: 'd', grid: 100, density: 0.5 });
    assert.ok(half.length >= 1 && half.length <= full.length, floor);
    for (const kind of ['print', 'scuff', 'tuft', 'trample', 'ring']) assert.equal(half.filter((p) => p.kind === kind).length, full.filter((p) => p.kind === kind).length, `${floor} ${kind}`);
  }
  assert.ok(puffsFor('stone', { x: 0, y: 0, heading: 0, index: 1 }, { seed: 'd', grid: 100, density: 0.5 }).length
    < puffsFor('stone', { x: 0, y: 0, heading: 0, index: 1 }, { seed: 'd', grid: 100 }).length);
});

test('particleState: spins, hops, sways back and twinkles out', () => {
  const at = { x: 0, y: 0, heading: 0, index: 1 };
  const chip = puffsFor('stone', at, { seed: 'r', grid: 100 }).find((p) => p.kind === 'chip');
  assert.ok(chip.spin !== 0 && chip.hop > 0);
  const c0 = particleState(chip, chip.delay), c1 = particleState(chip, chip.delay + chip.life * 0.15);
  assert.notEqual(c1.rotation, c0.rotation);
  // Mid-hop it is lifted off its ground path; it bounces lower; then it rests and only fades.
  assert.ok(c1.lift > 0.5);
  assert.ok(particleState(chip, chip.delay + chip.life * 0.44).lift < chip.hop * chip.bounce + 1e-6, 'its bounce is lower');
  assert.ok(particleState(chip, chip.delay + chip.life * 0.44).lift > 0, 'it does bounce');
  const l1 = particleState(chip, chip.delay + chip.life * 0.6), l2 = particleState(chip, chip.delay + chip.life * 0.8);
  assert.equal(l1.lift, 0, 'lying on the floor');
  assert.ok(Math.abs(l1.x - l2.x) < 1e-6 && Math.abs(l1.y - l2.y) < 1e-6 && l1.rotation === l2.rotation);
  const tuft = puffsFor('grass', at, { seed: 'r', grid: 100 }).find((p) => p.kind === 'tuft');
  const bent = particleState(tuft, tuft.delay + 1), end = particleState(tuft, tuft.delay + tuft.life - 1);
  assert.ok(Math.abs(bent.rotation - tuft.rotation) > 0.2);
  assert.ok(Math.abs(end.rotation - tuft.rotation) < 0.05);
  const spark = puffsFor('ice', at, { seed: 'r', grid: 100 }).find((p) => p.kind === 'spark');
  assert.ok(particleState(spark, spark.delay + spark.life * 0.9).scale < 1);
  assert.ok(spark.twinkle > 0);
  // Old specs with no rotation fields still work.
  assert.equal(particleState({ x: 0, y: 0, vx: 0, vy: 0, alpha: 1, grow: 0, delay: 0, life: 100 }, 10).rotation, 0);
});

test('controller: prints have their own cap, drop the oldest, and never starve dust', () => {
  const tok = { id: 't', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true };
  const h = harness({ tokens: [tok], floor: 'mud', cap: 3, printCap: 2 });
  h.feel.tick();
  for (let i = 1; i <= 6; i++) { tok.x = i * STRIDE * 100; h.advance(16); h.feel.tick(); }
  const live = [...h.live], prints = live.filter((p) => p.spec.kind === 'print');
  assert.equal(prints.length, 2);
  assert.ok(live.length - prints.length <= 3);
  assert.ok(live.some((p) => p.spec.kind === 'blob'), 'dust still shows with prints at their cap');
  assert.equal(h.feel.prints, 2);
  // The newest prints stay.
  assert.ok(prints.every((p) => p.spec.x > STRIDE * 100 * 4));
  h.feel.clear();
  assert.equal(h.feel.size, 0);
  assert.equal(h.feel.prints, 0);
});

test('controller: footprint lifetime follows the ground and expires independently of dust', () => {
  const token={id:'life',x:0,y:0,width:100,elevation:0,base:0,visible:true};
  const reads=[];
  const h=harness({tokens:[token],floor:at=>at.x<100?'sand':'snow',printLifetime:floor=>{reads.push(floor);return floor==='sand'?2000:10000;}});
  h.feel.tick();token.x=80;h.advance(16);h.feel.tick();token.x=160;h.advance(16);h.feel.tick();
  assert.ok([...h.live].some(p=>p.spec.kind==='print'&&p.spec.life===2000));
  assert.ok([...h.live].some(p=>p.spec.kind==='print'&&p.spec.life===10000));
  assert.ok([...h.live].filter(p=>p.spec.kind!=='print').every(p=>p.spec.life!==10000),'dust retains native timing');
  h.advance(2100);h.feel.tick();assert.ok(h.feel.prints>0);assert.ok([...h.live].filter(p=>p.spec.kind==='print').every(p=>p.spec.life===10000));
  const snow=[...h.live].find(p=>p.spec.kind==='print');h.advance(6000);h.feel.tick();assert.ok(snow.state.alpha>0&&snow.state.alpha<snow.spec.alpha,'fades before expiring');
  h.advance(2000);h.feel.tick();assert.equal(h.feel.prints,0);
});
test('controller: changing a ground lifetime retimes existing prints; zero restores native life and reads are shared per ground',()=>{
 const token={id:'life',x:0,y:0,width:100,elevation:0,base:0,visible:true};let life=30000,reads=0;
 const h=harness({tokens:[token],floor:'snow',printLifetime:()=>{reads++;return life;}});
 h.feel.tick();token.x=150;h.advance(16);h.feel.tick();assert.equal(reads,1);assert.ok(h.feel.prints>1);
 life=0;h.advance(1000);h.feel.tick();const print=[...h.live].find(p=>p.spec.kind==='print');assert.equal(reads,2);assert.ok(print.state.alpha>0);
 life=1000;h.advance(20);h.feel.tick();assert.equal(h.feel.prints,0,'shorter lifetime removes older existing tracks');
});
test('controller: grooves use their ground lifetime and long-lived tracks keep the print budget',()=>{
 const token={id:'snake-life',x:0,y:0,width:100,elevation:0,base:0,visible:true,gait:'slither'};
 const h=harness({tokens:[token],floor:'mud',printLifetime:3600000,printCap:2});h.feel.tick();
 for(let i=1;i<=5;i++){token.x=i*STRIDE*100;h.advance(16);h.feel.tick();}
 assert.equal(h.feel.prints,2);assert.ok([...h.live].filter(p=>p.spec.kind==='groove').every(p=>p.spec.life===3600000));
 h.advance(3600001);h.feel.tick();assert.equal(h.feel.prints,0);
});
test('controller: carried prints and flattened grass use their ground lifetime, while blood keeps native timing',()=>{
 const token={id:'carry-life',x:0,y:0,width:100,elevation:0,base:0,visible:true};
 const trails={marks:(_token,at,_floor,opts)=>[...carriedPrints({floor:'mud',strength:1},at,opts),...bloodDrop(at,opts)]};
 const h=harness({tokens:[token],floor:'stone',printLifetime:floor=>floor==='stone'?3000:60000,trails});h.feel.tick();token.x=80;h.advance(16);h.feel.tick();
 assert.ok([...h.live].some(p=>p.spec.carried==='mud'&&p.spec.life===3000));
 assert.ok([...h.live].some(p=>p.spec.lasting&&p.spec.life===20000),'blood keeps native lifetime');
 h.advance(3100);h.feel.tick();assert.ok(![...h.live].some(p=>p.spec.kind==='print'));assert.ok([...h.live].some(p=>p.spec.lasting));
 const grassToken={...token,x:0},grass=harness({tokens:[grassToken],floor:'grass',printLifetime:60000});grass.feel.tick();grassToken.x=80;grass.advance(16);grass.feel.tick();
 assert.ok([...grass.live].some(p=>p.spec.kind==='trample'&&p.spec.life===60000));
});

test('autoFloor: global light, an outdoor name or background picks dirt; else stone', () => {
  assert.equal(autoFloor({ globalLight: true }), 'dirt');
  assert.equal(autoFloor({ name: 'Forest Road Ambush' }), 'dirt');
  assert.equal(autoFloor({ background: 'maps/desert_camp_day.webp' }), 'dirt');
  assert.equal(autoFloor({ name: 'Crypt of Bones', background: 'maps/dungeon-01.webp' }), 'stone');
  assert.equal(autoFloor({}), 'stone');
});

test('sceneFloor: a valid flag wins over auto', () => {
  assert.equal(sceneFloor({ flag: 'snow', name: 'Crypt' }), 'snow');
  assert.equal(sceneFloor({ flag: '', globalLight: true }), 'dirt');
  assert.equal(sceneFloor({ flag: 'cheese', name: 'Crypt' }), 'stone');
});

test('regionFloor: a flag, else a watery name, else none', () => {
  assert.equal(regionFloor({ name: 'Deep River', flag: 'sand' }), 'sand');
  for (const name of ['Water', 'river ford', 'Lake', 'pond', 'Sea shore', 'Stream', 'Swamp']) assert.equal(regionFloor({ name }), 'water', name);
  assert.equal(regionFloor({ name: 'Trap room' }), null);
  assert.equal(regionFloor({ name: 'Trap', flag: 'bogus' }), null);
});

test('floorAt: the last region containing the point overrides the scene floor', () => {
  const regions = [
    { name: 'Lake', inside: (p) => p.x < 100 },
    { name: 'Dune', flag: 'sand', inside: (p) => p.x < 50 },
    { name: 'Hall', inside: () => true },
  ];
  const testPoint = (r, p) => r.inside(p);
  assert.equal(floorAt({ x: 10, y: 0 }, { sceneFloor: 'stone', regions, testPoint }), 'sand');
  assert.equal(floorAt({ x: 70, y: 0 }, { sceneFloor: 'stone', regions, testPoint }), 'water');
  assert.equal(floorAt({ x: 500, y: 0 }, { sceneFloor: 'stone', regions, testPoint }), 'stone');
  // A broken region test never breaks the floor.
  assert.equal(floorAt({ x: 1, y: 1 }, { sceneFloor: 'grass', regions: [{ name: 'Lake' }], testPoint: () => { throw new Error('x'); } }), 'grass');
});

test('isFlying: the fly movement action or a flying status, never height alone', () => {
  assert.equal(isFlying({ elevation: 0, base: 0 }), false);
  assert.equal(isFlying({ elevation: 10, base: 0 }), false, 'standing on a ledge or platform');
  assert.equal(isFlying({ elevation: 10, base: 0, action: 'walk' }), false);
  assert.equal(isFlying({ elevation: 10, base: 0, action: 'fly' }), true);
  assert.equal(isFlying({ elevation: 0, base: 0, statuses: ['hover'] }), true);
  assert.equal(isFlying({ elevation: 0, base: 0, action: 'fly' }), true);
  assert.equal(isFlying({ elevation: 0, base: 0, statuses: new Set(['fly']) }), true);
  assert.equal(isFlying({ elevation: 0, base: 0, statuses: ['flying'] }), true);
  assert.equal(isFlying({ elevation: 0, base: 0, statuses: new Set(['prone']) }), false);
});
test('stride tracker: emits once per stride along the path, never on a first sighting or a jump', () => {
  const tracker = createStrideTracker({ stride: 60, maxJump: 300 });
  assert.deepEqual(tracker.step('a', { x: 0, y: 0 }), []);
  // The first stride is half long, so a short step still kicks up dust.
  const first = tracker.step('a', { x: 40, y: 0 });
  assert.equal(first.length, 1);
  assert.equal(first[0].x, 30);
  const more = tracker.step('a', { x: 160, y: 0 });
  assert.deepEqual(more.map((p) => p.x), [90, 150]);
  assert.ok(more.every((p) => p.heading === 0));
  assert.ok(more[1].index > more[0].index);
  // A jump (teleport, instant move) resets without dust.
  assert.deepEqual(tracker.step('a', { x: 1000, y: 0 }), []);
  assert.deepEqual(tracker.step('a', { x: 1010, y: 0 }), []);
  assert.equal(tracker.step('a', { x: 1040, y: 0 }).length, 1);
  tracker.reset('a', { x: 0, y: 0 });
  assert.deepEqual(tracker.step('a', { x: 20, y: 0 }), []);
  tracker.forget('a');
  assert.deepEqual(tracker.step('a', { x: 500, y: 0 }), []);
});

test('puffsFor: deterministic dust by floor, ripples on water, a faint scuff with grit on stone', () => {
  const at = { x: 50, y: 50, heading: 0, index: 3 };
  const a = puffsFor('dirt', at, { seed: 'tok', grid: 100 });
  const b = puffsFor('dirt', at, { seed: 'tok', grid: 100 });
  assert.deepEqual(a, b);
  assert.ok(a.length >= 3);
  assert.ok(a.filter((p) => p.kind === 'puff').every((p) => p.color === FLOOR_LOOK.dirt.parts[0].color && p.life > 0));
  assert.ok(a.some((p) => p.kind === 'chip' && p.art === 'clod' && p.shadow), 'clods thrown out of it, with their shadows');
  assert.notDeepEqual(puffsFor('dirt', { ...at, index: 4 }, { seed: 'tok', grid: 100 }), a);
  assert.ok(puffsFor('snow', at, { seed: 'tok', grid: 100 }).length > puffsFor('stone', at, { seed: 'tok', grid: 100 }).length);
  const water = puffsFor('water', at, { seed: 'tok', grid: 100 });
  assert.ok(water.some((p) => p.kind === 'ring'));
  const stone = puffsFor('stone', at, { seed: 'tok', grid: 100 });
  const dust = stone.filter((p) => p.kind === 'puff');
  assert.ok(dust.length >= 1 && dust.every((p) => p.alpha <= 0.35), 'its dust stays faint');
  assert.ok(stone.filter((p) => p.kind === 'chip').every((p) => p.art === 'stone' && p.shadow === true), 'its chips are painted, with shadows');
  assert.equal(stone.filter((p) => p.kind === 'chip' && p.thin).length, 0);
  assert.ok(puffsFor('wood', at, { seed: 'tok', grid: 100 }).some((p) => p.thin === true), 'a splinter has a long thin shadow');
  // Half density keeps half the dust (at least one).
  assert.ok(puffsFor('dirt', at, { seed: 'tok', grid: 100, density: 0.5 }).length < a.length);
  assert.equal(puffsFor('dirt', at, { seed: 'tok', grid: 100, density: 0 }).length, 0);
});

test('particleState: grows, drifts and fades, then ends', () => {
  const [p] = puffsFor('sand', { x: 0, y: 0, heading: 0, index: 1 }, { seed: 's', grid: 100 });
  const start = particleState(p, p.delay), mid = particleState(p, p.delay + p.life / 2);
  // Before its stagger delay it waits unseen.
  if (p.delay > 0) assert.equal(particleState(p, 0).alpha, 0);
  assert.ok(mid.scale > start.scale);
  assert.ok(mid.alpha < start.alpha + 1e-9);
  assert.equal(particleState(p, p.delay + p.life + 1), null);
});

test('movementDensity: Balanced and up draw all, Low half, Off none', () => {
  assert.equal(movementDensity(3), 1);
  assert.equal(movementDensity(2), 1);
  assert.equal(movementDensity(1), 0.5);
  assert.equal(movementDensity(0), 0);
});

test('footstepFile: a walk never plays the same recording twice in a row, and differs per token', () => {
  for (const floor of ['stone', 'wood', 'grass', 'snow', 'water', 'ice', 'mud']) {
    const walk = (seed) => Array.from({ length: 40 }, (_, n) => footstepFile(floor, n, { seed }));
    const a = walk('tokA');
    for (let n = 1; n < a.length; n++) assert.notEqual(a[n], a[n - 1], `${floor} step ${n} repeats`);
    assert.ok(new Set(a).size >= Math.min(3, FOOTSTEP_FILES[floor].length), `${floor} uses its whole family`);
    assert.notDeepEqual(walk('tokB'), a, `${floor}: two tokens walk differently`);
    assert.deepEqual(walk('tokA'), a, `${floor}: the same on every screen`);
  }
});

test('footstepVariation: seeded pitch and loudness around the step, lower for big creatures', () => {
  const steps = Array.from({ length: 50 }, (_, n) => footstepVariation({ seed: 't', n }));
  for (const s of steps) {
    assert.ok(s.rate >= 0.88 && s.rate <= 1.12, `rate ${s.rate}`);
    assert.ok(s.gain >= 0.8 && s.gain <= 1.15, `gain ${s.gain}`);
  }
  assert.ok(new Set(steps.map((s) => s.rate)).size > 30, 'pitches vary');
  assert.deepEqual(footstepVariation({ seed: 't', n: 7 }), steps[7], 'deterministic');
  const avg = (squares) => Array.from({ length: 50 }, (_, n) => footstepVariation({ seed: 'x', n, squares }).rate).reduce((a, b) => a + b) / 50;
  assert.ok(avg(4) < avg(1) && avg(1) < avg(0.5), 'huge steps lower, tiny steps higher');
});

test('stepWeight: size category first, else token width; heavy bodies weigh more', () => {
  assert.equal(stepWeight({ size: 'tiny' }), 0);
  assert.equal(stepWeight({ size: 'sm' }), 1);
  assert.equal(stepWeight({ size: 'med' }), 2);
  assert.equal(stepWeight({ size: 'lg' }), 3);
  assert.equal(stepWeight({ size: 'huge' }), 4);
  assert.equal(stepWeight({ size: 'grg' }), 5);
  assert.equal(stepWeight({ size: 'large' }), 3, 'long names too');
  assert.equal(stepWeight({ squares: 0.5 }), 0);
  assert.equal(stepWeight({ squares: 1 }), 2);
  assert.equal(stepWeight({ squares: 2 }), 3);
  assert.equal(stepWeight({ squares: 3 }), 4);
  assert.equal(stepWeight({ squares: 6 }), 5);
  assert.ok(stepWeight({ size: 'lg', heavy: true }) > stepWeight({ size: 'lg' }));
});

test('heavier creatures step deeper, louder and less often; the biggest add a thud', () => {
  const avgRate = (weight) => Array.from({ length: 60 }, (_, n) => footstepVariation({ seed: 'w', n, weight }).rate).reduce((a, b) => a + b) / 60;
  const rates = [0, 1, 2, 3, 4, 5].map(avgRate);
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i] < rates[i - 1], `weight ${i} deeper than ${i - 1}`);
  assert.ok(rates[0] > 1.2 && rates[5] < 0.7, `tiny ~1.3, gargantuan ~0.6 (${rates[0].toFixed(2)}, ${rates[5].toFixed(2)})`);
  assert.ok(avgRate(3.75) < rates[3], 'a heavy Large body is deeper than a light one');
  const vols = [0, 2, 3, 5].map((weight) => footstepVolume('stone', { weight }));
  for (let i = 1; i < vols.length; i++) assert.ok(vols[i] > vols[i - 1], 'louder with weight');
  assert.ok(footstepVolume('stone', { weight: 5 }) <= 1);
  assert.equal(thudFile(2, 1, 's'), null, 'no thud for Medium and smaller');
  assert.match(thudFile(3, 1, 's'), /impactSoft/, 'Large lands a light thud');
  const thud = thudFile(4, 1, 's');
  assert.match(thud, /impactSoft_heavy_00\d\.ogg$/);
  assert.ok(existsSync(fileURLToPath(new URL(`../../../${thud.replace(/^modules\/animater\//, '')}`, import.meta.url))), thud);
});

test('footstepFile: PSFX outdoor steps replace only the dirt steps when PSFX is active', () => {
  const PSFX = /^modules\/psfx\/library\/creature\/movement\/footsteps\/outdoors\/00[12]\/footsteps-single-outdoors-00[12]-0[0-7]\.ogg$/;
  for (let n = 0; n < 16; n++) assert.match(footstepFile('dirt', n, { psfx: true }), PSFX, `dirt ${n}`);
  for (const floor of FLOORS.filter((f) => f !== 'dirt')) for (let n = 0; n < 16; n++) {
    assert.doesNotMatch(footstepFile(floor, n, { psfx: true }), /psfx/, floor);
    assert.equal(footstepFile(floor, n, { psfx: true, seed: 'a' }), footstepFile(floor, n, { seed: 'a' }), `${floor} keeps its own steps`);
  }
  assert.equal(footstepFile('dirt', 3, { psfx: true }), footstepFile('dirt', 3, { psfx: true }));
});

test('footstep families: no two floors share a recording', () => {
  const owner = new Map();
  // (Lava has no recording yet and walks on its crust's rock.)
  assert.deepEqual(FOOTSTEP_FILES.lava, FOOTSTEP_FILES.stone);
  for (const [floor, files] of Object.entries(FOOTSTEP_FILES).filter(([floor]) => floor !== 'lava')) for (const file of files) {
    assert.ok(!owner.has(file) || owner.get(file) === floor, `${file} is used by both ${owner.get(file)} and ${floor}`);
    owner.set(file, floor);
  }
  // (Glass has two: a recording that didn't sound like glass was taken out, and it waits for a better one.)
  for (const floor of FLOORS) assert.ok(FOOTSTEP_FILES[floor]?.length >= (floor === 'glass' ? 2 : 3), `${floor} has its own family`);
});

test('footstepFile: every floor has its own bundled steps, varied by n, that exist on disk', () => {
  const own = { stone: /freesound\/stone-step-/, wood: /freesound\/wood-step-/, grass: /freesound\/grass-step-/,
    dirt: /freesound\/dirt-step-/, snow: /kenney\/snowstep_/, sand: /freesound\/sand-step-/,
    water: /freesound\/water-step-/, mud: /freesound\/mud-step-/, ice: /freesound\/ice-step-/,
    pebbles: /freesound\/gravel-step-/, glass: /freesound\/glass-step-/, metal: /freesound\/metal-step-/, lava: /freesound\/stone-step-/ };
  for (const floor of FLOORS) {
    assert.ok(own[floor], `no expectation for ${floor}`);
    const files = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((n) => footstepFile(floor, n)));
    assert.ok(files.size >= (floor === 'glass' ? 2 : 3), `${floor} varies`);
    for (const file of files) {
      assert.match(file, /^modules\/animater\/assets\/sounds\/surfaces\/(kenney|freesound)\/[\w-]+\.ogg$/, floor);
      assert.match(file, own[floor], floor);
      assert.ok(existsSync(fileURLToPath(new URL(`../../../${file.replace('modules/animater/', '')}`, import.meta.url))), file);
    }
    assert.equal(footstepFile(floor, 2), footstepFile(floor, 2));
    assert.equal(footstepFile(floor, -2), footstepFile(floor, 2));
  }
  assert.equal(footstepFile('cheese', 1), footstepFile('stone', 1));
  assert.ok(footstepFile('dirt', 3, { psfx: false }).includes('modules/animater/'));
});

test('footstep files are credited in their License.txt', () => {
  const root = new URL('../../../assets/sounds/surfaces/', import.meta.url);
  const credits = { kenney: readFileSync(new URL('kenney/License.txt', root), 'utf8'), freesound: readFileSync(new URL('freesound/License.txt', root), 'utf8') };
  for (const files of Object.values(FOOTSTEP_FILES)) for (const file of files) {
    const [, pack, name] = file.match(/surfaces\/(kenney|freesound)\/([\w-]+\.ogg)$/);
    // A Freesound step is named <kind>-step-<sound id>-<n>.ogg and credited to that same sound id.
    const id = pack === 'freesound' ? name.match(/-(\d+)-\d+\.ogg$/)?.[1] : null;
    if (pack === 'freesound') assert.match(credits.freesound, new RegExp(`^${name}: ".+" by \\S+, https://freesound\\.org/people/\\S+/sounds/${id}/\\r?$`, 'm'), name);
    else assert.ok(credits.kenney.includes(name.replace(/_00\d\.ogg$/, '_000-004.ogg')), name);
  }
});

test('footstepVolume: quiet, wet floors louder, bigger creatures heavier', () => {
  for (const floor of FLOORS) { const v = footstepVolume(floor); assert.ok(v >= 0.1 && v <= 0.3, `${floor} ${v}`); }
  assert.ok(footstepVolume('water') > footstepVolume('stone'));
  assert.ok(footstepVolume('stone', { squares: 0.5 }) < footstepVolume('stone'));
  assert.ok(footstepVolume('stone', { squares: 3 }) > footstepVolume('stone'));
  assert.ok(footstepVolume('stone', { squares: 100 }) <= 0.17 * 2.2, 'a Gargantuan tread tops out at 2.2×');
});

function harness({ tokens, floor = 'dirt', enabled = true, density = 1, cap = 200, printCap, printLifetime, trails, steps = [], groundShadows, fills } = {}) {
  let time = 0;
  const live = new Set(), shadows = new Map(), log = { added: 0, removed: 0, shadowsAdded: 0, shadowsRemoved: 0, cleared: 0 };
  const layer = {
    addParticle(spec) { const h = { spec, state: null }; live.add(h); log.added++; return h; },
    updateParticle(h, state) { h.state = state; },
    removeParticle(h) { live.delete(h); log.removed++; },
    addShadow() { const h = { geom: null }; log.shadowsAdded++; return h; },
    updateShadow(h, geom) { h.geom = geom; },
    removeShadow() { log.shadowsRemoved++; },
    clear() { log.cleared++; live.clear(); },
  };
  const feel = createMovementFeel({
    tokens: () => tokens, floorAt: typeof floor === 'function' ? floor : () => floor, enabled: () => enabled, density: () => density, grid: () => 100, distance: () => 5,
    now: () => time, layer, cap, printCap, printLifetime, trails, ...(fills ? { fills } : {}), footstep: (f, at, t) => steps.push([f, t.id]), ...(groundShadows ? { groundShadows } : {}),
  });
  return { feel, live, shadows, log, steps, advance: (ms) => { time += ms; }, layer };
}

test('controller: a walking visible token leaves dust under its middle; it fades away', () => {
  const tok = { id: 't1', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true };
  const steps = [];
  const h = harness({ tokens: [tok], steps });
  h.feel.tick();
  assert.equal(h.log.added, 0);
  tok.x = 2 * STRIDE * 100; h.advance(16); h.feel.tick();
  assert.ok(h.log.added >= 3);
  assert.ok(steps.length >= 1 && steps[0][0] === 'dirt');
  for (const p of h.live) assert.ok(p.state && Math.abs(p.state.y) < 50, "near the token centre line, not its bottom edge");
  h.advance(5000); h.feel.tick();
  assert.equal(h.live.size, 0);
});

test('controller: hidden, invisible or skipped tokens make nothing and do not burst later', () => {
  const tok = { id: 't1', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: false };
  const h = harness({ tokens: [tok] });
  h.feel.tick();
  tok.x = 300; h.advance(16); h.feel.tick();
  assert.equal(h.log.added, 0);
  tok.visible = true; tok.skip = true; tok.x = 400; h.feel.tick();
  assert.equal(h.log.added, 0);
  // Skipping ends: no dust for the distance travelled while skipped.
  tok.skip = false; h.feel.tick();
  assert.equal(h.log.added, 0);
});

test('controller: a flier gets a following shadow and no dust; landing removes it', () => {
  const tok = { id: 'f', x: 0, y: 0, width: 100, elevation: 30, base: 0, action: 'fly', visible: true };
  const h = harness({ tokens: [tok] });
  h.feel.tick();
  assert.equal(h.log.shadowsAdded, 1);
  tok.x = 300; h.advance(16); h.feel.tick();
  assert.equal(h.log.added, 0);
  assert.equal(h.log.shadowsAdded, 1);
  tok.action = 'walk'; h.feel.tick();
  assert.equal(h.log.shadowsRemoved, 1);
});

test('controller: off clears everything; the cap holds new dust back', () => {
  const tok = { id: 't', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true };
  const h = harness({ tokens: [tok], cap: 2 });
  h.feel.tick();
  tok.x = 200; h.advance(16); h.feel.tick();
  assert.ok(h.live.size <= 2);
  const off = harness({ tokens: [tok], enabled: false });
  off.feel.tick(); tok.x = 600; off.feel.tick();
  assert.equal(off.log.cleared, 0, "nothing drawn, nothing to clear each frame");
  assert.equal(off.log.added, 0);
});

test('controller: a creature playing an animation keeps its shadow; a teleport (it vanishes) drops it', () => {
  const tok = { id: 'f', x: 0, y: 0, width: 100, elevation: 30, base: 0, action: 'fly', visible: true };
  const h = harness({ tokens: [tok] });
  h.feel.tick();
  assert.equal(h.log.shadowsAdded, 1);
  tok.skip = true; h.advance(16); h.feel.tick();
  assert.equal(h.log.shadowsRemoved, 0, 'a spell cast or a lunge: still standing there');
  assert.equal(h.log.added, 0, 'and no dust');
  tok.gone = true; h.advance(16); h.feel.tick();
  assert.equal(h.log.shadowsRemoved, 1, 'teleporting: no shadow while it is away');
});

test('controller: a token gone from the list loses its shadow; clear empties the layer', () => {
  const tok = { id: 'f', x: 0, y: 0, width: 100, elevation: 30, base: 0, action: 'fly', visible: true };
  const list = [tok];
  const h = harness({ tokens: list });
  h.feel.tick();
  list.length = 0; h.feel.tick();
  assert.equal(h.log.shadowsRemoved, 1);
  h.feel.clear();
  assert.equal(h.log.cleared, 1);
});

test('controller: one broken token never stops the frame', () => {
  const bad = { id: 'b', get x() { throw new Error('gone'); }, y: 0, width: 100, visible: true };
  const tok = { id: 't', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true };
  const h = harness({ tokens: [bad, tok] });
  h.feel.tick();
  tok.x = 200; h.advance(16);
  assert.doesNotThrow(() => h.feel.tick());
  assert.ok(h.log.added > 0);
});

test('a tail drag is as thick as the creature is big, and bends smoothly through a turn', async () => {
  const { tailDrag } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const half = 30, small = tailDrag({ x: 0, y: 0, heading: 0 }, { half, width: 100 }), huge = tailDrag({ x: 0, y: 0, heading: 0 }, { half, width: 800 });
  assert.ok(huge.thick > small.thick * 4, 'a huge dragon drags a far broader line than a lizard');
  assert.equal(small.bend, 0, 'straight on, no bend');
  const turned = tailDrag({ x: 0, y: 0, heading: Math.PI / 2, turnFrom: 0 }, { half, width: 400 });
  assert.ok(Math.abs(turned.bend - Math.PI / 2) < 1e-9 || turned.bend === 1.2, 'it bends by the turn, a sharp one eased');
  assert.ok(Math.abs(turned.rotation - Math.PI / 2) < 1e-9, 'along the stride it covers');
  assert.ok(huge.amp <= 0.2, 'a gentle sway, never a snake\'s');
  const wrap = tailDrag({ x: 0, y: 0, heading: -3, turnFrom: 3 }, { half, width: 400 }); assert.ok(Math.abs(wrap.bend) < 0.5, 'the short way round');
});

test('dragon tracks: heavy four-legged prints with a tail drag, bigger than a bird track', () => {
  assert.equal(TRACKS.dragon.feet, 'paced');
  assert.equal(TRACKS.dragon.tail, true);
  assert.ok(TRACKS.dragon.size > TRACKS.paws.size);
  assert.equal(TRACKS.talons.feet, 'biped', 'birds stay two-legged');
});

test('step pacing: heavier creatures step in slow, spaced beats, not a patter', () => {
  const gaps = [0, 1, 2, 3, 4, 5].map(stepGap);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1], `weight ${i} slower than ${i - 1}`);
  assert.ok(gaps[0] <= 130 && gaps[2] >= 220 && gaps[2] <= 300, 'tiny patter, medium walk');
  assert.ok(gaps[4] >= 700 && gaps[5] >= 1000, 'huge THUMP ... THUMP, gargantuan slower still');
  assert.ok(stepGap(3.75) > stepGap(3), 'a heavy body is slower too');
  // A Huge creature striding every 100 ms for 3 s steps about 4 times, a Medium one about 11.
  const walk = (weight) => {
    const pacer = createStepPacer(); let steps = 0;
    for (let t = 0; t <= 3000; t += 100) if (pacer.take('a', weight, t) !== null) steps++;
    return steps;
  };
  assert.ok(walk(4) <= 5 && walk(4) >= 3, `huge ${walk(4)}`);
  assert.ok(walk(2) >= 10, `medium ${walk(2)}`);
  // The first stride of a move steps at once; step numbers count up per token; tokens pace apart.
  const pacer = createStepPacer();
  assert.equal(pacer.take('a', 4, 0), 0);
  assert.equal(pacer.take('a', 4, 100), null);
  assert.equal(pacer.take('b', 4, 100), 0, 'another token has its own beat');
  assert.equal(pacer.take('a', 4, 800), 1);
  pacer.clear();
  assert.equal(pacer.take('a', 4, 850), 0, 'cleared: starts over');
});

test('thudLevel: bigger creatures thud deeper, louder and longer', () => {
  assert.equal(thudLevel(2), null);
  const [l, h, g] = [3, 4, 5].map(thudLevel);
  assert.ok(l.gain < h.gain && h.gain < g.gain, 'louder');
  assert.ok(l.rate > h.rate && h.rate > g.rate, 'deeper');
  // Really deep: Large ~0.65x, Huge an octave down, Gargantuan lower still (never so low it turns to mush).
  assert.ok(Math.abs(l.rate - 0.65) < 0.02 && Math.abs(h.rate - 0.5) < 0.02 && Math.abs(g.rate - 0.4) < 0.02, `${l.rate} ${h.rate} ${g.rate}`);
  assert.ok(thudLevel(5.75).rate >= 0.3 && thudLevel(5.75).rate < g.rate, 'a heavy Gargantuan body lowest of all');
  // Shaped for weight: the slap on top filtered off, the low end boosted, more so the bigger it is.
  assert.ok(l.lowpass > h.lowpass && h.lowpass > g.lowpass && g.lowpass >= 300, 'darker');
  assert.ok(l.bass < h.bass && h.bass < g.bass && g.bass <= 12, 'more body');
  // Huge and bigger: a sub-rumble layer an octave below the thud, quieter.
  assert.equal(l.sub, null);
  assert.ok(h.sub && Math.abs(h.sub.rate - h.rate / 2) < 0.01 && h.sub.gain < 1, 'huge rumbles');
  assert.ok(g.sub.gain > h.sub.gain, 'gargantuan rumbles more');
});

test('audioPeakMs: where a recording hits hardest, cached per file', () => {
  const sr = 1000, data = new Float32Array(600);
  data[5] = 0.2; data[310] = -0.9; data[400] = 0.5;
  const buffer = { sampleRate: sr, numberOfChannels: 1, getChannelData: () => data };
  assert.equal(audioPeakMs(buffer), 310);
  assert.equal(audioPeakMs(null), 0, 'no buffer: assume it hits at once');
  // Only the first second counts (a step's tail never wins).
  const long = new Float32Array(3000); long[100] = 0.4; long[2500] = 1;
  assert.equal(audioPeakMs({ sampleRate: sr, numberOfChannels: 1, getChannelData: () => long }), 100);
});

test('thudDelayMs: the thud lands on the footfall, not before it', () => {
  // A step peaking 313 ms in, played at 0.7x, lands at ~447 ms; a thud peaking at 8 ms played at 0.6x lands at ~13 ms.
  assert.equal(thudDelayMs({ stepPeakMs: 313, stepRate: 0.7, thudPeakMs: 8, thudRate: 0.6, elapsedMs: 0 }), 434);
  // Time already spent loading the step comes off; never negative.
  assert.equal(thudDelayMs({ stepPeakMs: 313, stepRate: 0.7, thudPeakMs: 8, thudRate: 0.6, elapsedMs: 100 }), 334);
  assert.equal(thudDelayMs({ stepPeakMs: 1, stepRate: 1, thudPeakMs: 8, thudRate: 1, elapsedMs: 50 }), 0);
});

test('thudLevel: the bass boost is paid for in level, so a Gargantuan thud keeps its headroom', () => {
  for (const w of [3, 4, 5, 5.75]) {
    const t = thudLevel(w);
    assert.ok(t.headroom > 0 && t.headroom <= 1, `headroom ${t.headroom}`);
    // The boost raises the peak by about its dB; the headroom takes it back off.
    assert.ok(Math.abs(20 * Math.log10(t.headroom) + t.bass) <= 1.01, `w${w}: ${t.bass} dB boost, ${(20 * Math.log10(t.headroom)).toFixed(1)} dB headroom`);
  }
});

// Perceived brightness of a 0xRRGGBB colour (0-255).
const luma = (c) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);

test('grass: a few small dull blades that do not read as pasted on, a small springy tuft, and trampled grass under each foot', () => {
  const at = { x: 500, y: 500, heading: 0, index: 3 };
  const full = puffsFor('grass', at, { seed: 'g', grid: 100 });
  // Blades: a few per stride, under about a tenth of a square long, a muted green with a darker edge.
  const blades = full.filter((p) => p.kind === 'blade');
  assert.ok(blades.length >= 2 && blades.length <= 5, `${blades.length} blades`);
  const length = blades.reduce((sum, p) => sum + 2 * p.radius, 0) / blades.length;
  assert.ok(length >= 5 && length <= 11, `blades ${length.toFixed(1)} px long on a 100 px grid`);
  for (const b of blades) {
    assert.ok(luma(b.color) < luma(0xa2cf45), `blade ${b.color.toString(16)} is not bright`);
    assert.ok(Number.isFinite(b.edge) && luma(b.edge) < luma(b.color) - 30, 'a darker edge');
  }
  // The tuft is about a fifth of a square, bends and springs back.
  const tuft = full.find((p) => p.kind === 'tuft');
  assert.ok(2 * tuft.radius >= 13 && 2 * tuft.radius <= 22, `tuft ${2 * tuft.radius}`);
  assert.ok(tuft.sway > 0.5 && Number.isFinite(tuft.edge));
  // Trampled grass: one patch per foot, laid along the heading, darker streaks with lighter flattened highlights.
  const tramples = full.filter((p) => p.kind === 'trample');
  assert.equal(tramples.length, 1);
  const [t] = tramples;
  assert.equal(t.rotation, 0);
  assert.equal(t.lasting, true, 'shares the print budget');
  assert.ok(luma(t.light) > luma(t.color) + 40);
  assert.ok(t.blades.length >= 5 && t.blades.some((s) => s[4]) && t.blades.some((s) => !s[4]));
  for (const s of t.blades) assert.ok(s.length === 5 && s.every(Number.isFinite) && Math.abs(s[0]) <= 1 && Math.abs(s[1]) <= 1);
  assert.ok(t.radius >= 12 && t.radius <= 22, `patch ${t.radius}`);
  // Holds about 2 s, then fades and springs back (shrinks) over about 4 s.
  assert.ok(t.life >= 5500 && t.life <= 6500 && Math.abs(t.hold * t.life - 2000) <= 300, `${t.life} ms, held ${t.hold * t.life}`);
  const held = particleState(t, t.delay + t.hold * t.life - 10), late = particleState(t, t.delay + t.life * 0.8);
  assert.equal(held.alpha, t.alpha);
  assert.equal(held.scale, 1);
  assert.ok(late.alpha < t.alpha * 0.5 && late.scale < 0.95 && late.scale > 0.5);
  assert.equal(particleState(t, t.delay + t.life + 1), null);
  // Left foot, right foot: the patch swaps sides of the path every stride, and turns with the heading.
  const next = puffsFor('grass', { ...at, index: 4 }, { seed: 'g', grid: 100 }).find((p) => p.kind === 'trample');
  assert.ok(Math.sign(t.y - 500) === -Math.sign(next.y - 500) && t.y !== 500);
  assert.equal(puffsFor('grass', { ...at, heading: 1.1 }, { seed: 'g', grid: 100 }).find((p) => p.kind === 'trample').rotation, 1.1);
  // Every gait tramples grass, even one Animater cannot place; an incorporeal one does not.
  for (const gait of ['unknown', 'paws', 'slither', 'legs']) {
    assert.deepEqual(puffsFor('grass', at, { seed: 'g', grid: 100, gait }).filter((p) => p.kind === 'trample'), tramples, gait);
  }
  assert.deepEqual(puffsFor('grass', at, { seed: 'g', grid: 100, gait: 'none' }), []);
  // Low quality halves the blades, keeps the tuft and the trample.
  const low = puffsFor('grass', at, { seed: 'g', grid: 100, density: 0.5 });
  assert.equal(low.filter((p) => p.kind === 'blade').length, Math.round(blades.length / 2));
  assert.equal(low.filter((p) => p.kind === 'trample').length, 1);
  // No other floor tramples.
  for (const floor of FLOORS.filter((f) => f !== 'grass')) assert.ok(!puffsFor(floor, at, { seed: 'g', grid: 100 }).some((p) => p.kind === 'trample'), floor);
});

test('controller: trampled grass shares the print cap; an unknown creature tramples, a flier or a ghost does not', () => {
  const walk = (tok, opts) => {
    const h = harness({ tokens: [tok], floor: 'grass', ...opts });
    h.feel.tick();
    for (let i = 1; i <= 6; i++) { tok.x = i * STRIDE * 100; h.advance(16); h.feel.tick(); }
    return h;
  };
  const capped = walk({ id: 't', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true }, { printCap: 2 });
  assert.equal([...capped.live].filter((p) => p.spec.kind === 'trample').length, 2);
  assert.equal(capped.feel.prints, 2);
  assert.ok([...capped.live].some((p) => p.spec.kind === 'blade'), 'blades still fly with the trail at its cap');
  const odd = walk({ id: 'u', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, gait: 'unknown' });
  assert.ok([...odd.live].filter((p) => p.spec.kind === 'trample').length >= 4);
  const flier = walk({ id: 'f', x: 0, y: 0, width: 100, elevation: 30, base: 0, action: 'fly', visible: true });
  assert.equal(flier.log.added, 0);
  const ghost = walk({ id: 'g', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, gait: 'none' });
  assert.equal(ghost.log.added, 0);
});

test('perceive: what a screen may see and hear of a moving creature', () => {
  const none = { see: false, hear: false }, both = { see: true, hear: true }, ears = { see: false, hear: true };
  // Hidden by the GM (Foundry hidden): nobody, the GM included.
  assert.deepEqual(perceive({ isGM: true, docHidden: true, tokenVisible: true }), none);
  // The GM knows everything else.
  assert.deepEqual(perceive({ isGM: true, tokenVisible: false, conditions: ['undetected'] }), both);
  // PF2e Visioner, from this player's own tokens (the most aware one counts).
  assert.deepEqual(perceive({ tokenVisible: true, states: ['observed'] }), both);
  assert.deepEqual(perceive({ tokenVisible: true, states: ['concealed'] }), both);
  assert.deepEqual(perceive({ tokenVisible: true, states: ['hidden'] }), ears, 'hidden: its square is known by sound, nothing to see');
  assert.deepEqual(perceive({ tokenVisible: true, states: ['undetected'] }), none);
  assert.deepEqual(perceive({ tokenVisible: true, states: ['unnoticed'] }), none);
  assert.deepEqual(perceive({ tokenVisible: false, states: ['undetected', 'hidden'] }), ears, 'one of my tokens hears it');
  assert.deepEqual(perceive({ tokenVisible: false, states: ['observed'] }), ears, 'Visioner says seen but it is not drawn here: hear only');
  // The creature's own PF2e conditions, without Visioner.
  assert.deepEqual(perceive({ tokenVisible: true, conditions: ['undetected'] }), none);
  assert.deepEqual(perceive({ tokenVisible: true, conditions: ['unnoticed'] }), none);
  assert.deepEqual(perceive({ tokenVisible: false, conditions: ['hidden'] }), ears);
  assert.deepEqual(perceive({ tokenVisible: false, conditions: ['invisible'] }), ears, 'invisible but not hidden: heard');
  assert.deepEqual(perceive({ tokenVisible: true, conditions: ['invisible'] }), ears, 'an invisible creature leaves no visible dust');
  // Plain Foundry vision.
  assert.deepEqual(perceive({ tokenVisible: true }), both);
  assert.deepEqual(perceive({ tokenVisible: false }), none, 'out of sight with nothing else known: silent');
});

test('controller: a creature only heard makes its sounds but leaves nothing to see', () => {
  const tok = { id: 'h', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: false, audible: true };
  const h = harness({ tokens: [tok] });
  h.feel.tick();
  for (let x = 30; x <= 300; x += 30) { tok.x = x; h.advance(16); h.feel.tick(); }
  assert.equal(h.log.added, 0, 'no dust, prints or trails');
  assert.ok(h.steps.length > 0, 'its steps are heard');
  const flier = { id: 'f', x: 0, y: 0, width: 100, elevation: 30, base: 0, action: 'fly', visible: false, audible: true };
  const hf = harness({ tokens: [flier] });
  hf.feel.tick();
  assert.equal(hf.log.shadowsAdded, 0, 'no shadow for an unseen flier');
  const ghost = { id: 'g', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: false, audible: false };
  const hg = harness({ tokens: [ghost] });
  hg.feel.tick(); ghost.x = 300; hg.advance(16); hg.feel.tick();
  assert.equal(hg.steps.length, 0, 'undetected: silent');
});

test('floor effects scale with the creature: big ones splash bigger and less often, small ones smaller', () => {
  const at = (index) => ({ x: 0, y: 0, heading: 0, index });
  const rings = (width, index = 1) => puffsFor('water', at(index), { seed: 's', grid: 100, width }).filter((p) => p.kind === 'ring');
  const medium = rings(100), huge = rings(300), tiny = rings(50);
  assert.ok(medium.length > 0 && huge.length > 0);
  assert.ok(huge[0].radius > medium[0].radius * 2, `huge ring ${huge[0].radius} vs medium ${medium[0].radius}`);
  assert.ok(tiny[0].radius < medium[0].radius, 'tiny ring smaller');
  // A Huge creature bursts every other stride, a Gargantuan one every third; a Medium one every stride.
  const bursts = (width) => [1, 2, 3, 4, 5, 6].filter((i) => puffsFor('water', at(i), { seed: 's', grid: 100, width }).some((p) => p.kind === 'ring')).length;
  assert.equal(bursts(100), 6);
  assert.equal(bursts(300), 3);
  assert.equal(bursts(500), 2);
  // Dust and drops grow too, and fly a little further.
  const dust = (width) => puffsFor('dirt', at(1), { seed: 's', grid: 100, width }).filter((p) => p.kind === 'puff');
  const avg = (list, f) => list.reduce((a, p) => a + f(p), 0) / list.length;
  assert.ok(avg(dust(300), (p) => p.radius) > avg(dust(100), (p) => p.radius) * 1.8);
  assert.ok(avg(dust(300), (p) => Math.hypot(p.vx, p.vy)) > avg(dust(100), (p) => Math.hypot(p.vx, p.vy)));
});

test('shadowGeometry: a flier shadow always shows past its own token, big tokens included', () => {
  for (const width of [50, 100, 300, 400, 600]) for (const lift of [0, 10, 30, 120]) {
    const s = shadowGeometry({ x: 0, y: 0, width, lift, distance: 5, grid: 100 });
    // The token covers a circle of radius width/2 around (0, 0): part of the shadow must reach past it.
    const far = Math.hypot(s.x, s.y) + Math.min(s.rx, s.ry);
    assert.ok(far > width / 2 + 0.05 * width, `width ${width}, lift ${lift}: shadow reaches ${far.toFixed(0)}, token edge ${width / 2}`);
    assert.ok(Math.abs(s.x) < 1e-9 && s.y > 0, 'straight below the creature, centred left to right');
    assert.ok(s.rx < width / 2 && s.ry < s.rx / 2, 'a flat ellipse narrower than the token, never a ring round it');
  }
  const low = shadowGeometry({ x: 0, y: 0, width: 400, lift: 10, distance: 5, grid: 100 }), high = shadowGeometry({ x: 0, y: 0, width: 400, lift: 120, distance: 5, grid: 100 });
  assert.ok(high.rx < low.rx && high.alpha < low.alpha && high.y > low.y, 'higher: further down, smaller, fainter');
});

test('controller: marks follow who is looking now: a creature this view stops perceiving has its tracks hidden, not lost', () => {
  const ed = { id: 'ed', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, audible: true };
  const h = harness({ tokens: [ed], floor: 'snow' });
  h.feel.tick();
  for (let x = 30; x <= 600; x += 30) { ed.x = x; h.advance(16); h.feel.tick(); }
  const prints = () => [...h.live].filter((p) => p.spec.kind === 'print');
  assert.ok(prints().length > 0, 'Ed left prints while seen');
  assert.ok(prints().every((p) => p.state && p.state.alpha > 0));
  // Now the view is the spider's, which has not detected Ed: his prints vanish from this screen.
  ed.visible = false; ed.audible = false;
  h.advance(16); h.feel.tick();
  assert.ok(prints().length > 0, 'kept, not removed');
  assert.ok(prints().every((p) => p.state.alpha === 0), 'hidden');
  // Ed's own view again: they come back.
  ed.visible = true; ed.audible = true;
  h.advance(16); h.feel.tick();
  assert.ok(prints().every((p) => p.state.alpha > 0), 'shown again');
});

test('controller: marksOf(id) counts a creature\'s marks and how many this view shows', () => {
  const ed = { id: 'ed', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true, audible: true };
  const h = harness({ tokens: [ed], floor: 'snow' });
  h.feel.tick();
  for (let x = 30; x <= 600; x += 30) { ed.x = x; h.advance(16); h.feel.tick(); }
  const seen = h.feel.marksOf('ed');
  assert.ok(seen.laid > 0 && seen.shown === seen.laid, JSON.stringify(seen));
  ed.visible = false; h.advance(16); h.feel.tick();
  const hidden = h.feel.marksOf('ed');
  assert.equal(hidden.laid, seen.laid);
  assert.equal(hidden.shown, 0);
  assert.deepEqual(h.feel.marksOf('nobody'), { laid: 0, shown: 0, total: 0 });
  assert.ok(h.feel.marksOf('ed').total >= seen.laid, 'total counts every mark laid, even ones already faded');
});

test('footstep hearing range: close, normal, far, very far; Huge and bigger carry half as far again', async () => {
  const { footstepReach, FOOTSTEP_RANGES } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  assert.deepEqual({ ...FOOTSTEP_RANGES }, { close: 3, normal: 6, far: 10, veryFar: 15 });
  assert.equal(footstepReach('normal', 2), 6);
  assert.equal(footstepReach('normal', 4), 9, 'as before for Huge');
  assert.equal(footstepReach('close', 1), 3);
  assert.equal(footstepReach('veryFar', 5), 22.5);
  assert.equal(footstepReach('nonsense', 2), 6, 'unknown means normal');
});

test('rain wets the floor: dirt turns to mud, stone, wood, grass and sand get puddles, wet floors stay', async () => {
  const { rainFloor } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  assert.deepEqual(rainFloor('dirt', 'rain'), { floor: 'mud', splash: false });
  for (const f of ['stone', 'wood', 'grass', 'sand']) assert.deepEqual(rainFloor(f, 'rain'), { floor: f, splash: true });
  for (const f of ['water', 'mud', 'snow', 'ice']) assert.deepEqual(rainFloor(f, 'rain'), { floor: f, splash: false });
  assert.deepEqual(rainFloor('dirt', 'snow'), { floor: 'dirt', splash: false });
  assert.deepEqual(rainFloor('stone', null), { floor: 'stone', splash: false });
});

test('controller: Shadows under every token gives a standing creature a soft shadow; off, only fliers get one', () => {
  const tok = { id: 's', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true };
  let on = true;
  const h = harness({ tokens: [tok], groundShadows: () => on });
  h.feel.tick();
  assert.equal(h.log.shadowsAdded, 1);
  const flier = shadowGeometry({ x: 0, y: 0, width: 100 }), ground = shadowGeometry({ x: 0, y: 0, width: 100, grounded: true });
  assert.ok(ground.alpha <= flier.alpha, "never darker than a flier's");
  on = false; h.advance(16); h.feel.tick();
  assert.equal(h.log.shadowsRemoved, 1);
});
test('a standing creature\'s sun shadow is as dark long as short, and only a little softer', () => {
  const at = (height) => shadowFalls({ width: 100, lift: 0.8, grounded: true, grid: 100, sun: { angle: 90, height, strength: 1 } }).sun;
  const noon = at(70), evening = at(20);
  assert.ok(Math.hypot(evening.dx, evening.dy) > Math.hypot(noon.dx, noon.dy) * 3, 'much longer at evening');
  assert.equal(evening.alpha, noon.alpha, 'no fainter for it');
  assert.ok(evening.soft - noon.soft < 0.2, 'only a little softer');
  assert.equal(shadowGeometry({ x: 0, y: 0, width: 100, grounded: true }).alpha, 0.55, 'a little over half dark in full sun');
});
test('spells change the floor: frost is ice, acid sludge, fire melts snow and burns grass, a blast cracks stone; the newest mark wins',async()=>{
  const { markedFloor } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  assert.equal(markedFloor('grass', []), 'grass');
  assert.equal(markedFloor('grass', ['rime']), 'ice');
  assert.equal(markedFloor('stone', ['residue']), 'mud');
  assert.equal(markedFloor('snow', ['scorch']), 'water');
  assert.equal(markedFloor('grass', ['scorch']), 'dirt');
  assert.equal(markedFloor('stone', ['scorch']), 'stone');
  assert.equal(markedFloor('dirt', ['cracks']), 'stone');
  assert.equal(markedFloor('water', ['cracks']), 'water');
  assert.equal(markedFloor('grass', ['rime', 'scorch']), 'dirt', 'fire after frost');
  assert.equal(markedFloor('grass', ['scorch', 'stain', undefined]), 'dirt', 'marks with no floor of their own pass over');
});
test('a flier shadow passing over creatures on the ground darkens their art too, only where it falls',async()=>{
  const { shadowCovers, castShadowGeometry } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const geom = castShadowGeometry({ x: 500, y: 500, width: 100, lift: 20, distance: 5, grid: 100 });
  const high = castShadowGeometry({ x: 500, y: 500, width: 100, lift: 60, distance: 5, grid: 100 });
  assert.ok(high.x > geom.x && high.y > geom.y && high.alpha < geom.alpha, 'higher: cast further down-right, fainter');
  const covers = shadowCovers(geom, [{ x: 500, y: 560, width: 100 }, { x: 900, y: 900, width: 100 }, { x: 560, y: 600, width: 100 }]);
  assert.deepEqual(covers.map((c) => c.x), [500, 560]);
  assert.deepEqual(shadowCovers(null, [{ x: 0, y: 0, width: 100 }]), []);
});
test('the over-token shadow is drawn for fliers above standing creatures and dropped when they move apart',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const calls = [];
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow() {}, removeShadow() {}, clear() {},
    addOverShadow: () => { calls.push('add'); return {}; }, updateOverShadow: (h, g, covers) => calls.push(`up:${covers.length}`), removeOverShadow: () => calls.push('remove') };
  let flier = { id: 'f', x: 500, y: 440, width: 100, elevation: 30, base: 0, visible: true, gait: 'none', action: 'fly' };
  const ground = { id: 'g', x: 500, y: 520, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk' };
  const feel = createMovementFeel({ shadowsOverTokens: () => true, tokens: () => [flier, ground], floorAt: () => 'stone', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {} });
  feel.tick();
  assert.deepEqual(calls, ['add', 'up:1']);
  flier = { ...flier, x: 1500 };
  feel.tick();
  assert.equal(calls.at(-1), 'remove');
});
test('taking off and landing blow the floor out to both sides; landing is heavier with a ring; bigger creatures throw further',async()=>{
  const { downdraft } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const at = { x: 500, y: 500 };
  const lift = downdraft('dirt', at, { seed: 'a', grid: 100, width: 100 });
  const land = downdraft('dirt', at, { seed: 'a', grid: 100, width: 100, landing: true });
  assert.ok(lift.some((p) => p.vx < 0) && lift.some((p) => p.vx > 0), 'both sides');
  assert.ok(lift.every((p) => Math.abs(p.vx) > Math.abs(p.vy)), 'mostly sideways');
  assert.ok(land.length > lift.length && land.some((p) => p.kind === 'ring'));
  assert.ok(!lift.some((p) => p.kind === 'ring'));
  assert.deepEqual(downdraft('dirt', at, { seed: 'a' }), downdraft('dirt', at, { seed: 'a' }), 'the same on every screen');
  assert.equal(downdraft('snow', at, { seed: 'a' })[0].kind, 'puff');
  assert.equal(downdraft('water', at, { seed: 'a', landing: true }).at(-1).color, 0xd8ecff);
  const far = (ps) => Math.max(...ps.map((p) => Math.abs(p.vx)));
  assert.ok(far(downdraft('dirt', at, { seed: 'a', width: 300 })) > far(lift));
});
test('the feel layer lays the downdraft when a creature starts and stops flying',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  let added = 0, sounds = [];
  const layer = { addParticle: () => { added++; return {}; }, updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow() {}, removeShadow() {}, clear() {} };
  let t = { id: 'f', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'boots', action: 'walk' };
  const feel = createMovementFeel({ flightDust: () => true, tokens: () => [t], floorAt: () => 'dirt', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep: (f, at, tok, kind) => sounds.push(kind) });
  feel.tick(); assert.equal(added, 0);
  t = { ...t, action: 'fly', elevation: 10 }; feel.tick();
  const lifted = added; assert.ok(lifted >= 12, `lifted ${lifted}`);
  t = { ...t, action: 'walk', elevation: 0 }; feel.tick();
  assert.ok(added - lifted > lifted, 'a heavier landing'); assert.ok(sounds.includes('land'));
});
test('fresh out of deep water a creature drips as it walks, less as it dries, then not at all',async()=>{
  const { dripsFor, createMovementFeel, DRIP_MS } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  assert.ok(dripsFor({ x: 0, y: 0 }, { wet: 1 }).length > dripsFor({ x: 0, y: 0 }, { wet: 0.2 }).length);
  assert.deepEqual(dripsFor({ x: 0, y: 0 }, { wet: 0 }), []);
  assert.ok(dripsFor({ x: 0, y: 0 }, { wet: 1 }).every((d) => d.kind === 'drop' && Math.hypot(d.x, d.y) <= 50));
  let time = 0, added = [];
  const layer = { addParticle: (s) => { added.push(s); return s; }, updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow() {}, removeShadow() {}, clear() {} };
  let t = { id: 's', x: 100, y: 100, width: 100, elevation: 0, base: 0, visible: true, gait: 'boots', action: 'swim' };
  const feel = createMovementFeel({ drips: () => true, tokens: () => [t], floorAt: () => 'stone', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => time, layer, footstep() {} });
  feel.tick();
  const walk = (ms) => { for (let i = 0; i < 20; i++) { time += ms / 20; t = { ...t, action: 'walk', x: t.x + 10 }; feel.tick(); } };
  walk(2000);
  const wetDrops = added.filter((s) => s.kind === 'drop' && s.color !== undefined && s.color >= 0x9cc8e8).length;
  assert.ok(wetDrops > 0, 'drips right after the swim');
  added = []; time += DRIP_MS; walk(2000);
  assert.equal(added.filter((s) => s.color === 0x9cc8e8 || s.color === 0xbfe0f4).length, 0, 'dry again');
});
test('wading through a water floor drips too, more lightly and for less time than a swim',async()=>{
  const { createMovementFeel, DRIP_MS } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  let time = 0, added = [], floor = 'water';
  const layer = { addParticle: (s) => { added.push(s); return s; }, updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow() {}, removeShadow() {}, clear() {} };
  let t = { id: 'w', x: 100, y: 100, width: 100, elevation: 0, base: 0, visible: true, gait: 'boots', action: 'walk' };
  const feel = createMovementFeel({ drips: () => true, tokens: () => [t], floorAt: () => floor, enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => time, layer, footstep() {} });
  const walk = (ms) => { for (let i = 0; i < 20; i++) { time += ms / 20; t = { ...t, x: t.x + 10 }; feel.tick(); } };
  const wet = () => added.filter((s) => s.color === 0x9cc8e8 || s.color === 0xbfe0f4).length;
  feel.tick(); walk(1500);
  assert.equal(wet(), 0, 'no drips while still in the water');
  floor = 'stone'; walk(1500);
  assert.ok(wet() > 0, 'drips once out of it');
  added = []; time += DRIP_MS / 2; walk(1500);
  assert.equal(wet(), 0, 'dry sooner than after a swim');
});
test('a flier’s shadow falls away from the light that outshines the day; none in the dark with no light',async()=>{
  const { shadowFall } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const day = shadowFall({ width: 100, lift: 4, darkness: 0 });
  assert.ok(day.dx > 0 && day.dy > 0 && day.alpha === 1, 'the sun: down and to the right');
  // A light up high to the right at night: the shadow falls to the left, as far as it really would.
  const above = shadowFall({ width: 100, lift: 4, darkness: 1, lightHeight: 10, light: { strength: 0.6, angle: 0, distance: 100 } });
  assert.ok(Math.abs(above.dx - -100 * 4 / 6) < 1e-9 && Math.abs(above.dy) < 1e-9 && above.alpha > 0.4);
  // Shorter the higher the light; longer and fainter as the creature climbs toward it.
  const higher = shadowFall({ width: 100, lift: 4, darkness: 1, lightHeight: 20, light: { strength: 0.6, angle: 0, distance: 100 } });
  const near = shadowFall({ width: 100, lift: 9.5, darkness: 1, lightHeight: 10, light: { strength: 0.6, angle: 0, distance: 100 } });
  assert.ok(Math.abs(higher.dx) < Math.abs(above.dx) && Math.abs(near.dx) > Math.abs(above.dx) && near.alpha < above.alpha);
  // A light at or below the creature (most placed lights, a torch carried below it) throws none on the floor.
  assert.equal(shadowFall({ width: 100, lift: 4, darkness: 1, light: { strength: 0.6, angle: 0 } }).alpha, 0);
  assert.equal(shadowFall({ width: 100, lift: 4, darkness: 1, lightHeight: 4, light: { strength: 0.6, angle: 0 } }).alpha, 0);
  // Climbing higher past a low light never throws its shadow further out.
  assert.ok(shadowFall({ width: 100, lift: 8, darkness: 1, light: { strength: 0.6, angle: 0 } }).alpha === 0);
  // A torch in daylight: the sun still decides.
  assert.deepEqual(shadowFall({ width: 100, lift: 4, darkness: 0, light: { strength: 0.6, angle: 0 } }), day);
  assert.equal(shadowFall({ width: 100, lift: 4, darkness: 1 }).alpha, 0, 'dark, no light: no shadow');
  const around = shadowFall({ width: 100, lift: 4, darkness: 1, lightHeight: 10, light: { strength: 0.8, angle: null } });
  assert.ok(around.dx === 0 && around.dy > 0 && around.alpha > 0, 'lit all round: straight under');
});
test('a Light orb in daylight casts its own shadow beside the sun’s, however faint its colour',async()=>{
  const { shadowFalls } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const { lightAround } = await import('../../../scripts/engines/playback/surrounding-light.mjs');
  // PF2e's Light spell: colour intensity 0.05, at the creature's shoulder (up and to the right).
  const light = lightAround({ x: 0, y: 0 }, [{ x: 30, y: -30, radius: 850, bright: 450, color: 0xe7f3f1, alpha: 0.05, elevation: 2.5 }], 1);
  const { sun, lamp } = shadowFalls({ width: 100, body: 0.8, light, darkness: 0, lightHeight: 0.5, grounded: true });
  assert.ok(sun.alpha > 0 && lamp?.alpha > 0.1, 'both shadows');
  assert.ok(lamp.dx < 0 && lamp.dy > 0, 'away from the orb: down and to the left');
});
test('a big creature’s shadow is as dark as a small one’s, only bigger',async()=>{
  const { shadowFalls } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const sun = { angle: -151.6, height: 23.8, strength: 1 };
  for (const grounded of [true, false]) {
    // A flier as high against its size (a dragon at 12 squares, a hawk at 4).
    const fall = (w) => shadowFalls({ width: w, body: 0.8 * w / 100, lift: grounded ? 0 : 4 * w / 100, darkness: 0, sun, grid: 100, grounded }).sun;
    const medium = fall(100);
    for (const w of [200, 300, 400]) assert.ok(Math.abs(fall(w).alpha - medium.alpha) < 0.02, `${grounded ? 'standing' : 'flying'} ${w}: ${fall(w).alpha} vs ${medium.alpha}`);
  }
  // A very low sun still fades a shadow too long, rather than laying it across the map.
  const dusk = shadowFalls({ width: 100, body: 0.8, darkness: 0, sun: { ...sun, height: 3 }, grid: 100, grounded: true }).sun;
  assert.ok(Math.hypot(dusk.dx, dusk.dy) * 2 <= 300 + 1e-9);
});
test('a creature standing taller than a light still casts its shadow, from its body below the light',async()=>{
  const { shadowFalls } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const lamp = { shine: 1, strength: 0.5, angle: 0, distance: 200, brightness: 1, key: 'torch', height: 0.5 };
  const fall = (w) => shadowFalls({ width: w, body: 0.8 * w / 100, lights: [lamp], darkness: 1, sun: null, grid: 100, grounded: true }).lamps[0];
  const medium = fall(100);
  for (const w of [200, 300, 400]) {
    const big = fall(w);
    assert.ok(big && big.dx < 0 && big.alpha > medium.alpha * 0.6, `${w}: away from the light, about as dark`);
  }
  assert.deepEqual(fall(100), medium, 'one shorter than the light as before');
  // A flier above the light: none on the floor from it, still.
  assert.equal(shadowFalls({ width: 300, body: 2.4, lift: 4, lights: [lamp], darkness: 1, sun: null, grid: 100 }).lamps.length, 0);
});
test('every light casts its own shadow, away from itself',async()=>{
  const { shadowFalls, createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const { lightAround } = await import('../../../scripts/engines/playback/surrounding-light.mjs');
  const torch = { radius: 400, bright: 200, alpha: 0.5, elevation: 10 };
  const one = (l, key) => ({ ...lightAround({ x: 0, y: 0 }, [l], 1), key, height: 2 });
  const lights = [one({ ...torch, x: 150, y: 0 }, 'east'), one({ ...torch, x: -150, y: 0 }, 'west')];
  const { lamps } = shadowFalls({ width: 100, body: 0.8, lights, darkness: 1, sun: null, grounded: true });
  assert.deepEqual(lamps.map((f) => f.key), ['east', 'west']);
  assert.ok(lamps[0].dx < 0 && lamps[1].dx > 0 && lamps.every((f) => f.alpha > 0.1), 'each away from its own light');
  // Drawn: three shadows (the stronger, then one for each other light), and back to one as the lights go out.
  const drawn = new Set();
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => { const h = {}; drawn.add(h); return h; }, updateShadow() {}, removeShadow: (h) => drawn.delete(h), clear() {} };
  let t = 0, lit = { light: lights[0], lights: [...lights, one({ ...torch, x: 0, y: 150 }, 'south')], darkness: 1 };
  const flier = { id: 'f', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', light: () => lit };
  const feel = createMovementFeel({ groundShadows: () => true, tokens: () => [flier], enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => t, layer, footstep() {}, sun: () => null });
  const step = () => { t += 1000; feel.tick(); };
  feel.tick(); step();
  assert.equal(drawn.size, 3);
  lit = { light: null, lights: [], darkness: 1 };
  for (let i = 0; i < 10; i++) step();
  assert.equal(drawn.size, 1, 'only its own shadow left, faded');
});
test('a flickering light’s shadow flickers with it, frame by frame; a steady one is left alone',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const { lightAround } = await import('../../../scripts/engines/playback/surrounding-light.mjs');
  const updates = [];
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => updates.push(g.alpha), removeShadow() {}, clear() {} };
  let t = 0, k = 1;
  const torch = { ...lightAround({ x: 0, y: 0 }, [{ x: 150, y: 0, radius: 400, bright: 200, alpha: 0.5, elevation: 10 }], 1), key: 'torch', flicker: () => k };
  const lit = { light: torch, lights: [torch], darkness: 1 };
  const walker = { id: 'w', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', light: () => lit };
  const feel = createMovementFeel({ groundShadows: () => true, tokens: () => [walker], enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => t, layer, footstep() {}, sun: () => null });
  feel.tick(); t += 5000; feel.tick();
  const steady = updates.at(-1);
  k = 0.6; t += 16; feel.tick();
  assert.ok(Math.abs(updates.at(-1) - steady * 0.6) < 1e-6, 'dimmer as its flame dips');
  k = 1.3; t += 16; feel.tick();
  assert.ok(Math.abs(updates.at(-1) - steady * 1.3) < 1e-6, 'darker as it flares');
  // Without a flicker it settles and is no longer redrawn.
  delete torch.flicker; t += 5000; feel.tick(); feel.tick();
  const n = updates.length; t += 16; feel.tick();
  assert.equal(updates.length, n);
});
test('a flame’s shadow dances: shorter and crisper as it flares, swaying side to side',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const { lightAround } = await import('../../../scripts/engines/playback/surrounding-light.mjs');
  let last = null;
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => { last = g; }, removeShadow() {}, clear() {} };
  let t = 0, now = { brightness: 1, sway: 0 };
  const torch = { ...lightAround({ x: 0, y: 0 }, [{ x: 150, y: 0, radius: 400, bright: 200, alpha: 0.5, elevation: 10 }], 1), key: 'torch', flicker: () => now };
  const lit = { light: torch, lights: [torch], darkness: 1 };
  const walker = { id: 'w', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', light: () => lit };
  const feel = createMovementFeel({ groundShadows: () => true, tokens: () => [walker], enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => t, layer, footstep() {}, sun: () => null });
  feel.tick(); t += 5000; feel.tick();
  const off = (g) => Math.hypot(g.fall.x - 500, g.fall.y - 500), steady = { ...last };
  now = { brightness: 1.3, sway: 0 }; t += 16; feel.tick();
  assert.ok(off(last) < off(steady) && last.lift < steady.lift, 'flaring: shorter, crisper');
  now = { brightness: 0.7, sway: 0 }; t += 16; feel.tick();
  assert.ok(off(last) > off(steady) && last.lift > steady.lift, 'dipping: longer, softer');
  now = { brightness: 1, sway: 1 }; t += 16; feel.tick();
  const right = last.fall.y;
  now = { brightness: 1, sway: -1 }; t += 16; feel.tick();
  assert.ok(Math.abs(right - last.fall.y) > 2 && Math.abs(off(last) - off(steady)) < 1, 'sways round, as long');
  // A plain number still dims it alone.
  now = 0.5; t += 16; feel.tick();
  assert.ok(Math.abs(off(last) - off(steady)) < 1e-6 && Math.abs(last.alpha - steady.alpha * 0.5) < 1e-6);
});
test('by a lone light at night the shadow is deep; beside other light, as before; the sun’s never',async()=>{
  const { shadowFalls } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const torch = (key, angle) => ({ shine: 1, strength: 0.5, angle, distance: 150, brightness: 1, key, height: 2 });
  const lone = shadowFalls({ width: 100, body: 0.8, lights: [torch('a', 0)], darkness: 1, sun: null, grounded: true }).lamps[0];
  const pair = shadowFalls({ width: 100, body: 0.8, lights: [torch('a', 0), torch('b', 180)], darkness: 1, sun: null, grounded: true }).lamps[0];
  const dusk = shadowFalls({ width: 100, body: 0.8, lights: [torch('a', 0)], darkness: 0.3, sun: null, grounded: true }).lamps[0];
  assert.ok(lone.alpha > pair.alpha * 1.4, `${lone.alpha} vs ${pair.alpha}`);
  assert.ok(lone.alpha > dusk.alpha, 'deepest in full night');
  const day = shadowFalls({ width: 100, body: 0.8, darkness: 0, grounded: true }).sun;
  assert.ok(day.alpha <= 1);
});
test('a standing creature sits on the floor: a tight rim of shadow hugging it, its ring’s disc or its own outline',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const { lightAround } = await import('../../../scripts/engines/playback/surrounding-light.mjs');
  const geoms = new Map();
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => geoms.set(h, g), removeShadow: (h) => geoms.delete(h), clear() {} };
  Object.assign(layer, { addRim: layer.addShadow, updateRim: layer.updateShadow, removeRim: layer.removeShadow });
  const torch = { ...lightAround({ x: 0, y: 0 }, [{ x: 200, y: 0, radius: 600, bright: 300, alpha: 0.5, elevation: 10 }], 1), key: 't' };
  const lit = { light: torch, lights: [torch], darkness: 1 };
  const rimOf = (token) => {
    geoms.clear();
    const feel = createMovementFeel({ groundShadows: () => true, tokens: () => [token], enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {}, sun: () => null });
    feel.tick();
    return [...geoms.values()].find((g) => g.rim);
  };
  const base = { id: 'w', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', light: () => lit };
  assert.equal(rimOf({ ...base, art: {}, ring: true }), undefined, 'a token in a ring: none (a disc round a coin)');
  assert.equal(rimOf({ ...base }), undefined, 'no outline of its own: none');
  const free = rimOf({ ...base, art: {} });
  assert.ok(free.art && free.stretch > 1 && free.flat > 1 && free.alpha > 0, 'its own outline, a little larger');
  assert.ok(free.fall.x < 500 && free.fall.x > 494 && Math.abs(free.fall.y - 500) < 1, 'a hair away from the light (to its east)');
  assert.equal(rimOf({ ...base, art: {}, shadow: false }), undefined, 'casts none');
});
test('a big creature’s shadow falls over the smaller creatures behind it, not over bigger ones or itself',async()=>{
  const { createMovementFeel, shadowCovers } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  // A shadow stretched east from (500, 500): covers what lies along it, not beside it.
  const long = { x: 500, y: 500, rx: 100, ry: 60, fall: { x: 650, y: 500 }, along: 0, stretch: 2.5 };
  assert.deepEqual(shadowCovers(long, [{ x: 800, y: 500, width: 100 }, { x: 650, y: 750, width: 100 }]).map((t) => t.x), [800]);
  assert.deepEqual(shadowCovers(long, [{ x: 800, y: 500, width: 100, ring: 0.4 }]), [{ x: 800, y: 500, width: 100, ring: 0.4 }], 'a ringed one is shaded as its disc, as far as its ring reaches');
  const overs = [];
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow() {}, removeShadow() {}, addOverShadow: () => ({}), updateOverShadow: (h, g, covers) => overs.push(covers.map((c) => c.x)), removeOverShadow() {}, clear() {} };
  const torch = { shine: 1, strength: 0.5, angle: 180, distance: 150, brightness: 1, elevation: 10, key: 't' };
  const lit = { light: torch, lights: [torch], darkness: 1 };
  const walker = (id, x, width) => ({ id, x, y: 500, width, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', light: () => lit });
  const run = (list) => { overs.length = 0; createMovementFeel({ groundShadows: () => true, shadowsOverTokens: () => true, tokens: () => list, enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {}, sun: () => null }).tick(); return overs.flat(); };
  // The light to the west: the dragon's shadow falls east, over the cat behind it.
  assert.deepEqual(run([walker('dragon', 500, 300), walker('cat', 760, 100)]), [760]);
  assert.deepEqual(run([walker('dog', 500, 100), walker('cat', 620, 100)]), [], 'a medium creature shades no one');
  assert.deepEqual(run([walker('dragon', 500, 300), walker('cat', 300, 100)]), [], 'not the one on the lit side');
  // A second, weaker light to the east: its shadow shades the cat to the west too.
  const east = { ...torch, angle: 0, distance: 250, brightness: 0.6, key: 'e' };
  lit.lights = [torch, east];
  assert.deepEqual(run([walker('dragon', 500, 300), walker('cat', 300, 100), walker('dog', 760, 100)]).sort(), [300, 760]);
});
test('a shadow is not laid over a creature its caster is drawn over (a top-down token lying on it)',async()=>{
  const { createMovementFeel, drawnOver } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const dragon = { x: 500, y: 500, width: 300, elevation: 0, order: 1e7 };
  assert.equal(drawnOver(dragon, { x: 620, y: 500, width: 100, elevation: 0, order: 1 }), true, 'beneath it and drawn under it');
  assert.equal(drawnOver(dragon, { x: 760, y: 500, width: 100, elevation: 0, order: 1 }), false, 'beside it');
  assert.equal(drawnOver({ ...dragon, order: 0 }, { x: 620, y: 500, width: 100, elevation: 0, order: 1 }), false, 'drawn over the dragon');
  assert.equal(drawnOver({ ...dragon, elevation: 30 }, { x: 620, y: 500, width: 100, elevation: 0, order: 1 }), false, 'a flier is drawn above the shade by its elevation');
  const overs = [];
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow() {}, removeShadow() {}, addOverShadow: () => ({}), updateOverShadow: (h, g, covers) => overs.push(covers.map((c) => c.x)), removeOverShadow() {}, clear() {} };
  const torch = { shine: 1, strength: 0.5, angle: 180, distance: 150, brightness: 1, elevation: 10, key: 't' };
  const lit = { light: torch, lights: [torch], darkness: 1 };
  const walker = (id, x, width, order) => ({ id, x, y: 500, width, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', light: () => lit, order: () => order });
  const run = (list) => { overs.length = 0; createMovementFeel({ groundShadows: () => true, shadowsOverTokens: () => true, tokens: () => list, enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {}, sun: () => null }).tick(); return overs.flat(); };
  assert.deepEqual(run([walker('dragon', 500, 300, 0), walker('cat', 620, 100, 1)]), [620], 'a regular dragon, drawn under the cat: the cat is in its shade');
  assert.deepEqual(run([walker('dragon', 500, 300, 1e7), walker('cat', 620, 100, 1)]), [], 'a top-down dragon over the cat: no shade painted over the dragon');
  assert.deepEqual(run([walker('dragon', 500, 300, 1e7), walker('cat', 760, 100, 1)]), [760], 'one behind it, clear of its art, still is');
});
test('each shadow says whether it is the sun’s and carries the floor its light reaches, to stop at walls',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const drawn = [];
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => drawn.push(g), removeShadow() {}, clear() {} };
  const torch = { shine: 1, strength: 0.5, angle: 0, distance: 150, brightness: 1, elevation: 10, key: 't' };
  const clips = { sun: [0, 0, 900, 0, 900, 900], t: [100, 100, 800, 100, 800, 800] };
  const walker = { id: 'w', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', light: () => ({ light: torch, lights: [torch], darkness: 0.5, clips }) };
  createMovementFeel({ groundShadows: () => true, tokens: () => [walker], enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {} }).tick();
  const sun = drawn.find((g) => g.sun), lamp = drawn.find((g) => !g.sun);
  assert.ok(sun && lamp, 'one of each');
  assert.equal(sun.clip, clips.sun);
  assert.equal(lamp.clip, clips.t);
  // No clip given (open ground): none on the shadow.
  drawn.length = 0;
  walker.light = () => ({ light: torch, lights: [torch], darkness: 0.5 });
  createMovementFeel({ groundShadows: () => true, tokens: () => [walker], enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {} }).tick();
  assert.ok(drawn.every((g) => !('clip' in g)));
});
test('a creature in a wall’s shade casts no sun shadow, only its lamps’; half shade, half the sun',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const drawn = [];
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => drawn.push(g), removeShadow() {}, clear() {} };
  const run = (shade) => {
    drawn.length = 0;
    const walker = { id: 'w', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', light: () => ({ light: null, lights: [], darkness: 0, shade }) };
    createMovementFeel({ groundShadows: () => true, tokens: () => [walker], enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {} }).tick();
    return drawn[0].alpha;
  };
  const sunlit = run(0);
  assert.ok(sunlit > 0.1);
  assert.equal(run(1), 0, 'in the wall’s shade');
  assert.ok(run(0.5) > 0 && run(0.5) < sunlit, 'behind a hedge');
});
test('a creature in its own shape casts only its lights’ shadows: no round one under it',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const { lightAround } = await import('../../../scripts/engines/playback/surrounding-light.mjs');
  const one = (x, y, key) => ({ ...lightAround({ x: 0, y: 0 }, [{ x, y, radius: 400, bright: 200, alpha: 0.5, elevation: 10 }], 1), key });
  const geoms = new Map();
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => geoms.set(h, g), removeShadow: (h) => geoms.delete(h), clear() {} };
  let t = 0;
  const lit = { light: null, lights: [one(150, 0, 'e'), one(-150, 0, 'w'), one(0, 150, 's')], darkness: 1 };
  const walker = { id: 'w', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', art: {}, light: () => lit };
  const feel = createMovementFeel({ groundShadows: () => true, tokens: () => [walker], enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => t, layer, footstep() {}, sun: () => null });
  feel.tick(); t += 1000; feel.tick();
  assert.equal(geoms.size, 3);
  assert.ok([...geoms.values()].every((g) => !(g.contact > 0) && g.art), 'each in its shape, where its light lays it');
});
test('the shadow eases round to a new light instead of jumping',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const seen = [];
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => seen.push(g), removeShadow() {}, clear() {} };
  let t = 0, angle = 0;
  const flier = { id: 'f', x: 500, y: 500, width: 100, elevation: 20, base: 0, visible: true, gait: 'none', action: 'fly', light: () => ({ light: { strength: 0.8, angle, elevation: 50, distance: 100 }, darkness: 1 }) };
  const feel = createMovementFeel({ tokens: () => [flier], floorAt: () => 'stone', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => t, layer, footstep() {} });
  feel.tick();
  assert.ok(seen.at(-1).fall.x < 500, 'away from a light on the right');
  angle = 180; t = 50; feel.tick();
  assert.ok(seen.at(-1).fall.x < 500, 'still mostly where it was after 50 ms');
  t = 2000; feel.tick();
  assert.ok(seen.at(-1).fall.x > 500, 'round to the other side');
});
test('a hovering flier’s shadow breathes with its bob: wider, softer and fainter as it rises',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const seen = [];
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => seen.push(g), removeShadow() {}, clear() {} };
  let up = 0;
  const flier = { id: 'f', x: 500, y: 500, width: 100, elevation: 20, base: 0, visible: true, gait: 'none', action: 'fly', bob: () => up };
  const feel = createMovementFeel({ tokens: () => [flier], floorAt: () => 'stone', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {} });
  feel.tick(); const rest = seen.at(-1);
  up = 5; feel.tick(); const high = seen.at(-1);
  up = -5; feel.tick(); const low = seen.at(-1);
  assert.ok(high.rx > rest.rx && high.alpha < rest.alpha && high.lift > rest.lift);
  assert.ok(low.rx < rest.rx && low.alpha > rest.alpha);
  assert.equal(high.x, rest.x, 'it stays on the floor');
});
test('a hovering flier’s light shadow moves with its bob: away from the light as it rises, back as it dips',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const seen = [];
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => seen.push(g), removeShadow() {}, clear() {} };
  let up = 0;
  // The light to the left of it (angle 180 from the creature): its shadow falls to the right.
  const flier = { id: 'f', x: 500, y: 500, width: 100, elevation: 20, base: 0, visible: true, gait: 'none', action: 'fly', bob: () => up, light: () => ({ lights: [{ key: 'a', angle: 0, distance: 300, strength: 1, shine: 1, brightness: 1, elevation: 60 }], darkness: 1 }) };
  const feel = createMovementFeel({ tokens: () => [flier], floorAt: () => 'stone', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {} });
  feel.tick(); const rest = Math.hypot(seen.at(-1).fall.x - 500, seen.at(-1).fall.y - 500);
  up = 5; feel.tick(); const high = Math.hypot(seen.at(-1).fall.x - 500, seen.at(-1).fall.y - 500);
  up = -5; feel.tick(); const low = Math.hypot(seen.at(-1).fall.x - 500, seen.at(-1).fall.y - 500);
  assert.ok(high > rest + 5, `${high} from ${rest}`);
  assert.ok(low < rest - 5, `${low} from ${rest}`);
});
test('in a light’s bright radius the shadow is dark and crisp; out in its dim light, faint and soft',async()=>{
  const { shadowFall } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const at = (brightness) => shadowFall({ width: 100, lift: 4, darkness: 1, lightHeight: 10, light: { strength: 0.6, angle: 0, distance: 100, brightness } });
  const bright = at(1), dim = at(0.3);
  assert.ok(bright.alpha > dim.alpha && bright.soft < dim.soft);
  assert.ok(bright.soft <= 0.3, 'a close light: a little soft even when bright');
  assert.ok(shadowFall({ width: 100, lift: 4, darkness: 0 }).soft < bright.soft, 'full sun: crisper than any lamp');
});
test('every light casts its own shadow by its share: a torch barely shows by day, both at dusk, only the torch at night',async()=>{
  const { shadowFalls } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const torch = { strength: 0.6, angle: 0, distance: 100, brightness: 1 }, sun = { angle: -135, height: 55, strength: 1 };
  const at = (darkness) => shadowFalls({ width: 100, lift: 0.5, grounded: true, darkness, lightHeight: 1, light: torch, sun, grid: 100 });
  const day = at(0), dusk = at(0.5), night = at(1);
  assert.ok(day.sun.alpha > 0.5 && day.lamp && day.lamp.alpha < day.sun.alpha / 2, 'day: the sun’s dark, the torch’s clearly fainter');
  assert.ok(dusk.sun && dusk.lamp && dusk.lamp.alpha > day.lamp.alpha, 'dusk: both, the torch’s stronger');
  assert.equal(night.sun, null, 'night: no sun');
  assert.ok(night.lamp.alpha > dusk.lamp.alpha);
  assert.ok(day.lamp.dx < 0 && day.sun.dx > 0, 'each away from its own light');
  // A light giving under a tenth of the light casts none.
  assert.equal(shadowFalls({ width: 100, lift: 0.5, grounded: true, darkness: 0, lightHeight: 1, light: { ...torch, strength: 0.1 }, sun, grid: 100 }).lamp, null);
});
test('a creature lit by the sun and a torch gets a second shadow, gone again when the torch is',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  let live = 0, t = 0, light = { strength: 0.8, angle: 0, distance: 100, brightness: 1 };
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => { live++; return {}; }, updateShadow() {}, removeShadow: () => { live--; }, clear() {} };
  const walker = { id: 'w', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', art: () => ({}), light: () => ({ light, darkness: 0.5 }) };
  const feel = createMovementFeel({ groundShadows: () => true, tokens: () => [walker], floorAt: () => 'stone', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => t, layer, footstep() {} });
  feel.tick();
  assert.equal(live, 2, 'the sun’s and the torch’s');
  light = null; t = 3000; feel.tick();
  assert.equal(live, 1, 'the torch’s fades out and goes');
});
test('a token set to cast no shadow has none, standing or flying, and gets one back when the setting is cleared',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  let live = 0, t = 0;
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => { live++; return {}; }, updateShadow() {}, removeShadow: () => { live--; }, clear() {} };
  const ghost = { id: 'g', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', shadow: false };
  const feel = createMovementFeel({ groundShadows: () => true, tokens: () => [ghost], floorAt: () => 'stone', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => t, layer, footstep() {} });
  feel.tick();
  assert.equal(live, 0, 'standing: none');
  ghost.elevation = 30; ghost.action = 'fly'; t += 16; feel.tick();
  assert.equal(live, 0, 'flying: none');
  delete ghost.shadow; t += 16; feel.tick();
  assert.equal(live, 1, 'cleared: its shadow is back');
  ghost.shadow = false; t += 16; feel.tick();
  assert.equal(live, 0, 'set again: gone');
});
test('a still creature’s shadow is left alone once it has settled, and redrawn as soon as it moves',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  let updates = 0, t = 0;
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: () => { updates++; return true; }, removeShadow() {}, clear() {} };
  const lit = { light: null, darkness: 0 }, art = () => ({});
  const walker = { id: 'w', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', art, light: () => lit };
  const feel = createMovementFeel({ groundShadows: () => true, tokens: () => [walker], floorAt: () => 'stone', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => t, layer, footstep() {} });
  for (let i = 0; i < 120; i++) { t += 16; feel.tick(); }
  const settledAfter = updates;
  for (let i = 0; i < 60; i++) { t += 16; feel.tick(); }
  assert.equal(updates, settledAfter, 'no updates while nothing changes');
  assert.ok(settledAfter < 60, 'it settles within the easing');
  walker.x = 600; t += 16; feel.tick();
  assert.ok(updates > settledAfter, 'moving redraws it');
});
test('one rule for every shadow: a low sun or a near torch throws a standing creature’s shadow long, stretched and fainter',async()=>{
  const { shadowFalls } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const stand = (sun, extra = {}) => shadowFalls({ width: 100, lift: 0.8, grounded: true, darkness: 0, sun, grid: 100, ...extra }).sun;
  const noon = stand({ angle: 90, height: 70, strength: 1 }), dusk = stand({ angle: 180, height: 12, strength: 1 });
  assert.ok(Math.hypot(dusk.dx, dusk.dy) > Math.hypot(noon.dx, noon.dy) * 4, 'long at dusk');
  assert.ok(dusk.alpha < noon.alpha && dusk.soft > noon.soft, 'fainter and softer the longer it is');
  assert.ok(noon.dy < 0 && dusk.dx > 0, 'away from the sun');
  // A flier's shadow sits at the full projected distance; a standing creature's centre at half (it starts at the feet).
  const flier = shadowFalls({ width: 100, lift: 2, darkness: 0, sun: { angle: 180, height: 45, strength: 1 }, grid: 100 }).sun;
  const walker = shadowFalls({ width: 100, lift: 2, grounded: true, darkness: 0, sun: { angle: 180, height: 45, strength: 1 }, grid: 100 }).sun;
  assert.ok(Math.abs(flier.dx - 200) < 1e-6 && Math.abs(walker.dx - 100) < 1e-6);
  // A torch a square away at head height and a half: the same rule.
  const torch = shadowFalls({ width: 100, lift: 0.8, grounded: true, darkness: 1, sun: null, lightHeight: 1.5, grid: 100, light: { strength: 0.8, angle: 0, distance: 100, brightness: 1 } }).lamp;
  assert.ok(torch.dx < 0 && Math.abs(torch.dx) > 50, 'a long shadow away from a near, low torch');
});
test('a light must be above all of a flier to cast its shadow: a torch beside a big creature low in the air casts none',async()=>{
  const { shadowFalls } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const torch = { strength: 0.8, angle: 0, distance: 200, brightness: 1 };
  // A 3-square dragon "flying" at the floor (2.4 squares tall) beside a torch held at a square and a half: none.
  assert.equal(shadowFalls({ width: 300, lift: 0, body: 2.4, darkness: 1, sun: null, lightHeight: 1.5, light: torch, grid: 100 }).lamp, null);
  // A small flier at the floor under the same torch: it casts one.
  assert.ok(shadowFalls({ width: 50, lift: 0, body: 0.4, darkness: 1, sun: null, lightHeight: 1.5, light: torch, grid: 100 }).lamp);
  // A light high above the dragon in the air: it does.
  assert.ok(shadowFalls({ width: 300, lift: 6, body: 2.4, darkness: 1, sun: null, lightHeight: 12, light: torch, grid: 100 }).lamp);
});
test('"Shadows in creatures’ shapes" off draws round shadows; "A shadow for each light" off draws one',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const run = (shapes, both) => {
    const geoms = [];
    const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => { geoms.push(g); return true; }, removeShadow() {}, clear() {} };
    const walker = { id: 'w', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'walk', art: () => ({}), light: () => ({ light: { strength: 0.8, angle: 0, distance: 100, brightness: 1 }, darkness: 0.5 }) };
    const feel = createMovementFeel({ groundShadows: () => true, shadowShapes: () => shapes, lightShadows: () => both, tokens: () => [walker], floorAt: () => 'stone', enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => 0, layer, footstep() {} });
    feel.tick();
    return geoms;
  };
  const full = run(true, true), round = run(false, true), one = run(true, false);
  assert.equal(full.length, 2, 'the sun’s and the lamp’s');
  assert.ok(full.every((g) => g.art));
  assert.ok(round.every((g) => !g.art) && round.length === 2, 'round, still one for each light');
  assert.ok(round[0].along !== undefined && round[0].fall, 'round shadows still fall away from the light');
  assert.equal(one.length, 1, 'one shadow, from the stronger light');
});

test('a hovering creature’s light shadow moves only along its fall as it bobs, by twice the bob',async()=>{
  const { createMovementFeel } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const { lightAround } = await import('../../../scripts/engines/playback/surrounding-light.mjs');
  let last = null;
  const layer = { addParticle: () => ({}), updateParticle() {}, removeParticle() {}, addShadow: () => ({}), updateShadow: (h, g) => { last = g; }, removeShadow() {}, clear() {} };
  let t = 0, bob = 0;
  // A torch three squares away, held up: set to fly at the floor's height, it hovers in place and bobs.
  const torch = { ...lightAround({ x: 500, y: 500 }, [{ x: 200, y: 600, radius: 800, bright: 400, alpha: 0.5, elevation: 10 }], 1), key: 'torch' };
  const lit = { light: torch, lights: [torch], darkness: 1 };
  const flier = { id: 'f', x: 500, y: 500, width: 100, elevation: 0, base: 0, visible: true, gait: 'none', action: 'fly', light: () => lit, bob: () => bob };
  const feel = createMovementFeel({ groundShadows: () => true, tokens: () => [flier], enabled: () => true, density: () => 1, grid: () => 100, distance: () => 5, now: () => t, layer, footstep() {}, sun: () => null });
  const settle = () => { for (let i = 0; i < 20; i++) { t += 100; feel.tick(); } return { ...last.fall }; };
  feel.tick();
  const still = settle();
  for (const b of [5, -5, 3]) {
    bob = b;
    const now = settle();
    assert.ok(Math.abs(Math.hypot(now.x - still.x, now.y - still.y) - Math.abs(b) * 2) < 0.5, `bob ${b}: ${JSON.stringify(now)} vs ${JSON.stringify(still)}`);
  }
});

test('snow lying on the open ground is snow underfoot, from a quarter of a cover; water and ice stay', async () => {
  const { snowFloor } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  assert.equal(snowFloor('grass', 0.6), 'snow');
  assert.equal(snowFloor('stone', 0.3), 'snow');
  assert.equal(snowFloor('grass', 0.1), 'grass', 'a dusting: the grass still');
  assert.equal(snowFloor('water', 1), 'water');
  assert.equal(snowFloor('ice', 1), 'ice');
});

test('controller: fresh snow fills the tracks in it: prints age as many times as fast as fills() gives for their floor', () => {
  const run = (fills) => {
    const token = { id: 'fill', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true };
    const h = harness({ tokens: [token], floor: 'snow', printLifetime: 10000, fills });
    h.feel.tick(); token.x = 160; h.advance(16); h.feel.tick();
    for (let i = 0; i < 10; i++) { h.advance(200); h.feel.tick(); }
    return h.feel.prints;
  };
  assert.ok(run(undefined) > 0, 'two seconds on, still there');
  assert.equal(run((floor) => (floor === 'snow' ? 6 : 1)), 0, 'in a blizzard: filled in');
  assert.ok(run((floor) => (floor === 'mud' ? 6 : 1)) > 0, 'only their own floor');
});

test('a walking plant leaves root prints and sheds a leaf every other stride, on any floor but water', async () => {
  const { puffsFor, shedLeaf, LEAF_COLORS } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const at = (index) => ({ x: 500, y: 500, heading: 0, index });
  const snow = puffsFor('snow', at(1), { gait: 'roots', width: 100 });
  assert.ok(snow.some((p) => p.kind === 'print' && p.gait === 'roots'), 'root prints in the snow');
  const grass = puffsFor('grass', at(2), { gait: 'roots', width: 100 });
  const leaf = grass.find((p) => p.gait === 'leaf');
  assert.ok(leaf, 'a leaf on the grass, which keeps no prints');
  assert.ok(LEAF_COLORS.includes(leaf.color), 'in its own colour, not the ground\'s');
  assert.equal(shedLeaf('grass', at(3)), null, 'every other stride');
  assert.equal(shedLeaf('water', at(2)), null, 'none on water');
  assert.ok(!puffsFor('grass', at(2), { gait: 'boots', width: 100 }).some((p) => p.gait === 'leaf'), 'only plants shed');
});

test('water frozen over is ice underfoot, most of the way frozen and only where it freezes', async () => {
  const { frozenFloor } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  assert.equal(frozenFloor('water', 0.8), 'ice');
  assert.equal(frozenFloor('water', 0.3), 'water', 'still thin: water');
  assert.equal(frozenFloor('water', 1, false), 'water', 'a hot spring');
  assert.equal(frozenFloor('grass', 1), 'grass');
});

test('dragon tread: one print a stride, left and right, far enough apart that none lands on the last', async () => {
  const { tracksFor, STRIDE } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const part = { kind: 'print', emit: 'print', color: 0, alpha: 1, size: 0.11 }, grid = 100;
  const prints = (width, last = 12) => Array.from({ length: last }, (_, i) => tracksFor('dragon', part, {}, { x: i * grid * STRIDE, y: 0, heading: 0, index: i + 1 }, { grid, width }).filter((p) => p.gait === 'dragon')).flat();
  for (const width of [100, 200, 300, 600]) {
    const all = prints(width, 24);
    assert.ok(all.length >= 3, `${width}: it does print`);
    for (let i = 1; i < all.length; i++) {
      assert.ok(all[i].x - all[i - 1].x >= width * 0.36, `${width}: spaced for its size`);
      assert.equal(Math.sign(all[i].y), -Math.sign(all[i - 1].y), `${width}: the other side`);
    }
  }
  const one = tracksFor('dragon', part, {}, { x: 0, y: 0, heading: 0, index: 1 }, { grid, width: 100 });
  assert.equal(one.filter((p) => p.gait === 'dragon').length, 1, 'never a cluster');
  assert.ok(one.some((p) => p.kind === 'groove'), 'the tail still drags');
});

test('in snow, mud and sand only feet press hollows: a tail or a furrow stays a groove', async () => {
  const { puffsFor } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  for (const floor of ['snow', 'mud', 'sand']) for (const gait of ['dragon', 'claws', 'slither', 'ooze', 'boots', 'paws']) {
    const marks = puffsFor(floor, { x: 0, y: 0, heading: 0, index: 1 }, { seed: 'g', grid: 100, density: 1, width: 100, gait, amount: 1 });
    for (const m of marks.filter((p) => p.kind === 'groove')) assert.equal(m.hollow, undefined, `${floor} ${gait}`);
    if (['dragon', 'boots', 'paws'].includes(gait)) assert.ok(marks.some((p) => p.kind === 'print' && p.hollow === floor), `${floor} ${gait}: its foot is pressed`);
  }
});

test('every step is its own: turned outward by its foot, mirrored, varied in depth, the same on every screen', async () => {
  const { puffsFor, STEP_TURN, stepNoise } = await import('../../../scripts/engines/motion/movement-feel.mjs');
  const steps = (seed = 'a', opts = {}, floor = 'snow') => Array.from({ length: 40 }, (_, i) => puffsFor(floor, { x: 0, y: 0, heading: 0, index: i + 1 }, { seed, grid: 100, width: 100, gait: 'boots', ...opts }).filter((p) => p.kind === 'print')).flat();
  const all = steps(), deg = (p) => (p.rotation * 180) / Math.PI;
  assert.deepEqual(steps().map((p) => p.rotation), all.map((p) => p.rotation), 'every screen alike');
  assert.notDeepEqual(steps('b').map((p) => p.rotation), all.map((p) => p.rotation), 'each creature its own');
  const [out, by] = STEP_TURN.boots;
  for (const p of all) { const outer = p.mirror ? -1 : 1; assert.ok(Math.abs(deg(p) - outer * out) <= by + 1e-9); assert.equal(Math.sign(p.y), outer, 'the foot on that side'); }
  assert.ok(new Set(all.map((p) => p.rotation)).size > 30);
  const depths = all.map((p) => p.depth);
  assert.ok(Math.min(...depths) >= 0.65 && Math.max(...depths) <= 1); assert.ok(Math.max(...depths) - Math.min(...depths) > 0.2, 'not all even');
  for (const p of all) assert.equal(p.alpha, p.depth, 'a shallower hollow shows fainter');
  for (const p of steps('a', {}, 'sand')) assert.equal(p.hollow, 'sand', 'sand takes prints as snow and mud do');
  assert.ok(Math.abs(stepNoise('a', 1, 'x')) <= 1);
  assert.equal(steps('a', { gait: 'paws', shape: 'cat' })[0].gait, 'cat');
});
