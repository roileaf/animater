import test from "node:test";
import assert from "node:assert/strict";
import { ARRIVALS, ARRIVAL_MS, arrivalHere, arrivalAt, arrivalWords, hourWord, arrivalShake, arrivalFlash } from "../../../scripts/engines/motion/scene-arrival.mjs";

const BEATS = ["settle", "sweep", "dawn", "tremor", "storm", "wide"];

test("every scene is its GM's to decide, and none of them does this unasked", () => {
  // A beat that suits a reveal is tiresome on the corridor they cross four times a session, so a scene says for
  // itself and says nothing by default.
  assert.equal(arrivalHere(undefined, undefined), "off");
  assert.equal(arrivalHere(undefined, "settle"), "settle", "the GM's own default, where a scene has not spoken");
  assert.equal(arrivalHere("sweep", "settle"), "sweep", "the scene's own choice beats it");
  assert.equal(arrivalHere("off", "sweep"), "off", "and a scene may refuse one the module would have given it");
  assert.equal(arrivalHere("", "dawn"), "dawn", "nothing chosen is not a choice");
  assert.equal(arrivalHere("nonsense", "settle"), "settle", "a beat that no longer exists falls back");
  assert.equal(arrivalHere("nonsense", "nonsense"), "off");
  assert.deepEqual(Object.keys(ARRIVALS), ["off", ...BEATS]);
});

test("a beat begins hidden and ends with the map exactly as it always was", () => {
  for (const beat of BEATS) {
    const start = arrivalAt(beat, 0), end = arrivalAt(beat, 1);
    assert.ok(start.veil > 0.9, `${beat} opens covered`);
    assert.equal(end.veil, 0, `${beat} ends with nothing over the map`);
    assert.equal(end.zoom, 1, `${beat} ends at the map's true size`);
    assert.equal(end.dx, 0); assert.equal(end.dy, 0);
    assert.equal(end.blur, 0);
    assert.equal(end.light, 1, `${beat} ends at the scene's own light`);
    assert.ok(ARRIVAL_MS[beat] >= 2000 && ARRIVAL_MS[beat] <= 4000, `${beat} is over in a few seconds`);
  }
  // Off is not a beat at all: asked for a frame of it, it gives the resting map.
  assert.deepEqual(arrivalAt("off", 0), arrivalAt("off", 1));
  assert.equal(arrivalAt("off", 0).veil, 0);
});

test("the dark lifts first and the map keeps easing after it", () => {
  const early = arrivalAt("settle", 0.05), late = arrivalAt("settle", 0.75);
  assert.ok(early.veil > late.veil);
  assert.equal(late.veil, 0, "the black is long gone by three quarters through");
  assert.equal(arrivalAt("settle", 0.3).veil, 0, "and gone well before the camera has settled");
  assert.ok(late.zoom < early.zoom, "while the camera is still settling");
  assert.ok(early.zoom > 1 && late.zoom > 1);
});

test("each beat moves in its own way", () => {
  // Sweep comes in from one side; the others hold still and only breathe.
  assert.notEqual(arrivalAt("sweep", 0).dx, 0);
  assert.equal(arrivalAt("settle", 0).dx, 0);
  assert.equal(arrivalAt("dawn", 0).dx, 0);
  // Dawn is the one that is dark rather than close: its light comes up from almost nothing.
  assert.ok(arrivalAt("dawn", 0.3).light < arrivalAt("settle", 0.3).light);
  assert.ok(arrivalAt("sweep", 0.1).zoom > arrivalAt("settle", 0.1).zoom, "sweep starts in closer");
});

test("the ground shakes on the beat that is about shaking, and on no other", () => {
  for (const quiet of ["off", "settle", "sweep", "dawn", "wide"]) {
    assert.deepEqual(arrivalShake(quiet, 0.1), { x: 0, y: 0, left: 0 }, quiet);
  }
  const hard = arrivalShake("tremor", 0.02), later = arrivalShake("tremor", 0.5);
  assert.ok(hard.left > later.left, "it dies away");
  assert.ok(Math.abs(hard.x) > 0 || Math.abs(hard.y) > 0);
  // It must be gone before the end, not cut off at it: a tremor that stops on a frame reads as a glitch.
  assert.equal(arrivalShake("tremor", 0.8).left, 0);
  assert.deepEqual(arrivalShake("tremor", 1), { x: 0, y: 0, left: 0 });
  // Never flung further than the view can take: this is a shudder, not a throw.
  for (let i = 0; i <= 100; i++) {
    const s = arrivalShake("tremor", i / 100);
    assert.ok(Math.abs(s.x) <= 1 && Math.abs(s.y) <= 1, `within a square at ${i}`);
  }
  assert.ok(arrivalShake("storm", 0.05).left > 0, "a storm shakes a little too");
  assert.ok(arrivalShake("storm", 0.05).left < arrivalShake("tremor", 0.05).left);
});

test("only the storm throws lightning, and it is over early", () => {
  for (const dark of ["off", "settle", "sweep", "dawn", "tremor", "wide"]) assert.equal(arrivalFlash(dark, 0.06), 0, dark);
  const strike = arrivalFlash("storm", 0.06);
  assert.ok(strike > 0.9, "the first strike is the bright one");
  assert.ok(arrivalFlash("storm", 0.26) > 0 && arrivalFlash("storm", 0.26) < strike, "the second is weaker");
  assert.equal(arrivalFlash("storm", 0.16), 0, "and there is dark between them");
  assert.equal(arrivalFlash("storm", 0.6), 0, "nothing is still flashing while the card is up");
  assert.equal(arrivalFlash("storm", 1), 0);
  for (let i = 0; i <= 100; i++) assert.ok(arrivalFlash("storm", i / 100) <= 1);
});

test("wide is the one that starts back from the map rather than in it", () => {
  assert.ok(arrivalAt("wide", 0).zoom < 1, "the map starts smaller and is pushed in on");
  assert.ok(arrivalAt("sweep", 0).zoom > 1);
  assert.equal(arrivalAt("wide", 1).zoom, 1, "and still ends at its true size");
});

test("a frame asked for out of its time is still a sane frame", () => {
  assert.deepEqual(arrivalAt("settle", -3), arrivalAt("settle", 0));
  assert.deepEqual(arrivalAt("settle", 9), arrivalAt("settle", 1));
});

test("the hour is said the way a person would say it", () => {
  const clock = { sunrise: 0.25, sunset: 0.78 };
  assert.equal(hourWord(0.02, clock), "Deep night");
  assert.equal(hourWord(0.25, clock), "Dawn");
  assert.equal(hourWord(0.36, clock), "Morning");
  assert.equal(hourWord(0.5, clock), "Midday");
  assert.equal(hourWord(0.65, clock), "Afternoon");
  assert.equal(hourWord(0.78, clock), "Dusk");
  assert.equal(hourWord(0.9, clock), "Night");
  assert.equal(hourWord(null, clock), "", "no clock, no claim about the hour");
});

test("the card says what the module already knows, and never invents", () => {
  const clock = { sunrise: 0.25, sunset: 0.78 };
  assert.deepEqual(arrivalWords({ name: "The Bokken Wood", day: 0.65, clock, weather: "light rain" }),
    { name: "The Bokken Wood", under: "Afternoon · light rain" });
  // No weather, no clock: the place still has a name, and the line below it simply goes.
  assert.deepEqual(arrivalWords({ name: "Oleg's Trading Post" }), { name: "Oleg's Trading Post", under: "" });
  assert.deepEqual(arrivalWords({ name: "A Cave", day: 0.5, clock }), { name: "A Cave", under: "Midday" });
  assert.deepEqual(arrivalWords({ name: "A Cave", weather: "snow" }), { name: "A Cave", under: "snow" });
  // The GM's own line is theirs, whatever the hour is doing.
  assert.deepEqual(arrivalWords({ name: "The Old Beldame", day: 0.1, clock, weather: "rain", own: "Three days of rain" }),
    { name: "The Old Beldame", under: "Three days of rain" });
  assert.equal(arrivalWords({}).name, "");
});
