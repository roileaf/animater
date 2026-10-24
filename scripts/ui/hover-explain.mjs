// Hover explanation: hovering a token shows a small tooltip of what Animater plays on it right now
// (recipe name, where it comes from, whether it lasts). Pure helpers plus a small DOM controller;
// main.mjs wires it to hoverToken, the runtime, the lasting states and Sequencer's effects.
import { cleanOrigin, nowPlayingRows, groupNowPlaying } from "./activity-actions.mjs";

export const HOVER_LIMIT = 6;

// Where an animation comes from, from the viewer's side. `by` is the user whose client started it;
// "world" marks a lasting condition/effect layer, which plays the world's (GM-made) recipes.
export function originLabel(row, { userId, isGM = false, userName = () => "", userIsGM = () => false } = {}) {
  const origin = cleanOrigin(row?.origin);
  if (!origin) return "";
  if (origin.type === "catalog") return "Catalog";
  const by = row?.by;
  if (by === "world") return isGM ? "Your recipe" : "The GM’s recipe";
  if (!by || by === userId) return "Your recipe";
  if (by === "gm" || userIsGM(by)) return "The GM’s recipe";
  const name = userName(by);
  return name ? `${name}’s recipe` : "A player’s recipe";
}

// A Sequencer effect's data placed on (or aimed at) this token.
const onToken = (data, tokenId, tokenUuid) => [data.source, data.target, data.attachTo?.uuid].some((x) => x && (x === tokenUuid || x === tokenId || String(x).endsWith(`.Token.${tokenId}`)));

// Everything this client has playing on one token, newest first: its lasting plays (runtime sessions,
// started here), its lasting condition/effect layers (drawn on every client), and the Animater effects
// Sequencer shows here (started on any client; tagged with animaterRecipe by the runtime).
export function tokenRows({ sessions = [], states = [], effects = [], tokenId, tokenUuid, userId } = {}) {
  if (!tokenId) return [];
  const group = groupNowPlaying(nowPlayingRows(sessions, states)).find((g) => g.key === `token:${tokenId}`);
  const rows = (group?.rows ?? []).map((r) => ({ ...r, lasting: true, by: r.kind === "state" ? "world" : userId }));
  const seen = new Set(rows.filter((r) => r.session).map((r) => r.session));
  for (const effect of effects ?? []) {
    const data = effect?.data;
    try {
      if (!data || data.moduleName !== "animater" || data.animaterPreview || !data.animaterRecipe?.name) continue;
      if (!onToken(data, tokenId, tokenUuid)) continue;
      const session = data.name ? String(data.name) : "";
      if (session && seen.has(session)) continue;
      if (session) seen.add(session);
      const tag = data.animaterRecipe;
      rows.push({ id: `effect:${session}`, kind: "effect", session, name: String(tag.name), origin: cleanOrigin(tag.origin), by: tag.by ? String(tag.by) : "", lasting: data.animaterLasting === true, startedAt: Number(data.creationTimestamp) || 0 });
    } catch { /* a malformed effect is just left out */ }
  }
  return rows.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
}

// Rows -> display lines: repeats (same name, origin and lasting) merged, at most `limit`, then "and N more".
export function hoverView(rows, viewer = {}, { limit = HOVER_LIMIT } = {}) {
  const lines = new Map();
  for (const row of rows ?? []) {
    if (!row?.name) continue;
    const from = originLabel(row, viewer), lasting = row.lasting === true, key = `${row.name}\u0000${from}\u0000${lasting}`;
    if (lines.has(key)) lines.get(key).count++;
    else lines.set(key, { name: String(row.name), from, lasting, count: 1 });
  }
  const all = [...lines.values()];
  return { lines: all.slice(0, limit), more: Math.max(0, all.length - limit) };
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function hoverHTML(view) {
  if (!view?.lines?.length) return "";
  const line = (l) => {
    const tags = [l.from, l.lasting ? "Lasting" : ""].filter(Boolean).map(esc).join(" · ");
    return `<li><b>${esc(l.name)}</b>${l.count > 1 ? ` <span class="animater-hover-count">×${l.count}</span>` : ""}${tags ? `<small>${tags}</small>` : ""}</li>`;
  };
  return `<header>Animater</header><ul>${view.lines.map(line).join("")}</ul>${view.more ? `<footer>and ${view.more} more</footer>` : ""}`;
}

// The GM explains every token; a player only tokens they own or can see.
export function canExplain(token, { isGM = false } = {}) {
  if (!token || token.destroyed) return false;
  if (isGM) return true;
  if (token.isOwner || token.document?.isOwner) return true;
  return token.visible !== false && !token.document?.hidden;
}

// Client settings register at init, before game.user exists: the world's user data says who this is.
// Foundry's isGM is role ASSISTANT (3) or higher.
export function hoverExplainDefault(game) {
  if (typeof game?.user?.isGM === "boolean") return game.user.isGM;
  const me = (game?.data?.users ?? []).find((u) => u?._id === game?.userId);
  return Number(me?.role) >= 3;
}

// The token's top-right corner in screen pixels (toScreen maps canvas -> client coordinates).
export function tooltipPoint(token, toScreen) {
  if (!token || typeof toScreen !== "function") return null;
  const p = toScreen({ x: (Number(token.x) || 0) + (Number(token.w) || 0), y: Number(token.y) || 0 });
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
}

// The tooltip: one element in document.body, shown while a token is hovered and something plays on it.
// It refreshes every `every` ms while shown (plays end, the view pans or zooms).
export function createHoverExplain({ document, enabled, isGM, rowsFor, view, toScreen, setInterval: every = globalThis.setInterval, clearInterval: stop = globalThis.clearInterval, interval = 400 }) {
  let el = null, token = null, timer = null;
  const element = () => {
    if (el) return el;
    el = document.createElement("div");
    el.className = "animater-hover-explain";
    el.setAttribute("role", "tooltip");
    el.hidden = true;
    document.body.append(el);
    return el;
  };
  const conceal = () => { if (el) el.hidden = true; };
  const refresh = () => {
    if (!token) return conceal();
    try {
      if (!enabled() || !canExplain(token, { isGM: isGM() })) return conceal();
      const html = hoverHTML(view(rowsFor(token)));
      const at = html ? tooltipPoint(token, toScreen) : null;
      if (!html || !at) return conceal();
      const box = element();
      if (box.innerHTML !== html) box.innerHTML = html;
      box.style.left = `${at.x}px`;
      box.style.top = `${at.y}px`;
      box.hidden = false;
    } catch { conceal(); }
  };
  const hide = () => {
    token = null;
    if (timer !== null) { stop(timer); timer = null; }
    conceal();
  };
  return {
    hover(next, hovered) {
      if (!hovered) { if (!token || next === token || (next?.id && next.id === token.id)) hide(); return; }
      token = next;
      refresh();
      if (timer === null) timer = every(refresh, interval);
      timer?.unref?.();
    },
    refresh,
    hide,
    destroy() { hide(); el?.remove(); el = null; },
  };
}
