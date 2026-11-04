// Old tracks: prints that outlast the moment, aged by the game's clock, so someone can read who passed here and how long
// ago. The GM controls it for each scene (off unless turned on; for the GM only, or for everyone) and how long they last.
// Unlike the rest of the floor's marks these are kept: the active GM writes them to the scene (flags.<id>.tracks), compact and
// capped, a few times a minute at most. Every screen draws them in one shape, rebuilt only when something changes.

export const TRACK_MODES = Object.freeze({ off: 'off', gm: 'gm', everyone: 'everyone' });
export const TRACK_CAP = 1200;
export const DEFAULT_TRACK_HOURS = 24;
// One step: [x, y, way (radians, rounded), size (squares), floor index, worldTime, secret 0|1, side -1|1].
export const TRACK_FLOORS = Object.freeze(['dirt', 'mud', 'sand', 'snow', 'grass', 'stone', 'wood', 'ice']);
// How well a floor keeps a print (0-1): the drawn strength, and the share of the scene's lifetime it lasts.
const HOLDS = Object.freeze({ mud: { show: 1, last: 1 }, snow: { show: 1, last: 0.8 }, sand: { show: 0.8, last: 0.45 }, dirt: { show: 0.75, last: 1 }, grass: { show: 0.45, last: 0.6 }, ice: { show: 0.25, last: 0.25 }, wood: { show: 0.25, last: 0.35 }, stone: { show: 0.18, last: 0.25 } });
const COLORS = Object.freeze({ mud: 0x2a1d12, snow: 0x7f92a8, sand: 0x6e5636, dirt: 0x35281a, grass: 0x2c3a1c, ice: 0xdfeefa, wood: 0x2a1f15, stone: 0x25231f });

// The scene's mode, whatever it holds (pure): off unless the GM chose otherwise.
export const trackMode = (value) => (value === 'gm' || value === 'everyone' ? value : 'off');
export const trackHours = (value) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.min(24 * 365, n) : DEFAULT_TRACK_HOURS; };

// The steps walked from `from` to `to` (pure), one each stride, left and right by turns, carrying on from `left` px over
// from last time. Returns { steps, left, side }. A floor that keeps nothing (`floorAt` null: water, a pit) leaves nothing there.
export function stepsAlong(from, to, { grid = 100, size = 1, worldTime = 0, secret = false, floorAt = () => 'dirt', left = 0, side = 1 } = {}) {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy), stride = grid * Math.max(0.4, Math.min(1.2, 0.5 * Math.sqrt(size))), steps = [];
  if (!(length > 0)) return { steps, left, side };
  const way = Math.atan2(dy, dx), out = grid * 0.09 * Math.sqrt(size);
  let at = stride - left, s = side;
  for (; at <= length; at += stride) {
    const u = at / length, x = from.x + dx * u + Math.cos(way + Math.PI / 2) * out * s, y = from.y + dy * u + Math.sin(way + Math.PI / 2) * out * s, floor = floorAt({ x, y });
    s = -s;
    const index = TRACK_FLOORS.indexOf(floor);
    if (index >= 0) steps.push([Math.round(x), Math.round(y), Math.round(way * 100) / 100, size, index, Math.round(worldTime), secret ? 1 : 0, s]);
  }
  return { steps, left: length - (at - stride), side: s };
}

// How long a step of this floor lasts (seconds of game time, pure).
const lastsFor = (step, life) => life * (HOLDS[TRACK_FLOORS[step[4]]]?.last ?? 1);
// What survives (pure): steps past their floor's lifetime go, then the oldest past the cap. Time run backward leaves them be.
export function pruneTracks(steps, now, hours, cap = TRACK_CAP) {
  const life = trackHours(hours) * 3600, kept = steps.filter((s) => now - s[5] < lastsFor(s, life));
  return kept.length > cap ? kept.slice(kept.length - cap) : kept;
}

// How one step looks now (pure): { alpha, blur 0-1, color, floor }, or null when it is gone or this viewer may not see it. A
// fresh step is left to the moving effects' own prints (none for the first half minute), and an old one softens as well as fades.
export function trackLook(step, { now = 0, hours = DEFAULT_TRACK_HOURS, viewer = 'player', mode = 'off' } = {}) {
  if (mode === 'off' || (mode === 'gm' && viewer !== 'gm')) return null;
  if (step[6] && viewer !== 'gm') return null;
  const floor = TRACK_FLOORS[step[4]], hold = HOLDS[floor]; if (!hold) return null;
  const age = now - step[5], lasts = lastsFor(step, trackHours(hours) * 3600);
  if (age < 30 && age >= 0) return null;
  const u = Math.max(0, age) / lasts; if (u >= 1) return null;
  return { alpha: hold.show * 0.62 * (1 - u) ** 1.4, blur: u, color: COLORS[floor], floor };
}

// The layer. `draw(steps, { now, hours, viewer, mode, grid, view })` redraws it; `clear()`. A few thousand little shapes in one
// Graphics, so it costs nothing per frame; main.mjs calls it when the list changes and as the game's clock moves on.
export function createOldTracks({ PIXI, root }) {
  let shape = null;
  const parent = () => (typeof root === 'function' ? root() : root);
  const ensure = () => { if (!shape || shape.destroyed) { shape = new PIXI.Graphics(); shape.eventMode = 'none'; parent().addChild(shape); } return shape; };
  let drawn = 0;
  return {
    draw(steps, { now = 0, hours = DEFAULT_TRACK_HOURS, viewer = 'player', mode = 'off', grid = 100 } = {}) {
      const g = ensure(); g.clear(); drawn = 0;
      for (const step of steps) {
        const look = trackLook(step, { now, hours, viewer, mode }); if (!look) continue;
        const [x, y, way, size] = step, long = grid * 0.1 * Math.sqrt(size), wide = long * 0.55;
        // A heel and a sole along the way it went, so which way they went can be read; age rounds them off.
        const heel = long * 0.55 * (1 - look.blur * 0.6), cos = Math.cos(way), sin = Math.sin(way);
        g.beginFill(look.color, look.alpha);
        g.drawEllipse(x + cos * long * 0.4, y + sin * long * 0.4, wide * (1 + look.blur * 0.3), wide * (1 + look.blur * 0.3));
        g.endFill();
        g.beginFill(look.color, look.alpha * 0.85);
        g.drawCircle(x - cos * long * 0.55, y - sin * long * 0.55, Math.max(1, heel * 0.6));
        g.endFill();
        drawn++;
      }
      return drawn;
    },
    clear() { if (shape && !shape.destroyed) shape.clear(); drawn = 0; },
    get count() { return drawn; },
  };
}
