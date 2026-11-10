// The right-click panel for a map region (GM): every Animater setting of the region in one place. First what the region
// is (its kind), then only the sections that kind uses, each folded to a one-line summary until opened. Every control
// saves to the region's flags at once, which reach every screen. What each section holds: region-panel-sections.mjs.

import { REGION_KINDS, regionKindOf, kindFlags, panelSections, moreSections, shownFloorOf, hasRoof, setRoof } from './region-panel-model.mjs';
import { stepTabs, titled } from './region-steps-ui.mjs';
import { SECTIONS, element, button, icon } from './region-panel-sections.mjs';

const FLOOR_ICONS = Object.freeze({ cavern: 'fa-gem', lava: 'fa-fire', water: 'fa-water', ice: 'fa-icicles', snow: 'fa-snowflake', wood: 'fa-tree', sand: 'fa-umbrella-beach', grass: 'fa-seedling', dirt: 'fa-mountain', mud: 'fa-droplet', stone: 'fa-cubes' });

/**
 * The panel. open({ doc, floor, at, client: { x, y }, regions, first }) shows it by the pointer: `regions` [{ doc, floor }]
 * all those at that spot (tabs when more than one), `first` the one to show, `at` where on the map (a step spreads from
 * there); close(). `flagsOf(doc)` the region's Animater flags, `save(doc, flags)` saves some (a promise), `edit(doc)` opens
 * its steps list, `texture(flags)` whether its floor is painted now, `season(flags)` whether the season colours it,
 * `presets()` the Tokenshade look names, `weathers()` [[id, label]], `confirm(text)` a yes or no (a promise) before None
 * takes a region's settings away, `configure(doc)` Foundry's own configuration of the region (a cog by the close button).
 * `shows(doc | null)` hears which region it shows now (null once closed), to outline it on the map.
 * Its heading drags it about the screen; it stays where it is put until it closes.
 */
export function createRegionPanel({ flagsOf, save, edit, roof = { has: hasRoof, set: setRoof }, texture = () => false, season = () => false, presets = () => [], weathers = () => [], confirm = async () => true, configure = null, shows = () => {} }) {
  let shown = null;
  const tell = (doc) => { if (doc === shown) return; shown = doc; try { shows(doc); } catch { /* an outline never breaks the panel */ } };
  let box = null, open_ = null, saving = 0, drag = null, bound = false;
  // Sections opened or shut by hand (id → open), the "More" lines unfolded, and sections added from More sections; all
  // start over with each region shown.
  const folds = new Map(), mores = new Set(), added = new Set();
  const forget = () => { folds.clear(); mores.clear(); added.clear(); };
  const close = () => {
    open_ = null;
    tell(null);
    if (!box) return;
    box.remove(); box = null;
    // The embedded panel never listens on the document. Removing a listener it did not add throws where there is no document.
    if (bound) {
      bound = false;
      document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true);
      globalThis.window?.removeEventListener?.('resize', place);
    }
    stopDrag();
  };
  // Dragged by its heading: it follows the pointer from where it was taken, and keeps that place through redraws.
  const follow = (e) => { if (!drag || !open_) return; open_ = { ...open_, client: { x: drag.left + e.clientX - drag.x, y: drag.top + e.clientY - drag.y } }; place(); };
  const stopDrag = () => { if (!drag) return; drag = null; document.removeEventListener('pointermove', follow, true); document.removeEventListener('pointerup', stopDrag, true); };
  const startDrag = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target?.closest?.('button')) return;
    e.preventDefault?.();
    drag = { x: e.clientX, y: e.clientY, left: parseFloat(box.style.left) || 0, top: parseFloat(box.style.top) || 0 };
    document.addEventListener('pointermove', follow, true); document.addEventListener('pointerup', stopDrag, true);
  };
  const outside = (e) => { if (box && !box.contains(e.target)) close(); };
  const escape = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };

  const draw = () => {
    if (!open_ || !box) return;
    const target = open_.target ?? null;
    const embedded = open_.presentation?.kind === 'embedded';
    // A region with no floor of its own shows as its kind's floor, as its summaries do.
    // The creator's draft is not a live document, so it does not outline a region on the map.
    if (!target) tell(open_.doc);
    const read = target ? (target.read() ?? {}) : null;
    const doc = target ? { name: read.name ?? "" } : open_.doc;
    const own = target ? (read.own ?? {}) : (flagsOf(doc) ?? {});
    const floor = shownFloorOf(own, target ? (read.floor ?? open_.floor) : open_.floor);
    const kind = regionKindOf(own, floor);
    const roofed = target ? !!read.roofed : !!roof.has(doc);
    // Whatever the save does, draw again from the region as it now is (a refused save puts the controls back, and says so).
    // `then` runs only once the save is taken, before that redraw.
    const run = (work, then) => {
      saving++;
      return Promise.resolve().then(work).then(() => { saving--; then?.(); draw(); }, (error) => {
        saving--;
        console.warn('Animater | region panel save', error);
        globalThis.ui?.notifications?.warn?.('Animater: the region could not be saved.');
        draw();
      });
    };
    const act = (flags, then) => {
      if (target) { target.apply({ kind: 'settings', patch: flags }); then?.(); draw(); return; }
      return run(() => save(doc, flags), then);
    };
    // A roof is a behavior on the region, not a flag: `roof` noted in its flags too, so everything that redraws when a
    // region changes hears of it. In the creator the draft remembers it until Save.
    const setRoofNow = (on) => {
      if (target) { target.apply({ kind: 'roof', enabled: on }); draw(); return; }
      return run(async () => { await roof.set(doc, on); await save(doc, { roof: on }); });
    };
    // A save that gives the region another floor: once it is taken, the panel follows it, as the region's floor is what it
    // was opened with. A floor saved empty (none of its own) shows as its kind's: a cave's, or the scene's under Ground.
    const toFloor = (flags) => {
      const was = open_, next = flags.floor === '' ? shownFloorOf({ ...own, ...flags }, undefined) : flags.floor;
      if (target && next) open_ = { ...open_, floor: next };
      return act(flags, () => { if (!target && open_ === was && next) open_ = { ...was, floor: next, regions: (was.regions ?? []).map((r) => (r.doc === doc ? { ...r, floor: next } : r)) }; });
    };
    const more = (key, label, build) => {
      const on = mores.has(key), line = button('', 'an-rp-more', () => { if (on) mores.delete(key); else mores.add(key); draw(); });
      line.setAttribute('aria-expanded', String(on)); line.append(icon(on ? 'fa-caret-down' : 'fa-caret-right'), element('span', '', label));
      return on ? [line, ...build()] : [line];
    };
    const editSteps = target ? null : edit;
    const c = { doc, own, floor, kind, at: open_.at ?? null, act, toFloor, roofed, setRoof: setRoofNow, more, texture, season, presets, weathers, close, edit: editSteps, stepsNote: embedded && !editSteps ? 'Save first to edit the step list.' : '', saving: () => saving > 0 };

    const parts = [];
    if (!embedded) {
      const head = element('div', 'an-rp-head'), shut = button('', 'an-rp-close', close);
      shut.setAttribute('aria-label', 'Close'); shut.append(icon('fa-xmark'));
      head.setAttribute('data-tooltip', 'Drag to move'); head.addEventListener('pointerdown', startDrag);
      head.append(icon('fa-draw-polygon', 'an-rp-gold'), element('b', '', doc.name || `${titled(floor)} region`));
      // Roi: Foundry's own region configuration, a click away.
      if (configure) { const cog = button('', 'an-rp-close an-rp-config', () => { close(); configure(doc); }); cog.setAttribute('aria-label', 'Region configuration'); cog.setAttribute('data-tooltip', 'Foundry\'s region configuration'); cog.append(icon('fa-gear')); head.append(cog); }
      head.append(shut);
      parts.push(head);
    }

    const tabs = stepTabs((open_.regions ?? []).map((r) => ({ ...r, floor: r.doc === doc ? floor : shownFloorOf(flagsOf(r.doc) ?? {}, r.floor) })), open_.first ?? doc);
    if (tabs.length > 1) {
      const row = element('div', 'an-rp-tabs'); row.setAttribute('role', 'tablist');
      for (const tab of tabs) {
        const on = tab.doc === doc, b = button('', on ? 'an-rp-tab an-rp-on' : 'an-rp-tab', () => { if (on) return; open_ = { ...open_, doc: tab.doc, floor: tab.floor }; forget(); draw(); });
        b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(on));
        b.append(icon(FLOOR_ICONS[tab.floor] ?? 'fa-shoe-prints'), element('span', '', tab.name)); row.append(b);
      }
      parts.push(row);
    }

    const kinds = element('div', 'an-rp-kinds');
    for (const [id, glyph, label] of REGION_KINDS) {
      // None takes every Animater setting off the region: asked first when it has any.
      const pick = async () => { if (id === 'none' && Object.keys(own).length && !(await confirm(`Take every Animater setting off ${doc.name || 'this region'}? Its floor, water, animals and every other setting go, and cannot be brought back.`))) return; forget(); toFloor(kindFlags(id, own)); };
      const on = id === kind || (id === 'ground' && kind === 'deck'), b = button('', on ? 'an-rp-kind an-rp-on' : 'an-rp-kind', () => { if (!on) pick(); });
      b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', String(on));
      b.append(icon(glyph), element('span', '', label)); kinds.append(b);
    }
    parts.push(kinds);
    if (kind === 'none') parts.push(element('div', 'an-rp-none', 'Animater does nothing in this region. Pick what it is above.'));

    for (const s of panelSections(kind, own, floor, [...added])) {
      const shown = folds.has(s.id) ? folds.get(s.id) : s.open, sec = element('section', shown ? 'an-rp-sec an-rp-open' : 'an-rp-sec');
      // Once shown it stays, and open stays open until folded by hand: a change in it (drips turned off) never shuts it, or
      // takes it away, under the pointer. A new kind starts over.
      added.add(s.id); if (shown) folds.set(s.id, true);
      sec.setAttribute('data-section', s.id); sec.setAttribute('data-open', String(shown));
      const title = button('', 'an-rp-title', () => { folds.set(s.id, !shown); draw(); });
      title.setAttribute('aria-expanded', String(shown));
      title.append(icon(s.icon, 'an-rp-ic'), element('b', '', s.title), element('small', '', s.summary), icon('fa-chevron-right', 'an-rp-chev'));
      sec.append(title);
      // A folded section's controls are not built at all.
      if (shown) { const body = element('div', 'an-rp-body'); body.append(...SECTIONS[s.id](c)); sec.append(body); }
      parts.push(sec);
    }
    // The sections this kind does not use yet, by name: a click adds one, open.
    const extra = moreSections(kind, own, [...added]);
    if (extra.length) {
      const foot = element('div', 'an-rp-add-sections');
      foot.append(...more('sections', 'More sections', () => {
        const list = element('div', 'an-rp-chips an-rp-add');
        for (const s of extra) { const b = button('', '', () => { added.add(s.id); folds.set(s.id, true); mores.delete('sections'); draw(); }); b.append(icon(s.icon), element('span', '', s.title)); list.append(b); }
        return [list];
      }));
      parts.push(foot);
    }
    box.replaceChildren(...parts);
    place();
  };
  const place = () => {
    if (!box || !open_) return;
    if (open_.presentation?.kind === 'embedded') { open_.presentation.onLayout?.(); return; }
    const r = box.getBoundingClientRect(), at = open_.client ?? { x: 6, y: 6 };
    box.style.left = `${Math.max(6, Math.min(at.x, window.innerWidth - r.width - 6))}px`;
    box.style.top = `${Math.max(6, Math.min(at.y, window.innerHeight - r.height - 6))}px`;
  };
  return {
    open(what) {
      const embedded = what?.presentation?.kind === 'embedded';
      close(); forget();
      open_ = what;
      box = element('div', embedded ? 'an-region-panel an-region-embedded' : 'an-region-panel');
      if (embedded) {
        box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Effects');
        what.presentation.host?.replaceChildren?.(box);
      } else {
        box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Region');
        document.body.append(box);
        // Its listeners come first, so whatever happens in drawing, close() takes everything away again.
        document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', escape, true);
        globalThis.window?.addEventListener?.('resize', place);
        bound = true;
      }
      try { draw(); } catch (error) { console.warn('Animater | region panel', error); close(); }
    },
    close,
    get isOpen() { return !!box; },
    // The region shown, if any.
    get doc() { return open_?.doc ?? null; },
  };
}
