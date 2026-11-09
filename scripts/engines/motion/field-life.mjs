// More life out of doors. By day: deer that graze and bound away, a fox that trots, creeps up on a rabbit and pounces, butterflies,
// dragonflies over the water. By night: fireflies, an owl gliding over in silence, bats hunting round the lamps. Drawn once, seen
// from above, then only moved, turned and swapped; every gait runs by the ground covered, so no foot slides. A few dozen small
// shapes on the CPU at most, and nothing drawn where nobody looks. Every screen has its own: nothing here is saved or shared.

import { noiseReaching, shadowKeeper, overOpen, NOISE_SPEED, resettled, nearestSpot, edgeArrival, edgeExit, crossesKept } from './wildlife.mjs';
import { batWingbeat } from './vermin.mjs';

const TAU = Math.PI * 2;
const between = (random, a, b) => a + random() * (b - a);
// Turning takes time: never more than `r` radians this step, the short way round.
export const turnToward = (a, want, r) => { const d = ((want - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + Math.max(-r, Math.min(r, d)); };

// ---- What they do ------------------------------------------------------------------------------------------------------
// The way nearest `want` (radians, atan2) with `reach` px clear ahead (pure): looked for outward either side, so something stopped by a
// bank runs along it rather than spinning on the spot. null: boxed in. `free(x, y)` whether it may be there.
export function clearWay(x, y, want, reach, free) {
  for (let i = 0; i <= 8; i++) for (const side of i && i < 8 ? [1, -1] : [1]) {
    const a = want + (side * i * Math.PI) / 8;
    if (free(x + Math.cos(a) * reach * 0.5, y + Math.sin(a) * reach * 0.5) && free(x + Math.cos(a) * reach, y + Math.sin(a) * reach)) return a;
  }
  return null;
}

// A deer or fox on ground that has just turned bad (pure): off at a run toward the nearest good ground. A fox carrying something, or gone, is not there to run.
export const runsOff = (o, { spots = [] } = {}) => { if (o.mode === 'carry' || o.mode === 'away') return o; const to = nearestSpot(o.x, o.y, spots); if (!to) return o; return { ...o, mode: 'flee', t: 0, way: Math.atan2(to.y - o.y, to.x - o.x), v: 0, h: 0 }; };

// One step of a deer (pure): grazes, lifts its head (`lift` 0-1) to look about, walks a little on open ground (`ok`), and from
// anyone near or a loud noise bounds away (`mode` 'flee', `h` 0-1 how high in the bound, `gait` how far through its stride).
export function deerStep(deer, { dt = 1 / 60, grid = 100, near = [], ok = () => true, blocked = () => false, scare = false, noise = null, random = Math.random } = {}) {
  const o = { ...deer }, free = (nx, ny) => !blocked({ x: o.x, y: o.y }, { x: nx, y: ny }) && (ok(nx, ny) || !ok(o.x, o.y));
  const close = noise ?? near.find((t) => Math.hypot(t.x - o.x, t.y - o.y) < grid * 4.5);
  if (o.mode !== 'flee' && (close || scare)) { o.way = close ? Math.atan2(o.y - close.y, o.x - close.x) + between(random, -0.4, 0.4) : random() * TAU; o.mode = 'flee'; o.t = 0; o.gait = 0.75; o.v = 0; }
  if (o.mode === 'flee') {
    // It turns as it goes, and each bound carries it furthest in the air.
    o.t += dt; o.a = turnToward(o.a, o.way + Math.PI / 2, dt * 4.5); o.h = Math.max(0, Math.sin(TAU * (o.gait % 1)));
    // Looking a body and a bound ahead along the way it means to go: if that is shut, it settles on one clear way and keeps to it.
    if (!free(o.x + Math.cos(o.way) * grid * 1.1, o.y + Math.sin(o.way) * grid * 1.1)) { const w = clearWay(o.x, o.y, o.way, grid * 1.6, free); if (w === null) { o.mode = 'look'; o.h = 0; o.lift = 1; o.wait = between(random, 1, 3); o.want = o.a; o.v = 0; return o; } o.way = w; }
    const speed = grid * (2.4 + o.h * 4.4) * Math.min(1, 0.45 + o.t * 1.4), nx = o.x + Math.sin(o.a) * speed * dt, ny = o.y - Math.cos(o.a) * speed * dt;
    // Its head comes round first where it cannot yet go; it does not push its nose out over the water.
    if (free(nx + Math.sin(o.a) * grid * 0.45, ny - Math.cos(o.a) * grid * 0.45)) { o.x = nx; o.y = ny; o.gait += (speed * dt) / (grid * 1.9); } else o.a = turnToward(o.a, o.way + Math.PI / 2, dt * 9);
    if (o.t > 3.8) { if (!ok(o.x, o.y) && (o.ranOn = (o.ranOn ?? 0) + 1) < 4) o.t = 1.5; else if (close) { o.t = 1.5; o.way = Math.atan2(o.y - close.y, o.x - close.x); } else { o.mode = 'look'; o.ranOn = 0; o.h = 0; o.lift = 1; o.wait = between(random, 2, 5); o.want = o.a; } }
    return o;
  }
  // Walking in from the edge of the map to `tx`, `ty`.
  if (o.mode === 'arrive') {
    o.t += dt; o.lift = 1; o.v = grid * 0.8; o.a = turnToward(o.a, Math.atan2(o.ty - o.y, o.tx - o.x) + Math.PI / 2, dt * 2.5);
    const nx = o.x + Math.sin(o.a) * o.v * dt, ny = o.y - Math.cos(o.a) * o.v * dt;
    if (o.clear > 0 || !blocked({ x: o.x, y: o.y }, { x: nx, y: ny })) { o.clear = (o.clear ?? 0) - o.v * dt; o.x = nx; o.y = ny; o.gait += (o.v * dt) / (grid * 0.62); }
    if (Math.hypot(o.tx - o.x, o.ty - o.y) < grid * 0.5 || o.t > 25) { o.mode = 'look'; o.wait = between(random, 2, 5); o.want = o.a; o.v = 0; }
    return o;
  }
  o.wait -= dt;
  if (o.wait <= 0) { o.wait = between(random, 2.5, 7); o.mode = random() < 0.34 ? 'walk' : random() < 0.6 ? 'graze' : 'look'; o.want = o.a + between(random, -1.1, 1.1); }
  o.lift = Math.max(0, Math.min(1, (o.lift ?? 0) + (o.mode === 'graze' ? -dt : dt) * 1.3));
  o.v = (o.v ?? 0) + ((o.mode === 'walk' && o.lift >= 1 ? grid * 0.42 : 0) - (o.v ?? 0)) * Math.min(1, dt * 2.4);
  if (o.v > 1) {
    o.a = turnToward(o.a, o.want ?? o.a, dt * 0.9);
    const nx = o.x + Math.sin(o.a) * o.v * dt, ny = o.y - Math.cos(o.a) * o.v * dt;
    if (free(nx + Math.sin(o.a) * grid * 0.45, ny - Math.cos(o.a) * grid * 0.45)) { o.x = nx; o.y = ny; o.gait += (o.v * dt) / (grid * 0.62); } else { const w = clearWay(o.x, o.y, o.a - Math.PI / 2, grid * 1.2, free); o.want = w === null ? o.a : w + Math.PI / 2; o.a = turnToward(o.a, o.want, dt * 1.6); if (w === null) { o.mode = 'look'; o.v = 0; } }
  }
  return o;
}

// One step of a fox (pure): trots about, and on seeing a rabbit sitting (`prey`) near enough creeps low in bursts, dead still between
// (`time` seconds, for the bursts), coils and pounces at where it was (`ex`, `ey`). Anyone near or a noise sends it off at a run.
// 'carry' takes something away, 'away' is gone till the layer brings it back.
export function foxStep(fox, { dt = 1 / 60, grid = 100, near = [], ok = () => true, blocked = () => false, scare = false, noise = null, prey = [], time = 0, random = Math.random } = {}) {
  const f = { ...fox }, free = (nx, ny) => !blocked({ x: f.x, y: f.y }, { x: nx, y: ny }) && (ok(nx, ny) || !ok(f.x, f.y));
  if (f.mode === 'away') { f.t += dt; return f; }
  const close = noise ?? near.find((t) => Math.hypot(t.x - f.x, t.y - f.y) < grid * 4);
  if (f.mode !== 'flee' && f.mode !== 'carry' && (close || scare)) { f.way = close ? Math.atan2(f.y - close.y, f.x - close.x) : random() * TAU; f.mode = 'flee'; f.t = 0; f.h = 0; }
  const forward = (speed, stride) => { const nx = f.x + Math.sin(f.a) * speed * dt, ny = f.y - Math.cos(f.a) * speed * dt; if (free(nx + Math.sin(f.a) * grid * 0.3, ny - Math.cos(f.a) * grid * 0.3)) { f.x = nx; f.y = ny; f.gait += (speed * dt) / (grid * stride); return true; } return false; };
  // Running: the way ahead shut, it settles on one clear way and keeps to it; it stops looking only if boxed in.
  const steer = () => { if (!free(f.x + Math.cos(f.way) * grid * 0.9, f.y + Math.sin(f.way) * grid * 0.9)) { const w = clearWay(f.x, f.y, f.way, grid * 1.3, free); if (w !== null) f.way = w; } };
  if (f.mode === 'flee') {
    f.t += dt; steer(); f.a = turnToward(f.a, f.way + Math.PI / 2, dt * 6); f.v = grid * (3 + Math.max(0, Math.sin(TAU * (f.gait % 1))) * 3);
    if (!forward(f.v, 1.3)) f.a = turnToward(f.a, f.way + Math.PI / 2, dt * 9);
    if (f.t > 2.6) { if (!ok(f.x, f.y) && (f.ranOn = (f.ranOn ?? 0) + 1) < 4) f.t = 1; else { f.mode = 'trot'; f.ranOn = 0; f.want = f.a; f.wait = between(random, 3, 7); } }
  } else if (f.mode === 'carry') {
    f.t += dt; steer(); f.a = turnToward(f.a, f.way + Math.PI / 2, dt * 3); f.v = grid * 1.6;
    if (!forward(f.v, 0.9)) f.a = turnToward(f.a, f.way + Math.PI / 2, dt * 9);
    if (f.t > 7) { f.mode = 'away'; f.t = 0; f.back = between(random, 50, 110); }
  } else if (f.mode === 'trot') {
    f.want = (f.want ?? f.a) + Math.sin(time * 0.7 + (f.seed ?? 0)) * 0.6 * dt; f.a = turnToward(f.a, f.want, dt * 1.6); f.wait -= dt; f.v = (f.v ?? 0) + (grid * 0.95 - (f.v ?? 0)) * Math.min(1, dt * 2.5);
    if (!forward(f.v, 0.72)) { const w = clearWay(f.x, f.y, f.a - Math.PI / 2, grid, free); f.want = w === null ? f.a + between(random, 1.6, 2.8) : w + Math.PI / 2; f.a = turnToward(f.a, f.want, dt * 3); }
    if (f.wait <= 0) {
      const sitting = prey.filter((r) => r.mode !== 'bolt' && Math.hypot(r.x - f.x, r.y - f.y) < grid * 5); f.wait = between(random, 2, 5);
      // No rabbit about: now and then it stops, ears up, and looks round before trotting on.
      if (sitting.length) f.mode = 'stalk'; else if (random() < 0.35) { f.mode = 'look'; f.t = 0; f.lookFor = between(random, 2, 5); f.want = f.a + between(random, -1.2, 1.2); }
    }
  } else if (f.mode === 'look') {
    f.t += dt; f.v = (f.v ?? 0) * Math.max(0, 1 - dt * 6); f.a = turnToward(f.a, f.want, dt * 0.9);
    if (f.t > (f.lookFor ?? 3)) { f.mode = 'trot'; f.wait = between(random, 3, 7); f.want = f.a; }
  } else if (f.mode === 'stalk') {
    const target = prey.filter((r) => r.mode !== 'bolt').reduce((best, r) => (!best || Math.hypot(r.x - f.x, r.y - f.y) < Math.hypot(best.x - f.x, best.y - f.y) ? r : best), null);
    if (!target || Math.hypot(target.x - f.x, target.y - f.y) > grid * 6) { f.mode = 'trot'; f.wait = 4; f.want = f.a; return f; }
    const gap = Math.hypot(target.x - f.x, target.y - f.y);
    f.a = turnToward(f.a, Math.atan2(target.y - f.y, target.x - f.x) + Math.PI / 2, dt * 1.4);
    f.v = grid * 0.5 * Math.max(0, Math.sin(time * 1.5)) ** 2; forward(f.v, 0.42);
    if (gap < grid * 1.4) { f.mode = 'coil'; f.t = 0; f.ex = target.x; f.ey = target.y; f.a = Math.atan2(target.y - f.y, target.x - f.x) + Math.PI / 2; }
  } else if (f.mode === 'coil') {
    f.t += dt; if (f.t > 0.45) { f.mode = 'pounce'; f.t = 0; f.fx = f.x; f.fy = f.y; }
  } else if (f.mode === 'pounce') {
    f.t += dt / 0.55; const u = Math.min(1, f.t), nx = f.fx + (f.ex - f.fx) * u, ny = f.fy + (f.ey - f.fy) * u; f.h = Math.sin(u * Math.PI);
    if (free(nx, ny)) { f.x = nx; f.y = ny; }
    if (u >= 1) { f.h = 0; f.mode = 'landed'; f.t = 0; }
  } else if (f.mode === 'landed') { f.t += dt; if (f.t > 0.8) { f.mode = 'trot'; f.wait = 5; f.want = f.a; f.v = 0; } }
  return f;
}

// One step of a wolf (pure). A pack keeps together behind its first (`leader`, none for the first itself): it walks in from the edge of the map ('arrive', to `tx`, `ty`), trots about, lies up a while, and goes after a deer it sees (`prey`) for a few seconds; fed (`full` seconds), it leaves them alone. A kill is hauled off the map ('drag', to `tx`, `ty`): the wolf `pulling` it backs away with it, the rest go along, and past the edge each is 'away' till the layer brings it back. Anyone near, a noise, or a fire (`fires`) sends it off at a run. Modes 'arrive', 'trot', 'rest', 'hunt', 'drag', 'away', 'flee'.
// How far from a wolf's middle the deer it hauls lies (pure): its mouth to the deer's own middle, so they touch at any size. `grid` px a square, each size times the usual.
export const wolfGrip = (grid, wolfSize = 1, deerSize = 1) => grid * (0.4 * wolfSize + 0.35 * deerSize);
// Whether a pack's first wolf calls now, and how (pure): null, 'wolfHowl' or 'wolfPack'. On coming in from the edge it always does; at ease it does now and then, more by night. Never hunting, hauling or running, and one alone has no pack to join in.
export const wolfCallNow = ({ was, mode, night = 0, pack = 1, dt = 1 / 60, random = Math.random } = {}) => {
  const together = () => (pack > 1 && random() < 0.5 ? 'wolfPack' : 'wolfHowl');
  if (was === 'arrive' && mode === 'trot') return pack > 1 ? 'wolfPack' : 'wolfHowl';
  if ((mode === 'trot' || mode === 'rest') && random() < dt * (0.005 + 0.012 * night)) return together();
  return null;
};
// Whether a wolf growls now (pure): at someone coming within five squares, once until they have gone well off again. { growl, warned }, `warned` what to remember. Not while it is hunting or on its way in.
export const wolfGrowlNow = (wolf, near = [], grid = 100) => {
  const within = (squares) => near.some((t) => Math.hypot(t.x - wolf.x, t.y - wolf.y) < grid * squares);
  if (wolf.warned) return { growl: false, warned: within(7) };
  return wolf.mode !== 'hunt' && wolf.mode !== 'arrive' && wolf.mode !== 'away' && within(5) ? { growl: true, warned: true } : { growl: false, warned: false };
};
export function wolfStep(wolf, { dt = 1 / 60, grid = 100, near = [], ok = () => true, blocked = () => false, kept = () => false, scare = false, noise = null, fires = [], prey = [], leader = null, time = 0, random = Math.random } = {}) {
  const w = { ...wolf, full: Math.max(0, (wolf.full ?? 0) - dt) }, free = (nx, ny) => !blocked({ x: w.x, y: w.y }, { x: nx, y: ny }) && (ok(nx, ny) || !ok(w.x, w.y));
  let wading = false;
  const wades = (nx, ny) => !blocked({ x: w.x, y: w.y }, { x: nx, y: ny }) && (!kept(nx, ny) || kept(w.x, w.y));
  const forward = (speed, stride) => { const nx = w.x + Math.sin(w.a) * speed * dt, ny = w.y - Math.cos(w.a) * speed * dt, px = nx + Math.sin(w.a) * grid * 0.4, py = ny - Math.cos(w.a) * grid * 0.4; if (wading ? wades(px, py) : free(px, py)) { w.x = nx; w.y = ny; w.gait = (w.gait ?? 0) + (speed * dt) / (grid * stride); return true; } return false; };
  const steer = () => { if (!free(w.x + Math.cos(w.way) * grid * 0.9, w.y + Math.sin(w.way) * grid * 0.9)) { const c = clearWay(w.x, w.y, w.way, grid * 1.3, free); if (c !== null) w.way = c; } };
  if (w.mode === 'away') { w.t = (w.t ?? 0) + dt; w.v = 0; return w; }
  const within = (o, squares) => Math.hypot(o.x - w.x, o.y - w.y) < grid * squares;
  // The way to go for `way` (radians, atan2): straight if it is clear, else round what is in the way, keeping to one side of it till it is past (no dithering at a wall). Walls stop it; water does not, on these errands.
  const walk = (nx, ny) => !blocked({ x: w.x, y: w.y }, { x: nx, y: ny }) && (!kept(nx, ny) || kept(w.x, w.y)), ahead = (a, far) => [grid * 1.3 * dt, far * 0.25, far * 0.5, far].every((d) => walk(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d));
  const round = (way) => {
    if (ahead(way, grid * 0.7)) { if (ahead(way, grid * 3)) w.side = 0; return way; }
    const sides = w.side ? [w.side] : [1, -1];
    for (const side of sides) for (let i = 1; i <= 8; i++) { const a = way + (side * i * Math.PI) / 8; if (ahead(a, grid * 0.7)) { w.side = side; return a; } }
    return way;
  };
  const danger = noise ?? near.find((t) => within(t, 3)) ?? fires.find((l) => within(l, 2.5));
  if (w.mode !== 'flee' && (danger || scare)) { w.way = danger ? Math.atan2(w.y - danger.y, w.x - danger.x) + between(random, -0.3, 0.3) : random() * TAU; w.mode = 'flee'; w.t = 0; }
  if (w.mode === 'flee') {
    w.t = (w.t ?? 0) + dt; steer(); w.a = turnToward(w.a, w.way + Math.PI / 2, dt * 5); w.v = grid * 3.6;
    if (!forward(w.v, 1.5)) w.a = turnToward(w.a, w.way + Math.PI / 2, dt * 9);
    if (w.t > 3.2) { if (danger) { w.t = 1; w.way = Math.atan2(w.y - danger.y, w.x - danger.x); } else if (!ok(w.x, w.y) && (w.ranOn = (w.ranOn ?? 0) + 1) < 4) w.t = 1; else { w.mode = 'trot'; w.ranOn = 0; w.want = w.a; w.wait = between(random, 4, 9); } }
    return w;
  }
  if (w.mode === 'arrive') {
    w.t = (w.t ?? 0) + dt; w.v = grid * 1.3; { const straight = Math.atan2(w.ty - w.y, w.tx - w.x); w.a = turnToward(w.a, (w.clear > 0 ? straight : round(straight)) + Math.PI / 2, dt * 3); }
    const nx = w.x + Math.sin(w.a) * w.v * dt, ny = w.y - Math.cos(w.a) * w.v * dt;
    if (w.clear > 0 || walk(nx, ny)) { w.clear = (w.clear ?? 0) - w.v * dt; w.x = nx; w.y = ny; w.gait = (w.gait ?? 0) + (w.v * dt) / (grid * 0.85); }
    // Not done till it is really on the map.
    if ((Math.hypot(w.tx - w.x, w.ty - w.y) < grid * 0.6 && ok(w.x, w.y)) || w.t > 25) { w.mode = 'trot'; w.want = w.a; w.wait = between(random, 8, 18); }
    return w;
  }
  if (w.mode === 'drag') {
    // Its first driven off: nothing to go along with.
    if (leader && leader !== wolf && leader.mode !== 'drag' && leader.mode !== 'away') { w.mode = 'trot'; w.want = w.a; w.wait = between(random, 8, 18); return w; }
    w.t = (w.t ?? 0) + dt;
    // First it goes up to what it will haul. If it can't get there, it leaves it lying and goes on alone.
    if (w.goingTo) {
      const off = Math.hypot(w.goingTo.x - w.x, w.goingTo.y - w.y);
      if (off > w.goingTo.reach && w.t < 12) {
        const straight = Math.atan2(w.goingTo.y - w.y, w.goingTo.x - w.x), way = off < grid * 1.8 ? straight : round(straight), step = Math.min(grid * 0.95 * dt, off - w.goingTo.reach), nx = w.x + Math.cos(way) * step, ny = w.y + Math.sin(way) * step;
        w.a = turnToward(w.a, way + Math.PI / 2, dt * 5); w.v = grid * 0.95;
        if (walk(nx, ny)) { w.x = nx; w.y = ny; w.gait = (w.gait ?? 0) + step / (grid * 0.85); }
        return w;
      }
      if (off > w.goingTo.reach) w.pulling = false;
      w.goingTo = null; w.t = 0;
    }
    // Round what is in the way; still at it after this long, it forces a way straight out.
    const forcing = w.t > 25, gap = Math.hypot(w.tx - w.x, w.ty - w.y), straight = Math.atan2(w.ty - w.y, w.tx - w.x), way = gap < grid * 1.8 || forcing ? straight : round(straight);
    w.a = turnToward(w.a, way + Math.PI / 2 + (w.pulling ? Math.PI : 0), dt * 3); w.v = grid * (w.pulling ? 0.7 : 0.95);
    let nx = w.x + Math.cos(way) * w.v * dt, ny = w.y + Math.sin(way) * w.v * dt;
    // (The map's own edge stops nothing going out by it.)
    const open = gap < grid * 1.8 || forcing;
    // The way it chose clips a corner by a hair: it slides round on its side instead of standing there.
    if (!open && !walk(nx, ny)) for (let i = 1; i <= 8; i++) { const a = way + ((w.side || 1) * i * Math.PI) / 8, sx = w.x + Math.cos(a) * w.v * dt, sy = w.y + Math.sin(a) * w.v * dt; if (walk(sx, sy)) { nx = sx; ny = sy; break; } }
    if (open || walk(nx, ny)) { w.x = nx; w.y = ny; w.gait = (w.gait ?? 0) + (w.v * dt) / (grid * 0.85); }
    if (gap < grid * 0.25) { w.mode = 'away'; w.t = 0; w.v = 0; } else if (w.t > 120) { w.mode = 'trot'; w.want = w.a; w.wait = between(random, 8, 18); w.pulling = false; }
    return w;
  }
  // Its first has gone off the map: it goes after it.
  if (leader && leader !== wolf && leader.mode === 'away') { w.mode = 'drag'; w.t = 0; w.tx = leader.x; w.ty = leader.y; w.pulling = false; return w; }
  // The pack follows its first: to the same hunt, to lie up where it lies up.
  if (leader && leader !== wolf) {
    if (leader.mode === 'hunt' && w.mode !== 'hunt') { w.mode = 'hunt'; w.t = 0; }
    else if (leader.mode === 'rest' && w.mode === 'trot' && within(leader, 3)) { w.mode = 'rest'; w.wait = between(random, 4, 12); }
    else if (leader.mode === 'trot' && w.mode === 'hunt') w.mode = 'trot';
    else if (leader.mode === 'trot' && w.mode === 'rest') { w.mode = 'trot'; w.wait = between(random, 2, 5); }
  }
  if (w.mode === 'rest') {
    w.v = 0; w.wait -= dt;
    if (w.wait <= 0 && !leader) { w.mode = 'trot'; w.want = w.a + between(random, -1.2, 1.2); w.wait = between(random, 8, 18); }
    return w;
  }
  if (w.mode === 'hunt') {
    w.t = (w.t ?? 0) + dt;
    const deer = prey.reduce((best, d) => (!best || Math.hypot(d.x - w.x, d.y - w.y) < Math.hypot(best.x - w.x, best.y - w.y) ? d : best), null);
    if (!deer || w.t > 6) { w.mode = 'trot'; w.want = w.a; w.wait = between(random, 15, 30); w.t = 0; return w; }
    w.a = turnToward(w.a, Math.atan2(deer.y - w.y, deer.x - w.x) + Math.PI / 2, dt * 3.5); w.v = grid * 3.6;
    if (!forward(w.v, 1.4)) { const c = clearWay(w.x, w.y, w.a - Math.PI / 2, grid, free); if (c !== null) w.a = turnToward(w.a, c + Math.PI / 2, dt * 6); }
    return w;
  }
  // Trotting: the first wanders; the rest close up on it, each a little to its own side.
  if (leader && leader !== wolf) {
    const side = (w.seed ?? 0) % 2 < 1 ? 1 : -1, tx = leader.x + Math.cos(leader.a) * side * grid * 1.1 - Math.sin(leader.a) * grid * 0.9, ty = leader.y + Math.sin(leader.a) * side * grid * 1.1 + Math.cos(leader.a) * grid * 0.9;
    const far = Math.hypot(tx - w.x, ty - w.y);
    // Fallen far behind, it crosses water to catch up.
    wading = far > grid * 6;
    w.want = far > grid * 0.5 ? round(Math.atan2(ty - w.y, tx - w.x)) + Math.PI / 2 : leader.a;
    w.v = (w.v ?? 0) + (grid * (far > grid * 3 ? 1.7 : far > grid * 0.5 ? 1.1 : 0.85) - (w.v ?? 0)) * Math.min(1, dt * 2.5);
  } else {
    w.want = (w.want ?? w.a) + Math.sin(time * 0.5 + (w.seed ?? 0)) * 0.5 * dt; w.wait -= dt;
    // Hungry, it ranges toward the nearest deer, wherever that is, in no hurry.
    if (!w.full && prey.length) { const deer = prey.reduce((best, d) => (Math.hypot(d.x - w.x, d.y - w.y) < Math.hypot(best.x - w.x, best.y - w.y) ? d : best)); w.want = turnToward(w.want, Math.atan2(deer.y - w.y, deer.x - w.x) + Math.PI / 2, dt * 0.35); } w.v = (w.v ?? 0) + (grid * 0.9 - (w.v ?? 0)) * Math.min(1, dt * 2.5);
    if (w.wait <= 0) {
      w.wait = between(random, 8, 18);
      if (!w.full && prey.some((d) => within(d, 10))) { w.mode = 'hunt'; w.t = 0; return w; }
      if (random() < 0.35) { w.mode = 'rest'; w.wait = between(random, 10, 25); return w; }
    }
  }
  w.a = turnToward(w.a, w.want, dt * 1.8);
  if (!forward(w.v, 0.85)) { const c = clearWay(w.x, w.y, w.a - Math.PI / 2, grid, free); w.want = c === null ? w.a + between(random, 1.6, 2.8) : c + Math.PI / 2; w.a = turnToward(w.a, w.want, dt * 3); }
  return w;
}

// One step of a squirrel (pure): forages in short bursts, stock still between, near its tree (`trees` [{ x, y, r }], `tree` its own). Anyone near, a noise or a scare sends it racing under the leaves ('hide', where it stays a while, then comes back out). A map with no trees drawn as tiles: it only bolts a way off. Modes 'forage', 'dash', 'race', 'hide'.
// `within(x, y)`: whether a point is on the map at all; even racing for cover it never runs off it.
export function squirrelStep(squirrel, { dt = 1 / 60, grid = 100, near = [], ok = () => true, within = () => true, blocked = () => false, scare = false, noise = null, trees = [], random = Math.random } = {}) {
  const s = { ...squirrel }, home = trees[s.tree] ?? null;
  const go = (speed) => { const nx = s.x + Math.sin(s.a) * speed * dt, ny = s.y - Math.cos(s.a) * speed * dt; if (blocked({ x: s.x, y: s.y }, { x: nx, y: ny }) || (!within(nx, ny) && within(s.x, s.y)) || (!ok(nx, ny) && ok(s.x, s.y) && s.mode !== 'race')) return false; s.x = nx; s.y = ny; s.gait = (s.gait ?? 0) + (speed * dt) / (grid * 0.3); return true; };
  const danger = noise ?? near.find((t) => Math.hypot(t.x - s.x, t.y - s.y) < grid * 3);
  if (s.mode === 'hide') { s.wait -= dt; s.v = 0; if (!home) { s.mode = 'forage'; s.wait = between(random, 1, 3); return s; } if (s.wait <= 0 && !scare && !noise) {
      // Out on a side with nobody near: a tree can be wide, and someone at one edge of it is no reason to stay in for good.
      const way = random() * TAU, tx = home.x + Math.cos(way) * home.r * 1.15, ty = home.y + Math.sin(way) * home.r * 1.15;
      if (near.some((t) => Math.hypot(t.x - tx, t.y - ty) < grid * 3)) { s.wait = between(random, 1.5, 4); return s; }
      s.mode = 'dash'; s.emerging = true; s.tx = tx; s.ty = ty; s.t = 0;
    } return s; }
  if (s.mode !== 'race' && (noise || scare || (danger && !s.emerging))) {
    s.mode = 'race'; s.t = 0; s.emerging = false;
    const cover = trees.reduce((best, t, i) => { const d = Math.hypot(t.x - s.x, t.y - s.y); return d < best.d ? { d, i } : best; }, { d: Infinity, i: -1 });
    if (cover.i >= 0) { s.tree = cover.i; s.tx = trees[cover.i].x; s.ty = trees[cover.i].y; }
    else { const from = danger ? Math.atan2(s.y - danger.y, s.x - danger.x) : random() * TAU; s.tx = s.x + Math.cos(from) * grid * 6; s.ty = s.y + Math.sin(from) * grid * 6; }
  }
  if (s.mode === 'race' || s.mode === 'dash') {
    s.t = (s.t ?? 0) + dt; s.a = turnToward(s.a, Math.atan2(s.ty - s.y, s.tx - s.x) + Math.PI / 2, dt * 9); s.v = grid * (s.mode === 'race' ? 4.6 : 2.6);
    const moved = go(s.v), cover = s.mode === 'race' ? trees[s.tree] : null, fromCover = cover ? Math.hypot(cover.x - s.x, cover.y - s.y) : Infinity;
    // Under the leaves it is safe; and stopped by a wall at its tree (walls drawn round a trunk), it goes up from there.
    const there = Math.hypot(s.tx - s.x, s.ty - s.y) < grid * 0.3 || (cover && (fromCover < cover.r * 0.55 || (!moved && fromCover < cover.r + grid * 0.5)));
    if (there || !moved || s.t > 5) {
      s.v = 0;
      s.emerging = false;
      if (s.mode === 'race' && there && trees[s.tree]) { s.mode = 'hide'; s.wait = between(random, 8, 25); } else { s.mode = 'forage'; s.wait = between(random, 0.8, 3); }
    }
    return s;
  }
  s.v = 0; s.wait -= dt;
  if (s.wait <= 0) {
    const reach = between(random, 0.8, 2.2) * grid, far = home && Math.hypot(home.x - s.x, home.y - s.y) > home.r + grid * 3.5, way = far ? Math.atan2(home.y - s.y, home.x - s.x) : random() * TAU;
    s.mode = 'dash'; s.t = 0; s.tx = s.x + Math.cos(way) * reach; s.ty = s.y + Math.sin(way) * reach;
  }
  return s;
}

// One step of a snake (pure): lies still a long while, slides slowly on a little, and from anyone within a couple of squares or a noise goes off quickly the other way. Modes 'lie', 'slide', 'flee'.
export function snakeStep(snake, { dt = 1 / 60, grid = 100, near = [], ok = () => true, within = () => true, blocked = () => false, noise = null, scare = false, time = 0, random = Math.random } = {}) {
  const s = { ...snake }, free = (nx, ny) => !blocked({ x: s.x, y: s.y }, { x: nx, y: ny }) && (within(nx, ny) || !within(s.x, s.y)) && (ok(nx, ny) || !ok(s.x, s.y));
  const danger = noise ?? near.find((t) => Math.hypot(t.x - s.x, t.y - s.y) < grid * 2);
  if (s.mode !== 'flee' && (danger || scare)) { s.mode = 'flee'; s.t = 0; s.way = danger ? Math.atan2(s.y - danger.y, s.x - danger.x) : random() * TAU; }
  const forward = (speed) => { const nx = s.x + Math.sin(s.a) * speed * dt, ny = s.y - Math.cos(s.a) * speed * dt; if (!free(nx + Math.sin(s.a) * grid * 0.3, ny - Math.cos(s.a) * grid * 0.3)) return false; s.x = nx; s.y = ny; s.gait = (s.gait ?? 0) + (speed * dt) / (grid * 0.9); return true; };
  if (s.mode === 'flee') {
    s.t += dt; s.v = grid * 1.9;
    if (!free(s.x + Math.cos(s.way) * grid * 0.6, s.y + Math.sin(s.way) * grid * 0.6)) { const c = clearWay(s.x, s.y, s.way, grid * 0.9, free); if (c !== null) s.way = c; }
    s.a = turnToward(s.a, s.way + Math.PI / 2, dt * 4); forward(s.v);
    if (s.t > 2.5 && !danger) { s.mode = 'lie'; s.wait = between(random, 6, 20); s.v = 0; }
    return s;
  }
  s.wait -= dt;
  if (s.mode === 'slide') {
    s.v = grid * 0.32; s.want = (s.want ?? s.a) + Math.sin(time * 0.6 + (s.seed ?? 0)) * 0.5 * dt; s.a = turnToward(s.a, s.want, dt * 1.2);
    if (!forward(s.v)) { const c = clearWay(s.x, s.y, s.a - Math.PI / 2, grid * 0.8, free); s.want = c === null ? s.a + 2 : c + Math.PI / 2; }
    if (s.wait <= 0) { s.mode = 'lie'; s.wait = between(random, 8, 25); s.v = 0; }
  } else if (s.wait <= 0) { s.mode = 'slide'; s.wait = between(random, 3, 9); s.want = s.a + between(random, -1, 1); }
  return s;
}

// A butterfly (pure): wanders on a changing curve, faster as it flaps, keeping to where it may be (`ok`).
export function butterflyStep(b, { dt = 1 / 60, grid = 100, ok = () => true, time = 0, random = Math.random } = {}) {
  const f = { ...b }; f.wait -= dt;
  if (f.wait <= 0) { f.wait = between(random, 0.35, 1.3); f.turn = between(random, -2.4, 2.4); }
  f.a += (f.turn ?? 0) * dt;
  const speed = grid * (0.45 + 0.35 * Math.max(0, Math.sin(time * 2.3 + (f.p ?? 0)))), nx = f.x + Math.sin(f.a) * speed * dt, ny = f.y - Math.cos(f.a) * speed * dt;
  if (ok(nx, ny) || !ok(f.x, f.y)) { f.x = nx; f.y = ny; } else f.a += Math.PI;
  return f;
}

// A dragonfly (pure): hangs still, leans round to its next spot over the water (`ok`), then darts there and stops dead.
export function dragonflyStep(d, { dt = 1 / 60, grid = 100, ok = () => true, random = Math.random } = {}) {
  const b = { ...d }; b.hover -= dt;
  if (b.hover <= 0 && !b.dart) {
    const tx = b.x + between(random, -1.5, 1.5) * grid, ty = b.y + between(random, -1.2, 1.2) * grid;
    if (ok(tx, ty)) { b.tx = tx; b.ty = ty; b.want = Math.atan2(ty - b.y, tx - b.x) + Math.PI / 2; b.dart = true; b.lean = 0.16; } else b.hover = 0.2;
  }
  b.a = turnToward(b.a, b.want ?? b.a, dt * 11);
  if (b.dart && (b.lean -= dt) <= 0) { const k = Math.min(1, dt * 7); b.x += (b.tx - b.x) * k; b.y += (b.ty - b.y) * k; if (Math.hypot(b.tx - b.x, b.ty - b.y) < grid * 0.025) { b.dart = false; b.hover = between(random, 0.5, 2.6); } }
  return b;
}

// Where an owl is on its way over (pure): `t` 0-1 across, on a slight bow, leaning into it. { x, y, a }.
export function owlPlace({ cx, cy, way, far, t }) {
  const u = t - 0.5, bow = Math.sin(t * Math.PI) * far * 0.14;
  return { x: cx + Math.cos(way) * far * u - Math.sin(way) * bow, y: cy + Math.sin(way) * far * u + Math.cos(way) * bow, a: way + Math.PI / 2 - Math.cos(t * Math.PI) * 0.22 };
}

// ---- How they look ------------------------------------------------------------------------------------------------------
const picture = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.translate(w / 2, h / 2); x.lineCap = 'round'; x.lineJoin = 'round'; draw(x); return c; };
const blob = (x, fill, cx, cy, rx, ry, rot = 0) => { x.fillStyle = fill; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); x.fill(); };
const leg = (x, s, hipY, footY, lift, w, c) => { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); x.moveTo(s * 11, hipY); x.quadraticCurveTo(s * (15 + lift * 3), (hipY + footY) / 2, s * (14 + lift * 2), footY); x.stroke(); };
// A deer from above, facing up. feet [front left, front right, hind left, hind right]: how far ahead of the hip each foot is, how lifted.
function deerPicture({ buck = false, feet, stretch = 1, neck = 50, headX = 0, flag = 0 }) {
  return picture(150, 210, (x) => {
    const [fl, fr, hl, hr] = feet, fh = -24 * stretch, hh = 24 * stretch, tone = '#4a3825';
    leg(x, -1, fh, fh - fl[0], fl[1], 3.8, tone); leg(x, 1, fh, fh - fr[0], fr[1], 3.8, tone); leg(x, -1, hh, hh - hl[0], hl[1], 4.4, tone); leg(x, 1, hh, hh - hr[0], hr[1], 4.4, tone);
    x.save(); x.scale(1, stretch);
    const coat = x.createLinearGradient(-20, 0, 20, 0); coat.addColorStop(0, '#6e5236'); coat.addColorStop(0.5, '#a57f54'); coat.addColorStop(1, '#6a4f34');
    x.fillStyle = coat; x.beginPath(); x.moveTo(0, -38); x.bezierCurveTo(17, -36, 19, -8, 17, 16); x.bezierCurveTo(16, 34, 8, 42, 0, 42); x.bezierCurveTo(-8, 42, -16, 34, -17, 16); x.bezierCurveTo(-19, -8, -17, -36, 0, -38); x.fill();
    blob(x, 'rgba(60,42,26,0.45)', 0, 2, 3.2, 36); blob(x, '#e4dccb', 0, 37, 8, 7); x.restore();
    blob(x, flag > 0.5 ? '#f5f1e6' : '#7c5c3b', 0, 40 * stretch + 4 + flag * 3, 3.2, 5 + flag * 3.5);
    const headY = -neck;
    x.strokeStyle = '#94714a'; x.lineWidth = 11; x.beginPath(); x.moveTo(0, -32 * stretch); x.quadraticCurveTo(headX * 0.3, (headY - 32) / 2, headX, headY + 6); x.stroke();
    x.save(); x.translate(headX, headY); x.rotate(headX * 0.05);
    if (buck) { x.strokeStyle = '#6b5a42'; x.lineWidth = 1.8; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 3, -1); x.quadraticCurveTo(s * 13, 3, s * 18, -8); x.moveTo(s * 11, 1); x.lineTo(s * 14, -10); x.moveTo(s * 15, -3); x.lineTo(s * 21, -3); x.stroke(); } }
    for (const s of [-1, 1]) { blob(x, '#8a6a46', s * 8, 1, 5.4, 2.8, s * 0.5); blob(x, '#c9b190', s * 8, 1, 3.2, 1.5, s * 0.5); }
    blob(x, '#9c784f', 0, -2, 6.6, 9.5); blob(x, '#3a2c20', 0, -11, 2.4, 2); x.restore();
  });
}
const still = [[0, 0], [0, 0], [0, 0], [0, 0]], wave = (p, off) => Math.sin(TAU * (p + off));
// A walk: one foot at a time, hind then front on each side, each lifted as it swings forward.
const walkFeet = (p, reach = 10) => [0.25, 0.75, 0, 0.5].map((off) => [wave(p, off) * reach, Math.max(0, Math.cos(TAU * (p + off)))]);
// A bound: all four gathered under it as it lands, flung out fore and aft in the air.
const boundFeet = (p) => { const e = Math.sin(TAU * p), up = e > 0 ? 1 : 0; return [[16 + e * 20, up], [18 + e * 20, up], [-(16 + e * 22), up], [-(14 + e * 22), up]]; };
// A trot: diagonal pairs of legs together.
const trotFeet = (p, reach = 9) => [0, 0.5, 0.5, 0].map((off) => [wave(p, off) * reach, Math.max(0, Math.cos(TAU * (p + off)))]);
const herdArt = (buck) => ({
  walk: Array.from({ length: 8 }, (_, i) => deerPicture({ buck, feet: walkFeet(i / 8), neck: 50 + Math.sin((TAU * i) / 4) * 2, headX: Math.sin((TAU * i) / 8) * 1.4 })),
  bound: Array.from({ length: 8 }, (_, i) => { const e = Math.sin((TAU * i) / 8); return deerPicture({ buck, feet: boundFeet(i / 8), stretch: 1 + e * 0.07, neck: 55 + e * 6, flag: 1 }); }),
  graze: Array.from({ length: 6 }, (_, i) => deerPicture({ buck, feet: still, neck: 64, headX: Math.sin((TAU * i) / 6) * 4.5 })),
  rise: Array.from({ length: 5 }, (_, i) => deerPicture({ buck, feet: still, neck: 64 - i * 3.5 })),
  look: [-5, -2.5, 0, 2.5, 5].map((headX) => deerPicture({ buck, feet: still, neck: 50, headX })),
});
// A fox from above, facing up. low: crouched, legs wide and the brush straight back. sway: brush and body swinging with the trot.
function foxPicture({ feet = still, low = 0, sway = 0, long = 26, head = 0 }) {
  return picture(110, 190, (x) => {
    const [fl, fr, hl, hr] = feet, fh = -14, hh = 16;
    const paw = (s, hip, f) => { x.strokeStyle = '#2a211b'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(s * 8, hip); x.quadraticCurveTo(s * (11 + low * 4), hip - f[0] / 2, s * (9 + low * 5 + f[1] * 2), hip - f[0]); x.stroke(); };
    paw(-1, fh, fl); paw(1, fh, fr); paw(-1, hh, hl); paw(1, hh, hr);
    const tail = 38 + low * 8, tx = sway * 8;
    x.fillStyle = '#a4552a'; x.beginPath(); x.moveTo(-5, 22); x.quadraticCurveTo(-11 + tx * 0.5, 22 + tail * 0.6, tx, 22 + tail); x.quadraticCurveTo(11 + tx * 0.5, 22 + tail * 0.6, 5, 22); x.fill();
    blob(x, '#eee7da', tx * 0.95, 22 + tail - 3, 4.6, 8);
    const coat = x.createLinearGradient(-12, 0, 12, 0); coat.addColorStop(0, '#8d4522'); coat.addColorStop(0.5, '#c06a34'); coat.addColorStop(1, '#8a4321'); x.fillStyle = coat;
    const bend = -sway * 2.2, wide = 1 + low * 0.12;
    x.beginPath(); x.moveTo(bend, -long); x.bezierCurveTo(11 * wide + bend, -long + 2, 13 * wide, 0, 11 * wide - bend, 14); x.bezierCurveTo(10 * wide - bend, 24, 5, 27, -bend, 27); x.bezierCurveTo(-5, 27, -10 * wide - bend, 24, -11 * wide - bend, 14); x.bezierCurveTo(-13 * wide, 0, -11 * wide + bend, -long + 2, bend, -long); x.fill();
    blob(x, 'rgba(60,28,12,0.4)', 0, 0, 2.2, long - 4);
    x.save(); x.translate(bend * 1.4 + head, -long - 6 - low * 2);
    for (const s of [-1, 1]) { x.fillStyle = '#6b3519'; x.beginPath(); x.moveTo(s * 3, -1); x.lineTo(s * (8.5 + low * 1.5), 5 + low * 4); x.lineTo(s * 8, -5 + low * 5); x.closePath(); x.fill(); }
    x.fillStyle = '#c87a3f'; x.beginPath(); x.moveTo(0, -13); x.quadraticCurveTo(8, -2, 7, 5); x.quadraticCurveTo(0, 9, -7, 5); x.quadraticCurveTo(-8, -2, 0, -13); x.fill();
    x.fillStyle = '#eee7da'; x.beginPath(); x.moveTo(0, -12); x.quadraticCurveTo(3.4, -6, 3.6, -2); x.lineTo(-3.6, -2); x.quadraticCurveTo(-3.4, -6, 0, -12); x.fill();
    blob(x, '#1d1815', 0, -13, 1.7, 1.5); x.restore();
  });
}
// A wolf from above, facing up, nothing like the fox's slim line: heavy shoulders and a shaggy ruff, a broad blunt head with small ears set wide, thick legs and a short heavy tail, its coat broken by guard hairs. `coat` [side, back, ear, pale].
const WOLF_COATS = [['#4b4b46', '#7c7c74', '#2c2b27', '#a9a698'], ['#3c3c3a', '#62625c', '#232220', '#8f8d83'], ['#5a5549', '#878073', '#37332b', '#b5ad9b']];
function wolfPicture({ feet = still, sway = 0, long = 32, head = 0, low = 0, coat = WOLF_COATS[0] }) {
  return picture(150, 220, (x) => {
    const [fl, fr, hl, hr] = feet, fh = -18, hh = 21, [side, back, ear, pale] = coat, hash = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
    const paw = (s, hip, f) => { const px = s * (17 + low * 5 + f[1] * 2), py = hip - f[0]; x.strokeStyle = '#25231f'; x.lineWidth = 5.5; x.beginPath(); x.moveTo(s * 12, hip); x.quadraticCurveTo(s * (17 + low * 4), hip - f[0] / 2, px, py); x.stroke(); blob(x, '#1d1b18', px, py, 3.6, 4.4); };
    paw(-1, fh, fl); paw(1, fh, fr); paw(-1, hh, hl); paw(1, hh, hr);
    const tx = sway * 6;
    x.fillStyle = side; x.beginPath(); x.moveTo(-6, 29); x.bezierCurveTo(-11 + tx * 0.4, 38, -9 + tx, 54, tx, 58); x.bezierCurveTo(9 + tx, 54, 11 + tx * 0.4, 38, 6, 29); x.fill();
    blob(x, '#201e1a', tx, 54, 5, 5.5);
    const fur = x.createLinearGradient(-20, 0, 20, 0); fur.addColorStop(0, side); fur.addColorStop(0.5, back); fur.addColorStop(1, side); x.fillStyle = fur;
    const bend = -sway * 2.2;
    x.beginPath(); x.moveTo(bend, -long); x.bezierCurveTo(16 + bend, -long, 21, -20, 18, -6); x.bezierCurveTo(16, 8, 14 - bend, 18, 12 - bend, 26); x.bezierCurveTo(8, 33, -8, 33, -12 - bend, 26); x.bezierCurveTo(-14 - bend, 18, -16, 8, -18, -6); x.bezierCurveTo(-21, -20, -16 + bend, -long, bend, -long); x.fill();
    x.fillStyle = 'rgba(22,21,18,0.5)'; x.beginPath(); x.moveTo(bend, -long + 6); x.bezierCurveTo(12, -20, 9, 6, 6, 24); x.quadraticCurveTo(0, 29, -6, 24); x.bezierCurveTo(-9, 6, -12, -20, bend, -long + 6); x.fill();
    // Guard hairs, the same on every picture of it, so the coat does not crawl.
    x.lineWidth = 1.3; for (let i = 0; i < 90; i++) { const u = hash(i) * 2 - 1, v = hash(i + 200), hy = -long + 4 + v * (long + 26), hw = 17 - Math.abs(hy + 8) * 0.14, hx = u * Math.max(4, hw); x.strokeStyle = hash(i + 400) < 0.55 ? 'rgba(18,17,15,0.42)' : 'rgba(205,200,185,0.28)'; x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx + u * 2.2, hy + 5); x.stroke(); }
    // The ruff round the neck, in tufts.
    x.fillStyle = back; x.beginPath(); for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU, r = i % 2 ? 19 : 15; const px = Math.cos(a) * r + bend, py = -long + 2 + Math.sin(a) * r * 0.72; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); x.fill();
    blob(x, 'rgba(22,21,18,0.38)', bend, -long + 3, 7, 8);
    x.save(); x.translate(bend * 1.4 + head, -long - 7 - low * 2);
    for (const s of [-1, 1]) blob(x, ear, s * 10, 0, 3.6, 4.6, s * 0.4);
    x.fillStyle = back; x.beginPath(); x.moveTo(-5, -19); x.quadraticCurveTo(0, -21, 5, -19); x.quadraticCurveTo(6, -13, 11, -8); x.quadraticCurveTo(14, 2, 8, 8); x.quadraticCurveTo(0, 11, -8, 8); x.quadraticCurveTo(-14, 2, -11, -8); x.quadraticCurveTo(-6, -13, -5, -19); x.fill();
    for (const s of [-1, 1]) blob(x, pale, s * 8, -2, 3, 5, s * 0.25);
    x.strokeStyle = 'rgba(20,19,16,0.55)'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(0, -17); x.lineTo(0, 4); x.stroke();
    blob(x, '#100f0d', 0, -19, 3.4, 2.4); x.restore();
  });
}
// A squirrel from above, facing up: small and quick, a big bushy tail held out behind. `stride` -1 to 1 through its bound; `flick` the tail to one side.
const SQUIRREL_COATS = [['#6f3d1e', '#a8622f', '#8f4f28', '#5b3219'], ['#55524c', '#8b877d', '#6d6a62', '#3f3d38']];
function squirrelPicture({ stride = 0, flick = 0, coat = SQUIRREL_COATS[0] }) {
  return picture(90, 130, (x) => {
    const [side, back, tail, ear] = coat, hash = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); }, tx = flick * 5;
    // The tail: one full soft shape, darker at its edge, paler down the middle, with only fine fur over it and a slightly broken outline.
    const shape = (w, top, end) => { x.beginPath(); x.moveTo(-3, top); x.bezierCurveTo(-w + tx * 0.5, top + 5, -w + tx, end - 9, tx, end); x.bezierCurveTo(w + tx, end - 9, w + tx * 0.5, top + 5, 3, top); x.closePath(); x.fill(); };
    x.fillStyle = side; shape(12.5, 8, 41); x.fillStyle = tail; shape(10, 9, 38); x.fillStyle = back; shape(5.5, 11, 33);
    x.lineWidth = 0.9; for (let i = 0; i < 90; i++) { const v = hash(i), u = hash(i + 90) * 2 - 1, y = 12 + v * 25, w = 11 * Math.sin((v * 0.85 + 0.12) * Math.PI), px = u * w + tx * v; x.strokeStyle = hash(i + 170) < 0.5 ? 'rgba(28,17,9,0.3)' : 'rgba(240,220,190,0.2)'; x.beginPath(); x.moveTo(px, y); x.lineTo(px + u * 1.6, y + 3.4); x.stroke(); }
    x.strokeStyle = '#2c1c10'; x.lineWidth = 2.3; for (const [s, h, p] of [[-1, -6, 1], [1, -6, 1], [-1, 6, -1], [1, 6, -1]]) { x.beginPath(); x.moveTo(s * (h > 0 ? 5 : 3.5), h); x.lineTo(s * (h > 0 ? 8.5 : 6.5), h - stride * p * 4); x.stroke(); }
    // A rounded body, fuller at the haunches, narrowing to the shoulders.
    const fur = x.createLinearGradient(-8, 0, 8, 0); fur.addColorStop(0, side); fur.addColorStop(0.5, back); fur.addColorStop(1, side); x.fillStyle = fur;
    x.beginPath(); x.moveTo(0, -11); x.bezierCurveTo(5, -11, 5.5, -3, 7.5, 3); x.bezierCurveTo(9, 9, 5, 12, 0, 12); x.bezierCurveTo(-5, 12, -9, 9, -7.5, 3); x.bezierCurveTo(-5.5, -3, -5, -11, 0, -11); x.fill();
    x.lineWidth = 0.9; for (let i = 0; i < 28; i++) { const u = hash(i + 300) * 2 - 1, y = -8 + hash(i + 340) * 18, w = 3.5 + (y + 8) * 0.2; x.strokeStyle = hash(i + 380) < 0.5 ? 'rgba(30,18,10,0.3)' : 'rgba(235,210,175,0.18)'; x.beginPath(); x.moveTo(u * w, y); x.lineTo(u * w, y + 3); x.stroke(); }
    blob(x, back, 0, -14, 4.6, 5.6); for (const s of [-1, 1]) blob(x, ear, s * 3.4, -16.5, 1.3, 2); blob(x, '#150f0a', 0, -19, 1.1, 1);
  });
}
const squirrelArt = () => SQUIRREL_COATS.map((coat) => ({ sit: [-1, 0, 1].map((flick) => squirrelPicture({ coat, flick })), run: [-1, 0, 1, 0].map((stride) => squirrelPicture({ coat, stride, flick: stride * 0.3 })) }));
// A snake from above, its head up the picture, its body in waves behind (`phase` through them; `amp` how wide). Bands along its back.
const SNAKE_COATS = [['#4c4a2a', '#2c2a16', '#5a5730'], ['#5a4a33', '#30261a', '#6a5a40']];
function snakePicture({ phase = 0, amp = 13, coat = SNAKE_COATS[0] }) {
  return picture(80, 280, (x) => {
    const n = 44, step = 5.4, at = (i) => [Math.sin(i * 0.3 - phase * TAU) * amp * Math.min(1, 0.3 + i / 16), -100 + i * step], width = (i) => (i < 3 ? 6.5 + i * 0.5 : Math.max(1.1, 8.5 - (i / n) * 7.4)), hash = (v) => { const h = Math.sin(v * 12.9898) * 43758.5453; return h - Math.floor(h); };
    // One smooth body: its dark edge, then its colour along the middle of it.
    const along = (w, colour) => { x.strokeStyle = colour; for (let i = n - 1; i > 0; i--) { const [ax, ay] = at(i), [bx, by] = at(i - 1); x.lineWidth = w(i); x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); } };
    along(width, coat[1]); along((i) => width(i) * 0.72, coat[0]);
    // Small dark marks down its back, a little uneven, a fleck or two of light between: no bands.
    for (let i = 3; i < n - 3; i += 2) { const [ax, ay] = at(i), [bx, by] = at(i + 1), a = Math.atan2(by - ay, bx - ax), w = width(i); x.save(); x.translate(ax, ay); x.rotate(a); blob(x, coat[1], 0, (hash(i) - 0.5) * w * 0.15, 1.9, w * 0.2); if (hash(i + 50) > 0.5) blob(x, coat[2], 3.4, w * 0.22 * (hash(i + 70) < 0.5 ? -1 : 1), 0.9, 0.5); x.restore(); }
    const [hx, hy] = at(0); x.save(); x.translate(hx, hy); x.fillStyle = coat[1]; x.beginPath(); x.moveTo(0, -10); x.quadraticCurveTo(6.5, -3, 4.5, 5); x.lineTo(-4.5, 5); x.quadraticCurveTo(-6.5, -3, 0, -10); x.fill(); x.fillStyle = coat[0]; x.beginPath(); x.moveTo(0, -8.6); x.quadraticCurveTo(4.6, -2.5, 3.2, 4); x.lineTo(-3.2, 4); x.quadraticCurveTo(-4.6, -2.5, 0, -8.6); x.fill(); blob(x, '#12100a', -2.9, -3, 0.9, 0.9); blob(x, '#12100a', 2.9, -3, 0.9, 0.9); x.restore();
  });
}
const snakeArt = () => SNAKE_COATS.map((coat) => ({ go: Array.from({ length: 8 }, (_, i) => snakePicture({ coat, phase: i / 8 })), lie: [snakePicture({ coat, phase: 0.1, amp: 17 })] }));
const wolfArt = () => WOLF_COATS.map((coat) => ({
  trot: Array.from({ length: 8 }, (_, i) => wolfPicture({ coat, feet: trotFeet(i / 8, 11), sway: Math.sin((TAU * i) / 8) })),
  run: Array.from({ length: 8 }, (_, i) => wolfPicture({ coat, feet: boundFeet(i / 8).map(([a, b]) => [a * 0.7, b]), sway: Math.sin((TAU * i) / 8) * 0.4, long: 34 + Math.sin((TAU * i) / 8) * 3 })),
  rest: [wolfPicture({ coat, low: 1, long: 28 })],
}));
const foxArt = () => ({
  trot: Array.from({ length: 8 }, (_, i) => foxPicture({ feet: trotFeet(i / 8), sway: Math.sin((TAU * i) / 8) })),
  run: Array.from({ length: 8 }, (_, i) => foxPicture({ feet: boundFeet(i / 8).map(([a, b]) => [a * 0.62, b]), sway: Math.sin((TAU * i) / 8) * 0.4, long: 28 + Math.sin((TAU * i) / 8) * 3 })),
  stalk: Array.from({ length: 8 }, (_, i) => foxPicture({ feet: walkFeet(i / 8, 5), low: 1, sway: Math.sin((TAU * i) / 8) * 0.15 })),
  coil: foxPicture({ feet: [[4, 0], [4, 0], [10, 0], [10, 0]], low: 1.3, long: 21 }), leap: foxPicture({ feet: [[24, 1], [24, 1], [-18, 1], [-18, 1]], long: 36 }),
  land: foxPicture({ feet: [[6, 0], [6, 0], [12, 0], [12, 0]], low: 0.8, long: 25 }), look: foxPicture({ low: 0.2, head: 2 }),
});
function butterflyPicture(open, c) {
  return picture(48, 48, (x) => {
    for (const s of [-1, 1]) { x.save(); x.scale(s * (0.18 + 0.82 * open), 1);
      x.fillStyle = c[0]; x.beginPath(); x.moveTo(1, -2); x.bezierCurveTo(9, -15, 18, -12, 15, -2); x.bezierCurveTo(14, 2, 7, 2, 1, 1); x.fill();
      x.fillStyle = c[1]; x.beginPath(); x.moveTo(1, 1); x.bezierCurveTo(9, 2, 13, 5, 10, 10); x.bezierCurveTo(7, 13, 3, 8, 1, 3); x.fill();
      x.strokeStyle = c[2]; x.lineWidth = 1; x.beginPath(); x.moveTo(1, -2); x.bezierCurveTo(9, -15, 18, -12, 15, -2); x.stroke(); blob(x, c[2], 12, -7, 1.3, 1.3); x.restore(); }
    blob(x, '#1f1a16', 0, 0, 1, 5);
  });
}
function dragonflyPicture(flick, c) {
  return picture(64, 64, (x) => {
    x.globalAlpha = 0.34 + flick * 0.16; x.fillStyle = '#d7e6e8'; for (const [dy, rot, len] of [[-6, 0.16, 22], [-1, -0.08, 20]]) for (const s of [-1, 1]) { x.save(); x.translate(0, dy); x.rotate(s * (rot + flick * 0.12)); x.beginPath(); x.ellipse(s * len * 0.55, 0, len * 0.55, 2.6, 0, 0, TAU); x.fill(); x.restore(); }
    x.globalAlpha = 1; x.strokeStyle = c; x.lineWidth = 1.7; x.beginPath(); x.moveTo(0, -5); x.lineTo(0, 22); x.stroke(); blob(x, c, 0, -7, 2.6, 3.6); blob(x, '#26332f', 0, -11, 2.8, 2);
  });
}
function owlPicture(span) {
  return picture(220, 150, (x) => {
    for (const s of [-1, 1]) {
      const reach = 90 * (0.45 + 0.55 * span), lift = 8 * (1 - span);
      for (let i = 0; i < 10; i++) { const f = i / 9, bx = s * (6 + (reach - 6) * f), by = -7 + lift * f + 4 * f * f, len = 24 + 12 * Math.sin(f * 2.6), ang = Math.PI / 2 + s * (-0.03 - 0.5 * f * f); x.save(); x.translate(bx, by); x.rotate(ang); const fg = x.createLinearGradient(0, 0, len, 0); fg.addColorStop(0, '#6c5a44'); fg.addColorStop(0.6, '#8b7458'); fg.addColorStop(1, '#4a3b2c'); x.fillStyle = fg; x.beginPath(); x.ellipse(len / 2, 0, len / 2, 5.4, 0, 0, TAU); x.fill(); for (let n = 1; n < 3; n++) blob(x, 'rgba(232,216,184,0.3)', (len * n) / 3, 0, 1.6, 3.4); x.restore(); }
      x.fillStyle = '#7a664d'; x.beginPath(); x.moveTo(s * 3, -10); x.quadraticCurveTo(s * reach * 0.55, -16 + lift, s * reach, -7 + lift); x.quadraticCurveTo(s * reach * 0.5, 2 + lift, s * 3, 5); x.closePath(); x.fill();
    }
    blob(x, '#6a5842', 0, 19, 9.5, 12); const body = x.createRadialGradient(-2, -2, 1, 0, 2, 16); body.addColorStop(0, '#9a8468'); body.addColorStop(1, '#5e4d3a'); x.fillStyle = body; x.beginPath(); x.ellipse(0, 3, 11.5, 15, 0, 0, TAU); x.fill();
    blob(x, '#74614a', 0, -13, 11, 10); blob(x, '#cdbb9d', -4.4, -16, 4.6, 5); blob(x, '#cdbb9d', 4.4, -16, 4.6, 5); blob(x, '#14110e', -4.2, -17, 1.7, 1.7); blob(x, '#14110e', 4.2, -17, 1.7, 1.7); x.fillStyle = '#3c3024'; x.beginPath(); x.moveTo(-1.3, -14); x.lineTo(0, -10); x.lineTo(1.3, -14); x.closePath(); x.fill();
  });
}
// A firefly's glow, the middle of it bright.
const fireflyPicture = () => picture(64, 64, (x) => { const g = x.createRadialGradient(0, 0, 0, 0, 0, 32); g.addColorStop(0, 'rgba(232,245,130,1)'); g.addColorStop(0.22, 'rgba(190,222,80,0.55)'); g.addColorStop(1, 'rgba(140,190,40,0)'); x.fillStyle = g; x.fillRect(-32, -32, 64, 64); });
const WINGS = [['#c9702e', '#a9591f', '#2a1c12'], ['#dcd9c6', '#c9c5ae', '#4f4b3e'], ['#c9b24a', '#ad9636', '#3e3518']];

// The lights the bats hunt round (pure): a lamp that stays put and draws insects, out in the open (`open(light)`, indoors false);
// never a light someone carries (`carried`: a token's torch), which walks off before anything gathers at it.
export const batLamps = (lights = [], open = () => true) => lights.filter((l) => !l.carried && open(l));

/**
 * The layer: populate({ spots, waters, wolves, wolfSize, deer, foxes, butterflies, dragonflies, fireflies, owl, grid, area, deerSize, foxSize, insectSize, birdSize, batSize });
 * tick(seconds, { near, ok(kind, x, y), blocked, seen(x, y), day, night, warm, sun, view, sound(kind, at, urgent), cast, prey, lamps() });
 * noise({ x, y, radius }); scare(); clear(). `prey`: the rabbits, { list, spook(rabbit, from), take(rabbit) } (wildlife.mjs).
 */
export function createFieldLife({ PIXI, floor, sky, glow = sky, high = sky, highShadow = floor, restyle = null }) {
  let trees = [], squirrels = [], snakes = [], squirrelSize = 1, snakeSize = 1, packFeeds = 0, fetchIn = 0, deerIn = 0, wolves = [], wolfSize = 1, deer = [], foxes = [], flies = [], drags = [], lights = [], bats = [], owl = null, noises = [], spots = [], homes = {}, area = null, grid = 100, deerSize = 1, foxSize = 1, insectSize = 1, birdSize = 1, batSize = 1, time = 0, scared = 0, shownDay = 0, look = 0, art = {};
  const texOf = (c) => PIXI.Texture.from(c), group = (o, f) => (Array.isArray(o) ? o.map(f) : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, group2(v, f)]))), group2 = (v, f) => (Array.isArray(v) ? v.map(f) : f(v));
  const lazily = (key, make) => { const had = art[key]; const sample = had && (had.doe?.look?.[0] ?? had.trot?.[0] ?? had[0]?.[0] ?? had[0]); if (!had || sample?.baseTexture?.destroyed) art[key] = make(); return art[key]; };
  // Each set in the painted look where it has been baked (animal-art.mjs `restyle`, given by main), else as drawn here.
  const styled = (set, prefix) => (restyle ? restyle('field', set, prefix) : set);
  const herd = () => lazily('herd', () => styled({ doe: group(herdArt(false), texOf), stag: group(herdArt(true), texOf) }, 'herd'));
  const foxTex = () => lazily('fox', () => styled(group(foxArt(), texOf), 'fox'));
  const wolfTex = () => { const had = art.wolf; if (!had || had[0].trot[0]?.baseTexture?.destroyed) art.wolf = styled(wolfArt().map((set) => group(set, texOf)), 'wolf'); return art.wolf; };
  const squirrelTex = () => { const had = art.squirrel; if (!had || had[0].sit[0]?.baseTexture?.destroyed) art.squirrel = styled(squirrelArt().map((set) => group(set, texOf)), 'squirrel'); return art.squirrel; };
  const snakeTex = () => { const had = art.snake; if (!had || had[0].lie[0]?.baseTexture?.destroyed) art.snake = styled(snakeArt().map((set) => group(set, texOf)), 'snake'); return art.snake; };
  const newSquirrel = (p, i, random, placed) => ({ x: p.x, y: p.y, a: random() * TAU, mode: 'forage', wait: between(random, 0.5, 3), tree: p.tree ?? -1, t: 0, v: 0, gait: 0, coat: i % SQUIRREL_COATS.length, seed: random() * 6, ...(placed ? { placed } : {}), ...pair(floor(), squirrelTex()[i % SQUIRREL_COATS.length].sit[1]) });
  const newSnake = (p, i, random, placed) => ({ x: p.x, y: p.y, a: random() * TAU, want: 0, mode: 'lie', wait: between(random, 2, 15), t: 0, v: 0, gait: random(), coat: i % SNAKE_COATS.length, seed: random() * 6, ...(placed ? { placed } : {}), ...pair(floor(), snakeTex()[i % SNAKE_COATS.length].lie[0]) });
  const newWolf = (p, i, random, placed) => { const a0 = random() * TAU; return { x: p.x, y: p.y, a: a0, want: a0, mode: 'trot', t: 0, wait: between(random, 4, 10), v: 0, gait: random(), seed: i, coat: i % WOLF_COATS.length, ...(placed ? { placed } : {}), ...pair(floor(), wolfTex()[i % WOLF_COATS.length].rest[0]) }; };
  const flyTex = () => lazily('fly', () => styled(WINGS.map((c) => [1, 0.75, 0.4, 0.15, 0.4, 0.75].map((o) => texOf(butterflyPicture(o, c)))), 'fly'));
  const dragTex = () => lazily('drag', () => styled(['#2f7f86', '#a2472f'].map((c) => [0, 1, 0.3].map((f) => texOf(dragonflyPicture(f, c)))), 'drag'));
  const owlTex = () => lazily('owl', () => styled([1, 0.9, 0.65, 0.4, 0.65, 0.9].map((s) => texOf(owlPicture(s))), 'owl'));
  const glowTex = () => lazily('glow', () => [texOf(fireflyPicture())]);
  const batTex = () => lazily('bat', () => styled(batWingbeat().map(texOf), 'bat'));
  const sprite = (parent, tex, dark = false) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.eventMode = 'none'; s.visible = false; if (dark) s.tint = 0x000000; parent.addChild(s); return s; };
  const pair = (root, tex) => ({ shadow: sprite(floor(), tex, true), body: sprite(root, tex) });
  const gone = (...list) => { for (const s of list) { try { s?.destroy(); } catch { /* gone */ } } };
  const drop = () => {
    for (const o of [...squirrels, ...snakes, ...wolves, ...deer, ...foxes, ...flies, ...drags, ...bats, ...(owl ? [owl] : [])]) gone(o.body, o.shadow, o.carry);
    for (const o of lights) gone(o.body);
    squirrels = []; snakes = []; wolves = []; deer = []; foxes = []; flies = []; drags = []; lights = []; bats = []; owl = null;
  };
  const put = (s, tex, x, y, angle, size, alpha) => { s.visible = true; s.texture = tex; s.position.set(x, y); s.rotation = angle; s.scale.set(size); s.alpha = alpha; };
  const hide = (o) => { o.body.visible = false; o.shadow.visible = false; if (o.carry) o.carry.visible = false; };
  // Where a wolf, squirrel or snake may be, by its own keep-out regions; anywhere else if none is left.
  // On the map (its scene rectangle, `area`), a little in from its edge: a squirrel or snake never leaves it, fleeing or not.
  const onMap = (x, y) => !area || (x > area.x + grid * 0.2 && y > area.y + grid * 0.2 && x < area.x + area.width - grid * 0.2 && y < area.y + area.height - grid * 0.2);
  const homeOf = (kind, land = spots) => (homes[kind]?.length ? homes[kind] : land);
  return {
    populate({ spots: land = [], homes: own = {}, waters = [], glowWaters = waters, trees: treeList = [], squirrels: nSquirrels = 0, squirrelSize: qs = 1, snakes: nSnakes = 0, snakeSize: ss = 1, wolves: nWolves = 0, wolfSize: ws = 1, deer: nDeer = 0, foxes: nFoxes = 0, butterflies = 0, dragonflies = 0, fireflies = 0, owl: hasOwl = false, grid: g = 100, area: a = null, deerSize: ds = 1, foxSize: fs = 1, insectSize: is = 1, birdSize: bs = 1, batSize: bats_ = 1, blocked = () => false, random = Math.random } = {}) {
      drop(); deerIn = 0; packFeeds = 0; homes = own; trees = treeList; squirrelSize = qs; snakeSize = ss; grid = g; area = a; spots = land; wolfSize = ws; deerSize = ds; foxSize = fs; insectSize = is; birdSize = bs; batSize = bats_; shownDay = 0;
      const pick = (list) => list[Math.floor(random() * list.length)], jitter = (p, r) => ({ x: p.x + between(random, -r, r) * g, y: p.y + between(random, -r, r) * g });
      if (nDeer && land.length) { const t = herd(), home = pick(land), near = land.filter((p) => Math.hypot(p.x - home.x, p.y - home.y) < g * 5); deer = Array.from({ length: nDeer }, (_, i) => ({ ...pick(near), a: random() * TAU, mode: 'graze', wait: between(random, 1, 5), buck: i === 0, t: 0, way: 0, want: 0, v: 0, gait: random(), lift: random() < 0.5 ? 0 : 1, h: 0, step: random() * 6, ...pair(floor(), t.doe.look[0]) })); }
      if (nSquirrels && land.length) squirrels = Array.from({ length: nSquirrels }, (_, i) => { const tree = trees.length ? i % trees.length : -1, home = trees[tree], way = random() * TAU, at = home ? { x: home.x + Math.cos(way) * home.r * 1.2, y: home.y + Math.sin(way) * home.r * 1.2 } : pick(homeOf('squirrels', land)); return newSquirrel({ ...at, tree }, i, random); });
      if (nSnakes && land.length) snakes = Array.from({ length: nSnakes }, (_, i) => newSnake(pick(homeOf('snakes', land)), i, random));
      const inside = (v, from, size) => Math.max(from + g, Math.min(from + size - g, v));
      if (nWolves && land.length) { const range = homeOf('wolves', land), home = pick(range), near = range.filter((p) => Math.hypot(p.x - home.x, p.y - home.y) < g * 4); const way = edgeArrival(range, a, { grid: g, blocked, random }); wolves = Array.from({ length: nWolves }, (_, i) => (way ? { ...newWolf({ x: way.from.x + between(random, -0.8, 0.8) * g, y: way.from.y + between(random, -0.8, 0.8) * g }, i, random), mode: 'arrive', clear: g * 1.8, tx: inside(way.to.x + between(random, -1, 1) * g, a.x, a.width), ty: inside(way.to.y + between(random, -1, 1) * g, a.y, a.height) } : newWolf(pick(near), i, random))); }
      if (nFoxes && land.length) { const t = foxTex(); foxes = Array.from({ length: nFoxes }, () => { const a0 = random() * TAU; return { ...pick(land), a: a0, want: a0, mode: 'trot', t: 0, wait: between(random, 3, 8), v: 0, gait: 0, way: 0, h: 0, seed: random() * 6, ...pair(floor(), t.look) }; }); }
      const bugLand = own.butterflies ?? land, glowLand = own.fireflies ?? land;
      if (butterflies && bugLand.length) { const t = flyTex(); flies = Array.from({ length: butterflies }, (_, i) => ({ ...pick(bugLand), a: random() * TAU, wait: 0, turn: 0, c: i % t.length, p: random() * 6, ...pair(sky(), t[0][0]) })); }
      if (dragonflies && waters.length) { const t = dragTex(); drags = Array.from({ length: dragonflies }, (_, i) => ({ ...pick(waters), a: random() * TAU, hover: random() * 2, c: i % t.length, p: random() * 6, ...pair(sky(), t[0][0]) })); }
      if (fireflies && (glowLand.length || glowWaters.length)) { const t = glowTex(), from = glowLand.concat(glowWaters); lights = Array.from({ length: fireflies }, () => { const s = sprite(glow(), t[0]); s.blendMode = PIXI.BLEND_MODES.ADD; return { ...jitter(pick(from), 0.45), a: random() * TAU, p: random() * 9, every: between(random, 1.8, 3.6), body: s }; }); }
      if (hasOwl && a) { const t = owlTex(); owl = { t: 1, wait: between(random, 8, 30), way: 0, cx: 0, cy: 0, far: 0, body: sprite(high(), t[0]), shadow: sprite(highShadow(), t[0], true) }; }
    },
    // The walls changed: new places to come back to, and any shut in go there, a herd near one place. A fox set down mid-hunt
    // forgets it: its spring was aimed from where it was.
    // One put down by hand: `kind` 'deer', 'fox', 'wolf', 'squirrel' or 'snake', `id` to take it away by. False for any other kind.
    add(kind, { x, y, id }, random = Math.random) {
      if (kind === 'deer') { const t = herd(); deer.push({ x, y, a: random() * TAU, mode: 'graze', wait: between(random, 1, 5), buck: false, t: 0, way: 0, want: 0, v: 0, gait: random(), lift: random() < 0.5 ? 0 : 1, h: 0, step: random() * 6, placed: id, ...pair(floor(), t.doe.look[0]) }); return true; }
      if (kind === 'squirrel') { const near = trees.reduce((best, t, i) => (best < 0 || Math.hypot(t.x - x, t.y - y) < Math.hypot(trees[best].x - x, trees[best].y - y) ? i : best), -1); squirrels.push(newSquirrel({ x, y, tree: near }, squirrels.length, random, id)); return true; }
      if (kind === 'snake') { snakes.push(newSnake({ x, y }, snakes.length, random, id)); return true; }
      if (kind === 'wolf') { wolves.push(newWolf({ x, y }, wolves.length, random, id)); return true; }
      if (kind === 'fox') { const t = foxTex(), a0 = random() * TAU; foxes.push({ x, y, a: a0, want: a0, mode: 'trot', t: 0, wait: between(random, 3, 8), v: 0, gait: 0, way: 0, h: 0, seed: random() * 6, placed: id, ...pair(floor(), t.look) }); return true; }
      return false;
    },
    removeAdded(id) {
      const leave = (o) => { if (o.placed !== id) return true; gone(o.body, o.shadow, o.carry); return false; };
      deer = deer.filter(leave); foxes = foxes.filter(leave); wolves = wolves.filter(leave); squirrels = squirrels.filter(leave); snakes = snakes.filter(leave);
    },
    resettle({ spots: land = [], homes: own = {}, closed = () => false, random = Math.random } = {}) {
      spots = land; homes = own; if (!land.length) return;
      const home = land[Math.floor(random() * land.length)], near = land.filter((p) => Math.hypot(p.x - home.x, p.y - home.y) < grid * 5);
      deer = resettled(deer, { spots: near, closed, random });
      const wolfLand = homeOf('wolves', land), wolfHome = wolfLand[Math.floor(random() * wolfLand.length)];
      wolves = resettled(wolves, { spots: wolfLand.filter((p) => Math.hypot(p.x - wolfHome.x, p.y - wolfHome.y) < grid * 5), closed, random });
      snakes = resettled(snakes, { spots: homeOf('snakes', land), closed, random });
      squirrels = resettled(squirrels, { spots: homeOf('squirrels', land), closed, random });
      foxes = foxes.map((f) => { const [o] = resettled([f], { spots: land, closed, random }); return o === f || f.mode === 'flee' || f.mode === 'carry' || f.mode === 'away' ? o : { ...o, mode: 'trot', t: 0, h: 0, wait: 5, v: 0, want: o.a }; });
    },
    runOff({ spots: land = [], homes: own = {}, bad = () => false } = {}) {
      if (!land.length) return;
      spots = land; homes = own; const off = (o, to = land) => (bad(o.x, o.y) ? runsOff(o, { spots: to }) : o);
      deer = deer.map((o) => (o.mode === 'dead' ? o : off(o))); foxes = foxes.map((f) => off(f)); wolves = wolves.map((w) => off(w, homeOf('wolves', land))); snakes = snakes.map((s) => off(s, homeOf('snakes', land)));
      squirrels = squirrels.map((s) => { if (s.mode === 'hide' || !bad(s.x, s.y)) return s; const to = nearestSpot(s.x, s.y, homeOf('squirrels', land)); return to ? { ...s, mode: 'dash', t: 0, tx: to.x, ty: to.y } : s; });
    },
    // The tree tiles changed: each squirrel keeps to the nearest tree now (none, and it is out in the open).
    setTrees(list = []) {
      trees = list;
      squirrels = squirrels.map((s) => ({ ...s, tree: list.reduce((best, t, i) => (best < 0 || Math.hypot(t.x - s.x, t.y - s.y) < Math.hypot(list[best].x - s.x, list[best].y - s.y) ? i : best), -1) }));
    },
    scare() { scared = 0.3; },
    noise({ x, y, radius }) { noises.push({ x, y, r: radius, t: 0 }); },
    tick(seconds, { near = [], ok = () => true, blocked = () => false, kept = () => false, seen = () => true, day = 1, night = 0, warm = true, sun = { x: 0.62, y: 0.78 }, view = null, sound = () => {}, indoors = () => false, canopy = () => false, cast = null, prey = null, lamps = () => [], birdBody = 1, liftShadow = () => {} } = {}) {
      if (!this.busy) return;
      const dt = Math.min(0.05, seconds), k = grid / 100; time += dt; scared = Math.max(0, scared - dt);
      if (noises.length) { for (const n of noises) n.t += dt; noises = noises.filter((n) => n.t * NOISE_SPEED * grid < n.r + grid * 3); }
      const heard = (o) => (noises.length ? noiseReaching(noises, o.x, o.y, { grid }) : null), scare = scared > 0;
      shownDay += Math.max(-dt, Math.min(dt, (day - shownDay) * 2)); const alpha = Math.max(0, Math.min(1, shownDay));
      const fall = shadowKeeper(cast ?? (() => ({ dx: sun.x * grid * 0.03, dy: sun.y * grid * 0.03, alpha: 0.5 })), time);
      look -= dt; const looking = look <= 0; if (looking) look = 0.2;
      const inView = (x, y, m = grid * 2) => !view || (x > view.x - m && y > view.y - m && x < view.x + view.w + m && y < view.y + view.h + m);
      const can = (o, x, y) => { if (looking) { try { o.seen = seen(x, y) !== false; } catch { o.seen = true; } } return o.seen !== false && inView(x, y); };
      // A deer takes fright at a hunting wolf only when it is nearly on it: that is how one gets caught.
      const hunters = wolves.filter((w) => w.mode === 'hunt'), alarmed = (o) => { const close = hunters.filter((w) => Math.hypot(w.x - o.x, w.y - o.y) < grid * 1.5); return close.length ? [...near, ...close] : near; };
      // Wolves keep every hour, by night as by day.
      if (wolves.length) {
        const sets = wolfTex(), fires = lamps(), leaderBefore = wolves[0], prey2 = alpha > 0.01 && deer.filter((d) => d.mode === 'dead').length < 3 ? deer.filter((d) => d.mode !== 'dead') : []; let killed = null, killer = 0;
        wolves = wolves.map((w0, i) => {
          const off = area && (w0.x < area.x || w0.y < area.y || w0.x > area.x + area.width || w0.y > area.y + area.height);
          if (off && ['trot', 'rest', 'flee'].includes(w0.mode)) { const to = nearestSpot(w0.x, w0.y, homeOf('wolves')); if (to) { w0 = { ...w0, mode: 'arrive', t: 0, tx: to.x, ty: to.y }; } }
          const w = wolfStep(w0, { dt, grid, near, blocked: off ? () => false : blocked, kept: (x, y) => kept('wolves', x, y), scare, noise: heard(w0), fires, prey: prey2, leader: i ? leaderBefore : null, time, ok: (x, y) => ok('wolves', x, y) });
          if (!i) { const call = wolfCallNow({ was: w0.mode, mode: w.mode, night, pack: wolves.length, dt }); if (call) sound(call, w, false); }
          { const g = wolfGrowlNow(w, near, grid); w.warned = g.warned; if (g.growl) sound('wolfGrowl', w, true); }
          // Each wolf gets one try in a hunt, when it comes up with one.
          if (w.mode !== 'hunt') w.tried = false;
          else if (!w.tried) { const d = prey2.find((o) => Math.hypot(o.x - w.x, o.y - w.y) < grid); if (d) { w.tried = true; if (Math.random() < 0.4) { killed = d; killer = i; } } }
          if (w.mode === 'away' || !can(w, w.x, w.y)) { hide(w); return w; }
          const set = sets[w.coat], q = (((w.gait ?? 0) % 1) + 1) % 1, frame = w.mode === 'flee' || w.mode === 'hunt' ? set.run[Math.floor(q * 8)] : w.v > 3 ? set.trot[Math.floor(q * 8)] : set.rest[0];
          const size = 0.84 * k * wolfSize, c = fall(w, w.x, w.y, { width: grid * 0.5, body: 0.55, grounded: true });
          put(w.shadow, frame, w.x + c.dx, w.y + c.dy, w.a, size, Math.min(0.5, c.alpha * 0.55)); put(w.body, frame, w.x, w.y, w.a, size, 1);
          return w;
        });
        // A kill: the pack feeds by it, the one that made it first now, and is fed for a good while after. In a while another deer comes along.
        if (killed) { killed.mode = 'dead'; killed.t = 0; killed.h = 0; killed.v = 0; deerIn = between(Math.random, 60, 150); packFeeds = between(Math.random, 12, 20); killed.kill = true; wolves = [wolves[killer], ...wolves.filter((_, i) => i !== killer)].map((w) => ({ ...w, mode: 'rest', wait: 45, v: 0, full: 240 })); }
        // Fed, they haul it off the map if there is a way; walled in, it lies where it is.
        if (packFeeds > 0 && (packFeeds -= dt) <= 0 && wolves[0].mode === 'rest') {
          const out = edgeExit(wolves[0], area, { grid, blocked }), carcass = deer.find((d) => d.mode === 'dead' && d.kill);
          if (out) { const back = between(Math.random, 90, 180), reach = wolfGrip(grid, wolfSize, deerSize); wolves = wolves.map((w, i) => ({ ...w, mode: 'drag', t: 0, tx: out.x + (i ? between(Math.random, -1, 1) * grid : 0), ty: out.y + (i ? between(Math.random, -1, 1) * grid : 0), pulling: i === 0, goingTo: i === 0 && carcass ? { x: carcass.x, y: carcass.y, reach } : null, back })); }
        }
        // A carcass left lying, driven off it or walled in: once at peace they go back for it, and haul it off.
        fetchIn -= dt;
        if (fetchIn <= 0 && packFeeds <= 0 && wolves[0].mode === 'trot') {
          const left = deer.find((d) => d.mode === 'dead' && !d.done);
          if (left) {
            fetchIn = between(Math.random, 8, 20);
            if (Math.hypot(left.x - wolves[0].x, left.y - wolves[0].y) < grid * 1.5) { deer = deer.map((d) => (d.mode === 'dead' ? { ...d, kill: d === left } : d)); packFeeds = between(Math.random, 3, 6); wolves = wolves.map((w) => ({ ...w, mode: 'rest', wait: 45, v: 0 })); }
            // Tried twice and no way round: it forces one, so nothing lies there for good.
            else { left.tries = (left.tries ?? 0) + 1; wolves[0] = { ...wolves[0], mode: 'arrive', t: 0, clear: left.tries > 2 ? Infinity : 0, tx: left.x, ty: left.y }; }
          }
        }
        // Gone a good while: they come back the way anything does, from the edge.
        if (wolves[0].mode === 'away' && wolves[0].t > wolves[0].back && homeOf('wolves').length) {
          const way = edgeArrival(homeOf('wolves'), area, { grid, blocked });
          if (way) wolves = wolves.map((w) => (w.mode === 'away' ? { ...w, mode: 'arrive', t: 0, x: way.from.x + between(Math.random, -0.8, 0.8) * grid, y: way.from.y + between(Math.random, -0.8, 0.8) * grid, clear: grid * 1.8, tx: Math.max(area.x + grid, Math.min(area.x + area.width - grid, way.to.x + between(Math.random, -1, 1) * grid)), ty: Math.max(area.y + grid, Math.min(area.y + area.height - grid, way.to.y + between(Math.random, -1, 1) * grid)), pulling: false } : w));
        }
      }
      if (alpha > 0.01) {
        if (squirrels.length) { const sets = squirrelTex(); squirrels = squirrels.map((s0) => {
          const s = squirrelStep(s0, { dt, grid, near, blocked, scare, noise: heard(s0), trees, ok: (x, y) => ok('squirrels', x, y), within: onMap });
          // A chatter as it races for cover, and now and then a scolding from up in its tree.
          if (s.mode === 'race' && s0.mode !== 'race') sound('squirrelChatter', s, true);
          else if (s.mode === 'hide' && Math.random() < dt * 0.04) sound('squirrelChatter', s, false);
          if (s.mode === 'hide' || !can(s, s.x, s.y)) { hide(s); return s; }
          const set = sets[s.coat], tex = s.v > 3 ? set.run[Math.floor(((s.gait % 1) + 1) % 1 * 4)] : set.sit[Math.round(Math.sin(time * 1.4 + s.seed) * Math.max(0, Math.sin(time * 0.5 + s.seed)) + 1)], size = 0.55 * k * squirrelSize, c = fall(s, s.x, s.y, { width: grid * 0.2, body: 0.12, grounded: true });
          put(s.shadow, tex, s.x + c.dx, s.y + c.dy, s.a, size, Math.min(0.5, c.alpha * 0.55) * alpha); put(s.body, tex, s.x, s.y, s.a, size, alpha);
          return s;
        }); }
        if (snakes.length) { const sets = snakeTex(); snakes = snakes.map((s0) => {
          const s = snakeStep(s0, { dt, grid, near, blocked, scare, noise: heard(s0), time, ok: (x, y) => ok('snakes', x, y), within: onMap });
          // A hiss as it is disturbed; none from a snake gone in out of the cold.
          if (warm && s.mode === 'flee' && s0.mode !== 'flee') sound('snakeHiss', s, true);
          if (!warm || !can(s, s.x, s.y)) { hide(s); return s; }
          const set = sets[s.coat], tex = s.v > 1 ? set.go[Math.floor(((s.gait % 1) + 1) % 1 * 8)] : set.lie[0], size = 0.5 * k * snakeSize;
          put(s.shadow, tex, s.x + sun.x * grid * 0.02, s.y + sun.y * grid * 0.02, s.a, size, 0.25 * alpha); put(s.body, tex, s.x, s.y, s.a, size, alpha);
          return s;
        }); }
        const t = deer.length ? herd() : null;
        deer = deer.map((o0) => {
          // Brought down: it lies there, or goes along in the jaws of the wolf hauling it, and off the map with it. Dropped when that wolf is driven off, it stays where it fell.
          if (o0.mode === 'dead') {
            const o = { ...o0, t: o0.t + dt }, puller = o.kill ? wolves[0] : null;
            if (puller?.mode === 'away') { gone(o.body, o.shadow); o.done = true; return o; }
            if (puller?.pulling && puller.mode === 'drag') { if (!puller.goingTo) { const reach = wolfGrip(grid, wolfSize, deerSize), gx = puller.x + Math.sin(puller.a) * reach, gy = puller.y - Math.cos(puller.a) * reach, ease = Math.min(1, dt * 4); o.x += (gx - o.x) * ease; o.y += (gy - o.y) * ease; o.a = turnToward(o.a, puller.a, dt * 4); } }
            else if (puller?.pulling) o.kill = false;
            if (!can(o, o.x, o.y)) { hide(o); return o; }
            const tex = (o.buck ? t.stag : t.doe).look[0], size = 0.62 * k * deerSize;
            put(o.shadow, tex, o.x + sun.x * grid * 0.03, o.y + sun.y * grid * 0.03, o.a, size, 0.25 * alpha); put(o.body, tex, o.x, o.y, o.a, size, alpha);
            return o;
          }
          const o = deerStep(o0, { dt, grid, near: alarmed(o0), blocked: area && (o0.x < area.x || o0.y < area.y || o0.x > area.x + area.width || o0.y > area.y + area.height) ? () => false : blocked, scare, noise: heard(o0), ok: (x, y) => ok('deer', x, y) });
          // A call as it starts away, and now and then one to the herd as it grazes.
          if (o.mode === 'flee' && o0.mode !== 'flee') sound('deerCall', o, true);
          else if (o.mode !== 'flee' && Math.random() < dt * 0.006) sound('deerCall', o, false);
          if (!can(o, o.x, o.y)) { hide(o); return o; }
          const set = o.buck ? t.stag : t.doe, q = ((o.gait % 1) + 1) % 1;
          const tex = o.mode === 'flee' ? set.bound[Math.floor(q * 8)] : o.v > 3 ? set.walk[Math.floor(q * 8)] : o.lift >= 1 ? set.look[Math.round((Math.sin(time * 0.6 + o.step) + 1) * 2)] : o.lift > 0 ? set.rise[Math.floor(o.lift * 4.99)] : set.graze[Math.floor(((time * 0.7 + o.step) % 1) * 6)];
          const size = 0.62 * k * deerSize, c = fall(o, o.x, o.y, { width: grid * 0.7, body: 0.9, grounded: true }), up = o.h * grid * 0.13;
          put(o.shadow, tex, o.x + c.dx + sun.x * up, o.y + c.dy + sun.y * up, o.a, size * (1 - o.h * 0.05), Math.min(0.5, c.alpha * 0.55) * alpha); put(o.body, tex, o.x, o.y, o.a, size * (1 + o.h * 0.1), alpha);
          return o;
        }).filter((o) => !o.done);
        if (deerIn > 0 && (deerIn -= dt) <= 0) {
          const way = edgeArrival(spots, area, { grid, blocked });
          if (!way) deerIn = 20;
          else deer.push({ ...way.from, clear: way.clear, tx: way.to.x, ty: way.to.y, a: Math.atan2(way.to.y - way.from.y, way.to.x - way.from.x) + Math.PI / 2, mode: 'arrive', t: 0, wait: 0, buck: false, way: 0, want: 0, v: 0, gait: 0, lift: 1, h: 0, step: Math.random() * 6, ...pair(floor(), herd().doe.look[0]) });
        }
        const f0s = foxes;
        foxes = f0s.map((f0) => {
          if (f0.mode === 'away' && f0.t > (f0.back ?? 60) && spots.length) { const p = spots[Math.floor(Math.random() * spots.length)]; return { ...f0, ...p, mode: 'trot', t: 0, wait: 5, v: 0, carrying: false }; }
          const f = foxStep(f0, { dt, grid, near, blocked, scare, noise: heard(f0), prey: prey?.list ?? [], time, ok: (x, y) => ok('foxes', x, y) });
          if (f.mode === 'flee' && f0.mode !== 'flee') sound('foxBark', f, false);
          else if (f.mode === 'trot' && Math.random() < dt * 0.01) sound('foxBark', f, false);
          // The rabbit bolts as it springs; it is taken if it is still under the paws as the fox comes down.
          if (f.mode === 'pounce' && f0.mode !== 'pounce') prey?.spook?.({ x: f.ex, y: f.ey }, f);
          if (f.mode === 'landed' && f0.mode === 'pounce') {
            const caught = (prey?.list ?? []).find((r) => Math.hypot(r.x - f.x, r.y - f.y) < grid * 0.7);
            if (caught && Math.random() < 0.6) { const tex = prey.take(caught); if (tex) { f.mode = 'carry'; f.t = 0; f.way = Math.random() * TAU; f.carrying = true; f.carry ??= sprite(floor(), tex); f.carry.texture = tex; } }
          }
          if (f.mode === 'away' && f0.mode === 'carry') { gone(f.carry); f.carry = null; f.carrying = false; }
          if (f.mode === 'away' || !can(f, f.x, f.y)) { hide(f); return f; }
          const a2 = foxTex(), q = ((f.gait % 1) + 1) % 1, frame = f.mode === 'flee' ? a2.run[Math.floor(q * 8)] : f.mode === 'stalk' ? a2.stalk[Math.floor(q * 8)] : f.mode === 'coil' ? a2.coil : f.mode === 'pounce' ? a2.leap : f.mode === 'landed' ? a2.land : f.v > 3 ? a2.trot[Math.floor(q * 8)] : a2.look;
          const size = 0.6 * k * foxSize, c = fall(f, f.x, f.y, { width: grid * 0.42, body: 0.45, grounded: true }), up = f.h * grid * 0.12;
          put(f.shadow, frame, f.x + c.dx + sun.x * up, f.y + c.dy + sun.y * up, f.a, size, Math.min(0.5, c.alpha * 0.55) * alpha); put(f.body, frame, f.x, f.y, f.a, size * (1 + f.h * 0.16), alpha);
          if (f.carry) put(f.carry, f.carry.texture, f.x + Math.sin(f.a) * grid * 0.27, f.y - Math.cos(f.a) * grid * 0.27, f.a + Math.PI / 2, 0.4 * k, alpha);
          return f;
        });
        if (flies.length) { const t2 = flyTex(); flies = flies.map((b0) => {
          const b = butterflyStep(b0, { dt, grid, time, ok: (x, y) => ok('butterflies', x, y) });
          if (!can(b, b.x, b.y)) { hide(b); return b; }
          const flapping = Math.sin(time * 1.7 + b.p) > -0.35, tex = t2[b.c][flapping ? Math.floor(time * 15 + b.p) % 6 : 1], size = 0.55 * k * insectSize, c = fall(b, b.x, b.y, { width: grid * 0.1, lift: 0.4 });
          put(b.shadow, tex, b.x + c.dx, b.y + c.dy, b.a, size, Math.min(0.2, c.alpha * 0.2) * alpha); put(b.body, tex, b.x, b.y + Math.sin(time * 5.5 + b.p) * grid * 0.035, b.a, size, alpha);
          return b;
        }); }
        if (drags.length) { const t2 = dragTex(); drags = drags.map((d0) => {
          const d = dragonflyStep(d0, { dt, grid, ok: (x, y) => ok('dragonflies', x, y) });
          if (d.dart && !d0.dart) { if (Math.random() < 0.5) sound('dragonBuzz', d, false); }
          if (!can(d, d.x, d.y)) { hide(d); return d; }
          const wob = d.dart ? 0 : Math.sin(time * 9 + d.p) * grid * 0.015, tex = t2[d.c][Math.floor(time * 40 + d.p) % 3], size = 0.5 * k * insectSize, c = fall(d, d.x, d.y, { width: grid * 0.15, lift: 0.4 });
          put(d.shadow, tex, d.x + c.dx, d.y + c.dy, d.a, size, Math.min(0.2, c.alpha * 0.2) * alpha); put(d.body, tex, d.x + wob, d.y + Math.cos(time * 7 + d.p) * grid * 0.01, d.a, size, alpha);
          return d;
        }); }
      } else for (const o of [...squirrels, ...snakes, ...deer, ...foxes, ...flies, ...drags]) hide(o);
      // By night.
      const dark = Math.max(0, Math.min(1, night));
      if (lights.length) {
        const shown = warm ? dark : 0;
        for (const m of lights) {
          const c = ((time + m.p) % m.every) / 1.3, b = c < 1 ? Math.sin(c * Math.PI) : 0;
          if (shown <= 0.02 || b <= 0.02) { m.body.visible = false; continue; }
          m.a += (Math.random() - 0.5) * 2 * dt; m.x += Math.sin(m.a) * grid * 0.1 * dt; m.y -= Math.cos(m.a) * grid * 0.1 * dt;
          if (looking) m.under = indoors(m.x, m.y) || canopy(m.x, m.y);
          if (m.under || !can(m, m.x, m.y)) { m.body.visible = false; continue; }
          put(m.body, m.body.texture, m.x, m.y, 0, (0.28 + b * 0.22) * k, b * shown * 0.95);
        }
        if (shown > 0.5 && spots.length && Math.random() < dt * 0.6) sound('cricketChirp', lights[Math.floor(Math.random() * lights.length)], false);
      }
      if (owl) {
        const o = owl;
        if (o.t < 1) {
          o.t += dt / 9;
          const p = owlPlace(o);
          if (o.t < 1 && dark > 0.3 && can(o, p.x, p.y)) { const t2 = owlTex(), tex = t2[Math.floor(time * 1.1) % 6 === 0 ? Math.floor(time * 7) % 6 : 0], c = fall(o, p.x, p.y, { width: grid * 1, lift: 1.6, bird: true }); o.open = overOpen(o.open, indoors(p.x, p.y), dt); o.shade = overOpen(o.shade, indoors(p.x + c.dx, p.y + c.dy), dt); put(o.shadow, tex, p.x + c.dx, p.y + c.dy, p.a, 0.62 * k * birdSize, Math.min(0.3, c.alpha * 0.3) * dark * o.shade); liftShadow(o.shadow, 1.6); put(o.body, tex, p.x, p.y, p.a, 0.55 * k * birdSize * birdBody, dark * o.open); } else hide(o);
          if (dark > 0.3 && Math.random() < dt * 0.1) sound('owlHoot', p, false);
        } else { hide(o); if (dark > 0.5 && area && (o.wait -= dt) <= 0) { o.wait = 40 + Math.random() * 60;
          // A line across the map that misses anywhere keeping owls out; none in a few tries, and it stays away this time.
          for (let i = 0; i < 8; i++) { const line = { ...o, way: Math.random() * TAU, cx: area.x + area.width * (0.3 + Math.random() * 0.4), cy: area.y + area.height * (0.3 + Math.random() * 0.4), far: Math.hypot(area.width, area.height) * 1.1 }; if (crossesKept((t) => owlPlace({ ...line, t }), 'owl', kept)) continue; Object.assign(o, line, { t: 0 }); sound('owlHoot', { x: o.cx, y: o.cy }, false); break; }
        } }
      }
      // Bats round the lamps out of doors, by night (batLamps: no carried light): one of the lights nearest the view holds up to three of them.
      const wantBats = dark > 0.3 ? lamps().filter((l) => !kept('bats', l.x, l.y)) : [];
      if (wantBats.length && !bats.length) { const t2 = batTex(); bats = Array.from({ length: Math.min(6, wantBats.length * 3) }, (_, i) => ({ lamp: Math.floor(i / 3), a: Math.random() * TAU, r: between(Math.random, 0.5, 1.05), v: between(Math.random, 1.2, 2.2) * (i % 2 ? 1 : -1), w: Math.random() * 6, body: sprite(high(), t2[0]), shadow: sprite(highShadow(), t2[0], true) })); }
      for (const b of bats) {
        const l = wantBats[b.lamp % Math.max(1, wantBats.length)];
        if (!l) { hide(b); continue; }
        b.a += b.v * dt; const r = grid * b.r, x = l.x + Math.cos(b.a) * r, y = l.y + Math.sin(b.a) * r * 0.8 + Math.sin(time * 7 + b.w) * grid * 0.11 + Math.sin(time * 13.3 + b.w * 2) * grid * 0.07;
        if (!can(b, x, y) || indoors(x, y)) { hide(b); continue; }
        const t2 = batTex(), tex = t2[Math.floor(time * 20 + b.w) % t2.length], size = 0.3 * k * batSize, c = fall(b, x, y, { width: grid * 0.3, lift: 0.7 }), angle = b.a + (b.v > 0 ? 0 : Math.PI);
        put(b.shadow, tex, x + c.dx, y + c.dy, angle, size, Math.min(0.32, c.alpha * 0.34) * dark); put(b.body, tex, x, y, angle, size, dark);
        if (Math.random() < dt * 0.05) sound('batChirp', { x, y }, false);
      }
    },
    clear() { drop(); noises = []; },
    get busy() { return squirrels.length + snakes.length + wolves.length + deer.length + foxes.length + flies.length + drags.length + lights.length + (owl ? 1 : 0) > 0; },
    get counts() { return { squirrels: squirrels.length, squirrelModes: squirrels.map((o) => o.mode), snakes: snakes.length, snakeModes: snakes.map((o) => o.mode), wolves: wolves.length, wolfModes: wolves.map((o) => o.mode), deer: deer.length, deerModes: deer.map((o) => o.mode), foxes: foxes.length, foxModes: foxes.map((o) => o.mode), butterflies: flies.length, dragonflies: drags.length, fireflies: lights.length, fireflyLit: lights.filter((m) => m.body.visible).length, owl: !!owl, owlAcross: owl && owl.t < 1, bats: bats.length }; },
  };
}
