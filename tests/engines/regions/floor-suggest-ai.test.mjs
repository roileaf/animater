import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_FLOOR_SPIKE, aiSuggestionsEnabled, suggestFloorFromPatch } from "../../../scripts/engines/regions/floor-suggest-ai.mjs";

test("AI suggestions stay off unless the world setting is true", () => {
  assert.equal(aiSuggestionsEnabled(() => false), false);
  assert.equal(aiSuggestionsEnabled((mod, key) => mod === "other" && key === AI_FLOOR_SPIKE.enabledSetting), false);
  assert.equal(aiSuggestionsEnabled((mod, key) => mod === "animater" && key === "somethingElse"), false);
  assert.equal(aiSuggestionsEnabled((mod, key) => mod === "animater" && key === AI_FLOOR_SPIKE.enabledSetting), true);
});

test("suggestFloorFromPatch never loads a model when disabled", async () => {
  let called = false;
  const result = await suggestFloorFromPatch({}, {
    enabled: false,
    loadPipeline: async () => { called = true; return async () => []; },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "disabled");
  assert.equal(called, false);
});

test("suggestFloorFromPatch maps ADE labels into Animater floors with confidence", async () => {
  const result = await suggestFloorFromPatch("patch", {
    enabled: true,
    loadPipeline: async () => async () => ([
      { label: "grass", score: 0.6 },
      { label: "earth", score: 0.3 },
      { label: "person", score: 0.9 },
    ]),
  });
  assert.equal(result.ok, true);
  assert.equal(result.floor, "grass");
  assert.ok(result.score > 0.5);
  assert.equal(result.rankings[1].floor, "dirt");
});

test("unavailable pipelines fail soft so Lab/hue keep working", async () => {
  const result = await suggestFloorFromPatch("patch", {
    enabled: true,
    loadPipeline: async () => { throw new Error("offline"); },
  });
  assert.deepEqual(result, { ok: false, reason: "unavailable" });
});
