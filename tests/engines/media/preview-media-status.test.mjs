import test from "node:test";
import assert from "node:assert/strict";
import { previewMediaFailed, markPreviewMediaFailure, clearPreviewMediaFailure } from "../../../scripts/engines/media/preview-media-status.mjs";
import { Workspace } from "../../../scripts/ui/workspace.mjs";

test("Workspace ignores released/aborted media errors and clears actual failures on recovery", () => {
  const events = {}, classes = new Set();
  const layer = { classList: { add: c => classes.add(c), remove: c => classes.delete(c) }, setAttribute() {}, removeAttribute() {} };
  const video = { tagName: "VIDEO", src: "https://localhost/valid.webm", currentSrc: "https://localhost/valid.webm", readyState: 0,
    getAttribute: () => "valid.webm", closest: selector => selector === ".an-recipe-layer" ? layer : null };
  class MinimalWorkspace extends Workspace { render() {} }
  new MinimalWorkspace({ addEventListener: (event, handler) => { events[event] = handler; } }, { recipes: () => [] });
  video.error = { code: 1 };
  events.error({ target: video });
  assert.equal(classes.size, 0);
  video.error = { code: 4 };
  events.error({ target: video });
  assert.ok(classes.has("is-unavailable"));
  video.error = null; video.readyState = 4;
  events.loadeddata({ target: video });
  assert.equal(classes.size, 0);
  events.error({ target: video }); // queued event from a previous source
  assert.equal(classes.size, 0);
});

test("only current resource failures get an unavailable overlay", () => {
  const video = { src: "https://localhost/new.webm", currentSrc: "https://localhost/old.webm", error: { code: 4 },
    getAttribute: () => "new.webm", closest: () => null };
  assert.equal(previewMediaFailed(video), false);
  video.currentSrc = video.src;
  assert.equal(previewMediaFailed(video), true);
  assert.equal(previewMediaFailed(video, { name: "NotAllowedError" }), false);
  video.getAttribute = () => null;
  assert.equal(markPreviewMediaFailure(video), false);
  clearPreviewMediaFailure(video);
});

test("Replay retries a failed network load before starting the choreography clock", async () => {
  const { RecipePreview } = await import("../../../scripts/engines/preview/recipe-preview.mjs");
  const listeners = new Map(), classes = new Set(["is-unavailable"]);
  const video = { readyState: 0, error: { code: 2 }, src: "valid.webm", currentSrc: "valid.webm",
    closest: () => ({ classList: { remove: c => classes.delete(c) }, removeAttribute() {} }),
    addEventListener: (name, cb) => listeners.set(name, cb), removeEventListener: name => listeners.delete(name),
    load() { this.error = null; this.readyState = 4; listeners.get("loadeddata")(); } };
  const player = new RecipePreview({ dataset: {}, querySelectorAll: () => [] }, { stages: [] }, () => {});
  await player.ready(video);
  assert.equal(video.readyState, 4);
  assert.equal(classes.size, 0);
  assert.equal(listeners.size, 0);
});
