import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARRIVALS } from '../../scripts/engines/motion/scene-arrival.mjs';

// The beat is decided in the engine; main.mjs runs it, and the ways it could go wrong are all here: running when
// nobody asked, running again on a redraw, or leaving the board moved when it ends.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles/animater.css', import.meta.url), 'utf8');
const slice = (from, to) => main.slice(main.indexOf(from), main.indexOf(to, main.indexOf(from)));

test('the arrival comes from the engine, not from the shell', () => {
  assert.match(main, /import \{ ARRIVALS, ARRIVAL_MS, arrivalHere, arrivalAt, arrivalShake, arrivalFlash, arrivalWords \} from "\.\/engines\/motion\/scene-arrival\.mjs";/);
  const play = slice('function playArrival(', '\r\n}');
  assert.match(play, /arrivalAt\(beat, t\)/);
  assert.match(play, /arrivalShake\(beat, t\)/);
  assert.match(play, /arrivalFlash\(beat, t\)/);
});

test('no scene does this unasked, and no screen has to take it', () => {
  assert.match(main, /const arrivalBeatOf = \(scene\) => arrivalHere\(scene\?\.flags\?\.\[ID\]\?\.arrival, hotSetting\("sceneArrival"\)\)/);
  const play = slice('function playArrival(', '\r\n}');
  assert.match(play, /if \(beat === "off" \|\| hotSetting\("sceneArrivalLocal"\) === false \|\| !allowsMotion\(localQuality\(\)\)\) return;/);
  const setting = slice("registerSetting(\"sceneArrival\"", 'registerSetting("cloudDarkness"');
  assert.match(setting, /default: "off"/, 'nothing changes for anyone until a GM asks for it');
  assert.match(setting, /choices: \{ \.\.\.ARRIVALS \}/);
  assert.match(setting, /scope: "client", config: true, type: Boolean, default: true/, 'and a player can refuse them');
});

test('it runs on arriving, not on every redraw of the map they are standing on', () => {
  // A wall edited or a light moved redraws the canvas. Without this the party would arrive again every time.
  const hook = slice('Hooks.on("canvasReady", () => {\r\n  const id = canvas?.scene?.id', '});');
  assert.match(hook, /if \(id === arrivalScene\) return;/);
  assert.match(hook, /arrivalScene = id;/);
  assert.match(hook, /catch \(err\) \{ arrivalOver\(\);/, 'a beat that throws still puts the board back');
});

test('whatever ends it, the board is left exactly as it was', () => {
  const over = slice('const arrivalOver = () => {', '\r\n};');
  assert.match(over, /board\.style\.transform = ""/);
  assert.match(over, /board\.style\.filter = ""/);
  assert.match(over, /arrivalBox\?\.remove\?\.\(\)/);
  assert.match(main, /Hooks\.on\("canvasTearDown", arrivalOver\);/);
  // A click ends it: the overlay takes the press so it cannot reach a canvas under a board that is still moving.
  assert.match(main, /box\.addEventListener\("pointerdown", arrivalOver\)/);
  assert.match(css, /\.animater-arrival \{[^}]*pointer-events: auto;/);
});

test('it asks the page for nothing it may not have', () => {
  // canvasTearDown fires in tests against a bare stub of a document, and a beat putting the board back must never
  // be the thing that throws. It did: getElementById on a stub with only querySelectorAll took a test down with it.
  assert.match(main, /const arrivalBoard = \(\) => \{ try \{ return globalThis\.document\?\.getElementById\?\.\("board"\) \?\? null; \} catch \{ return null; \} \};/);
  const over = slice('const arrivalOver = () => {', '\r\n};');
  assert.match(over, /board\?\.style/);
  assert.match(over, /arrivalBox\?\.remove\?\.\(\)/);
  const play = slice('function playArrival(', '\r\n}');
  assert.match(play, /!board\?\.style \|\| !globalThis\.document\?\.body\?\.append \|\| typeof globalThis\.requestAnimationFrame !== "function"/);
});

test('the world audio is left alone', () => {
  // The wounded view owns worldMuffle. Two features pulling at one gain is how a session ends with no sound.
  const play = slice('function playArrival(', '\r\n}');
  assert.doesNotMatch(play, /worldMuffle/);
});

test('the scene says for itself, and says what the card reads', () => {
  const tab = slice('<label>Arriving on this scene</label>', 'tab.append(arriveCard);');
  assert.match(tab, new RegExp(`name="flags\\.\\$\\{ID\\}\\.arrival"`));
  assert.match(tab, /\["", "From the module"\], \.\.\.Object\.entries\(ARRIVALS\)/, 'the menu is the engine\'s own list');
  assert.match(tab, new RegExp(`name="flags\\.\\$\\{ID\\}\\.arrivalCard"`));
  assert.match(tab, new RegExp(`name="flags\\.\\$\\{ID\\}\\.arrivalSays"`));
  assert.match(main, /own: scene\?\.flags\?\.\[ID\]\?\.arrivalSays \?\? ""/);
});

test('the card is drawn over the board and is gone with it', () => {
  for (const rule of ['.animater-arrival', '.animater-arrival .an-veil', '.animater-arrival .an-flash', '.animater-arrival .an-card']) {
    assert.ok(css.includes(rule), rule);
  }
  assert.ok(Object.keys(ARRIVALS).length >= 4, 'and there is more than one beat to choose between');
});
