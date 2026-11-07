// Blood on the floor. A hit throws it away from the attacker, shaped by the wound; a killing blow leaves a pool spreading.
// A wounded creature on its feet drops blood, walking or standing, more the worse it is hurt; one that is prone and moving
// drags a broken trail. It darkens as it dries, thins in the rain and clouds away in water. Drawn on each screen; only what a
// scene is told to keep is saved (dress). Dry marks are plain sprites nothing looks at again until they fade, so a floor full
// of them costs nothing but their draw.

import { bloodArt } from './blood-art.mjs';

const TAU = Math.PI * 2;
const rng = (text) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// How each kind of damage bleeds (pure): the shape of its spray and how much (times the usual); a damage type not listed
// (fire, cold, psychic, poison...) sears or leaves no wound to speak of, and throws none. Unknown damage: a plain blow.
const WOUNDS = Object.freeze({ slashing: { art: 'slash', much: 1, drops: 8, fan: 0.7, far: 1.1 }, bleed: { art: 'slash', much: 0.8, drops: 6, fan: 0.7, far: 0.8 }, piercing: { art: 'pierce', much: 1, drops: 5, fan: 0.18, far: 1.3 }, bludgeoning: { art: 'blunt', much: 0.8, drops: 6, fan: Math.PI, far: 0.58 }, force: { art: 'blunt', much: 0.7, drops: 5, fan: Math.PI, far: 0.58 }, sonic: { art: 'blunt', much: 0.5, drops: 4, fan: Math.PI, far: 0.5 } });
export const woundShape = (type) => (type === null || type === undefined || type === '' ? WOUNDS.bludgeoning : WOUNDS[String(type).toLowerCase()] ?? null);

// What a hit leaves (pure): `at` the creature, `from` the attacker (null: thrown any way), `type` the damage, `share` how much
// of its HP it lost (0–1), `crit`, `kill`. Marks: { art, n, x, y, rot, r, wait } and for a drop in flight { fromX, fromY, up }; a
// pool's `spreads` (ms). Empty for damage that throws no blood.
export function hitMarks({ at, from = null, type = null, share = 0.2, crit = false, kill = false, width = 100, grid = 100, seed = 'hit' } = {}) {
  const wound = woundShape(type);
  if (!wound) return kill ? [{ art: 'pool', n: 0, x: at.x, y: at.y + width * 0.04, rot: 0, r: width * 0.42, wait: 300, spreads: 2400 }] : [];
  const random = rng(`${seed}`), way = from ? Math.atan2(at.y - from.y, at.x - from.x) : random() * TAU;
  // Bigger the bigger the creature and the more it lost; a crit bigger and further.
  const body = Math.pow(Math.max(0.4, width / (grid || 100)), 0.7), hurt = 0.75 + 0.75 * Math.min(1, Math.max(0, Number(share) || 0)) / 0.4, size = grid * 0.9 * body * Math.min(1.25, hurt) * wound.much * (crit ? 1.35 : 1);
  const out = [], off = wound.art === 'blunt' ? 0 : width * 0.3, sx = at.x + Math.cos(way) * off, sy = at.y + Math.sin(way) * off;
  out.push({ art: wound.art, n: Math.floor(random() * 3), x: sx, y: sy, rot: way, r: size, wait: 60 });
  if (crit) out.push({ art: wound.art, n: Math.floor(random() * 3), x: sx + Math.cos(way) * size * 0.25, y: sy + Math.sin(way) * size * 0.25, rot: way + (random() - 0.5) * 0.5, r: size * 0.72, wait: 100 });
  const drops = Math.round(wound.drops * (crit ? 1.7 : 1));
  for (let i = 0; i < drops; i++) { const a = way + (random() - 0.5) * 2 * wound.fan, d = grid * wound.far * body * (crit ? 1.3 : 1) * (0.35 + random() * 0.65), big = Math.pow(random(), 2.5); out.push({ art: 'drop', n: Math.floor(random() * 4), x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d, fromX: at.x, fromY: at.y, up: grid * 0.14, rot: a, r: grid * (0.012 + big * 0.03), wait: random() * 80 }); }
  if (kill) out.unshift({ art: 'pool', n: Math.floor(random() * 2), x: at.x, y: at.y + width * 0.04, rot: random() * TAU, r: width * 0.48, wait: 450, spreads: 2400 });
  return out;
}

// What a wounded creature leaves over one stride (pure). On its feet: drops, in bursts, more the worse it is hurt (`tier`: 1
// from half its HP, 2 from a quarter or down), a heavier splash now and then. Prone and moving: a broken trail, blotches
// dragged along its path with gaps between them, off to one side, and drops by them. `run` (kept per creature by the caller,
// { left, gap, side }) is how far through a blotch's run it is.
export function bleedStep({ at, heading = 0, index = 0, tier = 1, prone = false, width = 100, grid = 100, stride = grid * 0.6, seed = '', run = {} } = {}) {
  const random = rng(`${seed}:${index}:blood`), across = heading + Math.PI / 2, out = [], unit = Math.pow(Math.max(0.4, width / (grid || 100)), 0.7) * grid, beside = (spread) => { const s = (random() - 0.5) * spread; return { x: at.x + Math.cos(across) * s, y: at.y + Math.sin(across) * s }; };
  if (prone) {
    if (!(run.left > 0) && !(run.gap > 0)) { run.left = 1 + Math.floor(random() * 2); run.of = run.left; run.side = (random() - 0.5) * unit * 0.26; }
    if (run.left > 0) { const thin = run.left / run.of, size = stride * (0.5 + random() * 0.28) * (0.6 + 0.4 * thin) * Math.max(1, unit / grid); out.push({ art: 'patch', n: Math.floor(random() * 4), x: at.x - Math.cos(heading) * stride * 0.5 + Math.cos(across) * (run.side ?? 0), y: at.y - Math.sin(heading) * stride * 0.5 + Math.sin(across) * (run.side ?? 0), rot: heading + (random() - 0.5) * 0.35, r: size, squash: 0.75 + random() * 0.45, alpha: 0.6 + 0.35 * thin }); run.left--; if (!run.left) run.gap = 1 + Math.floor(random() * 2); }
    else run.gap--;
    if (random() < 0.6) for (let i = 1 + Math.floor(random() * 2); i > 0; i--) out.push({ art: 'drop', n: Math.floor(random() * 4), ...beside(unit * 0.4), rot: heading + (random() - 0.5) * 0.4, r: grid * (0.03 + random() * 0.04) });
    return out;
  }
  // A scratch (tier under 1) leaves a drop here and there; tier 1 drips now and then; tier 2 bleeds freely, in bursts.
  const bursting = tier >= 2 ? random() < 0.4 : false, count = tier >= 2 ? (bursting ? 6 + Math.floor(random() * 6) : 1 + Math.floor(random() * 3)) : tier >= 1 ? (random() < 0.45 ? 1 + Math.floor(random() * 2) : 0) : (random() < 0.3 ? 1 : 0);
  for (let i = 0; i < count; i++) { const big = Math.pow(random(), 2.2), place = beside(unit * 0.38), along = (random() - 0.5) * stride; out.push({ art: 'drop', n: Math.floor(random() * 4), x: place.x + Math.cos(heading) * along, y: place.y + Math.sin(heading) * along, rot: heading + (random() - 0.5) * 0.3, r: grid * (0.032 + big * 0.09) }); }
  if (random() < (tier >= 2 ? 0.4 : tier >= 1 ? 0.12 : 0)) out.push({ art: 'drip', n: Math.floor(random() * 3), ...beside(unit * 0.24), rot: random() * TAU, r: grid * (0.06 + random() * 0.06) });
  return out;
}

// A scene dressed by hand (pure): old blood around a creature, as if something happened here. A stain under it, smears and
// splashes about it, drops scattered further. No flight and no spreading: it was here already.
export function splatMarks({ at, width = 100, grid = 100, seed = 'splat' } = {}) {
  const random = rng(`${seed}`), unit = Math.pow(Math.max(0.4, width / (grid || 100)), 0.7) * grid, around = (reach) => { const a = random() * TAU, d = (0.25 + random() * 0.75) * reach; return { x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d, rot: a }; };
  const out = [{ art: 'pool', n: Math.floor(random() * 2), x: at.x + (random() - 0.5) * unit * 0.2, y: at.y + (random() - 0.5) * unit * 0.2, rot: random() * TAU, r: unit * (0.45 + random() * 0.2) }];
  for (let i = 2 + Math.floor(random() * 2); i > 0; i--) out.push({ art: ['slash', 'blunt', 'patch'][Math.floor(random() * 3)], n: Math.floor(random() * 3), ...around(unit * 0.9), r: unit * (0.4 + random() * 0.4), squash: 0.75 + random() * 0.4 });
  for (let i = 8 + Math.floor(random() * 8); i > 0; i--) out.push({ art: 'drop', n: Math.floor(random() * 4), ...around(unit * 1.5), r: grid * (0.02 + Math.pow(random(), 2.2) * 0.07) });
  return out;
}

// How bloody the game is (pure): `amount` 1 as drawn, 0 none, up to 2. Stains grow and shrink with it; the small marks come
// and go with it, the same ones each time for the same seed.
const SMALL = new Set(['drop', 'drip']);
export function scaleMarks(marks = [], amount = 1, seed = 'blood') {
  const much = Math.max(0, Number.isFinite(Number(amount)) ? Number(amount) : 1);
  if (much === 1) return marks;
  if (!(much > 0)) return [];
  const random = rng(`${seed}:amount`), size = Math.sqrt(much), out = [];
  for (const mark of marks) {
    const roll = random(), more = random(), a = random() * TAU, d = random();
    if (!SMALL.has(mark.art)) { out.push({ ...mark, r: mark.r * size }); continue; }
    if (much < 1 && roll >= much) continue;
    out.push(mark);
    if (more < much - 1) out.push({ ...mark, x: mark.x + Math.cos(a) * mark.r * (2 + d * 4), y: mark.y + Math.sin(a) * mark.r * (2 + d * 4) });
  }
  return out;
}

// A creature standing and bleeding (pure): one drip under it, near its feet; `nextIn` seconds until the next, sooner the worse it is hurt.
export function standingDrip({ at, tier = 2, width = 100, grid = 100, random = Math.random } = {}) {
  const a = random() * TAU, d = random() * width * 0.3, big = Math.pow(random(), 2);
  return { mark: { art: random() < 0.5 ? 'drip' : 'drop', n: Math.floor(random() * 4), x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d * 0.8, rot: random() * TAU, r: grid * (0.04 + big * 0.06) }, nextIn: tier >= 2 ? 0.8 + random() * 1.7 : tier >= 1 ? 3.5 + random() * 4 : 12 + random() * 10 };
}

// A wet pool catching a light (pure): a soft reflection on the side toward the light, lying across the way to it, as bright
// as the light is there and fading as the pool dries. `light` { x, y, strength 0–1 } or null. null when it would not show.
export const POOL_DRIES = 45;
export function poolGleam(pool, light, age = 0) {
  const wet = 1 - Math.min(1, Math.max(0, age) / POOL_DRIES), strength = Math.min(1, Math.max(0, Number(light?.strength) || 0)) * wet;
  if (!light || strength < 0.03) return null;
  const a = Math.atan2(light.y - pool.y, light.x - pool.x), off = pool.r * 0.2;
  return { x: pool.x + Math.cos(a) * off, y: pool.y + Math.sin(a) * off * 0.88, rotation: a + Math.PI / 2, width: pool.r * 0.5, height: pool.r * 0.18, alpha: strength * 0.2 };
}

// Wet blood lit (pure): how strongly a stain shines in its own shape, by the light on it and how far it has dried. Every
// stain of any size shines; a drop or a drip is too small to matter.
const SHINES = new Set(['slash', 'pierce', 'blunt', 'patch', 'pool']);
export const bloodShines = (art) => SHINES.has(art);
export function bloodSheen(light, age = 0) {
  const shine = Math.min(1, Math.max(0, Number(light?.strength) || 0)) * (1 - Math.min(1, Math.max(0, age) / POOL_DRIES));
  return shine < 0.03 ? 0 : shine * 0.1;
}

// Blood drying (pure): the tint its stain has at `age` seconds, white when wet (as painted), a dull brown-black when dry.
// A tint multiplies the art, so this is the same for every colour of blood. `dries` seconds it takes.
export const DRIED = Object.freeze([0x70, 0x60, 0x58]);
export function driedTint(age = 0, dries = POOL_DRIES) {
  const u = Math.min(1, Math.max(0, Number(age) || 0) / Math.max(1, Number(dries) || POOL_DRIES));
  const [r, g, b] = DRIED.map((v) => Math.round(255 + (v - 255) * u));
  return (r << 16) | (g << 8) | b;
}

// Rain on blood (pure): how much of it has gone (0–1) after `seconds` of `rain` (0–1). Hard rain clears it in about three minutes;
// a shower leaves it thinner, and what is left stays when the rain stops.
export const WASH_SECONDS = 180;
export const washAfter = (washed = 0, rain = 0, seconds = 0) => Math.min(1, Math.max(0, Number(washed) || 0) + Math.max(0, Number(rain) || 0) * Math.max(0, Number(seconds) || 0) / WASH_SECONDS);

// Blood in water (pure): it clouds out and thins until it is gone, carried along by a flowing river. `water` { flow (map
// angle, null for still water), current ('swift', 'slow', 'slower' or anything else: gentle) }. Squares a second become
// pixels; `life` seconds, sooner in fast water.
const CURRENT = Object.freeze({ swift: 0.6, slow: 0.14, slower: 0.07 });
export function waterDrift(water, grid = 100) {
  const flows = Number.isFinite(water?.flow), pace = CURRENT[water?.current] ?? 0.28, speed = flows ? pace * grid : 0;
  return { vx: flows ? Math.cos(water.flow) * speed : 0, vy: flows ? Math.sin(water.flow) * speed : 0, grow: 0.09, life: flows && pace >= CURRENT.swift ? 11 : 22 };
}

// How blood in water looks as it goes (pure), `u` 0-1 of its life: never a whole pool's stain, a cloud at most a couple of squares across at first, drawn out along a current as it thins, spreading evenly in still water. Sizes as multiples of where it began.
export const DRIFT_MOST = 2.2;
export const driftLook = (u, flows = false) => { const t = Math.min(1, Math.max(0, Number(u) || 0)); return { along: 1 + (flows ? 3.2 : 1.3) * t, across: 1 + (flows ? 0.7 : 1.3) * t, alpha: 0.55 * (1 - t) * (1 - t * 0.35) }; };

// A saved mark as few characters as will do (pure), and back; what bloody scenes keep in their flags. `at`: when it was made, for one that starts wet and dries; none: long dry.
export const packMark = (m) => { const packed = [m.art, m.n ?? 0, Math.round(m.x), Math.round(m.y), Math.round((m.rot ?? 0) * 100) / 100, Math.round((m.r ?? 0) * 10) / 10, Math.round((m.squash ?? 1) * 100) / 100, Math.round((m.alpha ?? 1) * 100) / 100, m.color ?? 0x7a0d0d]; if (m.level) return [...packed, Number.isFinite(m.at) ? m.at : null, m.level]; return Number.isFinite(m.at) ? [...packed, m.at] : packed; };
export const unpackMark = (p) => (Array.isArray(p) && typeof p[0] === 'string' ? { art: p[0], n: p[1], x: p[2], y: p[3], rot: p[4], r: p[5], squash: p[6], alpha: p[7], color: p[8], ...(Number.isFinite(p[9]) ? { at: p[9] } : {}), ...(p[10] ? { level: p[10] } : {}) } : null);

// Whether a mark shows (pure): on the level it fell on. One that says none (saved before blood knew its level) shows on all of them.
export const bloodShows = (mark, viewed) => !mark?.level || !viewed || mark.level === viewed;

/** The layer: add(marks, color, level) lays them, on that level (a drop in flight lands first); tick(seconds); dress(saved marks) what a scene keeps; near(x, y) wet blood underfoot; clear(). `root()` the floor layer; `life` seconds a mark lasts (Infinity: until cleared); `most` marks at once (a number or a function), the oldest going first; `rain()` how hard it rains on the scene, `exposed(x, y)` whether it falls there; `waterAt(x, y)` the water there, for waterDrift, or null; `art` draws a mark; `viewedLevel()` the level on screen; `now()` the time blood lying on the floor goes by, in seconds (the game clock: it dries, fades and washes as the game's time passes, and not at all while it stands still), else as the layer ticks. A spray landing and blood clouding in water are motion, and always go as the layer ticks. */
export function createFloorBlood({ PIXI, root, glow = null, lightAt = () => null, life = () => 300, most = 320, rain = () => 0, exposed = () => true, waterAt = () => null, grid = () => 100, art = bloodArt, now = null, viewedLevel = () => null }) {
  const textures = new Map();
  let lying = [], moving = [], drifting = [], clock = 0, fadeLook = 0, gleamTex = null, washLook = null, lastViewed = null;
  const viewedNow = () => { try { return viewedLevel() ?? null; } catch { return null; } };
  const hideShine = (m) => { if (m.sheen) m.sheen.visible = false; if (m.gleam) m.gleam.visible = false; };
  const timeNow = () => { if (typeof now !== 'function') return clock; const t = Number(now()); return Number.isFinite(t) ? t : clock; };
  const dressed = new Map();
  // The light on a pool: one soft white oval, shared, tinted by the light. Added to the light, over the darkness.
  const gleamTexture = () => { if (gleamTex && !gleamTex.baseTexture?.destroyed) return gleamTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), f = g.createRadialGradient(32, 32, 0, 32, 32, 32); f.addColorStop(0, 'rgba(255,255,255,1)'); f.addColorStop(0.5, 'rgba(255,255,255,0.35)'); f.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = f; g.fillRect(0, 0, 64, 64); return (gleamTex = PIXI.Texture.from(c)); };
  const lookAtLight = (m, age) => {
    if (m.s.visible === false) { hideShine(m); return; }
    const l = lightAt(m.mark.x, m.mark.y), tint = Number.isFinite(l?.color) ? l.color : 0xffc890, sheen = bloodSheen(l, age);
    // The stain itself shining where the light falls on it, in its own shape.
    if (!sheen) { if (m.sheen) m.sheen.visible = false; }
    else if (glow) {
      if (!m.sheen) { m.sheen = new PIXI.Sprite(m.s.texture); m.sheen.anchor.set(0.5); m.sheen.eventMode = 'none'; m.sheen.blendMode = PIXI.BLEND_MODES.ADD; m.sheen.position.copyFrom(m.s.position); m.sheen.rotation = m.s.rotation; m.sheen.width = m.s.width; m.sheen.height = m.s.height; glow().addChild(m.sheen); }
      m.sheen.visible = true; m.sheen.alpha = sheen * m.s.alpha; m.sheen.tint = tint;
    }
    // A pool lying wet also holds a small reflection of the light.
    if (m.mark.art !== 'pool') return;
    const shown = poolGleam({ x: m.mark.x, y: m.mark.y, r: m.r }, l, age);
    if (!shown) { if (m.gleam) m.gleam.visible = false; return; }
    if (!m.gleam) { if (!glow) return; m.gleam = new PIXI.Sprite(gleamTexture()); m.gleam.anchor.set(0.5); m.gleam.eventMode = 'none'; m.gleam.blendMode = PIXI.BLEND_MODES.ADD; glow().addChild(m.gleam); }
    m.gleam.visible = true; m.gleam.position.set(shown.x, shown.y); m.gleam.rotation = shown.rotation; m.gleam.width = shown.width; m.gleam.height = shown.height; m.gleam.alpha = shown.alpha * Math.min(1, m.s.alpha * 1.5); m.gleam.tint = tint;
  };
  const textureOf = (kind, n, color) => { const canvas = art(kind, n, color); if (!canvas) return null; let tex = textures.get(canvas); if (!tex || tex.baseTexture?.destroyed) textures.set(canvas, tex = PIXI.Texture.from(canvas)); return tex; };
  const gone = (m) => { try { m.s.destroy(); m.gleam?.destroy(); m.sheen?.destroy(); } catch { /* gone */ } };
  const mostNow = () => { const n = typeof most === 'function' ? most() : most; return Number(n) > 0 ? Number(n) : 320; };
  // Each water's blood drawn apart: kept to its shape (`water.areas`, nothing runs up the bank) and softened, a cloud in the water and not a stain on it. Only while some is there.
  const clouds = new Map();
  // Fresh blood kept with the scene that lands on water: it clouds away once, as it arrives; what was already there as the scene loaded does not play again.
  const seenOnWater = new Set(); let dressedOnce = false;
  const cloudOf = (water) => {
    if (!water?.areas?.length || !water.id || typeof PIXI.Container !== 'function' || typeof PIXI.Graphics !== 'function') return null;
    let c = clouds.get(water.id);
    if (c && !c.destroyed) return c;
    c = new PIXI.Container(); c.eventMode = 'none';
    const shape = new PIXI.Graphics(); shape.beginFill(0xffffff, 1);
    for (const area of water.areas) { shape.drawPolygon(area); for (const hole of area.holes ?? []) { shape.beginHole(); shape.drawPolygon(hole); shape.endHole(); } }
    shape.endFill(); c.addChild(shape); c.mask = shape;
    if (typeof PIXI.BlurFilter === 'function') c.filters = [new PIXI.BlurFilter(Math.max(4, grid() * 0.05))];
    root().addChild(c); clouds.set(water.id, c);
    return c;
  };
  const dropClouds = (all = false) => { for (const [id, c] of clouds) if (all || !drifting.some((m) => m.drift.cloud === c)) { try { c.parent?.removeChild(c); c.destroy({ children: true }); } catch { /* gone */ } clouds.delete(id); } };
  // What lands on water does not lie there: it drifts off, clouding as it goes.
  const layDown = (m) => {
    let water = null;
    try { water = waterAt(m.mark.x, m.mark.y); } catch { /* the regions are being rebuilt */ }
    if (water) {
      // Not the stain's own shape: a soft cloud, turned to lie along the current.
      const most = grid() * DRIFT_MOST, flows = Number.isFinite(water.flow), cloud = cloudOf(water), wide = Math.min(most, m.s.width), deep = Math.min(most, m.s.height);
      m.drift = { ...waterDrift(water, grid()), age: 0, x: m.mark.x, y: m.mark.y, width: wide, height: deep, flows, cloud };
      if (flows) m.s.rotation = water.flow;
      if (cloud) cloud.addChild(m.s);
      drifting.push(m); return;
    }
    m.laid = timeNow(); lying.push(m); const cap = mostNow(); while (lying.length > cap) gone(lying.shift());
  };
  const sprite = (mark, color) => {
    const tex = textureOf(mark.art, mark.n, color); if (!tex) return null;
    const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.eventMode = 'none'; s.visible = bloodShows(mark, viewedNow()); s.rotation = mark.rot ?? 0; s.alpha = 0; s.position.set(mark.fromX ?? mark.x, mark.fromY ?? mark.y);
    const r = mark.r, across = r * (mark.squash ?? 1); s.width = r * 2; s.height = across * 2; root().addChild(s);
    return { s, mark, color, r, across, alpha: mark.alpha ?? 1, born: clock + (mark.wait ?? 0) / 1000, washed: 0 };
  };
  return {
    add(marks = [], color = 0x7a0d0d, level = null) {
      for (const given of marks) {
        const mark = level ? { ...given, level } : given, m = sprite(mark, color); if (!m) continue;
        if (mark.wait || mark.fromX !== undefined || mark.spreads) moving.push(m); else { m.s.alpha = m.alpha; layDown(m); }
      }
    },
    // What the scene keeps (saved marks with their own colours): wet at first if it says when it was made, then dry, costing nothing after that, and only the rest
    // of the list changes when it changes. Neither time nor rain takes it; Clear blood does.
    dress(saved = []) {
      // (Nothing lies on water, though what is saved stays saved for when it freezes or drains.)
      const onWater = (mark) => { try { return !!waterAt(mark.x, mark.y); } catch { return false; } };
      const want = new Map();
      for (const mark of saved) {
        if (!mark) continue;
        if (!onWater(mark)) { want.set(packMark(mark).join(), mark); continue; }
        const id = packMark(mark).join();
        if (seenOnWater.has(id)) continue;
        seenOnWater.add(id);
        if (dressedOnce && Number.isFinite(mark.at)) { const m = sprite(mark, mark.color); if (m) { m.s.alpha = m.alpha; layDown(m); } }
      }
      dressedOnce = true;
      for (const [id, m] of dressed) if (!want.has(id)) { gone(m); dressed.delete(id); }
      for (const [id, mark] of want) {
        if (dressed.has(id)) continue;
        const m = sprite(mark, mark.color); if (!m) continue;
        const age = Number.isFinite(mark.at) ? Math.max(0, timeNow() - mark.at) : POOL_DRIES;
        m.laid = Number.isFinite(mark.at) ? mark.at : -Infinity; m.dry = age >= POOL_DRIES;
        m.s.alpha = m.alpha; m.s.tint = driedTint(age); dressed.set(id, m);
      }
    },
    // The marks lying now, to be kept.
    snapshot() { return lying.filter((m) => !m.s.destroyed && m.washed < 0.5).map((m) => ({ ...m.mark, color: m.color })); },
    // Wet blood at a place, for the feet that step in it: its colour and how wet (0–1), or null. Only what can be stepped in.
    near(x, y) {
      const all = [...dressed.values(), ...lying];
      for (let i = all.length - 1; i >= 0; i--) {
        const m = all[i]; if (!bloodShines(m.mark.art) || m.dry || m.washed > 0.5 || m.s.visible === false) continue;
        if (Math.hypot(x - m.mark.x, y - m.mark.y) > m.r * 0.9) continue;
        return { color: m.color, wet: Math.max(0, 1 - (timeNow() - m.laid) / POOL_DRIES) };
      }
      return null;
    },
    tick(seconds) {
      clock += seconds;
      // Another level on screen: its own blood, and only that. Nothing to do on the frames between.
      const viewed = viewedNow();
      if (viewed !== lastViewed) { lastViewed = viewed; for (const m of [...lying, ...moving, ...drifting, ...dressed.values()]) { m.s.visible = bloodShows(m.mark, viewed); if (!m.s.visible) hideShine(m); } }
      if (drifting.length) drifting = drifting.filter((m) => {
        if (m.s.destroyed) return false;
        const d = m.drift; d.age += seconds; if (d.age >= d.life) { gone(m); return false; }
        const u = d.age / d.life, look = driftLook(u, d.flows); d.x += d.vx * seconds; d.y += d.vy * seconds;
        m.s.position.set(d.x, d.y); m.s.width = d.width * look.along; m.s.height = d.height * look.across; m.s.alpha = m.alpha * look.alpha; return true;
      });
      if (clouds.size) dropClouds();
      if (moving.length) moving = moving.filter((m) => {
        if (m.s.destroyed) return false;
        const age = clock - m.born; if (age < 0) return true;
        const k = m.mark;
        if (k.fromX !== undefined) { const u = Math.min(1, age / 0.24), e = 1 - (1 - u) * (1 - u); m.s.position.set(k.fromX + (k.x - k.fromX) * e, k.fromY + (k.y - k.fromY) * e - Math.sin(u * Math.PI) * k.up); m.s.alpha = m.alpha; if (u >= 1) { layDown(m); return false; } return true; }
        if (k.spreads) { const u = Math.min(1, age / (k.spreads / 1000)), g = 0.2 + 0.8 * (1 - (1 - u) * (1 - u)); m.s.width = m.r * 2 * g; m.s.height = m.across * 2 * g; m.s.alpha = m.alpha; if (u >= 1) { layDown(m); return false; } return true; }
        m.s.alpha = m.alpha; layDown(m); return false;
      });
      // The marks fade over the last part of their life; looked at twice a second, not every frame.
      if (clock - fadeLook < 0.5) return;
      fadeLook = clock;
      // (The clock set back counts as no time gone, not as blood growing younger.)
      const time = timeNow(), since = washLook === null ? 0 : Math.max(0, time - washLook); washLook = time;
      // What the scene keeps dries as any blood does; it is only never taken away.
      for (const m of dressed.values()) {
        if (m.dry || m.s.destroyed) continue;
        const age = Math.max(0, time - m.laid);
        m.s.tint = driedTint(age);
        if (bloodShines(m.mark.art)) lookAtLight(m, age);
        if (age >= POOL_DRIES) m.dry = true;
      }
      const last = Math.max(10, Number(life()) || 300), forever = last === Infinity, fade = last * 0.25, dries = Math.min(POOL_DRIES, last * 0.75);
      let falling = 0; try { falling = Math.max(0, Number(rain()) || 0); } catch { /* no sky yet */ }
      lying = lying.filter((m) => {
        if (m.s.destroyed) return false;
        const age = Math.max(0, time - m.laid); if (age >= last) { gone(m); return false; }
        // Rain thins what it falls on, under the open sky only; asked once a mark, as a mark stays where it is.
        if (falling > 0.02) { if (m.open === undefined) { try { m.open = exposed(m.mark.x, m.mark.y) !== false; } catch { m.open = true; } } if (m.open) { m.washed = washAfter(m.washed, falling, since); if (m.washed >= 1) { gone(m); return false; } } }
        if (m.washed > 0 || (!forever && age > last - fade)) m.s.alpha = m.alpha * (1 - m.washed) * (!forever && age > last - fade ? (last - age) / fade : 1);
        if (m.dry) return true;
        m.s.tint = driedTint(age, dries);
        if (bloodShines(m.mark.art)) lookAtLight(m, age);
        // Dry: a plain sprite nothing looks at again but its fading.
        if (age >= POOL_DRIES) m.dry = true;
        return true;
      });
    },
    // Everything; or given a level, what shows on it, leaving the other levels' blood where it lies.
    clear(level = null) {
      if (level) {
        const stays = (m) => { if (m.mark.level && m.mark.level !== level) return true; gone(m); return false; };
        lying = lying.filter(stays); moving = moving.filter(stays); drifting = drifting.filter(stays);
        for (const [id, m] of dressed) if (!stays(m)) dressed.delete(id);
        dropClouds(); return;
      }
      for (const m of [...lying, ...moving, ...drifting, ...dressed.values()]) gone(m); lying = []; moving = []; drifting = []; dressed.clear(); dropClouds(true); seenOnWater.clear(); dressedOnce = false;
    },
    get count() { return lying.length + moving.length + drifting.length + dressed.size; },
  };
}
