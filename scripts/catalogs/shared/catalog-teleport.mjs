// Catalog teleports (Misty Step, Dimension Door, Translocate, Friendfetch…): their recipes carry an explicit
// Teleport stage, so the Studio timeline shows when the mover vanishes and lets it be dragged
// (engines/motion/teleport.mjs plays the jump from it).
// - A teleported target (Friendfetch) vanishes as the hit on it lands (the tether connecting), else as the
//   flight reaches it. A move the animation only acted out for it (the pull toward the caster) gives way.
// - A caster vanishes at the cast's key moment: its gesture's, else its own departure art's (a mist, a flash,
//   a portal), 45% in, linked to that stage.
// - It stays gone as long as its spell says (teleportGoneMs, or the entry's own below): a short blink, or a
//   longer jump.
// - The departure and arrival effects take the spell's own colour (a purple Dimension Door mists purple).
// - Art on the mover that it would drag along: a departure aura becomes art left where it stood; an arrival
//   mist starts as it reappears, so it plays where it lands.
// - Only the cast teleports: a teleport spell's damage roll (Dimension Door's failed teleport) does not.
import { validateRecipe } from '../../core/model.mjs';
import { teleportPlan, teleportLink, teleportGoneMs } from '../../engines/motion/teleport.mjs';
import { timedStages } from '../../engines/playback/composition.mjs';
import { isPathMotion } from '../../engines/motion/motion-path.mjs';

// Catalog entries that teleport the one who acts, beyond the known spells (teleport.mjs TELEPORT_DEFAULTS), by
// `<system>:<slug>`, from each one's rules text. range: feet for the spot picker (none: the item's own range);
// gone: ms; when: which of its recipes teleport; look: its own departure/arrival effects; self: its art was
// drawn on a target, but the one who acts is the one who moves; land: stages that happen where it arrives.
// One token moves: companions brought along (Warp Step, Blink Out) stay put.
const SELF_TELEPORTS = {
  // You teleport up to 20 feet (more when heightened: the spell's own range).
  'pf2e:dimensional-steps': { gone: 400 },
  // You teleport within 30 feet; your echo explodes where you were (the area, placed first).
  'pf2e:echo-jump': { gone: 400 },
  // At the end of your turns (or Sustained) you teleport 10 feet in a random direction the GM picks: here, on the
  // cast, to a spot picked within 10 feet.
  'pf2e:flicker': { range: 10, gone: 400 },
  // On a Blink roll you vanish to the Ethereal Plane and later return within 10 feet of where you left: the roll
  // (2014's Blink Check) jumps to a spot within 10 feet; its plain cast does not. 2024's roll has no activity of
  // its own, so its cast does.
  'dnd5e:blink': { range: 10, gone: 700, when: (r) => !/^cast$/i.test(r.activityName ?? '') },
  // Invisible, and teleports up to 30 feet.
  'dnd5e:shadowy-teleport': { range: 30, gone: 500 },
  // Teleports up to 30 feet, with one willing creature within 5 feet (not moved here).
  'dnd5e:warp-step': { range: 30, gone: 400, self: true },
  // Teleports up to 60 feet; the space it left (the area, placed first) takes necrotic damage.
  'dnd5e:deathly-teleport': { range: 60, gone: 500 },
  // Teleports up to 60 feet in a flash of light; the burst is around its destination.
  'dnd5e:radiant-teleport': { range: 60, gone: 500, look: { teleportOut: 'jb2a.teleport.01.yellow', teleportIn: 'jb2a.teleport.01.yellow' }, land: (s) => s.kind === 'template' },
  // You swap places with your illusion (up to 120 feet away): you teleport to the spot; the illusion stays.
  'dnd5e:tricksters-transposition': { range: 120, gone: 400 },
  // Teleport to a point within Far range (60 feet by default), willing creatures brought along (not moved here).
  'daggerheart:blink-out': { range: 60, gone: 500 },
};
const slugOf = (v) => String(v ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const systemOf = (recipe, entry) => recipe.systemId ?? entry.systemId ?? (/^(?:animater-)?dnd5e-/.test(recipe.id) ? 'dnd5e' : 'pf2e');
export const catalogSelfTeleport = (recipe, entry = {}) => SELF_TELEPORTS[`${systemOf(recipe, entry)}:${entry.slug ?? slugOf(entry.name ?? recipe.name)}`] ?? null;

const TELEPORTING = new Set(['use', 'manual']);
const FLIGHT = new Set(['travel', 'projectile']);
const DEPARTURE_ART = /jb2a\.(?:misty_step\.01|teleport)\b/, GATE_ART = /jb2a\.portals\b/, ARRIVAL_ART = /jb2a\.misty_step\.02\b/;
// Arrival art: named so, else (unnamed either way) its first clip is an arrival mist.
const arrival = (s) => /\barriv|reappear/i.test(s.label ?? '') || (!/\bdepart|vanish|leav/i.test(s.label ?? '') && ARRIVAL_ART.test(s.assets?.[0] ?? ''));
// Art the mover itself carries: the caster's (cast, its own aura or copy), else the target's.
const onMover = (s, who) => who === 'target'
  ? s.kind === 'impact' || (['aura', 'sprite'].includes(s.kind) && s.subject === 'targets')
  : s.kind === 'cast' || (['aura', 'sprite'].includes(s.kind) && (s.subject ?? 'source') === 'source');
// Mist colours both JB2A libraries ship as a departure and arrival pair; anything else keeps the blue default.
const MIST = { purple: 'purple', dark_purple: 'purple', pink: 'purple', violet: 'purple', yellow: 'yellow', orange: 'yellow', gold: 'yellow' };
function mistColour(stages) {
  const assets = stages.flatMap((s) => s.assets ?? []);
  const mist = assets.map((a) => /misty_step\.0[12]\.([a-z_]+)/.exec(a)?.[1]).find(Boolean);
  const word = mist ?? assets.map((a) => a.split('.').slice(1).find((part) => MIST[part])).find(Boolean);
  return MIST[word] ?? null;
}
// Where the mover vanishes: as the hit on a target lands (else its flight arrives), at the caster's gesture,
// else 45% into its own departure art.
function vanishLink(stages, who) {
  const link = teleportLink(stages, who);
  if (who === 'target' && link.timingAnchor === 'arrival') {
    const hit = stages.find((s) => s.kind === 'impact' && s.afterStage === link.afterStage);
    return hit ? { afterStage: hit.stageId, timingAnchor: 'start', startOffset: 0, delay: 0 } : link;
  }
  if (link.afterStage) return link;
  const art = stages.filter((s) => onMover(s, who) && !arrival(s) && s.assets?.length);
  const departure = art.find((s) => s.assets.some((a) => DEPARTURE_ART.test(a))) ?? art.find((s) => s.assets.some((a) => GATE_ART.test(a))) ?? art[0];
  return departure ? { afterStage: departure.stageId, timingAnchor: 'start', startOffset: Math.round(departure.duration * 0.45), delay: 0 } : link;
}

// `entry`: the catalog entry the recipe was built from (its system and slug pick SELF_TELEPORTS).
export function withCatalogTeleport(recipe, entry = {}) {
  if (recipe.stages.some((s) => s.kind === 'teleport')) return recipe;
  const listed = recipe.teleport === undefined && recipe.trigger !== 'damage' ? catalogSelfTeleport(recipe, entry) : null;
  const own = listed && (listed.when?.(recipe) ?? true) ? listed : null;
  if (own) {
    recipe = { ...recipe, teleport: 'source', teleportRange: own.range, ...own.look,
      stages: own.self ? recipe.stages.map((s) => s.subject === 'targets' && ['aura', 'motion', 'sprite'].includes(s.kind) ? { ...s, subject: 'source' } : s) : recipe.stages };
  }
  const plan = teleportPlan(recipe);
  if (!plan) return recipe;
  if (!own && !TELEPORTING.has(recipe.trigger) && recipe.teleport === undefined) return { ...recipe, teleport: 'none' };
  const who = plan.who;
  const stageId = recipe.stages.some((s) => s.stageId === 'teleport') ? `${recipe.id}-teleport` : 'teleport';
  const gone = own?.gone ?? teleportGoneMs(recipe);
  const teleport = { kind: 'teleport', stageId, label: 'Vanish and reappear', assets: [], duration: gone, ...vanishLink(recipe.stages, who) };
  const timed = timedStages({ stages: [...recipe.stages, teleport] }), at = new Map(timed.map((s) => [s.stageId, s.delay]));
  const start = at.get(stageId), moved = start + gone;
  // The stages the vanish is timed from stay as they are (no loop).
  const anchors = new Set();
  for (let id = teleport.afterStage; id && !anchors.has(id); id = recipe.stages.find((s) => s.stageId === id)?.afterStage) anchors.add(id);
  const stages = recipe.stages.map((s) => {
    // A teleported target's acted-out move (Friendfetch's pull) after it vanishes: only when nobody teleports.
    if (who === 'target' && isPathMotion(s) && s.subject === 'targets' && at.get(s.stageId) >= start) return { ...s, skipOnTeleport: true };
    // What happens where it arrives starts as it reappears.
    if (own?.land?.(s) && !anchors.has(s.stageId)) return { ...s, afterStage: stageId, timingAnchor: 'end', startOffset: 100, delay: 0 };
    if (!onMover(s, who) || s.persist) return s;
    // Arrival art starting once it is gone plays as it reappears, where it lands.
    if (arrival(s) && at.get(s.stageId) > start && !anchors.has(s.stageId)) return { ...s, afterStage: stageId, timingAnchor: 'end', startOffset: 100, delay: 0 };
    // An aura rides on its token: one still showing when the caster jumps would follow it there. Played as
    // art where it stood, it stays behind.
    if (who === 'source' && s.kind === 'aura' && at.get(s.stageId) < moved && at.get(s.stageId) + s.duration > start)
      return { ...s, kind: 'cast' };
    return s;
  });
  const colour = mistColour(recipe.stages);
  const look = colour && !recipe.teleportOut && !recipe.teleportIn ? { teleportOut: `jb2a.misty_step.01.${colour}`, teleportIn: `jb2a.misty_step.02.${colour}` } : {};
  return validateRecipe({ ...recipe, ...look, stages: [...stages, teleport] });
}
