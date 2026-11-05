// More life out of doors. By day: deer that graze and bound away, a fox that trots, creeps up on a rabbit and pounces, butterflies,
// dragonflies over the water. By night: fireflies, an owl gliding over in silence, bats hunting round the lamps. Drawn once, seen
// from above, then only moved, turned and swapped; every gait runs by the ground covered, so no foot slides. A few dozen small
// shapes on the CPU at most, and nothing drawn where nobody looks. Every screen has its own: nothing here is saved or shared.

import { noiseReaching, shadowKeeper, overOpen, NOISE_SPEED, resettled, nearestSpot } from './wildlife.mjs';
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
    if (o.t > 3.8) { if (!ok(o.x, o.y)) o.t = 1.5; else if (close) { o.t = 1.5; o.way = Math.atan2(o.y - close.y, o.x - close.x); } else { o.mode = 'look'; o.h = 0; o.lift = 1; o.wait = between(random, 2, 5); o.want = o.a; } }
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
    if (f.t > 2.6) { if (!ok(f.x, f.y)) f.t = 1; else { f.mode = 'trot'; f.want = f.a; f.wait = between(random, 3, 7); } }
  } else if (f.mode === 'carry') {
    f.t += dt; steer(); f.a = turnToward(f.a, f.way + Math.PI / 2, dt * 3); f.v = grid * 1.6;
    if (!forward(f.v, 0.9)) f.a = turnToward(f.a, f.way + Math.PI / 2, dt * 9);
    if (f.t > 7) { f.mode = 'away'; f.t = 0; f.back = between(random, 50, 110); }
  } else if (f.mode === 'trot') {
    f.want = (f.want ?? f.a) + Math.sin(time * 0.7 + (f.seed ?? 0)) * 0.6 * dt; f.a = turnToward(f.a, f.want, dt * 1.6); f.wait -= dt; f.v = (f.v ?? 0) + (grid * 0.95 - (f.v ?? 0)) * Math.min(1, dt * 2.5);
    if (!forward(f.v, 0.72)) { const w = clearWay(f.x, f.y, f.a - Math.PI / 2, grid, free); f.want = w === null ? f.a + between(random, 1.6, 2.8) : w + Math.PI / 2; f.a = turnToward(f.a, f.want, dt * 3); }
    if (f.wait <= 0) { const sitting = prey.filter((r) => r.mode !== 'bolt' && Math.hypot(r.x - f.x, r.y - f.y) < grid * 5); f.wait = between(random, 2, 5); if (sitting.length) f.mode = 'stalk'; }
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
 * The layer: populate({ spots, waters, deer, foxes, butterflies, dragonflies, fireflies, owl, grid, area, deerSize, foxSize, insectSize, birdSize });
 * tick(seconds, { near, ok(kind, x, y), blocked, seen(x, y), day, night, warm, sun, view, sound(kind, at, urgent), cast, prey, lamps() });
 * noise({ x, y, radius }); scare(); clear(). `prey`: the rabbits, { list, spook(rabbit, from), take(rabbit) } (wildlife.mjs).
 */
export function createFieldLife({ PIXI, floor, sky, glow = sky, high = sky, highShadow = floor }) {
  let deer = [], foxes = [], flies = [], drags = [], lights = [], bats = [], owl = null, noises = [], spots = [], area = null, grid = 100, deerSize = 1, foxSize = 1, insectSize = 1, birdSize = 1, time = 0, scared = 0, shownDay = 0, look = 0, art = {};
  const texOf = (c) => PIXI.Texture.from(c), group = (o, f) => (Array.isArray(o) ? o.map(f) : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, group2(v, f)]))), group2 = (v, f) => (Array.isArray(v) ? v.map(f) : f(v));
  const lazily = (key, make) => { const had = art[key]; const sample = had && (had.doe?.look?.[0] ?? had.trot?.[0] ?? had[0]?.[0] ?? had[0]); if (!had || sample?.baseTexture?.destroyed) art[key] = make(); return art[key]; };
  const herd = () => lazily('herd', () => ({ doe: group(herdArt(false), texOf), stag: group(herdArt(true), texOf) }));
  const foxTex = () => lazily('fox', () => group(foxArt(), texOf));
  const flyTex = () => lazily('fly', () => WINGS.map((c) => [1, 0.75, 0.4, 0.15, 0.4, 0.75].map((o) => texOf(butterflyPicture(o, c)))));
  const dragTex = () => lazily('drag', () => ['#2f7f86', '#a2472f'].map((c) => [0, 1, 0.3].map((f) => texOf(dragonflyPicture(f, c)))));
  const owlTex = () => lazily('owl', () => [1, 0.9, 0.65, 0.4, 0.65, 0.9].map((s) => texOf(owlPicture(s))));
  const glowTex = () => lazily('glow', () => [texOf(fireflyPicture())]);
  const batTex = () => lazily('bat', () => batWingbeat().map(texOf));
  const sprite = (parent, tex, dark = false) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.eventMode = 'none'; s.visible = false; if (dark) s.tint = 0x000000; parent.addChild(s); return s; };
  const pair = (root, tex) => ({ body: sprite(root, tex), shadow: sprite(floor(), tex, true) });
  const gone = (...list) => { for (const s of list) { try { s?.destroy(); } catch { /* gone */ } } };
  const drop = () => {
    for (const o of [...deer, ...foxes, ...flies, ...drags, ...bats, ...(owl ? [owl] : [])]) gone(o.body, o.shadow, o.carry);
    for (const o of lights) gone(o.body);
    deer = []; foxes = []; flies = []; drags = []; lights = []; bats = []; owl = null;
  };
  const put = (s, tex, x, y, angle, size, alpha) => { s.visible = true; s.texture = tex; s.position.set(x, y); s.rotation = angle; s.scale.set(size); s.alpha = alpha; };
  const hide = (o) => { o.body.visible = false; o.shadow.visible = false; if (o.carry) o.carry.visible = false; };
  return {
    populate({ spots: land = [], waters = [], deer: nDeer = 0, foxes: nFoxes = 0, butterflies = 0, dragonflies = 0, fireflies = 0, owl: hasOwl = false, grid: g = 100, area: a = null, deerSize: ds = 1, foxSize: fs = 1, insectSize: is = 1, birdSize: bs = 1, random = Math.random } = {}) {
      drop(); grid = g; area = a; spots = land; deerSize = ds; foxSize = fs; insectSize = is; birdSize = bs; shownDay = 0;
      const pick = (list) => list[Math.floor(random() * list.length)], jitter = (p, r) => ({ x: p.x + between(random, -r, r) * g, y: p.y + between(random, -r, r) * g });
      if (nDeer && land.length) { const t = herd(), home = pick(land), near = land.filter((p) => Math.hypot(p.x - home.x, p.y - home.y) < g * 5); deer = Array.from({ length: nDeer }, (_, i) => ({ ...pick(near), a: random() * TAU, mode: 'graze', wait: between(random, 1, 5), buck: i === 0, t: 0, way: 0, want: 0, v: 0, gait: random(), lift: random() < 0.5 ? 0 : 1, h: 0, step: random() * 6, ...pair(floor(), t.doe.look[0]) })); }
      if (nFoxes && land.length) { const t = foxTex(); foxes = Array.from({ length: nFoxes }, () => { const a0 = random() * TAU; return { ...pick(land), a: a0, want: a0, mode: 'trot', t: 0, wait: between(random, 3, 8), v: 0, gait: 0, way: 0, h: 0, seed: random() * 6, ...pair(floor(), t.look) }; }); }
      if (butterflies && land.length) { const t = flyTex(); flies = Array.from({ length: butterflies }, (_, i) => ({ ...pick(land), a: random() * TAU, wait: 0, turn: 0, c: i % t.length, p: random() * 6, ...pair(sky(), t[0][0]) })); }
      if (dragonflies && waters.length) { const t = dragTex(); drags = Array.from({ length: dragonflies }, (_, i) => ({ ...pick(waters), a: random() * TAU, hover: random() * 2, c: i % t.length, p: random() * 6, ...pair(sky(), t[0][0]) })); }
      if (fireflies && (land.length || waters.length)) { const t = glowTex(), from = land.concat(waters); lights = Array.from({ length: fireflies }, () => { const s = sprite(glow(), t[0]); s.blendMode = PIXI.BLEND_MODES.ADD; return { ...jitter(pick(from), 0.45), a: random() * TAU, p: random() * 9, every: between(random, 1.8, 3.6), body: s }; }); }
      if (hasOwl && a) { const t = owlTex(); owl = { t: 1, wait: between(random, 8, 30), way: 0, cx: 0, cy: 0, far: 0, body: sprite(high(), t[0]), shadow: sprite(highShadow(), t[0], true) }; }
    },
    // The walls changed: new places to come back to, and any shut in go there, a herd near one place. A fox set down mid-hunt
    // forgets it: its spring was aimed from where it was.
    resettle({ spots: land = [], closed = () => false, random = Math.random } = {}) {
      spots = land; if (!land.length) return;
      const home = land[Math.floor(random() * land.length)], near = land.filter((p) => Math.hypot(p.x - home.x, p.y - home.y) < grid * 5);
      deer = resettled(deer, { spots: near, closed, random });
      foxes = foxes.map((f) => { const [o] = resettled([f], { spots: land, closed, random }); return o === f || f.mode === 'flee' || f.mode === 'carry' || f.mode === 'away' ? o : { ...o, mode: 'trot', t: 0, h: 0, wait: 5, v: 0, want: o.a }; });
    },
    runOff({ spots: land = [], bad = () => false } = {}) {
      if (!land.length) return;
      spots = land; const off = (o) => (bad(o.x, o.y) ? runsOff(o, { spots: land }) : o);
      deer = deer.map(off); foxes = foxes.map(off);
    },
    scare() { scared = 0.3; },
    noise({ x, y, radius }) { noises.push({ x, y, r: radius, t: 0 }); },
    tick(seconds, { near = [], ok = () => true, blocked = () => false, seen = () => true, day = 1, night = 0, warm = true, sun = { x: 0.62, y: 0.78 }, view = null, sound = () => {}, indoors = () => false, canopy = () => false, cast = null, prey = null, lamps = () => [] } = {}) {
      if (!this.busy) return;
      const dt = Math.min(0.05, seconds), k = grid / 100; time += dt; scared = Math.max(0, scared - dt);
      if (noises.length) { for (const n of noises) n.t += dt; noises = noises.filter((n) => n.t * NOISE_SPEED * grid < n.r + grid * 3); }
      const heard = (o) => (noises.length ? noiseReaching(noises, o.x, o.y, { grid }) : null), scare = scared > 0;
      shownDay += Math.max(-dt, Math.min(dt, (day - shownDay) * 2)); const alpha = Math.max(0, Math.min(1, shownDay));
      const fall = shadowKeeper(cast ?? (() => ({ dx: sun.x * grid * 0.03, dy: sun.y * grid * 0.03, alpha: 0.5 })), time);
      look -= dt; const looking = look <= 0; if (looking) look = 0.2;
      const inView = (x, y, m = grid * 2) => !view || (x > view.x - m && y > view.y - m && x < view.x + view.w + m && y < view.y + view.h + m);
      const can = (o, x, y) => { if (looking) { try { o.seen = seen(x, y) !== false; } catch { o.seen = true; } } return o.seen !== false && inView(x, y); };
      if (alpha > 0.01) {
        const t = deer.length ? herd() : null;
        deer = deer.map((o0) => {
          const o = deerStep(o0, { dt, grid, near, blocked, scare, noise: heard(o0), ok: (x, y) => ok('deer', x, y) });
          if (!can(o, o.x, o.y)) { hide(o); return o; }
          const set = o.buck ? t.stag : t.doe, q = ((o.gait % 1) + 1) % 1;
          const tex = o.mode === 'flee' ? set.bound[Math.floor(q * 8)] : o.v > 3 ? set.walk[Math.floor(q * 8)] : o.lift >= 1 ? set.look[Math.round((Math.sin(time * 0.6 + o.step) + 1) * 2)] : o.lift > 0 ? set.rise[Math.floor(o.lift * 4.99)] : set.graze[Math.floor(((time * 0.7 + o.step) % 1) * 6)];
          const size = 0.62 * k * deerSize, c = fall(o, o.x, o.y, { width: grid * 0.7, body: 0.9, grounded: true }), up = o.h * grid * 0.13;
          put(o.shadow, tex, o.x + c.dx + sun.x * up, o.y + c.dy + sun.y * up, o.a, size * (1 - o.h * 0.05), Math.min(0.5, c.alpha * 0.55) * alpha); put(o.body, tex, o.x, o.y, o.a, size * (1 + o.h * 0.1), alpha);
          return o;
        });
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
      } else for (const o of [...deer, ...foxes, ...flies, ...drags]) hide(o);
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
          if (o.t < 1 && dark > 0.3 && can(o, p.x, p.y)) { const t2 = owlTex(), tex = t2[Math.floor(time * 1.1) % 6 === 0 ? Math.floor(time * 7) % 6 : 0], c = fall(o, p.x, p.y, { width: grid * 1, lift: 1.6 }); o.open = overOpen(o.open, indoors(p.x, p.y), dt); o.shade = overOpen(o.shade, indoors(p.x + c.dx, p.y + c.dy), dt); put(o.shadow, tex, p.x + c.dx, p.y + c.dy, p.a, 0.62 * k * birdSize, Math.min(0.3, c.alpha * 0.3) * dark * o.shade); put(o.body, tex, p.x, p.y, p.a, 0.55 * k * birdSize, dark * o.open); } else hide(o);
          if (dark > 0.3 && Math.random() < dt * 0.1) sound('owlHoot', p, false);
        } else { hide(o); if (dark > 0.5 && area && (o.wait -= dt) <= 0) { o.t = 0; o.wait = 40 + Math.random() * 60; o.way = Math.random() * TAU; o.cx = area.x + area.width * (0.3 + Math.random() * 0.4); o.cy = area.y + area.height * (0.3 + Math.random() * 0.4); o.far = Math.hypot(area.width, area.height) * 1.1; sound('owlHoot', { x: o.cx, y: o.cy }, false); } }
      }
      // Bats round the lamps out of doors, by night (batLamps: no carried light): one of the lights nearest the view holds up to three of them.
      const wantBats = dark > 0.3 ? lamps() : [];
      if (wantBats.length && !bats.length) { const t2 = batTex(); bats = Array.from({ length: Math.min(6, wantBats.length * 3) }, (_, i) => ({ lamp: Math.floor(i / 3), a: Math.random() * TAU, r: between(Math.random, 0.5, 1.05), v: between(Math.random, 1.2, 2.2) * (i % 2 ? 1 : -1), w: Math.random() * 6, body: sprite(high(), t2[0]), shadow: sprite(highShadow(), t2[0], true) })); }
      for (const b of bats) {
        const l = wantBats[b.lamp % Math.max(1, wantBats.length)];
        if (!l) { hide(b); continue; }
        b.a += b.v * dt; const r = grid * b.r, x = l.x + Math.cos(b.a) * r, y = l.y + Math.sin(b.a) * r * 0.8 + Math.sin(time * 7 + b.w) * grid * 0.11 + Math.sin(time * 13.3 + b.w * 2) * grid * 0.07;
        if (!can(b, x, y) || indoors(x, y)) { hide(b); continue; }
        const t2 = batTex(), tex = t2[Math.floor(time * 20 + b.w) % t2.length], size = 0.3 * k * birdSize, c = fall(b, x, y, { width: grid * 0.3, lift: 0.7 }), angle = b.a + (b.v > 0 ? 0 : Math.PI);
        put(b.shadow, tex, x + c.dx, y + c.dy, angle, size, Math.min(0.32, c.alpha * 0.34) * dark); put(b.body, tex, x, y, angle, size, dark);
        if (Math.random() < dt * 0.05) sound('batChirp', { x, y }, false);
      }
    },
    clear() { drop(); noises = []; },
    get busy() { return deer.length + foxes.length + flies.length + drags.length + lights.length + (owl ? 1 : 0) > 0; },
    get counts() { return { deer: deer.length, deerModes: deer.map((o) => o.mode), foxes: foxes.length, foxModes: foxes.map((o) => o.mode), butterflies: flies.length, dragonflies: drags.length, fireflies: lights.length, fireflyLit: lights.filter((m) => m.body.visible).length, owl: !!owl, owlAcross: owl && owl.t < 1, bats: bats.length }; },
  };
}
