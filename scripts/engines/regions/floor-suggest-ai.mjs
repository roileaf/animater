// Optional AI floor suggestions. Off by default; never a hard dependency.
// The GM's browser may lazily fetch pinned model weights from Hugging Face on first use.
// With the setting off, or with no network, the Lab/hue matchers still work unchanged.
//
// Spike status: not wired into the review window. Call suggestFloorFromPatch only behind the
// experimentalAiFloorSuggestions world setting after the GM opts in. See README.

export const AI_FLOOR_SPIKE = Object.freeze({
  enabledSetting: "experimentalAiFloorSuggestions",
  // SegFormer-B0 ADE20K via transformers.js. NVIDIA Source Code License (research/evaluation).
  // Lazily fetched; never bundled. ~15 MB q8 ONNX. Classes map partially onto Animater floors.
  modelId: "Xenova/segformer-b0-finetuned-ade-512-512",
  modelRevision: "main",
  runtime: "@huggingface/transformers",
  runtimeLicense: "Apache-2.0",
  modelLicense: "NVIDIA Source Code License (non-commercial / research and evaluation)",
  // ADE20K labels we can map into Animater floors. Unlisted ADE classes are ignored.
  adeToFloor: Object.freeze({
    floor: "stone",
    road: "stone",
    sidewalk: "stone",
    earth: "dirt",
    dirt: "dirt",
    grass: "grass",
    plant: "grass",
    tree: "grass",
    sand: "sand",
    water: "water",
    sea: "water",
    river: "water",
    lake: "water",
    snow: "snow",
    mountain: "stone",
    rock: "stone",
    wall: "stone",
  }),
});

export function aiSuggestionsEnabled(getSetting) {
  try { return getSetting?.("animater", AI_FLOOR_SPIKE.enabledSetting) === true; }
  catch { return false; }
}

// Returns a ranked floor suggestion for a cropped map patch, or a soft failure.
// `loadPipeline` is injected so tests never touch the network.
export async function suggestFloorFromPatch(image, {
  enabled = false,
  loadPipeline = null,
  labels = AI_FLOOR_SPIKE.adeToFloor,
} = {}) {
  if (!enabled) return { ok: false, reason: "disabled" };
  if (!image) return { ok: false, reason: "no-image" };
  if (typeof loadPipeline !== "function") return { ok: false, reason: "unavailable" };
  let pipeline;
  try {
    pipeline = await loadPipeline("image-segmentation", AI_FLOOR_SPIKE.modelId, {
      revision: AI_FLOOR_SPIKE.modelRevision,
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  let output;
  try { output = await pipeline(image); }
  catch { return { ok: false, reason: "failed" }; }
  const scores = new Map();
  for (const entry of output ?? []) {
    const floor = labels[String(entry.label ?? "").toLowerCase()];
    if (!floor) continue;
    const score = Number(entry.score);
    const weight = Number.isFinite(score) ? score : 1;
    scores.set(floor, (scores.get(floor) ?? 0) + weight);
  }
  const rankings = [...scores.entries()]
    .map(([floor, score]) => ({ floor, score }))
    .sort((a, b) => b.score - a.score || a.floor.localeCompare(b.floor));
  if (!rankings.length) return { ok: false, reason: "no-match" };
  const total = rankings.reduce((sum, row) => sum + row.score, 0) || 1;
  const top = rankings[0];
  return {
    ok: true,
    floor: top.floor,
    score: top.score / total,
    rankings: rankings.map((row) => ({ floor: row.floor, score: row.score / total })),
  };
}
