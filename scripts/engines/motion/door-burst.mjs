// A flock of bats or a run of rats bursting through a door as it opens (Wall configuration → Animater door): out of the far
// side, through the doorway, over or past whoever opened it, then scattering. The very creatures of vermin.mjs: the same art,
// size, tail and shadows. Every screen works out the same flock from the same seed. The paths are worked out once and only
// followed: nothing a frame but moving a few sprites.
import { batWingbeat, ratStride, drawRatTail, shadowFrom } from './vermin.mjs';

export const FLOCKS = Object.freeze({ small: 8, medium: 16, big: 30 });
export const flockSize = (name) => FLOCKS[name] ?? FLOCKS.medium;
const TAU = Math.PI * 2;

// A repeatable stream of numbers from a seed.
const rng = (seed) => { let h = 2166136261; for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), h | 1); h ^= h + Math.imul(h ^ (h >>> 7), h | 61); return ((h ^ (h >>> 14)) >>> 0) / 4294967296; }; };

// What this door sends now (pure): 'bats', 'rats' or null. `own` its flags; Once only until it has.
export function doorSends(own = {}) {
  if (own.doorBurst !== 'bats' && own.doorBurst !== 'rats') return null;
  return own.doorBurstWhen === 'always' || own.burstFired !== true ? own.doorBurst : null;
}

// The door as a place (pure): its middle, half its width, and the way across it. `c` the wall's [x1, y1, x2, y2].
export function doorPlace(c) {
  const [x1, y1, x2, y2] = c, len = Math.hypot(x2 - x1, y2 - y1) || 1;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, half: len / 2, ax: (x2 - x1) / len, ay: (y2 - y1) / len, nx: -(y2 - y1) / len, ny: (x2 - x1) / len };
}

// Who it comes at (pure): the nearest of `tokens` ({ x, y }) within `reach` squares that the doorway can reach.
export function burstTarget(door, tokens = [], { grid = 100, reach = 8, blocked = () => false } = {}) {
  let best = null, near = reach * grid;
  for (const t of tokens) { const d = Math.hypot(t.x - door.x, t.y - door.y); if (d < near && !blocked(door, t)) { near = d; best = t; } }
  return best ? { x: best.x, y: best.y } : null;
}

// As far along the way from a to b as the walls allow (pure).
const clipped = (a, b, blocked) => {
  for (const t of [1, 0.75, 0.5, 0.25]) { const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; if (!blocked(a, p)) return p; }
  return { x: a.x, y: a.y };
};

// Each creature's way (pure): from behind the door (the side away from `target`), through the doorway, over the target, and
// off in a fan away from the door, never through a wall (`blocked(a, b)`). With no target it carries on into the room. Rats
// run a little slower and straighter than bats fly.
export function flockPaths({ door, target = null, count = 16, grid = 100, seed = 'burst', blocked = () => false, kind = 'bats' } = {}) {
  const r = rng(seed), between = (a, b) => a + r() * (b - a), rats = kind === 'rats';
  const side = target ? (Math.sign((target.x - door.x) * door.nx + (target.y - door.y) * door.ny) || 1) : (r() < 0.5 ? -1 : 1);
  const aim = target ?? clipped(door, { x: door.x + door.nx * side * grid * 3, y: door.y + door.ny * side * grid * 3 }, blocked);
  const heading = Math.atan2(aim.y - door.y, aim.x - door.x), gap = Math.max(grid * 0.2, door.half * 0.7);
  return Array.from({ length: count }, () => {
    const across = between(-gap, gap), behind = between(1, 3) * grid, wide = between(-1.2, 1.2) * grid;
    const start = clipped(door, { x: door.x - door.nx * side * behind + door.ax * wide, y: door.y - door.ny * side * behind + door.ay * wide }, blocked);
    const through = { x: door.x + door.ax * across, y: door.y + door.ay * across };
    const over = clipped(through, { x: aim.x + between(-1.2, 1.2) * grid, y: aim.y + between(-1.2, 1.2) * grid }, blocked);
    const fan = heading + between(-1.3, 1.3), on = between(1, 2.5) * grid, half = heading + (fan - heading) * 0.5;
    const past = clipped(over, { x: over.x + Math.cos(half) * on, y: over.y + Math.sin(half) * on }, blocked);
    const away = between(3, 6) * grid, gone = clipped(past, { x: past.x + Math.cos(fan) * away, y: past.y + Math.sin(fan) * away }, blocked);
    return { pts: [start, through, over, past, gone], delay: Math.pow(r(), 1.4) * (rats ? 1.2 : 0.9), life: rats ? between(2.2, 3.2) : between(1.7, 2.5), size: rats ? between(0.9, 1.1) : between(0.85, 1.1), beat: rats ? between(10, 16) : between(14, 24), phase: r() * TAU, wob: rats ? between(0.04, 0.12) : between(0.2, 0.5), wobHz: between(5, 9) };
  });
}

// Where a creature is `age` seconds after it set off (pure): { x, y, angle, alpha, frame }, null before and after.
const along = (pts, e) => {
  const n = pts.length - 1, f = Math.min(n - 1e-4, Math.max(0, e)), s = Math.floor(f), t = f - s, a = pts[Math.max(0, s - 1)], b = pts[s], c = pts[s + 1], d = pts[Math.min(n, s + 2)];
  const cr = (A, B, C, D) => 0.5 * (2 * B + (C - A) * t + (2 * A - 5 * B + 4 * C - D) * t * t + (3 * B - A - 3 * C + D) * t * t * t);
  return { x: cr(a.x, b.x, c.x, d.x), y: cr(a.y, b.y, c.y, d.y) };
};
export function burstPose(one, age, { grid = 100 } = {}) {
  if (age < 0 || age > one.life) return null;
  const u = age / one.life, e = Math.pow(u, 0.85) * (one.pts.length - 1), p = along(one.pts, e), q = along(one.pts, e + 0.02), angle = Math.atan2(q.y - p.y, q.x - p.x);
  const w = Math.sin(age * one.wobHz + one.phase) * one.wob * grid * 0.35;
  return { x: p.x - Math.sin(angle) * w, y: p.y + Math.cos(angle) * w, angle, alpha: Math.min(1, age / 0.12) * (1 - Math.max(0, (u - 0.75) / 0.25)), frame: Math.floor(age * one.beat + one.phase) };
}

/** The layer: play({ kind, paths, grid, size }) sets them off; tick(seconds, { seen(x, y), light(x, y) }) moves them; clear(). `root(kind)` where they are drawn; `floor()` where their shadows fall. */
export function createDoorBursts({ PIXI, root, floor }) {
  let flocks = [], time = 0;
  const pictures = { bats: null, rats: null };
  const texturesOf = (kind) => {
    if (pictures[kind]?.every((t) => !t.baseTexture?.destroyed)) return pictures[kind];
    return (pictures[kind] = (kind === 'rats' ? ratStride() : batWingbeat()).map((c) => PIXI.Texture.from(c)));
  };
  const sprite = (parent, tex) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.eventMode = 'none'; s.visible = false; parent.addChild(s); return s; };
  const drop = (flock) => { for (const b of flock.ones) { try { b.s.destroy(); b.shadow.destroy(); b.tail?.destroy(); } catch { /* gone */ } } };
  return {
    play({ kind = 'bats', paths = [], grid = 100, size = 1 } = {}) {
      const tex = texturesOf(kind), ones = paths.map((one) => {
        const shadow = sprite(floor(), tex[0]); shadow.tint = 0x000000;
        let tail = null; if (kind === 'rats') { tail = new PIXI.Graphics(); tail.eventMode = 'none'; tail.visible = false; root(kind).addChild(tail); }
        return { one, shadow, tail, s: sprite(root(kind), tex[0]), shown: true };
      });
      flocks.push({ kind, ones, age: 0, grid, size, look: 0 });
    },
    tick(seconds, { seen = () => true, light = () => null } = {}) {
      if (!flocks.length) return;
      time += seconds;
      flocks = flocks.filter((flock) => {
        flock.age += seconds; flock.look -= seconds;
        const looking = flock.look <= 0; if (looking) flock.look = 0.15;
        const rats = flock.kind === 'rats', tex = texturesOf(flock.kind), k = (flock.grid / 100) * flock.size;
        let busy = false;
        flock.ones.forEach((b, i) => {
          const pose = burstPose(b.one, flock.age - b.one.delay, { grid: flock.grid });
          if (!pose) { b.s.visible = b.shadow.visible = false; if (b.tail) b.tail.visible = false; if (flock.age < b.one.delay) busy = true; return; }
          busy = true;
          // Only where this screen can see (nothing given away through the fog); looked at a few times a second.
          if (looking) { try { b.shown = seen(pose.x, pose.y) !== false; } catch { b.shown = true; } }
          const t = tex[pose.frame % tex.length], size = k * b.one.size * (rats ? 0.5 : 0.42), turn = rats ? pose.angle : pose.angle + Math.PI / 2;
          b.s.visible = b.shown; if (b.tail) b.tail.visible = b.shown;
          // Its shadow as the single ones cast it, away from the nearest light; none without a light.
          const cast = b.shown ? shadowFrom(light(pose.x, pose.y), pose, { grid: flock.grid, ...(rats ? {} : { high: 2 }) }) : null;
          b.shadow.visible = !!cast;
          if (!b.shown) return;
          b.s.texture = t; b.s.position.set(pose.x, pose.y); b.s.rotation = turn; b.s.scale.set(size); b.s.alpha = pose.alpha;
          if (cast) { b.shadow.texture = t; b.shadow.position.set(cast.x, cast.y); b.shadow.rotation = turn; b.shadow.scale.set(size * cast.scale); b.shadow.alpha = cast.alpha * pose.alpha; }
          if (b.tail) { drawRatTail(b.tail, { x: pose.x, y: pose.y, angle: pose.angle, speed: 1 }, k * b.one.size, time, i); b.tail.alpha = pose.alpha; }
        });
        if (!busy) drop(flock);
        return busy;
      });
    },
    clear() { for (const f of flocks) drop(f); flocks = []; },
    get busy() { return flocks.length > 0; },
    get count() { return flocks.reduce((sum, f) => sum + f.ones.length, 0); },
  };
}
