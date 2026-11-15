import test from "node:test";
import assert from "node:assert/strict";
import { iceWord, iceWords, ICE_WORDS } from "../../../scripts/engines/regions/ice-break-word.mjs";

test("a cracked square says CRACK! in the middle of itself", () => {
  const w = iceWord("3,4", "crack", { grid: 100 });
  assert.equal(w.text, "CRACK!");
  assert.deepEqual(w.at, { x: 350, y: 450 });
  assert.ok(w.duration > 0 && w.distance > 0, "it rises and it goes away again");
});

test("going through says something else, and says it bigger", () => {
  const crack = iceWord("3,4", "crack", { grid: 100 }), broke = iceWord("3,4", "broke", { grid: 100 });
  assert.equal(broke.text, ICE_WORDS.broke);
  assert.notEqual(broke.text, crack.text);
  assert.ok(broke.fontSize > crack.fontSize, "falling in is the louder of the two");
  assert.ok(broke.duration > crack.duration, "and it stays up longer");
});

test("it is sized to the map, not to one map's squares", () => {
  const small = iceWord("0,0", "crack", { grid: 70 }), big = iceWord("0,0", "crack", { grid: 200 });
  assert.ok(big.fontSize > small.fontSize);
  assert.ok(big.distance > small.distance);
  assert.ok(small.fontSize >= 12, "never too small to read");
});

test("a square that cracked and then gave way in the same move says only that it gave way", () => {
  const words = iceWords({ cracked: ["1,1", "2,2"], broke: ["2,2"] }, { grid: 100 });
  assert.deepEqual(words.map((w) => w.text), [ICE_WORDS.broke, ICE_WORDS.crack]);
  assert.deepEqual(words.map((w) => w.at), [{ x: 250, y: 250 }, { x: 150, y: 150 }]);
});

test("a creature that cracks half a lake does not paper it over", () => {
  const many = Array.from({ length: 30 }, (_, i) => `${i},0`);
  assert.equal(iceWords({ cracked: many }, { grid: 100 }).length, 8);
  assert.equal(iceWords({ cracked: many }, { grid: 100, cap: 3 }).length, 3);
});

test("nothing to say says nothing", () => {
  assert.deepEqual(iceWords({}, { grid: 100 }), []);
  assert.deepEqual(iceWords({ cracked: [], broke: [] }, { grid: 100 }), []);
});

test("junk gives nothing rather than an error", () => {
  for (const key of ["junk", "", "3,", null, undefined, 7, {}]) assert.equal(iceWord(key, "crack", { grid: 100 }), null);
  assert.equal(iceWord("3,4", "melt", { grid: 100 }), null, "a hole the fire ate is not someone falling in");
  for (const grid of [0, -5, NaN, undefined, "wide"]) assert.equal(iceWord("3,4", "crack", { grid }), null);
  assert.deepEqual(iceWords({ cracked: ["junk", "3,4"], broke: null }, { grid: 100 }).map((w) => w.text), ["CRACK!"]);
  assert.deepEqual(iceWords(null, { grid: 100 }), []);
});

test("both words are outlined, because they land on pale ice", () => {
  for (const kind of ["crack", "broke"]) {
    const w = iceWord("0,0", kind, { grid: 100 });
    assert.match(w.fill, /^#[0-9a-f]{6}$/i);
    assert.match(w.stroke, /^#[0-9a-f]{6}$/i);
    assert.notEqual(w.fill.toLowerCase(), w.stroke.toLowerCase());
  }
});
