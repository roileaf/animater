import { resolveAsset } from '../../core/model.mjs';
import { lightColor } from '../lighting/effect-lights.mjs';
import { warpTag } from '../distortion/scene-distortion.mjs';

// Teleport spells: the one who cast clicks a spot within range, and the caster (or the
// first target) vanishes and reappears there. With finishers, the only Animater features that
// move a token for real, so it is off unless a recipe turns it on (known teleport spells do by default).

// Known teleport spells (by slug). range: feet when the item itself says "self"; adjacent:
// the spot must be next to the caster (Friendfetch brings an ally to you).
export const TELEPORT_DEFAULTS = {
  translocate: { who: "source" },
  "dimension-door": { who: "source" },
  friendfetch: { who: "target", adjacent: true },
  "misty-step": { who: "source", range: 30 },
  "thunder-step": { who: "source", range: 90 },
  "far-step": { who: "source", range: 60 },
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
export function teleportPlan(recipe) {
  if (!recipe || recipe.teleport === "none") return null;
  const known = String(recipe.match ?? "").split(",").map(slug).map((s) => TELEPORT_DEFAULTS[s]).find(Boolean) ?? null;
  const who = TELEPORT_WHO[recipe.teleport] && recipe.teleport !== "none" ? recipe.teleport : known?.who;
  if (!who) return null;
  return { who, range: Number(recipe.teleportRange) > 0 ? Number(recipe.teleportRange) : known?.range ?? 0, adjacent: recipe.teleportAdjacent ?? known?.adjacent ?? false };
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

// The host retains ownership/socket rules; visuals bracket the same real token move.
// The arrival effect carries the afterimage streak (`animaterTrail`), tinted like that effect: its tint, the
// colour word in its key, else the spell's element ("" leaves each client's soft white).
// Both effects also carry a warp of space (`animaterWarp`, map distortion), the token's size plus a square, when the
// host turns it on. No effect, no warp.
export async function playTeleport({ mover, x, y, visuals, element }, host) {
  const size = mover.w * visuals.scale, from = { ...mover.center };
  const to = { x: x + mover.w / 2, y: y + mover.h / 2 };
  const warps = host.mapDistortion?.() === true, radius = Math.max(mover.w, mover.h) + (host.gridSize?.() ?? mover.w);
  const warp = (at) => (warps ? { animaterWarp: warpTag(at, radius, mover.document?.level) } : null);
  await host.wait(450);
  if (visuals.out) host.effect(visuals.out, from, size, visuals.tint, warp(from));
  await host.wait(700);
  await host.move(mover, x, y);
  if (!visuals.in) return;
  const tint = lightColor({ tint: visuals.tint, asset: visuals.in }, { element, fallback: '' });
  host.effect(visuals.in, to, size, visuals.tint, { animaterTrail: { from, to, tint, tokenId: mover.document?.id ?? mover.id }, ...warp(to) });
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
