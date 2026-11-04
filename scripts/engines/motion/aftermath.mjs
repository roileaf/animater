// What a fight leaves behind: shots stuck in walls, floors and creatures, and bodies that draw flies and then crows (or a
// vulture, for something big). Drawn once, then only moved, turned and faded; a few small shapes on the CPU, and nothing drawn
// where nobody looks. Every screen has its own: nothing here is saved or shared, but it is all seeded by ids, so screens
// roughly agree.

import { noiseReaching, shadowKeeper, NOISE_SPEED } from './wildlife.mjs';
import { seededRandom } from '../fragments/fragments.mjs';
import { seeded } from '../sound/creature-idle.mjs';

const TAU = Math.PI * 2;
const between = (random, a, b) => a + random() * (b - a);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export const SHOT_CAP = 60;
// How close anyone can come to a bird on the ground, in squares.
export const SHY_SQUARES = 2.5;
// How long scared crows stay away, in seconds.
export const CROW_BACK = Object.freeze([40, 90]);
// Rain from here on keeps the flies down.
export const HEAVY_RAIN = 0.6;
// Across all bodies at once, however bad the battle: specks of flies, and birds (each a bird and its shadow).
export const MOST_SPECKS = 36;
export const MOST_BIRDS = 9;
// A body this many squares across gets a vulture rather than crows.
export const VULTURE_FROM = 3;

// A random run of its own from any id (pure): the same id gives the same run on every screen.
export const seedRandom = (seed) => seededRandom(Math.floor(seeded(seed) * 4294967296));

// ---- Shots ---------------------------------------------------------------------------------------------------------------
// The list after a new shot (pure): `shots` oldest first, as many as `cap` of the newest kept, and the rest handed back to clear up.
export function capShots(shots, cap = SHOT_CAP) {
  const over = Math.max(0, shots.length - Math.max(0, cap));
  return { kept: shots.slice(over), dropped: shots.slice(0, over) };
}

// How much of a shot still shows (pure): all of it with no `lifetime`; with one, all of it until the end, which fades away.
export function shotFade(age, lifetime = null) {
  if (!(lifetime > 0) || !Number.isFinite(lifetime)) return 1;
  if (age >= lifetime) return 0;
  return Math.min(1, (lifetime - age) / Math.min(4, lifetime * 0.25));
}

// The shiver in a shaft just after it lands (pure): radians either way, gone in a moment.
export const QUIVER_FOR = 0.7;
export const shotQuiver = (age) => (age >= QUIVER_FOR ? 0 : Math.sin(age * 60) * Math.exp(-age * 7) * 0.1);

// ---- Bodies --------------------------------------------------------------------------------------------------------------
// What a body has drawn by now (pure). `flies` 0-1: from about 25 s, all of them by 90 s, none in the cold or heavy rain, fewer
// at night. `crows` a whole number: only outdoors by day, the first at about 150 s and three by 300 s.
export function bodyStage(age, { outdoors = false, day = 1, cold = false, rain = 0 } = {}) {
  const light = clamp01(Number(day) || 0);
  const flying = !(Number(cold) >= 0.5) && !(Number(rain) >= HEAVY_RAIN);
  const flies = flying ? clamp01((age - 25) / 65) * (0.35 + 0.65 * light) : 0;
  const crows = outdoors && light > 0.3 && age >= 150 ? Math.min(3, 1 + Math.floor((age - 150) / 75)) : 0;
  return { flies, crows };
}

// How many specks a cloud of flies shows (pure): none, or 2 to 9.
export const speckCount = (flies) => (flies > 0 ? 2 + Math.round(7 * clamp01(flies)) : 0);

// One fly's way round the body (pure): two sines that never quite line up, so it never quite repeats.
export const speckPath = (random = Math.random) => ({ fx: between(random, 1.3, 3.1), fy: between(random, 1.7, 3.7), px: random() * TAU, py: random() * TAU, swell: between(random, 0.4, 1.1), flick: between(random, 40, 70) });

// Where a fly is `time` seconds in (pure): offsets from the body, within `radius` (wider and higher while `lift`ed, 0-1), and how it flickers.
export function speckAt(path, time, { radius = 50, lift = 0 } = {}) {
  const reach = radius * (1 + lift * 0.8), swell = 0.7 + 0.3 * Math.sin(time * path.swell + path.py), beat = Math.sin(time * path.flick + path.px);
  return { x: Math.sin(time * path.fx + path.px) * reach * swell, y: Math.sin(time * path.fy + path.py) * reach * swell * 0.8 - lift * radius * 0.5, alpha: beat > 0 ? 0.95 : 0.55, frame: beat > 0 ? 0 : 1 };
}

// How far up the flies are (pure): a fright lifts them at once, and they settle again in a few seconds whoever stays.
export const fliesLift = (lift, { dt = 1 / 60, startled = false } = {}) => (startled ? 1 : Math.max(0, lift - dt / 3.5));

// What frightens a bird at a place (pure): a noise reaching it, or anyone within `reach` squares. The first of them, or null.
export function scaredBy(x, y, { grid = 100, near = [], noise = null, reach = SHY_SQUARES } = {}) {
  return noise ?? near.find((t) => Math.hypot(t.x - x, t.y - y) < grid * reach) ?? null;
}

// A crow not here yet (pure): `back` seconds before it sets off for a place `ring` px from the body at { tx, ty }, round at `at`.
export const newCrow = ({ tx, ty, ring, at = 0, back = 0 }) => ({ mode: 'gone', tx, ty, ring, at, back, x: tx, y: ty, h: 0, a: 0, t: 0, wait: 0, peck: 0, pecks: 0, hop: null, fromX: tx, fromY: ty, len: 1, vx: 0, vy: 0 });

const faceOf = (fromX, fromY, toX, toY) => Math.atan2(toX - fromX, -(toY - fromY));
const spotOf = (q) => ({ x: q.tx + Math.sin(q.at) * q.ring, y: q.ty - Math.cos(q.at) * q.ring });

// One step of a crow (pure). `mode`: 'gone' out of sight, counting down `back` and setting off once nobody is by the body; 'in'
// gliding down to its place; 'ground' hopping (`hop`) and pecking (`peck`, seconds of it), always facing the body; 'away' flapping
// off, and gone after a few seconds for 40 to 90 more. Anyone within reach or a noise sends it off, and `leave` sends it off for
// good: it stays gone. `h` 0-1 its height; `a` the way it faces (0 up the map, clockwise).
export function crowStep(crow, { dt = 1 / 60, grid = 100, near = [], noise = null, leave = false, random = Math.random } = {}) {
  const q = { ...crow };
  if (q.mode === 'gone') {
    if (leave) return q;
    q.back -= dt;
    if (q.back > 0) return q;
    const spot = spotOf(q);
    // Somebody is still there: it looks again a little later.
    if (scaredBy(spot.x, spot.y, { grid, near })) { q.back = between(random, 3, 8); return q; }
    const from = random() * TAU, far = grid * between(random, 9, 13);
    q.mode = 'in'; q.t = 0; q.h = 1; q.fromX = spot.x + Math.cos(from) * far; q.fromY = spot.y + Math.sin(from) * far; q.x = q.fromX; q.y = q.fromY; q.len = far / (grid * 2.4);
    q.a = faceOf(q.x, q.y, spot.x, spot.y);
    return q;
  }
  if (q.mode === 'away') {
    q.t += dt;
    const speed = grid * (1.5 + Math.min(1, q.t) * 3);
    q.x += q.vx * speed * dt; q.y += q.vy * speed * dt; q.h = Math.max(q.h, Math.min(1, q.t / 1.2));
    if (q.t >= 5) { q.mode = 'gone'; q.h = 0; q.back = between(random, CROW_BACK[0], CROW_BACK[1]); }
    return q;
  }
  const spot = spotOf(q);
  const fright = scaredBy(q.x, q.y, { grid, near, noise }) ?? (q.mode === 'in' ? scaredBy(spot.x, spot.y, { grid, near }) : null);
  if (fright || leave) {
    const away = fright ? Math.atan2(q.y - fright.y, q.x - fright.x) + between(random, -0.6, 0.6) : random() * TAU;
    q.mode = 'away'; q.t = 0; q.vx = Math.cos(away); q.vy = Math.sin(away); q.a = away + Math.PI / 2; q.peck = 0; q.pecks = 0; q.hop = null;
    return q;
  }
  if (q.mode === 'in') {
    q.t += dt;
    const u = Math.min(1, q.t / q.len), e = u * (2 - u);
    q.x = q.fromX + (spot.x - q.fromX) * e; q.y = q.fromY + (spot.y - q.fromY) * e; q.h = 1 - u;
    if (u >= 1) { q.mode = 'ground'; q.h = 0; q.wait = between(random, 0.6, 2); q.a = faceOf(q.x, q.y, q.tx, q.ty); }
    return q;
  }
  q.peck = Math.max(0, q.peck - dt);
  if (q.hop) {
    const hop = { ...q.hop, u: Math.min(1, q.hop.u + dt / 0.28) };
    q.x = hop.fromX + (hop.toX - hop.fromX) * hop.u; q.y = hop.fromY + (hop.toY - hop.fromY) * hop.u; q.h = Math.sin(hop.u * Math.PI) * 0.18;
    if (hop.u >= 1) { q.hop = null; q.h = 0; q.wait = between(random, 0.5, 1.6); } else q.hop = hop;
  } else {
    q.wait -= dt;
    if (q.wait <= 0) {
      if (q.pecks > 0) { q.pecks--; q.peck = 0.16; q.wait = q.pecks ? 0.3 : between(random, 0.8, 2.4); }
      else if (random() < 0.6) { q.pecks = 1 + Math.floor(random() * 3); q.wait = 0.15; }
      else {
        // A hop or two round the body, never off from it.
        const round = q.at + between(random, -0.5, 0.5), reach = q.ring * between(random, 0.9, 1.15);
        q.at = round; q.hop = { u: 0, fromX: q.x, fromY: q.y, toX: q.tx + Math.sin(round) * reach, toY: q.ty - Math.cos(round) * reach };
      }
    }
  }
  q.a = faceOf(q.x, q.y, q.tx, q.ty);
  return q;
}

// ---- How they look -------------------------------------------------------------------------------------------------------
const picture = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.translate(w / 2, h / 2); draw(x); return c; };
const SPANS = [1, 0.88, 0.62, 0.36, 0.62, 0.88];
// Shots are drawn at twice their size, flying along +x with the point at x = TIP, so the anchor sits on where it landed.
const SHOT_W = 160, SHOT_H = 44, TIP = 70, TIP_ANCHOR = (SHOT_W / 2 + TIP) / SHOT_W;
const ARROWS = [{ len: 124, w: 2.6, wood: '#9c7c52', vane: '#d9d3c4', vaneLen: 22 }, { len: 124, w: 2.6, wood: '#8a6b45', vane: '#7c2f26', vaneLen: 22 }, { len: 124, w: 2.6, wood: '#a58a60', vane: '#3a414b', vaneLen: 22 }];
const BOLTS = [{ len: 84, w: 3.6, wood: '#5f4a33', vane: '#7b6a55', vaneLen: 14 }, { len: 84, w: 3.6, wood: '#4c4640', vane: '#8c9096', vaneLen: 14 }];
const CROW = { top: '#2a2b32', wing: '#18191e', tip: '#0c0c0f', head: '#1c1d22', beak: '#0a0a0b', neck: null };
const VULTURE = { top: '#46392d', wing: '#2c241c', tip: '#17130f', head: '#b4675a', beak: '#d4c8a6', neck: '#d6cdbb' };

// A shot where it landed. In a wall nearly all of it shows, its point in a small split of the wood or stone; in a floor we look
// down its length, so it is short, with the end nearest us the widest, and a little scoop of earth at its foot.
function shotPicture(c, floor) {
  return picture(SHOT_W, SHOT_H, (x) => {
    x.lineCap = 'round'; x.lineJoin = 'round';
    const length = floor ? c.len * 0.42 : c.len, end = TIP - length, wide = floor ? c.w * 1.7 : c.w, foot = floor ? c.w * 0.7 : c.w;
    if (floor) { const g = x.createRadialGradient(TIP, 0, 0, TIP, 0, 9); g.addColorStop(0, 'rgba(16,12,8,0.7)'); g.addColorStop(1, 'rgba(16,12,8,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(TIP, 0, 9, 7, 0, 0, TAU); x.fill(); }
    else { x.strokeStyle = 'rgba(12,10,8,0.65)'; x.lineWidth = 1.1; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(TIP + 1, 0); x.lineTo(TIP - 3, s * 5); x.stroke(); } }
    const shaft = () => { x.beginPath(); x.moveTo(TIP, -foot / 2); x.lineTo(end, -wide / 2); x.lineTo(end, wide / 2); x.lineTo(TIP, foot / 2); x.closePath(); };
    // A dark edge all round rather than a shadow, as the picture turns with the shot and the sun does not.
    x.strokeStyle = 'rgba(0,0,0,0.42)'; x.lineWidth = 2.4; shaft(); x.stroke();
    x.fillStyle = c.wood; shaft(); x.fill();
    x.strokeStyle = 'rgba(255,240,210,0.28)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(TIP, -foot * 0.2); x.lineTo(end, -wide * 0.2); x.stroke();
    const vane = floor ? c.vaneLen * 0.55 : c.vaneLen, spread = (floor ? 9 : 6) * (c.w / 2.6);
    for (const s of [-1, 1]) {
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.moveTo(end + vane + 2, s * (wide / 2 + 1)); x.lineTo(end + 1, s * (spread + 2)); x.lineTo(end - 3, s * (spread + 2)); x.lineTo(end, s * wide * 0.3); x.closePath(); x.fill();
      x.fillStyle = c.vane; x.beginPath(); x.moveTo(end + vane, s * (wide / 2)); x.lineTo(end + 2, s * spread); x.lineTo(end - 2, s * spread); x.lineTo(end, s * wide * 0.3); x.closePath(); x.fill();
    }
    x.strokeStyle = c.vane; x.lineWidth = wide * 0.7; x.beginPath(); x.moveTo(end + vane * 0.8, 0); x.lineTo(end + 1, 0); x.stroke();
    x.fillStyle = '#1b1712'; x.beginPath(); x.ellipse(end - 0.5, 0, 1.2, wide * 0.55, 0, 0, TAU); x.fill();
  });
}
// A bird from above with its wings out, facing up: span 1 flat out, towards 0 pulled in.
function birdFlying(span, c, big) {
  const reach = (big ? 88 : 60) * (0.36 + 0.64 * span), chord = big ? 26 : 19;
  return picture(240, 160, (x) => {
    for (const s of [-1, 1]) {
      const feathers = big ? 10 : 7;
      for (let i = 0; i < feathers; i++) {
        const f = i / (feathers - 1), bx = s * (5 + (reach - 5) * f), by = -5 + 7 * f * f + 5 * (1 - span) * f, len = chord * (0.7 + 0.5 * Math.sin(f * 2.5)), ang = Math.PI / 2 + s * (-0.06 - 0.8 * f * f);
        x.save(); x.translate(bx, by); x.rotate(ang);
        x.fillStyle = f > 0.6 ? c.tip : c.wing; x.beginPath(); x.moveTo(0, -3.4); x.quadraticCurveTo(len * 0.7, -3.4, len, 0); x.quadraticCurveTo(len * 0.7, 3.4, 0, 3.4); x.closePath(); x.fill(); x.restore();
      }
      x.fillStyle = c.top; x.beginPath(); x.moveTo(s * 3, -9); x.quadraticCurveTo(s * (8 + reach * 0.5), -14, s * reach, -3 + 5 * (1 - span)); x.quadraticCurveTo(s * reach * 0.5, 5, s * 3, 6); x.closePath(); x.fill();
    }
    x.fillStyle = c.wing; x.beginPath(); x.moveTo(-5, 10); x.lineTo(big ? -9 : -6, 30); x.quadraticCurveTo(0, 35, big ? 9 : 6, 30); x.lineTo(5, 10); x.closePath(); x.fill();
    x.fillStyle = c.top; x.beginPath(); x.ellipse(0, 1, big ? 8.5 : 6.2, big ? 16 : 13.5, 0, 0, TAU); x.fill();
    if (c.neck) { x.fillStyle = c.neck; x.beginPath(); x.ellipse(0, -13, 5.5, 3.6, 0, 0, TAU); x.fill(); }
    x.fillStyle = c.head; x.beginPath(); x.ellipse(0, big ? -18 : -14, 4, 5, 0, 0, TAU); x.fill();
    x.fillStyle = c.beak; const b = big ? -23 : -19; x.beginPath(); x.moveTo(-1.5, b); x.lineTo(0, b - 5); x.lineTo(1.5, b); x.closePath(); x.fill();
  });
}
// A bird on the ground with its wings folded, facing up. peck: its head stretched down to the ground in front of it.
function birdStanding(peck, c) {
  return picture(72, 96, (x) => {
    x.fillStyle = c.tip; x.beginPath(); x.moveTo(-4, 9); x.lineTo(-3, 30); x.lineTo(3, 30); x.lineTo(4, 9); x.closePath(); x.fill();
    x.fillStyle = c.top; x.beginPath(); x.ellipse(0, 2, 8.2, 15, 0, 0, TAU); x.fill();
    for (const s of [-1, 1]) { x.fillStyle = c.wing; x.beginPath(); x.moveTo(s * 3, -9); x.quadraticCurveTo(s * 10, 3, s * 2.5, 24); x.quadraticCurveTo(s * 2, 6, s * 3, -9); x.fill(); }
    const hy = peck ? -22 : -15;
    if (c.neck) { x.fillStyle = c.neck; x.beginPath(); x.ellipse(0, -11, 6.5, 4, 0, 0, TAU); x.fill(); }
    if (peck) { x.strokeStyle = c.head; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(0, -11); x.lineTo(0, hy); x.stroke(); }
    x.fillStyle = c.head; x.beginPath(); x.ellipse(0, hy, 4.2, 5, 0, 0, TAU); x.fill();
    x.fillStyle = c.beak; x.beginPath(); x.moveTo(-1.7, hy - 4); x.lineTo(0, hy - 10); x.lineTo(1.7, hy - 4); x.closePath(); x.fill();
  });
}
// A soft dark patch for a bird's shadow.
const softShadow = () => picture(64, 64, (x) => { const g = x.createRadialGradient(0, 0, 2, 0, 0, 30); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 30, 0, TAU); x.fill(); });
// A fly: a dark speck, with the blur of its wings on the upbeat.
const speckPicture = (wings) => picture(16, 16, (x) => { if (wings) { x.fillStyle = 'rgba(190,195,200,0.5)'; x.beginPath(); x.ellipse(0, 0, 5.5, 2.2, 0, 0, TAU); x.fill(); } x.fillStyle = '#121214'; x.beginPath(); x.arc(0, 0, 2.2, 0, TAU); x.fill(); });

/**
 * The layer. stick({ x, y, angle, kind, into, seed }) leaves a shot where it landed (`angle` the way it flew, radians, 0 along +x as a
 * sprite turns); stickInto(tokenId, { dx, dy, angle, kind, seed }) one in a creature (`dx`, `dy` px from its centre), dropFrom(tokenId)
 * takes those out again. `lifetime` seconds (null: until clear()). body({ id, x, y, size, outdoors }), bodyGone(id). noise({ x, y, radius }).
 * tick(seconds, { near, day, cold, rain, view, seen, tokens, cast, sound, grid }): `near` [{ id, x, y }] of everyone about (one with the
 * id of a body does not count); `tokens(id)` { x, y, w, h, visible } or null, x and y its top left. clear(). `floor` and `sky` are
 * containers or functions returning one: shots in the world and birds on the ground on the floor; flies, fliers and shots in
 * creatures over all.
 */
export function createAftermath({ PIXI, floor, sky, grid: startGrid = 100, cap = SHOT_CAP, lifetime: startLifetime = null }) {
  let shots = [], bodies = new Map(), noises = [], grid = startGrid, time = 0, specksShown = 0, textures = null;
  const keepFor = (s) => (s > 0 && Number.isFinite(s) ? s : null);
  let lifetime = keepFor(startLifetime);
  const root = (layer) => (typeof layer === 'function' ? layer() : layer);
  const art = () => {
    if (textures && !textures.speck[0].baseTexture?.destroyed) return textures;
    const tex = (c) => PIXI.Texture.from(c);
    const flock = (c, big) => ({ fly: SPANS.map((s) => tex(birdFlying(s, c, big))), stand: [false, true].map((p) => tex(birdStanding(p, c))) });
    const shafts = (list) => ({ wall: list.map((c) => tex(shotPicture(c, false))), floor: list.map((c) => tex(shotPicture(c, true))) });
    return (textures = { arrow: shafts(ARROWS), bolt: shafts(BOLTS), crow: flock(CROW, false), vulture: flock(VULTURE, true), shadow: tex(softShadow()), speck: [true, false].map((w) => tex(speckPicture(w))) });
  };
  const sprite = (parent, tex, anchorX = 0.5) => { const s = new PIXI.Sprite(tex); s.anchor.set(anchorX, 0.5); s.eventMode = 'none'; s.visible = false; parent.addChild(s); return s; };
  const gone = (...sprites) => { for (const s of sprites) { try { s?.destroy(); } catch { /* gone */ } } };
  const hide = (...sprites) => { for (const s of sprites) if (s) s.visible = false; };
  const put = (s, tex, x, y, angle, size, alpha) => { s.visible = true; if (s.texture !== tex) s.texture = tex; s.position.set(x, y); s.rotation = angle; s.scale.set(size); s.alpha = alpha; };
  const dropBird = (q) => gone(q.view, q.shade);
  const dropBody = (o) => { for (const q of o.crows) dropBird(q); gone(...o.specks); };
  const newShot = ({ kind, into, angle = 0, seed, ...rest }) => {
    const random = seedRandom(seed), sort = kind === 'bolt' ? 'bolt' : 'arrow';
    const shot = { kind: sort, into: into === 'wall' ? 'wall' : 'floor', angle, lean: between(random, -0.05, 0.05), pick: random(), size: between(random, 0.92, 1.08), age: 0, view: null, ...rest };
    const { kept, dropped } = capShots([...shots, shot], cap);
    for (const s of dropped) gone(s.view);
    shots = kept;
  };
  const drop = () => { for (const s of shots) gone(s.view); for (const o of bodies.values()) dropBody(o); shots = []; bodies = new Map(); noises = []; specksShown = 0; };
  return {
    stick({ x, y, angle = 0, kind = 'arrow', into = 'floor', seed } = {}) { newShot({ x, y, angle, kind, into, seed: seed ?? `${Math.round(x)}:${Math.round(y)}` }); },
    // A shot in a creature shows as one in a wall does, nearly all of it on our side.
    stickInto(tokenId, { dx = 0, dy = 0, angle = 0, kind = 'arrow', seed } = {}) { newShot({ tokenId, dx, dy, angle, kind, into: 'wall', seed: seed ?? `${tokenId}:${Math.round(dx)}:${Math.round(dy)}` }); },
    dropFrom(tokenId) { shots = shots.filter((s) => { if (s.tokenId !== tokenId) return true; gone(s.view); return false; }); },
    get lifetime() { return lifetime; },
    set lifetime(seconds) { lifetime = keepFor(seconds); },
    // The same id again moves it on (a creature picked up and laid down elsewhere) and keeps its age.
    body({ id, x, y, size = 1, outdoors = false } = {}) {
      const ring = (size * grid) / 2 + grid * 0.35;
      const was = bodies.get(id);
      if (was) { Object.assign(was, { x, y, size, outdoors, leaving: false, big: size >= VULTURE_FROM }); for (const q of was.crows) { q.tx = x; q.ty = y; q.ring = ring; } return; }
      const random = seedRandom(id);
      bodies.set(id, { id, x, y, size, outdoors, big: size >= VULTURE_FROM, age: 0, level: 0, lift: 0, wasClose: false, leaving: false, random, paths: Array.from({ length: 9 }, () => speckPath(random)), specks: [], crows: [] });
    },
    // It got up or was taken away: the flies thin out and the birds leave.
    bodyGone(id) { const o = bodies.get(id); if (o) o.leaving = true; },
    noise({ x, y, radius }) { if (this.busy) noises.push({ x, y, r: radius, t: 0 }); },
    tick(seconds, { near = [], day = 1, cold = false, rain = 0, view = null, seen = () => true, tokens = () => null, cast = null, sound = () => {}, grid: g = grid } = {}) {
      if (!this.busy) return;
      grid = g;
      const dt = Math.min(0.05, seconds), k = grid / 100; time += dt;
      if (noises.length) { for (const n of noises) n.t += dt; noises = noises.filter((n) => n.t * NOISE_SPEED * grid < n.r + grid * 3); }
      const heard = (x, y) => (noises.length ? noiseReaching(noises, x, y, { grid }) : null);
      const inView = (x, y, m = grid * 2) => !view || (x > view.x - m && y > view.y - m && x < view.x + view.w + m && y < view.y + view.h + m);
      // Only what is in view gets asked whether it can be seen, and each a few times a second, not all on the same frame.
      const can = (o, x, y, m) => {
        if (!inView(x, y, m)) return false;
        if (time >= (o.lookAt ?? 0)) { o.lookAt = time + 0.2 + Math.random() * 0.2; try { o.seen = seen(x, y) !== false; } catch { o.seen = true; } }
        return o.seen !== false;
      };
      const t = art();
      shots = shots.filter((s) => {
        s.age += seconds;
        const fade = shotFade(s.age, lifetime);
        if (fade <= 0) { gone(s.view); return false; }
        let x = s.x, y = s.y, shows;
        if (s.tokenId !== undefined) {
          const who = tokens(s.tokenId);
          shows = !!who && who.visible !== false;
          if (shows) { x = who.x + who.w / 2 + s.dx; y = who.y + who.h / 2 + s.dy; shows = inView(x, y); }
        } else shows = can(s, x, y);
        if (!shows) { hide(s.view); return true; }
        const list = t[s.kind][s.into], tex = list[Math.floor(s.pick * list.length) % list.length];
        s.view ??= sprite(root(s.tokenId !== undefined ? sky : floor), tex, TIP_ANCHOR);
        put(s.view, tex, x, y, s.angle + s.lean + shotQuiver(s.age), 0.5 * k * s.size, fade);
        return true;
      });
      const living = near.filter((n) => n.id == null || !bodies.has(n.id));
      const fall = shadowKeeper(cast ?? ((x, y, { lift = 0 } = {}) => ({ dx: grid * (0.03 + lift * 0.4) * 0.62, dy: grid * (0.03 + lift * 0.4) * 0.78, alpha: 0.5 })), time);
      let specksLeft = MOST_SPECKS, birds = 0;
      for (const o of bodies.values()) birds += o.crows.length;
      specksShown = 0;
      for (const o of [...bodies.values()]) {
        o.age += seconds;
        const stage = bodyStage(o.age, { outdoors: o.outdoors, day, cold, rain });
        // Flies: a crowd thins and gathers gently. Somebody coming up, or a noise, lifts them once.
        const close = !!scaredBy(o.x, o.y, { grid, near: living }), startled = !!heard(o.x, o.y) || (close && !o.wasClose); o.wasClose = close;
        o.lift = fliesLift(o.lift, { dt, startled });
        const target = o.leaving ? 0 : stage.flies;
        o.level += Math.max(-dt * 0.5, Math.min(dt * 0.5, target - o.level));
        const radius = grid * Math.max(0.5, o.size * 0.42), show = o.level > 0 && can(o, o.x, o.y, radius * 2);
        const count = show ? Math.min(specksLeft, speckCount(o.level)) : 0;
        specksLeft -= count; specksShown += count;
        for (let i = 0; i < Math.max(count, o.specks.length); i++) {
          if (i >= count) { hide(o.specks[i]); continue; }
          const at = speckAt(o.paths[i], o.age, { radius, lift: o.lift });
          o.specks[i] ??= sprite(root(sky), t.speck[0]);
          put(o.specks[i], t.speck[at.frame], o.x + at.x, o.y + at.y, i, 0.5 * k, at.alpha);
        }
        // Birds: a big body gets one vulture, the rest the crows it has drawn by now, while there is room for them.
        const want = o.leaving ? 0 : o.big ? Math.min(1, stage.crows) : stage.crows;
        const ring = (o.size * grid) / 2 + grid * 0.35;
        while (o.crows.length < want && birds < MOST_BIRDS) { o.crows.push(newCrow({ tx: o.x, ty: o.y, ring, at: o.random() * TAU, back: o.random() * 4 })); birds++; }
        const kept = [];
        o.crows.forEach((q0, i) => {
          const q = crowStep(q0, { dt, grid, near: living, noise: heard(q0.x, q0.y), leave: i >= want, random: o.random });
          if (q.mode === 'in' && q0.mode === 'gone') { const spot = spotOf(q); sound('crowCaw', spot); }
          if (q.mode === 'away' && q0.mode !== 'away') sound('wingsUp', { x: q.x, y: q.y });
          if (q.mode === 'gone' && i >= want) { dropBird(q); birds--; return; }
          kept.push(q);
          if (q.mode === 'gone' || !can(q, q.x, q.y)) { hide(q.view, q.shade); return; }
          const look = o.big ? t.vulture : t.crow, grown = o.big ? 1.15 : 1, air = q.mode !== 'ground';
          const tex = !air ? look.stand[q.peck > 0 ? 1 : 0] : q.mode === 'in' && q.h > 0.22 ? look.fly[0] : look.fly[Math.floor(time * (o.big ? 8 : 14)) % SPANS.length];
          q.view ??= sprite(root(air ? sky : floor), tex);
          q.shade ??= sprite(root(floor), t.shadow);
          // On the ground it is under the creatures, in the air over all of them.
          const home = root(air ? sky : floor); if (q.view.parent !== home) home.addChild(q.view);
          const c = fall(q, q.x, q.y, air ? { width: grid * 0.5 * grown, lift: 1.1 * Math.max(0.04, q.h) } : { width: grid * 0.2 * grown, body: 0.1, grounded: true });
          put(q.shade, t.shadow, q.x + c.dx, q.y + c.dy, 0, (air ? 0.95 : 0.55) * k * grown, Math.min(0.34, c.alpha * 0.42) * (air ? 0.75 : 1));
          put(q.view, tex, q.x, q.y, q.a, (air ? 0.42 * (0.8 + 0.2 * q.h) : 0.62 * (1 + q.h * 0.6)) * k * grown, 1);
        });
        o.crows = kept;
        if (o.leaving && !o.crows.length && o.level <= 0) { dropBody(o); bodies.delete(o.id); }
      }
    },
    clear() { drop(); },
    get busy() { return shots.length + bodies.size > 0; },
    get counts() {
      const crows = [...bodies.values()].flatMap((o) => o.crows);
      return { shots: shots.length, inCreatures: shots.filter((s) => s.tokenId !== undefined).length, bodies: bodies.size, specks: specksShown, crows: crows.filter((q) => q.mode !== 'gone').length, landed: crows.filter((q) => q.mode === 'ground').length, away: crows.filter((q) => q.mode === 'gone').length };
    },
  };
}
