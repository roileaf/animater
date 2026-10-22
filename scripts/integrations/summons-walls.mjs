// PF2e Summons Assistant places walls and summons as tokens of its own creatures and draws them its own
// way: Wall of Fire as a lasting Sequencer effect of its own (not Animater's, so never planned a light),
// Floating Flame and Ignite the Sun as glowing token art. Every client derives the same lasting light
// from that effect or token data and keeps it on the light host; nothing is written anywhere.
import { isLuminous, lightColor, lightShape, lightRadius, spreadAlong, LASTING_MS } from '../engines/lighting/effect-lights.mjs';

export const SUMMONS = 'pf2e-summons-assistant';
const FADE_MS = 300;
const MEDIA = /\.(?:webm|webp|mp4|m4v|ogg|ogv|png|jpe?g|gif|svg|avif)$/i;

/** Whether an actor is one of the summons assistant's creatures (its compendium, or its flags on a summon). */
export function isSummonsActor(actor) {
  if (!actor) return false;
  if (actor.flags?.[SUMMONS]) return true;
  const source = actor.sourceId ?? actor._stats?.compendiumSource ?? actor.flags?.core?.sourceId;
  return typeof source === 'string' && source.startsWith(`Compendium.${SUMMONS}.`);
}

/**
 * Art as dotted words for isLuminous and the colour words: a Sequencer key stays as it is; a file path
 * keeps its folder and file name, split at case changes ('Flaming_Sphere/FlamingSphere_02_Orange_400x400.webm'
 * -> 'flaming.sphere.flaming.sphere.02.orange.400x400').
 */
export function artWords(src) {
  const text = String(src ?? '').split(/[?#]/)[0].trim();
  if (!/[/\\]/.test(text) && !MEDIA.test(text)) return text.toLowerCase();
  return text.split(/[/\\]/).filter(Boolean).slice(-2).join('.').replace(MEDIA, '')
    .replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
}

// A lasting light coloured and shaped by its art: fire flickers, anything else pulses.
const lastingTag = (key, radiusPx, grid, elevation) => ({
  color: lightColor({ asset: key }), shape: lightShape({ asset: key, persist: true }),
  ...lightRadius(radiusPx, grid), startMs: 0, lengthMs: LASTING_MS, fadeMs: FADE_MS, lasting: true,
  ...(Number.isFinite(elevation) ? { elevation } : {}),
});

/**
 * The light of a summons' own lasting effect, or null. `data` is the Sequencer effect's data, `actor`,
 * `hidden` and `elevation` its token's; a line stretched `from` -> `to` gets up to three lights along it,
 * anything else one light riding on the effect, sized to its drawn width `sizePx`.
 */
export function summonsEffectLight({ data, actor, hidden, from, to, sizePx, elevation } = {}, { grid = 100 } = {}) {
  const key = typeof data?.file === 'string' ? artWords(data.file) : '';
  if (!data || data.moduleName === 'animater' || !data.persist || !isLuminous(key)) return null;
  if (hidden || !isSummonsActor(actor)) return null;
  const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  if (data.stretchTo && ok(from) && ok(to)) {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const tag = lastingTag(key, length / 2, grid, elevation);
    tag.at = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const along = spreadAlong(from, to, grid);
    return along ? Object.assign(tag, along) : tag;
  }
  return { ...lastingTag(key, (sizePx ?? 0) / 2, grid, elevation), follow: true };
}

/** The light of a summons token whose own art glows, riding on the token; null for any other token. */
export function summonsTokenLight({ actor, hidden, src, widthPx, heightPx, scale = 1, elevation } = {}, { grid = 100 } = {}) {
  const key = artWords(src);
  if (hidden || !isLuminous(key) || !isSummonsActor(actor)) return null;
  const size = Math.max(widthPx ?? 0, heightPx ?? 0) * Math.abs(Number(scale) || 1);
  return { ...lastingTag(key, size / 2, grid, elevation), follow: true };
}

// Quick look before an effect is ready: only another module's lasting, glowing effect can qualify.
const mayGlow = (data) => !!data && data.moduleName !== 'animater' && !!data.persist
  && typeof data.file === 'string' && isLuminous(artWords(data.file));

/**
 * Keeps the summons' lights on the light host. Foundry is reached only through the options:
 * `describeEffect(effect)` -> { data, tokenId, actor, hidden, elevation, from, to, sizePx } or null (another
 * scene, no summons token), `describeToken(doc)` -> { id, actor, hidden, src, widthPx, heightPx, scale,
 * elevation }, `centerOf(doc)` -> the token's centre now, `enabled()` -> effect lighting is on.
 */
export function createSummonsLights({ host, describeEffect, describeToken, centerOf, enabled = () => true, grid = () => 100 }) {
  const pending = new Set(); // effects waiting to be drawn before their place is known
  const effectLights = new Map(); // effect -> { anchor, tokenId }
  const tokenLights = new Map(); // token id -> anchor

  const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
  const isOn = () => safe(enabled, false) === true;
  const endAnchor = (anchor) => { if (!anchor) return; anchor.gone = true; host.onEnded(anchor); };

  const lightEffect = (effect) => {
    if (!isOn()) return;
    const info = safe(() => describeEffect(effect));
    if (!info) return;
    // Kept even unlit (a hidden token's), so showing the token lights it.
    const tag = summonsEffectLight(info, { grid: grid() });
    const anchor = tag && {
      gone: false,
      get ready() { return !!effect.ready; },
      get destroyed() { return this.gone || !!effect.destroyed; },
      get worldPosition() { return effect.worldPosition; },
    };
    effectLights.set(effect, { anchor, tokenId: info.tokenId });
    if (anchor) host.onAnchor(anchor, tag);
  };

  const lightToken = (doc) => {
    endAnchor(tokenLights.get(doc?.id));
    tokenLights.delete(doc?.id);
    if (!doc || !isOn()) return;
    const info = safe(() => describeToken(doc));
    const tag = info && summonsTokenLight(info, { grid: grid() });
    if (!tag) return;
    const anchor = {
      gone: false, ready: true,
      get destroyed() { return this.gone; },
      get worldPosition() { return centerOf(doc); },
    };
    tokenLights.set(doc.id, anchor);
    host.onAnchor(anchor, tag);
  };

  // A token's effect lights go dark while it is hidden and come back when it is shown.
  const relightEffectsOf = (tokenId) => {
    for (const [effect, entry] of [...effectLights]) {
      if (entry.tokenId !== tokenId) continue;
      endAnchor(entry.anchor);
      effectLights.delete(effect);
      if (!effect.destroyed) lightEffect(effect);
    }
  };

  return {
    onEffect(effect) {
      if (mayGlow(effect?.data) && !effectLights.has(effect)) pending.add(effect);
    },

    onEffectEnded(effect) {
      pending.delete(effect);
      endAnchor(effectLights.get(effect)?.anchor);
      effectLights.delete(effect);
    },

    onToken(doc) {
      lightToken(doc);
    },

    onTokenUpdate(doc, changes = {}) {
      if (['hidden', 'width', 'height', 'texture', 'actorId', 'elevation'].some((k) => k in changes)) lightToken(doc);
      if ('hidden' in changes || 'elevation' in changes) relightEffectsOf(doc?.id);
    },

    onTokenDelete(doc) {
      endAnchor(tokenLights.get(doc?.id));
      tokenLights.delete(doc?.id);
      for (const [effect, entry] of [...effectLights]) {
        if (entry.tokenId !== doc?.id) continue;
        endAnchor(entry.anchor);
        effectLights.delete(effect);
      }
    },

    // Each frame, before the light host: an effect's ends are known once Sequencer has drawn it.
    tick() {
      for (const effect of [...pending]) {
        if (effect.destroyed) { pending.delete(effect); continue; }
        if (!effect.ready) continue;
        pending.delete(effect);
        try { lightEffect(effect); } catch (err) { console.warn('Animater | could not light a summons effect', err); }
      }
    },

    clear() {
      pending.clear();
      effectLights.clear();
      tokenLights.clear();
    },
  };
}
