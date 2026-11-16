import test from "node:test";
import assert from "node:assert/strict";
import {
  MOMENTS, WHERES, TETHERS, SWAYS, PRESETS, MOMENT_MOST, MOMENT_RISE_MS, BOARD_REST,
  momentCall, momentOver, momentsLeft, momentAudience, momentReach, screenFrom, momentMacro,
  thingSway, tetherPath, momentNeeds, momentsWithout, momentRunning, momentWheres, momentWorksIn, beatAt, BEAT_MS, BEAT_LOW, momentStyles, momentSound, soundPath, MOMENT_SOUNDS, presetCalls, presetFrom, presetsAll,
} from "../../../scripts/engines/camera/screen-moments.mjs";

const view = { x: 1000, y: 1000, scale: 1, width: 1600, height: 900 };
const now = (call, ms) => call.at + ms;

test("every moment says what it is and where it works", () => {
  for (const [kind, how] of Object.entries(MOMENTS)) {
    assert.ok(how.name && how.hint, kind);
    assert.ok(["board", "layer", "thing", "link", "warp"].includes(how.on), `${kind} says what it takes hold of`);
    if (how.needs) assert.ok(["things", "two"].includes(how.needs), `${kind} says what it wants chosen`);
    assert.ok(how.holds === true || how.ms > 0, `${kind} holds or ends`);
    assert.ok(how.strength > 0 && how.strength <= 1, `${kind} has a strength to start from`);
  }
  // The ones FX Bus has, so nobody has to choose between the two, plus the ones only we can do.
  for (const kind of ["shake", "rumble", "roll", "blur", "grey", "split", "smear", "streak", "pulse", "vignette", "grain"]) {
    assert.ok(Object.hasOwn(MOMENTS, kind), kind);
  }
  for (const ours of ["glow", "shock", "dust"]) assert.ok(Object.hasOwn(MOMENTS, ours), ours);
  assert.deepEqual(Object.keys(WHERES), ["screen", "point", "tokens"]);
});

test("a moment can be the whole screen, a place on the map, or the chosen tokens", () => {
  const screen = momentCall("grey", { at: 0 });
  assert.equal(screen.where, "screen");
  assert.equal(screen.x, null);

  const spot = momentCall("shock", { at: 0, where: "point", x: 1200, y: 800, radius: 400 });
  assert.equal(spot.where, "point");
  assert.deepEqual([spot.x, spot.y, spot.radius], [1200, 800, 400]);

  const tokens = momentCall("glow", { at: 0, where: "tokens", ids: ["a", "b", "a", 7, null, ""] });
  assert.equal(tokens.where, "tokens");
  assert.deepEqual(tokens.ids, ["a", "b"], "each token once, and only ones that could be ids");

  // A place with no place, or tokens with no tokens, is the whole screen rather than nothing at all.
  assert.equal(momentCall("shock", { at: 0, where: "point" }).where, "screen");
  assert.equal(momentCall("glow", { at: 0, where: "tokens", ids: [] }).where, "screen");
  assert.equal(momentCall("grey", { at: 0, where: "nowhere" }).where, "screen");
});

test("a moment at a place is strongest when you are looking at it", () => {
  const near = momentCall("shake", { at: 0, strength: 1, where: "point", x: view.x, y: view.y, radius: 500 });
  const far = momentCall("shake", { at: 0, strength: 1, where: "point", x: view.x + 6000, y: view.y, radius: 500 });
  assert.equal(momentReach(near, view), 1, "over the place itself, all of it");
  assert.ok(momentReach(far, view) < 0.1, "a long way off, almost none");
  assert.ok(momentReach(far, view) >= 0, "and never below nothing");
  // The whole screen is the whole screen wherever you are looking.
  assert.equal(momentReach(momentCall("grey", { at: 0 }), view), 1);
  assert.equal(momentReach(momentCall("grey", { at: 0 }), null), 1, "and with no view to go on, it still shows");

  const nearScreen = screenFrom([near], 50, view).board;
  const farScreen = screenFrom([far], 50, view).board;
  assert.ok(Math.hypot(nearScreen.shakeX, nearScreen.shakeY) > Math.hypot(farScreen.shakeX, farScreen.shakeY));
});

test("the board and the layers are told apart, because only one of them can be put somewhere", () => {
  const out = screenFrom([
    momentCall("grey", { at: 0, strength: 1 }),
    momentCall("glow", { at: 0, strength: 1, where: "point", x: 500, y: 600, radius: 300, colour: "#ffaa33" }),
  ], 4000, view);
  assert.ok(out.board.grey > 0);
  assert.equal(out.layers.length, 1);
  assert.deepEqual([out.layers[0].kind, out.layers[0].x, out.layers[0].y, out.layers[0].radius], ["glow", 500, 600, 300]);
  assert.equal(out.layers[0].colour, "#ffaa33");
  assert.ok(out.layers[0].strength > 0);
  // A layer moment over the whole screen has no place to be drawn at.
  const whole = screenFrom([momentCall("grain", { at: 0, strength: 1 })], 4000, view);
  assert.equal(whole.layers[0].x, null);
  assert.deepEqual(screenFrom([], 0, view).board, BOARD_REST);
});

test("a moment comes up and goes down rather than snapping", () => {
  const call = momentCall("grey", { at: 0, strength: 1, fade: 400 });
  assert.ok(screenFrom([call], 100, view).board.grey < screenFrom([call], 390, view).board.grey);
  assert.equal(screenFrom([call], 4000, view).board.grey, 1, "and holds at what was asked for");

  // One that ends fades out before it does, so nothing ever vanishes on a frame.
  const timed = momentCall("grey", { at: 0, strength: 1, ms: 2000, fade: 400 });
  assert.ok(screenFrom([timed], 1900, view).board.grey < screenFrom([timed], 1000, view).board.grey);
  assert.equal(screenFrom([timed], 2100, view).board.grey, 0);
  // A fade longer than the moment itself still begins and ends at nothing.
  const silly = momentCall("grey", { at: 0, strength: 1, ms: 300, fade: 9000 });
  assert.equal(screenFrom([silly], 0, view).board.grey, 0);
  assert.equal(screenFrom([silly], 320, view).board.grey, 0);
});

test("a GM may say how long, and may say who sees it", () => {
  assert.equal(momentCall("shake", { at: 0, ms: 5000 }).ms, 5000);
  assert.equal(momentCall("grey", { at: 0, ms: 5000 }).ms, 5000, "even one that would have held");
  assert.equal(momentCall("grey", { at: 0, ms: 0 }).ms, null, "nothing asked, and it holds as it does");
  assert.equal(momentCall("shake", { at: 0, ms: -4 }).ms, MOMENTS.shake.ms);
  assert.ok(momentCall("shake", { at: 0, ms: 1e9 }).ms <= 10 * 60 * 1000, "and never for a whole session by mistake");

  assert.equal(momentAudience(null), null, "nobody named is everybody");
  assert.deepEqual(momentAudience(["u1", "u2", "u1", 3, ""]), ["u1", "u2"]);
  assert.equal(momentAudience([]), null);
});

test("a moment is spent and dropped, and a held one is not", () => {
  const timed = momentCall("shake", { at: 0 }), held = momentCall("rumble", { at: 0 });
  assert.equal(momentOver(timed, timed.ms + 1), true);
  assert.equal(momentOver(held, 60 * 60 * 1000), false);
  assert.deepEqual(momentsLeft([timed, held], timed.ms + 1), [held]);
  assert.deepEqual(momentsLeft([null, { kind: "nonsense", at: 0 }], 10), []);
});

test("a moment already running is stopped rather than doubled", () => {
  const grey = momentCall("grey", { at: 0 }), shake = momentCall("shake", { at: 0 });
  assert.equal(momentRunning([grey, shake], "grey", 10), true);
  assert.equal(momentRunning([grey], "shake", 10), false);
  assert.equal(momentRunning([shake], "shake", shake.ms + 10), false, "one that has run out is not running");
  assert.equal(momentRunning(null, "grey", 10), false);
  assert.deepEqual(momentsWithout([grey, shake], "grey"), [shake]);
  assert.deepEqual(momentsWithout([grey, shake], "nothing"), [grey, shake]);
  assert.deepEqual(momentsWithout(null, "grey"), []);
  // Two of a kind go together: pressing a lit tile means stop, whatever is behind it.
  assert.deepEqual(momentsWithout([grey, momentCall("grey", { at: 50 }), shake], "grey"), [shake]);
});

test("nothing a GM can type makes a screen unusable", () => {
  assert.equal(momentCall("shake", { at: 0, strength: 99 }).strength, MOMENT_MOST);
  assert.equal(momentCall("shake", { at: 0, strength: -4 }).strength, 0);
  assert.equal(momentCall("pulse", { at: 0, colour: "javascript:alert(1)" }).colour, MOMENTS.pulse.colour);
  assert.equal(momentCall("pulse", { at: 0, colour: "#ff3300" }).colour, "#ff3300");
  for (const bad of ["", null, undefined, "__proto__", "constructor", "toString"]) assert.equal(momentCall(bad, { at: 0 }), null, String(bad));
  // However many shake at once, the view goes no further than one of them would have taken it.
  const many = Array.from({ length: 8 }, () => momentCall("shake", { at: 0, strength: 1 }));
  const screen = screenFrom(many, 60, view).board;
  assert.ok(Math.hypot(screen.shakeX, screen.shakeY) <= MOMENT_MOST + 1e-9);
  assert.ok(MOMENT_RISE_MS > 0);
});

test("some moments take hold of the things themselves", () => {
  const out = screenFrom([
    momentCall("sway", { at: 0, strength: 1, where: "tokens", ids: ["a", "b"] }),
    momentCall("tether", { at: 0, strength: 1, where: "tokens", ids: ["a", "b"], style: "chain" }),
    momentCall("grey", { at: 0, strength: 1 }),
  ], 4000, view);
  assert.equal(out.things.length, 2, "a sway and a tether are neither board nor layer");
  assert.deepEqual(out.things.map((t) => t.kind), ["sway", "tether"]);
  assert.deepEqual(out.things[0].ids, ["a", "b"]);
  assert.equal(out.things[1].style, "chain");
  assert.ok(out.board.grey > 0, "and the rest is unaffected");
  assert.equal(out.layers.length, 0);
});

test("every moment says which modes it can be used in", () => {
  // The panel hides what cannot work rather than offering a button that only ever says no.
  for (const [kind, how] of Object.entries(MOMENTS)) {
    assert.ok(how.wheres?.length, `${kind} says where it works`);
    for (const where of how.wheres) assert.ok(Object.hasOwn(WHERES, where), `${kind}: ${where}`);
    assert.deepEqual(momentWheres(kind), how.wheres);
  }
  // The ones that only make sense somewhere, and the ones that make sense everywhere.
  assert.deepEqual(momentWheres("sway"), ["tokens"]);
  assert.deepEqual(momentWheres("tether"), ["tokens"]);
  assert.ok(!momentWorksIn("shock", "screen"), "a shockwave over a whole screen is nothing at all");
  assert.ok(momentWorksIn("shock", "point"));
  assert.ok(!momentWorksIn("roll", "tokens"), "the view cannot lean at one token");
  assert.ok(momentWorksIn("pulse", "screen") && momentWorksIn("pulse", "point") && momentWorksIn("pulse", "tokens"));
  // Something nobody has described yet is not hidden everywhere by accident.
  assert.ok(momentWheres("nonsense").length > 0);
});

test("a moment can be asked to breathe rather than sit flat", () => {
  const flat = momentCall("grey", { at: 0, strength: 1 });
  const breathing = momentCall("grey", { at: 0, strength: 1, beat: true });
  assert.equal(flat.beat, false);
  assert.equal(breathing.beat, true);
  assert.equal(momentCall("grey", { at: 0, beat: "yes please" }).beat, false, "it is a yes or it is a no");
  assert.equal(beatAt(flat, 1234), 1, "one that was not asked to breathe does not");

  const over = Array.from({ length: 24 }, (_, i) => beatAt(breathing, i * 200));
  assert.ok(Math.max(...over) > 0.95 && Math.min(...over) < 0.5, "it comes and goes");
  assert.ok(Math.min(...over) >= BEAT_LOW - 1e-9, "and never to nothing, which would read as a fault");
  // Through the whole screen, not only in the arithmetic.
  const low = screenFrom([breathing], 0, view).board.grey;
  const high = screenFrom([breathing], BEAT_MS / 2, view).board.grey;
  assert.ok(high > low);
  assert.equal(screenFrom([flat], BEAT_MS / 2, view).board.grey, 1);
  // It survives being written down and called again.
  assert.match(momentMacro(breathing), /"beat": ?true/);
  assert.ok(!momentMacro(flat).includes('"beat"'));
});

test("the shockwave is the map's own, not a ring drawn over it", () => {
  assert.equal(MOMENTS.shock.on, "warp", "it goes to the distortion host, as a blast's does");
  const out = screenFrom([momentCall("shock", { at: 0, strength: 1, where: "point", x: 100, y: 100, radius: 300 })], 200, view);
  assert.equal(out.layers.length, 0, "nothing is drawn over the map for it");
  assert.equal(out.things.length, 0);
  assert.deepEqual(out.board, BOARD_REST);
});

test("the panel is told what a moment needs rather than keeping its own list", () => {
  assert.equal(momentNeeds("sway"), "things");
  assert.equal(momentNeeds("bob"), "things");
  assert.equal(momentNeeds("tether"), "two");
  assert.equal(momentNeeds("grey"), null);
  assert.equal(momentNeeds("nonsense"), null);
});

test("a sway rocks, a bob rides, and each thing moves on its own", () => {
  const sway = momentCall("sway", { at: 0, strength: 1, where: "tokens", ids: ["a"] });
  const one = thingSway(sway, 900, 0), two = thingSway(sway, 900, 1);
  assert.notEqual(one.lean, two.lean, "a row of signs does not move as one board");
  assert.ok(Math.abs(one.lean) <= 9 + 1e-9, "a lean is a lean, not a cartwheel");
  // It leans one way and then the other, rather than drifting off.
  const leans = Array.from({ length: 40 }, (_, i) => thingSway(sway, i * 250, 0).lean);
  assert.ok(Math.max(...leans) > 0 && Math.min(...leans) < 0);

  const bob = momentCall("bob", { at: 0, strength: 1, where: "tokens", ids: ["a"] });
  const lifts = Array.from({ length: 40 }, (_, i) => thingSway(bob, i * 250, 0).lift);
  assert.ok(Math.max(...lifts) > 0 && Math.min(...lifts) < 0, "a bob rides up and down");
  const swayLifts = Array.from({ length: 40 }, (_, i) => Math.abs(thingSway(sway, i * 250, 0).lift));
  assert.ok(Math.max(...lifts.map(Math.abs)) > Math.max(...swayLifts) * 3, "a bob rides further than a sway ever does");
  const bobLeans = Array.from({ length: 40 }, (_, i) => Math.abs(thingSway(bob, i * 250, 0).lean));
  assert.ok(Math.max(...bobLeans) < Math.max(...leans.map(Math.abs)), "and leans less while it is about it");
  // A moment that is not one of these moves nothing.
  assert.deepEqual(thingSway(momentCall("grey", { at: 0 }), 900, 0), { lean: 0, lift: 0 });
  assert.deepEqual(thingSway(null, 900, 0), { lean: 0, lift: 0 });
});

test("a tether hangs between two ends, and a beam does not hang at all", () => {
  const from = { x: 0, y: 0 }, to = { x: 400, y: 0 };
  const rope = tetherPath(from, to, { kind: "rope", strength: 1 });
  assert.ok(rope.length > 5);
  assert.deepEqual([rope[0].x, rope[0].y], [0, 0]);
  assert.deepEqual([rope.at(-1).x, rope.at(-1).y], [400, 0]);
  const middle = rope[Math.floor(rope.length / 2)];
  assert.ok(middle.y > 10, "the middle of a rope hangs below its ends");

  const beam = tetherPath(from, to, { kind: "beam", strength: 1 });
  assert.ok(Math.abs(beam[Math.floor(beam.length / 2)].y) < 1e-9, "a beam is straight");
  const chain = tetherPath(from, to, { kind: "chain", strength: 1 });
  assert.ok(chain[Math.floor(chain.length / 2)].y > middle.y, "a chain hangs heavier than a rope");

  // Nothing to draw between is nothing drawn.
  assert.deepEqual(tetherPath(null, to, {}), []);
  assert.deepEqual(tetherPath(from, { x: "over there" }, {}), []);
  for (const kind of Object.keys(TETHERS)) assert.ok(tetherPath(from, to, { kind }).length > 5, kind);
  assert.deepEqual(tetherPath(from, to, { kind: "nonsense" }), tetherPath(from, to, { kind: "rope" }));
});

test("a sway moves the way the thing it is on would move", () => {
  const over = (style, kind = "sway") => {
    const call = momentCall(kind, { at: 0, strength: 1, where: "tokens", ids: ["a"], style });
    return Array.from({ length: 60 }, (_, i) => thingSway(call, i * 120, 0));
  };
  const breeze = over("breeze"), wagon = over("wagon"), boat = over("boat");
  const most = (list, key) => Math.max(...list.map((v) => Math.abs(v[key])));
  // A boat rolls further than a sign in a breeze; a cart leans least and is thrown about most.
  assert.ok(most(boat, "lean") > most(breeze, "lean"), "a boat rolls deeper");
  assert.ok(most(wagon, "lean") < most(breeze, "lean"), "a cart hardly leans");
  assert.ok(most(wagon, "lift") > most(breeze, "lift"), "but it is thrown up and down");
  // And it is quicker: more turns in the same time.
  const crossings = (list) => list.slice(1).filter((v, i) => Math.sign(v.lean) !== Math.sign(list[i].lean)).length;
  assert.ok(crossings(wagon) > crossings(boat), "a cart jolts quickly where a boat rolls slowly");

  assert.equal(momentCall("sway", { at: 0, where: "tokens", ids: ["a"] }).style, "breeze", "a sway has a way by default");
  assert.equal(momentCall("sway", { at: 0, where: "tokens", ids: ["a"], style: "rope" }).style, "breeze", "and not a tether's");
  assert.equal(momentCall("tether", { at: 0, where: "tokens", ids: ["a", "b"], style: "wagon" }).style, "rope", "nor the other way about");
  assert.deepEqual(Object.keys(momentStyles("tether")), Object.keys(TETHERS));
  assert.deepEqual(Object.keys(momentStyles("sway")), Object.keys(SWAYS));
  assert.deepEqual(momentStyles("grey"), {}, "most moments have no style at all");
});

test("a moment can be heard as well as seen", () => {
  // The ones with a sound of their own get it without anybody choosing; the quiet ones stay quiet.
  assert.equal(momentCall("shock", { at: 0 }).heard, "crumble");
  assert.equal(momentCall("pulse", { at: 0 }).heard, "thunder");
  assert.equal(momentCall("grey", { at: 0 }).heard, null, "a grey world makes no noise");
  // Said plainly: a library sound, silence, or nothing said at all.
  assert.equal(momentCall("grey", { at: 0, heard: "crumble" }).heard, "crumble");
  assert.equal(momentCall("shock", { at: 0, heard: "" }).heard, null, "silence is how a GM turns one off");
  assert.equal(momentCall("shock", { at: 0, heard: "trombone" }).heard, null);

  const heard = momentSound(momentCall("shock", { at: 0, strength: 1, where: "point", x: 10, y: 20 }), { random: () => 0 });
  assert.match(heard.file, /^assets\/sounds\/underground\/cave-in\//);
  assert.deepEqual(heard.at, { x: 10, y: 20 }, "heard from where it happened");
  assert.ok(heard.volume > 0.9);
  assert.ok(momentSound(momentCall("shock", { at: 0, strength: 0.1 }), { random: () => 0 }).volume < heard.volume);
  // One of several, so the same moment twice is not the same noise twice.
  const files = new Set([0, 0.3, 0.6, 0.9].map((r) => momentSound(momentCall("shock", { at: 0 }), { random: () => r }).file));
  assert.ok(files.size > 1);
  assert.equal(momentSound(momentCall("grey", { at: 0 })), null, "and a quiet one is silent");
  assert.equal(momentSound(null), null);
});

test("a sound a GM chose is a file in this world and nothing else", () => {
  // This crosses a socket and is handed to the audio engine, so it is a path with an audio extension or it is null.
  assert.equal(soundPath("worlds/mine/boom.ogg"), "worlds/mine/boom.ogg");
  assert.equal(soundPath("assets/sounds/weather/thunder/thunderClose-194364-0.ogg"), "assets/sounds/weather/thunder/thunderClose-194364-0.ogg");
  assert.equal(soundPath(" music/a track.mp3 "), "music/a track.mp3", "a name with a space in it is still a name");
  for (const bad of ["../../etc/passwd.ogg", "/etc/passwd.ogg", "https://example.com/a.ogg", "javascript:alert(1)", "worlds/mine/boom.exe", "worlds/mine/boom", "", null, 7, "a.ogg;rm -rf"]) {
    assert.equal(soundPath(bad), null, String(bad));
  }
  // A file of the GM's own wins over any of ours, and travels with the moment.
  const own = momentCall("shock", { at: 0, sound: "worlds/mine/boom.ogg" });
  assert.equal(momentSound(own).file, "worlds/mine/boom.ogg");
  assert.match(momentMacro(own), /"sound": ?"worlds\/mine\/boom\.ogg"/);
  assert.equal(momentCall("shock", { at: 0, sound: "../boom.ogg" }).sound, null);
  // Turned off, it says so when written down; left alone, it says nothing.
  assert.match(momentMacro(momentCall("shock", { at: 0, heard: "" })), /"heard": ?""/);
  assert.ok(!momentMacro(momentCall("shock", { at: 0 })).includes('"heard"'));
});

test("a preset is several moments called as one", () => {
  const calls = presetCalls(PRESETS.collapse, { at: 1000 });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((c) => c.kind), ["rumble", "dust", "grain"]);
  assert.ok(calls.every((c) => c.at === 1000), "they begin together");
  // Where it happens is the panel's to say, and a moment that cannot work there falls back rather than vanishing.
  const atPlace = presetCalls(PRESETS.collapse, { at: 0, where: "point", x: 500, y: 600, radius: 300 });
  assert.ok(atPlace.every((c) => c.where === "point"), "all three can be put at a place");
  const picked = presetCalls(PRESETS.dread, { at: 0, where: "tokens", ids: ["a"] });
  assert.equal(picked.find((c) => c.kind === "blur").where, "screen", "a blur cannot follow a token, so it stays everywhere");
  // Nothing usable gives nothing.
  assert.deepEqual(presetCalls({ moments: [{ kind: "nonsense" }, null] }, { at: 0 }), []);
  assert.deepEqual(presetCalls(null, { at: 0 }), []);
  assert.deepEqual(presetCalls({ moments: "collapse" }, { at: 0 }), []);
});

test("what is running can be kept, and comes back as it was", () => {
  const running = [
    momentCall("grey", { at: 5, strength: 0.5, beat: true }),
    momentCall("vignette", { at: 9, strength: 0.7, colour: "#102030", ms: 4000 }),
  ];
  const kept = presetFrom(running, "My dread");
  assert.equal(kept.name, "My dread");
  assert.deepEqual(kept.moments[0], { kind: "grey", strength: 0.5, beat: true });
  assert.equal(kept.moments[1].colour, "#102030");
  assert.equal(kept.moments[1].ms, 4000);
  assert.ok(!("at" in kept.moments[0]), "when it happened is not part of what it is");
  assert.ok(!("where" in kept.moments[0]), "nor where");
  // Round trip: kept, then called again.
  const again = presetCalls(kept, { at: 0 });
  assert.deepEqual(again.map((c) => c.kind), ["grey", "vignette"]);
  assert.equal(again[0].beat, true);
  assert.equal(again[1].colour, "#102030");
  // Nothing running is nothing to keep, and a name is not allowed to run away with the panel.
  assert.equal(presetFrom([], "x"), null);
  assert.equal(presetFrom([{ kind: "nonsense", at: 0 }], "x"), null);
  assert.ok(presetFrom(running, "x".repeat(400)).name.length <= 60);
  assert.ok(presetFrom(running).name.length > 0, "and one with no name still has one");
});

test("the GM's own presets stand beside the ones we ship, and rubbish stands nowhere", () => {
  const all = presetsAll({ mine: { name: "Mine", moments: [{ kind: "shake", strength: 1 }] } });
  assert.ok(all.collapse && all.mine);
  assert.equal(all.mine.own, true, "so the panel knows which may be deleted");
  assert.ok(!presetsAll({ bad: { name: "Bad", moments: [{ kind: "nonsense" }] } }).bad, "a preset of nothing is not offered");
  assert.ok(!presetsAll({ worse: "not even an object" }).worse);
  assert.ok(!presetsAll({ "": { moments: [{ kind: "shake" }] } })[""], "and a preset with no name at all is not one");
  assert.deepEqual(Object.keys(presetsAll()), Object.keys(PRESETS));
  for (const preset of Object.values(PRESETS)) assert.ok(presetCalls(preset, { at: 0 }).length, preset.name);
});

test("a moment can be written down as a macro and called again", () => {
  const call = momentCall("shock", { at: 0, strength: 0.8, where: "point", x: 1200, y: 800, radius: 350, colour: "#88ccff", ms: 1500 });
  const line = momentMacro(call);
  assert.match(line, /game\.modules\.get\("animater"\)\.api\.moment\(/);
  assert.match(line, /"kind": ?"shock"/);
  assert.match(line, /"x": ?1200/);
  assert.doesNotMatch(line, /"at":/, "when it happened is not part of what it is");
  // What it writes down is what it reads back.
  const again = JSON.parse(line.slice(line.indexOf("{"), line.lastIndexOf("}") + 1));
  const rebuilt = momentCall(again.kind, { ...again, at: 0 });
  assert.equal(rebuilt.kind, call.kind);
  assert.equal(rebuilt.x, call.x);
  assert.equal(rebuilt.strength, call.strength);
  assert.equal(rebuilt.ms, call.ms);
});
