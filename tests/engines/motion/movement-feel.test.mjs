import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOORS, FLOOR_CHOICES, FLOOR_LOOK, autoFloor, sceneFloor, regionFloor, floorAt, isFlying, shadowGeometry,
  createStrideTracker, puffsFor, particleState, movementDensity, footstepFile, createMovementFeel, STRIDE,
  FOOTSTEP_FILES, footstepVolume, footstepVariation, PARTICLE_KINDS, stepWeight, stepGap, createStepPacer, thudFile,
  thudLevel, TRACKS, audioPeakMs, thudDelayMs, THUD_PEAK_MS, perceive,
} from '../../../scripts/engines/motion/movement-feel.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {carriedPrints,bloodDrop} from '../../../scripts/engines/motion/ground-trails.mjs';

test('floors: every choice has a look, and the select starts with From the scene', () => {
  assert.deepEqual(FLOORS, ['stone', 'wood', 'dirt', 'grass', 'sand', 'snow', 'water', 'ice', 'mud']);
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
    stone: ['chip', 'scuff'], wood: ['fleck', 'scuff'], dirt: ['puff'], grass: ['blade', 'trample', 'tuft'], sand: ['print', 'streak'],
    snow: ['print', 'puff'], water: ['drop', 'ring'], ice: ['crack', 'spark', 'streak'], mud: ['blob', 'print'],
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
  assert.deepEqual(kindsOf('lava'), kindsOf('stone'));
});

test('puffsFor: prints alternate sides, follow the heading and scale with the token', () => {
  for (const floor of ['sand', 'snow', 'mud']) {
    const heading = Math.PI / 2;
    const print = (index, width = 100) => puffsFor(floor, { x: 500, y: 500, heading, index }, { seed: 'p', grid: 100, width }).find((p) => p.kind === 'print');
    const a = print(1), b = print(2);
    assert.ok(a && b, floor);
    assert.equal(a.rotation, heading);
    assert.equal(b.rotation, heading);
    // Heading straight down (+y): the side offset is along x, opposite for each foot, none along the path.
    assert.ok(Math.abs(a.y - 500) < 1e-6 && Math.abs(b.y - 500) < 1e-6, floor);
    assert.ok(Math.sign(a.x - 500) === -Math.sign(b.x - 500) && a.x !== 500, floor);
    assert.deepEqual([a.vx, a.vy, a.grow], [0, 0, 0]);
    const big = print(1, 300);
    assert.ok(big.radius > a.radius * 2.5);
    assert.ok(Math.abs(big.x - 500) > Math.abs(a.x - 500) * 2.5);
    // A print fades slowly: still most of the way there halfway through its life.
    const half = particleState(a, a.delay + a.life / 2);
    assert.ok(half.alpha > a.alpha * 0.5, floor);
    assert.equal(half.rotation, heading);
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
    assert.deepEqual(offsets(c), offsets(a), gait);
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
    assert.deepEqual(offsets(tracks(gait, 3)), one, gait);
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
  // Mid-hop it is lifted off its ground path; landed, it rests and only fades.
  const groundY = chip.y + chip.vy * (chip.life * (1 - (1 - 0.15 / 0.35) ** 2)) / 1000;
  assert.ok(c1.y < groundY - 0.5);
  const l1 = particleState(chip, chip.delay + chip.life * 0.5), l2 = particleState(chip, chip.delay + chip.life * 0.8);
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
  assert.equal(sceneFloor({ flag: 'lava', name: 'Crypt' }), 'stone');
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
  assert.ok(a.every((p) => p.kind === 'puff' && p.color === FLOOR_LOOK.dirt.parts[0].color && p.life > 0));
  assert.notDeepEqual(puffsFor('dirt', { ...at, index: 4 }, { seed: 'tok', grid: 100 }), a);
  assert.ok(puffsFor('snow', at, { seed: 'tok', grid: 100 }).length > puffsFor('stone', at, { seed: 'tok', grid: 100 }).length);
  const water = puffsFor('water', at, { seed: 'tok', grid: 100 });
  assert.ok(water.some((p) => p.kind === 'ring'));
  const stone = puffsFor('stone', at, { seed: 'tok', grid: 100 });
  const scuff = stone.filter((p) => p.kind === 'scuff');
  assert.equal(scuff.length, 1);
  assert.ok(scuff[0].alpha <= 0.35, "a scuff stays a light mark");
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
  for (const [floor, files] of Object.entries(FOOTSTEP_FILES)) for (const file of files) {
    assert.ok(!owner.has(file) || owner.get(file) === floor, `${file} is used by both ${owner.get(file)} and ${floor}`);
    owner.set(file, floor);
  }
  for (const floor of FLOORS) assert.ok(FOOTSTEP_FILES[floor]?.length >= 3, `${floor} has its own family`);
});

test('footstepFile: every floor has its own bundled steps, varied by n, that exist on disk', () => {
  const own = { stone: /freesound\/stone-step-/, wood: /freesound\/wood-step-/, grass: /freesound\/grass-step-/,
    dirt: /freesound\/dirt-step-/, snow: /kenney\/snowstep_/, sand: /freesound\/sand-step-/,
    water: /freesound\/water-step-/, mud: /freesound\/mud-step-/, ice: /freesound\/ice-step-/ };
  for (const floor of FLOORS) {
    assert.ok(own[floor], `no expectation for ${floor}`);
    const files = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((n) => footstepFile(floor, n)));
    assert.ok(files.size >= 3, `${floor} varies`);
    for (const file of files) {
      assert.match(file, /^modules\/animater\/assets\/sounds\/surfaces\/(kenney|freesound)\/[\w-]+\.ogg$/, floor);
      assert.match(file, own[floor], floor);
      assert.ok(existsSync(fileURLToPath(new URL(`../../../${file.replace('modules/animater/', '')}`, import.meta.url))), file);
    }
    assert.equal(footstepFile(floor, 2), footstepFile(floor, 2));
    assert.equal(footstepFile(floor, -2), footstepFile(floor, 2));
  }
  assert.equal(footstepFile('lava', 1), footstepFile('stone', 1));
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

function harness({ tokens, floor = 'dirt', enabled = true, density = 1, cap = 200, printCap, printLifetime, trails, steps = [] } = {}) {
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
    now: () => time, layer, cap, printCap, printLifetime, trails, footstep: (f, at, t) => steps.push([f, t.id]),
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

test('dragon tracks: heavy four-legged prints with a tail drag, bigger than a bird track', () => {
  assert.equal(TRACKS.dragon.feet, 'quad');
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

test('grass: big bright blades with a dark edge, a bigger springy tuft, and trampled grass under each foot', () => {
  const at = { x: 500, y: 500, heading: 0, index: 3 };
  const full = puffsFor('grass', at, { seed: 'g', grid: 100 });
  // Blades: 6-8 per stride, ~0.08-0.12 squares long, yellow-green with a darker green edge so they read on grass art.
  const blades = full.filter((p) => p.kind === 'blade');
  assert.ok(blades.length >= 6 && blades.length <= 8, `${blades.length} blades`);
  const length = blades.reduce((sum, p) => sum + 2 * p.radius, 0) / blades.length;
  assert.ok(length >= 8 && length <= 12, `blades ${length.toFixed(1)} px long on a 100 px grid`);
  for (const b of blades) {
    assert.ok(luma(b.color) > luma(0x87ae4f), `blade ${b.color.toString(16)} brighter than before`);
    assert.ok(Number.isFinite(b.edge) && luma(b.edge) < luma(b.color) - 60, 'a darker edge');
  }
  // The tuft is about a quarter square, bends and springs back.
  const tuft = full.find((p) => p.kind === 'tuft');
  assert.ok(2 * tuft.radius >= 22 && 2 * tuft.radius <= 30, `tuft ${2 * tuft.radius}`);
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
