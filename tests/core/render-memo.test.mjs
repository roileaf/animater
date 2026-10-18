import test from "node:test";
import assert from "node:assert/strict";
import { withRenderMemo, renderMemo } from "../../scripts/core/render-memo.mjs";

const countingHost = () => {
  const calls = { soundCatalog: 0, recipes: 0, catalog: 0 };
  const host = {
    playerMode: false,
    soundCatalog() { calls.soundCatalog++; return { packs: [calls.soundCatalog] }; },
    recipes() { calls.recipes++; return [{ id: `r${calls.recipes}` }]; },
    catalog() { calls.catalog++; return []; },
  };
  return { host, calls };
};

test("a render builds the sound catalog and reads recipes once, however often it asks", () => {
  const { host, calls } = countingHost();
  const owner = { host };
  const seen = withRenderMemo(owner, () => {
    const a = owner.host.soundCatalog(), b = owner.host.soundCatalog?.();
    const r1 = owner.host.recipes(), r2 = owner.host.recipes();
    return { a, b, r1, r2 };
  });
  assert.equal(calls.soundCatalog, 1);
  assert.equal(calls.recipes, 1);
  assert.equal(seen.a, seen.b);
  assert.equal(seen.r1, seen.r2);
});

test("reads outside a render reach the host every time (a pack registered later is never hidden)", () => {
  const { host, calls } = countingHost();
  const owner = { host };
  withRenderMemo(owner, () => owner.host.soundCatalog());
  assert.equal(owner.host, host, "the raw host is restored after the render");
  owner.host.soundCatalog();
  owner.host.soundCatalog();
  assert.equal(calls.soundCatalog, 3);
  // The next render sees the current host state, not the previous render's.
  const next = withRenderMemo(owner, () => owner.host.soundCatalog());
  assert.deepEqual(next.packs, [4]);
});

test("a host captured during a render stops memoizing once the render ends", () => {
  const { host, calls } = countingHost();
  const owner = { host };
  const captured = withRenderMemo(owner, () => { owner.host.recipes(); return owner.host; });
  captured.recipes();
  captured.recipes();
  assert.equal(calls.recipes, 3);
});

test("only listed reads are memoized; others and plain properties pass through", () => {
  const { host, calls } = countingHost();
  const owner = { host };
  withRenderMemo(owner, () => {
    owner.host.catalog();
    owner.host.catalog();
    assert.equal(owner.host.playerMode, false);
    assert.equal("soundCatalog" in owner.host, true);
    assert.equal(owner.host.missing, undefined);
  });
  assert.equal(calls.catalog, 2);
});

test("a read with arguments is never memoized", () => {
  let n = 0;
  const host = { recipes: (who) => [{ id: `${who}:${++n}` }] };
  const owner = { host };
  withRenderMemo(owner, () => {
    assert.notEqual(owner.host.recipes("a")[0].id, owner.host.recipes("a")[0].id);
  });
});

test("a nested render shares the outer render's memo", () => {
  const { host, calls } = countingHost();
  const owner = { host };
  withRenderMemo(owner, () => {
    owner.host.soundCatalog();
    withRenderMemo(owner, () => owner.host.soundCatalog());
    owner.host.soundCatalog();
  });
  assert.equal(calls.soundCatalog, 1);
  assert.equal(owner.host, host);
});

test("the host is restored when the render throws", () => {
  const { host } = countingHost();
  const owner = { host };
  assert.throws(() => withRenderMemo(owner, () => { throw Error("boom"); }), /boom/);
  assert.equal(owner.host, host);
});

test("a missing host renders without memoizing", () => {
  const owner = {};
  assert.equal(withRenderMemo(owner, () => 7), 7);
});

test("renderMemo computes once per render and fresh outside one", () => {
  const { host } = countingHost();
  const owner = { host };
  let n = 0;
  const compute = () => ++n;
  withRenderMemo(owner, () => {
    assert.equal(renderMemo(owner.host, "x", compute), 1);
    assert.equal(renderMemo(owner.host, "x", compute), 1);
    assert.equal(renderMemo(owner.host, "y", compute), 2);
  });
  assert.equal(renderMemo(owner.host, "x", compute), 3);
  assert.equal(renderMemo(owner.host, "x", compute), 4);
  assert.equal(renderMemo(undefined, "x", compute), 5);
});

test("Workspace.render and updateInspector memoize host reads for the whole pass", async () => {
  const { Workspace } = await import("../../scripts/ui/workspace.mjs");
  const { host, calls } = countingHost();
  const w = Object.create(Workspace.prototype);
  w.host = host;
  const readTwice = function () {
    this.host.soundCatalog(); this.host.soundCatalog?.();
    this.host.recipes(); this.host.recipes();
  };
  w.renderPage = readTwice;
  w.patchInspector = readTwice;
  w.render();
  assert.deepEqual([calls.soundCatalog, calls.recipes], [1, 1]);
  w.updateInspector();
  assert.deepEqual([calls.soundCatalog, calls.recipes], [2, 2], "each pass reads the host afresh");
  assert.equal(w.host, host);
});

test("recipe cards share one conflicts pass per render and keep the same notes", async () => {
  const { Workspace } = await import("../../scripts/ui/workspace.mjs");
  const saved = [
    { id: "a", name: "First", trigger: "use", match: "fireball", enabled: true, stages: [] },
    { id: "b", name: "Second", trigger: "use", match: "fireball", enabled: true, stages: [] },
    { id: "c", name: "Alone", trigger: "use", match: "shield", enabled: true, stages: [] },
  ];
  let reads = 0;
  const w = Object.create(Workspace.prototype);
  Object.assign(w, { drafts: new Map(), host: { recipes: () => { reads++; return structuredClone(saved); } } });
  const outside = saved.map((r) => w.linkNote(r));
  const outsideReads = reads;
  reads = 0;
  const inside = withRenderMemo(w, () => saved.map((r) => w.linkNote(r)));
  assert.equal(reads, 1, "one recipes read for every card in the render");
  assert.equal(outsideReads, 3, "outside a render each card reads afresh");
  assert.deepEqual(inside, outside);
  assert.equal(inside[0].warn, false);
  assert.match(inside[1].short, /Not playing: “First” plays instead/);
  assert.equal(inside[2], null);
});

test("renderMemo uses the one-off fallback outside a render", () => {
  const { host } = countingHost();
  const owner = { host };
  assert.equal(renderMemo(owner.host, "k", () => "memo", () => "plain"), "plain");
  assert.equal(withRenderMemo(owner, () => renderMemo(owner.host, "k", () => "memo", () => "plain")), "memo");
});

test("recipe card status indexes the catalog once per render and agrees with a one-off check", async () => {
  const { Workspace } = await import("../../scripts/ui/workspace.mjs");
  let reads = 0;
  const catalog = [{ key: "jb2a.fire_bolt.orange", file: "a.webm" }, { key: "jb2a.explosion.01.orange", file: "b.webm" }];
  const w = Object.create(Workspace.prototype);
  w.host = { environment: () => ({ demo: true }), catalog: () => { reads++; return catalog; } };
  const recipes = [
    { stages: [{ kind: "cast", assets: ["jb2a.fire_bolt"] }, { kind: "impact", assets: ["jb2a.explosion.01.orange"] }] },
    { stages: [{ kind: "cast", assets: ["jb2a.missing"] }] },
    { stages: [{ kind: "motion", motion: "lunge", assets: [] }] },
  ];
  const outside = recipes.map((r) => w.status(r));
  reads = 0;
  const inside = withRenderMemo(w, () => recipes.map((r) => w.status(r)));
  assert.equal(reads, 1);
  assert.deepEqual(inside, outside);
  assert.deepEqual(inside, ["Ready to play", "1 missing asset", "Ready to play"]);
});
