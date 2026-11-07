import test from "node:test";
import assert from "node:assert/strict";
import { Workspace } from "../../scripts/ui/workspace.mjs";
import { FlashEditor } from "../../scripts/ui/flash-editor.mjs";

globalThis.cancelAnimationFrame ??= () => {};

const closing = () => {
  const w = Object.create(Workspace.prototype);
  w.abort = new AbortController();
  w.root = { querySelectorAll: () => [] };
  w.stopEditorPreview = () => {};
  return w;
};

// A preview left running holds the closed window's DOM, and the Tokenshade one a live WebGL context each: enough
// closes and the browser takes the game board's context away.
test("closing the window stops the Tokenshade preview", () => {
  const w = closing();
  let stopped = 0;
  w.tokenshadeStudio = { stop: () => { stopped++; } };
  w.destroy();
  assert.equal(stopped, 1);
});

test("closing the window stops the flash editor", () => {
  const w = closing();
  let stopped = 0;
  w.flashEditor = { stop: () => { stopped++; } };
  w.destroy();
  assert.equal(stopped, 1);
});

test("a window that never opened those pages still closes", () => {
  assert.doesNotThrow(() => closing().destroy());
});

test("stopping the flash editor releases its preview, its thumbnails and its pending redraw", async () => {
  let rendered = 0;
  const ed = new FlashEditor({ host: {}, page: "flash", root: null, render() { rendered++; } });
  const stopped = [];
  const run = (name) => ({ stop: () => stopped.push(name) });
  ed.preview = run("preview");
  ed.playing = true;
  ed.thumbRuns = [run("thumb-a"), run("thumb-b")];
  ed.later();
  ed.stop();
  assert.deepEqual(stopped.sort(), ["preview", "thumb-a", "thumb-b"]);
  assert.equal(ed.preview, null);
  assert.equal(ed.playing, false);
  assert.deepEqual(ed.thumbRuns, []);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(rendered, 0, "the redraw that was waiting must not fire on a closed window");
});

test("stopping a flash editor with nothing running is harmless", () => {
  const ed = new FlashEditor({ host: {}, page: "flash", root: null, render() {} });
  assert.doesNotThrow(() => { ed.stop(); ed.stop(); });
});
