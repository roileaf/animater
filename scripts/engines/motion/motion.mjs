import { samplePath, stretchScale, DEFAULT_KEYFRAMES } from "./keyframe-path.mjs";
import { MOTIONS } from "../../core/model.mjs";
import { shakeCycles, settledProgress } from "./motion-pacing.mjs";
import { PATH_MOTIONS, HOLDING_MOTIONS, motionPhases, pathDistance } from "./motion-path.mjs";
import { easeValue } from "../../core/stage-options.mjs";
import { nextFrame, cancelFrame } from "./canvas-frame.mjs";
import { trails, createTrailGate } from "./afterimages.mjs";
// A keyframed path fills the whole motion when it holds; otherwise its last 15% eases back to
// rest like every other gesture. A finisher's frame aims and shrinks it on every client alike.
export const PATH_RETURN = 0.15;
// The share of a path stage's duration spent on the keyframes (the rest is the return to rest).
export const pathSpan = (stage) => (stage?.motionEnd === "hold" ? 1 : 1 - PATH_RETURN);
function pathPose(stage, p, direction, grid, holds) {
  const keyframes = stage.keyframes ?? DEFAULT_KEYFRAMES;
  const settle = holds || p <= 1 - PATH_RETURN ? 1 : 1 - settledProgress((p - (1 - PATH_RETURN)) / PATH_RETURN);
  // One ease over the whole path (keyframes are usually linear), so it never stops at a keyframe.
  // An overshooting ease may carry it past either end: clamp to the path.
  const q = easeValue(holds ? p : Math.min(1, p / (1 - PATH_RETURN)), stage.pathEase ?? "linear");
  const local = samplePath(keyframes, Math.min(1, Math.max(0, q)));
  const frame = stage.motionFrame, cos = frame ? frame.cos : direction.x, sin = frame ? frame.sin : direction.y, k = frame ? frame.k : 1;
  const pose = {
    x: (local.x * cos - local.y * sin) * k * grid * settle,
    y: (local.x * sin + local.y * cos) * k * grid * settle,
    rotation: ((local.rotation * Math.PI) / 180) * settle,
    // An overshooting ease may carry size below zero or opacity outside 0..1: clamp both.
    scale: Math.max(0.01, 1 + (local.scale - 1) * settle),
  };
  if (keyframes.some((kf) => kf.alpha < 1)) pose.alpha = Math.min(1, Math.max(0, 1 - (1 - local.alpha) * settle));
  // Squash & stretch along the travel direction (the frame's +x), measured in the mesh's own frame.
  // The token document's own rotation is not known here: it is assumed 0.
  if (local.stretch || keyframes.some((kf) => kf.stretch)) Object.assign(pose, stretchScale((local.stretch ?? 0) * settle, Math.atan2(sin, cos) - pose.rotation));
  return pose;
}
// Electrocute's convulsions ([start, end, strength] as shares of the stage) and where the slump begins.
const ELECTROCUTE_BURSTS = [[0.03, 0.36, 1], [0.42, 0.63, 0.7], [0.69, 0.84, 0.4]], ELECTROCUTE_SLUMP = 0.84;
// A fixed pseudo-random twitch in -1..1 for a frame step.
const twitch = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
// Pure pose function shared by canvas playback and the editor's motion preview.
export function motionPose(
  stage,
  progress,
  direction = { x: 1, y: 0 },
  grid = 100,
) {
  const p = Math.min(1, Math.max(0, progress));
  const envelope = Math.sin(Math.PI * p) ** 2;
  const amount = stage.intensity ?? 1;
  const distance = (stage.distance ?? 0.35) * grid * amount;
  const pose = { x: 0, y: 0, rotation: 0, scale: 1 };
  const holds = stage.motionEnd === "hold" && HOLDING_MOTIONS.has(stage.motion);
  if (p === 0 || (p === 1 && !holds)) return pose;
  if (stage.motion === "path") return pathPose(stage, p, direction, grid, holds);
  if (PATH_MOTIONS.has(stage.motion)) {
    const heading = stage.motionHeading, offset = stage.motionOffset;
    const offsetLength = offset ? Math.hypot(offset.x, offset.y) : 0;
    // An exact landing square overrides heading and range.
    direction = offsetLength ? { ...direction, x: offset.x / offsetLength, y: offset.y / offsetLength }
      : heading === "away" ? { ...direction, x: -direction.x, y: -direction.y }
      : heading === "up" ? { ...direction, x: 0, y: -1 }
      : heading === "down" ? { ...direction, x: 0, y: 1 }
      : heading === "left" ? { ...direction, x: -1, y: 0 }
      : heading === "right" ? { ...direction, x: 1, y: 0 }
      : direction;
    const { arrival, release } = motionPhases(stage);
    const out = settledProgress(Math.min(1, p / arrival));
    const back = holds ? 0 : settledProgress(Math.max(0, (p - release) / (1 - release)));
    const travel = (offsetLength ? offsetLength * grid : pathDistance(stage, direction, grid)) * out * (1 - back);
    const side = stage.motionSide ?? 1;
    if (stage.motion === "dodge") {
      pose.x = -direction.y * travel * side;
      pose.y = direction.x * travel * side;
      pose.rotation = side * 0.18 * amount * Math.sin(Math.PI * p);
      pose.scale = 1 - 0.08 * amount * envelope;
    } else {
      pose.x = direction.x * travel;
      pose.y = direction.y * travel;
      if (stage.motion === "rush") {
        pose.rotation =
          direction.x *
          0.15 *
          amount *
          Math.sin(Math.PI * Math.min(1, p / arrival));
      } else if (stage.motion === "leap") {
        const height = (stage.jumpHeight ?? 0.8) * grid;
        const lift = (stage.arrivalLift ?? 0) * grid;
        const landing =
          p <= arrival
            ? 1
            : 1 -
              settledProgress(
                Math.min(1, (p - arrival) / ((release - arrival) * 0.65)),
              );
        pose.y -=
          (4 * out * (1 - out) * height + out * lift * landing) * (1 - back);
      } else if (stage.motion === "roll") {
        pose.rotation = Math.PI * 2 * out * side;
        pose.scale = 1 - 0.12 * amount * Math.sin(Math.PI * out);
      }
    }
    return pose;
  }
  switch (stage.motion) {
    case "lunge":
    case "recoil":
      pose.x = direction.x * distance * envelope;
      pose.y = direction.y * distance * envelope;
      break;
    case "shake":
      pose.x =
        Math.sin(p * Math.PI * 2 * shakeCycles(stage)) *
        distance *
        0.3 *
        envelope;
      pose.rotation =
        Math.sin(p * Math.PI * 2 * Math.min(4, shakeCycles(stage))) *
        0.06 *
        amount *
        envelope;
      break;
    case "spin":
      // Only complete turns can settle back to the original visual angle.
      // Fractional intensity previously snapped to baseline on the last frame.
      pose.rotation =
        Math.PI * 2 * settledProgress(p) * Math.max(1, Math.round(amount));
      break;
    case "levitate":
      pose.y = -distance * envelope;
      break;
    case "pulse":
      pose.scale = 1 + 0.18 * amount * envelope;
      break;
    // Squash/stretch and opacity channels (scaleX/scaleY/alpha) are only set
    // by these gestures, so older poses keep their original shape.
    case "press":
      pose.y = distance * 0.25 * envelope;
      pose.scaleX = 1 + 0.12 * amount * envelope;
      pose.scaleY = 1 - 0.2 * amount * envelope;
      break;
    case "sink":
      pose.y = distance * envelope;
      pose.scaleY = 1 - 0.15 * amount * envelope;
      pose.alpha = 1 - 0.65 * envelope;
      break;
    case "flicker": {
      const cycles = Math.max(2, Math.round(3 * amount));
      pose.alpha = 1 - 0.75 * envelope * (0.5 - 0.5 * Math.cos(p * Math.PI * 2 * cycles));
      break;
    }
    case "fragments":
      // The pieces take the token's place; the real token stays out of sight.
      pose.alpha = 0;
      break;
    case "fade":
      pose.alpha = 1 - settledProgress(p);
      break;
    case "throw": {
      // Draw back for the first third, then snap forward past the start.
      const reach = p < 0.35 ? -0.45 * Math.sin((Math.PI * p) / 0.35) : Math.sin((Math.PI * (p - 0.35)) / 0.65);
      pose.x = direction.x * distance * reach;
      pose.y = direction.y * distance * reach;
      pose.rotation = 0.12 * amount * reach * Math.sign(direction.x || 1);
      break;
    }
    case "brace":
      pose.x = -direction.x * distance * 0.4 * envelope;
      pose.y = -direction.y * distance * 0.4 * envelope;
      pose.scaleX = 1 + 0.05 * amount * envelope;
      pose.scaleY = 1 - 0.08 * amount * envelope;
      break;
    case "stagger": {
      const side = stage.motionSide ?? 1;
      pose.x = -direction.x * distance * 0.6 * envelope;
      pose.y = -direction.y * distance * 0.6 * envelope + distance * 0.15 * envelope;
      pose.rotation = side * 0.28 * amount * Math.sin(Math.PI * p) * (1 - p);
      break;
    }
    case "cower":
      pose.scale = 1 - 0.12 * amount * envelope;
      pose.x = Math.sin(p * Math.PI * 2 * 6) * distance * 0.08 * envelope;
      pose.y = distance * 0.1 * envelope;
      break;
    case "slam": {
      // Rise for 60%, then a fast fall and a brief squash on landing.
      const rise = p < 0.6 ? Math.sin((Math.PI / 2) * (p / 0.6)) : Math.max(0, 1 - (p - 0.6) / 0.12);
      pose.y = -distance * 1.2 * rise;
      const impact = p >= 0.72 ? Math.sin((Math.PI * (p - 0.72)) / 0.28) : 0;
      pose.scaleX = 1 + 0.12 * amount * impact;
      pose.scaleY = 1 - 0.15 * amount * impact;
      break;
    }
    case "collapse": {
      // Knocked down: tip to one side and sag, held, then ease back up (a lasting
      // Unconscious or Dying body treatment takes over from there).
      const side = stage.motionSide ?? 1;
      pose.rotation = side * 0.45 * amount * envelope;
      pose.y = distance * 0.35 * envelope;
      pose.scaleY = 1 - 0.12 * amount * envelope;
      break;
    }
    case "squash": {
      // Flattened against what it hit for the first 45%, then a small springing stretch.
      const stretch = p <= 0.45 ? -0.35 * amount * Math.sin(Math.PI * Math.min(1, p / 0.45))
        : 0.12 * amount * Math.sin((Math.PI * (p - 0.45)) / 0.55) * (1 - p);
      Object.assign(pose, stretchScale(stretch, Math.atan2(direction.y, direction.x)));
      break;
    }
    case "drift":
      pose.y = distance * 0.35 * envelope;
      pose.x = Math.sin(p * Math.PI * 3) * distance * 0.25 * envelope;
      pose.rotation = Math.sin(p * Math.PI * 3) * 0.08 * amount * envelope;
      break;
    case "electrocute": {
      // Seized by a current: the body locks stiff and convulses in three bursts, each weaker, then slumps as it
      // lets go. The twitches jump every 30 ms, not a smooth sway, and land alike on every client (no Math.random).
      const seize = ELECTROCUTE_BURSTS.reduce((most, [from, to, strength]) => p < from || p >= to ? most
        : Math.max(most, strength * Math.min(1, (p - from) / 0.03, (to - p) / 0.03)), 0);
      const tick = Math.floor((p * (Number(stage.duration) || 1300)) / 30);
      pose.x = twitch(tick) * distance * 0.14 * seize;
      pose.y = twitch(tick + 71) * distance * 0.14 * seize;
      pose.rotation = twitch(tick + 137) * 0.08 * amount * seize;
      pose.scaleX = 1 + 0.03 * amount * seize;
      pose.scaleY = 1 + 0.06 * amount * seize;
      if (p > ELECTROCUTE_SLUMP) {
        const slump = Math.sin((Math.PI * (p - ELECTROCUTE_SLUMP)) / (1 - ELECTROCUTE_SLUMP));
        pose.y += distance * 0.1 * slump;
        pose.scaleY -= 0.05 * amount * slump;
      }
      break;
    }
  }
  return pose;
}

// A held motion keeps its end pose until the token's document moves there; if that never
// happens (no GM to write it), it eases back to rest instead of freezing.
export const HOLD_LIMIT_MS = 3000, HOLD_RELEASE_MS = 400;
// A motion that hides the token (fragments, a full fade) keeps its art at this alpha, not 0.
// It draws nothing (under half of one 8-bit step), but modules that hide every Sequencer
// effect at a token whose art reads as hidden (alpha 0, e.g. PF2e Visioner) would otherwise
// cut the recipe's own impacts and filters on that token the moment the pieces fly.
export const HIDDEN_ALPHA = 1 / 1024;
export const meshAlpha = (original, poseAlpha) => Math.max(HIDDEN_ALPHA, original * poseAlpha);
// A fragments stage carries one seed so every client cuts the same pieces.
export const withFragmentSeed = (stage, rand = Math.random) =>
  stage?.kind === "motion" && stage.motion === "fragments" && !Number.isInteger(stage.seed) ? { ...stage, seed: Math.floor(rand() * 2147483647) } : stage;
// The sender's cut angle travels with the seed, so a client that sees the tokens elsewhere
// still cuts along the same swing.
export const withFragmentCut = (stage, direction) =>
  stage?.kind === "motion" && stage.motion === "fragments" && !Number.isFinite(stage.cutAngle) && Number.isFinite(direction?.x) && Number.isFinite(direction?.y)
    ? { ...stage, cutAngle: Math.atan2(direction.y, direction.x) } : stage;
// Absorbed pieces fly to the attacker: the sender's other token's centre less this token's, in
// squares on screen. Sent with the cut so every client agrees; nothing is sent without an attacker.
export function withFragmentTowards(stage, token, source, target, grid = 100) {
  if (stage?.kind !== "motion" || stage.motion !== "fragments" || (Number.isFinite(stage.towards?.x) && Number.isFinite(stage.towards?.y))) return stage;
  const other = token === source || (token?.id && token.id === source?.id) ? target : source;
  const a = token?.center, b = other?.center;
  if (!a || !b || other === token || !(grid > 0)) return stage;
  const x = (b.x - a.x) / grid, y = (b.y - a.y) / grid;
  return Number.isFinite(x) && Number.isFinite(y) ? { ...stage, towards: { x, y } } : stage;
}
export function heldPose(stage, heldMs, direction, grid = 100) {
  if (stage.motionEnd !== "hold" || !HOLDING_MOTIONS.has(stage.motion) || heldMs >= HOLD_LIMIT_MS + HOLD_RELEASE_MS) return null;
  const end = motionPose(stage, 1, direction, grid);
  const k = heldMs <= HOLD_LIMIT_MS ? 1 : 1 - settledProgress((heldMs - HOLD_LIMIT_MS) / HOLD_RELEASE_MS);
  return { ...end, x: end.x * k, y: end.y * k, rotation: end.rotation * k, scale: 1 + (end.scale - 1) * k, ...(end.alpha !== undefined ? { alpha: 1 - (1 - end.alpha) * k } : {}),
    ...(end.scaleX !== undefined ? { scaleX: 1 + (end.scaleX - 1) * k, scaleY: 1 + ((end.scaleY ?? 1) - 1) * k } : {}) };
}
export function motionDirection(token, source, target, motion, grid = 100) {
  const other =
    token === source || (token?.id && token.id === source?.id)
      ? target
      : source;
  const away = ["recoil", "path", "squash", "fragments"].includes(motion);
  const a = away ? other?.center : token?.center;
  const b = away ? token?.center : other?.center;
  // Away from nobody: a fixed +x, not a vector from the map origin that changes with position.
  if (away && (!a || !b)) return { x: 1, y: 0 };
  const x = (b?.x ?? 1) - (a?.x ?? 0),
    y = (b?.y ?? 0) - (a?.y ?? 0);
  const length = Math.hypot(x, y);
  const vector =
    length && (!PATH_MOTIONS.has(motion) || (a && b))
      ? { x: x / length, y: y / length }
      : { x: 1, y: 0 };
  if (!PATH_MOTIONS.has(motion)) return vector;
  // Intersect the combined footprints, including unequal rectangular tokens.
  const width =
    ((token?.w ?? (token?.document?.width ?? 1) * grid) +
      (other?.w ?? (other?.document?.width ?? 1) * grid)) /
    2;
  const height =
    ((token?.h ?? (token?.document?.height ?? 1) * grid) +
      (other?.h ?? (other?.document?.height ?? 1) * grid)) /
    2;
  const clearance = Math.min(
    Math.abs(vector.x) > 0.001 ? width / Math.abs(vector.x) : Infinity,
    Math.abs(vector.y) > 0.001 ? height / Math.abs(vector.y) : Infinity,
  );
  return {
    ...vector,
    length: other?.center && token?.center ? length : 0,
    clearance,
  };
}

const fragmentCut = ({ stage, direction }) => (Number.isFinite(stage.cutAngle) ? stage.cutAngle
  : stage.cut === "fixed" ? (stage.angle * Math.PI) / 180 : Math.atan2(direction.y, direction.x));
// Independently authored gestures can overlap: a wind-up may continue while a
// lunge starts. Compose their local deltas against one unanimated baseline.
export function combineMotionPoses(poses) {
  const combined = poses.reduce((pose, next) => ({
    x: pose.x + next.x,
    y: pose.y + next.y,
    rotation: pose.rotation + next.rotation,
    scale: pose.scale * next.scale,
  }), { x: 0, y: 0, rotation: 0, scale: 1 });
  // Optional channels appear only when a gesture uses them.
  for (const key of ["scaleX", "scaleY", "alpha"])
    if (poses.some(p => p[key] !== undefined)) combined[key] = poses.reduce((v, p) => v * (p[key] ?? 1), 1);
  return combined;
}
// CSS transform for editor/preview tokens, including squash and stretch.
export const poseTransform = pose =>
  `translate(${pose.x}px,${pose.y}px) rotate(${pose.rotation}rad) scale(${pose.scaleX === undefined && pose.scaleY === undefined ? pose.scale : `${pose.scale * (pose.scaleX ?? 1)},${pose.scale * (pose.scaleY ?? 1)}`})`;

const tokenGeometry = token => ({
  width: token.document?.width,
  height: token.document?.height,
  sx: token.document?.texture?.scaleX,
  sy: token.document?.texture?.scaleY,
  src: token.document?.texture?.src,
});
const geometryChanged = (token, initial) =>
  Object.entries(initial).some(([key, value]) => tokenGeometry(token)[key] !== value);
// Animate the existing rendered token mesh. Never write TokenDocument fields.
// Every client runs this renderer locally; previews bypass the module socket.
export class TokenMotionPlayer {
  constructor({
    frame = null,
    cancel = cancelFrame,
    now = () => performance.now(),
    grid = () => 100,
    fragments = null,
    afterimages = null,
    beforeStart = () => {},
  } = {}) {
    // Steps take the clock when they run: a ticker pass hands its listeners a delta, not a time.
    this.frame = frame ?? ((callback) => nextFrame(() => callback(this.now())));
    this.cancel = cancel;
    this.now = now;
    this.grid = grid;
    this.fragments = fragments;
    this.afterimages = afterimages;
    this.beforeStart = beforeStart;
    this.active = new Map();
  }
  play(token, stage, direction, owner, { target } = {}) {
    if (
      !MOTIONS[stage.motion] ||
      !token?.mesh ||
      token.visible === false ||
      token.document?.hidden
    )
      return Promise.resolve(false);
    const current = this.active.get(token);
    if (current && (current.owner !== owner || current.mesh !== token.mesh)) this.end(token);
    const existing = this.active.get(token);
    // Body treatments yield before we capture the resting geometry. Otherwise an
    // idle breath or wounded hunch becomes the permanent scale after this motion.
    if (!existing) this.beforeStart(token);
    const mesh = token.mesh;
    // Foundry draws the mesh at the token's center; another module's shake (or a condition
    // tremble) may have it swung aside right now, which must not become the resting spot.
    const rest = token.center ?? mesh.position;
    const original = existing?.original ?? {
      x: rest.x,
      y: rest.y,
      rotation: mesh.rotation,
      sx: mesh.scale.x,
      sy: mesh.scale.y,
      alpha: mesh.alpha ?? 1,
    };
    const location = existing?.location ?? {
      x: token.document?.x,
      y: token.document?.y,
      rotation: token.document?.rotation,
      geometry: tokenGeometry(token),
    };
    const endpoint =
      PATH_MOTIONS.has(stage.motion) && stage.motionRange === "target" && target
        ? { x: target.document?.x, y: target.document?.y, geometry: tokenGeometry(target) }
        : null;
    return new Promise((resolve) => {
      const run = existing ?? { owner, mesh, original, location, tracks: [], frame: null, drift: { x: 0, y: 0 } };
      run.tracks.push({ stage, direction, target, endpoint, resolve, start: this.now() });
      if (existing) return;
      this.active.set(token, run);
      const tick = (time) => {
        if (this.active.get(token) !== run) return;
        let moved =
          token.document?.x !== location.x || token.document?.y !== location.y;
        const rotated = token.document?.rotation !== location.rotation;
        const resized = geometryChanged(token, location.geometry);
        // A finisher wrote the square its held travel landed on: the document now carries
        // that offset, so rebase onto it and let the other tracks (a collapse) play on.
        const isHeld = (track) => time - track.start >= track.stage.duration &&
          Boolean(heldPose(track.stage, time - track.start - track.stage.duration, track.direction, this.grid()));
        if (moved && !rotated && !resized && run.tracks.some(isHeld)) {
          const dx = token.document.x - location.x, dy = token.document.y - location.y;
          // A held track stands for the square it reached (even while it eases back late), so pieces
          // in flight shift only by what those end poses do not cover: someone moved it elsewhere.
          const held = combineMotionPoses(run.tracks.filter(isHeld).map((track) => motionPose(track.stage, 1, track.direction, this.grid())));
          run.drift.x += dx - held.x;
          run.drift.y += dy - held.y;
          original.x += dx;
          original.y += dy;
          location.x = token.document.x;
          location.y = token.document.y;
          run.tracks = run.tracks.filter((track) => { if (!isHeld(track)) return true; this.release(track); return false; });
          moved = false;
        }
        if (
          mesh.destroyed ||
          token.mesh !== mesh ||
          moved ||
          rotated ||
          resized ||
          token.visible === false ||
          token.document?.hidden ||
          run.tracks.some(({ target, endpoint }) => endpoint &&
            (target.destroyed ||
              target.visible === false ||
              target.document?.hidden ||
              target.document?.x !== endpoint.x ||
              target.document?.y !== endpoint.y ||
              geometryChanged(target, endpoint.geometry)))
        ) {
          this.end(token, !moved && !resized, !rotated, !resized);
          return;
        }
        const poses = [];
        run.tracks = run.tracks.filter(track => {
          const elapsed = time - track.start;
          const progress = Math.min(1, elapsed / track.stage.duration);
          if (track.stage.motion === "fragments" && progress > 0 && !track.started && progress < 1) {
            track.started = true;
            // Spawn where the token is drawn: the original plus the other tracks' pose at this moment.
            // The pieces stay anchored there: a rebase (the finisher writing the square a held travel
            // reached) keeps the token where it is drawn, so it moves them only by its drift.
            const others = combineMotionPoses(run.tracks.filter((other) => other !== track).map((other) => {
              const ms = time - other.start;
              return ms < other.stage.duration ? motionPose(other.stage, ms / other.stage.duration, other.direction, this.grid())
                : heldPose(other.stage, ms - other.stage.duration, other.direction, this.grid()) ?? motionPose(other.stage, 1, other.direction, this.grid());
            }));
            const anchor = { ...run.original, x: run.original.x + others.x, y: run.original.y + others.y, rotation: run.original.rotation + others.rotation,
              sx: run.original.sx * others.scale * (others.scaleX ?? 1), sy: run.original.sy * others.scale * (others.scaleY ?? 1) };
            const from = { ...run.drift };
            const base = () => ({ ...anchor, x: anchor.x + run.drift.x - from.x, y: anchor.y + run.drift.y - from.y });
            this.guard(track, () => { track.pieces = this.fragments?.start(token, track.stage, fragmentCut(track), base) ?? null; });
          }
          if (track.pieces && progress > 0) { if (progress < 1) this.guard(track, () => track.pieces.update(progress)); else this.release(track); }
          if (progress < 1) {
            poses.push(motionPose(track.stage, progress, track.direction, this.grid()));
            return true;
          }
          // Callers continue once the motion lands; a held pose stays drawn there.
          track.resolve(true);
          const held = heldPose(track.stage, elapsed - track.stage.duration, track.direction, this.grid());
          if (held) poses.push(held);
          return Boolean(held);
        });
        const pose = combineMotionPoses(poses);
        mesh.position.set(original.x + pose.x, original.y + pose.y);
        mesh.rotation = original.rotation + pose.rotation;
        mesh.scale.set(original.sx * pose.scale * (pose.scaleX ?? 1), original.sy * pose.scale * (pose.scaleY ?? 1));
        if (pose.alpha !== undefined) { mesh.alpha = meshAlpha(original.alpha, pose.alpha); run.alphaTouched = true; }
        else if (run.alphaTouched) mesh.alpha = original.alpha;
        if (this.afterimages) this.trail(token, run, time);
        if (!run.tracks.length) this.end(token);
        else run.frame = this.frame(tick);
      };
      run.frame = this.frame(tick);
    });
  }
  // Fast outbound travel leaves a ghost where the token is drawn now (at most one a frame). Each
  // trailing track keeps its own gate, made on its first frame; drawn spot and rest are both in canvas px.
  // Runs on the ticker: anything broken here only loses ghosts; the motion plays on.
  trail(token, run, time) {
    try {
      const grid = this.grid(), drawn = { x: run.mesh.position.x, y: run.mesh.position.y }, rest = { x: run.original.x, y: run.original.y };
      let dropFor = null;
      for (const track of run.tracks) {
        track.trails ??= trails(track.stage, grid, track.direction);
        if (!track.trails) continue;
        track.gate ??= createTrailGate();
        const dt = time - (track.trailAt ?? track.start);
        track.trailAt = time;
        if (track.gate.step(drawn, rest, dt, grid)) dropFor ??= track;
      }
      if (dropFor) this.afterimages.drop(token, run.mesh, dropFor.stage.trailTint, time);
      this.afterimages.tick(token, time);
    } catch (error) { this.warnAfterimages(error); }
  }
  warnAfterimages(error) {
    if (this.warnedAfterimages) return;
    this.warnedAfterimages = true;
    console.warn("Animater afterimages:", error?.message ?? error);
  }
  // A broken renderer must never stick the token: drop its pieces and play on without them.
  release(track) {
    const pieces = track.pieces;
    track.pieces = null;
    try { pieces?.destroy(); } catch (error) { this.warnFragments(error); }
  }
  guard(track, work) {
    try { work(); } catch (error) { this.warnFragments(error); this.release(track); }
  }
  warnFragments(error) {
    if (this.warnedFragments) return;
    this.warnedFragments = true;
    console.warn("Animater fragments:", error?.message ?? error);
  }
  end(token, restorePosition = true, restoreRotation = true, restoreScale = true) {
    const run = this.active.get(token);
    if (!run) return;
    this.active.delete(token);
    this.cancel(run.frame);
    if (!run.mesh.destroyed && token.mesh === run.mesh) {
      if (restorePosition)
        run.mesh.position.set(run.original.x, run.original.y);
      if (restoreRotation) run.mesh.rotation = run.original.rotation;
      if (restoreScale) run.mesh.scale.set(run.original.sx, run.original.sy);
      if (run.alphaTouched) run.mesh.alpha = run.original.alpha;
    }
    // Ghosts outlive the motion only to finish fading.
    try { this.afterimages?.fadeOut(token); } catch (error) { this.warnAfterimages(error); }
    for (const track of run.tracks) this.release(track);
    for (const track of run.tracks) track.resolve(true);
  }
  stop(owner, { prefix = false } = {}) {
    for (const [token, run] of this.active)
      if (!owner || run.owner === owner || (prefix && typeof run.owner === "string" && run.owner.startsWith(`${owner}:`))) this.end(token);
  }
}
