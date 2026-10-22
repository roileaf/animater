// Push and Pull: timeline stages that really move their targets on the canvas, at the moment the stage starts.
// A target is pushed away from the one who acted (Repelling Blast, a shove) or pulled toward them (a grasping
// vine), a set number of squares: straight along the line between them, or to a square someone picks (the one
// who acted, or the target's side: the GM for a monster, the player for their character). The move plays through the finisher engine
// (finisher-play.mjs): a quick shove that stops at walls, written by the token's owner or the GM.
import { afterimagesChoice } from "../../core/stage-options.mjs";

export const MOVE_MOTIONS = new Set(["push", "pull"]);
export const MAX_MOVE = 10;
export const MOVE_ASK = { none: "Nobody: straight along the line", actor: "The one who acted", target: "The target's side (GM for monsters)" };
// How long a pick waits before the target stays put.
export const ASK_TIMEOUT = 60000;

export const isMoveStage = (s) => s?.kind === "motion" && MOVE_MOTIONS.has(s.motion);
// A Push or Pull stage's own settings.
export function moveOptions(s) {
  const squares = Math.round(Number(s?.squares));
  const cone = Math.round(Number(s?.moveCone));
  return { squares: squares >= 1 ? Math.min(MAX_MOVE, squares) : 2, moveAsk: Object.hasOwn(MOVE_ASK, s?.moveAsk) ? s.moveAsk : "none",
    // How wide a picked square may stray from straight away (a push) or straight toward (a pull), in degrees.
    moveCone: cone >= 10 ? Math.min(180, cone) : 90 };
}
// The wedge a picked square must sit in: its direction (radians) and half its width.
export function moveCone({ mover, source, pull, degrees = 90 }) {
  const dx = mover.center.x - source.center.x, dy = mover.center.y - source.center.y;
  const away = Math.atan2(dy, dx);
  return { angle: pull ? away + Math.PI : away, half: (Math.min(180, Math.max(10, degrees)) / 2) * (Math.PI / 180) };
}

// "Only on a hit" (the stage's requiresHit): each target by its own hit where the system gives one. A use with
// no roll (a save spell, a manual play) has no hit or miss of its own, so it moves.
const HIT = new Set(["success", "criticalSuccess"]);
export function hitsTarget(stage, context, mover) {
  if (!stage.requiresHit) return true;
  const outcome = context?.targetOutcomes?.[mover?.id ?? mover?.document?.id] ?? context?.outcome;
  return !outcome || HIT.has(outcome);
}

// How far a pull can go: it stops beside the puller, never on top of them (footprints in squares, a diagonal
// counted as one square, as the landing walk counts them).
export function pullReach(mover, puller, grid) {
  const a = footprint(mover, grid), b = footprint(puller, grid);
  if (!a || !b) return 0;
  const gapX = Math.max(0, Math.abs(a.cx - b.cx) - (a.w + b.w) / 2), gapY = Math.max(0, Math.abs(a.cy - b.cy) - (a.h + b.h) / 2);
  return Math.max(0, Math.round(Math.max(gapX, gapY) / grid));
}
function footprint(token, grid) {
  const c = token?.center;
  if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
  return { cx: c.x, cy: c.y, w: token.w ?? (token.document?.width ?? 1) * grid, h: token.h ?? (token.document?.height ?? 1) * grid };
}

// The finisher that shoves one target: no stages of its own (the engine adds the shove), and it stays standing.
export function shoveRecipe(stage, squares) {
  const pull = stage.motion === "pull";
  return { id: `animater-${pull ? "pull" : "push"}-${stage.stageId ?? "stage"}`, name: stage.label || (pull ? "Pull" : "Push"), trigger: "manual",
    finisher: { knockback: squares, ending: "stay", ...(pull ? { pull: true } : {}), ...afterimagesChoice(stage) }, stages: [] };
}

// What the one picking is told.
export function movePrompt(pull, mover, source, squares) {
  return `${pull ? "Pull" : "Push"} ${mover?.name ?? "the target"}: click a square up to ${squares} square${squares === 1 ? "" : "s"} away, ${pull ? "toward" : "away from"} ${source?.name ?? "the attacker"} (Esc: it stays put).`;
}
// A square someone may pick (its centre): a push ends no closer to the one who acted, a pull no farther and not on
// top of them. (The ring limits how far; the host adds walls.)
export function allowedSpot({ mover, source, center, pull, grid, degrees = 90 }) {
  const from = mover?.center, at = source?.center;
  if (!from || !at || !center) return false;
  // Inside the wedge: straight away for a push, straight toward for a pull, give or take half the cone.
  if (Math.hypot(center.x - from.x, center.y - from.y) > grid * 0.01) {
    const { angle, half } = moveCone({ mover, source, pull, degrees });
    const off = Math.abs(Math.atan2(Math.sin(Math.atan2(center.y - from.y, center.x - from.x) - angle), Math.cos(Math.atan2(center.y - from.y, center.x - from.x) - angle)));
    if (off > half + 1e-6) return false;
  }
  const before = Math.hypot(from.x - at.x, from.y - at.y), after = Math.hypot(center.x - at.x, center.y - at.y), slack = grid * 0.01;
  if (!pull) return after >= before - slack;
  if (after > before + slack) return false;
  // Their footprints may touch but not overlap.
  return Math.max(Math.abs(center.x - at.x) - ((mover.w ?? grid) + (source.w ?? grid)) / 2, Math.abs(center.y - at.y) - ((mover.h ?? grid) + (source.h ?? grid)) / 2) > -slack;
}

// One target's move. host: { gridSize(), pick(who, { mover, source, squares, pull }) → Promise<{ x, y } | null> (the
// square's top-left), playFinisher(recipe, mover, source, spot) }
export async function playMoveStage(stage, context, host) {
  const mover = stage.destination, source = context?.source;
  if (!isMoveStage(stage) || !mover || !source || mover === source || (mover.id && mover.id === source.id)) return null;
  if (!hitsTarget(stage, context, mover)) return null;
  const { squares: wanted, moveAsk } = moveOptions(stage);
  const squares = stage.motion === "pull" ? Math.min(wanted, pullReach(mover, source, host.gridSize())) : wanted;
  if (squares <= 0) return null;
  let spot = null;
  if (moveAsk !== "none") {
    // Picked: up to the stage's squares (a pull's whole reach is fine to choose from; the rule keeps it beside them).
    spot = await host.pick(moveAsk, { mover, source, squares: wanted, pull: stage.motion === "pull", degrees: moveOptions(stage).moveCone });
    if (!spot) return false;
  }
  return host.playFinisher(shoveRecipe(stage, squares), mover, source, spot);
}

// A local preview moves nothing: a push recoils from the attacker, a pull lunges toward them.
export const previewMotion = (stage) => ({ ...stage, motion: stage.motion === "pull" ? "lunge" : "recoil" });
