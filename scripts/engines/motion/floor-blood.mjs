// Blood on the floor. A hit throws it away from the attacker, shaped by the wound; a killing blow leaves a pool spreading.
// A wounded creature on its feet drops blood, walking or standing, more the worse it is hurt; one that is prone and moving
// drags a broken trail. Drawn on each screen and never saved: settled marks are plain sprites nothing looks at again until
// they fade, so a floor full of them costs nothing but their draw.

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

// A creature standing and bleeding (pure): one drip under it, near its feet; `nextIn` seconds until the next, sooner the worse it is hurt.
export function standingDrip({ at, tier = 2, width = 100, grid = 100, random = Math.random } = {}) {
  const a = random() * TAU, d = random() * width * 0.3, big = Math.pow(random(), 2);
  return { mark: { art: random() < 0.5 ? 'drip' : 'drop', n: Math.floor(random() * 4), x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d * 0.8, rot: random() * TAU, r: grid * (0.04 + big * 0.06) }, nextIn: tier >= 2 ? 0.8 + random() * 1.7 : tier >= 1 ? 3.5 + random() * 4 : 12 + random() * 10 };
}

// A wet pool catching a light (pure): a soft reflection on the side toward the light, lying across the way to it, as bright
// as the light is there and fading as the pool dries. `light` { x, y, strength 0–1 } or null. null when it would not show.
export const POOL_DRIES = 120;
export function poolGleam(pool, light, age = 0) {
  const wet = 1 - Math.min(1, Math.max(0, age) / POOL_DRIES), strength = Math.min(1, Math.max(0, Number(light?.strength) || 0)) * wet;
  if (!light || strength < 0.03) return null;
  const a = Math.atan2(light.y - pool.y, light.x - pool.x), off = pool.r * 0.2;
  return { x: pool.x + Math.cos(a) * off, y: pool.y + Math.sin(a) * off * 0.88, rotation: a + Math.PI / 2, width: pool.r * 0.8, height: pool.r * 0.3, alpha: strength * 0.42 };
}

// Wet blood lit (pure): how strongly a stain shines in its own shape, by the light on it and how far it has dried. Every
// stain of any size shines; a drop or a drip is too small to matter.
const SHINES = new Set(['slash', 'pierce', 'blunt', 'patch', 'pool']);
export const bloodShines = (art) => SHINES.has(art);
export function bloodSheen(light, age = 0) {
  const shine = Math.min(1, Math.max(0, Number(light?.strength) || 0)) * (1 - Math.min(1, Math.max(0, age) / POOL_DRIES));
  return shine < 0.03 ? 0 : shine * 0.32;
}

/** The layer: add(marks, color) lays them (a drop in flight lands first); tick(seconds); clear(). `root()` the floor layer; `life` seconds a mark lasts; `most` marks at once, the oldest going first. */
export function createFloorBlood({ PIXI, root, glow = null, lightAt = () => null, life = () => 180, most = 320 }) {
  const textures = new Map();
  let lying = [], moving = [], clock = 0, fadeLook = 0, gleamTex = null;
  // The light on a pool: one soft white oval, shared, tinted by the light. Added to the light, over the darkness.
  const gleamTexture = () => { if (gleamTex && !gleamTex.baseTexture?.destroyed) return gleamTex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), f = g.createRadialGradient(32, 32, 0, 32, 32, 32); f.addColorStop(0, 'rgba(255,255,255,1)'); f.addColorStop(0.5, 'rgba(255,255,255,0.35)'); f.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = f; g.fillRect(0, 0, 64, 64); return (gleamTex = PIXI.Texture.from(c)); };
  const lookAtLight = (m, age) => {
    const l = lightAt(m.mark.x, m.mark.y), tint = Number.isFinite(l?.color) ? l.color : 0xffc890, sheen = bloodSheen(l, age);
    // The stain itself shining where the light falls on it, in its own shape.
    if (!sheen) { if (m.sheen) m.sheen.visible = false; }
    else if (glow) {
      if (!m.sheen) { m.sheen = new PIXI.Sprite(m.s.texture); m.sheen.anchor.set(0.5); m.sheen.eventMode = 'none'; m.sheen.blendMode = PIXI.BLEND_MODES.ADD; m.sheen.position.copyFrom(m.s.position); m.sheen.rotation = m.s.rotation; m.sheen.width = m.s.width; m.sheen.height = m.s.height; glow().addChild(m.sheen); }
      m.sheen.visible = true; m.sheen.alpha = sheen * m.s.alpha; m.sheen.tint = tint;
    }
    // A pool or a smear lying wet also holds the light's reflection.
    if (m.mark.art !== 'pool' && m.mark.art !== 'patch') return;
    const shown = poolGleam({ x: m.mark.x, y: m.mark.y, r: m.r }, l, age);
    if (!shown) { if (m.gleam) m.gleam.visible = false; return; }
    if (!m.gleam) { if (!glow) return; m.gleam = new PIXI.Sprite(gleamTexture()); m.gleam.anchor.set(0.5); m.gleam.eventMode = 'none'; m.gleam.blendMode = PIXI.BLEND_MODES.ADD; glow().addChild(m.gleam); }
    m.gleam.visible = true; m.gleam.position.set(shown.x, shown.y); m.gleam.rotation = shown.rotation; m.gleam.width = shown.width; m.gleam.height = shown.height; m.gleam.alpha = shown.alpha * Math.min(1, m.s.alpha * 1.5); m.gleam.tint = tint;
  };
  const textureOf = (art, n, color) => { const canvas = bloodArt(art, n, color); if (!canvas) return null; let tex = textures.get(canvas); if (!tex || tex.baseTexture?.destroyed) textures.set(canvas, tex = PIXI.Texture.from(canvas)); return tex; };
  const gone = (m) => { try { m.s.destroy(); m.gleam?.destroy(); m.sheen?.destroy(); } catch { /* gone */ } };
  const layDown = (m) => { lying.push(m); while (lying.length > most) gone(lying.shift()); };
  return {
    add(marks = [], color = 0x7a0d0d) {
      for (const mark of marks) {
        const tex = textureOf(mark.art, mark.n, color); if (!tex) continue;
        const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.eventMode = 'none'; s.rotation = mark.rot ?? 0; s.alpha = 0; s.position.set(mark.fromX ?? mark.x, mark.fromY ?? mark.y);
        const r = mark.r, across = r * (mark.squash ?? 1); s.width = r * 2; s.height = across * 2; root().addChild(s);
        const m = { s, mark, r, across, alpha: mark.alpha ?? 1, born: clock + (mark.wait ?? 0) / 1000 };
        if (mark.wait || mark.fromX !== undefined || mark.spreads) moving.push(m); else { s.alpha = m.alpha; layDown(m); }
      }
    },
    tick(seconds) {
      clock += seconds;
      if (moving.length) moving = moving.filter((m) => {
        if (m.s.destroyed) return false;
        const age = clock - m.born; if (age < 0) return true;
        const k = m.mark;
        if (k.fromX !== undefined) { const u = Math.min(1, age / 0.24), e = 1 - (1 - u) * (1 - u); m.s.position.set(k.fromX + (k.x - k.fromX) * e, k.fromY + (k.y - k.fromY) * e - Math.sin(u * Math.PI) * k.up); m.s.alpha = m.alpha; if (u >= 1) { layDown(m); return false; } return true; }
        if (k.spreads) { const u = Math.min(1, age / (k.spreads / 1000)), g = 0.2 + 0.8 * (1 - (1 - u) * (1 - u)); m.s.width = m.r * 2 * g; m.s.height = m.across * 2 * g; m.s.alpha = m.alpha; if (u >= 1) { layDown(m); return false; } return true; }
        m.s.alpha = m.alpha; layDown(m); return false;
      });
      // The marks fade over the last part of their life; looked at twice a second, not every frame.
      if (clock - fadeLook < 0.5) return; fadeLook = clock;
      const last = Math.max(10, Number(life()) || 180), fade = last * 0.25;
      lying = lying.filter((m) => { if (m.s.destroyed) return false; const age = clock - m.born; if (age >= last) { gone(m); return false; } if (age > last - fade) m.s.alpha = m.alpha * ((last - age) / fade); if (bloodShines(m.mark.art)) lookAtLight(m, age); return true; });
    },
    clear() { for (const m of [...lying, ...moving]) gone(m); lying = []; moving = []; },
    get count() { return lying.length + moving.length; },
  };
}
