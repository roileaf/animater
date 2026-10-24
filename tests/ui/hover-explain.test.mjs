import test from "node:test";
import assert from "node:assert/strict";
import { originLabel, tokenRows, hoverView, hoverHTML, canExplain, tooltipPoint, createHoverExplain, hoverExplainDefault } from "../../scripts/ui/hover-explain.mjs";

const catalog = { type: "catalog", system: "pf2e", kind: "spell", id: "fireball" };
const recipe = { type: "recipe", id: "r1" };
const users = { u1: { name: "Ann", isGM: false }, u2: { name: "Bo", isGM: false }, gm: { name: "Gamemaster", isGM: true } };
const userName = (id) => users[id]?.name ?? "";
const userIsGM = (id) => users[id]?.isGM === true;

// --- Where an animation comes from ------------------------------------------------------
test("origin labels: catalog, your recipe, a player's recipe, the GM's recipe", () => {
  const me = { userId: "u1", isGM: false, userName, userIsGM };
  assert.equal(originLabel({ origin: catalog }, me), "Catalog");
  assert.equal(originLabel({ origin: recipe, by: "u1" }, me), "Your recipe");
  assert.equal(originLabel({ origin: recipe, by: "u2" }, me), "Bo’s recipe");
  assert.equal(originLabel({ origin: recipe, by: "zz" }, me), "A player’s recipe");
  assert.equal(originLabel({ origin: recipe, by: "gm" }, me), "The GM’s recipe");
  // Lasting condition layers are the world's (GM-made) recipes.
  assert.equal(originLabel({ origin: recipe, by: "world" }, me), "The GM’s recipe");
  assert.equal(originLabel({ origin: recipe, by: "world" }, { ...me, userId: "gm", isGM: true }), "Your recipe");
  assert.equal(originLabel({ origin: null }, me), "");
  assert.equal(originLabel({ origin: { type: "junk" } }, me), "");
});

// --- What plays on one token -----------------------------------------------------------
test("token rows gather this token's lasting plays, states and live effects, without repeats", () => {
  const sessions = [
    { session: "s1", name: "Wall of Fire", origin: recipe, tokenId: "T1", startedAt: 10 },
    { session: "s9", name: "Elsewhere", tokenId: "T2", startedAt: 30 },
  ];
  const states = [{ key: "k1", name: "Frightened", origin: catalog, tokenId: "T1", startedAt: 20 }];
  const effects = [
    // The same session as s1, already listed from the runtime.
    { data: { moduleName: "animater", name: "s1", source: "Scene.A.Token.T1", animaterRecipe: { name: "Wall of Fire", by: "u1" }, animaterLasting: true } },
    // A one-time hit started on another client, landing on this token.
    { data: { moduleName: "animater", name: "s2", target: "Scene.A.Token.T1", animaterRecipe: { name: "Strike", origin: catalog, by: "gm" }, animaterLasting: false, creationTimestamp: 40 } },
    // Two layers of one play: one row.
    { data: { moduleName: "animater", name: "s3", source: "Scene.A.Token.T1", animaterRecipe: { name: "Bless", by: "u2" }, animaterLasting: true, creationTimestamp: 5 } },
    { data: { moduleName: "animater", name: "s3", source: "Scene.A.Token.T1", animaterRecipe: { name: "Bless", by: "u2" }, animaterLasting: true, creationTimestamp: 5 } },
    // Not ours, a preview, untagged, another token: left out.
    { data: { moduleName: "other", name: "x", source: "Scene.A.Token.T1", animaterRecipe: { name: "X" } } },
    { data: { moduleName: "animater", name: "p", source: "Scene.A.Token.T1", animaterRecipe: { name: "P" }, animaterPreview: true } },
    { data: { moduleName: "animater", name: "u", source: "Scene.A.Token.T1" } },
    { data: { moduleName: "animater", name: "o", source: "Scene.A.Token.T2", animaterRecipe: { name: "O" } } },
  ];
  const rows = tokenRows({ sessions, states, effects, tokenId: "T1", tokenUuid: "Scene.A.Token.T1", userId: "u1" });
  assert.deepEqual(rows.map((r) => [r.name, r.lasting, r.by ?? null]), [
    ["Strike", false, "gm"],
    ["Frightened", true, "world"],
    ["Wall of Fire", true, "u1"],
    ["Bless", true, "u2"],
  ]);
  assert.deepEqual(tokenRows({ sessions, states, effects: [], tokenId: "T3", tokenUuid: "Scene.A.Token.T3", userId: "u1" }), []);
});

test("token rows survive bad Sequencer data", () => {
  const rows = tokenRows({ effects: [null, {}, { data: null }, { data: { moduleName: "animater", animaterRecipe: { name: "Ok" }, source: "U" } }], tokenId: "T", tokenUuid: "U", userId: "u1" });
  assert.deepEqual(rows.map((r) => r.name), ["Ok"]);
});

// --- Display lines ---------------------------------------------------------------------
test("hover view: one line per animation, repeats merged, lasting marked", () => {
  const view = hoverView([
    { name: "Bless", origin: recipe, by: "u1", lasting: true },
    { name: "Bless", origin: recipe, by: "u1", lasting: true },
    { name: "Strike", origin: catalog, lasting: false },
  ], { userId: "u1", isGM: false, userName, userIsGM });
  assert.deepEqual(view, {
    lines: [
      { name: "Bless", from: "Your recipe", lasting: true, count: 2 },
      { name: "Strike", from: "Catalog", lasting: false, count: 1 },
    ],
    more: 0,
  });
});

test("hover view: at most six lines, then how many more", () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ name: `Anim ${i}`, origin: catalog }));
  const view = hoverView(rows, { userId: "u1" });
  assert.equal(view.lines.length, 6);
  assert.equal(view.more, 3);
  assert.equal(hoverView([], {}).lines.length, 0);
  assert.equal(hoverView(null, {}).lines.length, 0);
});

test("hover HTML lists names, origins and the lasting mark, escaped; empty when nothing plays", () => {
  const html = hoverHTML({ lines: [{ name: "<b>Bless</b>", from: "Your recipe", lasting: true, count: 2 }, { name: "Strike", from: "", lasting: false, count: 1 }], more: 2 });
  assert.match(html, /&lt;b&gt;Bless&lt;\/b&gt;/);
  assert.match(html, /×2/);
  assert.match(html, /Your recipe/);
  assert.match(html, /Lasting/);
  assert.match(html, /and 2 more/);
  assert.equal((html.match(/Lasting/g) ?? []).length, 1);
  assert.equal(hoverHTML({ lines: [], more: 0 }), "");
});

// --- Who may see it --------------------------------------------------------------------
test("the GM sees every token; a player only tokens they own or can see", () => {
  const hidden = { visible: true, document: { hidden: true } };
  assert.equal(canExplain(hidden, { isGM: true }), true);
  assert.equal(canExplain(hidden, { isGM: false }), false);
  assert.equal(canExplain({ ...hidden, isOwner: true }, { isGM: false }), true);
  assert.equal(canExplain({ visible: false, document: {} }, { isGM: false }), false);
  assert.equal(canExplain({ visible: true, document: { hidden: false } }, { isGM: false }), true);
  assert.equal(canExplain({ destroyed: true, visible: true, document: {} }, { isGM: true }), false);
  assert.equal(canExplain(null, { isGM: true }), false);
});

test("the default is on for GMs, off for players, read from the world's user data at init", () => {
  assert.equal(hoverExplainDefault({ userId: "a", data: { users: [{ _id: "a", role: 4 }] } }), true);
  assert.equal(hoverExplainDefault({ userId: "a", data: { users: [{ _id: "a", role: 3 }] } }), true);
  assert.equal(hoverExplainDefault({ userId: "a", data: { users: [{ _id: "a", role: 1 }] } }), false);
  assert.equal(hoverExplainDefault({ user: { isGM: true } }), true);
  assert.equal(hoverExplainDefault({}), false);
});

test("the tooltip sits at the token's top-right corner on screen", () => {
  const point = tooltipPoint({ x: 100, y: 50, w: 200, h: 100 }, ({ x, y }) => ({ x: x / 2 + 10, y: y / 2 + 20 }));
  assert.deepEqual(point, { x: 160, y: 45 });
  assert.equal(tooltipPoint({ x: 0, y: 0, w: 1 }, () => null), null);
  assert.equal(tooltipPoint(null, (p) => p), null);
});

// --- The tooltip itself ----------------------------------------------------------------
function fakeDocument() {
  const made = [];
  const doc = {
    made,
    body: { children: [], append(el) { this.children.push(el); el.parentNode = this; } },
    createElement(tag) {
      const el = { tag, className: "", innerHTML: "", hidden: true, style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, remove() { const c = this.parentNode?.children; if (c) c.splice(c.indexOf(this), 1); this.parentNode = null; } };
      made.push(el);
      return el;
    },
  };
  return doc;
}
function fakeTimers() {
  const timers = new Map(); let id = 0;
  return { timers, setInterval: (fn) => { timers.set(++id, fn); return id; }, clearInterval: (i) => timers.delete(i), tick() { for (const fn of [...timers.values()]) fn(); } };
}

test("hovering a token with something playing shows the tooltip; unhovering hides it", () => {
  const document = fakeDocument(), t = fakeTimers();
  let rows = [{ name: "Bless", origin: catalog, lasting: true }];
  const token = { id: "T1", x: 0, y: 0, w: 100, h: 100, visible: true, document: {} };
  const hover = createHoverExplain({ document, enabled: () => true, isGM: () => false, rowsFor: () => rows, view: (r) => hoverView(r, {}), toScreen: (p) => p, setInterval: t.setInterval, clearInterval: t.clearInterval });
  hover.hover(token, true);
  const el = document.body.children[0];
  assert.equal(el.className, "animater-hover-explain");
  assert.equal(el.hidden, false);
  assert.match(el.innerHTML, /Bless/);
  assert.equal(el.style.left, "100px");
  assert.equal(el.style.top, "0px");
  // Updates while hovered: the play ends, the tooltip goes.
  rows = [];
  t.tick();
  assert.equal(el.hidden, true);
  rows = [{ name: "Haste", origin: catalog }];
  t.tick();
  assert.equal(el.hidden, false);
  assert.match(el.innerHTML, /Haste/);
  hover.hover(token, false);
  assert.equal(el.hidden, true);
  assert.equal(t.timers.size, 0);
});

test("nothing playing, the setting off, or a token the player cannot see: no tooltip", () => {
  const document = fakeDocument(), t = fakeTimers();
  let on = true;
  const hover = createHoverExplain({ document, enabled: () => on, isGM: () => false, rowsFor: () => [], view: (r) => hoverView(r, {}), toScreen: (p) => p, setInterval: t.setInterval, clearInterval: t.clearInterval });
  hover.hover({ id: "T1", x: 0, y: 0, w: 1, visible: true, document: {} }, true);
  assert.ok(!document.body.children.length || document.body.children[0].hidden);
  const playing = createHoverExplain({ document, enabled: () => on, isGM: () => false, rowsFor: () => [{ name: "A" }], view: (r) => hoverView(r, {}), toScreen: (p) => p, setInterval: t.setInterval, clearInterval: t.clearInterval });
  playing.hover({ id: "T2", x: 0, y: 0, w: 1, visible: true, document: { hidden: true } }, true);
  assert.ok(document.body.children.every((el) => el.hidden));
  on = false;
  playing.hover({ id: "T3", x: 0, y: 0, w: 1, visible: true, document: {} }, true);
  assert.ok(document.body.children.every((el) => el.hidden));
});

test("hide() and a throwing data source never break the canvas", () => {
  const document = fakeDocument(), t = fakeTimers();
  let boom = false;
  const hover = createHoverExplain({ document, enabled: () => true, isGM: () => true, rowsFor: () => { if (boom) throw Error("x"); return [{ name: "A" }]; }, view: (r) => hoverView(r, {}), toScreen: (p) => p, setInterval: t.setInterval, clearInterval: t.clearInterval });
  const token = { id: "T1", x: 0, y: 0, w: 1, visible: true, document: {} };
  hover.hover(token, true);
  boom = true;
  assert.doesNotThrow(() => t.tick());
  assert.equal(document.body.children[0].hidden, true);
  boom = false;
  hover.refresh();
  hover.hide();
  assert.equal(document.body.children[0].hidden, true);
  assert.equal(t.timers.size, 0);
  // Unhovering another token leaves this one alone; destroy removes the element.
  hover.hover(token, true);
  hover.hover({ id: "T9" }, false);
  assert.equal(document.body.children[0].hidden, false);
  hover.destroy();
  assert.equal(document.body.children.length, 0);
});
