// Orders the GM gives an animal from its HUD (ui/animal-hud.mjs): go to a spot, follow a token, circle a token. They are
// kept on the placed animal in the scene's flags (flags.animater.placedAnimals[].order), so every screen moves it the same
// way. Each layer steers an ordered animal with its own gait (orderPrep): the deer and wolves walk there, a fox trots, a
// rabbit hops, a squirrel dashes, a snake slides, a songbird flies, a hawk circles over it. An ordered animal does not
// run from people: it is with them.

export const ORDER_TYPES = Object.freeze(['go', 'follow', 'circle']);
// The kinds that take orders (and can be put down by hand). Not a cat (it keeps to wall tops), nor the crows, owls, fish,
// insects, rats and bats.
export const ORDERABLE = Object.freeze(['rabbit', 'songbird', 'crow', 'hawk', 'deer', 'fox', 'wolf', 'squirrel', 'snake', 'duck', 'heron', 'gull', 'frog', 'pigeon', 'hen', 'dog', 'cow', 'goat', 'sheep', 'pig', 'horse']);

// How close a bird circles over its mark (squares): a token's own circle, just round it; a spot's a little tighter.
export const ORBIT = Object.freeze({ token: 1.05, spot: 0.85, turn: 0.9 });
// One step of a bird circling its mark on an order (pure), a gull's way: round and round `center` at the orbit's radius,
// gliding, catching up at its own pace when the mark moves on. `b` { x, y, orb (its place round the circle), angle }.
export function orbitStep(b, center, { dt = 1 / 60, grid = 100, spot = false } = {}) {
  const o = { ...b }, r = grid * (spot ? ORBIT.spot : ORBIT.token);
  o.orb = (o.orb ?? Math.atan2(o.y - center.y, o.x - center.x)) + dt * ORBIT.turn;
  const tx = center.x + Math.cos(o.orb) * r, ty = center.y + Math.sin(o.orb) * r, dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  const step = Math.min(d, grid * 3.2 * dt);
  if (d > 1e-6) { o.x += (dx / d) * step; o.y += (dy / d) * step; }
  // Facing the way it goes (0 up the map, clockwise); on its circle, along it.
  const mx = d > grid * 0.05 ? dx : -Math.sin(o.orb), my = d > grid * 0.05 ? dy : Math.cos(o.orb), want = Math.atan2(mx, -my);
  const off = Math.atan2(Math.sin(want - (o.angle ?? want)), Math.cos(want - (o.angle ?? want)));
  o.angle = (o.angle ?? want) + off * Math.min(1, dt * 8);
  return o;
}

// A bird that goes perch to perch (perch-hops.mjs: crows, songbirds and pigeons up on roofs and in trees), ordered: it hops
// down to the mark and sits there (a perch of its own on the ground), and hops after it again when the mark moves off.
export const ORDER_PERCH_KEY = 'order';
export const orderPerch = (aim, face = 0) => ({ x: aim.x, y: aim.y, h: 0, kind: 'ground', on: 'ground', face, key: ORDER_PERCH_KEY });
// Before its step (pure): sitting, it goes now; on the wing to a mark that has moved on, it turns for where the mark is now.
export function perchOrderPrep(b, aim, { grid = 100, speed = 3 } = {}) {
  const chasing = orderChasing(b, aim), out = { ...b, chasing };
  if (!chasing) return out;
  if (b.mode === 'sit') return { ...out, wait: 0 };
  if (b.mode === 'fly' && Math.hypot((b.to?.x ?? Infinity) - aim.x, (b.to?.y ?? Infinity) - aim.y) > grid * 0.8) {
    const to = orderPerch(aim, b.a), far = Math.hypot(to.x - b.x, to.y - b.y);
    return { ...out, from: { x: b.x, y: b.y, h: b.lift ?? 0, kind: 'air' }, to, t: 0, len: Math.max(0.8, Math.min(8, far / (grid * speed) + 0.4)) };
  }
  return out;
}
// A farm engine's kinds by the order kind's name, and back.
export const FARM_ORDER_KINDS = Object.freeze({ cow: 'cows', goat: 'goats', sheep: 'sheep', pig: 'pigs', horse: 'horses' });
const TAU = Math.PI * 2;

/**
 * What every layer offers the animal HUD, over its lists of animals: `lists()` the current [kind, array] pairs (an array
 * is changed in place), `kindOf(o, kind)` an animal's order kind, `bodyOf(o)` its picture (each step makes a new object
 * for an animal: it is known by its picture), `remove(o)` its pictures destroyed. Returns { held(o), api: { orders, pick,
 * where, hold, takeAway } }.
 */
export function orderHandles(lists, { kindOf = (_o, kind) => kind, bodyOf = (o) => o.body ?? o.view?.body, remove = () => {} } = {}) {
  let heldBody = null;
  const each = () => lists().flatMap(([kind, list]) => list.map((o) => [kindOf(o, kind), o]));
  const same = (o, ref) => !!ref && bodyOf(o) === bodyOf(ref);
  return {
    held: (o) => heldBody !== null && bodyOf(o) === heldBody,
    api: {
      // The orders on the animals put down by hand: placed id → order or null.
      orders(orders = new Map()) {
        for (const [, o] of each()) {
          if (o.placed === undefined) continue;
          const order = orders.get(o.placed) ?? null;
          if (JSON.stringify(order) !== JSON.stringify(o.order ?? null)) { o.order = order; o.chasing = false; o.orderPhase ??= Math.random() * TAU; }
        }
      },
      // The one drawn nearest a point within `reach` px: { kind, id (placed) or null, x, y, ref, order }.
      pick(x, y, reach = 50) {
        let best = null, far = reach;
        for (const [kind, o] of each()) {
          const b = bodyOf(o); if (!b?.visible || o.gone) continue;
          const d = Math.hypot(b.position.x - x, b.position.y - y);
          if (d < far) { far = d; best = { kind, id: o.placed ?? null, x: b.position.x, y: b.position.y, ref: o, order: o.order ?? null }; }
        }
        return best;
      },
      where(ref) { for (const [, o] of each()) if (same(o, ref)) { const b = bodyOf(o); return { x: b.position.x, y: b.position.y, order: o.order ?? null, id: o.placed ?? null }; } return null; },
      // Held still while the GM has its HUD open (null lets it go on).
      hold(ref) { heldBody = ref ? bodyOf(ref) ?? null : null; },
      // A wild one taken off this screen (it is put down again by hand, ordered, in its place).
      takeAway(ref) { for (const [, list] of lists()) { const i = list.findIndex((o) => same(o, ref)); if (i < 0) continue; remove(list[i]); list.splice(i, 1); return true; } return false; },
    },
  };
}

// An order as kept (pure): { type: 'go', x, y } or { type: 'follow' | 'circle', token }, else null.
export function normalizeOrder(raw) {
  if (!raw || !ORDER_TYPES.includes(raw.type)) return null;
  if (raw.type === 'go') { const x = Number(raw.x), y = Number(raw.y); return Number.isFinite(x) && Number.isFinite(y) ? { type: 'go', x: Math.round(x), y: Math.round(y) } : null; }
  return raw.token ? { type: raw.type, token: String(raw.token) } : null;
}

// Where an ordered animal is making for now (pure), or null (its token is not on the scene). `settle`: near enough to stop
// and be itself; `far`: far enough to set off again. Circling, the mark runs round the token (`phase` spaces several
// out), so it never settles. `center` what it is about, for a hawk's circle.
// Following, the mark is a square short of the token on the animal's side of it (`from` where the animal is), so it
// comes up beside it rather than into it.
export function orderAim(order, { tokenAt = () => null, grid = 100, time = 0, phase = 0, from = null } = {}) {
  if (!order) return null;
  if (order.type === 'go') return { x: order.x, y: order.y, settle: grid * 0.5, far: grid * 1.3, center: { x: order.x, y: order.y } };
  const p = tokenAt(order.token);
  if (!p) return null;
  if (order.type === 'follow') {
    const dx = (from?.x ?? p.x) - p.x, dy = (from?.y ?? p.y + 1) - p.y, d = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / d) * grid, y: p.y + (dy / d) * grid, settle: grid * 0.5, far: grid * 1.1, center: p };
  }
  const way = phase + time * 0.55, r = grid * 1.7;
  return { x: p.x + Math.cos(way) * r, y: p.y + Math.sin(way) * r, settle: grid * 0.35, far: grid * 0.6, center: p };
}

// Whether it is on its way (pure): it sets off past `far` and keeps on till within `settle`.
export const orderChasing = (o, aim) => { if (!aim) return false; const d = Math.hypot(aim.x - o.x, aim.y - o.y); return o.chasing ? d > aim.settle : d > aim.far; };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// One ordered animal set going toward its mark in its own way (pure), before its layer's own step moves it. `kind` its
// order kind. Returns the animal as it should go into its step: unchanged when it has arrived.
export function orderPrep(kind, o, aim, { grid = 100 } = {}) {
  const chasing = orderChasing(o, aim), out = { ...o, chasing };
  if (!chasing) return out;
  const dx = aim.x - o.x, dy = aim.y - o.y, d = Math.hypot(dx, dy) || 1, way = Math.atan2(dy, dx), face = way + Math.PI / 2;
  if (kind === 'rabbit') {
    if (o.mode === 'bolt') return out;
    return { ...out, mode: 'hop', hops: Math.max(2, o.hops ?? 0), hop: o.mode === 'hop' ? o.hop : 0, a: face, wait: 0 };
  }
  if (kind === 'songbird') {
    const v = grid * 4, vx = (dx / d) * v, vy = (dy / d) * v;
    if (o.mode === 'ground') return { ...out, mode: 'up', vx, vy, t: 0, flight: clamp(d / v + 0.25, 0.6, 5), tries: 3, a: face, hop: null, hops: 0, bounce: 0, gone: false };
    return { ...out, vx, vy, a: face, tries: 3, flight: Math.max(o.flight ?? 1, (o.t ?? 0) + clamp(d / v, 0.2, 5)) };
  }
  if (kind === 'deer' || kind === 'wolf') {
    if (o.mode === 'flee' || o.mode === 'away' || o.mode === 'drag') return out;
    return { ...out, mode: 'arrive', tx: aim.x, ty: aim.y, t: 0, clear: 0, lift: 1 };
  }
  if (kind === 'fox') {
    if (['carry', 'away', 'coil', 'pounce'].includes(o.mode)) return out;
    return { ...out, mode: 'trot', want: face, wait: Math.max(o.wait ?? 0, 3), t: 0 };
  }
  if (kind === 'squirrel') return { ...out, mode: 'dash', tx: aim.x, ty: aim.y, t: 0, emerging: false };
  if (kind === 'snake') return { ...out, mode: 'slide', want: face, wait: Math.max(o.wait ?? 0, 2) };
  // A duck paddles to a mark close by; further, it flies there (and keeps over it where there is no water to come down on).
  if (kind === 'duck') {
    if (o.mode === 'swim' && d <= grid * 3) return { ...out, a: face, turn: 0, wait: 2, up: 0 };
    if (o.mode === 'swim') return { ...out, mode: 'fly', vx: dx / d, vy: dy / d, t: 0, h: 0, up: 0, tries: 0, a: face, fromX: o.x, fromY: o.y, to: { x: aim.x, y: aim.y }, flee: null };
    return { ...out, to: { x: aim.x, y: aim.y }, tries: 0, gone: false };
  }
  // A heron flies straight there and stands.
  if (kind === 'heron') return { ...out, mode: 'fly', t: Math.max(o.t ?? 0, 7), hx: aim.x, hy: aim.y, leaving: false, gone: false, flee: null };
  // A frog swims there (hurrying) and climbs out where it gets to.
  if (kind === 'frog') return o.mode === 'leap' ? out : { ...out, mode: 'swim', hurry: true, hx: aim.x, hy: aim.y, stay: 0, t: Math.max(o.t ?? 0, 1), noPond: false };
  // A pigeon walks to a mark close by; further, it glides there.
  if (kind === 'pigeon') {
    if (o.mode === 'fly') return { ...out, lx: aim.x, ly: aim.y, wantLand: false };
    if (d <= grid * 3) return { ...out, walk: 1, peck: 0, a: face, wait: 1, tucked: false };
    return { ...out, mode: 'fly', stage: 'glide', glide: 0, gx: o.x, gy: o.y, lx: aim.x, ly: aim.y, glideFor: Math.max(1.4, d / (grid * 3.2)), h: 1, wantLand: false, t: 99, tucked: false, peck: 0 };
  }
  // A hen walks to a mark close by, and sprints to one further off.
  if (kind === 'hen') return d > grid * 2 ? { ...out, mode: 'sprint', want: face, t: 0, len: 1 } : { ...out, mode: 'walk', want: face, wait: 1 };
  if (kind === 'dog') return { ...out, mode: 'trot', tx: aim.x, ty: aim.y, stuck: 0 };
  // The farm's walk there, and run when it is far.
  if (FARM_ORDER_KINDS[kind]) return { ...out, mode: d > grid * 3 ? 'flee' : 'walk', a: face, wait: 1 };
  return out;
}
