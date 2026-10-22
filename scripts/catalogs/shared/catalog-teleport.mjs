// Catalog teleports (Misty Step, Dimension Door, Translocate, Friendfetch…): their recipes carry an explicit
// Teleport stage, so the Studio timeline shows when the mover vanishes and lets it be dragged
// (engines/motion/teleport.mjs plays the jump from it).
// - A teleported target (Friendfetch) vanishes as the flight reaches it: linked to that flight's arrival.
// - A caster vanishes at the cast's key moment: its gesture's, else its own departure art's (a mist, a flash,
//   a portal), 45% in, linked to that stage.
// - It stays gone as long as its spell says (teleportGoneMs): a short blink, or a longer jump.
// - The departure and arrival effects take the spell's own colour (a purple Dimension Door mists purple).
// - Art on the mover that it would drag along: a departure aura becomes art left where it stood; an arrival
//   mist starts as it reappears, so it plays where it lands.
// - Only the cast teleports: a teleport spell's damage roll (Dimension Door's failed teleport) does not.
import { validateRecipe } from '../../core/model.mjs';
import { teleportPlan, teleportLink, teleportGoneMs } from '../../engines/motion/teleport.mjs';
import { timedStages } from '../../engines/playback/composition.mjs';

const TELEPORTING = new Set(['use', 'manual']);
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
// Where the mover vanishes: as the flight reaches a target, at the caster's gesture, else 45% into its own
// departure art.
function vanishLink(stages, who) {
  const link = teleportLink(stages, who);
  if (link.afterStage) return link;
  const art = stages.filter((s) => onMover(s, who) && !arrival(s) && s.assets?.length);
  const departure = art.find((s) => s.assets.some((a) => DEPARTURE_ART.test(a))) ?? art.find((s) => s.assets.some((a) => GATE_ART.test(a))) ?? art[0];
  return departure ? { afterStage: departure.stageId, timingAnchor: 'start', startOffset: Math.round(departure.duration * 0.45), delay: 0 } : link;
}

export function withCatalogTeleport(recipe) {
  const plan = teleportPlan(recipe);
  if (!plan || recipe.stages.some((s) => s.kind === 'teleport')) return recipe;
  if (!TELEPORTING.has(recipe.trigger) && recipe.teleport === undefined) return { ...recipe, teleport: 'none' };
  const who = plan.who;
  const stageId = recipe.stages.some((s) => s.stageId === 'teleport') ? `${recipe.id}-teleport` : 'teleport';
  const gone = teleportGoneMs(recipe);
  const teleport = { kind: 'teleport', stageId, label: 'Vanish and reappear', assets: [], duration: gone, ...vanishLink(recipe.stages, who) };
  const timed = timedStages({ stages: [...recipe.stages, teleport] }), at = new Map(timed.map((s) => [s.stageId, s.delay]));
  const start = at.get(stageId), moved = start + gone;
  // The stages the vanish is timed from stay as they are (no loop).
  const anchors = new Set();
  for (let id = teleport.afterStage; id && !anchors.has(id); id = recipe.stages.find((s) => s.stageId === id)?.afterStage) anchors.add(id);
  const stages = recipe.stages.map((s) => {
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
