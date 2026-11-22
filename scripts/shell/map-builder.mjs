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
export function mapBuilderHtml({ last = {}, own = {}, built = false } = {}) {
  const preset = MAP_PRESETS[last.preset] ? last.preset : MAP_PRESET_IDS[0], trees = last.trees in TREE_AMOUNTS ? last.trees : 'usual';
  const mine = [own.picture ? 'a map picture' : '', own.walls ? `${own.walls} wall${own.walls === 1 ? '' : 's'}` : '', own.regions ? `${own.regions} region${own.regions === 1 ? '' : 's'}` : ''].filter(Boolean);
  return `<div class="animater-map-builder">
    <p>Lays out a whole map on this scene: ground, roads, water, buildings with their doors, windows and roofs, and what stands in and around them. Made on this computer; nothing is sent anywhere.</p>
    <div class="form-group"><label for="animater-build-preset">What to build</label><select id="animater-build-preset" name="preset">${MAP_PRESET_IDS.map((id) => `<option value="${id}" ${id === preset ? 'selected' : ''} title="${escapeHtml(MAP_PRESETS[id].hint)}">${escapeHtml(MAP_PRESETS[id].label)}</option>`).join('')}</select></div>
    <div class="form-group"><label for="animater-build-trees">Trees</label><select id="animater-build-trees" name="trees">${Object.keys(TREE_AMOUNTS).map((id) => `<option value="${id}" ${id === trees ? 'selected' : ''}>${TREE_LABELS[id]}</option>`).join('')}</select></div>
    <div class="form-group"><label for="animater-build-seed">Seed</label><input id="animater-build-seed" type="text" name="seed" inputmode="numeric" value="" placeholder="${last.seed ? `last: ${escapeHtml(last.seed)}` : 'a new one each time'}"><p class="hint">Leave empty for a different map each time. The same seed always builds the same map on a scene of the same size.</p></div>
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
  async function build({ preset = 'village', seed = randomSeed(), trees = 'usual' } = {}, s = scene()) {
    const canvas = globalThis.canvas;
    if (!s || globalThis.game?.user?.isGM !== true || !canvas?.ready || canvas.scene?.id !== s.id) return null;
    const rect = canvas.dimensions?.sceneRect, grid = canvas.grid?.size ?? 100;
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    const plan = buildPlan(preset, { x: rect.x, y: rect.y, width: rect.width, height: rect.height, grid, seed, trees });
    const docs = planDocuments(plan, { grid }), levelId = canvas.level?.id ?? null;
    await clear(s);
    // The ground first and the rest in the plan's order: regions made together keep it.
    if (docs.regions.length) await s.createEmbeddedDocuments('Region', docs.regions.map((r) => ({ ...r, levels: levelId ? [levelId] : [] })));
    if (docs.walls.length) await s.createEmbeddedDocuments('Wall', docs.walls);
    if (docs.lights.length) await s.createEmbeddedDocuments('AmbientLight', docs.lights);
    await s.update({ [`flags.${ID}.roofs`]: [...found(s).roofsKept, ...docs.roofs], [`flags.${ID}.builtMap`]: { preset: plan.preset, seed: plan.seed, trees } });
    return { preset: plan.preset, seed: plan.seed, buildings: plan.buildings.length, things: plan.things.length, walls: docs.walls.length, regions: docs.regions.length };
  }

  /** The window: what to build, how wooded, a seed. Build, or clear what was built. */
  async function open() {
    const s = scene();
    if (!s || globalThis.game?.user?.isGM !== true) return;
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (!DialogV2) return;
    const mine = found(s), built = mine.walls.length + mine.regions.length + mine.lights.length > 0;
    const own = { picture: !!(globalThis.canvas?.level?.background?.src ?? s.background?.src), walls: (s.walls?.size ?? 0) - mine.walls.length, regions: (s.regions?.size ?? 0) - mine.regions.length };
    const read = (_event, button) => { const form = button.form?.elements; return { preset: form?.preset?.value, trees: form?.trees?.value, seed: form?.seed?.value }; };
    const answer = await DialogV2.wait({ window: { title: 'Build a map (Animater)', icon: 'fa-solid fa-map' }, classes: ['animater-map-builder-window'], position: { width: 440 }, rejectClose: false,
      content: mapBuilderHtml({ last: flags(s).builtMap ?? {}, own, built }),
      buttons: [{ action: 'build', label: built ? 'Build again' : 'Build', icon: 'fa-solid fa-hammer', default: true, callback: (event, button) => ({ ...read(event, button), act: 'build' }) },
        ...(built ? [{ action: 'clear', label: 'Clear what was built', icon: 'fa-solid fa-eraser', callback: () => ({ act: 'clear' }) }] : []),
        { action: 'cancel', label: 'Close', icon: 'fa-solid fa-xmark' }] });
    if (!answer || typeof answer !== 'object') return;
    try {
      if (answer.act === 'clear') { const gone = await clear(s); if (gone) notify('info', `Animater: cleared the built map (${gone.walls} walls, ${gone.regions} regions, ${gone.roofs} roofs). Your own work is untouched.`); return; }
      const made = await build({ preset: answer.preset, trees: answer.trees, seed: seedOf(answer.seed) ?? randomSeed() }, s);
      if (made) notify('info', `Animater: built a ${MAP_PRESETS[made.preset].label.toLowerCase()} — seed ${made.seed}. ${made.buildings} building${made.buildings === 1 ? '' : 's'}, ${made.things} things. Open Build a map again for another.`);
      else notify('warn', 'Animater: nothing was built. Open the scene you want to build on first.');
    } catch (err) { console.warn('Animater | build a map', err); notify('error', 'Animater: the map could not be built. See the console (F12).'); }
  }

  return { open, build, clear };
}
