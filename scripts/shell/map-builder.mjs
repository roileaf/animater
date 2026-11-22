// Build a map: lays a whole map out on the scene being looked at, from nothing — no map picture, nothing sent
// anywhere. The layouts are engines/mapbuild/map-presets.mjs and what they are made into is map-plan.mjs; this is
// the window and the writes to the scene.
//
// What it writes is an ordinary painted map (floor regions, painted walls, roofs, a decorations region, a fire), so
// the Map painting brush and the region panel edit it afterwards like any other. Everything it makes is marked as
// built, and building again or clearing takes away only that: a GM's own walls, regions and roofs are never touched.

import { ID } from '../core/model.mjs';
import { planDocuments, builtOf } from '../engines/mapbuild/map-plan.mjs';
import { buildPlan, MAP_PRESETS, MAP_PRESET_IDS, TREE_AMOUNTS } from '../engines/mapbuild/map-presets.mjs';
import { DRESS_DEALS, DRESS_SLOTS, dressChoices, dressOn, dressPlan } from '../engines/mapbuild/map-dress.mjs';
import { ownArtList } from '../engines/mapbuild/own-art.mjs';

const TREE_LABELS = { none: 'None', few: 'A few', usual: 'The usual', thick: 'Thick' };
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A seed nobody chose: any whole number up to six digits, easy to read out and type back in. */
export const randomSeed = (random = Math.random) => 1 + Math.floor(random() * 999999);
/** The seed a GM typed, or none (pure): a whole number of one to nine digits. */
export const seedOf = (raw) => { const text = String(raw ?? '').trim(); return /^\d{1,9}$/.test(text) && Number(text) > 0 ? Number(text) : null; };

/**
 * The window's form (pure). `last` what was built here before ({ preset, seed, trees }), `own` what the scene already
 * holds that the builder did not make ({ walls, regions, picture }), `built` whether anything here is the builder's.
 */
const SLOT_LABELS = { wall: 'Walls', roof: 'Roofs', door: 'Doors', window: 'Windows', ground: 'Ground' };
/**
 * The part of the window that dresses the map in the GM's own pictures (pure): which of them may be used (a tick
 * each, from their "Yours" rows; `art` what ownArtList gives), how much of the map, and how they are dealt. `kept`
 * what was chosen last time ({ much, deal, suit, whole, off: [urls unticked], ours: { slot: false } }). Nothing when
 * the GM has picked no picture that a building or its ground can wear.
 */
export function dressHtml(art = [], kept = {}) {
  const mine = Object.fromEntries(DRESS_SLOTS.map((slot) => [slot, art.filter((it) => it.what === slot)]));
  if (!DRESS_SLOTS.some((slot) => mine[slot].length)) return '<p class="hint">Pick pictures of your own on the Map painting bar (the <strong>Yours</strong> rows under Buildings and Paths) and the builder can dress the map in them.</p>';
  const off = new Set(Array.isArray(kept.off) ? kept.off : []), much = Math.round(Math.min(1, Math.max(0, Number(kept.much ?? 0.7))) * 100), deal = DRESS_DEALS.some(([id]) => id === kept.deal) ? kept.deal : 'building';
  const chip = 'display:inline-flex;flex-direction:column;align-items:center;gap:2px;width:74px;padding:4px 3px;margin:0 4px 4px 0;border:1px solid #7a6a55;border-radius:6px;font-size:11px;text-align:center;cursor:pointer;line-height:1.15';
  const row = (slot) => {
    if (!mine[slot].length) return `<div class="form-group"><label>${SLOT_LABELS[slot]}</label><div class="form-fields"><em style="opacity:.65">None of yours yet: ours is used.</em></div></div>`;
    const chips = mine[slot].map((it) => `<label style="${chip}" title="${escapeHtml(it.name)}"><span style="width:62px;height:26px;border-radius:3px;background:#3a3024 center / ${slot === 'wall' ? 'auto 280%' : 'cover'} url('${escapeHtml(encodeURI(it.thumb || it.url))}')"></span><span>${escapeHtml(it.name.split(' ').slice(0, 3).join(' '))}</span><input type="checkbox" name="dress-${slot}" value="${escapeHtml(it.url)}" ${off.has(it.url) ? '' : 'checked'}></label>`).join('');
    return `<div class="form-group" style="align-items:flex-start"><label>${SLOT_LABELS[slot]}</label><div class="form-fields" style="flex-wrap:wrap;justify-content:flex-start">${chips}<label style="${chip};border-style:dashed" title="Our own painted ones stay in the mix for this"><span style="width:62px;height:26px;border-radius:3px;background:repeating-linear-gradient(45deg,#5a5348,#5a5348 4px,#4a443a 4px,#4a443a 8px)"></span><span>Ours too</span><input type="checkbox" name="dress-ours-${slot}" ${kept.ours?.[slot] === false ? '' : 'checked'}></label></div></div>`;
  };
  return `<fieldset><legend>Dress it with your pictures</legend>
    <div class="form-group"><label for="animater-build-much">How much</label><div class="form-fields"><input id="animater-build-much" type="range" name="dress-much" min="0" max="100" step="10" value="${much}"></div><p class="hint">How many of the buildings wear your pictures: none at the left, every one at the right. The rest are painted.</p></div>
    ${DRESS_SLOTS.map(row).join('')}
    <div class="form-group"><label for="animater-build-deal">Dealt out</label><select id="animater-build-deal" name="dress-deal">${DRESS_DEALS.map(([id, label]) => `<option value="${id}" ${id === deal ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
    <div class="form-group"><label for="animater-build-suit">Only where it suits</label><div class="form-fields"><input id="animater-build-suit" type="checkbox" name="dress-suit" ${kept.suit === false ? '' : 'checked'}></div><p class="hint">A brick strip only on a house that would have been brick, slate only where slate would have been. What each picture stands for is its "Weathers as" on the bar.</p></div>
    <div class="form-group"><label for="animater-build-whole">All yours or none</label><div class="form-fields"><input id="animater-build-whole" type="checkbox" name="dress-whole" ${kept.whole === false ? '' : 'checked'}></div><p class="hint">A building wears your walls and your roofing together, or neither: never your walls under our roof.</p></div>
    <p class="hint">Dealt by the seed: the same seed and the same ticks build the same map.</p>
  </fieldset>`;
}
/** What the GM chose in that part of the window (pure): what dressPlan takes, and what to remember for next time. */
export function dressFrom(form, art = []) {
  if (!form?.querySelector?.('[name="dress-much"]')) return null;
  const ticked = (name) => new Set([...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value));
  const pools = {}, ours = {}, off = [];
  for (const slot of DRESS_SLOTS) { const on = ticked(`dress-${slot}`), mine = art.filter((it) => it.what === slot); pools[slot] = mine.filter((it) => on.has(it.url)).map((it) => ({ url: it.url, as: it.as })); off.push(...mine.filter((it) => !on.has(it.url)).map((it) => it.url)); const box = form.querySelector(`input[name="dress-ours-${slot}"]`); ours[slot] = box ? box.checked : true; }
  const much = (Number(form.querySelector('[name="dress-much"]').value) || 0) / 100, deal = form.querySelector('[name="dress-deal"]')?.value, suit = form.querySelector('[name="dress-suit"]')?.checked !== false, whole = form.querySelector('[name="dress-whole"]')?.checked !== false;
  return { dress: dressChoices({ much, deal, suit, whole, pools, ours }), kept: { much, deal, suit, whole, off, ours } };
}

export function mapBuilderHtml({ last = {}, own = {}, built = false, art = [], dress = {} } = {}) {
  const preset = MAP_PRESETS[last.preset] ? last.preset : MAP_PRESET_IDS[0], trees = last.trees in TREE_AMOUNTS ? last.trees : 'usual';
  const mine = [own.picture ? 'a map picture' : '', own.walls ? `${own.walls} wall${own.walls === 1 ? '' : 's'}` : '', own.regions ? `${own.regions} region${own.regions === 1 ? '' : 's'}` : ''].filter(Boolean);
  return `<div class="animater-map-builder">
    <p>Lays out a whole map on this scene: ground, roads, water, buildings with their doors, windows and roofs, and what stands in and around them. Made on this computer; nothing is sent anywhere.</p>
    <div class="form-group"><label for="animater-build-preset">What to build</label><select id="animater-build-preset" name="preset">${MAP_PRESET_IDS.map((id) => `<option value="${id}" ${id === preset ? 'selected' : ''} title="${escapeHtml(MAP_PRESETS[id].hint)}">${escapeHtml(MAP_PRESETS[id].label)}</option>`).join('')}</select></div>
    <div class="form-group"><label for="animater-build-trees">Trees</label><select id="animater-build-trees" name="trees">${Object.keys(TREE_AMOUNTS).map((id) => `<option value="${id}" ${id === trees ? 'selected' : ''}>${TREE_LABELS[id]}</option>`).join('')}</select></div>
    <div class="form-group"><label for="animater-build-seed">Seed</label><input id="animater-build-seed" type="text" name="seed" inputmode="numeric" value="" placeholder="${last.seed ? `last: ${escapeHtml(last.seed)}` : 'a new one each time'}"><p class="hint">Leave empty for a different map each time. The same seed always builds the same map on a scene of the same size.</p></div>
    ${dressHtml(art, dress)}
    ${built ? '<p class="notes">Building again replaces what was built here before. What you made yourself stays.</p>' : ''}
    ${mine.length ? `<p class="notes">This scene already has ${escapeHtml(mine.join(', '))} of its own. The builder leaves them alone and builds over the top.</p>` : ''}
  </div>`;
}

export function createMapBuilder({ notify = (kind, text) => globalThis.ui?.notifications?.[kind]?.(text) } = {}) {
  const scene = () => globalThis.canvas?.scene ?? null;
  const flags = (s) => s?.flags?.[ID] ?? {};
  const found = (s) => builtOf({ regions: s.regions?.contents ?? [], walls: s.walls?.contents ?? [], lights: s.lights?.contents ?? [], roofs: flags(s).roofs });

  /** Takes away what the builder made on this scene, and only that. */
  async function clear(s = scene()) {
    if (!s || globalThis.game?.user?.isGM !== true) return null;
    const mine = found(s), had = Array.isArray(flags(s).roofs) ? flags(s).roofs.length : 0;
    if (mine.walls.length) await s.deleteEmbeddedDocuments('Wall', mine.walls);
    if (mine.regions.length) await s.deleteEmbeddedDocuments('Region', mine.regions);
    if (mine.lights.length) await s.deleteEmbeddedDocuments('AmbientLight', mine.lights);
    if (had !== mine.roofsKept.length) await s.update({ [`flags.${ID}.roofs`]: mine.roofsKept });
    return { walls: mine.walls.length, regions: mine.regions.length, lights: mine.lights.length, roofs: had - mine.roofsKept.length };
  }

  /** Builds `preset` on this scene from `seed`, in place of what was built here before. */
  async function build({ preset = 'village', seed = randomSeed(), trees = 'usual', dress = null } = {}, s = scene()) {
    const canvas = globalThis.canvas;
    if (!s || globalThis.game?.user?.isGM !== true || !canvas?.ready || canvas.scene?.id !== s.id) return null;
    const rect = canvas.dimensions?.sceneRect, grid = canvas.grid?.size ?? 100;
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    const bare = buildPlan(preset, { x: rect.x, y: rect.y, width: rect.width, height: rect.height, grid, seed, trees });
    // The GM's own pictures dealt over it, where they asked for that (map-dress.mjs): by the same seed.
    const worn = dressOn(dress) ? dressPlan(bare, dress, bare.seed ?? seed) : { plan: bare, dressed: 0 }, plan = worn.plan;
    const docs = planDocuments(plan, { grid }), levelId = canvas.level?.id ?? null;
    await clear(s);
    // The ground first and the rest in the plan's order: regions made together keep it.
    if (docs.regions.length) await s.createEmbeddedDocuments('Region', docs.regions.map((r) => ({ ...r, levels: levelId ? [levelId] : [] })));
    if (docs.walls.length) await s.createEmbeddedDocuments('Wall', docs.walls);
    if (docs.lights.length) await s.createEmbeddedDocuments('AmbientLight', docs.lights);
    await s.update({ [`flags.${ID}.roofs`]: [...found(s).roofsKept, ...docs.roofs], [`flags.${ID}.builtMap`]: { preset: plan.preset, seed: plan.seed, trees } });
    return { preset: plan.preset, seed: plan.seed, buildings: plan.buildings.length, dressed: worn.dressed, things: plan.things.length, walls: docs.walls.length, regions: docs.regions.length };
  }

  /** The window: what to build, how wooded, a seed. Build, or clear what was built. */
  async function open() {
    const s = scene();
    if (!s || globalThis.game?.user?.isGM !== true) return;
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (!DialogV2) return;
    const mine = found(s), built = mine.walls.length + mine.regions.length + mine.lights.length > 0;
    const own = { picture: !!(globalThis.canvas?.level?.background?.src ?? s.background?.src), walls: (s.walls?.size ?? 0) - mine.walls.length, regions: (s.regions?.size ?? 0) - mine.regions.length };
    // The GM's own pictures (their "Yours" rows), and what they chose to do with them here last time.
    const user = globalThis.game?.user, art = ownArtList(user?.getFlag?.(ID, 'ownArt')), keptDress = user?.getFlag?.(ID, 'buildDress') ?? {};
    const read = (_event, button) => { const form = button.form?.elements; return { preset: form?.preset?.value, trees: form?.trees?.value, seed: form?.seed?.value, wear: dressFrom(button.form, art) }; };
    const answer = await DialogV2.wait({ window: { title: 'Build a map (Animater)', icon: 'fa-solid fa-map' }, classes: ['animater-map-builder-window'], position: { width: 440 }, rejectClose: false,
      content: mapBuilderHtml({ last: flags(s).builtMap ?? {}, own, built, art, dress: keptDress }),
      buttons: [{ action: 'build', label: built ? 'Build again' : 'Build', icon: 'fa-solid fa-hammer', default: true, callback: (event, button) => ({ ...read(event, button), act: 'build' }) },
        ...(built ? [{ action: 'clear', label: 'Clear what was built', icon: 'fa-solid fa-eraser', callback: () => ({ act: 'clear' }) }] : []),
        { action: 'cancel', label: 'Close', icon: 'fa-solid fa-xmark' }] });
    if (!answer || typeof answer !== 'object') return;
    try {
      if (answer.act === 'clear') { const gone = await clear(s); if (gone) notify('info', `Animater: cleared the built map (${gone.walls} walls, ${gone.regions} regions, ${gone.roofs} roofs). Your own work is untouched.`); return; }
      if (answer.wear?.kept) { try { void user?.setFlag?.(ID, 'buildDress', answer.wear.kept); } catch { /* remembered for this sitting only */ } }
      const made = await build({ preset: answer.preset, trees: answer.trees, seed: seedOf(answer.seed) ?? randomSeed(), dress: answer.wear?.dress ?? null }, s);
      if (made) notify('info', `Animater: built a ${MAP_PRESETS[made.preset].label.toLowerCase()} — seed ${made.seed}. ${made.buildings} building${made.buildings === 1 ? '' : 's'}${made.dressed ? `, ${made.dressed} in your pictures` : ''}, ${made.things} things. Open Build a map again for another.`);
      else notify('warn', 'Animater: nothing was built. Open the scene you want to build on first.');
    } catch (err) { console.warn('Animater | build a map', err); notify('error', 'Animater: the map could not be built. See the console (F12).'); }
  }

  return { open, build, clear };
}
