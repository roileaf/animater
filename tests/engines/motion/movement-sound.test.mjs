import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  movementSound, MOVE_SOUND_KINDS, MOVE_SOUND_FILES, moveSoundFile, moveSoundGap, moveSoundShape, stepGap, createStepPacer,
  FOOTSTEP_FILES, burrowTrail, burrowHole, swimWake, underwaterBubbles, movementEnvironment, createMovementFeel, STRIDE, STOP_MS, PARTICLE_KINDS, particleState,
} from '../../../scripts/engines/motion/movement-feel.mjs';
import { createMovementFeelLayer } from '../../../scripts/engines/motion/movement-feel-render.mjs';

test('movementSound: each Foundry movement action has its own sound', () => {
  assert.equal(movementSound('walk'), 'step');
  assert.equal(movementSound(undefined), 'step');
  assert.equal(movementSound('fly'), 'flight');
  assert.equal(movementSound('FLY', { flight: 'wing' }), 'wing');
  assert.equal(movementSound('burrow'), 'burrow');
  assert.equal(movementSound('swim'), 'swim');
  assert.equal(movementSound('climb'), 'climb');
  assert.equal(movementSound('crawl'), 'crawl');
  assert.equal(movementSound('jump'), 'jump');
  // Teleports are silent here.
  assert.equal(movementSound('blink'), null);
  assert.equal(movementSound('displace'), null);
  // A system's own action steps like a walk.
  assert.equal(movementSound('travel'), 'step');
});

test('movementSound: a flying status beats wings on a walk; water stays a footstep; incorporeal is silent', () => {
  assert.equal(movementSound('walk', { statuses: new Set(['flying']), flight: 'wing' }), 'wing');
  assert.equal(movementSound(undefined, { statuses: ['hover'] }), 'flight');
  // An explicit action wins over the status.
  assert.equal(movementSound('swim', { statuses: ['flying'] }), 'swim');
  // Walking through water splashes with the water footsteps; only the swim action strokes.
  assert.equal(movementSound('walk', { floor: 'water' }), 'step');
  assert.equal(movementSound('swim', { floor: 'water' }), 'swim');
  for (const action of ['walk', 'fly', 'burrow', 'swim', 'jump']) assert.equal(movementSound(action, { gait: 'none' }), null, action);
  assert.equal(movementSound('fly', { gait: 'unknown' }), 'flight');
});

test('movement sound families: three or more bundled files each, on disk, credited, none shared with footsteps', () => {
  const root = new URL('../../../assets/sounds/surfaces/', import.meta.url);
  const credits = readFileSync(new URL('freesound/License.txt', root), 'utf8') + '\n' + readFileSync(new URL('../creatures/completed/License.txt', root), 'utf8');
  const steps = new Set(Object.values(FOOTSTEP_FILES).flat()), seen = new Set();
  for (const kind of MOVE_SOUND_KINDS.filter((k) => k !== 'step')) {
    const files = MOVE_SOUND_FILES[kind];
    assert.ok(files?.length >= 3, `${kind} has a family`);
    for (const file of files) {
      assert.match(file, kind === 'flight' ? /\/creatures\/completed\/flight-any-\d+-\d+\.ogg$/ : new RegExp(`^modules/animater/assets/sounds/surfaces/freesound/${kind}-\\d+-\\d+\\.ogg$`), file);
      assert.ok(existsSync(fileURLToPath(new URL(`../../../${file.replace('modules/animater/', '')}`, import.meta.url))), file);
      const name = file.split('/').pop(), id = name.match(/-(\d+)-\d+\.ogg$/)[1];
      assert.match(credits, new RegExp(`^${name}: ".+" by \\S+, https://freesound\\.org/people/\\S+/sounds/${id}/(?: License: [^\\r\\n]+)?\\r?$`, 'm'), name);
      assert.ok(!steps.has(file) && !seen.has(file), `${file} is its own`);
      seen.add(file);
    }
  }
  assert.equal(MOVE_SOUND_FILES.step, undefined, 'a walk keeps the floor footsteps');
});

test('moveSoundFile: varied, never the same recording twice running, the same on every screen', () => {
  for (const kind of Object.keys(MOVE_SOUND_FILES)) {
    const run = Array.from({ length: 30 }, (_, n) => moveSoundFile(kind, n, { seed: 'tok' }));
    for (let i = 1; i < run.length; i++) assert.notEqual(run[i], run[i - 1], `${kind} ${i}`);
    assert.ok(new Set(run).size >= 3, kind);
    assert.equal(moveSoundFile(kind, 4, { seed: 'tok' }), run[4]);
    for (const file of run) assert.ok(MOVE_SOUND_FILES[kind].includes(file));
  }
  assert.equal(moveSoundFile('step', 1), null);
  assert.equal(moveSoundFile('teleport', 1), null);
});

test('moveSoundGap: wing beats slow with size; each kind its own pace against the walk', () => {
  const wings = [0, 1, 2, 3, 4, 5].map((w) => moveSoundGap('wing', w));
  for (let i = 1; i < wings.length; i++) assert.ok(wings[i] > wings[i - 1], `wing ${i}`);
  assert.equal(wings[0], 140, 'a Tiny flutter');
  assert.ok(wings[2] >= 380 && wings[2] <= 460, `a Medium beat ${wings[2]}`);
  assert.equal(wings[4], 900, 'a Huge WHOOMP');
  assert.equal(wings[5], 1300, 'a Gargantuan one slower still');
  assert.ok(moveSoundGap('wing', 5.75) > 1300, 'a heavy body beats slower');
  for (const w of [0, 2, 4]) {
    assert.equal(moveSoundGap('step', w), stepGap(w));
    assert.equal(moveSoundGap('burrow', w), Math.round(stepGap(w) * 1.5));
    assert.equal(moveSoundGap('swim', w), Math.round(stepGap(w) * 1.3));
    assert.equal(moveSoundGap('climb', w), Math.round(stepGap(w) * 1.4));
    assert.equal(moveSoundGap('crawl', w), Math.round(stepGap(w) * 1.6));
    assert.equal(moveSoundGap('jump', w), 0, 'a whoosh always plays');
    assert.equal(moveSoundGap('land', w), 0, 'a landing always plays');
  }
});

test('step pacer: a kind\'s own gap paces it, and the step numbers carry on per token', () => {
  const pacer = createStepPacer();
  assert.equal(pacer.take('a', 2, 0, moveSoundGap('wing', 2)), 0);
  assert.equal(pacer.take('a', 2, 300, moveSoundGap('wing', 2)), null, 'a Medium wing beat is slower than its step');
  assert.equal(pacer.take('a', 2, 300), 1, 'a step after it uses the walking beat and counts on');
  assert.equal(pacer.take('a', 2, 301, 0), 2, 'no gap: always');
  // A Huge flier over 3 s of strides every 100 ms beats about 4 times, a Tiny one about 20.
  const beats = (weight) => { const p = createStepPacer(); let n = 0; for (let t = 0; t <= 3000; t += 100) if (p.take('f', weight, t, moveSoundGap('wing', weight)) !== null) n++; return n; };
  assert.ok(beats(4) >= 3 && beats(4) <= 4, `huge ${beats(4)}`);
  assert.ok(beats(0) >= 15, `tiny ${beats(0)}`);
});

test('moveSoundShape: heavier wings beat lower, darker and louder; burrows deep; crawls quiet', () => {
  const avg = (kind, weight, key) => Array.from({ length: 40 }, (_, n) => moveSoundShape(kind, { weight, seed: 's', n })[key]).reduce((a, b) => a + b, 0) / 40;
  const rates = [0, 2, 4, 5].map((w) => avg('wing', w, 'rate'));
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i] < rates[i - 1], `wing rate ${i}`);
  assert.ok(rates[0] > 1.3 && Math.abs(rates[1] - 1) < 0.03 && rates[3] < 0.6, rates.join());
  const vols = [0, 2, 4, 5].map((w) => avg('wing', w, 'volume'));
  for (let i = 1; i < vols.length; i++) assert.ok(vols[i] > vols[i - 1], `wing volume ${i}`);
  // Small wings are bright; big ones filtered and given body, more so the bigger.
  assert.equal(moveSoundShape('wing', { weight: 2 }).lowpass, undefined);
  const [l, h, g] = [3, 4, 5].map((weight) => moveSoundShape('wing', { weight }));
  assert.ok(l.lowpass > h.lowpass && h.lowpass > g.lowpass && g.lowpass >= 600);
  assert.ok(l.bass < h.bass && h.bass < g.bass && g.bass <= 10);
  // Burrowing is always deep and dark; a crawl is the quietest.
  const dig = moveSoundShape('burrow', { weight: 2 });
  assert.ok(dig.lowpass <= 1600 && dig.bass >= 4);
  assert.ok(avg('burrow', 2, 'rate') < avg('climb', 2, 'rate'));
  assert.ok(avg('crawl', 2, 'volume') < avg('climb', 2, 'volume') && avg('crawl', 2, 'volume') < avg('swim', 2, 'volume'));
  for (const kind of Object.keys(MOVE_SOUND_FILES)) for (const weight of [0, 2, 5.75]) {
    const s = moveSoundShape(kind, { weight, seed: 'x', n: 3 });
    assert.ok(s.rate >= 0.35 && s.rate <= 1.6 && s.volume > 0 && s.volume <= 1, `${kind} ${weight}`);
    assert.deepEqual(s, moveSoundShape(kind, { weight, seed: 'x', n: 3 }), 'deterministic');
  }
});

test('burrowTrail: a lasting mound of churned earth along the stride and a few clods, fading over ~8 s', () => {
  const at = { x: 500, y: 500, heading: 0, index: 3 };
  const parts = burrowTrail(at, { seed: 'b', grid: 100, width: 100 });
  const mound = parts.find((p) => p.kind === 'mound'), clods = parts.filter((p) => p.kind === 'chip');
  assert.ok(mound && clods.length === 3);
  assert.ok(mound.x < 500, 'it spans the stride just dug, behind the token');
  assert.equal(mound.rotation, 0);
  assert.ok(mound.lumps.length >= 4 && mound.lumps.every(([x, y, r]) => Math.abs(x) <= 1 && Math.abs(y) <= 1 && r > 0));
  for (const p of parts) {
    assert.ok(PARTICLE_KINDS.includes(p.kind));
    assert.equal(p.lasting, true, 'shares the footprint budget');
    assert.equal(p.life, 8000);
    assert.ok(particleState(p, 3000).alpha === p.alpha, 'holds at first');
    assert.ok(particleState(p, 7000).alpha < p.alpha * 0.3, 'then fades');
    assert.equal(particleState(p, 8100), null);
  }
  assert.deepEqual(burrowTrail(at, { seed: 'b' }), burrowTrail(at, { seed: 'b' }), 'the same on every screen');
  assert.notDeepEqual(burrowTrail(at, { seed: 'b' })[0].lumps, burrowTrail({ ...at, index: 4 }, { seed: 'b' })[0].lumps);
});

test('swimWake: two ripple arms behind the swimmer, opening into a V and drifting apart', () => {
  const heading = 0;
  const [a, b] = swimWake({ x: 500, y: 500, heading }, { grid: 100, width: 100 });
  for (const arm of [a, b]) {
    assert.equal(arm.kind, 'wake');
    assert.ok(arm.x < 500, 'behind it');
    assert.ok(arm.life >= 1000 && arm.life <= 2500);
  }
  // Both point back (around π) and diverge, one to each side; they drift away from each other.
  const back = (r) => Math.atan2(Math.sin(r), Math.cos(r));
  assert.ok(Math.abs(Math.abs(back(a.rotation)) - (Math.PI - 0.42)) < 1e-6);
  assert.ok(Math.sign(back(a.rotation)) !== Math.sign(back(b.rotation)));
  assert.ok(Math.sign(a.vy) !== Math.sign(b.vy) && a.vy !== 0);
  assert.ok(Math.abs(a.vx) < 1e-9 || Math.sign(a.vx) === Math.sign(b.vx));
});

test('render: mounds and wake arms draw', () => {
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Graphics {
    constructor() { this.calls = []; this.position = point(); this.scale = point(); }
    beginFill(...a) { this.calls.push(['fill', ...a]); } drawCircle(...a) { this.calls.push(['circle', ...a]); }
    drawEllipse(...a) { this.calls.push(['ellipse', ...a]); } lineStyle(...a) { this.calls.push(['line', ...a]); }
    drawPolygon() {} moveTo(...a) { this.calls.push(['move', ...a]); } lineTo(...a) { this.calls.push(['lineTo', ...a]); }
    endFill() {} destroy() {}
  }
  const root = { addChild() {} };
  const layer = createMovementFeelLayer({ PIXI: { Graphics }, root: () => root });
  const [mound] = burrowTrail({ x: 0, y: 0, heading: 0, index: 1 }, { seed: 'r' });
  const g = layer.addParticle(mound);
  assert.ok(g.calls.filter((c) => c[0] === 'circle').length >= mound.lumps.length);
  assert.ok(g.calls.some((c) => c[0] === 'fill' && c[1] === mound.color));
  const w = layer.addParticle(swimWake({ x: 0, y: 0, heading: 0 })[0]);
  assert.ok(w.calls.filter((c) => c[0] === 'lineTo').length >= 4);
});

// A controller over plain token views; `sounds` records [floor, kind] per host call.
function harness({ tokens, floor = 'dirt', holes, burrowDepth, trailLifetime } = {}) {
  let time = 0;
  const live = new Set(), sounds = [], log = { added: 0, shadows: 0 };
  const layer = {
    addParticle(spec) { const h = { spec }; live.add(h); log.added++; return h; },
    updateParticle() {}, removeParticle(h) { live.delete(h); },
    addShadow() { log.shadows++; return {}; }, updateShadow() {}, removeShadow() {}, clear() { live.clear(); },
  };
  const feel = createMovementFeel({
    tokens: () => tokens, floorAt: () => (typeof floor === 'function' ? floor() : floor), enabled: () => true, density: () => 1,
    grid: () => 100, distance: () => 5, now: () => time, layer, footstep: (f, at, t, kind) => sounds.push([f, kind ?? 'step']),
    ...(holes ? { holes } : {}),
    ...(burrowDepth?{burrowDepth}:{}),...(trailLifetime?{trailLifetime}:{}),
  });
  const walk = (tok, frames, dx = 20) => { for (let i = 0; i < frames; i++) { tok.x += dx; time += 16; feel.tick(); } };
  const wait = (ms) => { for (let t = 0; t < ms; t += 16) { time += 16; feel.tick(); } };
  return { feel, live, sounds, log, walk, wait, kinds: () => [...live].map((h) => h.spec.kind) };
}

test('movement medium distinguishes swimmers from soil, including raised levels and explicit seabed burrowing',()=>{
 assert.deepEqual(movementEnvironment({elevation:10,base:20,action:'swim'},'stone'),{relative:-10,swimming:true,submerged:true,underground:false});
 assert.equal(movementEnvironment({elevation:-5,base:0},'water').submerged,true);
 assert.equal(movementEnvironment({elevation:-5,base:0,action:'burrow'},'water').underground,true);
 assert.equal(movementEnvironment({elevation:-5,base:0},'dirt').underground,true);
 assert.equal(movementEnvironment({elevation:0,base:0,action:'swim'},'water').submerged,false);
});
test('deep burrow paths stop at the exact cutoff, while entrance/exit holes remain at the surface crossings',()=>{
 for(const base of [0,20]){
  const tok={id:`deep-${base}`,x:0,y:0,width:100,elevation:base,base,visible:true},h=harness({tokens:[tok],burrowDepth:()=>-10});h.feel.tick();
  tok.elevation=base-10;h.feel.tick();assert.equal(h.kinds().filter(k=>k==='hole').length,1);
  h.walk(tok,12);assert.equal(h.kinds().filter(k=>k==='hole').length,1);assert.ok(!h.kinds().includes('mound'));assert.ok(h.sounds.some(([,k])=>k==='burrow'));
  tok.elevation=base-5;h.feel.tick();h.walk(tok,6);assert.ok(h.kinds().includes('mound'),'shallow paths still appear');
  const exitX=tok.x;tok.elevation=base;h.feel.tick();const holes=[...h.live].filter(p=>p.spec.kind==='hole');assert.equal(holes.length,2);assert.ok(holes.some(p=>p.spec.x===exitX));
 }
});
test('the burrow cutoff is configurable; a deeper cutoff preserves the same path and holes switch remains independent',()=>{
 const tok={id:'custom-depth',x:0,y:0,width:100,elevation:-15,base:0,visible:true};let cutoff=-20;
 const h=harness({tokens:[tok],burrowDepth:()=>cutoff,holes:()=>false});h.feel.tick();h.walk(tok,8);assert.ok(h.kinds().includes('mound'));
 h.wait(10000);const before=h.log.added;cutoff=-10;h.walk(tok,8);assert.equal(h.log.added,before,'no new deep path');
 tok.elevation=0;h.feel.tick();assert.ok(!h.kinds().includes('hole'));
});
test('underwater movement makes bubbles and swim sounds, never burrow trails/holes, wakes, footprints or flying shadows',()=>{
 for(const [floor,action] of [['water','walk'],['water','swim'],['stone','swim']]){
  const tok={id:`swimmer-${floor}-${action}`,x:0,y:0,width:100,elevation:0,base:0,action,visible:true,statuses:['flying']},h=harness({tokens:[tok],floor});h.feel.tick();
  tok.elevation=-15;h.feel.tick();h.walk(tok,12);
  assert.ok([...h.live].some(p=>p.spec.underwater));assert.ok(h.sounds.every(([,k])=>k==='swim'));assert.ok(!h.kinds().some(k=>['hole','mound','print','groove','wake'].includes(k)));
  tok.elevation=0;h.feel.tick();assert.ok(!h.kinds().includes('hole'),'surfacing creates no soil hole');
  const before=h.sounds.length;h.wait(2500);assert.equal(h.sounds.length,before,'stationary swimmers stay silent');
 }
 const hidden={id:'unseen-water',x:0,y:0,width:100,elevation:-10,base:0,action:'swim',visible:false,audible:true};
 const h=harness({tokens:[hidden],floor:'water'});h.feel.tick();h.walk(hidden,10);assert.equal(h.log.added,0);assert.ok(h.sounds.every(([,k])=>k==='swim'));
});
test('wake, bubble and burrow lifetimes are independent; longer fading does not extend particle travel',()=>{
 for(const [kind,action,elevation,floor] of [['swim','swim',0,'water'],['underwater','swim',-5,'water'],['burrow','burrow',0,'dirt']]){
  const tok={id:kind,x:0,y:0,width:100,elevation,base:0,action,visible:true},h=harness({tokens:[tok],floor,trailLifetime:k=>k===kind?10000:0});h.feel.tick();h.walk(tok,6);
  assert.ok(h.live.size>0);assert.ok([...h.live].every(p=>p.spec.life===10000));h.wait(11000);assert.equal(h.live.size,0);
 }
 const native=swimWake({x:0,y:0})[0],long={...native,life:10000,motionLife:native.life};
 const a=particleState(long,5000),b=particleState(native,native.life);assert.equal(a.x,b.x);assert.equal(a.y,b.y);
 assert.deepEqual(underwaterBubbles({x:0,y:0},{seed:'s'}),underwaterBubbles({x:0,y:0},{seed:'s'}));
});

test('controller: a flier beats its wings while it moves, never while it hovers still, and marks nothing', () => {
  const tok = { id: 'f', x: 0, y: 0, width: 100, elevation: 30, base: 0, action: 'fly', flight: 'wing', visible: true };
  const h = harness({ tokens: [tok] });
  h.feel.tick();
  h.walk(tok, 20);
  assert.ok(h.sounds.length >= 3, `${h.sounds.length}`);
  assert.ok(h.sounds.every(([, kind]) => kind === 'wing'));
  assert.equal(h.log.added, 0, 'no dust or prints from the air');
  assert.equal(h.log.shadows, 1);
  const before = h.sounds.length;
  h.wait(2000);
  assert.equal(h.sounds.length, before, 'hovering still: silent');
  // A flying status on a walk beats wings too.
  const bird = { id: 'b', x: 0, y: 0, width: 100, elevation: 0, base: 0, action: 'walk', flight: 'wing', statuses: new Set(['flying']), visible: true };
  const hb = harness({ tokens: [bird] });
  hb.feel.tick(); hb.walk(bird, 10);
  assert.ok(hb.sounds.length > 0 && hb.sounds.every(([, kind]) => kind === 'wing'));
});

test('controller: wingless flight survives the airborne branch and stays silent while stationary', () => {
  for (const extra of [{ action: 'fly' }, { action: 'walk', statuses: ['levitating'] }]) {
    const tok = { id: 'magic', x: 0, y: 0, width: 100, elevation: 20, base: 0, visible: true, flight: 'flight', ...extra };
    const h = harness({ tokens: [tok] });
    h.feel.tick(); h.walk(tok, 12);
    assert.ok(h.sounds.length > 0);
    assert.ok(h.sounds.every(([, kind]) => kind === 'flight'), 'airborne branch must not force wingbeats');
    assert.equal(h.log.added, 0, 'no floor marks');
    const before = h.sounds.length; h.wait(2000); assert.equal(h.sounds.length, before);
  }
});

test('controller: a burrower churns a lasting earth trail and no dust or prints', () => {
  const tok = { id: 'm', x: 0, y: 0, width: 100, elevation: 0, base: 0, action: 'burrow', visible: true };
  const h = harness({ tokens: [tok], floor: 'snow' });
  h.feel.tick();
  h.walk(tok, 12);
  const kinds = new Set(h.kinds());
  assert.ok(kinds.has('mound') && kinds.has('chip'));
  assert.ok(!kinds.has('print') && !kinds.has('puff'), [...kinds].join());
  assert.ok(h.feel.prints > 0, 'in the long-lived budget');
  assert.ok(h.sounds.length > 0 && h.sounds.every(([, kind]) => kind === 'burrow'));
});

test('controller: explicit swimming leaves wakes, never ground footprints, and retains swim sounds', () => {
  const tok = { id: 's', x: 0, y: 0, width: 100, elevation: 0, base: 0, action: 'swim', visible: true };
  const h = harness({ tokens: [tok], floor: 'water' });
  h.feel.tick(); h.walk(tok, 12);
  assert.deepEqual([...new Set(h.kinds())], ['wake']);
  assert.ok(h.sounds.every(([, kind]) => kind === 'swim'));
  const dry = { ...tok, id: 's2', x: 0 };
  const hd = harness({ tokens: [dry], floor: 'dirt' });
  hd.feel.tick(); hd.walk(dry, 12);
  assert.deepEqual([...new Set(hd.kinds())], ['wake']);
  // Climbing and crawling mark the floor as a walk does, with their own sounds.
  for (const action of ['climb', 'crawl']) {
    const c = { ...tok, id: action, x: 0, action };
    const hc = harness({ tokens: [c], floor: 'dirt' });
    hc.feel.tick(); hc.walk(c, 12);
    assert.deepEqual([...new Set(hc.kinds())], ['puff'], action);
    assert.ok(hc.sounds.length > 0 && hc.sounds.every(([, kind]) => kind === action), action);
  }
});

test('controller: a jump whooshes once as it leaves and lands once, with a puff, where it stops', () => {
  const tok = { id: 'j', x: 0, y: 0, width: 100, elevation: 0, base: 0, action: 'jump', visible: true };
  const h = harness({ tokens: [tok] });
  h.feel.tick();
  h.walk(tok, 15);
  assert.deepEqual(h.sounds.map(([, k]) => k), ['jump'], 'one whoosh, nothing mid-air');
  assert.equal(h.log.added, 0);
  h.wait(STOP_MS + 50);
  assert.deepEqual(h.sounds.map(([, k]) => k), ['jump', 'land']);
  assert.equal(h.sounds[1][0], 'dirt', 'it lands on its floor');
  assert.ok(h.log.added > 0, 'a landing puff');
  h.wait(1000);
  assert.equal(h.sounds.length, 2, 'lands once');
  // The next jump whooshes again.
  h.walk(tok, 10); h.wait(STOP_MS + 50);
  assert.deepEqual(h.sounds.map(([, k]) => k), ['jump', 'land', 'jump', 'land']);
});

test('controller: a walk still steps (kind step); blink, displace and incorporeal make nothing', () => {
  const tok = { id: 'w', x: 0, y: 0, width: 100, elevation: 0, base: 0, action: 'walk', visible: true };
  const h = harness({ tokens: [tok] });
  h.feel.tick(); h.walk(tok, 10);
  assert.ok(h.sounds.length > 0 && h.sounds.every(([f, k]) => f === 'dirt' && k === 'step'));
  for (const extra of [{ action: 'blink' }, { action: 'displace' }, { gait: 'none' }, { gait: 'none', action: 'fly', elevation: 20 }]) {
    const t = { ...tok, id: 'x', x: 0, ...extra };
    const hx = harness({ tokens: [t] });
    hx.feel.tick(); hx.walk(t, 10, STRIDE * 100); hx.wait(500);
    assert.equal(hx.sounds.length, 0, JSON.stringify(extra));
    assert.equal(hx.log.added, 0, JSON.stringify(extra));
  }
});

test('burrowHole: a dark hole with a rim of loose earth that lingers, and gravel thrown out; the exit throws more', () => {
  const at = { x: 500, y: 500, heading: 0 };
  const entrance = burrowHole(at, { seed: 'm', grid: 100, width: 100 });
  const exit = burrowHole(at, { seed: 'm', grid: 100, width: 100, exit: true });
  const holes = (parts) => parts.filter((p) => p.kind === 'hole');
  const gravel = (parts) => parts.filter((p) => p.kind === 'chip' && !p.lasting);
  assert.equal(holes(entrance).length, 1);
  assert.equal(holes(exit).length, 1);
  const hole = holes(entrance)[0];
  assert.ok(hole.lasting === true && hole.life >= 15000, 'lingers ~20 s');
  assert.ok(hole.radius >= 20 && hole.radius <= 45, `about a third of the creature (${hole.radius})`);
  assert.ok(Array.isArray(hole.rim) && hole.rim.length >= 6, 'a rim of earth lumps');
  assert.ok(gravel(entrance).length >= 5, 'gravel kicked out');
  assert.ok(gravel(exit).length > gravel(entrance).length, 'breaking out throws more');
  // Gravel flies outward from the hole and settles, short-lived.
  for (const g of gravel(exit)) {
    const out = (g.vx * (g.x - at.x) + g.vy * (g.y - at.y));
    assert.ok(out >= 0, 'outward');
    assert.ok(g.life <= 1500);
  }
  // The entrance throws earth backwards, the exit all around.
  const back = gravel(entrance).filter((g) => g.vx < 0).length;
  assert.ok(back >= gravel(entrance).length * 0.6, 'dug in: earth thrown back');
  assert.ok(holes(exit)[0].radius > hole.radius, 'the exit hole is wider (it broke out)');
  assert.deepEqual(burrowHole(at, { seed: 'm' }), burrowHole(at, { seed: 'm' }), 'the same on every screen');
  // Bigger burrowers, bigger holes.
  assert.ok(holes(burrowHole(at, { seed: 'm', width: 300 }))[0].radius > hole.radius);
});

test('controller: a burrower leaves an entrance where its elevation drops below the floor and an exit where it comes back up', () => {
  const tok = { id: 'm', x: 0, y: 0, width: 100, elevation: 0, base: 0, action: 'walk', visible: true };
  const h = harness({ tokens: [tok] });
  const holes = () => h.kinds().filter((k) => k === 'hole');
  const holeAt = () => [...h.live].filter((p) => p.spec.kind === 'hole').map((p) => Math.round(p.spec.x));
  h.feel.tick();
  h.walk(tok, 5);
  assert.equal(holes().length, 0, 'walking on the surface: no hole');
  // Goes under at x = 100.
  tok.elevation = -5; h.feel.tick();
  assert.equal(holes().length, 1, 'an entrance as its elevation drops below the floor');
  assert.ok(Math.abs(holeAt()[0] - tok.x) <= 1, 'where it went under');
  h.walk(tok, 12);
  assert.equal(holes().length, 1, 'moving underground: no more holes');
  assert.ok(h.kinds().includes('mound'), 'underground it churns a trail even without the Burrow action');
  assert.ok(h.sounds.some(([, kind]) => kind === 'burrow'), 'and digs');
  h.wait(400);
  assert.equal(holes().length, 1, 'stopping underground is not an exit');
  const exitX = tok.x;
  tok.elevation = 0; h.feel.tick();
  assert.equal(holes().length, 2, 'an exit where it comes back up');
  assert.ok(holeAt().some((x) => Math.abs(x - exitX) <= 1));
  // The Burrow action alone, never leaving the floor: a trail, no holes.
  const surface = { id: 's', x: 0, y: 0, width: 100, elevation: 0, base: 0, action: 'burrow', visible: true };
  const hs = harness({ tokens: [surface] });
  hs.feel.tick(); hs.walk(surface, 12); hs.wait(400);
  assert.equal(hs.kinds().filter((k) => k === 'hole').length, 0);
  // A raised level: under that level's floor counts.
  const upper = { id: 'u', x: 0, y: 0, width: 100, elevation: 20, base: 20, visible: true };
  const hu = harness({ tokens: [upper] });
  hu.feel.tick(); upper.elevation = 15; hu.feel.tick();
  assert.equal(hu.kinds().filter((k) => k === 'hole').length, 1);
  // Unseen: nothing to see (heard only).
  const hidden = { id: 'x', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: false, audible: true };
  const hh = harness({ tokens: [hidden] });
  hh.feel.tick(); hidden.elevation = -5; hh.feel.tick(); hh.walk(hidden, 12); hidden.elevation = 0; hh.feel.tick();
  assert.equal(hh.kinds().length, 0, 'no holes for an unseen burrower');
  // A renderer draws the hole.
  const drawn = [];
  const g = { beginFill() { drawn.push('fill'); return g; }, endFill() { return g; }, drawEllipse() { drawn.push('ellipse'); return g; }, drawCircle() { drawn.push('circle'); return g; },
    drawPolygon() { return g; }, lineStyle() { return g; }, moveTo() { return g; }, lineTo() { return g; }, position: { set() {} }, scale: { set() {} } };
  const layer = createMovementFeelLayer({ PIXI: { Graphics: function () { return g; } }, root: () => ({ addChild() {} }) });
  layer.addParticle({ kind: 'hole', color: 0x1a120b, x: 0, y: 0, radius: 30, rim: [[0, 1, 0.3], [1, 0, 0.3], [0, -1, 0.3], [-1, 0, 0.3], [0.7, 0.7, 0.2], [-0.7, -0.7, 0.2]], rimColor: 0x5a4128 });
  assert.ok(drawn.includes('ellipse') && drawn.filter((d) => d === 'circle').length >= 6);
  assert.ok(PARTICLE_KINDS.includes('hole'));
});

test('controller: the Burrow holes setting off leaves the trail but no holes', () => {
  const tok = { id: 'm', x: 0, y: 0, width: 100, elevation: 0, base: 0, visible: true };
  const h = harness({ tokens: [tok], holes: () => false });
  h.feel.tick(); tok.elevation = -5; h.feel.tick(); h.walk(tok, 12); tok.elevation = 0; h.feel.tick();
  assert.equal(h.kinds().filter((k) => k === 'hole').length, 0);
  assert.ok(h.kinds().includes('mound'), 'the churned trail stays');
});
