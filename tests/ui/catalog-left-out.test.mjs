import test from "node:test";
import assert from "node:assert/strict";
import { plugModeHTML, leftOutOnly, showingLeftOut } from "../../scripts/catalogs/shared/catalog-terms.mjs";

const state = { enabled: true, scope: "all", excluded: ["b"], selected: [], customized: [] };
const list = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("the Plug & play chip's left-out count is a button that lists those entries", () => {
  const off = plugModeHTML(state, 3, false);
  assert.match(off, /data-action="catalog-left-out" aria-pressed="false"[^>]*>1 left out<\/button>/);
  assert.match(plugModeHTML(state, 3, true), /aria-pressed="true"[^>]*>1 left out ✕/);
  assert.doesNotMatch(plugModeHTML({ ...state, excluded: [] }, 3), /catalog-left-out/);
  assert.doesNotMatch(plugModeHTML({ ...state, scope: "selected", selected: ["a"] }, 3), /catalog-left-out/);
});

test("the left-out view applies to the page that turned it on, and only while something is left out", () => {
  const w = { page: "spells", leftOutView: "spells" };
  assert.deepEqual(leftOutOnly(w, state, list).map((e) => e.id), ["b"]);
  assert.equal(leftOutOnly({ ...w, page: "feats" }, state, list).length, 3);
  assert.equal(leftOutOnly(w, { ...state, excluded: [] }, list).length, 3);
  assert.equal(showingLeftOut({ page: "spells" }, state), false);
});
