// Water heard (assets/sounds/wildlife/river and /pond, their License.txt): one loop for each speed of current on the map, and one for still
// water (a Pond: a swamp's insects and slow mud bubbles), as loud as the
// nearest listener is near the nearest water flowing at that speed. The GM with no creature listens from the middle of the view.

const DIR = 'modules/animater/assets/sounds/wildlife/river';
export const RIVER_SOUNDS = Object.freeze({
  gentle: ['180732-0', '180732-1', '637831-0', '826598-1'].map((n) => `${DIR}/river-gentle-${n}.ogg`),
  swift: ['323458-0', '588180-0', '588180-1', '642774-1', '718556-0'].map((n) => `${DIR}/river-swift-${n}.ogg`),
  still: ['547690-415608-0', '415608-0'].map((n) => `modules/animater/assets/sounds/wildlife/pond/pond-still-${n}.ogg`),
});
// How far it carries (squares) and how loud at the bank; swift water carries further, still water hardly at all.
export const RIVER_REACH = Object.freeze({ gentle: 10, swift: 16, still: 6 });
export const RIVER_VOLUME = Object.freeze({ gentle: 0.3, swift: 0.42, still: 0.26 });

// Whether a point is inside a polygon (flat x, y pairs), and how far it is from it (pure): 0 inside.
export const distanceToArea = (p, points) => nearestOfArea(p, points).d;
// That distance and the nearest place in it { d, x, y }.
export function nearestOfArea(p, points) {
  let inside = false, best = Infinity, x = p.x, y = p.y;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const ax = points[j], ay = points[j + 1], bx = points[i], by = points[i + 1];
    if ((by > p.y) !== (ay > p.y) && p.x < ((ax - bx) * (p.y - by)) / (ay - by) + bx) inside = !inside;
    const dx = bx - ax, dy = by - ay, u = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(p.x - (ax + dx * u), p.y - (ay + dy * u)); if (d < best) { best = d; x = ax + dx * u; y = ay + dy * u; }
  }
  return inside ? { d: 0, x: p.x, y: p.y } : { d: best, x, y };
}

// How much of each current's sound is heard (pure): `rivers` [{ speed: 'gentle' | 'swift' | 'still', areas: [flat points] }], `ears` the listening
// points, `grid` px a square. { gentle: { level 0-1, from }, swift }, `from` the listener nearest it and `at` the place in the water nearest them, for what stands between.
export function riverHeard(rivers = [], ears = [], { grid = 100 } = {}) {
  const out = { gentle: { level: 0, from: null, at: null }, swift: { level: 0, from: null, at: null }, still: { level: 0, from: null, at: null } };
  for (const river of rivers) {
    const voice = out[river.speed]; if (!voice) continue;
    const reach = RIVER_REACH[river.speed] * grid;
    for (const ear of ears) for (const area of river.areas) {
      const near = nearestOfArea(ear, area), k = Math.max(0, 1 - near.d / reach) ** 2;
      if (k > voice.level) { voice.level = k; voice.from = ear; voice.at = near; }
    }
  }
  return out;
}

// The night out of doors, constant: crickets and the rest, a loop for as long as it is dark and warm, low behind everything.
export const NIGHT_SOUNDS = Object.freeze(['320227-0', '320227-1'].map((n) => `modules/animater/assets/sounds/wildlife/night/night-${n}.ogg`));
export const NIGHT_VOLUME = 0.2;
// How loud it is now (pure): `night` 0-1, none when it is cold or the scene wants its nights `quiet`, about a third from inside a room.
export const nightLevel = ({ night = 0, warm = true, inside = false, quiet = false } = {}) => (warm && !quiet ? NIGHT_VOLUME * Math.max(0, Math.min(1, night)) * (inside ? 0.33 : 1) : 0);
export function nightFile(seed = '') { let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return NIGHT_SOUNDS[h % NIGHT_SOUNDS.length]; }

// One recording for a scene (pure), the same on every visit: `seed` its id. A river keeps its voice.
export function riverFile(speed, seed = '') {
  const files = RIVER_SOUNDS[speed]; if (!files?.length) return null;
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return files[h % files.length];
}
