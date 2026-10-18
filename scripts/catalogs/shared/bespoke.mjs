// Bespoke per-entry compositions. Reviewers author full-description designs for
// individual catalog entries (spell, feat, weapon use, D&D activity, effect…)
// in scripts/bespoke/*.mjs; this layer swaps them in for the generated recipe
// while keeping the entry's optional sounds (re-anchored to the new stages) or
// selecting a different sound profile. Applied by withCatalogFx, the one hook
// every catalog builder passes through.
import { BESPOKE } from '../bespoke/index.mjs';
import { PINNED } from '../bespoke/pinned.mjs';
import { validateRecipe, MAX_STAGES } from '../../core/model.mjs';
import { addSpellSounds } from '../../engines/sound/spell-sounds.mjs';
import { addAbilitySounds } from '../../engines/sound/ability-sounds.mjs';
import { markElementChoice } from './element-choice.mjs';
import { ELEMENT_CHOICE_SPELLS } from '../bespoke/element-choice-spells.mjs';
import { withoutCatalogMotion } from './catalog-motion.mjs';
import { GENERATED_MOTION_DURATION } from '../../engines/motion/motion-pacing.mjs';
import { isPathMotion } from '../../engines/motion/motion-path.mjs';

// Lookup keys, most specific first: `<system>:<id>:<variant|mode>` then `<system>:<id>`.
export function bespokeKeys(recipe, entry = {}, options = {}) {
  const system = recipe.systemId ?? entry.systemId ?? 'pf2e';
  // SF2e merges spell/state records over the catalog entry, so try every id form.
  const ids = [...new Set([recipe.catalogEntry, entry.id, entry.documentId, entry.catalogEntry, entry.spell?.id, entry.state?.id].filter(Boolean))];
  const variant = options.variant?.id ?? options.mode?.mode ?? (typeof options.mode === 'string' ? options.mode : undefined) ?? recipe.weaponMode ?? recipe.activityId;
  // Native Area Fire is a placement variant with its own blast; a Strike design never covers it.
  return ids.flatMap(id => [...(variant ? [`${system}:${id}:${variant}`] : []), ...(variant === 'area' ? [] : [`${system}:${id}`])]);
}
const anchorKind = kind => ['travel', 'projectile'].includes(kind) ? 'travel' : ['impact', 'template'].includes(kind) ? 'impact' : kind === 'cast' ? 'cast' : 'other';
// Keep existing sound cues but point each at the new stage of the same role.
function reanchorSounds(oldStages, newStages) {
  const byId = new Map(oldStages.map(s => [s.stageId, s]));
  const visual = newStages.filter(s => !['sound', 'motion', 'sprite'].includes(s.kind));
  return oldStages.filter(s => s.kind === 'sound').map(sound => {
    const role = anchorKind(byId.get(sound.afterStage)?.kind);
    const anchor = visual.find(s => anchorKind(s.kind) === role) ?? (role === 'other' ? visual.find(s => ['aura', 'impact', 'template'].includes(s.kind)) : null) ?? visual[0];
    return anchor ? { ...sound, afterStage: anchor.stageId, timingAnchor: 'start', delay: anchor.delay ?? 0 } : null;
  }).filter(Boolean);
}
// Catalog ids embed a kind/pack prefix that can change when catalogs are split
// (e.g. sf2e-feat-actions-<doc> → sf2e-action-actions-<doc>). The trailing
// 16-character document id is stable, so index designs by it as well.
// Embedded effects are keyed <pack>-<effectId>-<parentItemId>: their trailing id is
// the parent spell/feature, so aliasing it would put the effect's status design on
// the parent's own activities (Ray of Enfeeblement lost its ray to "Enfeebled").
const DOC_ALIASES = new Map();
const EMBEDDED = /-[A-Za-z0-9]{16}-[A-Za-z0-9]{16}(?::.+)?$/;
for (const key of Object.keys(BESPOKE)) {
  if (EMBEDDED.test(key)) continue;
  const m =/^(\w+):(?:[\w-]*-)?([A-Za-z0-9]{16})(:.+)?$/.exec(key);
  if (m) DOC_ALIASES.set(`${m[1]}:${m[2]}${m[3] ?? ''}`, key);
}
const lookup = k => { const key = resolveKey(k); return key && !PINNED.has(key) ? key : undefined; };
// An embedded effect without its own design falls back to its parent's design
// (Banished → Banishment's vortex); only parents' own designs are aliased.
const resolveKey = k => (BESPOKE[k] ? k : DOC_ALIASES.get(k.replace(/^(\w+):(?:[\w-]*-)?([A-Za-z0-9]{16})/, '$1:$2')));
// A bespoke design changes the look, never the native semantics the generator
// already resolved: who is affected, how many shots, whether motion is enabled,
// and what a document-linked effect may contain.
const TARGETED = s => ['travel', 'projectile', 'impact'].includes(s.kind) || (['aura', 'motion', 'sprite'].includes(s.kind) && s.subject === 'targets');
export function keepNativeSemantics(recipe, stages, options = {}) {
  const gen = recipe.stages.filter(TARGETED);
  // Single-recipient Strikes/actions stay single-recipient.
  const single = gen.length > 0 && gen.every(s => ['first', 'secondary'].includes(s.targetSelection));
  const selection = single ? (gen.find(s => s.targetSelection === 'first') ? 'first' : 'secondary') : null;
  const limit = gen.find(s => s.targetLimit > 0)?.targetLimit;
  // Native counts (darts, volleys, upcast totals) come from the generated flight.
  const flight = recipe.stages.find(s => ['travel', 'projectile'].includes(s.kind) && ((s.repeats ?? 1) > 1 || s.repeatScope === 'total'));
  // Areas, self effects and ceremonies play with no creature targeted; their
  // bespoke contacts then simply skip instead of blocking the whole animation.
  const targetless = !gen.some(s => !s.optionalTargets && s.travelDestination !== 'area');
  let out = stages.map(s => {
    let next = s;
    if (targetless && TARGETED(next) && next.travelDestination !== 'area' && next.optionalTargets === undefined) next = { ...next, optionalTargets: true };
    if (selection && TARGETED(next) && next.targetSelection === undefined) next = { ...next, targetSelection: selection, ...(limit ? { targetLimit: limit } : {}) };
    if (flight && ['travel', 'projectile'].includes(next.kind) && next.repeats === undefined)
      next = { ...next, repeats: flight.repeats, repeatScope: flight.repeatScope, repeatInterval: flight.repeatInterval, ...(flight.repeatSimultaneous !== undefined ? { repeatSimultaneous: flight.repeatSimultaneous } : {}) };
    if (next.kind === 'motion') {
      const minimum = Math.max(GENERATED_MOTION_DURATION[next.motion] ?? 0, recipe.systemId === 'dnd5e' ? 1000 : 0);
      if ((next.duration ?? 0) < minimum) next = { ...next, duration: minimum };
      // Same pacing bounds as generated motion: routes travel, gestures stay small.
      const path = isPathMotion(next), floor = path ? 0 : 800;
      if ((next.duration ?? 0) < floor) next = { ...next, duration: floor };
      // An omitted distance would take the model default (0.35), so set it explicitly.
      if (!path && !(next.distance <= 0.25)) next = { ...next, distance: 0.25 };
      // D&D routes come only from reviewed native movement, so bespoke paths stay short there.
      const dnd = recipe.systemId === 'dnd5e', reach = dnd ? 0.25 : 12, force = dnd ? 0.6 : path ? 0.8 : 0.65;
      if (path && !(next.distance <= reach)) next = { ...next, distance: reach };
      if (next.intensity > force) next = { ...next, intensity: force };
    }
    return next;
  });
  // A lasting native area stays on its template: the design's first area layer
  // carries it (its loop footage when JB2A has one), later layers stay one-shot.
  if (recipe.stages.some(s => s.kind === 'template' && s.persist)) {
    const i = out.findIndex(s => s.kind === 'template');
    const loop = k => {
      for (const from of ['.complete.', '.burst.']) { const l = k.replace(from, '.loop.'); if (l !== k && globalThis.Sequencer?.Database?.entryExists?.(l)) return l; }
      return k;
    };
    const follow = recipe.stages.some(s => s.kind === 'template' && s.followSource);
    if (i >= 0) out[i] = { ...out[i], persist: true, oneShot: false, ...(follow ? { followSource: true } : {}), assets: (out[i].assets ?? []).map(loop) };
  }
  // Effects-only playback: the catalog's motion switch removes token motion.
  // Document-linked effects may only attach persistent layers to the bearer.
  if (recipe.lifecycle === 'document') out = out.filter(s => ['aura', 'tokenfx'].includes(s.kind)).map(s => ({ ...s, subject: 'source', persist: true, afterStage: '' }));
  return out.length ? out : recipe.stages;
}
// Builders that bake generated recipes into catalog data (SF2e) suspend the
// bespoke layer so designs are applied once, at play time.
let suspended = 0;
export function withoutBespoke(fn) { suspended++; try { return fn(); } finally { suspended--; } }
export function suspendBespoke() { suspended++; }
export function applyBespoke(recipe, entry = {}, options = {}) {
  let result = recipe;
  const key = bespokeKeys(recipe, entry, options).map(lookup).find(Boolean);
  const design = key && BESPOKE[key];
  if (design && !suspended && options.bespoke !== false && entry.bespoke !== false) {
    const built = design.build({ recipe, entry, options });
    const base = { ...recipe, ...(built.recipe ?? {}) };
    const stages = keepNativeSemantics(base, (built.stages ?? built).map((s, i) => ({ stageId: `${recipe.id}-b${i + 1}`, ...s })), options);
    let all;
    const sounds = options.sounds ?? options.soundCatalog;
    // Re-cued sounds keep the catalog's volume setting (options.soundVolume).
    // Variant-level ability profiles (D&D weapon uses) re-cue on the new stages.
    const variantProfile = options.variant?.soundNamespace === 'ability' ? options.variant.soundProfile : undefined;
    const profile = design.sound !== undefined ? design.sound : variantProfile;
    const namespace = design.sound !== undefined ? design.soundNamespace : 'ability';
    // Document-linked layers persist with the effect and carry no one-shot audio.
    if (base.lifecycle === 'document') all = stages;
    else if (profile !== undefined && sounds) {
      const item = { id: entry.id ?? recipe.id, slug: entry.slug ?? recipe.id, design: entry.design, soundProfile: profile };
      all = profile === null ? stages
        : namespace === 'ability' ? addAbilitySounds(item, stages, { sounds, soundVolume: options.soundVolume, mode: options.mode?.mode ?? options.mode, design: { profile } })
        : addSpellSounds(item, stages, { sounds, soundVolume: options.soundVolume, design: { profile } });
    } else all = [...stages, ...reanchorSounds(recipe.stages, stages)];
    result = validateRecipe({ ...base, bespoke: key, stages: all.slice(0, MAX_STAGES) });
    // Effects-only playback drops token motion but keeps every effect at its resolved time.
    // A motion-only design has nothing left, so the generated effects-only recipe plays.
    if (options.motion === false && result.stages.some(s => s.kind === 'motion')) {
      const effects = withoutCatalogMotion(result.stages);
      result = effects.length ? validateRecipe({ ...result, stages: effects }) : recipe;
    }
  }
  // Play-time element choice for entries whose native text offers one.
  const text = entry.plainDescription ?? entry.descriptionText ?? '';
  if (ELEMENT_CHOICE_SPELLS.has(entry.id) || ELEMENT_CHOICE_SPELLS.has(entry.documentId)) result = markElementChoice(result, 'choose a damage type');
  else if (text) result = markElementChoice(result, text);
  return result;
}
