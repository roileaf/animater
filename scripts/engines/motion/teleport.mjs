import { resolveAsset, TELEPORT_GONE_MS } from '../../core/model.mjs';
import { lightColor } from '../lighting/effect-lights.mjs';
import { warpTag } from '../distortion/scene-distortion.mjs';
import { arrivalOf, tokenId } from '../playback/flight-path.mjs';
import { nextFrame, cancelFrame } from './canvas-frame.mjs';

// Teleport spells: the one who cast clicks a spot within range, and the caster (or the
// first target) vanishes and reappears there. With finishers, the only Animater features that
// move a token for real, so it is off unless a recipe turns it on (known teleport spells do by default).

// Known teleport spells (by slug). range: feet when the item itself says "self"; adjacent:
// the spot must be next to the caster. fetch: every target (up to 2) is dragged toward the caster, its square
// worked out by the rules, not picked (engines/motion/fetch-path.mjs), and slides there rather than vanishing
// (Friendfetch). gone: how long its catalog recipe's Teleport stage keeps the mover gone (ms): a short blink
// under half a second, a long jump longer; for a fetch, how long the slide takes.
export const TELEPORT_DEFAULTS = {
  translocate: { who: "source", gone: 700 },
  "dimension-door": { who: "source", gone: 700 },
  friendfetch: { who: "target", fetch: true, gone: 500 },
  "misty-step": { who: "source", range: 30, gone: 400 },
  "thunder-step": { who: "source", range: 90, gone: 400 },
  "far-step": { who: "source", range: 60, gone: 400 },
};
export const TELEPORT_WHO = { none: "Off", source: "The caster", target: "The first target" };
export const TELEPORT_STYLES = {
  blue: { label: 'Blue mist (default)', out: 'jb2a.misty_step.01.blue', in: 'jb2a.misty_step.02.blue' },
  purple: { label: 'Purple mist', out: 'jb2a.misty_step.01.purple', in: 'jb2a.misty_step.02.purple' },
  green: { label: 'Green mist', out: 'jb2a.misty_step.01.green', in: 'jb2a.misty_step.02.green' },
  yellow: { label: 'Golden flash', out: 'jb2a.teleport.01.yellow', in: 'jb2a.teleport.01.yellow' },
  none: { label: 'No extra effects', out: 'none', in: 'none' },
};
export function teleportStyle(recipe) {
  return Object.entries(TELEPORT_STYLES).find(([, style]) =>
    style.out === (recipe.teleportOut || TELEPORT_STYLES.blue.out) &&
    style.in === (recipe.teleportIn || TELEPORT_STYLES.blue.in))?.[0] ?? 'custom';
}
const slug = (v) => String(v ?? "").toLowerCase().trim().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// What a recipe teleports, or null. A recipe's own choice wins ("none" turns a known spell's off).
const knownTeleport = (recipe) => String(recipe?.match ?? "").split(",").map(slug).map((s) => TELEPORT_DEFAULTS[s]).find(Boolean) ?? null;
// How long a recipe's new Teleport stage keeps the mover gone: its known spell's, else the default.
export const teleportGoneMs = (recipe) => knownTeleport(recipe)?.gone ?? TELEPORT_GONE_MS;
export function teleportPlan(recipe) {
  if (!recipe || recipe.teleport === "none") return null;
  const known = knownTeleport(recipe);
  const who = TELEPORT_WHO[recipe.teleport] && recipe.teleport !== "none" ? recipe.teleport : known?.who;
  if (!who) return null;
  return { who, range: Number(recipe.teleportRange) > 0 ? Number(recipe.teleportRange) : known?.range ?? 0, adjacent: recipe.teleportAdjacent ?? known?.adjacent ?? false,
    fetch: who === "target" && known?.fetch === true };
}

// Extra departure/arrival cues belong to this recipe, rather than fixed blue puffs.
export function teleportVisuals(recipe, catalog) {
  const asset = (value, fallback) => value === 'none' ? null : resolveAsset({ kind: 'cast', assets: [value || fallback] }, catalog);
  return {
    out: asset(recipe.teleportOut, 'jb2a.misty_step.01.blue'),
    in: asset(recipe.teleportIn, 'jb2a.misty_step.02.blue'),
    scale: recipe.teleportScale ?? 1.8,
    tint: recipe.teleportTint ?? '',
  };
}

// The Teleport stage (Recipe Studio): its start is when the token vanishes, its length how long it stays gone
// before it reappears at the spot. A recipe without one (catalogs, older recipes) gets one here, at the moment
// the animation reaches the mover: a flight's arrival at it (Friendfetch's ray to the ally), else the caster's
// gesture at its key moment (strikeTime's last resort, outcome.mjs), else 450 ms.
export { TELEPORT_GONE_MS };
const TELEPORT_FALLBACK_MS = 450;
const sameToken = (a, b) => Boolean(a && b) && (a === b || (tokenId(a) !== undefined && tokenId(a) === tokenId(b)));
export function teleportMoment(plan, { who, mover } = {}) {
  if (who === 'target') {
    const flights = plan.filter((s) => ['travel', 'projectile'].includes(s.kind) && s.travelOrigin !== 'target' && sameToken(s.endpoint, mover));
    if (flights.length) return Math.round(Math.min(...flights.map((s) => (s.delay ?? 0) + arrivalOf(s))));
  }
  const gesture = plan.find((s) => s.kind === 'motion' && s.subject === 'source');
  return gesture ? Math.round(gesture.delay + gesture.duration * 0.45) : TELEPORT_FALLBACK_MS;
}
// The plan with its teleport stage: the recipe's own (the first), else one placed at teleportMoment.
// The recipe's own, linked to a flight's arrival, takes that flight's arrival as planned (a shot stopped by a
// wall arrives there sooner), the mover's own flight first.
export function withTeleportStage(plan, { who, mover } = {}) {
  const own = plan.find((s) => s.kind === 'teleport');
  if (own) {
    const linked = own.timingAnchor === 'arrival' && own.afterStage ? plan.filter((s) => ['travel', 'projectile'].includes(s.kind) && s.stageId === own.afterStage) : [];
    if (!linked.length) {
      // Linked to a stage played once per target (Friendfetch's hit on each ally): planned from the latest copy,
      // it takes this mover's copy instead.
      const copies = own.afterStage ? plan.filter((s) => s.stageId === own.afterStage) : [];
      const mine = copies.filter((s) => sameToken(s.endpoint ?? s.destination, mover));
      if (copies.length < 2 || !mine.length) return plan;
      const shift = Math.min(...mine.map((s) => s.delay ?? 0)) - Math.max(...copies.map((s) => s.delay ?? 0));
      return shift ? plan.map((s) => (s === own ? { ...own, delay: Math.max(0, Math.round((own.delay ?? 0) + shift)) } : s)) : plan;
    }
    const flights = linked.some((s) => sameToken(s.endpoint, mover)) ? linked.filter((s) => sameToken(s.endpoint, mover)) : linked;
    const delay = Math.max(0, Math.round(Math.min(...flights.map((s) => (s.delay ?? 0) + arrivalOf(s))) + (Number(own.startOffset) || 0)));
    return plan.map((s) => (s === own ? { ...own, delay } : s));
  }
  return [...plan, { kind: 'teleport', stageId: 'teleport', label: 'Teleport', synthesized: true, assets: [], delay: teleportMoment(plan, { who, mover }), duration: TELEPORT_GONE_MS }];
}
// A new Teleport stage in the Studio starts where one would be placed for this recipe: on its flight's arrival
// (a teleported target), else on the caster's gesture, else at 450 ms. Links, so it moves with that stage.
export function teleportLink(stages, who) {
  const flight = who === 'target' && stages.find((s) => ['travel', 'projectile'].includes(s.kind) && s.travelOrigin !== 'target' && s.travelDestination !== 'area');
  if (flight) return { afterStage: flight.stageId, timingAnchor: 'arrival', startOffset: 0, delay: 0 };
  const gesture = stages.find((s) => s.kind === 'motion' && (s.subject ?? 'source') === 'source');
  if (gesture) return { afterStage: gesture.stageId, timingAnchor: 'start', startOffset: Math.round((gesture.duration ?? 0) * 0.45), delay: 0 };
  return { afterStage: '', delay: TELEPORT_FALLBACK_MS };
}

// The host retains ownership/socket rules; visuals bracket the same real token move.
// timing: outAt, ms until the token vanishes (the departure effect plays); goneMs, how long it stays gone before
// it is moved and the arrival effect plays. Without it, the old fixed timing (450 ms, then 700 ms).
// The departure effect carries the vanish (`animaterVanish`, with the spot it leaves): every client hides the token
// from then on until it has moved (holdHidden); host.vanishGrace (ms) shortens the wait for a move that never comes
// (a preview). No departure effect (none chosen, or not installed): nothing hides it, so it jumps as the stage
// starts rather than standing there and popping away later.
// The arrival effect carries the afterimage streak (`animaterTrail`), tinted like that effect: its tint, the
// colour word in its key, else the spell's element ("" leaves each client's soft white).
// Both effects also carry a warp of space (`animaterWarp`, map distortion), the token's size plus a square, when the
// host turns it on. No effect, no warp.
export async function playTeleport({ mover, x, y, visuals, element }, host, { outAt = TELEPORT_FALLBACK_MS, goneMs = 700 } = {}) {
  const size = mover.w * visuals.scale, from = { ...mover.center };
  const to = { x: x + mover.w / 2, y: y + mover.h / 2 };
  const warps = host.mapDistortion?.() === true, radius = Math.max(mover.w, mover.h) + (host.gridSize?.() ?? mover.w);
  const warp = (at) => (warps ? { animaterWarp: warpTag(at, radius, mover.document?.level) } : null);
  const id = mover.document?.id ?? mover.id, doc = mover.document;
  const origin = Number.isFinite(doc?.x) && Number.isFinite(doc?.y) ? { from: { x: doc.x, y: doc.y } } : {};
  // A spot where it already stands (a preview, a pick on its own square) waits for no move.
  const stays = origin.from && origin.from.x === x && origin.from.y === y;
  const grace = stays ? { grace: 0 } : Number.isFinite(host.vanishGrace) ? { grace: host.vanishGrace } : {};
  if (outAt > 0) await host.wait(outAt);
  // A preview holds its copy at the spot for host.holdMs: the token stays hidden until that is over.
  const hidden = goneMs + (host.holdMs > 0 ? host.holdMs : 0);
  if (visuals.out) host.effect(visuals.out, from, size, visuals.tint, id && goneMs > 0 ? { animaterVanish: { tokenId: id, ms: hidden, ...origin, ...grace }, ...warp(from) } : warp(from));
  else await host.move(mover, x, y);
  if (goneMs > 0) await host.wait(goneMs);
  if (visuals.out) await host.move(mover, x, y);
  if (!visuals.in) return;
  const tint = lightColor({ tint: visuals.tint, asset: visuals.in }, { element, fallback: '' });
  host.effect(visuals.in, to, size, visuals.tint, { animaterTrail: { from, to, tint, tokenId: id }, ...warp(to) });
}

// Where a preview shows its jump landing (the token never moves there): `squares` away toward `toward` (a
// target's centre; none, or one on the token's own square, means to the right), on the grid, flipped to the
// other side when it would leave `bounds` (the scene rectangle).
export function previewSpot(mover, { gridSize = 100, bounds = null, toward = null, squares = 3 } = {}) {
  const doc = mover.document, w = mover.w ?? gridSize, h = mover.h ?? gridSize;
  const cx = doc.x + w / 2, cy = doc.y + h / 2;
  const far = toward ? Math.hypot(toward.x - cx, toward.y - cy) : 0;
  const [dx, dy] = far >= gridSize / 2 ? [(toward.x - cx) / far, (toward.y - cy) / far] : [1, 0];
  const at = (side) => ({ x: doc.x + Math.round(side * dx * squares) * gridSize, y: doc.y + Math.round(side * dy * squares) * gridSize });
  const inside = (p) => !bounds || (p.x >= bounds.x && p.y >= bounds.y && p.x + w <= bounds.x + bounds.width && p.y + h <= bounds.y + bounds.height);
  const ahead = at(1);
  return inside(ahead) ? ahead : at(-1);
}

// One client's part of a vanish: the token's art held out of sight (a token refresh would show it again, so
// every frame, as motions do) for `ms`, then up to `grace` longer while its move is still on the way (a creature
// the GM moves for the caster takes two socket trips), and given back as soon as it has left `origin` (the arrival
// effect plays there). A token already gone from its origin (the move came first) is not hidden at all.
// Returns a function that gives it back early.
export const VANISH_GRACE_MS = 1500;
const FADE_MS = 120;
export function holdHidden(token, ms, { origin = null, grace = VANISH_GRACE_MS, now = () => performance.now(), frame = nextFrame, cancel = cancelFrame } = {}) {
  const mesh = token?.mesh;
  if (!mesh || !(ms > 0)) return () => {};
  const at = Number.isFinite(origin?.x) && Number.isFinite(origin?.y) ? origin : { x: token.document?.x, y: token.document?.y };
  const moved = () => token.document && (token.document.x !== at.x || token.document.y !== at.y);
  if (moved()) return () => {};
  const start = now(), alpha = mesh.alpha ?? 1;
  let handle = null, done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancel(handle);
    if (mesh.destroyed) return;
    mesh.alpha = alpha;
    token.renderFlags?.set?.({ refreshState: true });
  };
  const step = () => {
    const elapsed = now() - start;
    if (mesh.destroyed || moved() || elapsed >= ms + grace) return finish();
    // A quick fade, then gone.
    mesh.alpha = alpha * Math.max(0, 1 - elapsed / FADE_MS);
    handle = frame(step);
  };
  step();
  return finish;
}

// The token a teleport's arrival streak copies, or null: the effect played on another scene, the token is gone,
// or this screen cannot see it (hidden from players, out of sight).
export function streakToken(trail, { sceneId, scene, isGM = false }) {
  if (!trail?.tokenId || !scene || (sceneId && sceneId !== scene.id)) return null;
  const token = scene.tokens?.get(trail.tokenId)?.object;
  if (!token?.mesh || token.visible === false || (token.document?.hidden && !isGM)) return null;
  return token;
}

// An item's range in feet, or null when it names none. PF2e: "30 feet", "touch"; D&D: { value, units }.
export function itemRangeFeet(item) {
  const parse = (text) => {
    const t = String(text ?? "").toLowerCase();
    if (/\btouch\b/.test(t)) return 5;
    const ft = t.match(/(\d[\d,]*)\s*(?:feet|foot|ft)\b/);
    if (ft) return Number(ft[1].replace(/,/g, ""));
    const mi = t.match(/(\d+)\s*miles?\b/);
    return mi ? Number(mi[1]) * 5280 : null;
  };
  const range = item?.system?.range;
  if (typeof range === "string") return parse(range);
  if (range && typeof range === "object") {
    if (typeof range.value === "string" && !/^\d+$/.test(range.value)) return parse(range.value);
    const value = Number(range.value), units = String(range.units ?? "");
    if (units === "touch") return 5;
    if (value > 0 && units === "ft") return value;
    if (value > 0 && units === "mi") return value * 5280;
    if (value > 0 && units === "m") return Math.round(value * 3.28);
  }
  return null;
}

// Can a creature of size moverSize (px) land centred at `to`? Range counts from the caster's
// edge to the mover's edge, like the rules (Infinity feet: anywhere).
export function withinReach({ from, fromSize, to, toSize, feet, gridSize, gridDistance = 5 }) {
  if (!(feet >= 0) || feet === Infinity) return true;
  const reach = (feet / (gridDistance || 5)) * gridSize + fromSize / 2 + toSize / 2;
  return Math.hypot(to.x - from.x, to.y - from.y) <= reach + 1;
}

// Foundry part: show the range and a ghost of the token, wait for a click (Esc
// cancels). Resolves { x, y } (the token's new top-left) or null.
// `allow(center)` (optional) narrows the spots inside the ring further: a push or pull's direction, a wall in the way.
// `cone` ({ angle, half } in radians) draws a wedge instead of the whole ring: the directions a push or pull allows.
export function pickTeleportSpot({ caster, mover, feet, notify, allow = null, outside = "Out of range: pick a spot inside the ring.", cone = null }) {
  const C = globalThis.canvas, view = C?.app?.view;
  if (!view || !caster || !mover) return Promise.resolve(null);
  return new Promise((resolve) => {
    const grid = C.grid.size, distance = C.scene?.grid?.distance ?? 5;
    const from = caster.center, layer = C.controls ?? C.interface;
    const ring = new PIXI.Graphics(), ghost = new PIXI.Sprite(mover.mesh?.texture ?? PIXI.Texture.WHITE);
    if (Number.isFinite(feet)) {
      const radius = (feet / distance) * grid + caster.w / 2;
      ring.lineStyle(3, 0x9e8aff, 0.9).beginFill(0x9e8aff, 0.08);
      if (cone && cone.half < Math.PI) ring.moveTo(from.x, from.y).arc(from.x, from.y, radius, cone.angle - cone.half, cone.angle + cone.half).lineTo(from.x, from.y);
      else ring.drawCircle(from.x, from.y, radius);
      ring.endFill();
    }
    ghost.anchor.set(0.5); ghost.width = mover.w; ghost.height = mover.h; ghost.alpha = 0.55;
    layer.addChild(ring, ghost);
    let spot = null;
    const at = (e) => {
      const p = C.canvasCoordinatesFromClient({ x: e.clientX, y: e.clientY });
      const top = mover.getSnappedPosition?.({ x: p.x - mover.w / 2, y: p.y - mover.h / 2 }) ?? { x: p.x - mover.w / 2, y: p.y - mover.h / 2 };
      const center = { x: top.x + mover.w / 2, y: top.y + mover.h / 2 };
      const ok = withinReach({ from, fromSize: caster.w, to: center, toSize: mover.w, feet, gridSize: grid, gridDistance: distance }) && (!allow || allow(center));
      ghost.position.set(center.x, center.y); ghost.tint = ok ? 0xffffff : 0xff5a5a;
      return ok ? top : null;
    };
    const finish = (result) => {
      view.removeEventListener("pointermove", move, true); view.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true); view.removeEventListener("contextmenu", block, true);
      ring.destroy(); ghost.destroy();
      resolve(result);
    };
    const move = (e) => { spot = at(e); };
    // Only a left click picks. Right-click and drag still pans the canvas (Foundry's own); only Esc cancels.
    const down = (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      spot = at(e);
      if (spot) finish(spot); else notify?.(outside);
    };
    const block = (e) => { e.preventDefault(); e.stopPropagation(); };
    const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(null); } };
    view.addEventListener("pointermove", move, true); view.addEventListener("pointerdown", down, true);
    view.addEventListener("contextmenu", block, true); window.addEventListener("keydown", key, true);
  });
}
