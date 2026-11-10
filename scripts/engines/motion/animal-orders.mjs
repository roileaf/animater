// Orders the GM gives an animal from its HUD (ui/animal-hud.mjs): go to a spot, follow a token, circle a token. They are
// kept on the placed animal in the scene's flags (flags.animater.placedAnimals[].order), so every screen moves it the same
// way. Each layer steers an ordered animal with its own gait (orderPrep): the deer and wolves walk there, a fox trots, a
// rabbit hops, a squirrel dashes, a snake slides, a songbird flies, a hawk circles over it. An ordered animal does not
// run from people: it is with them.

export const ORDER_TYPES = Object.freeze(['go', 'follow', 'circle']);
// The kinds that take orders (and can be put down by hand).
export const ORDERABLE = Object.freeze(['rabbit', 'songbird', 'hawk', 'deer', 'fox', 'wolf', 'squirrel', 'snake']);

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
  return out;
}
