import test from "node:test";
import assert from "node:assert/strict";
import { AnimaterRuntime } from "../../scripts/engines/playback/runtime.mjs";
import { PersistentStates } from "../../scripts/engines/playback/persistent-states.mjs";
import { PF2E_CONDITIONS } from "../../scripts/catalogs/pf2e/state-catalog.mjs";
import { Workspace } from "../../scripts/ui/workspace.mjs";
import { activityEntryMeta, nowPlayingRows, elapsedLabel, originKey } from "../../scripts/ui/activity-actions.mjs";

// --- Runtime: what an entry records -------------------------------------------------
function runtimeFixture({ saved = [], origin } = {}) {
  const ended = [];
  const chain = new Proxy({}, { get: () => () => chain });
  const host = {
    database: { entryExists: () => true, getPathsUnder: () => ["jb2a.impact.001.orange"], getAllFileEntries: (k) => [`${k}.webm`] },
    enabled: () => true, recipes: () => saved, ready: () => true, canPlay: () => true, userId: () => "u",
    sequence: () => ({ effect: () => chain, sound: () => chain, play: async () => {} }),
    endEffects: async (filters, push) => ended.push([filters, push]), endSounds: async () => {},
    motion: async () => {}, stopMotion: async () => {},
    ...(origin ? { recipeOrigin: () => origin } : {}),
  };
  const runtime = new AnimaterRuntime(host);
  runtime.refreshCatalog();
  runtime.wait = async () => true;
  return { runtime, host, ended };
}
const once = (id = "pf2e-abc") => ({ id, name: "Spark", trigger: "use", stages: [{ kind: "impact", subject: "source", assets: ["jb2a.impact.001.orange"], duration: 500 }] });
const lasting = (id = "pf2e-ward") => ({ id, name: "Ward", trigger: "use", stages: [{ kind: "aura", subject: "source", assets: ["jb2a.impact.001.orange"], duration: 500, persist: true }] });
const source = { id: "tok", name: "Valeros", center: { x: 0, y: 0 } }, target = { id: "foe", name: "Foe", center: { x: 100, y: 0 } };

test("an automatic catalog play records its recipe, catalog origin and that it is automatic", async () => {
  const f = runtimeFixture({ origin: { type: "catalog", kind: "spell", id: "abc" } });
  await f.runtime.play(once(), { source, targets: [target], automatic: true });
  const entry = f.runtime.log[0];
  assert.equal(entry.status, "Played");
  assert.equal(entry.recipeId, "pf2e-abc");
  assert.deepEqual(entry.origin, { type: "catalog", kind: "spell", id: "abc" });
  assert.equal(entry.automatic, true);
  assert.equal(entry.session, undefined, "a one-time animation has nothing left running");
});

test("an automatic play of a saved recipe records a recipe origin; a lasting one records its session", async () => {
  const f = runtimeFixture({ saved: [lasting("mine")] });
  await f.runtime.play(lasting("mine"), { source, targets: [], automatic: true });
  const entry = f.runtime.log[0];
  assert.deepEqual(entry.origin, { type: "recipe", id: "mine" });
  assert.match(entry.session, /^animater-u-/);
  const [row] = f.runtime.runningAnimations();
  assert.equal(row.session, entry.session);
  assert.equal(row.name, "Ward");
  assert.equal(row.on, "Valeros");
  assert.deepEqual(row.origin, { type: "recipe", id: "mine" });
});

test("a preview records preview and no origin", async () => {
  const f = runtimeFixture({ origin: { type: "catalog", kind: "spell", id: "abc" } });
  await f.runtime.play(once(), { source, targets: [target] }, { preview: true });
  const entry = f.runtime.log[0];
  assert.equal(entry.status, "Previewed");
  assert.equal(entry.preview, true);
  assert.equal(entry.origin, undefined);
  assert.equal(entry.automatic, undefined);
});

test("stopping a running session ends it (for everyone or just here) and drops it from Now playing", async () => {
  const f = runtimeFixture();
  await f.runtime.play(lasting(), { source, targets: [], automatic: true });
  const [row] = f.runtime.runningAnimations();
  assert.equal(await f.runtime.endSession(row.session, { everyone: true }), true);
  assert.deepEqual(f.ended.at(-1), [{ name: row.session }, true]);
  assert.equal(f.runtime.runningAnimations().length, 0);
  assert.equal(f.runtime.log[0].status, "Stopped");
  await f.runtime.play(lasting(), { source, targets: [], automatic: true });
  const [mine] = f.runtime.runningAnimations();
  await f.runtime.endSession(mine.session, { everyone: false });
  assert.deepEqual(f.ended.at(-1), [{ name: mine.session }, false], "a player's stop stays on their screen");
});

test("a running session whose effects are gone (template removed) leaves Now playing", async () => {
  const f = runtimeFixture();
  let alive = true;
  f.host.effectRunning = () => alive;
  await f.runtime.play(lasting(), { source, targets: [], automatic: true });
  assert.equal(f.runtime.runningAnimations().length, 1);
  alive = false;
  assert.equal(f.runtime.runningAnimations().length, 0);
});

test("entry metadata stays small and tolerates missing fields", () => {
  assert.deepEqual(activityEntryMeta(null, null), {});
  assert.deepEqual(activityEntryMeta({ id: "r" }, { origin: { type: "catalog", kind: "spell", id: "x", extra: 1 }, automatic: true, key: "k" }),
    { recipeId: "r", origin: { type: "catalog", kind: "spell", id: "x" }, automatic: true, key: "k" });
  assert.deepEqual(activityEntryMeta({ id: "r" }, { origin: { type: "bogus" } }), { recipeId: "r" });
  assert.equal(originKey({ type: "catalog", system: "dnd5e", kind: "spell", id: "x" }), "catalog:dnd5e:spell:x");
  assert.equal(originKey(null), "");
  assert.equal(elapsedLabel(4200), "4s");
  assert.equal(elapsedLabel(184000), "3m 04s");
  assert.equal(elapsedLabel(3720000), "1h 02m");
});

// --- Persistent states: start metadata, Now playing and Stop --------------------------
const fear = PF2E_CONDITIONS.find((e) => e.slug === "frightened");
function statesFixture() {
  const traces = [], ended = [];
  const item = { id: "i", uuid: "Actor.a.Item.i", type: "condition", name: fear.name, slug: fear.slug, sourceId: fear.uuid, system: { active: true, value: { isValued: true, value: 1 } }, active: true };
  const actor = { items: [item], hasPlayerOwner: true, isOwner: true };
  const token = { id: "t", name: "Caster", document: { uuid: "Scene.s.Token.t" }, actor, visible: true, isOwner: true, w: 100, h: 100 };
  const chain = new Proxy({}, { get: () => () => chain });
  const h = {
    clientId: "c1", ready: () => true, sceneId: () => "s", tokens: () => [token], recipes: () => [],
    state: () => ({ enabled: true, scope: "all" }), visibility: () => ({ isGM: true }), gridSize: () => 100,
    catalog: () => fear.assets.map((key) => ({ key, file: "m.webm", width: 400, height: 400 })),
    end: async (name) => ended.push(name), sequence: () => ({ effect: () => chain, play: async () => {} }),
    origin: (it) => ({ type: "catalog", kind: "condition", id: fear.id, item: it.id }),
    trace: (...args) => traces.push(args),
  };
  return { manager: new PersistentStates(h), traces, ended, actor, item };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test("a persistent start records its key, recipe and catalog origin, and shows in Now playing", async () => {
  const f = statesFixture();
  await f.manager.reconcile(); await flush();
  const start = f.traces.find((t) => t[0] === "Persistent");
  assert.ok(start, "the start is traced");
  const [, , recipe, meta] = start;
  assert.equal(recipe.name, fear.name);
  assert.equal(meta.automatic, true);
  assert.match(meta.key, /^s:Scene\.s\.Token\.t:/);
  assert.deepEqual(meta.origin, { type: "catalog", kind: "condition", id: fear.id, item: "i" });
  const [row] = f.manager.running();
  assert.equal(row.key, meta.key);
  assert.equal(row.on, "Caster");
  assert.ok(row.startedAt > 0);
  await f.manager.destroy();
});

test("Stop ends one lasting condition animation; the condition stays and it returns when reapplied", async () => {
  const f = statesFixture();
  await f.manager.reconcile(); await flush();
  const [row] = f.manager.running();
  assert.equal(await f.manager.stop(row.key), true);
  assert.equal(f.ended.length, 1);
  assert.equal(f.manager.running().length, 0);
  await f.manager.reconcile(); await flush();
  assert.equal(f.manager.running().length, 0, "still stopped while the condition stays");
  f.actor.items = []; await f.manager.reconcile();
  f.actor.items = [f.item]; await f.manager.reconcile(); await flush();
  assert.equal(f.manager.running().length, 1, "applied again, it animates again");
  await f.manager.destroy();
});

// --- The Activity page ----------------------------------------------------------------
function activityWorkspace({ gm = true, log = [], playing = [], saved = [] } = {}) {
  const w = Object.create(Workspace.prototype);
  let spells = { enabled: true, scope: "all", excluded: [], selected: [], customized: [] }, recipes = saved;
  const stopped = [], saves = [];
  Object.assign(w, {
    page: "activity", busy: false, message: "", drafts: new Map(), dirty: new Set(), activityExcluded: new Map(),
    root: { querySelectorAll: () => [], querySelector: () => null },
    host: {
      isGM: () => gm, playerMode: !gm, logs: () => log, nowPlaying: () => playing,
      environment: () => ({ ready: true, systemId: "pf2e" }),
      catalogState: () => spells, setCatalogState: async (change) => { spells = { ...spells, ...change }; },
      recipes: () => recipes, save: async (data) => { saves.push(data); recipes = data; },
      stopAnimation: async (row) => { stopped.push(row); playing = playing.filter((p) => p.id !== row.id); },
    },
  });
  w.render = () => {};
  const click = (dataset) => w.onClick({ target: { closest: () => ({ dataset, disabled: false }) }, preventDefault() {} });
  return { w, click, spells: () => spells, stopped, saves, recipes: () => recipes };
}
const spellOrigin = { type: "catalog", kind: "spell", id: "abc" };
const rows = [
  { time: "1", status: "Played", detail: "", recipe: "Spark", recipeId: "pf2e-abc", origin: spellOrigin, automatic: true },
  { time: "2", status: "Previewed", detail: "", recipe: "Spark", recipeId: "pf2e-abc", preview: true },
  { time: "3", status: "Skipped", detail: "no recipe", recipe: "" },
  { time: "4", status: "Blocked", detail: "nope", recipe: "Spark", recipeId: "pf2e-abc", origin: spellOrigin, automatic: true },
  { time: "5", status: "Played", detail: "", recipe: "Manual", recipeId: "m" },
];
const live = [{ id: "session:animater-u-1", kind: "session", session: "animater-u-1", name: "Ward <b>", on: "Valeros", startedAt: Date.now() - 5000, origin: { type: "recipe", id: "mine" } }];
const historyOf = (html) => html.slice(html.indexOf('data-activity="history"'));
const nowOf = (html) => html.slice(html.indexOf('data-activity="now"'), html.indexOf('data-activity="history"'));

test("Now playing is built from live state; History is the log", () => {
  const { w } = activityWorkspace({ log: rows, playing: live });
  const html = w.activityHTML();
  assert.match(html, /Now playing/);
  assert.match(nowOf(html), /Ward &lt;b&gt;/);
  assert.match(nowOf(html), /Valeros/);
  assert.match(nowOf(html), /data-action="activity-stop" data-entry="session:animater-u-1"/);
  assert.match(nowOf(html), /data-action="activity-exclude" data-entry="session:animater-u-1"/);
  assert.match(nowOf(html), /aria-label="Stop Ward &lt;b&gt;"/);
  assert.doesNotMatch(nowOf(html), /Spark/, "the log is not scanned for running animations");
});

test("an empty Now playing says so", () => {
  const { w } = activityWorkspace({ log: rows });
  assert.match(nowOf(w.activityHTML()), /Nothing playing right now\./);
});

test("History: Exclude on automatic rows only, never Stop; nothing on previews, skips and blocks", () => {
  const { w } = activityWorkspace({ log: rows, playing: live });
  const history = historyOf(w.activityHTML());
  assert.doesNotMatch(history, /activity-stop/);
  const excludes = [...history.matchAll(/data-action="activity-exclude" data-index="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(excludes, [0], "only the automatic Played row");
  assert.match(history, /aria-label="Exclude Spark from automatic playback"/);
});

test("players see Stop but no Exclude", () => {
  const { w } = activityWorkspace({ gm: false, log: rows, playing: live });
  const html = w.activityHTML();
  assert.match(html, /activity-stop/);
  assert.doesNotMatch(html, /activity-exclude/);
});

test("Exclude on a catalog row excludes that catalog entry; Undo includes it again", async () => {
  const f = activityWorkspace({ log: rows });
  await f.click({ action: "activity-exclude", index: "0" });
  assert.deepEqual(f.spells().excluded, ["abc"]);
  assert.match(historyOf(f.w.activityHTML()), /Excluded[\s\S]*data-action="activity-undo" data-index="0"/);
  await f.click({ action: "activity-undo", index: "0" });
  assert.deepEqual(f.spells().excluded, []);
  assert.doesNotMatch(f.w.activityHTML(), /activity-undo/);
});

test("Exclude on a recipe row disables and saves that recipe; Undo enables it again", async () => {
  const f = activityWorkspace({ playing: live, saved: [{ id: "mine", name: "Ward", enabled: true }, { id: "other", name: "Other", enabled: true }] });
  await f.click({ action: "activity-exclude", entry: "session:animater-u-1" });
  assert.equal(f.saves.length, 1, "saved right away");
  assert.equal(f.recipes().find((r) => r.id === "mine").enabled, false);
  assert.equal(f.recipes().find((r) => r.id === "other").enabled, true);
  await f.click({ action: "activity-undo", entry: "session:animater-u-1" });
  assert.equal(f.recipes().find((r) => r.id === "mine").enabled, true);
});

test("a player's Exclude click does nothing", async () => {
  const f = activityWorkspace({ gm: false, log: rows });
  await f.click({ action: "activity-exclude", index: "0" });
  assert.deepEqual(f.spells().excluded, []);
});

test("Stop calls the host's end path for that animation and the row leaves Now playing", async () => {
  const f = activityWorkspace({ playing: live });
  await f.click({ action: "activity-stop", entry: "session:animater-u-1" });
  assert.equal(f.stopped.length, 1);
  assert.equal(f.stopped[0].session, "animater-u-1");
  assert.match(nowOf(f.w.activityHTML()), /Nothing playing right now\./);
});

test("nowPlayingRows merges running sessions and lasting states, newest first", () => {
  const list = nowPlayingRows([{ session: "s1", name: "A", on: "X", startedAt: 1 }], [{ key: "k1", name: "B", on: "Y", startedAt: 2 }]);
  assert.deepEqual(list.map((r) => [r.id, r.kind]), [["state:k1", "state"], ["session:s1", "session"]]);
});

// --- Now playing previews ---------------------------------------------------------------
const catalogFixture = [{ key: "jb2a.impact.001.orange", file: "modules/jb2a/Library/impact_001_orange.webm", type: "animation" }];
function previewWorkspace(playing) {
  const f = activityWorkspace({ playing });
  f.w.host.catalog = () => catalogFixture;
  f.w.host.mediaURL = (file) => `/${file}`;
  return nowOf(f.w.activityHTML());
}
const withVisual = { ...live[0], asset: "jb2a.impact.001.orange", portrait: "tokens/silva.webp", icon: "icons/item.webp" };

test("a Now playing row with a visual shows a paused, muted video thumbnail with the resolved src", () => {
  const html = previewWorkspace([withVisual]);
  const video = html.match(/<video[^>]*>/)[0];
  assert.match(video, /src="\/modules\/jb2a\/Library\/impact_001_orange\.webm"/);
  assert.match(video, /\bmuted\b/);
  assert.match(video, /\bplaysinline\b/);
  assert.match(video, /preload="metadata"/);
  assert.doesNotMatch(video, /autoplay/);
  assert.match(html, /class="an-now-thumb"/);
});

test("a row without a visual falls back to the item icon, then a generic icon", () => {
  const sound = { ...live[0], asset: "", icon: "icons/item.webp" };
  let html = previewWorkspace([sound]);
  assert.doesNotMatch(html, /<video/);
  assert.match(html, /<img[^>]*src="icons\/item\.webp"/);
  html = previewWorkspace([{ ...live[0], asset: "", icon: "" }]);
  assert.doesNotMatch(html, /<video/);
  assert.match(html, /an-now-thumb is-generic/);
});

test("an image asset uses an img, not a video", () => {
  const w = activityWorkspace({ playing: [{ ...live[0], asset: "x.png" }] });
  w.w.host.catalog = () => [{ key: "x.png", file: "art/x.png", type: "image" }];
  const html = nowOf(w.w.activityHTML());
  assert.doesNotMatch(html, /<video/);
  assert.match(html, /<img[^>]*src="art\/x\.png"/);
});

test("each token is a small card with its portrait and name; its animations are one-line chips", () => {
  const html = previewWorkspace([withVisual]);
  assert.match(html, /<div class="an-now-grid"><div class="an-now-card"><div class="an-now-card-head"><img class="an-now-token"[^>]*src="tokens\/silva\.webp"[^>]*><b>Valeros<\/b><\/div>/);
  assert.match(html, /<div class="an-now-row an-now-chip" data-tooltip="impact\.001\.orange">/, "the asset name moves to the tooltip");
});

test("the asset name is a tooltip on the chip, not a line of its own", () => {
  const html = previewWorkspace([withVisual]);
  assert.doesNotMatch(html, /an-now-asset/);
});

test("preview fields are escaped", () => {
  const evil = { ...live[0], asset: 'a"><script>x</script>.webm', portrait: 'p"><i onerror=1>', icon: "" };
  const w = activityWorkspace({ playing: [evil] });
  w.w.host.catalog = () => [];
  const html = nowOf(w.w.activityHTML());
  assert.doesNotMatch(html, /<script>|<i onerror/);
});

test("runtime and persistent rows carry their main visual, icon and portrait", async () => {
  const f = runtimeFixture();
  const ward = lasting("mine");
  await f.runtime.play(ward, { source: { ...source, document: { texture: { src: "tokens/v.webp" } } }, targets: [], item: { img: "icons/w.webp" }, automatic: true });
  const [row] = f.runtime.runningAnimations();
  assert.equal(row.asset, "jb2a.impact.001.orange");
  assert.equal(row.portrait, "tokens/v.webp");
  assert.equal(row.icon, "icons/w.webp");
});

test("skips explain themselves in plain words with a fix; filters pick statuses", async () => {
  const { explainEntry, activityShown, catalogPageFor } = await import("../../scripts/ui/activity-explain.mjs");
  const none = explainEntry({ status: "Skipped", detail: "Fireball: no enabled use recipe.", item: "Fireball", reason: "no-recipe", itemType: "spell" });
  assert.equal(none.title, "Fireball");
  assert.match(none.text, /No animation is set for Fireball/);
  assert.deepEqual(none.fix, { label: "Find it in a catalog", catalog: "spell" });
  assert.equal(none.also.action, "new");
  assert.match(explainEntry({ status: "Skipped", item: "Strike", reason: "off" }).text, /Nothing is set to play automatically/);
  assert.equal(explainEntry({ status: "Blocked", detail: "Choose an asset first.", recipe: "Bolt" }).text, "Choose an asset first.", "unknown reasons keep the logged detail");
  assert.equal(activityShown({ status: "Skipped" }, "played"), false);
  assert.equal(activityShown({ status: "Previewed" }, "played"), true);
  assert.equal(activityShown({ status: "Blocked" }, "all"), true);
  const pages = [["spells", "", "Spells"], ["weapons", "", "Weapons"], ["feats", "", "Feats"]];
  assert.equal(catalogPageFor("spell", pages), "spells");
  assert.equal(catalogPageFor("melee", pages), "weapons");
  assert.equal(catalogPageFor("unknown", pages), "spells", "falls back to the first catalog");
});

test("skip reasons travel with the log entry", async () => {
  const { activityEntryMeta } = await import("../../scripts/ui/activity-actions.mjs");
  assert.deepEqual(activityEntryMeta(null, { item: "Fireball", reason: "no-recipe", itemType: "spell" }), { item: "Fireball", reason: "no-recipe", itemType: "spell" });
});

test("Now playing groups by token, not by name, busiest-recent first, scene last", async () => {
  const { groupNowPlaying, previewFields } = await import("../../scripts/ui/activity-actions.mjs");
  const rows = [
    { id: "a", name: "Burning", on: "Logger", tokenId: "t1", startedAt: 10 },
    { id: "b", name: "Bless", on: "Logger", tokenId: "t2", startedAt: 30 },
    { id: "c", name: "Frightened", on: "Logger", tokenId: "t1", startedAt: 20 },
    { id: "d", name: "Fog", startedAt: 40 },
  ];
  const groups = groupNowPlaying(rows);
  assert.deepEqual(groups.map((g) => [g.key, g.rows.map((r) => r.id)]), [["token:t2", ["b"]], ["token:t1", ["a", "c"]], ["scene", ["d"]]]);
  assert.equal(groups[2].name, "Scene");
  assert.equal(previewFields([], { id: "t9", document: { texture: { src: "x.webp" } } }).tokenId, "t9");
});
