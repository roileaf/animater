import test from "node:test";
import assert from "node:assert/strict";
import { planTint, tintLevel, tintLength, tintAlpha, tintTagOf, createScreenTint, canTint, TINTS, MAX_ALPHA } from "../../../scripts/engines/camera/screen-tint.mjs";

const tiers = new Map([["cast", 1], ["bolt", 0], ["hit", 0], ["area", 0]]);
const opts = (extra = {}) => ({ tiers, gridPx: 100, pointOf: () => ({ x: 500, y: 500 }), radiusOf: (s) => s.radius ?? 50, ...extra });
const bolt = [{ stageId: "cast", kind: "cast", delay: 0 }, { stageId: "bolt", kind: "projectile", delay: 300, duration: 500 }, { stageId: "hit", kind: "impact", delay: 700, contact: 120 }];

test("an elemental hit tints once, in its element's colour, as it lands", () => {
  for (const [element, key] of [["fire", "fire"], ["lightning", "electricity"], ["cold", "cold"], ["necrotic", "void"]]) {
    const tags = planTint(bolt, opts({ element }));
    assert.equal(tags.size, 1, element);
    assert.equal([...tags.values()][0].color, TINTS[key].color, element);
  }
  const [[anchor, tag]] = planTint(bolt, opts({ element: "fire" }));
  assert.equal(anchor.stageId, "bolt", "the bolt arrives before the hit's contact");
  assert.equal(tag.startMs, 400, "at its arrival, from its own start");
  assert.equal(planTint(bolt, opts({ element: "electricity" })).values().next().value.flicker, true, "lightning strobes");
  assert.equal(planTint(bolt, opts({ element: "void" })).values().next().value.blend, "multiply", "void dims");
});

test("no tint for Strikes, harmless plays, physical or unknown elements, or lasting layers", () => {
  assert.equal(planTint(bolt, opts({ element: "fire", strike: true })).size, 0);
  assert.equal(planTint(bolt, opts({ element: "fire", harmful: false })).size, 0);
  assert.equal(planTint(bolt, opts({ element: "slashing" })).size, 0);
  assert.equal(planTint(bolt, opts({})).size, 0);
  assert.equal(planTint([{ stageId: "area", kind: "template", persist: true, delay: 0 }], opts({ element: "fire" })).size, 0);
});

test("a chain blinks again, softer, on each leap; the first strike keeps its strobe", () => {
  const leap = (delay) => ({ stageId: "bolt", kind: "travel", delay, travelOrigin: "previousTarget" });
  const chain = [leap(600), leap(860), leap(1120)];
  const tags = [...planTint(chain, opts({ element: "electricity" })).entries()];
  assert.equal(tags.length, 3, "the first strike and two leaps");
  assert.ok(tags[0][1].flicker && !tags[0][1].blink);
  assert.ok(tags.slice(1).every(([, t]) => t.blink && t.strength < tags[0][1].strength));
  assert.equal(planTint(bolt, opts({ element: "electricity" })).size, 1, "a plain bolt is one tint");
  const blink = { startMs: 0, strength: 1, blink: true };
  assert.equal(tintLevel(blink, 80), 1);
  assert.equal(tintLevel(blink, tintLength(blink) + 1), 0);
  assert.ok(tintLength(blink) < 600, "a quick flash");
});

test("bigger areas and critical hits tint harder", () => {
  const area = (radius) => planTint([{ stageId: "area", kind: "template", delay: 0, radius }], opts({ element: "fire" })).values().next().value.strength;
  assert.ok(area(400) > area(100), "a 20-foot burst over a 5-foot one");
  const single = planTint(bolt, opts({ element: "fire" })).values().next().value.strength;
  assert.ok(planTint(bolt, opts({ element: "fire", critical: true })).values().next().value.strength > single);
});

test("the wash swells and fades; lightning strobes three times, or flashes once when calm", () => {
  const swell = { startMs: 100, strength: 1 };
  assert.equal(tintLevel(swell, 50), 0, "nothing before it lands");
  assert.equal(tintLevel(swell, 250), 1, "full at its peak");
  assert.ok(tintLevel(swell, 500) < 1 && tintLevel(swell, 500) > 0, "fading");
  assert.equal(tintLevel(swell, tintLength(swell) + 1), 0, "gone after it ends");
  const strobe = { startMs: 0, strength: 1, flicker: true };
  const flashes = [50, 230, 420].map((t) => tintLevel(strobe, t)), gaps = [150, 310].map((t) => tintLevel(strobe, t));
  assert.ok(Math.min(...flashes) >= Math.max(...gaps) * 2, "bright flashes over a glow");
  assert.ok(Math.min(...gaps) > 0.3, "the screen stays lit between flashes");
  assert.equal(tintLevel(strobe, 90, { calm: true }), 1, "reduced motion: one steady flash, no dark gap");
});

test("a blast far off screen tints less; strength and the cap apply", () => {
  const view = { x: 0, y: 0, w: 1000, h: 800 };
  assert.equal(tintAlpha({ strength: 1, at: { x: 500, y: 400 } }, { view }), MAX_ALPHA);
  assert.ok(tintAlpha({ strength: 1, at: { x: 1600, y: 400 } }, { view }) < MAX_ALPHA / 2);
  assert.equal(tintAlpha({ strength: 1, at: { x: 5000, y: 400 } }, { view }), 0);
  assert.ok(tintAlpha({ strength: 1 }, { view, strength: 2 }) > MAX_ALPHA);
  assert.equal(tintTagOf({ animaterTint: { color: "red", strength: 1 } }), null, "only hex colours");
  assert.ok(canTint("low", true) && !canTint("off", true) && !canTint("full", false));
});

test("the host draws on its scene and setting only, fades the element out and cleans up", () => {
  let t = 0, on = true;
  const made = [];
  const mount = () => { const el = { style: {}, removed: false, remove() { this.removed = true; } }; made.push(el); return el; };
  const host = createScreenTint({ mount, view: () => ({ x: 0, y: 0, w: 1000, h: 800 }), screenPoint: () => ({ x: 50, y: 50 }), now: () => t, enabled: () => on, sceneId: () => "s" });
  const effect = (scene = "s") => ({ data: { moduleName: "animater", sceneId: scene, animaterTint: { color: "#ff6a1f", strength: 1, startMs: 0, at: { x: 500, y: 400 } } } });
  host.onEffect(effect("other"));
  assert.equal(made.length, 0, "another scene's blast");
  host.onEffect(effect());
  assert.equal(made.length, 1);
  assert.match(made[0].style.background, /radial-gradient\(circle at 50% 50%/);
  t = 120; host.tick();
  assert.ok(Number(made[0].style.opacity) > 0.2);
  t = 5000; host.tick();
  assert.ok(made[0].removed && host.size === 0, "removed when done");
  for (let i = 0; i < 4; i++) host.onEffect(effect());
  assert.equal(host.size, 2, "at most two washes at once");
  host.clear();
  const strike = effect(), leap = () => ({ data: { ...effect().data, animaterTint: { ...effect().data.animaterTint, blink: true } } });
  host.onEffect(strike);
  const strikeEl = made.at(-1);
  for (let i = 0; i < 3; i++) host.onEffect(leap());
  assert.equal(host.size, 2);
  assert.equal(strikeEl.removed, false, "the leaps give way to each other, never to the first strike");
  assert.equal(made.at(-2).removed, true, "the older leap went");
  on = false; host.tick();
  assert.equal(host.size, 0, "turning it off clears the screen");
});
