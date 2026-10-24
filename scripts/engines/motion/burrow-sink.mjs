// A burrowing creature sinks into the ground as it goes below its level's floor and rises back out where it surfaces.
// Per token a depth p runs 0 (on the surface) to 1 (under) over `duration` ms, either way, and turns back from
// wherever it is if the creature changes its mind half-way. Its pose eases by p²: sinking starts slow and drops
// (ease-in), rising leaps out and settles (ease-out). A viewer who does not own it watches it shrink to SUNK_SCALE and
// fade out, then it is gone; its owner and the GM see it fade to a faint ghost (GHOST_ALPHA) at its full size.
export const SUNK_SCALE = 0.55;
export const GHOST_ALPHA = 0.3;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createBurrowSink({ now = () => performance.now(), duration = 350, ghostAlpha = GHOST_ALPHA, sunkScale = SUNK_SCALE } = {}) {
  // id -> { p0, t0, dir }: depth p0 at time t0, moving down (dir 1) or up (dir -1).
  const states = new Map();
  const depthOf = (s, t) => clamp01(s.p0 + (s.dir * (t - s.t0)) / Math.max(1, duration));
  const depth = (id) => {
    const s = states.get(id);
    if (!s) return 0;
    const p = depthOf(s, now());
    // Fully back up: forgotten, so its pose is exactly the natural one.
    if (p <= 0 && s.dir < 0) { states.delete(id); return 0; }
    return p;
  };
  return {
    // Tell it whether the token is under the floor now. Returns "sink" as it starts going down, "rise" as it starts
    // coming up, else null. `instant` puts it straight where it belongs (a token already under when the scene loads).
    update(id, underground, { instant = false } = {}) {
      const s = states.get(id), t = now();
      if (underground) {
        if (s?.dir > 0) return null;
        const p = instant ? 1 : s ? depthOf(s, t) : 0;
        states.set(id, { p0: p, t0: t, dir: 1 });
        return instant ? null : "sink";
      }
      if (!s || s.dir < 0) { if (s) depth(id); return null; }
      if (instant) { states.delete(id); return null; }
      states.set(id, { p0: depthOf(s, t), t0: t, dir: -1 });
      return "rise";
    },
    depth,
    // Is it part-way down or up (its pose changes every frame)?
    moving(id) { const p = depth(id); return p > 0 && p < 1; },
    // Is it below the surface at all (sinking, under, or rising)?
    has(id) { return depth(id) > 0 || states.get(id)?.dir > 0; },
    // Its pose for this viewer right now: an alpha and a scale to multiply into what Foundry draws.
    pose(id, { owner = false, gm = false } = {}) {
      const p = depth(id);
      if (p <= 0) return { alpha: 1, scale: 1 };
      const a = p * p;
      if (owner || gm) return { alpha: 1 - a * (1 - ghostAlpha), scale: 1 };
      return { alpha: 1 - a, scale: 1 - a * (1 - sunkScale) };
    },
    // Should this viewer not see it at all (it has finished sinking and they do not own it)?
    hiddenFor(id, { owner = false, gm = false } = {}) {
      if (owner || gm) return false;
      // Coming back up shows it at once, to rise out of the ground.
      return depth(id) >= 1 && states.get(id)?.dir > 0;
    },
    ids() { return [...states.keys()]; },
    delete(id) { states.delete(id); },
    clear() { states.clear(); },
  };
}

// Multiply a pose into a mesh without ever stacking it: the natural value is what Foundry (or anything else) last
// wrote, unless the value there is still the one we set, in which case it is the natural one we recorded then.
// Returns the record to keep for the next call (null when the pose is the natural one and nothing is left to undo).
export function poseMesh(mesh, pose, record = null, { scale = true } = {}) {
  if (!mesh) return null;
  const baseA = record && mesh.alpha === record.setA ? record.baseA : mesh.alpha;
  const sx = mesh.scale?.x, sy = mesh.scale?.y;
  const ours = record && record.setSX !== undefined && sx === record.setSX && sy === record.setSY;
  const baseSX = ours ? record.baseSX : sx, baseSY = ours ? record.baseSY : sy;
  const alpha = pose?.alpha ?? 1, k = scale ? (pose?.scale ?? 1) : 1;
  if (alpha === 1 && k === 1) {
    // Back to natural: undo what is still ours.
    if (record && mesh.alpha === record.setA) mesh.alpha = record.baseA;
    if (ours) mesh.scale.set(record.baseSX, record.baseSY);
    return null;
  }
  mesh.alpha = baseA * alpha;
  const next = { baseA, setA: mesh.alpha };
  if (k !== 1 && mesh.scale) {
    mesh.scale.set(baseSX * k, baseSY * k);
    Object.assign(next, { baseSX, baseSY, setSX: mesh.scale.x, setSY: mesh.scale.y });
  } else if (ours) mesh.scale.set(record.baseSX, record.baseSY);
  return next;
}

// Whether a token was drawn on this screen before a sink hid it: a creature this screen could see keeps showing its
// churned trail and holes and keeps being heard digging. `hidden` maps a token we hid to what Foundry had decided.
export function drawnBeforeSink(token, hidden) {
  if (hidden?.has?.(token)) return hidden.get(token) === true;
  return token?.visible === true;
}
