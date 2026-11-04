// Life on the water: ducks paddling and dabbling that clatter up from anyone near, a heron standing still in the shallows
// until someone comes too close, gulls wheeling over open water, and frogs on lily pads that puff their throats and leap in
// with a plop. Drawn once, seen from above, then only moved, turned and swapped; a few dozen small shapes on the CPU at most,
// and nothing drawn where nobody looks. Every screen has its own: nothing here is saved or shared.

import { noiseReaching, wayOut, shadowKeeper, overOpen, NOISE_SPEED } from './wildlife.mjs';

const TAU = Math.PI * 2;
const between = (random, a, b) => a + random() * (b - a);

// ---- What they do ------------------------------------------------------------------------------------------------------
// One step of a duck (pure): paddles about on the water (`ok`), now and then tipping up to feed (`up`, seconds of it). Anyone
// near sends it up (`mode` 'fly', `h` 0-1 its height) and away, and it comes down on water, turning back for where it left if
// it finds none. After a few tries it has gone elsewhere (`gone`). It faces `a` (0 up the map, clockwise).
export function duckStep(duck, { dt = 1 / 60, grid = 100, near = [], ok = () => true, blocked = () => false, barred = () => false, scare = false, noise = null, random = Math.random } = {}) {
  const q = { ...duck };
  if (q.mode === 'swim') {
    const close = noise ?? near.find((t) => Math.hypot(t.x - q.x, t.y - q.y) < grid * 3);
    if (close || scare) { const away = close ? Math.atan2(q.y - close.y, q.x - close.x) + between(random, -0.6, 0.6) : random() * TAU; return { ...q, mode: 'fly', vx: Math.cos(away), vy: Math.sin(away), t: 0, h: 0, up: 0, tries: 0, a: away + Math.PI / 2, fromX: q.x, fromY: q.y }; }
    q.wait -= dt; q.up = Math.max(0, q.up - dt);
    if (q.wait <= 0) { q.wait = between(random, 0.8, 3.5); q.turn = between(random, -0.9, 0.9); if (random() < 0.2) q.up = between(random, 1.2, 2.6); const out = ok(q.x, q.y) ? null : wayOut(q, grid, ok); if (out !== null) { q.a = out; q.turn = 0; q.up = 0; } }
    q.a += (q.turn ?? 0) * dt;
    const speed = q.up > 0 ? 0 : grid * 0.3, nx = q.x + Math.sin(q.a) * speed * dt, ny = q.y - Math.cos(q.a) * speed * dt;
    if (ok(nx + Math.sin(q.a) * grid * 0.2, ny - Math.cos(q.a) * grid * 0.2) || !ok(q.x, q.y)) { q.x = nx; q.y = ny; } else { q.a += Math.PI * between(random, 0.7, 1.3); q.turn = 0; }
    return q;
  }
  q.t += dt;
  const speed = grid * (1.2 + Math.min(1, q.t) * 2), nx = q.x + q.vx * speed * dt, ny = q.y + q.vy * speed * dt;
  // Low enough that walls stop it, and it will not fly into a closed place.
  if (blocked({ x: q.x, y: q.y }, { x: nx, y: ny }) || (barred(nx, ny) && !barred(q.x, q.y))) { const way = Math.atan2(q.fromY - q.y, q.fromX - q.x) + between(random, -0.7, 0.7); q.vx = Math.cos(way); q.vy = Math.sin(way); q.a = way + Math.PI / 2; }
  else { q.x = nx; q.y = ny; }
  const u = q.t / 3.6; q.h = Math.sin(Math.min(1, u) * Math.PI);
  if (u >= 1) {
    if (ok(q.x, q.y)) { q.mode = 'swim'; q.h = 0; q.wait = between(random, 1, 3); q.up = 0; q.turn = 0; }
    else if (q.tries >= 5) q.gone = true;
    else { const way = Math.atan2(q.fromY - q.y, q.fromX - q.x); q.vx = Math.cos(way); q.vy = Math.sin(way); q.a = way + Math.PI / 2; q.t = 1.8; q.tries++; }
  }
  return q;
}

// One step of a heron (pure): stands still in the shallows, turning its head a little and stabbing now and then (`strike`,
// seconds of it). Anyone near lifts it away on slow wings; after a while it comes back to its spot (`hx`, `hy`), and flies on
// if someone is standing there.
export function heronStep(heron, { dt = 1 / 60, grid = 100, near = [], blocked = () => false, barred = () => false, scare = false, noise = null, random = Math.random } = {}) {
  const b = { ...heron }, closeTo = (x, y) => near.find((t) => Math.hypot(t.x - x, t.y - y) < grid * 3.4);
  const leave = (from) => { const away = from ? Math.atan2(b.y - from.y, b.x - from.x) : random() * TAU; b.mode = 'fly'; b.t = 0; b.vx = Math.cos(away); b.vy = Math.sin(away); b.a = away + Math.PI / 2; };
  if (b.mode === 'stand') {
    const close = noise ?? closeTo(b.x, b.y);
    if (close || scare) { leave(close); return b; }
    b.wait -= dt; b.strike = Math.max(0, b.strike - dt);
    if (b.wait <= 0) { b.wait = between(random, 3, 8); if (random() < 0.5) b.strike = 0.35; else b.a += between(random, -0.4, 0.4); }
    return b;
  }
  b.t += dt;
  const stopped = (x, y) => blocked({ x: b.x, y: b.y }, { x, y }) || (barred(x, y) && !barred(b.x, b.y));
  if (b.t < 7) { const speed = grid * (0.6 + Math.min(1, b.t / 1.5) * 2.2), nx = b.x + b.vx * speed * dt, ny = b.y + b.vy * speed * dt; if (stopped(nx, ny)) { const way = Math.atan2(b.vy, b.vx) + between(random, 2, 4.2); b.vx = Math.cos(way); b.vy = Math.sin(way); b.a = way + Math.PI / 2; } else { b.x = nx; b.y = ny; } b.h = Math.min(1, b.t / 2); return b; }
  const d = Math.hypot(b.hx - b.x, b.hy - b.y), way = Math.atan2(b.hy - b.y, b.hx - b.x); b.a = way + Math.PI / 2; b.h = Math.min(1, d / (grid * 3));
  const someone = closeTo(b.hx, b.hy);
  if (someone && d < grid * 4) { leave(someone); b.h = 1; return b; }
  if (d < grid * 0.2) { b.mode = 'stand'; b.x = b.hx; b.y = b.hy; b.h = 0; b.wait = between(random, 2, 5); b.strike = 0; return b; }
  const step = Math.min(d, grid * 2.6 * dt), nx = b.x + Math.cos(way) * step, ny = b.y + Math.sin(way) * step;
  // Something in the way home: off again, to come back by another line.
  if (stopped(nx, ny)) { leave(null); b.h = 1; return b; }
  b.x = nx; b.y = ny;
  return b;
}

// One step of a frog (pure): sits on its pad (`hx`, `hy`) puffing its throat (`puff`, seconds of it). Anyone near sends it
// leaping into the water (`ok`) ahead of them; it swims about under the surface and climbs back once its pad is quiet.
export function frogStep(frog, { dt = 1 / 60, grid = 100, near = [], ok = () => true, scare = false, noise = null, random = Math.random } = {}) {
  const f = { ...frog }, closeTo = (x, y, r) => near.find((t) => Math.hypot(t.x - x, t.y - y) < grid * r);
  const leap = (tx, ty, back) => { f.mode = 'leap'; f.t = 0; f.fx = f.x; f.fy = f.y; f.tx = tx; f.ty = ty; f.back = back; f.a = Math.atan2(ty - f.y, tx - f.x) + Math.PI / 2; };
  if (f.mode === 'sit') {
    f.wait -= dt; f.puff = Math.max(0, f.puff - dt); if (f.wait <= 0) { f.wait = between(random, 3, 9); f.puff = 1.2; }
    const close = noise ?? closeTo(f.x, f.y, 2.4);
    if (close || scare) {
      let way = close ? Math.atan2(f.y - close.y, f.x - close.x) : random() * TAU;
      for (let i = 0; i < 8; i++) { const r = grid * between(random, 0.6, 0.9), tx = f.x + Math.cos(way) * r, ty = f.y + Math.sin(way) * r; if (ok(tx, ty)) { leap(tx, ty, false); break; } way += 0.8; }
    }
  } else if (f.mode === 'leap') {
    f.t += dt / 0.5; const u = Math.min(1, f.t); f.x = f.fx + (f.tx - f.fx) * u; f.y = f.fy + (f.ty - f.fy) * u; f.h = Math.sin(u * Math.PI);
    if (u >= 1) { f.h = 0; if (f.back) { f.mode = 'sit'; f.wait = between(random, 2, 6); f.puff = 0; } else { f.mode = 'swim'; f.t = 0; f.stay = between(random, 4, 8); f.kick = 0; } }
  } else {
    f.t += dt; f.kick = (f.kick ?? 0) + dt * 1.6;
    if (f.t > f.stay && !closeTo(f.hx, f.hy, 3)) {
      const d = Math.hypot(f.hx - f.x, f.hy - f.y);
      if (d < grid * 0.3) leap(f.hx, f.hy, true);
      else { const speed = grid * 0.35 * (0.4 + Math.abs(Math.sin(f.kick * Math.PI))) * dt; f.x += ((f.hx - f.x) / d) * speed; f.y += ((f.hy - f.y) / d) * speed; f.a = Math.atan2(f.hy - f.y, f.hx - f.x) + Math.PI / 2; }
    }
  }
  return f;
}

// ---- How they look ------------------------------------------------------------------------------------------------------
const picture = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.translate(w / 2, h / 2); draw(x); return c; };
const SPANS = [1, 0.9, 0.68, 0.42, 0.68, 0.9];
const GULL = { reach: 78, chord: 21, feathers: 9, fw: 3, top: '#b4bac2', wing: '#a6adb6', feather: '#c5cbd2', tip: '#1d1f23', tail: '#eef0f2', body: 6, bodyLight: '#f6f7f8', bodyDark: '#cfd4d9', head: '#f4f5f6', beak: '#d2a53a', bill: 5, legs: null };
const HERON = { reach: 84, chord: 30, feathers: 10, fw: 4.4, top: '#8a929b', wing: '#737c86', feather: '#7e8791', tip: '#2d3238', tail: '#6d757f', body: 7.5, bodyLight: '#a7aeb6', bodyDark: '#737b85', head: '#d7dadd', beak: '#b99a4c', bill: 11, legs: '#4b4e4a' };
const DUCK = { reach: 46, chord: 15, feathers: 7, fw: 3, top: '#857a6a', wing: '#6e6557', feather: '#7a6f60', tip: '#2f2b26', tail: '#3d3a35', body: 8, bodyLight: '#a79c8b', bodyDark: '#6e6557', head: '#1f5a3c', beak: '#c8a73b', bill: 6, legs: null };
const FROGS = [['#6f8a3c', '#2f4220', '#8d9561'], ['#8b8a44', '#44421f', '#a09a68'], ['#4f7a42', '#22391f', '#7f8f63']];

// A bird from above with its wings out, facing up: span 1 flat out, 0 pulled in.
function flying(span, c) {
  return picture(200, 150, (x) => {
    for (const s of [-1, 1]) {
      const reach = c.reach * (0.32 + 0.68 * span), lift = 7 * (1 - span);
      for (let i = 0; i < c.feathers; i++) {
        const f = i / (c.feathers - 1), bx = s * (5 + (reach - 5) * (0.12 + 0.88 * f)), by = -6 + lift * f + 5 * f * f, len = c.chord * (0.75 + 0.5 * Math.sin(f * 2.4)), ang = Math.PI / 2 + s * (-0.08 - 0.75 * f * f);
        x.save(); x.translate(bx, by); x.rotate(ang);
        const fg = x.createLinearGradient(0, 0, len, 0); fg.addColorStop(0, c.wing); fg.addColorStop(0.7, f > 0.62 ? c.tip : c.feather); fg.addColorStop(1, f > 0.5 ? c.tip : c.feather);
        x.fillStyle = fg; x.beginPath(); x.moveTo(0, -c.fw); x.quadraticCurveTo(len * 0.7, -c.fw, len, 0); x.quadraticCurveTo(len * 0.7, c.fw, 0, c.fw); x.closePath(); x.fill(); x.restore();
      }
      x.fillStyle = c.top; x.beginPath(); x.moveTo(s * 3, -9); x.quadraticCurveTo(s * (8 + reach * 0.5), -14 + lift, s * reach, -5 + lift); x.quadraticCurveTo(s * reach * 0.55, 3 + lift, s * 3, 5); x.closePath(); x.fill();
    }
    if (c.legs) { x.strokeStyle = c.legs; x.lineWidth = 1.6; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 1.6, 8); x.lineTo(s * 2.4, 44); x.stroke(); } }
    x.fillStyle = c.tail; x.beginPath(); x.ellipse(0, 15, c.body * 0.8, 12, 0, 0, TAU); x.fill();
    const bg = x.createRadialGradient(-2, -5, 1, 0, 0, 16); bg.addColorStop(0, c.bodyLight); bg.addColorStop(1, c.bodyDark); x.fillStyle = bg; x.beginPath(); x.ellipse(0, 1, c.body, 14, 0, 0, TAU); x.fill();
    x.fillStyle = c.head; x.beginPath(); x.ellipse(0, -15, c.body * 0.68, 6, 0, 0, TAU); x.fill();
    x.fillStyle = c.beak; x.beginPath(); x.moveTo(-1.6, -20); x.lineTo(0, -20 - c.bill); x.lineTo(1.6, -20); x.closePath(); x.fill();
  });
}
// A duck on the water, facing up: a drake or a mottled hen. feeding: tail up, head under, only the back above the water.
function duckOn(hen, feeding) {
  return picture(72, 72, (x) => {
    x.fillStyle = hen ? '#5a4731' : '#26241f'; x.beginPath(); x.moveTo(-5, 11); x.quadraticCurveTo(0, 22, 5, 11); x.closePath(); x.fill();
    if (!hen) { x.fillStyle = '#e8e6df'; x.beginPath(); x.ellipse(0, 12, 3.4, 3, 0, 0, TAU); x.fill(); }
    const bg = x.createRadialGradient(-2, 0, 1, 0, 2, 14); bg.addColorStop(0, hen ? '#a58a65' : '#b8b2a5'); bg.addColorStop(1, hen ? '#6e5639' : '#7f7a6e'); x.fillStyle = bg; x.beginPath(); x.ellipse(0, 2, 8.6, 13, 0, 0, TAU); x.fill();
    for (const s of [-1, 1]) { x.fillStyle = hen ? '#5f4a31' : '#6a6559'; x.beginPath(); x.moveTo(s * 3, -5); x.quadraticCurveTo(s * 9.5, 3, s * 3.4, 14); x.quadraticCurveTo(s * 1.8, 5, s * 3, -5); x.fill(); x.fillStyle = '#2f55a3'; x.beginPath(); x.ellipse(s * 6.2, 5, 1.1, 2.6, s * 0.3, 0, TAU); x.fill(); }
    if (feeding) return;
    if (!hen) { x.fillStyle = '#6b3d24'; x.beginPath(); x.ellipse(0, -8, 6.6, 4.8, 0, 0, TAU); x.fill(); x.fillStyle = '#efece4'; x.beginPath(); x.ellipse(0, -12, 3.9, 1.1, 0, 0, TAU); x.fill(); }
    x.fillStyle = hen ? '#7b6243' : '#1f5a3c'; x.beginPath(); x.ellipse(0, -15.5, 4.3, 5, 0, 0, TAU); x.fill();
    x.fillStyle = hen ? '#a07b3a' : '#d0ac39'; x.beginPath(); x.moveTo(-2.1, -19.5); x.quadraticCurveTo(-2.3, -24, 0, -24.6); x.quadraticCurveTo(2.3, -24, 2.1, -19.5); x.closePath(); x.fill();
  });
}
// A heron standing, facing up: slim grey back, wings folded to dark tips, the neck in an S ending in a dagger bill. strike: neck out straight.
function heronStanding(strike) {
  return picture(110, 150, (x) => {
    x.fillStyle = '#373c41'; x.beginPath(); x.moveTo(-6, 12); x.quadraticCurveTo(0, 38, 6, 12); x.closePath(); x.fill();
    const bg = x.createLinearGradient(-9, 0, 9, 0); bg.addColorStop(0, '#6a727b'); bg.addColorStop(0.5, '#a3abb3'); bg.addColorStop(1, '#68707a'); x.fillStyle = bg; x.beginPath(); x.ellipse(0, 6, 9, 22, 0, 0, TAU); x.fill();
    for (const s of [-1, 1]) { x.fillStyle = '#4d545c'; x.beginPath(); x.moveTo(s * 5, -10); x.quadraticCurveTo(s * 10.5, 10, s * 3, 32); x.quadraticCurveTo(s * 3.6, 10, s * 5, -10); x.fill(); }
    x.strokeStyle = '#cfd3d6'; x.lineWidth = 4.4; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, -13);
    if (strike) x.lineTo(0, -46); else x.bezierCurveTo(9, -20, -9, -26, 0, -32); x.stroke();
    const hy = strike ? -48 : -34; x.fillStyle = '#e6e8ea'; x.beginPath(); x.ellipse(0, hy, 3.6, 5, 0, 0, TAU); x.fill();
    x.strokeStyle = '#25282c'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, hy + 2); x.quadraticCurveTo(1.6, hy + 9, 3.2, hy + 15); x.stroke();
    x.fillStyle = '#c7a24a'; x.beginPath(); x.moveTo(-1.8, hy - 4); x.lineTo(0, hy - 17); x.lineTo(1.8, hy - 4); x.closePath(); x.fill();
  });
}
// A frog from above, facing up: pose 0 sitting, 1 throat puffed, 2 leaping (legs flung back), 3 swimming (long kick).
function frogPicture(pose, skin, dark, throat) {
  return picture(96, 96, (x) => {
    x.lineCap = 'round'; x.lineJoin = 'round';
    const leg = (s, pts, w) => { x.strokeStyle = dark; x.lineWidth = w; x.beginPath(); x.moveTo(s * pts[0][0], pts[0][1]); for (const [a, b] of pts.slice(1)) x.lineTo(s * a, b); x.stroke(); };
    const toes = (s, px, py, spread) => { x.strokeStyle = dark; x.lineWidth = 1; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(s * px, py); x.lineTo(s * (px + 3 + i * spread * 0.2), py + (pose >= 2 ? 6 : -3) + i * spread); x.stroke(); } };
    for (const s of [-1, 1]) {
      if (pose <= 1) { leg(s, [[7, 8], [15, 13], [9, 18], [13, 21]], 3.6); toes(s, 13, 21, 2); leg(s, [[7, -5], [12, -8], [12, -13]], 2.2); toes(s, 12, -13, 1.6); }
      else if (pose === 2) { leg(s, [[5, 10], [11, 22], [8, 36]], 3.2); toes(s, 8, 36, 2.4); leg(s, [[7, -5], [14, -12], [16, -20]], 2.1); toes(s, 16, -20, 1.6); }
      else { leg(s, [[5, 10], [14, 20], [17, 34]], 3.2); toes(s, 17, 34, 3); leg(s, [[7, -3], [13, 2]], 2); }
    }
    if (pose === 1) { x.fillStyle = throat; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 7.5, -10, 5.4, 5, 0, 0, TAU); x.fill(); } }
    const body = x.createRadialGradient(-2, -2, 1, 0, 2, 14); body.addColorStop(0, skin); body.addColorStop(1, dark);
    x.fillStyle = body; x.beginPath(); x.moveTo(0, -17); x.bezierCurveTo(7, -16, 9, -7, 9.5, 2); x.bezierCurveTo(10, 10, 5, 14, 0, 14); x.bezierCurveTo(-5, 14, -10, 10, -9.5, 2); x.bezierCurveTo(-9, -7, -7, -16, 0, -17); x.fill();
    x.fillStyle = 'rgba(25,30,15,0.5)'; for (const [a, b, r] of [[-4, 3, 1.9], [4.5, -2, 1.5], [3, 8, 1.7], [-5, -4, 1.2], [-1, 10, 1.1]]) { x.beginPath(); x.ellipse(a, b, r, r * 0.8, 0.4, 0, TAU); x.fill(); }
    x.strokeStyle = 'rgba(205,205,140,0.45)'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(0, -11); x.lineTo(0, 11); x.stroke();
    for (const s of [-1, 1]) { x.fillStyle = dark; x.beginPath(); x.arc(s * 5, -11.5, 2.9, 0, TAU); x.fill(); x.fillStyle = '#c9a43c'; x.beginPath(); x.arc(s * 5, -11.8, 1.9, 0, TAU); x.fill(); x.fillStyle = '#14130f'; x.beginPath(); x.ellipse(s * 5, -11.8, 1.3, 0.8, 0, 0, TAU); x.fill(); }
  });
}
// A lily pad from above: a dull leaf with its one notch, its veins running out from the middle.
function lilyPad(notch) {
  return picture(96, 96, (x) => {
    const R = 40;
    x.save(); x.rotate(notch);
    const leaf = (r) => { x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, r, -Math.PI / 2 + 0.2, -Math.PI / 2 - 0.2 + TAU); x.closePath(); };
    x.fillStyle = 'rgba(8,16,12,0.4)'; x.save(); x.translate(1.5, 2.5); leaf(R + 1); x.fill(); x.restore();
    const g = x.createRadialGradient(0, 0, 3, 0, 0, R); g.addColorStop(0, '#6f7b3c'); g.addColorStop(0.75, '#56642f'); g.addColorStop(1, '#3f4d25'); x.fillStyle = g; leaf(R); x.fill();
    x.strokeStyle = 'rgba(165,175,105,0.35)'; x.lineWidth = 0.9; for (let i = 1; i < 12; i++) { const a = -Math.PI / 2 + (i / 12) * TAU; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92); x.stroke(); }
    x.strokeStyle = 'rgba(25,35,15,0.55)'; x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, R - 0.5, -Math.PI / 2 + 0.2, -Math.PI / 2 - 0.2 + TAU); x.stroke();
    x.restore();
  });
}
// The V a paddling duck pushes ahead of it, spreading as it falls behind, `u` 0-1 round the loop.
function wakeFrame(u) {
  return picture(96, 96, (x) => {
    x.strokeStyle = 'rgb(225,235,235)'; x.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) { const f = (u + i / 3) % 1, len = 14 + f * 30, w = 7 + f * 15; x.globalAlpha = (1 - f) * 0.3; x.beginPath(); x.moveTo(-w * 0.6, len * 0.6 + 4); x.quadraticCurveTo(-w * 0.2, 4, 0, -7); x.quadraticCurveTo(w * 0.2, 4, w * 0.6, len * 0.6 + 4); x.stroke(); }
  });
}
// Rings on the water, `u` 0-1 as they spread and fade: under a dabbling duck, a standing heron, a frog gone in.
function ringFrame(u) {
  return picture(128, 96, (x) => {
    x.strokeStyle = 'rgb(230,240,240)'; x.lineWidth = 1;
    for (let i = 0; i < 3; i++) { const f = Math.max(0, u - i * 0.18); if (!f) continue; x.globalAlpha = (1 - f) * 0.5; x.beginPath(); x.ellipse(0, 0, 6 + f * 50, 4.5 + f * 37, 0, 0, TAU); x.stroke(); }
  });
}

/**
 * The layer: populate({ waters, shore, pads, ducks, herons, gulls, grid, area, birdSize, frogSize }) places them (`waters` and
 * `shore` { x, y } on the water, `pads` a { x, y } for each frog); tick(seconds, { near, ok(kind, x, y), seen(x, y), day (0–1:
 * the birds come and go with it, the frogs stay out), sun ({ x, y } the way shadows fall), view, sound(kind, { x, y }, urgent) });
 * scare(); clear(). `floor()` on the water, `sky()` over all: a duck taking off moves from one to the other.
 */
export function createPondLife({ PIXI, floor, sky, high = sky, highShadow = floor }) {
  let noises = [], ducks = [], herons = [], gulls = [], frogs = [], plops = [], grid = 100, birdSize = 1, frogSize = 1, time = 0, scared = 0, shown = 0, look = 0, waterSpots = [], textures = null;
  const art = () => {
    if (textures && !textures.gull[0].baseTexture?.destroyed) return textures;
    const tex = (c) => PIXI.Texture.from(c);
    return (textures = {
      gull: SPANS.map((s) => tex(flying(s, GULL))), heronFly: SPANS.map((s) => tex(flying(s, HERON))), duckFly: SPANS.map((s) => tex(flying(s, DUCK))),
      duck: [[false, false], [false, true], [true, false], [true, true]].map(([h, u]) => tex(duckOn(h, u))), heron: [false, true].map((s) => tex(heronStanding(s))),
      frog: FROGS.map((c) => [0, 1, 2, 3].map((p) => tex(frogPicture(p, ...c)))), pad: [0, 2.1, 4.4].map((n) => tex(lilyPad(n))),
      wake: [0, 0.25, 0.5, 0.75].map((u) => tex(wakeFrame(u))), ring: [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((u) => tex(ringFrame(u))),
    });
  };
  const sprite = (parent, tex, dark = false) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.eventMode = 'none'; s.visible = false; if (dark) s.tint = 0x000000; parent.addChild(s); return s; };
  const gone = (...sprites) => { for (const s of sprites) { try { s?.destroy(); } catch { /* gone */ } } };
  const drop = () => {
    for (const o of ducks) gone(o.body, o.shadow, o.ripple);
    for (const o of herons) gone(o.body, o.shadow, o.ripple);
    for (const o of gulls) gone(o.body, o.shadow);
    for (const o of frogs) gone(o.body, o.shadow, o.pad);
    for (const o of plops) gone(o.view);
    ducks = []; herons = []; gulls = []; frogs = []; plops = []; waterSpots = [];
  };
  const put = (s, tex, x, y, angle, size, alpha) => { s.visible = true; s.texture = tex; s.position.set(x, y); s.rotation = angle; s.scale.set(size); s.alpha = alpha; };
  const newDuck = (t, spot, i, random) => ({ x: spot.x, y: spot.y, a: random() * TAU, turn: 0, wait: random() * 2, hen: i % 2 === 1, mode: 'swim', up: 0, h: 0, phase: random() * 6, body: sprite(floor(), t.duck[0]), shadow: sprite(floor(), t.duck[0], true), ripple: sprite(floor(), t.wake[0]) });
  return {
    populate({ waters = [], shore = [], pads = [], ducks: nDucks = 0, herons: nHerons = 0, gulls: nGulls = 0, grid: g = 100, birdSize: bs = 1, frogSize: fs = 1, random = Math.random } = {}) {
      drop(); grid = g; birdSize = bs; frogSize = fs; shown = 0; waterSpots = waters;
      if (!waters.length) return;
      if (!nDucks && !nHerons && !nGulls && !pads.length) return;
      const t = art(), pick = (list) => list[Math.floor(random() * list.length)];
      // Ducks keep together, a raft of them round one place.
      if (nDucks) { const home = pick(waters), near = waters.filter((w) => Math.hypot(w.x - home.x, w.y - home.y) < grid * 4); ducks = Array.from({ length: nDucks }, (_, i) => newDuck(t, pick(near), i, random)); }
      const stands = shore.length ? shore : waters;
      herons = Array.from({ length: nHerons }, () => { const s = pick(stands); return { x: s.x, y: s.y, hx: s.x, hy: s.y, a: random() * TAU, mode: 'stand', wait: between(random, 2, 6), strike: 0, h: 0, t: 0, vx: 0, vy: 0, phase: random() * 6, body: sprite(floor(), t.heron[0]), shadow: sprite(floor(), t.heron[0], true), ripple: sprite(floor(), t.ring[0]) }; });
      const cx = waters.reduce((n, w) => n + w.x, 0) / waters.length, cy = waters.reduce((n, w) => n + w.y, 0) / waters.length;
      gulls = Array.from({ length: nGulls }, (_, i) => ({ cx: cx + between(random, -2, 2) * grid, cy: cy + between(random, -2, 2) * grid, r: grid * between(random, 2.2, 4), a: random() * TAU, v: between(random, 0.28, 0.42) * (i % 2 ? -1 : 1), phase: random() * 6, body: sprite(high(), t.gull[0]), shadow: sprite(highShadow(), t.gull[0], true) }));
      frogs = pads.map((p, i) => ({ x: p.x, y: p.y, hx: p.x, hy: p.y, a: between(random, -0.9, 0.9), coat: i % FROGS.length, mode: 'sit', wait: between(random, 1, 6), puff: 0, h: 0, t: 0, pad: sprite(floor(), t.pad[i % t.pad.length]), shadow: sprite(floor(), t.frog[0][0], true), body: sprite(floor(), t.frog[0][0]) }));
    },
    scare() { scared = 0.3; },
    noise({ x, y, radius }) { noises.push({ x, y, r: radius, t: 0 }); },
    tick(seconds, { near = [], ok = () => true, seen = () => true, day = 1, sun = { x: 0.62, y: 0.78 }, view = null, sound = () => {}, blocked = () => false, barred = () => false, indoors = () => false, cast = null } = {}) {
      if (!this.busy) return;
      const dt = Math.min(0.05, seconds), k = grid / 100; time += dt; scared = Math.max(0, scared - dt);
      if (noises.length) { for (const n of noises) n.t += dt; noises = noises.filter((n) => n.t * NOISE_SPEED * grid < n.r + grid * 3); }
      const heard = (o) => (noises.length ? noiseReaching(noises, o.x, o.y, { grid }) : null);
      shown += Math.max(-dt, Math.min(dt, (day - shown) * 2)); const alpha = Math.max(0, Math.min(1, shown)), scare = scared > 0;
      const fall = shadowKeeper(cast ?? (() => ({ dx: sun.x * grid * 0.03, dy: sun.y * grid * 0.03, alpha: 0.5 })), time);
      const t = art(); look -= dt; const looking = look <= 0; if (looking) look = 0.2;
      const inView = (x, y, m = grid * 2) => !view || (x > view.x - m && y > view.y - m && x < view.x + view.w + m && y < view.y + view.h + m);
      const can = (o, x, y) => { if (looking) { try { o.seen = seen(x, y) !== false; } catch { o.seen = true; } } return o.seen !== false && inView(x, y); };
      const shadowOf = (o, tex, x, y, angle, size, a) => put(o.shadow, tex, x, y, angle, size, a);
      ducks = ducks.map((q0) => {
        if (q0.gone) { q0.back = (q0.back ?? between(Math.random, 30, 70)) - dt; if (q0.back > 0 || !waterSpots.length) return q0; const w = waterSpots[Math.floor(Math.random() * waterSpots.length)]; floor().addChild(q0.body); return { ...q0, x: w.x, y: w.y, gone: false, back: undefined, mode: 'swim', h: 0, up: 0, wait: 2 }; }
        if (alpha <= 0.01) { q0.body.visible = q0.shadow.visible = q0.ripple.visible = false; return q0; }
        const q = duckStep(q0, { dt, grid, near, scare, noise: heard(q0), blocked, barred: (x, y) => barred('waterBirds', x, y), ok: (x, y) => ok('waterBirds', x, y) });
        if (q.mode === 'fly' && q0.mode === 'swim') { sound('wingsUp', q, true); sound('duckQuack', q, true); sky().addChild(q.body); }
        else if (q.mode === 'swim' && q0.mode === 'fly') { floor().addChild(q.body); }
        else if (q.mode === 'swim' && Math.random() < dt * 0.03) sound('duckQuack', q, false);
        if (q.gone || !can(q, q.x, q.y)) { q.body.visible = q.shadow.visible = q.ripple.visible = false; return q; }
        if (q.mode === 'swim') {
          const feeding = q.up > 0, tex = t.duck[(q.hen ? 2 : 0) + (feeding ? 1 : 0)], size = 0.85 * k * birdSize;
          if (feeding) put(q.ripple, t.ring[Math.floor(time * 4 + q.phase) % t.ring.length], q.x, q.y, 0, 0.55 * k * birdSize, alpha);
          else put(q.ripple, t.wake[Math.floor(time * 6 + q.phase) % t.wake.length], q.x, q.y, q.a, 0.75 * k * birdSize, alpha);
          const c = fall(q, q.x, q.y, { width: grid * 0.3, body: 0.22, grounded: true }); shadowOf(q, tex, q.x + c.dx, q.y + c.dy, q.a, size, Math.min(0.32, c.alpha * 0.36) * alpha); put(q.body, tex, q.x, q.y, q.a, size, alpha);
        } else {
          const c = fall(q, q.x, q.y, { width: grid * 0.3, lift: 0.8 }), tex = t.duckFly[Math.floor(time * 22 + q.phase) % SPANS.length], size = 0.6 * k * birdSize * (1 + q.h * 0.15);
          if (q.h < 0.3) put(q.ripple, t.ring[Math.min(t.ring.length - 1, Math.floor((q.t ?? 0) * 7))], q.x, q.y, 0, 0.55 * k * birdSize, alpha); else q.ripple.visible = false;
          shadowOf(q, tex, q.x + c.dx * q.h, q.y + c.dy * q.h, q.a, size * 0.95, Math.min(0.32, c.alpha * 0.38) * alpha); put(q.body, tex, q.x, q.y, q.a, size, alpha);
        }
        return q;
      });
      herons = herons.map((b0) => {
        if (alpha <= 0.01) { b0.body.visible = b0.shadow.visible = b0.ripple.visible = false; return b0; }
        const b = heronStep(b0, { dt, grid, near, scare, noise: heard(b0), blocked, barred: (x, y) => barred('waterBirds', x, y) });
        if (b.mode === 'fly' && b0.mode === 'stand') { sound('wingsUp', b, true); sky().addChild(b.body); }
        else if (b.mode === 'stand' && b0.mode === 'fly') floor().addChild(b.body);
        if (!can(b, b.x, b.y)) { b.body.visible = b.shadow.visible = b.ripple.visible = false; return b; }
        if (b.mode === 'stand') {
          const tex = t.heron[b.strike > 0 ? 1 : 0], size = 0.52 * k * birdSize;
          put(b.ripple, t.ring[Math.floor(time * 1.4 + b.phase) % t.ring.length], b.x, b.y, 0, 0.7 * k * birdSize, alpha);
          const c = fall(b, b.x, b.y, { width: grid * 0.28, body: 0.75, grounded: true }); shadowOf(b, tex, b.x + c.dx, b.y + c.dy, b.a, size, Math.min(0.45, c.alpha * 0.5) * alpha); put(b.body, tex, b.x, b.y, b.a, size, alpha);
        } else {
          const c = fall(b, b.x, b.y, { width: grid * 0.7, lift: 1.5 }), tex = t.heronFly[Math.floor(time * 5.5 + b.phase) % SPANS.length], size = 0.68 * k * birdSize;
          b.ripple.visible = false; shadowOf(b, tex, b.x + c.dx * b.h, b.y + c.dy * b.h, b.a, size, Math.min(0.32, c.alpha * 0.38) * alpha); put(b.body, tex, b.x, b.y, b.a, size, alpha);
        }
        return b;
      });
      for (const g of gulls) {
        g.a += g.v * dt;
        if (alpha > 0.5 && Math.random() < dt * 0.1) sound('gullCry', { x: g.cx + Math.cos(g.a) * g.r, y: g.cy + Math.sin(g.a) * g.r * 0.75 }, false);
        const x = g.cx + Math.cos(g.a) * g.r, y = g.cy + Math.sin(g.a) * g.r * 0.75;
        if (alpha <= 0.01 || !can(g, x, y)) { g.body.visible = g.shadow.visible = false; continue; }
        const angle = g.a + (g.v > 0 ? Math.PI : 0), tex = t.gull[Math.floor(time * 1.6 + g.phase) % 5 === 0 ? Math.floor(time * 9) % SPANS.length : 0], c = fall(g, x, y, { width: grid * 0.6, lift: 1.7 });
        g.open = overOpen(g.open, indoors(x, y), dt); g.shade = overOpen(g.shade, indoors(x + c.dx, y + c.dy), dt);
        put(g.shadow, tex, x + c.dx, y + c.dy, angle, 0.5 * k * birdSize, Math.min(0.28, c.alpha * 0.3) * alpha * g.shade); put(g.body, tex, x, y, angle, 0.46 * k * birdSize, alpha * g.open);
      }
      frogs = frogs.map((f0) => {
        const f = frogStep(f0, { dt, grid, near, scare, noise: heard(f0), ok: (x, y) => ok('frogs', x, y) });
        if (f.puff > 0 && f0.puff <= 0) sound('frogCroak', f, false);
        if (f0.mode === 'leap' && f.mode === 'swim') { sound('frogPlop', f, false); plops.push({ x: f.x, y: f.y, t: 0, view: sprite(floor(), t.ring[0]) }); }
        const padShows = inView(f.hx, f.hy);
        if (padShows) put(f.pad, f.pad.texture, f.hx, f.hy, f.a * 0.3, 0.72 * k * frogSize, 0.95); else f.pad.visible = false;
        if (!can(f, f.x, f.y)) { f.body.visible = f.shadow.visible = false; return f; }
        const coat = t.frog[f.coat], size = 0.72 * k * frogSize;
        if (f.mode === 'swim') {
          const tex = coat[Math.abs(Math.sin((f.kick ?? 0) * Math.PI)) > 0.5 ? 3 : 0];
          f.shadow.visible = false; put(f.body, tex, f.x, f.y, f.a, size * 0.95, 0.5);
        } else {
          const pose = f.mode === 'leap' ? 2 : f.puff > 0 && Math.sin((f.puff / 1.2) * Math.PI * 3) > -0.2 ? 1 : 0, o = f.h * grid * 0.17, c = fall(f, f.x, f.y, { width: grid * 0.16, body: 0.08, grounded: true });
          put(f.shadow, coat[pose], f.x + c.dx + sun.x * o, f.y + c.dy + sun.y * o, f.a, size * (1 - f.h * 0.1), Math.min(0.45, c.alpha * 0.5)); put(f.body, coat[pose], f.x, f.y, f.a, size * (1 + f.h * 0.28), 1);
        }
        return f;
      });
      plops = plops.filter((p) => {
        p.t += dt; const u = p.t / 1.1;
        if (u >= 1) { gone(p.view); return false; }
        put(p.view, t.ring[Math.min(t.ring.length - 1, Math.floor(u * t.ring.length))], p.x, p.y, 0, 0.8 * k, 1);
        return true;
      });
    },
    clear() { drop(); noises = []; },
    get busy() { return ducks.length + herons.length + gulls.length + frogs.length > 0; },
    get counts() { return { ducks: ducks.filter((q) => !q.gone).length, herons: herons.length, gulls: gulls.length, frogs: frogs.length, frogModes: frogs.map((f) => f.mode), duckModes: ducks.map((q) => q.mode), heronModes: herons.map((b) => b.mode) }; },
  };
}
