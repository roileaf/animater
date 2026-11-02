// The generated catalogs pick their clips by code; a visual audit judged every distinct clip + tint against the items
// using it (data/catalog-look-fixes.mjs). Here those verdicts are applied to a built recipe, stage by stage: a better
// clip, a Tokenshade body look or swarm (the clip stays as the fallback where Tokenshade cannot play it), or no stage.
import { LOOK_FIXES, ITEM_LOOK_FIXES } from '../../../data/catalog-look-fixes.mjs';
import { MEDIA_DURATIONS } from '../../../data/media-durations.mjs';

// The measured length of a key (a family key: its longest variant), 0 when unmeasured.
const lengths = new Map();
export function clipLength(key) {
  if (!lengths.has(key)) {
    let ms = MEDIA_DURATIONS[key] ?? 0;
    if (!ms) for (const [k, v] of Object.entries(MEDIA_DURATIONS)) if (k.startsWith(key + '.') && v > ms) ms = v;
    lengths.set(key, ms);
  }
  return lengths.get(key);
}

const ON_CREATURE = new Set(['impact', 'aura']);
// A body look can also show on the caster as it casts (wings unfurling, growth spreading from it).
const BODIES = new Set(['impact', 'aura', 'cast']);
const keyOf = (stage) => {
  const clip = String((stage.assets ?? [stage.asset])[0] ?? '').replace(/^jb2a\./, '');
  const tint = stage.tintEnabled && /^#[0-9a-f]{6}$/i.test(stage.tint ?? '') ? stage.tint.toLowerCase() : '';
  return clip ? `${clip}|${tint}` : '';
};
const tinted = (stage, tint) => (tint ? { ...stage, tintEnabled: true, tint } : { ...stage, tintEnabled: false });

// A clip swapped for one that has a verdict of its own follows that too (a badge swapped for another badge that the
// audit sends to a glow), a few steps at most.
export function fixedStage(stage, itemName) {
  let s = stage;
  for (let i = 0; i < 3 && s; i++) {
    const next = fixOnce(s, itemName);
    if (next === s) break;
    s = next;
    if (!s || s.bodyLook || s.areaMotif === 'swarm') break;
  }
  return s;
}
function fixOnce(stage, itemName) {
  const key = keyOf(stage);
  if (!key) return stage;
  const fix = ITEM_LOOK_FIXES[key]?.[itemName] ?? LOOK_FIXES[key];
  if (!fix || fix[0] === 'keep') return stage;
  const [verdict, value, tint] = fix;
  if (verdict === 'drop') return null;
  if (verdict === 'swap') {
    // The old clip stays behind it, for a library without the new one (JB2A Free).
    const assets = [`jb2a.${value}`, ...(stage.assets ?? []).filter((a) => a !== `jb2a.${value}`)];
    // A passing stage lasts long enough to show the new clip whole.
    const whole = stage.persist ? 0 : Math.ceil(clipLength(`jb2a.${value}`) / (stage.playbackRate || 1) + (stage.fadeOut ?? 0));
    return tinted({ ...stage, assets, ...(whole > (stage.duration ?? 0) ? { duration: whole } : {}) }, tint);
  }
  if (verdict === 'swarm') {
    if (!ON_CREATURE.has(stage.kind) && stage.kind !== 'template') return stage;
    return { ...(tint ? tinted(stage, tint) : stage), areaLook: 'tokenshade', areaMotif: 'swarm' };
  }
  if (verdict === 'tether') {
    if (!['travel', 'projectile'].includes(stage.kind)) return stage;
    return { ...(tint ? tinted(stage, tint) : stage), travelLook: 'tokenshade', tetherStyle: value };
  }
  if (verdict === 'look') {
    if (!BODIES.has(stage.kind)) return stage;
    return { ...(tint ? tinted(stage, tint) : stage), bodyLook: value };
  }
  return stage;
}

// `itemName`: the catalog item the recipe was built for (its name before any variant or mode is added).
export function withLookFixes(recipe, itemName = recipe?.name) {
  if (!recipe?.stages?.length) return recipe;
  let changed = false;
  const stages = [];
  // A stage others are timed from stays, whatever its verdict.
  const anchors = new Set(recipe.stages.map((s) => s.afterStage).filter(Boolean));
  for (const s of recipe.stages) {
    let f = fixedStage(s, itemName);
    if (!f && anchors.has(s.stageId)) f = s;
    if (f !== s) changed = true;
    if (f) stages.push(f);
  }
  // Nothing left to show: the recipe keeps its stages.
  return changed && stages.length ? { ...recipe, stages } : recipe;
}
