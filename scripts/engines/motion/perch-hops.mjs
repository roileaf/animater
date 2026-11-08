// Single birds going their own way between the trees and the roofs: now and then one leaves a canopy and comes down on a roof's
// ridge or its edge, sits a while looking about, then is off to another roof or back into a tree. Pure here: where they can sit,
// which perch is next, and one step of a bird; the engines (wildlife.mjs crows and songbirds, town-life.mjs pigeons) draw them.

const TAU = Math.PI * 2;
const between = (random, a, b) => a + random() * (b - a);

// How each kind goes about it. `sit` seconds on a perch; `speed` squares a second in the air; `range` squares between perches
// [least, most]; `roofs` the share of hops that go to a roof when there is one; `on` which perches it takes; `shy` squares a
// creature may come before it goes (a roof keeps it further from those below).
export const PERCH_KINDS = Object.freeze({
  crows: Object.freeze({ sit: [20, 70], speed: 3.2, range: [3, 40], roofs: 0.55, on: Object.freeze(['ridge', 'edge', 'canopy']), shy: 2 }),
  songbirds: Object.freeze({ sit: [8, 30], speed: 2.6, range: [1.5, 8], roofs: 0.3, on: Object.freeze(['edge', 'canopy']), shy: 1.8 }),
  pigeons: Object.freeze({ sit: [15, 45], speed: 3, range: [2, 20], roofs: 1, on: Object.freeze(['ridge', 'edge', 'ground']), shy: 1.6 }),
});
// Seconds of quick beats leaving a perch, and of the glide on still wings coming down onto one; and how long a bird takes to go
// into a canopy or come out of it (it is hidden in the leaves while it sits there).
export const TAKEOFF = 0.35, GLIDE = 0.4, INTO_LEAVES = 0.35;
// How high the flight rises over the higher of its two ends, in squares.
const ARC = 0.6;

// A point of a tile ({ x, y, width, height, rotation, anchorX, anchorY }), `u` and `v` 0-1 across and down it, turned with it.
const onTile = (t, u, v) => {
  const lx = (u - (t.anchorX ?? 0.5)) * t.width, ly = (v - (t.anchorY ?? 0.5)) * t.height, r = Number(t.rotation) || 0, c = Math.cos(r), s = Math.sin(r);
  return { x: t.x + lx * c - ly * s, y: t.y + lx * s + ly * c };
};
// Evenly along a stretch from `a` to `b` (0-1), one every `step` px of its `length`, at least one in the middle.
const along = (a, b, length, step) => { const n = Math.max(1, Math.floor((length * (b - a)) / step)); return Array.from({ length: n }, (_, i) => a + ((b - a) * (i + 0.5)) / n); };

// Where single birds can sit (pure). `roofs` the roof tiles as main.mjs sunlitTiles has them ({ x, y, width, height, rotation,
// anchorX, anchorY, up (squares tall), shown (0-1, faded for a creature under it), seed }); `trees` { x, y, r }; `ground` spots
// { x, y } (pigeons come back down to them). A roof gives its ridge (along the middle of its longer side, short of the ends) and
// its four edges, pulled in a little; one too small, or faded now, gives none. A tree gives one place in its leaves. Each
// { x, y, h (squares up), kind 'roof' | 'tree' | 'ground', on 'ridge' | 'edge' | 'canopy' | 'ground', face (rotation, 0 up the
// map, clockwise: the way it looks while it sits), key (the same perch the same key, each time it is worked out) }.
export function perchesFrom({ roofs = [], trees = [], ground = [], grid = 100 } = {}) {
  const out = [];
  roofs.forEach((t, n) => {
    const w = Math.abs(t.width), hgt = Math.abs(t.height), id = t.seed ?? n;
    if (!(Math.min(w, hgt) >= grid * 0.8) || (t.shown ?? 1) < 0.5) return;
    const h = Number.isFinite(Number(t.up)) && Number(t.up) > 0 ? Math.min(6, Number(t.up)) : 2, r = Number(t.rotation) || 0, wide = w >= hgt;
    // The ridge: a bird on it looks out to one side or the other.
    along(0.2, 0.8, wide ? w : hgt, grid * 0.6).forEach((s, i) => { const p = wide ? onTile(t, s, 0.5) : onTile(t, 0.5, s); out.push({ ...p, h, kind: 'roof', on: 'ridge', face: r + (wide ? 0 : Math.PI / 2) + (i % 2 ? Math.PI : 0), key: `roof:${id}:ridge:${i}` }); });
    // The edges: looking out over them.
    const iu = Math.min(0.12, (grid * 0.12) / w), iv = Math.min(0.12, (grid * 0.12) / hgt);
    const sides = [[(s) => onTile(t, s, iv), r, w, 'top'], [(s) => onTile(t, s, 1 - iv), r + Math.PI, w, 'bottom'], [(s) => onTile(t, iu, s), r - Math.PI / 2, hgt, 'left'], [(s) => onTile(t, 1 - iu, s), r + Math.PI / 2, hgt, 'right']];
    for (const [at, face, length, name] of sides) along(0.15, 0.85, length, grid * 0.8).forEach((s, i) => out.push({ ...at(s), h, kind: 'roof', on: 'edge', face, key: `roof:${id}:${name}:${i}` }));
  });
  for (const t of trees) out.push({ x: t.x, y: t.y, h: 3, kind: 'tree', on: 'canopy', face: 0, key: `tree:${Math.round(t.x)},${Math.round(t.y)}` });
  for (const g of ground) out.push({ x: g.x, y: g.y, h: 0, kind: 'ground', on: 'ground', face: 0, key: `ground:${Math.round(g.x)},${Math.round(g.y)}` });
  return out;
}

// Whether a straight flight from `a` to `b` comes over anywhere `kept(x, y)` says no (pure); where it sets off from does not count,
// so a bird on a perch a Keep out box has just been drawn over can still leave it.
const crossesOut = (a, b, kept, samples = 16) => { for (let i = 1; i <= samples; i++) { const u = i / samples; if (kept(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u)) return true; } return false; };

// The next perch for a bird at `from` (pure), or null for none. Only the perches its kind takes, within its range (`from` itself
// never), none another bird has (`taken`, keys), none kept out (`kept(x, y)`) or reached across a place kept out. A roof as often
// as its kind likes one when there is a roof to go to; `roofs` 1 and it always goes to a roof if it can, 0 never.
export function nextPerch(from, perches = [], { kind = 'crows', grid = 100, taken = [], kept = () => false, roofs = null, random = Math.random } = {}) {
  const k = PERCH_KINDS[kind] ?? PERCH_KINDS.crows, [least, most] = k.range, share = roofs ?? k.roofs;
  const fit = perches.filter((p) => {
    if (!k.on.includes(p.on) || p.key === from.key || taken.includes(p.key)) return false;
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    return d >= least * grid && d <= most * grid && !kept(p.x, p.y) && !crossesOut(from, p, kept);
  });
  if (!fit.length) return null;
  const onRoof = fit.filter((p) => p.kind === 'roof'), rest = fit.filter((p) => p.kind !== 'roof');
  const list = !rest.length ? onRoof : !onRoof.length ? rest : random() < share ? onRoof : rest;
  return list[Math.floor(random() * list.length)];
}

// Heading from `a` to `b` as a sprite's rotation (0 up the map, clockwise).
export const headingOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;

// One step of a single bird (pure). On a perch (`mode` 'sit', `at` the perch) it looks about (`face`) and now and then dips its
// head (`peck`, seconds of it); when its time is up (`wait`), or something comes too close (`near` creatures within its kind's
// `shy` squares, a roof keeping it shyer of those below), or a noise reaches it (`noise`), or its perch is gone (`here(perch)` false:
// a roof faded or taken away, a Keep out box drawn over it), it asks `choose(bird)` for the next perch and flies there (`mode` 'fly'):
// quick beats off the perch (`stage` 'takeoff'), steady wingbeats (`stage` 'flap') in an arc above both ends (`lift`, squares up),
// the last moments on still wings (`stage` 'glide'), and it sits. Nowhere to go: it stays, unless its perch is gone, and then it
// goes for good (`mode` 'gone'). `shown` 0-1 how much of it is seen: nothing while it sits in a tree, fading in the leaves.
export function perchHopStep(bird, { dt = 1 / 60, grid = 100, kind = 'crows', near = [], noise = null, here = () => true, choose = () => null, still = false, random = Math.random } = {}) {
  const b = { ...bird }, k = PERCH_KINDS[kind] ?? PERCH_KINDS.crows;
  if (b.mode === 'gone') return b;
  if (b.mode === 'sit') {
    const at = b.at, gone = !here(at), shy = k.shy * grid * (at.kind === 'roof' ? 0.75 : 1);
    const scared = noise ?? near.find((t) => Math.hypot(t.x - b.x, t.y - b.y) < shy) ?? null;
    b.wait -= dt; b.peck = Math.max(0, (b.peck ?? 0) - dt); b.look = (b.look ?? between(random, 1, 4)) - dt;
    b.shown = at.kind === 'tree' ? 0 : 1; b.lift = at.h; b.stage = null;
    if (gone || scared || (b.wait <= 0 && !still)) {
      const to = choose(b);
      if (!to) { if (gone) return { ...b, mode: 'gone' }; b.wait = between(random, 4, 10); return b; }
      const far = Math.hypot(to.x - b.x, to.y - b.y);
      return { ...b, mode: 'fly', from: { x: b.x, y: b.y, h: at.h, kind: at.kind }, to, t: 0, len: Math.max(1.2, Math.min(8, far / (grid * k.speed) + 0.6)), a: headingOf(b, to), stage: 'takeoff', peck: 0, scared: !!scared };
    }
    if (b.wait <= 0) b.wait = between(random, 2, 6);
    if (b.look <= 0) { b.look = between(random, 1.2, 4.5); if (random() < 0.45) b.peck = 0.3; else b.a = (at.face ?? b.a) + between(random, -0.9, 0.9); }
    return b;
  }
  // In the air.
  b.t += dt;
  const u = Math.min(1, b.t / b.len), e = 0.5 * (u + u * u * (3 - 2 * u)), from = b.from, to = b.to;
  b.x = from.x + (to.x - from.x) * e; b.y = from.y + (to.y - from.y) * e;
  b.lift = from.h + (to.h - from.h) * e + (ARC + Math.max(0, Math.min(1, Math.hypot(to.x - from.x, to.y - from.y) / (grid * 12)))) * Math.sin(u * Math.PI);
  b.a = headingOf(from, to);
  b.stage = b.t < TAKEOFF ? 'takeoff' : b.len - b.t < GLIDE ? 'glide' : 'flap';
  const out = from.kind === 'tree' ? Math.min(1, b.t / INTO_LEAVES) : 1, into = to.kind === 'tree' ? Math.min(1, Math.max(0, b.len - b.t) / INTO_LEAVES) : 1;
  b.shown = Math.min(out, into);
  if (u >= 1) return { ...b, mode: 'sit', at: to, x: to.x, y: to.y, lift: to.h, a: to.face ?? b.a, wait: between(random, k.sit[0], k.sit[1]), look: between(random, 0.8, 3), peck: 0, stage: null, shown: to.kind === 'tree' ? 0 : 1, from: null, to: null, scared: false };
  return b;
}

// How many single birds a kind has (pure): none without both somewhere to leave from and a roof or another tree to go to.
// `crows`/`songbirds` the flock's own number (0 off).
export function perchBirdCount(kind, perches = [], flock = 0) {
  if (!(flock > 0)) return 0;
  const k = PERCH_KINDS[kind] ?? PERCH_KINDS.crows, mine = perches.filter((p) => k.on.includes(p.on) && p.kind !== 'ground');
  if (mine.length < 2) return 0;
  const roofs = mine.filter((p) => p.kind === 'roof').length, trees = mine.length - roofs;
  if (kind === 'pigeons') return roofs ? Math.min(2, Math.max(1, Math.floor(flock / 4))) : 0;
  return roofs && trees ? (mine.length > 30 ? 2 : 1) : kind === 'songbirds' && trees >= 2 ? 1 : 0;
}

// A bird put on a perch to start (pure), sitting a while first so they do not all go at once.
export const perchedBird = (perch, { random = Math.random, first = [5, 40] } = {}) => ({ x: perch.x, y: perch.y, mode: 'sit', at: perch, a: perch.face ?? random() * TAU, wait: between(random, first[0], first[1]), look: between(random, 0.5, 3), peck: 0, lift: perch.h, shown: perch.kind === 'tree' ? 0 : 1, phase: random() * 6 });
