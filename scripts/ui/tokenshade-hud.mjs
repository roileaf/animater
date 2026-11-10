// Tokenshade on the Token HUD: a button that opens a quick picker of looks for this token. A click applies one for
// everyone (the token's flags, playback/applied-looks.mjs), × on a look already on it takes it off, and hovering a
// look tries it on the token on this screen only. Transitions and looks that follow the game stay out: they play once
// or need the game's values, so they make no lasting look.
import { PRESET_GROUPS, presetGroup } from './tokenshade-studio.mjs';

export const HUD_LIBRARIES = ['tokenshade', 'tokenshade-custom'];
export const HUD_SKIP = new Set(['Transitions', 'Follows the game']);
export const RECENT = 'Recent', MINE = 'Mine', MAX_RECENT = 8;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const lookKey = (l) => `${l.library}|${l.name}`;

// The looks the picker offers (pure): from the installed presets [{ name, library }], each with its section.
// paramsOf(library, name) gives a preset's layers (what decides Transitions and Follows the game).
export function hudLooks(presets = [], paramsOf = () => []) {
  const out = [];
  for (const p of presets) {
    if (!HUD_LIBRARIES.includes(p?.library) || !p.name) continue;
    const params = paramsOf(p.library, p.name) ?? [];
    const group = presetGroup(p.name, params);
    if (HUD_SKIP.has(group)) continue;
    out.push({ name: p.name, library: p.library, group: p.library === 'tokenshade-custom' ? MINE : group });
  }
  return out;
}
// The sections shown (pure): Recent when there are some, the studio's sections that have looks, then Mine.
export function hudSections(looks = [], recent = []) {
  const has = new Set(looks.map((l) => l.group)), keys = new Set(looks.map(lookKey));
  return [...(recent.some((k) => keys.has(k)) ? [RECENT] : []), ...PRESET_GROUPS.filter((g) => has.has(g)), ...(has.has(MINE) ? [MINE] : [])];
}
// The looks to list (pure): a search goes through every section; otherwise the chosen one (Recent in the order used).
export function hudFilter(looks = [], { section = null, query = '', recent = [] } = {}) {
  const q = String(query ?? '').trim().toLowerCase();
  if (q) return looks.filter((l) => l.name.toLowerCase().includes(q));
  if (section === RECENT) return recent.map((k) => looks.find((l) => lookKey(l) === k)).filter(Boolean);
  return looks.filter((l) => l.group === section);
}
// The recent list with a look just applied at the front (pure).
export const pushRecent = (list = [], key, max = MAX_RECENT) => [key, ...list.filter((k) => k !== key)].slice(0, max);

// This screen's recent looks (a convenience: nothing is lost without them).
const RECENT_KEY = 'animater.tokenshadeHudRecent';
export const readRecent = (store = globalThis.localStorage) => { try { const v = JSON.parse(store?.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []; } catch { return []; } };
export const writeRecent = (list, store = globalThis.localStorage) => { try { store?.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* not kept */ } };

// The picker's inside (pure HTML): the looks already on the token, the search, the sections and the looks.
export function hudPaletteHTML({ looks = [], applied = [], section = null, query = '', recent = [] } = {}) {
  const sections = hudSections(looks, recent), current = sections.includes(section) ? section : sections[0] ?? null;
  const list = hudFilter(looks, { section: current, query, recent });
  const on = applied.length
    ? `<div class="an-tshud-label">On this token</div><div class="an-tshud-on">${applied.map((a) => `<button type="button" class="an-tshud-chip" data-ts-remove="${esc(a.id)}" title="Take it off">${esc(a.name)} <i class="fa-solid fa-xmark"></i></button>`).join('')}</div>`
    : '';
  const tabs = sections.map((s) => `<button type="button" class="an-tshud-tab${s === current && !query ? ' is-active' : ''}" data-ts-section="${esc(s)}">${esc(s)}</button>`).join('');
  const items = list.length
    ? list.map((l) => `<button type="button" class="an-tshud-look" data-ts-apply="${esc(lookKey(l))}" title="Apply for everyone">${esc(l.name.replace(/^(Attitude|Marker): /, ''))}</button>`).join('')
    : `<p class="an-tshud-empty">${query ? 'Nothing matches.' : 'No looks here.'}</p>`;
  return `<div class="an-tshud-head"><b>Tokenshade</b><small>for everyone · stays</small></div>${on}
    <input type="search" class="an-tshud-search" placeholder="Search ${looks.length} looks" value="${esc(query)}" aria-label="Search looks">
    <div class="an-tshud-tabs">${tabs}</div><div class="an-tshud-list">${items}</div>
    <div class="an-tshud-hint">Click: apply · hover: try it on · × takes it off</div>`;
}

// The HUD button's open picker survives the HUD redrawing itself (it does on every change to the token).
let openFor = null, state = { section: null, query: '' };
export const hudOpenFor = () => openFor;

/**
 * Adds the button to the HUD (`root` its element) and, when open, the picker. ctx: { tokenId, looks, applied, apply(look),
 * remove(id), preview(look) → stop function, recent(), remember(key) }.
 */
export function mountTokenshadeHud(root, ctx, doc = globalThis.document) {
  const col = root?.querySelector?.('.col.left');
  if (!col || col.querySelector('.an-tshud-button')) return null;
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'control-icon an-tshud-button';
  button.title = 'Tokenshade';
  button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
  col.append(button);
  let palette = null, stopPreview = null;
  const endPreview = () => { try { stopPreview?.(); } catch { /* gone */ } stopPreview = null; };
  const draw = () => {
    if (!palette) return;
    const focused = doc.activeElement?.classList?.contains('an-tshud-search'), caret = focused ? doc.activeElement.selectionStart : null;
    palette.innerHTML = hudPaletteHTML({ looks: ctx.looks, applied: ctx.applied, section: state.section, query: state.query, recent: ctx.recent() });
    if (focused) { const s = palette.querySelector('.an-tshud-search'); s.focus(); try { s.setSelectionRange(caret, caret); } catch { /* fine */ } }
  };
  const open = () => {
    openFor = ctx.tokenId;
    button.classList.add('active');
    palette = doc.createElement('div');
    palette.className = 'an-tshud-palette';
    col.append(palette);
    draw();
    const stop = (e) => e.stopPropagation();
    for (const type of ['pointerdown', 'mousedown', 'wheel', 'keydown', 'contextmenu']) palette.addEventListener(type, stop);
    palette.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.tsSection) { state.section = t.dataset.tsSection; state.query = ''; draw(); return; }
      if (t.dataset.tsRemove) { endPreview(); void ctx.remove(t.dataset.tsRemove); return; }
      const look = t.dataset.tsApply && ctx.looks.find((l) => lookKey(l) === t.dataset.tsApply);
      if (look) { endPreview(); ctx.remember(lookKey(look)); void ctx.apply(look); }
    });
    palette.addEventListener('input', (e) => { if (e.target.classList.contains('an-tshud-search')) { state.query = e.target.value; draw(); } });
    palette.addEventListener('pointerover', (e) => {
      const t = e.target.closest?.('[data-ts-apply]'); if (!t || t.dataset.tsApply === palette.dataset.previewing) return;
      endPreview(); palette.dataset.previewing = t.dataset.tsApply;
      const look = ctx.looks.find((l) => lookKey(l) === t.dataset.tsApply);
      try { stopPreview = look ? ctx.preview(look) : null; } catch { stopPreview = null; }
    });
    palette.addEventListener('pointerout', (e) => {
      const t = e.target.closest?.('[data-ts-apply]'); if (!t || t.contains(e.relatedTarget)) return;
      delete palette.dataset.previewing; endPreview();
    });
  };
  const close = () => { endPreview(); palette?.remove(); palette = null; button.classList.remove('active'); openFor = null; state = { section: state.section, query: '' }; };
  button.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (palette) close(); else open(); });
  // Another token's HUD starts closed.
  if (openFor && openFor !== ctx.tokenId) { openFor = null; state = { section: state.section, query: '' }; }
  if (openFor === ctx.tokenId) open();
  return { button, close, get open() { return Boolean(palette); }, endPreview };
}
export const closeTokenshadeHud = () => { openFor = null; };
