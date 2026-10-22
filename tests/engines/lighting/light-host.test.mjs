import test from 'node:test';
import assert from 'node:assert/strict';
import { createLightHost, lightLevels } from '../../../scripts/engines/lighting/light-host.mjs';
import { envelope } from '../../../scripts/engines/lighting/effect-lights.mjs';

const flash = { color: '#ff8800', shape: 'flash', dim: 3, bright: 1.5, startMs: 0, lengthMs: 710, fadeMs: 300, lasting: false };
const lasting = { color: '#ff4400', shape: 'flicker', dim: 4, bright: 2, startMs: 0, lengthMs: 86400000, fadeMs: 300, lasting: true };

function effect(tag, { ready = true, x = 500, y = 600, sceneId = 's1', name = 'animater-u1-abc', moduleName = 'animater' } = {}) {
  return { data: { moduleName, name, sceneId, ...(tag ? { animaterLight: tag } : {}) }, ready, worldPosition: { x, y } };
}

function make({ held = () => 0, steady = false, levelOk = () => true, max = 8 } = {}) {
  const out = { t: 0, sources: [], refreshes: 0, steady };
  const host = createLightHost({
    makeSource: (id) => {
      const s = { id, inits: [], added: 0, levels: [], destroyed: 0 };
      s.initialize = (data) => s.inits.push(data);
      s.add = () => { s.added++; };
      s.setLevel = (levels) => s.levels.push(levels);
      s.destroy = () => { s.destroyed++; };
      out.sources.push(s);
      return s;
    },
    refreshLighting: () => { out.refreshes++; },
    sceneId: () => 's1',
    levelOk,
    heldMs: held,
    steady: () => out.steady,
    gridSize: () => 100,
    now: () => out.t,
    max,
  });
  return { host, out };
}

const lastLevel = (s) => s.levels.at(-1) ?? { alpha: s.inits[0].alpha, luminosity: s.inits[0].luminosity };

test('creates one light per tagged effect when ready', () => {
  const { host, out } = make();
  const e = effect(flash, { ready: false });
  host.onEffect(e);
  host.onEffect(e);
  out.t = 20;
  host.tick();
  assert.equal(out.sources.length, 0, 'waits for the effect to be ready');
  e.ready = true;
  out.t = 40;
  host.tick();
  assert.equal(out.sources.length, 1);
  const [s] = out.sources;
  assert.equal(s.added, 1);
  const data = s.inits[0];
  assert.equal(data.x, 500);
  assert.equal(data.y, 600);
  assert.equal(data.dim, 300);
  assert.equal(data.bright, 150);
  assert.equal(data.color, '#ff8800');
  assert.equal(data.coloration, 1);
  assert.equal(data.attenuation, 0.5);
  assert.equal(data.vision, false);
  assert.equal(data.walls, true);
  assert.equal(data.priority, 0);
  assert.deepEqual({ alpha: data.alpha, luminosity: data.luminosity }, lightLevels(envelope(flash, 40), 'flash'));
  assert.equal(out.refreshes, 1);
  assert.equal(host.count(), 1);
  // A still anchor is not re-initialised and nothing is refreshed again.
  out.t = 76;
  host.tick();
  out.t = 92;
  host.tick();
  assert.equal(s.inits.length, 1);
  assert.equal(out.refreshes, 1);
  assert.ok(s.levels.length > 0, 'brightness follows the envelope');
});

test('the light follows a moving anchor once it moved a quarter square', () => {
  const { host, out } = make();
  const e = effect(lasting);
  host.onEffect(e);
  host.tick();
  const [s] = out.sources;
  e.worldPosition = { x: 510, y: 600 };
  out.t = 16; host.tick(); out.t = 32; host.tick();
  assert.equal(s.inits.length, 1, 'a small move is ignored');
  e.worldPosition = { x: 540, y: 600 };
  out.t = 48; host.tick(); out.t = 64; host.tick();
  assert.equal(s.inits.length, 2);
  assert.deepEqual(s.inits[1], { x: 540, y: 600 });
});

test('travel light slides from origin to target', () => {
  const { host, out } = make();
  const glow = { color: '#ffffff', shape: 'glow', dim: 1, bright: 0.5, startMs: 0, lengthMs: 400, fadeMs: 300, lasting: false, arriveMs: 400, from: { x: 0, y: 0 }, to: { x: 1000, y: 0 } };
  host.onEffect(effect(glow, { x: 0, y: 0 }));
  host.tick();
  const [s] = out.sources;
  assert.equal(s.inits[0].x, 0);
  for (let t = 16; t <= 600; t += 16) { out.t = t; host.tick(); }
  const xs = s.inits.map((d) => d.x);
  assert.ok(xs.length > 5, 'moves along the way');
  assert.ok(xs.every((x, i) => i === 0 || x >= xs[i - 1]), 'only forward');
  assert.equal(xs.at(-1), 1000, 'stops on the target');
  assert.ok(xs.every((x, i) => i === 0 || x - xs[i - 1] >= 25), 'only after a quarter square');
});

test('anchor end fades then removes', () => {
  const { host, out } = make();
  const e = effect(lasting);
  host.onEffect(e);
  host.tick();
  const [s] = out.sources;
  out.t = 1000; host.tick();
  assert.equal(lastLevel(s).alpha, lightLevels(1, 'flicker').alpha);
  host.onEnded(e);
  out.t = 1150; host.tick();
  assert.ok(Math.abs(lastLevel(s).alpha - lightLevels(0.5, 'flicker').alpha) < 1e-9, 'half way through the fade');
  assert.equal(s.destroyed, 0);
  const refreshes = out.refreshes;
  out.t = 1300; host.tick();
  assert.equal(s.destroyed, 1);
  assert.equal(host.count(), 0);
  assert.equal(out.refreshes, refreshes + 1);
});

test('the last light ended outside a tick still gets its refresh on the next tick', () => {
  const { host, out } = make();
  const e = effect(lasting);
  host.onEffect(e);
  // Shown late, so it starts at level 0 and onEnded removes it at once.
  out.t = 200;
  host.tick();
  assert.equal(out.sources.length, 1);
  const before = out.refreshes;
  host.onEnded(e);
  assert.equal(host.count(), 0);
  assert.equal(out.sources[0].destroyed, 1);
  host.tick();
  assert.equal(out.refreshes, before + 1);
  host.tick();
  assert.equal(out.refreshes, before + 1, 'flushed once only');
});

test('a one-shot light is removed when its envelope is over', () => {
  const { host, out } = make();
  host.onEffect(effect(flash));
  host.tick();
  out.t = flash.lengthMs + flash.fadeMs;
  host.tick();
  assert.equal(out.sources[0].destroyed, 1);
  assert.equal(host.count(), 0);
});

test('an anchor that ends before it is ready leaves no light', () => {
  const { host, out } = make();
  const e = effect(flash, { ready: false });
  host.onEffect(e);
  host.onEnded(e);
  e.ready = true;
  host.tick();
  assert.equal(out.sources.length, 0);
  assert.equal(host.count(), 0);
});

test('cap keeps 8 and lets lasting lights in', () => {
  const { host, out } = make();
  const shots = Array.from({ length: 9 }, (_, i) => effect(flash, { name: `animater-u1-${i}` }));
  for (const e of shots) host.onEffect(e);
  assert.equal(host.count(), 8, 'the newest one-shot is skipped');
  host.tick();
  assert.equal(out.sources.length, 8);
  host.onEffect(effect(lasting, { name: 'animater-u1-wall' }));
  out.t = 16;
  host.tick();
  assert.equal(out.sources.length, 9, 'the lasting light gets in');
  assert.ok(out.sources[8].inits[0].animation.type === 'torch');
  // The oldest one-shot makes room by fading out.
  out.t = 16 + 300;
  host.tick();
  assert.equal(out.sources[0].destroyed, 1);
  assert.equal(out.sources.slice(1).filter((s) => s.destroyed).length, 0);
});

test('held session freezes the envelope', () => {
  // Held from 100 to 400 ms.
  const held = (session, since) => (session === 'animater-u1-abc' ? Math.max(0, Math.min(400, out.t) - Math.max(100, since)) : 0);
  const { host, out } = make({ held });
  host.onEffect(effect(flash));
  host.tick();
  const [s] = out.sources;
  out.t = 100; host.tick();
  const frozen = lastLevel(s).alpha;
  out.t = 250; host.tick();
  assert.equal(lastLevel(s).alpha, frozen);
  out.t = 399; host.tick();
  assert.ok(Math.abs(lastLevel(s).alpha - frozen) < 0.01);
  out.t = 700; host.tick();
  assert.deepEqual(lastLevel(s), lightLevels(envelope(flash, 400), 'flash'));
  assert.equal(s.destroyed, 0, 'still alive after its wall-clock end');
});

test('steady client gets no animation type', () => {
  const steady = make({ steady: true });
  steady.host.onEffect(effect(lasting));
  steady.host.tick();
  assert.deepEqual(steady.out.sources[0].inits[0].animation, {});

  const lively = make();
  lively.host.onEffect(effect(lasting));
  lively.host.onEffect(effect({ ...lasting, shape: 'pulse' }, { name: 'animater-u1-2' }));
  lively.host.onEffect(effect(flash, { name: 'animater-u1-3' }));
  lively.host.tick();
  assert.deepEqual(lively.out.sources.map((s) => s.inits[0].animation.type), ['torch', 'pulse', null]);
});

test('a steady client sees a strobe as one flash', () => {
  const strobe = { ...flash, shape: 'strobe', lengthMs: 700 };
  const { host, out } = make({ steady: true });
  host.onEffect(effect(strobe));
  host.tick();
  out.t = 150; host.tick();
  assert.deepEqual(lastLevel(out.sources[0]), lightLevels(envelope(strobe, 150, { steady: true }), 'strobe'));
});

test('unknown level or other scene is skipped', () => {
  const lost = make({ levelOk: () => false });
  lost.host.onEffect(effect(flash));
  lost.host.tick();
  assert.equal(lost.host.count(), 0);
  assert.equal(lost.out.sources.length, 0);

  const away = make();
  away.host.onEffect(effect(flash, { sceneId: 's2' }));
  away.host.tick();
  assert.equal(away.host.count(), 0);
  assert.equal(away.out.sources.length, 0);
});

test('a source that cannot initialise is dropped', (t) => {
  const warned = t.mock.method(console, 'warn', () => {});
  const { host, out } = make();
  host.onEffect(effect(flash));
  const make0 = out.sources.push.bind(out.sources);
  out.sources.push = (s) => { s.initialize = () => { throw new Error('Level [x] does not exist.'); }; return make0(s); };
  host.tick();
  assert.equal(out.sources[0].destroyed, 1);
  assert.equal(host.count(), 0);
  assert.equal(warned.mock.callCount(), 1);
});

test('a light that throws is dropped and tick never throws', (t) => {
  const warned = t.mock.method(console, 'warn', () => {});
  let throwing = true;
  const out = { sources: 0 };
  const host = createLightHost({
    makeSource: () => { if (throwing) throw new Error('no canvas'); out.sources++; return { initialize() {}, add() {}, setLevel() {}, destroy() {} }; },
    refreshLighting: () => {}, sceneId: () => 's1', levelOk: () => true, now: () => 0,
  });
  host.onEffect(effect(flash));
  host.onEffect(effect(flash, { name: 'animater-u1-2' }));
  assert.doesNotThrow(() => host.tick());
  assert.equal(host.count(), 0);
  assert.ok(warned.mock.callCount() >= 2);

  // A broken clock or envelope input drops only that light.
  throwing = false;
  const bad = effect(flash, { name: 'animater-u1-3' });
  host.onEffect(bad);
  host.onEffect(effect(flash, { name: 'animater-u1-4' }));
  Object.defineProperty(bad, 'ready', { get() { throw new Error('gone'); } });
  assert.doesNotThrow(() => host.tick());
  assert.equal(host.count(), 1);
  assert.equal(out.sources, 1);
});

test('malformed tags are ignored', () => {
  const { host, out } = make();
  host.onEffect(effect({ ...flash, startMs: undefined }));
  host.onEffect(effect({ ...flash, lengthMs: NaN }, { name: 'animater-u1-2' }));
  host.onEffect(effect({ ...flash, dim: '3' }, { name: 'animater-u1-3' }));
  host.onEffect(effect({ ...flash, bright: Infinity }, { name: 'animater-u1-4' }));
  host.onEffect(effect({ ...flash, fadeMs: 'x' }, { name: 'animater-u1-5' }));
  host.tick();
  assert.equal(host.count(), 0);
  assert.equal(out.sources.length, 0);
  host.onEffect(effect({ ...flash, fadeMs: undefined }, { name: 'animater-u1-6' }));
  assert.equal(host.count(), 1, 'no fade is allowed');
});

test('a light shown late ramps in instead of popping on', () => {
  const { host, out } = make();
  const e = effect(lasting, { ready: false });
  host.onEffect(e);
  out.t = 400; host.tick();
  e.ready = true;
  out.t = 500; host.tick();
  const [s] = out.sources;
  assert.equal(s.inits[0].alpha, 0);
  assert.equal(s.inits[0].luminosity, 0);
  out.t = 550; host.tick();
  assert.ok(Math.abs(lastLevel(s).alpha - lightLevels(0.5, 'flicker').alpha) < 1e-9, 'half way after 50 ms');
  out.t = 600; host.tick();
  assert.deepEqual(lastLevel(s), lightLevels(1, 'flicker'));
});

test('a light shown on time does not ramp', () => {
  const { host, out } = make();
  host.onEffect(effect(lasting));
  out.t = 16; host.tick();
  assert.deepEqual(lastLevel(out.sources[0]), lightLevels(1, 'flicker'));
});

test('a lasting light gets in when all 8 live lights are lasting', () => {
  const { host, out } = make();
  for (let i = 0; i < 8; i++) host.onEffect(effect(lasting, { name: `animater-u1-${i}` }));
  host.tick();
  host.onEffect(effect(lasting, { name: 'animater-u1-9' }));
  host.onEffect(effect(flash, { name: 'animater-u1-10' }));
  out.t = 16; host.tick();
  assert.equal(host.count(), 9, 'the lasting one in, the one-shot skipped');
  assert.equal(out.sources.length, 9);
  assert.equal(out.sources.filter((s) => s.destroyed).length, 0, 'no lasting light is pushed out');
});

test('clear destroys every light', () => {
  const { host, out } = make();
  host.onEffect(effect(flash));
  host.onEffect(effect(lasting, { name: 'animater-u1-2' }));
  host.onEffect(effect(flash, { name: 'animater-u1-3', ready: false }));
  host.tick();
  host.clear();
  assert.deepEqual(out.sources.map((s) => s.destroyed), [1, 1]);
  assert.equal(host.count(), 0);
  out.t = 50;
  host.tick();
  assert.equal(out.sources.length, 2, 'nothing comes back');
});

test('untagged and foreign effects ignored', () => {
  const { host, out } = make();
  host.onEffect(effect(null));
  host.onEffect(effect(flash, { moduleName: 'jb2a' }));
  host.onEffect(null);
  host.onEffect({});
  host.onEnded(effect(flash));
  host.tick();
  assert.equal(host.count(), 0);
  assert.equal(out.sources.length, 0);
  assert.equal(out.refreshes, 0);
});

test('a still light sits at its tagged place, not on its anchor', () => {
  const { host, out } = make();
  // A stretched cone's anchor reports its start (the caster); the tag says where its middle is.
  const e = effect({ ...flash, at: { x: 900, y: 300 } }, { x: 100, y: 100 });
  host.onEffect(e);
  host.tick();
  const [s] = out.sources;
  assert.equal(s.inits[0].x, 900);
  assert.equal(s.inits[0].y, 300);
  e.worldPosition = { x: 400, y: 100 };
  out.t = 16; host.tick(); out.t = 32; host.tick();
  assert.equal(s.inits.length, 1, 'never moves');
});

test('a light that follows rides on its anchor even with a place', () => {
  const { host, out } = make();
  const e = effect({ ...lasting, follow: true, at: { x: 900, y: 300 } }, { x: 100, y: 100 });
  host.onEffect(e);
  host.tick();
  const [s] = out.sources;
  assert.equal(s.inits[0].x, 100);
  e.worldPosition = { x: 200, y: 100 };
  out.t = 16; host.tick(); out.t = 32; host.tick();
  assert.deepEqual(s.inits.at(-1), { x: 200, y: 100 });
});

test('the source level and elevation from the tag place the light', () => {
  const asked = [];
  const { host, out } = make({ levelOk: (level) => { asked.push(level); return level !== 'gone'; } });
  host.onEffect(effect({ ...flash, level: 'lvl2', elevation: 10 }));
  host.tick();
  assert.deepEqual(asked, ['lvl2']);
  assert.equal(out.sources[0].inits[0].level, 'lvl2');
  assert.equal(out.sources[0].inits[0].elevation, 10);
  // A level this canvas does not have: no light.
  host.onEffect(effect({ ...flash, level: 'gone' }));
  assert.equal(host.count(), 1);
  // No level in the tag: Foundry's canvas level (none passed), no elevation.
  const bare = make();
  bare.host.onEffect(effect(flash));
  bare.host.tick();
  assert.equal('level' in bare.out.sources[0].inits[0], false);
  assert.equal('elevation' in bare.out.sources[0].inits[0], false);
});

test('a slowed flash keeps its light twice as long', () => {
  const { host, out } = make();
  host.onEffect(effect({ ...flash, lengthMs: 1420, rate: 0.5 }));
  host.tick();
  out.t = 1000; host.tick();
  assert.equal(host.count(), 1);
  assert.equal(lastLevel(out.sources[0]).alpha, lightLevels(envelope({ ...flash, lengthMs: 1420, rate: 0.5 }, 1000), 'flash').alpha);
  out.t = 1800; host.tick();
  assert.equal(host.count(), 0);
});
