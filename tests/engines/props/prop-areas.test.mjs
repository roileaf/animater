import test from "node:test";
import assert from "node:assert/strict";
import { areaRefusal, areaCauseRefusal, AREA_TTL_MS } from "../../../scripts/engines/props/prop-areas.mjs";
import { AREA_TTL_MS as WAIT_TTL } from "../../../scripts/engines/props/prop-triggers.mjs";

// A 2-square burst around (500, 500), placed by the player at t = 1000 on the ground level.
const circle = (c, r) => (p) => Math.hypot(p.x - c.x, p.y - c.y) <= r;
const area = (x = {}) => ({ uuid: "Scene.s.Region.r", sceneId: "s", authorId: "p", authorIsGM: false, ownsOrigin: false, rememberedAt: 1000, damageTypes: ["fire"],
  testPoint: circle({ x: 500, y: 500 }, 200), levels: ["ground"], ...x });
const player = { id: "p", isGM: false };
const ask = (x = {}) => ({ cause: { kind: "area", damageType: "fire", areaUuid: "Scene.s.Region.r" }, sceneId: "s", sender: player, point: { x: 550, y: 520 }, levels: ["ground"], now: 5000, ...x });

test("the area wait's ttl is the area check's", () => {
  assert.equal(AREA_TTL_MS, 600000);
  assert.equal(WAIT_TTL, AREA_TTL_MS);
});

test("an area its sender placed, still fresh, holding the target on its level, lets the cause through", () => {
  assert.equal(areaRefusal(area(), ask()), null);
  // a target on no level, or an area on all of them, is on every level
  assert.equal(areaRefusal(area({ levels: [] }), ask({ levels: ["upstairs"] })), null);
  assert.equal(areaRefusal(area(), ask({ levels: [] })), null);
});

test("missing, foreign, expired or outside areas are refused as area", () => {
  assert.equal(areaRefusal(undefined, ask()), "area"); // never placed (or deleted, or before this GM loaded)
  assert.equal(areaRefusal(area(), ask({ cause: { kind: "area" } })), "area"); // names no area
  assert.equal(areaRefusal(area(), ask({ cause: { kind: "area", areaUuid: "Scene.s.Region.other" } })), "area");
  assert.equal(areaRefusal(area({ sceneId: "elsewhere" }), ask()), "area"); // an area on another scene
  assert.equal(areaRefusal(area({ sceneId: null }), ask()), "area"); // its document is gone
  assert.equal(areaRefusal(area({ authorId: "someone" }), ask()), "area"); // another player's area
  assert.equal(areaRefusal(area(), ask({ now: 1000 + AREA_TTL_MS + 1 })), "area"); // expired
  assert.equal(areaRefusal(area(), ask({ now: 500 })), "area"); // from the future
  assert.equal(areaRefusal(area({ rememberedAt: undefined }), ask()), "area");
  assert.equal(areaRefusal(area(), ask({ point: { x: 900, y: 500 } })), "area"); // the target lies outside it
  assert.equal(areaRefusal(area(), ask({ point: null })), "area");
  assert.equal(areaRefusal(area({ testPoint: undefined }), ask()), "area");
  assert.equal(areaRefusal(area({ testPoint: () => { throw new Error("torn down"); } }), ask()), "area");
  assert.equal(areaRefusal(area(), ask({ levels: ["upstairs"] })), "area"); // the target is on another level
});

test("who may name an area: its author, anyone when a GM placed it, a GM sender, or the owner of the actor that placed it", () => {
  const theirs = area({ authorId: "q" });
  assert.equal(areaRefusal(theirs, ask()), "area");
  assert.equal(areaRefusal({ ...theirs, authorIsGM: true }, ask()), null);
  assert.equal(areaRefusal(theirs, ask({ sender: { id: "gm", isGM: true } })), null);
  assert.equal(areaRefusal({ ...theirs, ownsOrigin: true }, ask()), null);
  assert.equal(areaRefusal(area({ authorId: null }), ask({ sender: { id: undefined } })), "area");
});

test("the area's age is up to and including the ttl", () => {
  assert.equal(areaRefusal(area(), ask({ now: 1000 + AREA_TTL_MS })), null);
  assert.equal(areaRefusal(area(), ask({ now: 2000, ttl: 500 })), "area");
});

test("a cause's area check: the area it names, or for the GM's own call naming none, its centre's old reach", () => {
  const named = { kind: "area", damageType: "fire", areaUuid: "Scene.s.Region.r", at: { x: 500, y: 500 } };
  assert.equal(areaCauseRefusal(named, { x: 550, y: 520 }, ["ground"], { area: area(), sceneId: "s", sender: player, now: 5000 }), null);
  assert.equal(areaCauseRefusal(named, { x: 950, y: 520 }, ["ground"], { area: area(), sceneId: "s", sender: player, now: 5000 }), "area");
  // a player naming none, with any at, is refused
  assert.equal(areaCauseRefusal({ kind: "area", at: { x: 550, y: 520 } }, { x: 550, y: 520 }, [], { area: area(), sceneId: "s", sender: player, now: 5000 }), "area");
  // the GM's own call naming none (the debug and live-check break) keeps the 30-square reach from its at
  const gm = { id: "gm", isGM: true };
  assert.equal(areaCauseRefusal({ kind: "area", at: { x: 550, y: 520 } }, { x: 550, y: 520 }, [], { sceneId: "s", sender: gm, now: 5000, grid: 100 }), null);
  assert.equal(areaCauseRefusal({ kind: "area", at: { x: 550 + 3100, y: 520 } }, { x: 550, y: 520 }, [], { sceneId: "s", sender: gm, now: 5000, grid: 100 }), "far");
  assert.equal(areaCauseRefusal({ kind: "area" }, { x: 550, y: 520 }, [], { sceneId: "s", sender: gm, now: 5000, grid: 100 }), "far");
  // a GM naming an area is checked like anyone
  assert.equal(areaCauseRefusal(named, { x: 550, y: 520 }, [], { area: undefined, sceneId: "s", sender: gm, now: 5000 }), "area");
});
