// Counteract and dispel: a successful counteract check (PF2e/SF2e) or Dispel Magic / Counterspell (D&D 5e) makes the
// lasting areas and auras that end soon after shatter; a failed one makes the targeted ones flicker and hold.
// Detection reads message and roll data; main.mjs broadcasts the result and draws the visuals (shatter-fx.mjs).
import { rollPrivacy, hidden, hidesResult } from '../../core/privacy.mjs';

// How long after a dispel a lasting effect that ends counts as dispelled.
export const DISPEL_WINDOW_MS = 4000;
export const FLICKER_MS = 600;
// "success" and "failure" from a known degree; "unknown" when the check had no DC or its result is hidden: what
// ends in the window still shatters (the GM ending it is the verdict), but nothing flickers.
export const DISPEL_OUTCOMES = new Set(['success', 'failure', 'unknown']);
const DEGREE = { criticalSuccess: 'success', success: 'success', failure: 'failure', criticalFailure: 'failure' };

const tokenIdOf = (uuid) => /(?:^|\.)Token\.([^.]+)/.exec(String(uuid ?? ''))?.[1] ?? null;
const unique = (ids) => [...new Set(ids.filter((id) => typeof id === 'string' && id))];
export const idsOfTokens = (tokens) => unique(Array.from(tokens ?? [], (t) => t?.id ?? t?.document?.id));

const isCounteract = (context) => context?.type === 'counteract-check'
  || (context?.type === 'check' && (
    Array.from(context.domains ?? []).includes('counteract-check')
    || Array.from(context.options ?? []).some((o) => o === 'counteract' || o === 'check:statistic:counteract')));

// PF2e/SF2e: a counteract check (a spell's Counteract button, Dispel Magic, an inline counteract check). Its target is
// the check's target token, else the roller's own targets (`targets`: token ids, given on the author's client).
export function twoeCounteract(message, systemId = 'pf2e', { targets = [] } = {}) {
  const context = message?.flags?.[systemId]?.context;
  if (!isCounteract(context)) return null;
  const privacy = rollPrivacy(message);
  const outcome = hidden(privacy) || hidesResult(privacy) ? 'unknown' : DEGREE[context.outcome] ?? 'unknown';
  const own = tokenIdOf(context.target?.token);
  return { outcome, tokenIds: own ? [own] : unique(Array.from(targets ?? [])) };
}

// D&D 5e: the spells that end other magic.
const DND5E_DISPELS = new Set(['dispel-magic', 'counterspell']);
const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function dnd5eDispelSpell(activity) {
  const item = activity?.item ?? activity?.parent?.parent;
  if (!item) return null;
  return [slug(item.system?.identifier), slug(item.name)].find((id) => DND5E_DISPELS.has(id)) ?? null;
}

// D&D 5e: casting Dispel Magic or Counterspell succeeds outright against lower-level magic. Against higher-level
// magic the caster then makes an ability check against a DC: a check by the same actor within a minute of the cast
// passes (the window opens again, for the GM ending the spell then) or fails (the targets flicker).
export function createDnd5eDispels({ now = () => Date.now(), ttlMs = 60000 } = {}) {
  const recent = new Map();
  return {
    cast(actorId, tokenIds = []) {
      if (!actorId) return null;
      const entry = { at: now(), tokenIds: unique(Array.from(tokenIds)) };
      recent.set(actorId, entry);
      return { outcome: 'success', tokenIds: entry.tokenIds };
    },
    check(actorId, rolls = []) {
      const entry = recent.get(actorId), roll = rolls?.[0], dc = Number(roll?.options?.target);
      if (!entry) return null;
      if (now() - entry.at > ttlMs) { recent.delete(actorId); return null; }
      if (!roll || !Number.isFinite(dc) || !Number.isFinite(Number(roll.total))) return null;
      return { outcome: Number(roll.total) >= dc ? 'success' : 'failure', tokenIds: entry.tokenIds };
    },
    clear() { recent.clear(); },
  };
}

// The socket message, and its receiver: only the named user's own message, about the scene this client views.
export const dispelMessage = ({ outcome, tokenIds }, { sender, userId, sceneId, at }) =>
  ({ type: 'dispel', sender, userId, sceneId, outcome, tokenIds: unique(Array.from(tokenIds ?? [])), at });
export function receiveDispel(data, senderId, { sceneId, handle }) {
  if (data?.type !== 'dispel' || (senderId && data.userId !== senderId) || !DISPEL_OUTCOMES.has(data.outcome)) return false;
  if (data.sceneId && sceneId && data.sceneId !== sceneId) return false;
  handle({ outcome: data.outcome, tokenIds: unique(Array.from(data.tokenIds ?? [])) });
  return true;
}

// The tokens an effect sits on or reaches: Sequencer keeps them as uuids (or placeables) on source and target.
export function effectTokenIds(data) {
  if (!data) return [];
  return unique([data.source, data.target].map((v) => tokenIdOf(typeof v === 'string' ? v : v?.uuid ?? v?.document?.uuid)));
}
export const lastingAnimaterEffect = (effect) => {
  const data = effect?.data;
  return Boolean(data && data.moduleName === 'animater' && data.persist === true && !data.animaterPreview);
};
export const spotHolds = (spot, point) => Boolean(spot && point && Math.hypot(point.x - spot.x, point.y - spot.y) <= spot.radius);

// Dispels heard on this client, kept for DISPEL_WINDOW_MS from when they arrived (local clock; senders' clocks differ).
// A lasting effect ending now shatters when a success (or unknown) is open whose targets include the token the effect
// sits on; an effect on no token (an area), or a dispel with no targets, always matches.
export function createDispelWindow({ now = () => performance.now(), windowMs = DISPEL_WINDOW_MS } = {}) {
  let open = [];
  const prune = (t) => { open = open.filter((d) => t - d.at <= windowMs); };
  return {
    add({ outcome, tokenIds = [] }) {
      if (outcome === 'failure') return;
      const t = now();
      prune(t);
      open.push({ at: t, tokenIds: new Set(tokenIds) });
      if (open.length > 20) open.shift();
    },
    shatters(data) {
      if (!open.length) return false;
      prune(now());
      const on = effectTokenIds(data);
      return open.some((d) => !d.tokenIds.size || !on.length || on.some((id) => d.tokenIds.has(id)));
    },
    // Whether any dispel is still open (lets the caller skip its per-frame look for effects starting to fade).
    isOpen() {
      if (!open.length) return false;
      prune(now());
      return open.length > 0;
    },
    clear() { open = []; },
  };
}

// The flicker: a few quick, uneven dips over its length, back to full at the end.
export function flickerFactor(k) {
  if (!(k > 0) || k >= 1) return 1;
  const dip = Math.abs(Math.sin(k * Math.PI * 4.5)) * (0.55 + 0.25 * Math.sin(k * 23));
  return Math.max(0.15, 1 - dip * (1 - k * 0.4));
}

// Flickers effects (anything with an `alpha`) on the PIXI ticker and puts their alpha back exactly; a second
// flicker on the same effect restarts the clock but keeps the alpha it first had. Never throws.
export function createFlickerHost({ now = () => performance.now(), durationMs = FLICKER_MS, max = 40 } = {}) {
  const active = new Map();
  const restore = (target, entry) => { try { if (!target.destroyed) target.alpha = entry.base; } catch { /* gone */ } };
  return {
    start(target) {
      if (!target) return false;
      try {
        const known = active.get(target);
        if (known) { known.at = now(); return true; }
        if (active.size >= max) return false;
        const base = Number(target.alpha);
        active.set(target, { base: Number.isFinite(base) ? base : 1, at: now() });
        return true;
      } catch { return false; }
    },
    tick() {
      if (!active.size) return;
      let t;
      try { t = now(); } catch { return; }
      for (const [target, entry] of [...active]) {
        try {
          if (target.destroyed) { active.delete(target); continue; }
          const k = (t - entry.at) / durationMs;
          if (k >= 1) { restore(target, entry); active.delete(target); continue; }
          target.alpha = entry.base * flickerFactor(k);
        } catch { active.delete(target); }
      }
    },
    clear() {
      for (const [target, entry] of active) restore(target, entry);
      active.clear();
    },
    count() { return active.size; },
  };
}
