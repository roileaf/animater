// Plays a finisher on the real token: travel lands on a square (motionOffset + hold), the
// document is moved there, then the ending runs. Foundry is reached only through `host`.
import { awayFrom } from "../motion/displacement.mjs";
import { cutPath, pathEnd, pathSquares, rotateBy, unrotateBy } from "../motion/keyframe-path.mjs";
import { finisherTravelPath } from "./finisher-model.mjs";
import { timedStages } from "../playback/composition.mjs";

const TRAVEL = new Set(["rush", "leap", "roll"]);
// A finisher moves only its targets: the mover's stages are the target-subject ones.
const mine = (s) => s.subject === "targets";

// `inPlace` is decided by playFinisher from the aimed end; `survives` strips in-place holds,
// which would otherwise leave a survivor shrunk or faded until the hold runs out.
// `slam` ({ keyframes, t, aim }) is a travel path cut at a wall: it plays the cut part at the same
// speed, the "wall*" stages play where it hits (they are dropped otherwise) and "landing" is dropped.
// `vanishing` ({ aim }) is a travel path that ends invisible: it is aimed and held, never moved.
// `at` is the mover's centre before it moves (canvas px): the crash and landing are offset from
// it, not from the token, which is somewhere else once its move is written.
export function composeFinisher(recipe, { offset = null, frame = null, inPlace, survives = false, slam = null, vanishing = null, at = null } = {}) {
  const travel = finisherTravelPath(recipe);
  let moves = false;
  const back = (s) => { const { motionEnd, motionOffset, motionFrame, ...rest } = s; return rest; };
  const pinned = (s) => (at ? { ...s, atPoint: { x: at.x, y: at.y } } : s);
  // Impacts play on the targets; anything else on its own subject.
  const onMover = (s) => s.kind === "impact" || mine(s);
  // The cut keyframes are already resampled from the eased motion: they play linear.
  const cut = slam && travel ? { ...travel, keyframes: slam.keyframes, pathEase: "linear", duration: Math.max(100, Math.round((travel.duration ?? 0) * slam.t)) } : null;
  // A held cut hits the wall as it ends; the bump (no landing) returns, reaching the wall at 85%.
  const early = cut && !offset ? Math.round(cut.duration * 0.15) : 0;
  // The crash sits 0.6 square past the landing (or the origin), on the wall side.
  const wall = { x: (offset?.x ?? 0) + (slam?.aim.x ?? 0) * 0.6, y: (offset?.y ?? 0) + (slam?.aim.y ?? 0) * 0.6 };
  // Linked to the travel's end, so the crash follows it wherever the travel itself is timed from.
  const atWall = (s) => {
    const { startMode, startRef, ...rest } = s, delay = Math.max(0, (cut.delay ?? 0) + cut.duration - early);
    return cut.stageId ? { ...rest, afterStage: cut.stageId, timingAnchor: "end", startOffset: -early, delay } : { ...rest, afterStage: "", delay };
  };
  // Knockback with no travel of its own (a slice, a cleave): a short held rush shoves the mover onto
  // the landing square first, and everything else plays after it, the mover's effects on that square.
  const shove = offset && !frame && !travel && !recipe.stages.some((s) => s.kind === "motion" && TRAVEL.has(s.motion) && s.motionEnd === "hold" && mine(s))
    ? shoveStage(recipe.stages, offset) : null;
  const stages = recipe.stages.flatMap((original) => {
    const s = cut && original === travel ? cut : original;
    if (String(s.stageId ?? "").startsWith("wall")) {
      if (!cut) return [];
      if (!onMover(s)) return s.kind === "motion" ? [] : atWall(s);
      return s.kind === "motion" ? atWall(s) : pinned({ ...atWall(s), offsetX: wall.x, offsetY: wall.y });
    }
    if (cut && s.stageId === "landing") return [];
    if (s.kind === "motion" && s.motion === "path" && s.motionEnd === "hold") {
      if (!mine(s)) return back(s);
      // In place (a spin, a shrink): it keeps its hold, nothing moves.
      const isTravel = original === travel;
      if (isTravel && vanishing && mine(s)) return { ...s, motionFrame: { cos: vanishing.aim.x, sin: vanishing.aim.y, k: 1 } };
      const still = isTravel ? (inPlace ?? pathSquares(s.keyframes) === 0) : pathSquares(s.keyframes) === 0;
      if (still) return survives ? back(s) : s;
      // Only the travel path lands: a second travelling copy would fly the token twice.
      if (!isTravel || !offset || !frame) return back(s);
      moves = true;
      // Shrink the whole path to the reachable square, then pin its end exactly on it so the
      // pose and the document agree to the pixel.
      const k = Math.min(1, Math.hypot(offset.x, offset.y) / frame.length);
      const last = unrotateBy({ x: offset.x / k, y: offset.y / k }, frame.aim);
      const keyframes = s.keyframes.map((kf, i, all) => (i === all.length - 1 ? { ...kf, x: last.x, y: last.y } : kf));
      return { ...s, keyframes, motionFrame: { cos: frame.aim.x, sin: frame.aim.y, k } };
    }
    // Fragments hold the real token hidden; a survivor must reappear once the pieces fade.
    if (survives && s.kind === "motion" && s.motion === "fragments" && s.motionEnd === "hold" && mine(s)) return back(s);
    if (s.kind === "motion" && TRAVEL.has(s.motion) && s.motionEnd === "hold") {
      // Only the mover's travel can land; anything else, or no landing square, comes back.
      if (!offset || frame || !mine(s)) return back(s);
      moves = true;
      return { ...s, motionOffset: offset };
    }
    if (offset && s.stageId === "landing" && onMover(s))
      return pinned({ ...s, offsetX: offset.x, offsetY: offset.y });
    if (shove && PINNABLE.has(s.kind) && onMover(s))
      return pinned({ ...s, offsetX: (Number(s.offsetX) || 0) + offset.x, offsetY: (Number(s.offsetY) || 0) + offset.y });
    // A vanishing path is drawn with +x away from the attacker: the mover's effects authored in
    // that frame (Sky launch's twinkle) turn with it, as the wall stages do.
    if (vanishing && s.kind !== "motion" && onMover(s) && (Number(s.offsetX) || Number(s.offsetY))) {
      const at = rotateBy({ x: Number(s.offsetX) || 0, y: Number(s.offsetY) || 0 }, vanishing.aim);
      return { ...s, offsetX: at.x, offsetY: at.y };
    }
    return s;
  });
  const unlinked = unlinkDropped(recipe.stages, stages);
  // The mover's impacts and auras that start once its travel has landed (blood linked to the travel's
  // end) play on the landing square, as "landing" does: a test play never writes the move, and a real
  // play writes it at travelEnd, racing them. Otherwise they burst where the token stood.
  const kept = offset && moves && !shove ? afterLanding(unlinked, (s) => PINNABLE.has(s.kind) && onMover(s) && !s.atPoint
    && s.stageId !== "landing" && !String(s.stageId ?? "").startsWith("wall"), (s) => pinned({ ...s, offsetX: (Number(s.offsetX) || 0) + offset.x, offsetY: (Number(s.offsetY) || 0) + offset.y })) : unlinked;
  if (!shove) return { recipe: { ...recipe, stages: kept }, moves };
  // Linked stages follow their reference; the rest start once the shove has landed.
  const after = kept.map((s) => (s.afterStage ? s : { ...s, delay: (Number(s.delay) || 0) + shove.duration }));
  return { recipe: { ...recipe, stages: [shove, ...after] }, moves: true };
}

// Effects that can be pinned to a point (model.mjs keeps atPoint on these only).
const PINNABLE = new Set(["impact", "aura"]);
// A quick held rush onto the landing square: about a quarter second, a little longer the farther it
// goes. It arrives at 70% and holds upright there until the document is written at its end.
function shoveStage(stages, offset) {
  const ids = new Set(stages.map((s) => s.stageId));
  let stageId = "shove";
  while (ids.has(stageId)) stageId += "-auto";
  const squares = Math.min(4, Math.hypot(offset.x, offset.y));
  return { stageId, label: "Knockback", kind: "motion", motion: "rush", subject: "targets", motionEnd: "hold", motionOffset: { x: offset.x, y: offset.y },
    motionArrival: 70, delay: 0, duration: Math.round(250 + 25 * squares), assets: [] };
}

// Moves the stages that `eligible` picks and that start at or after the mover's travel lands (its
// held, landing motion ends); timing is resolved as the runtime does. Unresolvable timing moves nothing.
function afterLanding(stages, eligible, move) {
  let timed;
  try { timed = timedStages({ stages }); } catch { return stages; }
  const travels = timed.filter((s) => s.kind === "motion" && mine(s) && s.motionEnd === "hold" && (s.motionFrame || s.motionOffset));
  if (!travels.length) return stages;
  const lands = Math.max(...travels.map((s) => s.delay + s.duration));
  return stages.map((s, i) => (eligible(s) && timed[i].delay >= lands ? move(s) : s));
}

// A stage linked to a dropped stage would stop the finisher ("linked stage was removed"): it keeps
// the time it had and loses the link, as deleting a stage in the studio does.
function unlinkDropped(before, after) {
  const kept = new Set(after.map((s) => s.stageId));
  const gone = new Set(before.map((s) => s.stageId).filter((id) => id && !kept.has(id)));
  if (!gone.size) return after;
  let resolved = [];
  try { resolved = timedStages({ stages: before }); } catch { /* keep the numeric delay */ }
  return after.map((s) => {
    if (!gone.has(s.afterStage) && !gone.has(s.startRef)) return s;
    const { startMode, startRef, timingAnchor, startOffset, ...rest } = s, was = resolved.find((r) => r.stageId === s.stageId)?.delay;
    return { ...rest, afterStage: "", delay: Number.isFinite(was) ? Math.round(was) : (s.delay ?? 0) };
  });
}

const ends = (stages) => Math.max(0, ...stages.map((s) => (s.delay ?? 0) + (s.duration ?? 0)));
export const travelEnd = (plan) => ends(plan.filter((s) => s.kind === "motion" && (s.motionOffset || s.motionFrame)));
export const planEnd = (plan) => ends(plan);
// A vanish fades when the mover's last motion ends: waiting for trailing effects would let
// a non-held motion (a sink) spring back to full opacity first.
export const motionEnd = (plan) => plan.some((s) => s.kind === "motion") ? ends(plan.filter((s) => s.kind === "motion")) : planEnd(plan);

// The target is flung away from the attacker; keyframed paths are drawn with +x that way.
export const finisherDirection = ({ mover, attacker }) => awayFrom(attacker?.center, mover?.center);
// With no attacker to aim from (a GM edits HP by hand), a finisher still lands and slams: it faces
// the mover's token rotation (degrees) when that is a finite non-zero number, else +x.
export function defaultAim(mover) {
  const r = Number(mover?.document?.rotation ?? mover?.rotation);
  if (!Number.isFinite(r) || r === 0) return { x: 1, y: 0 };
  const rad = (r * Math.PI) / 180;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}
// Wall slam's aim: `steps` directions evenly from -90° to +90° around `away` (0° among them), each
// probed for its first wall (`probe(direction)` → squares or null). The nearest wall within `reach`
// wins; on a tie, the direction closest to straight away. null when no wall is in reach.
export function seekWall(away, probe, { reach = Infinity, steps = 25 } = {}) {
  const n = Math.max(1, Math.round(steps)), base = Math.atan2(away.y, away.x);
  const angles = Array.from({ length: n }, (_, i) => (n === 1 ? 0 : -Math.PI / 2 + (Math.PI * i) / (n - 1)))
    .sort((a, b) => Math.abs(a) - Math.abs(b));
  let best = null;
  for (const angle of angles) {
    const aim = angle === 0 ? { x: away.x, y: away.y } : { x: Math.cos(base + angle), y: Math.sin(base + angle) };
    const distance = probe(aim);
    if (distance == null || !Number.isFinite(distance) || distance > reach + 1e-9) continue;
    if (!best || distance < best.distance - 1e-9) best = { aim, distance, angle };
  }
  return best;
}

// A path that moved the token lands upright and visible, so a vanish still fades it. A mover
// still held in place (shrunk, faded, turned) needs no separate fade: one would pop it back.
// Fragments hide the real token while the pieces fly, so they need no fade either.
export const fadedAtEnd = (recipe, moves) => recipe.stages.some((s) => s.kind === "motion" && ((!moves && s.motion === "path") || s.motion === "fragments")
  && s.motionEnd === "hold" && mine(s));

// Everything a finisher decides before it plays: where the mover lands (or hits a wall), and the
// recipe composed for that. Reads Foundry only through `host.gridSize`, `host.landing`, `host.wallHit` and
// `host.trace`; writes nothing.
export function planFinisher({ recipe, mover, attacker = null, dead = false }, host) {
  const f = recipe.finisher, grid = host.gridSize();
  const from = { x: mover.document.x, y: mover.document.y };
  const path = finisherTravelPath(recipe);
  let to = null, frame = null, inPlace, slam = null, vanishing = null;
  // A landing that cannot be worked out plays the finisher in place rather than not at all.
  try {
    if (path) {
      // In place or not is counted on the aimed end, the way the landing walks the grid.
      let aim = finisherDirection({ mover, attacker }) ?? defaultAim(mover);
      const aimed = (a) => {
        const end = rotateBy(pathEnd(path.keyframes), a);
        return { end, length: Math.hypot(end.x, end.y), squares: Math.round(Math.max(Math.abs(end.x), Math.abs(end.y))) };
      };
      let { end, length, squares } = aimed(aim);
      inPlace = squares === 0;
      // Whether a real wall stops it: the scene edge stops the landing too, but only a wall is
      // slammed into. A host that cannot tell (no wallHit) counts any blocked landing as a wall.
      let walled = typeof host.wallHit !== "function";
      // Gone in flight (ends invisible): aimed, held until hidden, never moved — moving an
      // invisible token would only show it again at the landing.
      // A survivor (not dead) never vanishes, nor does a non-vanish ending (it lands as before),
      // and an in-place path already stays put.
      const vanishes = dead && f.ending === "vanish" && !inPlace && path.keyframes.at(-1).alpha === 0;
      // Wall slam flies toward the nearest wall within reach, never back toward the attacker.
      if (!vanishes && !inPlace && f.wall === "slam" && typeof host.wallHit === "function") {
        const probe = (d) => { const a = aimed(d); return a.squares > 0 ? host.wallHit(mover, { x: a.end.x / a.length, y: a.end.y / a.length }, a.squares) : null; };
        const sought = seekWall(aim, probe, { reach: length });
        if (sought) ({ end, length, squares } = aimed(aim = sought.aim));
        walled = Boolean(sought);
      }
      if (vanishes) vanishing = { aim };
      else if (aim && !inPlace) {
        to = host.landing(mover, { x: end.x / length, y: end.y / length }, squares);
        frame = { aim, length };
        // Slam: a wall cuts the path where it hits, at full speed, instead of shrinking it to fit.
        const landed = to && Math.round(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / grid);
        if (to && f.wall === "slam" && walled && landed < squares) {
          // Rotation keeps lengths, so the world offset's length is the reach in the path's frame.
          const cut = cutPath(path.keyframes, landed > 0 ? Math.hypot(to.x - from.x, to.y - from.y) / grid : 0.3, path.pathEase ?? "linear");
          slam = { ...cut, aim };
          const cutEnd = pathEnd(cut.keyframes);
          if (landed > 0) frame = { aim, length: Math.hypot(cutEnd.x, cutEnd.y) };
        }
      }
    } else {
      const direction = f.knockback > 0 ? (finisherDirection({ mover, attacker }) ?? defaultAim(mover)) : null;
      to = direction ? host.landing(mover, direction, f.knockback) : null;
    }
  } catch (error) { host.trace("Blocked", `Finisher ${recipe.name} landing: ${error.message}`); }
  const offset = to && (to.x !== from.x || to.y !== from.y) ? { x: (to.x - from.x) / grid, y: (to.y - from.y) / grid } : null;
  // Where Sequencer centres an effect on the mover, taken before anything moves.
  const at = { x: from.x + (mover.w ?? (mover.document.width ?? 1) * grid) / 2, y: from.y + (mover.h ?? (mover.document.height ?? 1) * grid) / 2 };
  const { recipe: composed, moves } = composeFinisher(recipe, { offset, frame, inPlace, survives: !dead, slam, vanishing, at });
  return { composed, moves, to, from, context: finisherContext({ mover, attacker }) };
}

// The finisher plays from the attacker (or, with none, the mover itself) on the target it moves.
const finisherContext = ({ mover, attacker }) => ({ source: attacker ?? mover, targets: [mover] });

export async function playFinisher({ recipe, mover, attacker = null, dead = false }, host) {
  const f = recipe.finisher;
  const { composed, moves, to, from, context } = planFinisher({ recipe, mover, attacker, dead }, host);
  const commit = async (data) => host.commit(mover, { ...data, finisher: recipe.id });
  host.trace("Finisher", `${recipe.name}: ${mover.name ?? "token"}`);
  const plan = await host.play(composed, context);
  // null: nothing played and nothing was written, so the caller may play its own fallback.
  // false: it played but a write failed.
  if (!plan) return null;
  try {
    const landed = moves ? travelEnd(plan) : 0;
    if (moves) {
      await host.wait(landed);
      await commit({ x: to.x, y: to.y, fromX: from.x, fromY: from.y });
    }
    // A survivor (a use finisher's target) only ever stays.
    const ending = dead ? f.ending : "stay";
    if (ending === "stay") return true;
    await host.wait(Math.max(0, motionEnd(plan) - landed));
    if (ending === "vanish") { if (!fadedAtEnd(composed, moves)) await host.fade(mover); await commit({ hidden: true }); }
    else await commit({ defeated: true });
    return true;
  } catch (error) {
    host.trace("Blocked", `Finisher ${recipe.name}: ${error.message}`);
    return false;
  }
}

// A test play (studio Play at table, Local preview, api.play): the finisher plays composed, as a
// kill would, so the crash and landing show where the token hits and the travel stops at the wall.
// It writes nothing: no move, no hide, no defeat; held poses ease back on their own.
// The movers come from the play's own context; with none, the recipe plays as authored.
// `play(recipe, context, first)` plays one composed recipe; `first` is true for the first mover only.
export function previewFinisher(recipe, context, host, play) {
  const f = recipe.finisher, targets = (context.targets ?? []).filter(Boolean);
  const movers = !f ? [] : targets.map((mover) => ({ mover, attacker: context.source ?? null }));
  if (!movers.length) return null;
  const plays = movers.map((args, i) => {
    let planned;
    // Tested as the kill it stands for: the struck target is dead.
    try { planned = planFinisher({ recipe, ...args, dead: true }, host); }
    catch (error) { host.trace("Blocked", `Finisher ${recipe.name}: ${error.message}`); planned = { composed: recipe, context: finisherContext(args) }; }
    return play(planned.composed, { ...context, ...planned.context }, i === 0);
  });
  return Promise.all(plays).then((results) => results[0]);
}
