// Small life in a settlement: pigeons bobbing on the open ground that go up together and wheel over the roofs, chickens that
// scratch and panic, a cat on a wall washing itself, a dog about its rounds. The GM turns it on per scene, so this only draws what
// it is given. Drawn once, seen from above, then only moved, turned and swapped; every gait runs by the ground covered, so no foot
// slides. A few dozen small shapes on the CPU at most, and nothing drawn where nobody looks. Every screen has its own: nothing here
// is saved or shared. Also here: when each lit window goes dark of an evening.

import { noiseReaching, shadowKeeper, wayOut, NOISE_SPEED } from './wildlife.mjs';
import { turnToward, clearWay } from './field-life.mjs';

const TAU = Math.PI * 2;
const between = (random, a, b) => a + random() * (b - a);
const pickOf = (list, random) => list[Math.floor(random() * list.length)];
const offBy = (a, b) => Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI);
// The rain at which pigeons give up and sit it out.
const HEAVY_RAIN = 0.6;

// ---- When the windows go dark -------------------------------------------------------------------------------------------
// A number from 0 to 1 that a seed always gives (pure): mixed hard, so seeds next to each other land far apart.
function seedFraction(seed, salt) {
  let h = 2166136261 ^ salt;
  for (const c of String(seed)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Whether the window with this seed has gone dark at `hour` game time, 0-24 (pure): each has its own time between 21:00 and 01:00 to
// go out, and its own time round 05:30 to be lit again. The same seed always gives the same times.
export function lightsOutAt(seed, hour) {
  if (!Number.isFinite(hour)) return false;
  const h = ((hour % 24) + 24) % 24, clock = h < 12 ? h + 24 : h;
  const out = 21 + seedFraction(seed, 1) * 4, lit = 24 + 5.5 + (seedFraction(seed, 2) - 0.5) * 0.5;
  return clock >= out && clock < lit;
}

// ---- How many -----------------------------------------------------------------------------------------------------------
// How many of each for a place (pure): a quiet place has about half what a busy one does, and too few open spots means fewer. A flock
// is four at least, or none; hens go in twos at least. The cat needs a wall, the dog needs a busy place and somewhere to go.
export function townCounts(level, spotCount = 0, wallCount = 0, random = Math.random) {
  const busy = level === 'busy', birds = Math.round(busy ? between(random, 7, 9) : between(random, 4, 5)), hens = Math.round(busy ? between(random, 4, 5) : between(random, 2, 3));
  const pigeons = Math.min(birds, spotCount * 2), chickens = Math.min(hens, spotCount);
  return { pigeons: pigeons >= 4 ? pigeons : 0, chickens: chickens >= 2 ? chickens : 0, cat: wallCount > 0 ? 1 : 0, dog: busy && spotCount >= 2 ? 1 : 0 };
}

// How many flocks, and how many broods of hens, a map this size has (pure): `spotCount` its open places. One on a small map, a few on a big one.
export function townGroups(level, spotCount = 0) {
  if (spotCount <= 0) return 0;
  return level === 'busy' ? Math.min(4, Math.ceil(spotCount / 300)) : Math.min(2, Math.ceil(spotCount / 600));
}
// Where those groups live (pure): the first near `focus` (the view when the scene opened, within six squares if it can be), the rest wherever on the map.
export function homesFor(spots = [], count = 1, focus = null, { grid = 100, random = Math.random } = {}) {
  if (!spots.length || count <= 0) return [];
  const homes = Array.from({ length: count }, () => pickOf(spots, random));
  if (focus) {
    const close = spots.filter((p) => Math.hypot(p.x - focus.x, p.y - focus.y) <= grid * 6);
    homes[0] = close.length ? pickOf(close, random) : spots.reduce((best, p) => (Math.hypot(p.x - focus.x, p.y - focus.y) < Math.hypot(best.x - focus.x, best.y - focus.y) ? p : best));
  }
  return homes;
}

// ---- What they do -------------------------------------------------------------------------------------------------------
// What puts a pigeon up (pure): a noise reaching it or anyone within 2 squares. That, or null.
export function pigeonAlarm(bird, { grid = 100, near = [], noise = null } = {}) {
  return noise ?? near.find((t) => Math.hypot(t.x - bird.x, t.y - bird.y) < grid * 2) ?? null;
}

// Where a flock comes down after a fright (pure): an open spot a few squares from `from` with nobody close, or failing that any such
// spot, or null while there is none.
export function landingSpot(spots, from, { grid = 100, near = [], ok = () => true, random = Math.random } = {}) {
  const free = spots.filter((s) => ok(s.x, s.y) && !near.some((t) => Math.hypot(t.x - s.x, t.y - s.y) < grid * 3));
  const close = free.filter((s) => { const d = Math.hypot(s.x - from.x, s.y - from.y); return d > grid * 3 && d < grid * 9; });
  const list = close.length ? close : free;
  return list.length ? pickOf(list, random) : null;
}

// One step of a pigeon (pure): on the ground (`mode` 'ground') it walks with its head nodding (`gait` by the ground covered) and pecks
// (`peck`, seconds of it); in heavy rain it sits tucked and still (`tucked`). Anything that alarms it, or a flock-mate going up
// (`flush`, what scared that one), sends it off (`mode` 'fly', `h` 0-1 its height): it climbs, wheels overhead the way `wheel` says,
// then glides down on `landing`. Nowhere to land (`wantLand`), or someone there, and it keeps wheeling till there is. Low down walls
// stop it; up high it clears them. It will not fly into a closed place (`barred`). It faces `a` (0 up the map, clockwise).
export function pigeonStep(pigeon, { dt = 1 / 60, grid = 100, near = [], ok = () => true, blocked = () => false, barred = () => false, rain = 0, flush = null, noise = null, landing = null, wheel = null, random = Math.random } = {}) {
  const p = { ...pigeon };
  const aimAt = (at) => { if (at) { p.lx = at.x + between(random, -0.55, 0.55) * grid; p.ly = at.y + between(random, -0.55, 0.55) * grid; p.wantLand = false; } else p.wantLand = true; };
  if (p.mode !== 'fly') {
    const threat = pigeonAlarm(p, { grid, near, noise }) ?? flush;
    p.wait -= dt;
    const lost = p.wait <= 0 && !ok(p.x, p.y);
    if (threat || lost) {
      const away = threat ? Math.atan2(p.y - threat.y, p.x - threat.x) + between(random, -0.35, 0.35) : random() * TAU;
      p.mode = 'fly'; p.stage = 'wheel'; p.t = 0; p.h = 0; p.a = away + Math.PI / 2; p.tucked = false; p.peck = 0; p.len = between(random, 4.5, 7);
      p.turn = wheel ?? (random() < 0.5 ? -1 : 1) * between(random, 0.9, 1.3); aimAt(landing);
      return p;
    }
    if (rain >= HEAVY_RAIN) { p.tucked = true; p.peck = 0; p.walk = 0; return p; }
    p.tucked = false; p.peck = Math.max(0, p.peck - dt); p.walk = Math.max(0, (p.walk ?? 0) - dt);
    if (p.wait <= 0) {
      p.wait = between(random, 0.4, 1.6);
      const r = random();
      if (r < 0.45) p.peck = 0.22;
      else if (r < 0.85) { p.a += between(random, -1.2, 1.2); p.walk = between(random, 0.5, 1.6); }
    }
    if (p.walk > 0 && !p.peck) {
      const speed = grid * 0.28 * dt, nx = p.x + Math.sin(p.a) * speed, ny = p.y - Math.cos(p.a) * speed, aheadX = nx + Math.sin(p.a) * grid * 0.1, aheadY = ny - Math.cos(p.a) * grid * 0.1;
      if (ok(aheadX, aheadY) && !blocked({ x: p.x, y: p.y }, { x: aheadX, y: aheadY })) { p.x = nx; p.y = ny; p.gait = (p.gait ?? 0) + speed / (grid * 0.14); } else { p.a += between(random, 2, 4.2); p.walk = 0; }
    }
    return p;
  }
  p.t += dt;
  if (p.wantLand && landing) aimAt(landing);
  const shut = (nx, ny) => (p.h < 0.45 && blocked({ x: p.x, y: p.y }, { x: nx, y: ny })) || (barred(nx, ny) && !barred(p.x, p.y));
  const again = () => { p.stage = 'wheel'; p.h = Math.max(p.h, 0.5); p.t = 1.2; p.len = between(random, 2, 3.5); p.wantLand = true; };
  if (p.stage === 'glide') {
    p.glide += dt / p.glideFor;
    const u = Math.min(1, p.glide), e = u * u * (3 - 2 * u), nx = p.gx + (p.lx - p.gx) * e, ny = p.gy + (p.ly - p.gy) * e, h = 1 - e;
    if (shut(nx, ny)) { again(); return p; }
    p.a = turnToward(p.a, Math.atan2(p.lx - p.gx, -(p.ly - p.gy)), dt * 6); p.x = nx; p.y = ny; p.h = h;
    if (u >= 1) {
      if (ok(p.x, p.y) && !pigeonAlarm(p, { grid, near })) { p.mode = 'ground'; p.h = 0; p.wait = between(random, 0.8, 2.2); p.peck = 0; p.walk = 0; p.stage = null; p.lx = p.ly = undefined; }
      else again();
    }
    return p;
  }
  const climb = Math.min(1, p.t / 1.2), speed = grid * (1.6 + climb * 2.2);
  p.h = Math.max(p.h, climb);
  if (p.t > 1.2) p.a += p.turn * dt;
  const nx = p.x + Math.sin(p.a) * speed * dt, ny = p.y - Math.cos(p.a) * speed * dt;
  if (shut(nx, ny)) p.a += between(random, 2, 4.2); else { p.x = nx; p.y = ny; }
  if (p.t >= p.len && !p.wantLand && p.lx !== undefined) { p.stage = 'glide'; p.glide = 0; p.gx = p.x; p.gy = p.y; p.glideFor = Math.max(1.4, Math.hypot(p.lx - p.x, p.ly - p.y) / (grid * 3.2)); }
  return p;
}

// One step of a chicken (pure): stands pecking ('peck', `peck` seconds of it), scratches ('scratch'), walks about ('walk'), and now and
// then sprints off at nothing ('sprint'). Anyone within 2 squares or a noise sends it into a panic ('panic'): it runs away on a zigzag
// (`zig` the side it is on) and never takes to the air. Keeps to `ok`; a wall (`blocked`) stops it. `gait` by the ground covered.
export function chickenStep(hen, { dt = 1 / 60, grid = 100, near = [], ok = () => true, blocked = () => false, noise = null, random = Math.random } = {}) {
  const c = { ...hen }, free = (nx, ny) => !blocked({ x: c.x, y: c.y }, { x: nx, y: ny }) && (ok(nx, ny) || !ok(c.x, c.y));
  const within = (r) => near.find((t) => Math.hypot(t.x - c.x, t.y - c.y) < grid * r);
  const go = (speed, stride) => { const step = speed * dt, nx = c.x + Math.sin(c.a) * step, ny = c.y - Math.cos(c.a) * step; if (!free(nx + Math.sin(c.a) * grid * 0.12, ny - Math.cos(c.a) * grid * 0.12)) return false; c.x = nx; c.y = ny; c.gait = (c.gait ?? 0) + step / (grid * stride); return true; };
  const rest = () => { c.mode = 'peck'; c.wait = between(random, 0.8, 2.6); c.peck = 0; c.nod = 0; };
  const close = noise ?? within(2);
  if (close && c.mode !== 'panic') { c.mode = 'panic'; c.t = 0; c.way = Math.atan2(c.y - close.y, c.x - close.x); c.zig = random() < 0.5 ? 1 : -1; c.zigIn = between(random, 0.16, 0.34); c.peck = 0; }
  if (c.mode === 'panic') {
    c.t += dt; c.zigIn -= dt;
    if (c.zigIn <= 0) { c.zig = -c.zig; c.zigIn = between(random, 0.16, 0.34); }
    const still = within(3.2);
    if (still) c.way = Math.atan2(c.y - still.y, c.x - still.x);
    if (!free(c.x + Math.cos(c.way) * grid * 0.5, c.y + Math.sin(c.way) * grid * 0.5)) { const w = clearWay(c.x, c.y, c.way, grid * 0.6, free); if (w !== null) c.way = w; }
    c.a = turnToward(c.a, c.way + c.zig * 0.75 + Math.PI / 2, dt * 14); go(grid * 2.6, 0.3);
    if (c.t > 1.4 && !still) rest();
    return c;
  }
  if (c.mode === 'sprint') {
    c.t += dt; c.a = turnToward(c.a, c.want, dt * 10);
    if (!go(grid * 1.9, 0.3) || c.t > c.len) rest();
    return c;
  }
  c.wait -= dt; c.peck = Math.max(0, c.peck - dt);
  if (c.wait <= 0) {
    c.wait = between(random, 1, 3.5);
    const out = ok(c.x, c.y) ? null : wayOut(c, grid, ok), r = random();
    // On the wrong ground (something drawn under it): off it first.
    if (out !== null) { c.mode = 'walk'; c.want = out; }
    else if (r < 0.35) { c.mode = 'peck'; c.nod = 0; }
    else if (r < 0.62) c.mode = 'scratch';
    else if (r < 0.9) { c.mode = 'walk'; c.want = c.a + between(random, -1.4, 1.4); }
    else { c.mode = 'sprint'; c.t = 0; c.len = between(random, 0.45, 1.1); c.want = c.a + between(random, -2, 2); }
  }
  if (c.mode === 'peck') { c.nod = (c.nod ?? 0) - dt; if (c.nod <= 0) { c.nod = between(random, 0.3, 0.9); c.peck = 0.16; } }
  else if (c.mode === 'walk') { c.a = turnToward(c.a, c.want, dt * 4); if (!go(grid * 0.32, 0.2)) { c.want = c.a + between(random, 1.6, 3.2); } }
  return c;
}

// The wall top a cat goes on to from the end it has reached (pure): one starting within a stride of it. { seg, u, dir }, or null.
function onward(walls, seg, atEnd, grid) {
  const x = atEnd ? seg.bx : seg.ax, y = atEnd ? seg.by : seg.ay, reach = grid * 0.25;
  for (const w of walls) {
    if (w === seg || (w.ax === seg.ax && w.ay === seg.ay && w.bx === seg.bx && w.by === seg.by)) continue;
    if (Math.hypot(w.ax - x, w.ay - y) < reach) return { seg: w, u: 0, dir: 1 };
    if (Math.hypot(w.bx - x, w.by - y) < reach) return { seg: w, u: 1, dir: -1 };
  }
  return null;
}

// One step of a cat (pure): it keeps to a wall top (`seg` { ax, ay, bx, by }, `u` 0-1 along it, `dir` the way it goes), walks along it
// and on to the next that joins, sits a long time ('sit') and washes through much of it (`wash`, seconds of it). Anyone within 1.5
// squares or a noise and it slinks away along the wall ('slink'); cornered, it drops off the wall ('away', `show` fading) and comes
// back to another stretch once there is a quiet one. A cat out at night sits less. `gait` by the ground covered.
export function catStep(cat, { dt = 1 / 60, grid = 100, near = [], walls = [], noise = null, night = 0, random = Math.random } = {}) {
  const o = { ...cat }, within = (r) => near.find((t) => Math.hypot(t.x - o.x, t.y - o.y) < grid * r);
  const sit = () => { o.mode = 'sit'; o.left = between(random, 25, 70) * (1 - Math.max(0, Math.min(1, night)) * 0.5); o.wash = 0; o.washIn = between(random, 2, 6); };
  const place = () => { const s = o.seg; o.x = s.ax + (s.bx - s.ax) * o.u; o.y = s.ay + (s.by - s.ay) * o.u; };
  const heading = () => Math.atan2((o.seg.bx - o.seg.ax) * o.dir, -(o.seg.by - o.seg.ay) * o.dir);
  const awayFrom = (t) => ((o.x - t.x) * (o.seg.bx - o.seg.ax) + (o.y - t.y) * (o.seg.by - o.seg.ay) >= 0 ? 1 : -1);
  const leave = () => { o.mode = 'away'; o.t = 0; o.back = between(random, 30, 70); };
  // Along the wall, turning round first where it has to. false: it has come to the end and there is no more wall.
  const along = (speed, stride) => {
    const want = heading(); o.a = turnToward(o.a, want, dt * 7);
    if (offBy(o.a, want) > 0.35) return true;
    const s = o.seg, len = Math.hypot(s.bx - s.ax, s.by - s.ay) || 1, u = Math.max(0, Math.min(1, o.u + (o.dir * speed * dt) / len));
    o.gait = (o.gait ?? 0) + (Math.abs(u - o.u) * len) / (grid * stride); o.u = u; place();
    if ((u > 0 && u < 1) || (u === 0 && o.dir > 0) || (u === 1 && o.dir < 0)) return true;
    const next = onward(walls, s, u === 1, grid);
    if (!next) return false;
    o.seg = next.seg; o.u = next.u; o.dir = next.dir; place();
    return true;
  };
  if (o.mode === 'away') {
    o.t += dt; o.show = Math.max(0, (o.show ?? 1) - dt * 2.5);
    if (o.t >= o.back) {
      const quiet = walls.filter((w) => !near.some((t) => Math.hypot(t.x - (w.ax + w.bx) / 2, t.y - (w.ay + w.by) / 2) < grid * 3));
      if (quiet.length) { o.seg = pickOf(quiet, random); o.u = between(random, 0.1, 0.9); o.dir = random() < 0.5 ? 1 : -1; place(); o.a = heading(); sit(); } else o.t = o.back - 5;
    }
    return o;
  }
  o.show = Math.min(1, (o.show ?? 1) + dt * 2.5);
  const scared = noise ?? within(1.5);
  if (scared && o.mode !== 'slink') { o.mode = 'slink'; o.t = 0; o.wash = 0; o.dir = awayFrom(scared); }
  if (o.mode === 'slink') {
    o.t += dt;
    if (scared) o.dir = awayFrom(scared);
    if (!along(grid * 0.95, 0.5) || o.t > 8) { if (within(3)) leave(); else sit(); } else if (o.t > 1.2 && !within(3)) sit();
    return o;
  }
  if (o.mode === 'sit') {
    o.left -= dt;
    if (o.wash > 0) { o.wash -= dt; if (o.wash <= 0) o.washIn = between(random, 3, 9); }
    else { o.washIn -= dt; if (o.washIn <= 0) o.wash = between(random, 6, 16); }
    if (o.left <= 0) { o.mode = 'walk'; o.wash = 0; o.walkFor = between(random, 4, 10); if (random() < 0.5) o.dir = -o.dir; }
    return o;
  }
  o.walkFor -= dt;
  if (!along(grid * 0.38, 0.42)) o.dir = -o.dir;
  if (o.walkFor <= 0) sit();
  return o;
}

// Where a dog goes next (pure): a spot some way off with no wall in the way if it can, any other spot if not, null if there is none.
function nextSpot(o, spots, grid, blocked, random) {
  const apart = spots.filter((s) => Math.hypot(s.x - o.x, s.y - o.y) > grid * 2);
  const clear = apart.filter((s) => Math.hypot(s.x - o.x, s.y - o.y) < grid * 14 && !blocked({ x: o.x, y: o.y }, s));
  const list = clear.length ? clear : apart;
  return list.length ? pickOf(list, random) : null;
}

// One step of a dog (pure): trots from spot to spot ('trot', to `tx`, `ty`) and noses about the ground when it gets there ('nose'). A
// creature going by within 4.5 squares it follows a little way ('follow'), hanging about 2 squares back, then loses interest (`bored`,
// seconds before it will follow again). One standing still it leaves alone. A noise stops it to look ('look'). It barks now and then
// (`barked` true on the step it starts, `bark` seconds of it). `gait` by the ground covered.
export function dogStep(dog, { dt = 1 / 60, grid = 100, near = [], spots = [], ok = () => true, blocked = () => false, noise = null, random = Math.random } = {}) {
  const o = { ...dog }, free = (nx, ny) => !blocked({ x: o.x, y: o.y }, { x: nx, y: ny }) && (ok(nx, ny) || !ok(o.x, o.y));
  const go = (speed, stride) => { const step = speed * dt, nx = o.x + Math.sin(o.a) * step, ny = o.y - Math.cos(o.a) * step; if (!free(nx + Math.sin(o.a) * grid * 0.3, ny - Math.cos(o.a) * grid * 0.3)) return false; o.x = nx; o.y = ny; o.gait = (o.gait ?? 0) + step / (grid * stride); return true; };
  const ease = (to, rate = 3) => { o.v = (o.v ?? 0) + (to - (o.v ?? 0)) * Math.min(1, dt * rate); return o.v; };
  const bark = () => { o.barked = true; o.bark = 0.45; };
  const setOff = () => { const s = nextSpot(o, spots, grid, blocked, random); o.stuck = 0; if (s) { o.mode = 'trot'; o.tx = s.x; o.ty = s.y; } else { o.mode = 'nose'; o.t = between(random, 2, 5); o.want = o.a; } };
  o.barked = false; o.bark = Math.max(0, (o.bark ?? 0) - dt); o.bored = Math.max(0, (o.bored ?? 0) - dt);
  const who = near.reduce((best, t) => (!best || Math.hypot(t.x - o.x, t.y - o.y) < Math.hypot(best.x - o.x, best.y - o.y) ? t : best), null);
  const moved = who && o.wasX !== undefined ? Math.hypot(who.x - o.wasX, who.y - o.wasY) : 0, passing = moved > 0.25 && moved < grid;
  o.wasX = who?.x; o.wasY = who?.y;
  const gap = who ? Math.hypot(who.x - o.x, who.y - o.y) : Infinity;
  if (noise && o.mode !== 'look') { o.mode = 'look'; o.t = 1.4; o.lookAt = Math.atan2(noise.x - o.x, -(noise.y - o.y)); bark(); }
  if (o.mode === 'look') {
    ease(0, 8); o.a = turnToward(o.a, o.lookAt, dt * 5); o.t -= dt;
    if (o.t <= 0) setOff();
    return o;
  }
  if (o.mode !== 'follow' && !o.bored && passing && gap < grid * 4.5) { o.mode = 'follow'; o.t = 0; o.len = between(random, 6, 12); o.stuck = 0; bark(); }
  if (o.mode === 'follow') {
    o.t += dt;
    if (o.t > o.len || gap > grid * 8 || o.stuck > 1.5) { o.bored = between(random, 25, 60); setOff(); return o; }
    o.a = turnToward(o.a, Math.atan2(who.x - o.x, -(who.y - o.y)), dt * 5);
    const v = ease(gap > grid * 2 ? Math.min(grid * 2.2, (gap - grid * 2) * 2.5) : 0, 12);
    if (v > 1 && !go(v, 0.7)) { o.stuck = (o.stuck ?? 0) + dt; o.v = 0; }
    if (random() < dt * 0.04) bark();
    return o;
  }
  // A bark as it goes about its round.
  if (random() < dt * 0.025) bark();
  if (o.mode === 'trot') {
    const d = Math.hypot(o.tx - o.x, o.ty - o.y);
    if (d < grid * 0.6) { o.mode = 'nose'; o.t = between(random, 2, 6); o.want = o.a; return o; }
    o.a = turnToward(o.a, Math.atan2(o.tx - o.x, -(o.ty - o.y)), dt * 4);
    if (!go(ease(grid * 1.05), 0.7)) { o.stuck = (o.stuck ?? 0) + dt; o.v = 0; if (o.stuck > 1.2) setOff(); }
    return o;
  }
  // Nosing: head down, a few slow steps at a time.
  o.t -= dt; o.next = (o.next ?? 0) - dt;
  if (o.next <= 0) { o.next = between(random, 0.5, 1.6); o.want = o.a + between(random, -1.2, 1.2); o.sniff = random() < 0.6; }
  o.a = turnToward(o.a, o.want, dt * 3);
  const v = ease(o.sniff ? grid * 0.24 : 0, 5);
  if (v > 1 && !go(v, 0.45)) o.want = o.a + between(random, 1.6, 3);
  if (o.t <= 0) setOff();
  return o;
}

// ---- How they look ------------------------------------------------------------------------------------------------------
const picture = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.translate(w / 2, h / 2); x.lineCap = 'round'; x.lineJoin = 'round'; draw(x); return c; };
const blob = (x, fill, cx, cy, rx, ry, rot = 0) => { x.fillStyle = fill; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); x.fill(); };
const line = (x, colour, width, ...points) => { x.strokeStyle = colour; x.lineWidth = width; x.beginPath(); points.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); };
const swing = (p, off) => Math.sin(TAU * (p + off));
const SPANS = [1, 0.86, 0.6, 0.34, 0.6, 0.86];
const PIGEONS = [
  { back: '#8b929c', wing: '#a4abb3', bar: '#2f3338', head: '#58616d', neck: '#4f7a6c', tail: '#4b5058' },
  { back: '#6f747c', wing: '#868b93', bar: '#2a2c30', head: '#454a53', neck: '#6d5a86', tail: '#3c4046' },
  { back: '#b9b2a6', wing: '#cfc9bd', bar: '#7a6048', head: '#a29a8e', neck: '#8f8676', tail: '#8c8579' },
];
const HENS = [
  { body: '#9a5c2a', wing: '#7c4620', tail: '#3f2a18', comb: '#b6362c' },
  { body: '#ded7c6', wing: '#c4bca9', tail: '#a59d8a', comb: '#c23a2e' },
  { body: '#4a4640', wing: '#37342f', tail: '#26241f', comb: '#a8322a' },
];
const CATS = [
  { coat: '#8a7355', dark: '#4e3f2d', pale: '#c9b89b' },
  { coat: '#2f2c2a', dark: '#191716', pale: '#57524d' },
  { coat: '#c07f3e', dark: '#8a5522', pale: '#e8c797' },
];
const DOGS = [
  { coat: '#7d5a38', dark: '#4b3522', pale: '#b89a74' },
  { coat: '#3c3733', dark: '#221f1c', pale: '#a79e92' },
  { coat: '#b49a70', dark: '#7c6748', pale: '#dccdb0' },
];

// A pigeon on the ground, facing up. reach: how far forward its neck is; peck: head right down; tucked: fluffed round, no neck to see.
function pigeonPicture(c, { reach = 0, peck = false, tucked = false }) {
  return picture(64, 64, (x) => {
    x.fillStyle = c.tail; x.beginPath(); x.moveTo(-4.5, 8); x.lineTo(-3.4, 21); x.lineTo(3.4, 21); x.lineTo(4.5, 8); x.closePath(); x.fill();
    const wide = tucked ? 10 : 8.4, body = x.createRadialGradient(-2, -1, 1, 0, 2, 13); body.addColorStop(0, c.wing); body.addColorStop(1, c.back);
    x.fillStyle = body; x.beginPath(); x.ellipse(0, 2, wide, tucked ? 11 : 12.5, 0, 0, TAU); x.fill();
    for (const s of [-1, 1]) {
      x.fillStyle = c.wing; x.beginPath(); x.moveTo(s * 3, -5); x.quadraticCurveTo(s * (wide + 0.4), 3, s * 2.4, 15); x.quadraticCurveTo(s * 1.6, 4, s * 3, -5); x.fill();
      line(x, c.bar, 1.7, [s * 2.8, 5], [s * (wide - 1.6), 3.5]); line(x, c.bar, 1.7, [s * 2.6, 9.5], [s * (wide - 2.4), 8]);
    }
    if (tucked) { blob(x, c.neck, 0, -8, 5.2, 3.8); blob(x, c.head, 0, -9.5, 3.8, 3.4); blob(x, '#c9bda8', 0, -13, 1, 1.4); return; }
    const hy = peck ? -21 : -13.5 - reach;
    line(x, c.neck, 7, [0, -7], [0, hy + 4]);
    blob(x, c.head, 0, hy, 3.6, 4); blob(x, '#e4dfd2', 0, hy - 3.6, 1, 0.8);
    x.fillStyle = '#3b3530'; x.beginPath(); x.moveTo(-1, hy - 3.6); x.lineTo(0, hy - 6.6); x.lineTo(1, hy - 3.6); x.closePath(); x.fill();
    for (const s of [-1, 1]) blob(x, '#c8642e', s * 2.5, hy - 1, 0.8, 0.8);
  });
}
// A pigeon from above in the air, wings out, span 1 flat out and 0 pulled in: pale wing, two dark bars, dark tips, fanned tail.
function pigeonFlying(c, span) {
  return picture(120, 84, (x) => {
    x.fillStyle = c.tail; x.beginPath(); x.moveTo(-3.5, 8); x.lineTo(-7.5, 24); x.lineTo(7.5, 24); x.lineTo(3.5, 8); x.closePath(); x.fill();
    for (const s of [-1, 1]) {
      const reach = 48 * (0.36 + 0.64 * span), back = 6 * (1 - span);
      x.fillStyle = c.wing; x.beginPath(); x.moveTo(s * 4, -7); x.quadraticCurveTo(s * reach * 0.55, -13 + back, s * reach, -2 + back * 2); x.quadraticCurveTo(s * reach * 0.6, 8 + back, s * 4, 6); x.closePath(); x.fill();
      line(x, c.bar, 2.2, [s * reach * 0.2, 3], [s * reach * 0.55, 3 + back]); line(x, c.bar, 2.2, [s * reach * 0.2, -1], [s * reach * 0.48, -2 + back]);
      x.fillStyle = c.bar; x.beginPath(); x.moveTo(s * reach * 0.72, -7.5 + back * 1.6); x.lineTo(s * reach, -2 + back * 2); x.lineTo(s * reach * 0.76, 5 + back * 1.4); x.closePath(); x.fill();
    }
    blob(x, c.back, 0, 1, 6.6, 12); blob(x, c.neck, 0, -9, 4.4, 4); blob(x, c.head, 0, -14, 3.2, 3.6);
    x.fillStyle = '#3b3530'; x.beginPath(); x.moveTo(-0.9, -17); x.lineTo(0, -19.6); x.lineTo(0.9, -17); x.closePath(); x.fill();
  });
}
// A hen from above, facing up: round and low, the tail in a fan, a red comb. feet: [left, right] how far forward each is; peck: head down; kick: one foot raking back.
function henPicture(c, { feet = [0, 0], peck = false, kick = 0 }) {
  return picture(72, 72, (x) => {
    for (const [s, f] of [[-1, feet[0] - (kick < 0 ? 9 : 0)], [1, feet[1] - (kick > 0 ? 9 : 0)]]) { const fy = 8 - f; line(x, '#c79a38', 1.8, [s * 5, 6], [s * 6.5, fy]); for (const t of [-1.6, 0, 1.6]) line(x, '#c79a38', 1, [s * 6.5, fy], [s * 6.5 + t, fy - 2.8]); }
    x.fillStyle = c.tail; x.beginPath(); x.moveTo(-6, 7); x.quadraticCurveTo(-8, 19, 0, 22); x.quadraticCurveTo(8, 19, 6, 7); x.closePath(); x.fill();
    const g = x.createRadialGradient(-2, -2, 1, 0, 1, 15); g.addColorStop(0, c.body); g.addColorStop(1, c.wing); x.fillStyle = g; x.beginPath(); x.ellipse(0, 2, 10.5, 13, 0, 0, TAU); x.fill();
    for (const s of [-1, 1]) { x.fillStyle = c.wing; x.beginPath(); x.moveTo(s * 4, -6); x.quadraticCurveTo(s * 11.5, 3, s * 4, 13); x.quadraticCurveTo(s * 3, 3, s * 4, -6); x.fill(); }
    const hy = peck ? -20 : -13;
    if (peck) line(x, c.body, 7, [0, -8], [0, hy + 3]);
    blob(x, c.body, 0, hy, 4.4, 5); blob(x, c.comb, 0, hy - 0.5, 1.3, 4.2);
    x.fillStyle = '#d3a640'; x.beginPath(); x.moveTo(-1.5, hy - 4); x.lineTo(0, hy - 7.6); x.lineTo(1.5, hy - 4); x.closePath(); x.fill();
  });
}
const henArt = (c) => ({
  walk: Array.from({ length: 4 }, (_, i) => henPicture(c, { feet: [swing(i / 4, 0) * 4.5, swing(i / 4, 0.5) * 4.5] })),
  peck: henPicture(c, { peck: true }), stand: henPicture(c, {}), scratch: [henPicture(c, { kick: -1 }), henPicture(c, { kick: 1 })],
});
// A cat from above, facing up, walking: narrow, its four feet by `p`, the tail up behind. low: slinking, longer and flatter, ears back.
function catGoing(c, p, low) {
  return picture(96, 120, (x) => {
    const reach = low ? 7 : 5, tail = low ? 26 : 19, wide = low ? 7.6 : 7;
    for (const [s, hip, off] of [[-1, -13, 0.25], [1, -13, 0.75], [-1, 11, 0], [1, 11, 0.5]]) line(x, c.dark, 2.4, [s * 5, hip], [s * (low ? 7.5 : 6.5), hip - swing(p, off) * reach]);
    x.strokeStyle = c.dark; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 16); x.quadraticCurveTo(swing(p, 0) * 3, 16 + tail * 0.6, swing(p, 0.2) * 5, 16 + tail); x.stroke();
    const g = x.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, c.dark); g.addColorStop(0.5, c.coat); g.addColorStop(1, c.dark); x.fillStyle = g; x.beginPath(); x.ellipse(0, 1, wide, low ? 21 : 18, 0, 0, TAU); x.fill();
    const hy = low ? -24 : -22;
    for (const s of [-1, 1]) { x.fillStyle = c.dark; x.beginPath(); x.moveTo(s * 1.6, hy - 2); x.lineTo(s * (low ? 7.6 : 5.8), hy + (low ? 1 : -6.5)); x.lineTo(s * 5.8, hy + 1); x.closePath(); x.fill(); }
    blob(x, c.coat, 0, hy, 5.4, 5.2); blob(x, c.pale, 0, hy - 3.2, 2, 1.6);
  });
}
// A cat sitting from above, facing up: round haunches with the tail curled round them. head: which way it turns; paw: lifted to wash, its head bent to it.
function catSitting(c, { head = 0, paw = false }) {
  return picture(96, 96, (x) => {
    x.strokeStyle = c.dark; x.lineWidth = 3.4; x.beginPath(); x.moveTo(5, 11); x.bezierCurveTo(16, 18, 4, 21, -10, 15); x.stroke();
    const g = x.createRadialGradient(-2, 3, 1, 0, 3, 14); g.addColorStop(0, c.coat); g.addColorStop(1, c.dark); x.fillStyle = g; x.beginPath(); x.ellipse(0, 4, 11, 12, 0, 0, TAU); x.fill();
    blob(x, c.coat, 0, -7, 7, 6.5);
    x.save(); x.translate(head, -13); x.rotate(head * 0.12);
    for (const s of [-1, 1]) { x.fillStyle = c.dark; x.beginPath(); x.moveTo(s * 1.6, -2); x.lineTo(s * 5.8, -8.5); x.lineTo(s * 5.8, 1); x.closePath(); x.fill(); }
    blob(x, c.coat, 0, -1, 5.4, 5.2); blob(x, c.pale, 0, -4.4, 2, 1.6); x.restore();
    if (paw) { line(x, c.coat, 3.6, [Math.sign(head || 1) * 5, -6], [head * 0.9, -16]); blob(x, c.pale, head * 0.9, -16.5, 2, 1.8); }
  });
}
// A dog from above, facing up: a long body, the feet by `p` in a trot, the tail going. nose: head stretched down to the ground; bark: head up, jaws open.
function dogPicture(c, { p = 0, reach = 8, nose = false, bark = false }) {
  return picture(110, 150, (x) => {
    for (const [s, hip, off] of [[-1, -15, 0], [1, -15, 0.5], [-1, 15, 0.5], [1, 15, 0]]) line(x, c.dark, 3.8, [s * 8.5, hip], [s * 10, hip - swing(p, off) * reach]);
    x.strokeStyle = c.dark; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 22); x.quadraticCurveTo(swing(p, 0) * 5, 31, swing(p, 0.25) * 8, 40); x.stroke();
    const g = x.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, c.dark); g.addColorStop(0.5, c.coat); g.addColorStop(1, c.dark); x.fillStyle = g; x.beginPath(); x.ellipse(0, 1, 10.5, 25, 0, 0, TAU); x.fill();
    blob(x, c.dark, 0, -3, 3.2, 17, 0);
    const hy = nose ? -39 : bark ? -29 : -32;
    line(x, c.coat, 9, [0, -20], [0, hy + 4]);
    for (const s of [-1, 1]) blob(x, c.dark, s * 7, hy + 1, 3, 5.4, s * -0.35);
    blob(x, c.coat, 0, hy, 6.4, 6.8); blob(x, c.pale, 0, hy - 6, 3.2, 4.2);
    if (bark) { blob(x, '#6d2c2a', 0, hy - 9.5, 2.3, 2.2); blob(x, c.pale, 0, hy - 12, 2.8, 1.8); }
    blob(x, '#1a1614', 0, hy - (bark ? 13 : 9.6), 1.8, 1.4);
  });
}

/**
 * The layer: populate({ spots, wallTops, grid, size, busy: 'quiet' | 'busy', blocked, random }) places what fits (`spots` { x, y } open
 * street, `wallTops` { ax, ay, bx, by } wall segments, `size` how big against the squares, `blocked` optional, keeping a flock's first
 * places on one side of a wall). tick(seconds, { near, ok(kind, x, y), blocked(a, b), barred(kind, x, y), day (0-1), night (0-1),
 * rain (0-1), view, seen(x, y), cast, sound(kind, at, urgent) }), kinds 'pigeons', 'chickens', 'cat', 'dog'. noise({ x, y, radius });
 * clear(). `busy` true while it has anything at all; `counts` how many of what, and `level` the setting it was given. `floor()` on
 * the ground, `sky()` the cat on its wall and birds low down, `high()` birds over the roofs.
 */
export function createTownLife({ PIXI, floor, sky, high = sky }) {
  let pigeons = [], chickens = [], cat = null, dog = null, noises = [], spots = [], walls = [], grid = 100, size = 1, level = 'quiet', time = 0, shownDay = 0, look = 0, wheelNow = 1, chance = Math.random, art = {};
  const texOf = (c) => PIXI.Texture.from(c);
  // Each set drawn the first time it is wanted, and again only if the canvas textures have been thrown away.
  const lazily = (key, sample, make) => { if (!art[key] || sample(art[key])?.baseTexture?.destroyed) art[key] = make(); return art[key]; };
  const pigeonTex = () => lazily('pigeon', (a) => a[0].stand, () => PIGEONS.map((c) => ({ stand: texOf(pigeonPicture(c, {})), walk: [0, 3.5, 5, 2].map((reach) => texOf(pigeonPicture(c, { reach }))), peck: texOf(pigeonPicture(c, { peck: true })), tucked: texOf(pigeonPicture(c, { tucked: true })), fly: SPANS.map((s) => texOf(pigeonFlying(c, s))) })));
  const henTex = () => lazily('hen', (a) => a[0].stand, () => HENS.map((c) => { const h = henArt(c); return { stand: texOf(h.stand), peck: texOf(h.peck), walk: h.walk.map(texOf), scratch: h.scratch.map(texOf) }; }));
  const catTex = (i) => lazily(`cat${i}`, (a) => a.sit, () => { const c = CATS[i]; return { sit: texOf(catSitting(c, {})), wash: [-3, 3].map((head) => texOf(catSitting(c, { head, paw: true }))), walk: Array.from({ length: 8 }, (_, n) => texOf(catGoing(c, n / 8, false))), slink: Array.from({ length: 8 }, (_, n) => texOf(catGoing(c, n / 8, true))) }; });
  const dogTex = (i) => lazily(`dog${i}`, (a) => a.stand, () => { const c = DOGS[i]; return { stand: texOf(dogPicture(c, { reach: 0 })), bark: texOf(dogPicture(c, { reach: 0, bark: true })), trot: Array.from({ length: 8 }, (_, n) => texOf(dogPicture(c, { p: n / 8 }))), nose: Array.from({ length: 8 }, (_, n) => texOf(dogPicture(c, { p: n / 8, reach: 4, nose: true }))) }; });
  const sprite = (parent, tex, dark = false) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.eventMode = 'none'; s.visible = false; if (dark) s.tint = 0x000000; parent.addChild(s); return s; };
  const pair = (parent, tex) => ({ shadow: sprite(floor(), tex, true), body: sprite(parent, tex) });
  const gone = (...list) => { for (const s of list) { try { s?.destroy(); } catch { /* gone */ } } };
  const drop = () => {
    for (const o of [...pigeons, ...chickens, ...(cat ? [cat] : []), ...(dog ? [dog] : [])]) gone(o.body, o.shadow);
    pigeons = []; chickens = []; cat = null; dog = null; spots = []; walls = [];
  };
  const put = (s, tex, x, y, angle, scale, alpha) => { s.visible = true; s.texture = tex; s.position.set(x, y); s.rotation = angle; s.scale.set(scale); s.alpha = alpha; };
  const hide = (o) => { o.body.visible = false; o.shadow.visible = false; };
  // Birds move between the layers as they go up and come down.
  const layerFor = (p) => (p.mode !== 'fly' ? 'floor' : p.h > 0.5 ? 'high' : 'sky');
  const rehome = (p) => { const want = layerFor(p); if (p.layer !== want) { p.layer = want; (want === 'floor' ? floor : want === 'high' ? high : sky)().addChild(p.body); } };
  return {
    populate({ spots: open = [], wallTops = [], grid: g = 100, size: s = 1, busy: b = 'quiet', blocked = () => false, focus = null, random = Math.random } = {}) {
      drop(); grid = g; size = s; level = b === 'busy' ? 'busy' : 'quiet'; spots = open; shownDay = 0; chance = random;
      walls = wallTops.filter((w) => Math.hypot(w.bx - w.ax, w.by - w.ay) >= g * 0.5);
      const n = townCounts(level, open.length, walls.length, random);
      // A flock, or a few hens, round one place; on the wrong side of a wall from that place they stay on it.
      const round = (home, r) => { const x = home.x + between(random, -r, r) * g, y = home.y + between(random, -r, r) * g; return blocked(home, { x, y }) ? { x: home.x, y: home.y } : { x, y }; };
      // A big map has several flocks and broods, so a town is not one corner of it; the first of each, and the cat and the dog, start where the view is.
      const groups = townGroups(level, open.length), homes = homesFor(open, groups, focus, { grid: g, random }), henHomes = homesFor(open, groups, focus, { grid: g, random });
      if (n.pigeons) { const t = pigeonTex(); pigeons = homes.flatMap((home) => Array.from({ length: n.pigeons }, () => { const coat = Math.floor(random() * t.length); return { ...round(home, 0.7), a: random() * TAU, mode: 'ground', wait: random() * 2, peck: 0, walk: 0, gait: random(), h: 0, t: 0, coat, phase: random() * 6, layer: 'floor', ...pair(floor(), t[coat].stand) }; })); }
      if (n.chickens) { const t = henTex(); chickens = henHomes.flatMap((home) => Array.from({ length: n.chickens }, () => { const coat = Math.floor(random() * t.length); return { ...round(home, 0.8), a: random() * TAU, mode: 'peck', wait: random() * 3, peck: 0, nod: 0, gait: random(), t: 0, coat, phase: random() * 6, ...pair(floor(), t[coat].stand) }; })); }
      if (n.cat) { const coat = Math.floor(random() * CATS.length), t = catTex(coat), seg = focus ? walls.reduce((best, w) => (Math.hypot((w.ax + w.bx) / 2 - focus.x, (w.ay + w.by) / 2 - focus.y) < Math.hypot((best.ax + best.bx) / 2 - focus.x, (best.ay + best.by) / 2 - focus.y) ? w : best)) : pickOf(walls, random), u = between(random, 0.1, 0.9), dir = random() < 0.5 ? 1 : -1; cat = { seg, u, dir, x: seg.ax + (seg.bx - seg.ax) * u, y: seg.ay + (seg.by - seg.ay) * u, a: Math.atan2((seg.bx - seg.ax) * dir, -(seg.by - seg.ay) * dir), mode: 'sit', left: between(random, 10, 50), wash: 0, washIn: between(random, 1, 6), gait: 0, show: 1, t: 0, coat, ...pair(sky(), t.sit) }; }
      if (n.dog) { const coat = Math.floor(random() * DOGS.length), t = dogTex(coat), at = homesFor(open, 1, focus, { grid: g, random })[0]; dog = { x: at.x, y: at.y, a: random() * TAU, mode: 'nose', t: between(random, 1, 4), want: 0, next: 0, sniff: false, v: 0, gait: 0, bark: 0, bored: 0, coat, ...pair(floor(), t.stand) }; dog.want = dog.a; }
    },
    noise({ x, y, radius }) { noises.push({ x, y, r: radius, t: 0 }); },
    tick(seconds, { near = [], ok = () => true, blocked = () => false, barred = () => false, day = 1, night = 0, rain = 0, view = null, seen = () => true, cast = null, sound = () => {} } = {}) {
      if (!this.busy) return;
      const dt = Math.min(0.05, seconds), k = (grid / 100) * size; time += dt;
      if (noises.length) { for (const n of noises) n.t += dt; noises = noises.filter((n) => n.t * NOISE_SPEED * grid < n.r + grid * 3); }
      const heard = (o) => (noises.length ? noiseReaching(noises, o.x, o.y, { grid }) : null);
      // Birds keep the daylight hours, fading out as it goes.
      const light = Math.max(0, Math.min(1, Math.min(day, 1 - night)));
      shownDay += Math.max(-dt, Math.min(dt, (light - shownDay) * 2)); const alpha = Math.max(0, Math.min(1, shownDay));
      const fall = shadowKeeper(cast ?? (() => ({ dx: grid * 0.02, dy: grid * 0.025, alpha: 0.5 })), time);
      look -= dt; const looking = look <= 0; if (looking) look = 0.2;
      const inView = (x, y, m = grid * 2) => !view || (x > view.x - m && y > view.y - m && x < view.x + view.w + m && y < view.y + view.h + m);
      const can = (o) => { if (looking) { try { o.seen = seen(o.x, o.y) !== false; } catch { o.seen = true; } } return o.seen !== false && inView(o.x, o.y); };
      const okFor = (kind) => (x, y) => ok(kind, x, y) && !barred(kind, x, y);
      if (alpha > 0.01 && pigeons.length) {
        const t = pigeonTex(), okHere = (x, y) => ok('pigeons', x, y), barredHere = (x, y) => barred('pigeons', x, y);
        // One goes up and they all go up: what scared it scares the lot, all the same way round, all for the same place.
        let flush = null; for (const p of pigeons) { if (p.mode === 'fly') continue; flush = pigeonAlarm(p, { grid, near, noise: heard(p) }); if (flush) break; }
        if (flush) wheelNow = (chance() < 0.5 ? -1 : 1) * between(chance, 0.9, 1.3);
        const cx = pigeons.reduce((n, p) => n + p.x, 0) / pigeons.length, cy = pigeons.reduce((n, p) => n + p.y, 0) / pigeons.length, centre = { x: cx, y: cy };
        const landing = flush || (looking && pigeons.some((p) => p.wantLand)) ? landingSpot(spots, centre, { grid, near, ok: (x, y) => okHere(x, y) && !barredHere(x, y), random: chance }) : null;
        let wentUp = false, cooing = false;
        pigeons = pigeons.map((p0) => {
          const p = pigeonStep(p0, { dt, grid, near, ok: okHere, blocked, barred: barredHere, rain, flush, noise: heard(p0), landing, wheel: wheelNow, random: chance });
          if (p.mode === 'fly' && p0.mode !== 'fly') wentUp = true;
          if (p.mode !== 'fly' && !p.tucked) cooing = true;
          rehome(p);
          if (!can(p)) { hide(p); return p; }
          const set = t[p.coat];
          if (p.mode === 'fly') {
            // A soft shadow, wider and fainter the higher it is; steady wings on the glide down.
            const tex = set.fly[p.stage === 'glide' && p.h > 0.2 ? 0 : Math.floor(time * 16 + p.phase) % SPANS.length], s = 0.42 * k * (1 + p.h * 0.18), c = fall(p, p.x, p.y, { width: grid * 0.35, lift: 1.2 * Math.max(0.05, p.h) });
            put(p.shadow, tex, p.x + c.dx * (0.3 + p.h), p.y + c.dy * (0.3 + p.h), p.a, s * (1 + p.h * 0.25), Math.min(0.24, c.alpha * 0.28) * (1 - p.h * 0.35) * alpha); put(p.body, tex, p.x, p.y, p.a, s, alpha);
          } else {
            const tex = p.tucked ? set.tucked : p.peck > 0 ? set.peck : p.walk > 0 ? set.walk[Math.floor((((p.gait % 1) + 1) % 1) * 4)] : set.stand, s = 0.62 * k, c = fall(p, p.x, p.y, { width: grid * 0.14, body: 0.12, grounded: true });
            put(p.shadow, tex, p.x + c.dx, p.y + c.dy, p.a, s, Math.min(0.4, c.alpha * 0.45) * alpha); put(p.body, tex, p.x, p.y, p.a, s, alpha);
          }
          return p;
        });
        if (wentUp) sound('wingsUp', centre, true);
        else if (cooing && chance() < dt * 0.08) sound('pigeonCoo', centre, false);
      } else for (const p of pigeons) hide(p);
      if (alpha > 0.01 && chickens.length) {
        const t = henTex(), okHere = okFor('chickens');
        chickens = chickens.map((c0) => {
          const c = chickenStep(c0, { dt, grid, near, ok: okHere, blocked, noise: heard(c0), random: chance });
          // A hen clucks as she scratches about, and at once when something sets her running.
          if (c.mode === 'panic' && c0.mode !== 'panic') sound('henCluck', c, true);
          else if (chance() < dt * 0.04) sound('henCluck', c, false);
          if (!can(c)) { hide(c); return c; }
          const set = t[c.coat], moving = c.mode === 'walk' || c.mode === 'sprint' || c.mode === 'panic';
          const tex = moving ? set.walk[Math.floor((((c.gait % 1) + 1) % 1) * 4)] : c.mode === 'scratch' ? set.scratch[Math.floor(time * 5 + c.phase) % 2] : c.peck > 0 ? set.peck : set.stand;
          const s = 0.68 * k, f = fall(c, c.x, c.y, { width: grid * 0.2, body: 0.2, grounded: true });
          put(c.shadow, tex, c.x + f.dx, c.y + f.dy, c.a, s, Math.min(0.42, f.alpha * 0.48) * alpha); put(c.body, tex, c.x, c.y, c.a, s, alpha);
          return c;
        });
      } else for (const c of chickens) hide(c);
      if (cat) {
        const wasMode = cat.mode, c = catStep(cat, { dt, grid, near, walls, noise: heard(cat), night, random: chance }); cat = c;
        // A complaint as it slinks off, and now and then for no reason at all.
        if (c.show > 0 && ((c.mode === 'slink' && wasMode !== 'slink') || (c.mode === 'sit' && chance() < dt * 0.012))) sound('catMeow', c, false);
        if (c.mode === 'away' && c.show <= 0) hide(c);
        else if (!can(c)) hide(c);
        else {
          const t = catTex(c.coat), q = ((c.gait % 1) + 1) % 1, tex = c.mode === 'slink' ? t.slink[Math.floor(q * 8)] : c.mode === 'walk' ? t.walk[Math.floor(q * 8)] : c.wash > 0 ? t.wash[Math.floor(time * 2.4) % 2] : t.sit, s = 0.56 * k, f = fall(c, c.x, c.y, { width: grid * 0.22, body: 0.3, grounded: true });
          put(c.shadow, tex, c.x + f.dx, c.y + f.dy, c.a, s, Math.min(0.42, f.alpha * 0.48) * c.show); put(c.body, tex, c.x, c.y, c.a, s, c.show);
        }
      }
      if (dog) {
        const o = dogStep(dog, { dt, grid, near, spots, ok: okFor('dog'), blocked, noise: heard(dog), random: chance }); dog = o;
        if (o.barked) sound('dogBark', o, false);
        if (!can(o)) hide(o);
        else {
          const t = dogTex(o.coat), q = ((o.gait % 1) + 1) % 1, frame = Math.floor(q * 8), tex = o.bark > 0 ? t.bark : (o.v ?? 0) <= 2 ? (o.mode === 'nose' ? t.nose[0] : t.stand) : o.mode === 'nose' ? t.nose[frame] : t.trot[frame], s = 0.6 * k, f = fall(o, o.x, o.y, { width: grid * 0.34, body: 0.4, grounded: true });
          put(o.shadow, tex, o.x + f.dx, o.y + f.dy, o.a, s, Math.min(0.5, f.alpha * 0.55)); put(o.body, tex, o.x, o.y, o.a, s, 1);
        }
      }
    },
    clear() { drop(); noises = []; },
    get busy() { return pigeons.length + chickens.length + (cat ? 1 : 0) + (dog ? 1 : 0) > 0; },
    get counts() { return { level, pigeons: pigeons.length, chickens: chickens.length, cat: cat ? 1 : 0, dog: dog ? 1 : 0, pigeonModes: pigeons.map((p) => (p.tucked ? 'tucked' : p.mode)), chickenModes: chickens.map((c) => c.mode), catMode: cat?.mode ?? null, dogMode: dog?.mode ?? null }; },
  };
}
