import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOMENTS, WHERES, TETHERS } from '../../scripts/engines/camera/screen-moments.mjs';

// A moment reaches other people's screens and takes hold of their tokens, so the ways it could go wrong are not
// cosmetic: anyone being able to send one, one that cannot be stopped, one that leaves a board moved or a token
// crooked, or one that writes to the world.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../styles/animater.css', import.meta.url), 'utf8');
const slice = (from, to) => main.slice(main.indexOf(from), main.indexOf(to, main.indexOf(from)));

test('only a GM may put a moment on someone else\'s screen', () => {
  const heard = slice('const momentHeard = (data, senderId) => {', '\r\n};');
  assert.match(heard, /!game\.users\.get\(senderId\)\?\.isGM\) return;/);
  assert.match(main, /if \(data\?\.type === MOMENT_MESSAGE\) \{ if \(data\.sender !== clientId\) momentHeard\(data, senderId\); return; \}/);
  assert.match(heard, /momentsShow\(momentCall\(data\.call\?\.kind, data\.call \?\? \{\}\)\)/, 'read back through the engine, not trusted as it comes');
  const api = slice('    moment: (asked = {}) =>', 'moments: ()');
  assert.match(api, /if \(!game\.user\?\.isGM\) return null;/);
});

test('a moment can be sent to some screens and not others', () => {
  const fire = slice('const momentCallHere = (kind, how = {}) => {', '\r\n};');
  assert.match(fire, /const audience = momentAudience\(how\.audience\)/);
  assert.match(fire, /if \(!audience \|\| audience\.includes\(game\.user\.id\)\) momentsShow\(call\)/);
  assert.match(main, /if \(Array\.isArray\(data\?\.audience\) && !data\.audience\.includes\(game\.user\.id\)\) return;/);
});

test('how far a moment reaches is a ring on the map, not a number in a box', () => {
  // The same ring the cave-in and the blast use, so the wheel sizes it and Shift doubles it as a GM already knows.
  const aim = slice('function momentAimAt(kind, asked, then) {', '\r\n}');
  assert.match(aim, /aimOnMap\(\{/);
  assert.match(aim, /squares: momentSquares/);
  assert.match(aim, /setSquares: \(s\) => \{ momentSquares = s; \}/, 'where it was left is where it starts next time');
  assert.match(aim, /fire: \(p, radius\) =>/);
  assert.match(aim, /line: tint, fill: tint/, 'and the ring is drawn in the moment\'s own colour');
  assert.match(main, /momentAimAt\(kind, asked, \(\{ x, y, radius \}\) => momentCallHere\(kind, \{ \.\.\.asked, x, y, radius \}\)\)/);
  assert.ok(!main.includes('data-an-radius'), 'and the box that asked for squares is gone');
});

test('Shock is the map\'s own shockwave, not a ring drawn over it', () => {
  const wave = slice('function momentShockwave(call) {', '\r\n}');
  assert.match(wave, /blastRipple\(\{ x: where\.x, y: where\.y, radius, kind: "force"/, 'the same ring a blast sends out');
  assert.match(wave, /distortionHost\.onEffect\(\{ data: \{ animaterWarp: ripple/);
  assert.match(wave, /ripple\.strength \*= Math\.max\(0\.1, call\.strength\)/, 'as hard as the GM asked');
  // Sent once as it lands, not drawn every frame.
  assert.match(main, /if \(MOMENTS\[call\.kind\]\?\.on === "warp"\) momentShockwave\(call\);/);
  const paint = slice('const momentsPaint = () => {', '\r\n};');
  assert.ok(!paint.includes('layer.kind === "shock"'), 'and nothing of it is left in the layer');
});

test('the panel offers only what the chosen mode can do', () => {
  assert.match(main, /import \{ momentsPanelHtml, momentsPanelMode, momentsPresetOptions, momentsReadout \} from "\.\/ui\/moments-panel\.mjs";/);
  assert.match(main, /const rows = \(\) => momentsPanelMode\(box, momentPanelPick\("where"\) \?\? "screen"\);/);
});

test('a moment already running is stopped by pressing it again', () => {
  const fire = slice('function momentsFire(kind) {', '\r\n}');
  assert.match(fire, /if \(momentRunning\(momentCalls, kind, Date\.now\(\)\)\) \{ momentStopKind\(kind\); return; \}/);
  assert.match(fire, /if \(caveInAim\) \{ stopCaveInAim\(\); momentPanelLit\(\); return; \}/, 'and a second press calls off the ring');
  const one = slice('const momentStopKind = (kind) => {', '\r\n};');
  assert.match(one, /momentsPutOut\(kind\)/);
  assert.match(one, /stop: kind/, 'stopped on every screen, not only this one');
  const heard = slice('const momentHeard = (data, senderId) => {', '\r\n};');
  assert.match(heard, /if \(data\.stop === true\) \{ momentsOff\(\); return; \}/);
  assert.match(heard, /if \(typeof data\.stop === "string"\) \{ momentsPutOut\(data\.stop\); return; \}/);
});

test('the dashboard goes where the GM puts it, and stays there', () => {
  const drag = slice('function momentPanelDrag(box) {', '\r\n}');
  assert.match(drag, /header\.addEventListener\("pointerdown"/);
  assert.match(drag, /event\.target\?\.closest\?\.\("button"\)\) return;/, 'dragging by the header, not by its buttons');
  assert.match(drag, /Math\.min\(Math\.max\(8, left\)/, 'never dragged off the edge and out of reach');
  assert.match(drag, /localStorage\?\.setItem\(MOMENT_SPOT_KEY/);
  assert.match(drag, /localStorage\?\.getItem\(MOMENT_SPOT_KEY\)/);
  assert.match(drag, /catch \{ \/\* storage refused \*\/ \}/, 'and a browser that refuses storage is not a crash');
  assert.ok(css.includes('.animater-moments-panel header { cursor: move; }'));
  // Pixels, not ems: the panel hangs off Foundry UI, whose font size is a world setting.
  const panel = css.slice(css.indexOf('.animater-moments-panel {'), css.indexOf('.animater-moments-panel header'));
  assert.match(panel, /width: 268px;/);
  assert.match(panel, /font-size: 13px;/);
  // And it carries the .animater class for its colours, which asks for 760px: a width can never win against a
  // min-width, and twice this panel came out the width of the map because of it.
  assert.match(panel, /min-width: 0;/);
  assert.match(css.slice(css.indexOf('.animater {'), css.indexOf('.animater {') + 900), /min-width: min\(760px/, 'the class it borrows really does ask for that');
});

test('what a moment needs is the engine\'s to say', () => {
  const fire = slice('function momentsFire(kind) {', '\r\n}');
  assert.match(fire, /const needs = momentNeeds\(kind\)/, 'not a list kept in the panel');
  assert.match(fire, /needs === "things" && !asked\.ids\?\.length/);
  assert.match(fire, /needs === "two" && \(asked\.ids\?\.length \?\? 0\) < 2/);
  // Tiles count as things picked, not only tokens: FX Bus sways tiles, so we must.
  const picked = slice('const momentPicked = () => {', '\r\n};');
  assert.match(picked, /canvas\?\.tokens\?\.controlled/);
  assert.match(picked, /canvas\?\.tiles\?\.controlled/);
});

test('a sway moves the picture of a token and never the token', () => {
  const hold = slice('function momentHold(id, { lean = 0, lift = 0 } = {}) {', '\r\n}');
  assert.match(hold, /mesh\.angle = was\.angle \+ lean/);
  assert.match(hold, /mesh\.position\.set\(was\.x, was\.y \+ lift \* tall\)/);
  assert.ok(!hold.includes('document.update'), 'nothing is written');
  // What it looked like before is kept, and put back.
  const release = slice('function momentRelease(id) {', '\r\n}');
  assert.match(release, /was\.mesh\.angle = was\.angle/);
  assert.match(release, /was\.mesh\.position\.set\(was\.x, was\.y\)/);
  assert.match(main, /const momentReleaseAll = \(\) => \{ for \(const id of \[\.\.\.momentHeld\.keys\(\)\]\) momentRelease\(id\); \};/);
  // And a thing no moment holds any more is let go on the next frame.
  const paint = slice('const momentsPaint = () => {', '\r\n};');
  assert.match(paint, /for \(const id of \[\.\.\.momentHeld\.keys\(\)\]\) if \(!holding\.has\(id\)\) momentRelease\(id\)/);
});

test('a tether is drawn between the things, each to the next', () => {
  const links = slice('function momentLinks(thing) {', '\r\n}');
  assert.match(links, /for \(let i = 0; i \+ 1 < spots\.length; i\+\+\)/, 'three tokens make two lines, not three');
  assert.match(links, /tetherPath\(from, to, \{ kind: thing\.style/);
  const draw = slice('function momentDrawLinks(host, lines) {', '\r\n}');
  assert.match(draw, /TETHERS\[thing\.style\] \?\? TETHERS\.rope/);
  assert.match(draw, /stroke-dasharray/);
  assert.ok(css.includes('.animater-moments .an-links'), 'and it has somewhere to be drawn');
});

test('everything stops, everywhere, and leaves the board and the tokens as they were', () => {
  const off = slice('const momentsOff = () => {', '\r\n};');
  assert.match(off, /momentCalls = \[\]/);
  assert.match(off, /board\.style\.transform = ""/);
  assert.match(off, /board\.style\.filter = ""/);
  assert.match(off, /momentReleaseAll\(\)/, 'a sway let go is the difference between a feature and a mess');
  assert.match(off, /momentLayer\?\.remove\?\.\(\)/);
  assert.match(main, /Hooks\.on\("canvasTearDown", momentsOff\);/);
});

test('the frame loop asks the page for nothing it may not have, and ends itself', () => {
  assert.match(main, /const momentBoard = \(\) => \{ try \{ return globalThis\.document\?\.getElementById\?\.\("board"\) \?\? null; \} catch \{ return null; \} \};/);
  const paint = slice('const momentsPaint = () => {', '\r\n};');
  assert.match(paint, /momentCalls = momentsLeft\(momentCalls, Date\.now\(\)\)/);
  assert.match(paint, /if \(!momentCalls\.length \|\| !board\?\.style\) \{ momentsOff\(\); return; \}/);
  assert.match(paint, /screenFrom\(momentCalls, Date\.now\(\), momentView\(\)\)/);
  const show = slice('const momentsShow = (call) => {', '\r\n};');
  assert.match(show, /typeof globalThis\.requestAnimationFrame === "function"/);
});

test('the dashboard is drawn by its own module, and lit from what is running', () => {
  const open = slice('function openMomentsPanel() {', '\r\n}');
  assert.match(open, /if \(!game\.user\?\.isGM/);
  assert.match(open, /momentsPanelHtml\(\{ moments: MOMENTS, wheres: WHERES, styles, presets: presetsAll\(momentPresetsKept\(\)\) \}\)/);
  const lit = slice('function momentPanelLit() {', '\r\n}');
  assert.match(lit, /classList\.toggle\("is-on"/);
  assert.match(lit, /momentsReadout\(momentCalls, MOMENTS\)/);
  assert.match(lit, /toggleAttribute\("disabled", !momentCalls\.length\)/);
  assert.match(main, /name: "animaterMoments"[\s\S]{0,400}?visible: toolShown\("toolMoments"\)/);
});

test('sets of moments are called as one, kept for the table, and read back before they are shown', () => {
  const play = slice('function momentPresetPlay() {', '\r\n}');
  assert.match(play, /presetsAll\(momentPresetsKept\(\)\)\[momentPresetChosen\(\)\]/);
  assert.match(play, /presetCalls\(preset, \{ at: Date\.now\(\), where: asked\.where/, 'where it happens is the panel\'s, not the set\'s');
  assert.match(play, /momentAimAt\(momentPresetChosen\(\), asked, send\)/, 'a set can be put at a place too');
  // Kept for everyone at the table, not just this screen.
  assert.match(main, /registerSetting\("momentPresets", \{ name: "Moment sets", scope: "world", config: false, type: Object, default: \{\} \}\);/);
  const keep = slice('async function momentPresetKeep() {', '\r\n}');
  assert.match(keep, /presetFrom\(momentCalls, ""\)/);
  assert.match(keep, /game\.settings\.set\(ID, "momentPresets"/);
  assert.match(keep, /catch \(err\)/);
  const forget = slice('async function momentPresetForget() {', '\r\n}');
  assert.match(forget, /if \(!all\[key\]\?\.own\)/, 'the ones we ship cannot be forgotten');
  // Nothing from the setting is trusted: it goes through presetsAll, which keeps only real moments.
  assert.match(main, /const momentPresetsKept = \(\) => \{ try \{ const kept = hotSetting\("momentPresets"\); return kept && typeof kept === "object" \? kept : \{\}; \} catch \{ return \{\}; \} \};/);
});

test('a sway moves the way its style says, and a style of another kind is ignored', () => {
  assert.match(main, /import \{ MOMENTS, WHERES, TETHERS, SWAYS,/);
  const open = slice('function openMomentsPanel() {', '\r\n}');
  assert.match(open, /Object\.entries\(TETHERS\)\.map\(\(\[k, v\]\) => \[k, \{ \.\.\.v, forKind: "tether" \}\]\)/);
  assert.match(open, /Object\.entries\(SWAYS\)\.map\(\(\[k, v\]\) => \[k, \{ \.\.\.v, forKind: "sway" \}\]\)/);
  assert.match(main, /thingSway\(thing\.call, Date\.now\(\), n\)/);
});

test('the only document a moment ever writes is a macro the GM asked for', () => {
  const block = slice('const MOMENT_MESSAGE = "moment";', 'async function momentMacroMake()');
  for (const write of ['setFlag', 'createEmbeddedDocuments', 'updateEmbeddedDocuments', 'deleteEmbeddedDocuments']) {
    assert.ok(!block.includes(write), `${write} has no business here`);
  }
  const make = slice('async function momentMacroMake() {', '\r\n}');
  assert.match(make, /Macro\.create\(/);
  assert.match(make, /type: "script"/);
  assert.match(make, /catch \(err\)/, 'and a refusal is told, not thrown');
  assert.ok(Object.keys(MOMENTS).length >= 17, 'every effect FX Bus has, and the ones it does not');
});
