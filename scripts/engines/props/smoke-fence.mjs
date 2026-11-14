// Fencing the smoke: thick smoke blocks sight. Registers the two Foundry hooks that keep the fence true.
// The fence is rebuilt from the scene's STORED grid inside Foundry's own `initializeEdges` hook, never injected once: a scene
// config save, a level change or a canvas redraw resets the scene's edges to walls alone and calls that hook again, and an edge
// added only once would vanish then, silently, leaving smoke that draws and does not block. The edges are module-owned objects
// made per client from what the GM stored; nothing is written to any document.
// Everything Foundry-shaped comes in through `env()` (read at call time), so this runs under plain node.
import { smokeEdgeSpecs, smokeFenceLevels, syncSmokeEdges, SMOKE_GRID_FLAG } from "./smoke-edges.mjs";

// The engine's edge for one segment: a wall that blocks SIGHT only (light, darkness, move and sound stay at their NONE default).
export const smokeEdgeMaker = ({ Edge, NORMAL }) => (spec) => new Edge(spec.a, spec.b, { id: spec.id, type: "wall", sight: NORMAL });

export function registerSmokeFence({ hooks, env, cellsOf, moduleId }) {
  const memo = new WeakMap(); // scene -> { ids, key } of the edges put there last

  // Make the scene's fence match its stored grid. True when it changed.
  function fenceSmoke(scene) {
    if (!scene?.initializedEdges) return false;
    const { Edge, NORMAL } = env();
    const specs = smokeEdgeSpecs(scene, cellsOf);
    const target = smokeFenceLevels(scene);
    const key = [...target.map((l) => l.id), ...specs.map((s) => s.id)].join("|");
    const prior = memo.get(scene);
    if (prior && prior.key === key) return false;
    const ids = syncSmokeEdges([...scene.levels], target, specs, smokeEdgeMaker({ Edge, NORMAL }), prior?.ids ?? []);
    memo.set(scene, { ids, key });
    return true;
  }

  hooks.on("initializeEdges", (scene) => {
    // The engine has just cleared every level's edges and rebuilt the walls: ours are gone whatever we remember.
    memo.delete(scene);
    try { fenceSmoke(scene); } catch (err) { console.warn("Animater | smoke fence", err); }
  });

  // The GM's tick changes the stored grid: rebuild the fence now and have vision notice (an edge added outside a wall's own
  // path does not ask for it), on every client, since every client gets this update.
  hooks.on("updateScene", (scene, change) => {
    const mine = change?.flags?.[moduleId];
    if (!mine || !["smoke", "-=smoke", SMOKE_GRID_FLAG, `-=${SMOKE_GRID_FLAG}`].some((k) => k in mine)) return;
    try {
      const canvas = env().canvas;
      if (fenceSmoke(scene) && scene === canvas?.scene) canvas.perception.update({ initializeVision: true, refreshVision: true });
    } catch (err) { console.warn("Animater | smoke fence", err); }
  });
  return { fenceSmoke };
}
