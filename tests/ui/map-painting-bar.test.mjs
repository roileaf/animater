import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Roi: "we need to add mapmaking button that will let us add floors and decorations instead of just one button for each";
// of the first mock, "looks a little confusing no?"; then "Build it" from the simpler v2.
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('the bar has two tabs, Floors first, and remembers the floor choices', async () => {
  const { brushChoices, BRUSH_TOL, BRUSH_PLACES, canStandOverWater } = await import('../../scripts/ui/decor-brush-bar.mjs');
  const c = brushChoices();
  assert.equal(c.tab, 'floors'); assert.equal(c.floor, 'grass'); assert.equal(c.smart, true); assert.equal(c.tol, BRUSH_TOL.usual); assert.equal(c.texture, ''); assert.equal(c.overWater, false);
  assert.deepEqual(BRUSH_PLACES.map(([, l]) => l), ['Outdoors', 'Town', 'Indoors', 'Waterside', 'Underground'], 'Waterside, so Water is only a floor');
  assert.ok(canStandOverWater('wood') && !canStandOverWater('water') && !canStandOverWater('lava'));
});

const fakeDom = () => {
  const make = (tag) => {
    const n = { tagName: tag.toUpperCase(), className: '', textContent: '', children: [], attrs: {}, listeners: {}, style: {}, dataset: {}, value: '', type: '', hidden: false, disabled: false, checked: false, title: '', innerHTML: '',
      append(...k) { for (const c of k) if (c && typeof c === 'object') { this.children.push(c); c.parent = this; } }, replaceChildren(...k) { this.children = []; this.append(...k); },
      setAttribute(k, v) { this.attrs[k] = String(v); }, addEventListener(t, fn) { (this.listeners[t] ??= []).push(fn); }, remove() {},
      getContext: () => ({ drawImage() {} }), querySelector: () => null, contains: () => false, classList: { contains: () => false } };
    return n;
  };
  globalThis.document = { createElement: make, getElementById: () => null, body: make('body'), activeElement: null };
  globalThis.Event = class { constructor(t) { this.type = t; } };
};
const walk = function* (n) { yield n; for (const c of n.children ?? []) yield* walk(c); };
const find = (root, pred) => [...walk(root)].find(pred);
const all = (root, pred) => [...walk(root)].filter(pred);

test('Floors: a swatch per floor, the brush and Smart edges; How alike, Texture and Over water wait under More', async () => {
  fakeDom();
  const { openBrushBar, brushChoices } = await import('../../scripts/ui/decor-brush-bar.mjs');
  let read = 0; const bar = openBrushBar({ onReadMap: () => { read++; } }), root = bar.element;
  assert.equal(all(root, (n) => n.dataset?.floor).length, 13);
  // Edges: Off, Colour (the default) or Model (the segmentation model's outline).
  const edges = all(root, (n) => n.dataset?.edges);
  assert.deepEqual(edges.map((b) => b.dataset.edges), ['off', 'colour', 'model']);
  assert.equal(edges.find((b) => b.attrs['aria-pressed'] === 'true').dataset.edges, 'colour');
  assert.equal(brushChoices().edges, 'colour'); assert.equal(brushChoices().smart, true);
  // Roi: "lets start the floor brush with model if it was downloaded already". Picking Edges by hand is remembered as the
  // GM's own choice, which the automatic Model never overrides; setEdges (the automatic one) leaves it unchosen.
  assert.equal(brushChoices().edgesChosen, false);
  bar.setEdges('model'); assert.equal(brushChoices().edges, 'model'); assert.equal(brushChoices().edgesChosen, false);
  bar.setEdges('colour');
  edges.find((b) => b.dataset.edges === 'model').listeners.click[0]();
  assert.equal(brushChoices().edges, 'model'); assert.equal(brushChoices().edgesChosen, true);
  find(bar.element, (n) => n.dataset?.edges === 'colour').listeners.click[0]();
  const extra = find(root, (n) => n.className?.includes('an-mp-extra'));
  assert.equal(extra.hidden, true, 'More starts folded');
  assert.ok(find(extra, (n) => n.textContent === 'How alike') && find(extra, (n) => n.textContent === 'Texture'));
  // Roi: "we also need the edge softening slider". Soft edge, as Floor regions has it: how far the texture fades past the line.
  assert.ok(find(extra, (n) => n.textContent === 'Soft edge'));
  assert.equal(brushChoices().edge, 1);
  find(root, (n) => n.dataset?.floor === 'water').listeners.click[0]();
  assert.equal(brushChoices().floor, 'water');
  assert.ok(!find(bar.element, (n) => n.textContent === 'Over water'), 'no Over water for water itself');
  find(bar.element, (n) => n.textContent === 'Read the whole map…').listeners.click[0](); assert.equal(read, 1);
  bar.setTab('decor'); bar.setTab('floors'); bar.close();
});

test('Decorations: the place as a drop-down, a picture per kind, Brush and Density; size, height, rotation and breaking under More', async () => {
  fakeDom();
  const { openBrushBar, brushChoices } = await import('../../scripts/ui/decor-brush-bar.mjs');
  const tabs = []; const bar = openBrushBar({ onTab: (t) => tabs.push(t), thumb: () => ({ width: 80, height: 64 }) });
  bar.setTab('decor'); assert.deepEqual(tabs, ['decor']); assert.equal(brushChoices().tab, 'decor');
  const root = bar.element;
  assert.ok(find(root, (n) => n.className === 'an-mp-place'));
  const tiles = all(root, (n) => n.dataset?.kind);
  assert.ok(tiles.length > 5 && tiles.every((t) => find(t, (c) => c.className === 'an-mp-pic')), 'each kind has its picture');
  assert.ok(find(root, (n) => n.textContent === 'Density'));
  const extra = find(root, (n) => n.className?.includes('an-mp-extra'));
  for (const label of ['Decoration size', 'Decoration height', 'Rotation']) assert.ok(find(extra, (n) => n.textContent === label), label);
  bar.setStatus('Painted: Grass · 3 decorations', { undo: true, redo: false });
  assert.ok(find(bar.element, (n) => n.textContent === 'Painted: Grass · 3 decorations'));
  bar.setTab('floors'); bar.close();
});

test('main: one Map painting button paints floors and decorations, saving each stroke', () => {
  const main = read('scripts/main.mjs');
  assert.match(main, /name: "animaterDecorate", title: "Map painting:[^"]*", icon: "fa-solid fa-paintbrush"/);
  assert.match(main, /\['toolDecorate','Show the Map painting button'/);
  assert.match(main, /planFloorStroke\(\{ saved, floor: c\.floor, stroke: fl\.stroke, erase: fl\.erasing, width: fl\.map\.width, height: fl\.map\.height \}\)/);
  assert.match(main, /rememberDecorStep\(\{ kind: "floor", updates, creates, removes \}\)/);
  assert.match(main, /name: floorRegionName\(c\.floor, names\), floor: c\.floor, texture: c\.texture, overWater: c\.overWater, edge: c\.edge === BRUSH_EDGE\.usual \? "" : c\.edge \}/, 'a new region takes the Soft edge');
  assert.match(main, /state\.bar\?\.setTab\(e\.key === "1" \? "floors" : e\.key === "2" \? "decor" : "heights"\);/);
  // Roi: "we have no preview when hovering over the canvas?" Hovering shows what the next dab would take.
  assert.match(main, /if \(!state\.down\) \{ if \(floorsOn\(\) && fl\.map && !e\.shiftKey\) hoverFloor\(p\); else hideHover\(\); return; \}/);
  assert.match(main, /const cells = floorDabCells\(\{[^\n]*seed: floorColourAt\(m\.rgba, m\.width, m\.height, q\.x, q\.y\), tolerance: c\.tol, smart: c\.smart, allowed: \(i\) => !claimed\[i\], within \}\);/);
  // Roi: "can we use the SAM model for drawing smarterly?" Edges: Model asks SAM once agreed, as Floor regions does.
  assert.match(main, /const cached = await isSmartModelCached\(\);\s+if \(samPrefs\(\)\.smartAgreed !== SMART_MODEL\.repo && !cached\)/);
  assert.match(main, /const view = await seg\.read\(fl\.map\.rgba, fl\.map\.width, fl\.map\.height\);/);
  assert.match(main, /for \(const spot of smartNearbyClicks\(at, m\.width, m\.height\)\) \{ sets\.push\(\(await sam\.ready\.seg\.masks\(sam\.ready\.view, \[spot\]\)\)\.masks\);/);
  assert.match(main, /return modelMaskFor\(\{ sets, rgba: m\.rgba, width: m\.width, height: m\.height, at: q \}\);/, 'consensus and the clicked colours, as Floor regions');
  assert.match(main, /within: fl\.model \? fl\.within : null/);
  assert.match(main, /while \(fl\.asking\) await fl\.asking;/, 'a stroke waiting on the model is saved once it answers');
  assert.match(main, /state\.bar\?\.setEdges\("colour"\)/, 'back to Colour when the model cannot load or the download is declined');
  // Already downloaded: the brush starts on Model (never asking to download), unless the GM picked Edges themselves.
  assert.match(main, /if \(!brushChoices\(\)\.edgesChosen && await isSmartModelCached\(\) && decorBrushing === state\) \{ state\.bar\?\.setEdges\("model"\); if \(floorsOn\(\) \|\| heightsOn\(\)\) void loadSam\(\); \}/);
  // Roi: "it keeps trying to download SAM model even though i already downloaded it". transformers.js reports progress while it
  // reads a cached model back too, so a cached model says Loading, in the brush and in Floor regions alike.
  assert.match(main, /samStatus\(`\$\{cached \? "Loading" : "Downloading"\} the smart model… /);
  const floorUi = read('scripts/ui/floor-regions-ui.mjs');
  assert.match(floorUi, /const cached = !!\(await hooks\.smartCached\?\.\(\)\);/);
  assert.match(floorUi, /smartStatus\(cached\s+\? `Loading \$\{SMART_MODEL\.name\} from this browser/);
  assert.match(main, /pg\.putImageData\(fl\.pixels, 0, 0, x0, y0, w, h\);/, 'Roi: it lagged: a dab copies only the box it touched');
  assert.match(main, /requestAnimationFrame\(\(\) => \{ fl\.uploading = false;/, 'and the stroke goes to the screen once a frame');
  assert.match(main, /fl\.hoverWithin = await askModel\(toImage\(at\), \{ quick: true \}\)/, 'hovering asks the model one quick question');
  // Roi: "the whole server froze!" (the page: the model ran on it). Without WebGPU, Model stays off.
  assert.match(main, /const seg = await smartModelShared\(\{ onProgress:/, 'the model runs in the one background worker of the page');
  // Roi, of keeping off decorations: "i changed my mind ... the decorations should be above the floor". The brush paints
  // under them; only other floors' regions are kept off.
  assert.doesNotMatch(main, /decorObstacles/);
  assert.match(main, /claimedMask = new Uint8Array\(fl\.map\.width \* fl\.map\.height\); for \(const s of fl\.saved\) if \(s\.floor !== floor\)/);
  // Roi: "i dont see preview when i select to show texture". A floor that will be painted previews in its own texture.
  assert.match(main, /if \(!m\.ui\.paintsTexture\(c\.floor, c\.texture, canvas\.scene\?\.flags\?\.\[ID\]\?\.floorTextures \?\? ""\)\) return null;/);
  assert.match(main, /tile = floorTextures\.tileImage\(c\.floor, style\)/);
  assert.match(main, /g\.putImageData\(img, 0, 0\); if \(look\) texturise\(g, w, h, x0, y0, look\);/, 'the hover');
  assert.match(main, /if \(look\) \{ pg\.save\(\); pg\.beginPath\(\); pg\.rect\(x0, y0, w, h\); pg\.clip\(\); texturise\(pg, m\.width, m\.height, 0, 0, look\); pg\.restore\(\); \}/, 'the stroke');
});

// Roi: "Build it", of the heights and ramps mock. A third tab, Heights: Raise (Edges finds the outline under a click) or Ramp,
// and the scene's two choices (cliff walls, shadows) under More, kept on the scene through sceneTicks.
test('Heights: Raise or Ramp, Edges for Raise, and the scene\'s cliff walls and shadows under More', async () => {
  fakeDom();
  const { openBrushBar, brushChoices, HEIGHT_MODES } = await import('../../scripts/ui/decor-brush-bar.mjs');
  const tabs = [], ticks = []; const bar = openBrushBar({ onTab: (t) => tabs.push(t), sceneTicks: { get: () => ({ walls: true, shadows: false }), set: (k, v) => ticks.push([k, v]) } });
  bar.setTab('heights'); assert.deepEqual(tabs, ['heights']); assert.equal(brushChoices().tab, 'heights'); assert.equal(brushChoices().heightMode, 'raise');
  assert.deepEqual(HEIGHT_MODES.map(([k]) => k), ['raise', 'ramp']);
  const root = bar.element;
  assert.ok(find(root, (n) => n.dataset?.tab === 'heights' && n.title === 'Heights (3)'));
  assert.deepEqual(all(root, (n) => n.dataset?.edges).map((b) => b.dataset.edges), ['off', 'colour', 'model'], 'Edges for Raise');
  assert.ok(find(root, (n) => n.textContent === 'Brush'), 'Raise is a brush');
  const boxes = all(root, (n) => n.dataset?.sceneTick);
  assert.deepEqual(boxes.map((b) => [b.dataset.sceneTick, b.checked]), [['walls', true], ['shadows', false]]);
  boxes[1].checked = true; boxes[1].listeners.change[0](); assert.deepEqual(ticks, [['shadows', true]]);
  find(root, (n) => n.dataset?.heightMode === 'ramp').listeners.click[0]();
  assert.equal(brushChoices().heightMode, 'ramp');
  assert.ok(!find(bar.element, (n) => n.dataset?.edges), 'a ramp needs no Edges');
  assert.match(find(bar.element, (n) => n.className?.includes('an-mp-keys')).textContent, /Drag up across a raised edge: a ramp/);
  find(bar.element, (n) => n.dataset?.heightMode === 'raise').listeners.click[0]();
  bar.setTab('floors'); bar.close();
});

test('main: the Heights tab raises, lays ramps and steps heights on the wheel; walkers, cliff walls and shadows follow', () => {
  const main = read('scripts/main.mjs');
  // Roi: "it doesnt let me raise the ground with a brush". Raise paints as Floors does, a stroke saved as it ends.
  assert.match(main, /if \(heightsOn\(\)\) \{ if \(!heightsDown\(p, e\.shiftKey, e\.altKey\)\) return; state\.down = true; state\.erasing = e\.shiftKey; state\.last = p; draw\(\); floorDab\(p\); return; \}/, 'a stroke on Heights paints');
  assert.match(main, /fl\.heights = \{ height: part \? part\.height : nextHeight\(field\.groundAt\(p\), true, heightStep\(\)\) \};/, 'its part\'s height, or a step over the ground');
  assert.match(main, /const plan = planFloorStroke\(\{ saved: heightSaved\(\), floor: .h\$\{height\}., stroke, erase: fl\.erasing,/, 'grown, joined and rubbed out as floors are');
  assert.match(main, /const stroke = fl\.erasing \? fl\.stroke : cleanSelection\(fl\.stroke, m\.width, m\.height, \[\]\);/, 'live: a stroke over grass left 17 speckled pieces; raised ground is solid');
  assert.match(main, /if \(fl\.heights\) \{ await heightFinish\(\);/);
  // Roi: "how do i make a semi cliff so it's not closed from all sides??", then "Yes, add it".
  assert.match(main, /if \(alt && brushChoices\(\)\.heightMode === "raise"\) \{/, 'Alt-drag on Raise opens an edge');
  assert.match(main, /const touched = open\.circles\.filter\(\(c\) => edgeTouches\(part, c\)\);/, 'saved on each part whose rim it crossed');
  assert.match(main, /rememberDecorStep\(\{ kind: "open", changed \}\)/, 'one step to take back');
  assert.match(main, /if \(heightOpenAt\(part, \{ x, y \}\)\) \{ down = false; continue; \}/, 'the outline left out where an edge is open');
  assert.match(main, /for \(const run of down\) drawSlope\(g, run, \{ grid, step, sun, seed:/, 'open sides shaded as slopes');
  assert.match(main, /for \(const c of part\.open \?\? \[\]\) clip\.drawCircle\(c\.x, c\.y, c\.r \* 0\.9\);/, 'the lit top fading softly down a slope');
  assert.match(main, /else if \(step\.kind === "open"\) \{ for \(const c of step\.changed\) await decorRegion\(c\.id\)\?\.update\(\{ \[`flags\.\$\{ID\}\.openEdges`\]: c\.before \}\); \}/);
  assert.match(main, /wheelHeight\(part, \(e\.deltaY \|\| e\.deltaX\) < 0\)/);
  assert.match(main, /rememberDecorStep\(\{ kind: "height", id: w\.id, before: w\.from, after: w\.height \}\)/, 'a wheel step can be taken back');
  assert.match(main, /else if \(step\.kind === "height"\) await decorRegion\(step\.id\)\?\.update\(\{ \[`flags\.\$\{ID\}\.height`\]: step\.before/);
  assert.match(main, /const target = "CONFIG\.Token\.documentClass\.prototype\._preUpdate";/, 'before Foundry fixes the move');
  assert.match(main, /if \(waypoints\) waypoints\.forEach\(\(w, i\) => \{ w\.elevation = heights\[i\]; \}\);/, 'each waypoint at the ground there');
  assert.match(main, /if \(byHand\(changed\.elevation\) \|\| waypoints\?\.some\(\(w\) => byHand\(w\.elevation\)\)\) return;/, 'an elevation set by hand wins');
  assert.match(main, /made\.push\(\{ c, move: CONST\.WALL_MOVEMENT_TYPES\.NORMAL, sight: none, light: none, sound: none, levels, flags: \{ \[ID\]: \{ cliffOf: id, \.\.\.\(bridge !== null && bridge !== undefined \? \{ bridgeAt: bridge \} : \{\}\) \} \} \}\)/, 'cliff walls stop movement only, and are marked as theirs');
  assert.match(main, /const of = wall\.flags\?\.\[ID\]\?\.cliffOf; if \(!of\) continue;/, 'no other wall is touched');
  // Roi, of look C: "i feel like you can do a much better job"; then, of the painted cliff from his references, "what if it's raised only from one side?", and "ok".
  assert.match(main, /const runs = cliffRuns\(\{ field, step: Math\.max\(3, grid \/ 25\), bounds: canvas\.dimensions\?\.sceneRect \?\? null, climbs: true \}\);/, 'drawn only where the ground drops, the map edge level, whole behind a ladder or rope');
  assert.match(main, /drawCliffRun\(g, run, \{ grid, step, sun, seed: seed \+ i, colours \}\);/);
  assert.match(main, /const higher = parts\.filter\(\(p\) => p\.height > h\);/, 'never over a raised part higher still');
  assert.match(main, /if \(!box\.filters\?\.length\) \{ const Alpha = PIXI\.AlphaFilter \?\? PIXI\.filters\?\.AlphaFilter; if \(!Alpha\) return; const whole = new Alpha\(1\); whole\.padding = grid; box\.filters = \[whole\]; \}/, 'live: erasing straight onto the map punched a black hole');
  assert.match(main, /const kind = brushChoices\(\)\.crossKind, w = kind === "ladder" \? grid\(\) \* 0\.45 : kind === "rope" \? grid\(\) \* 0\.3 : Math\.max\(grid\(\) \* 0\.5, sizeNow\(\) \* grid\(\)\);/, 'a ramp or bridge as wide as the brush, a ladder or rope its own width');
  // Roi: "can we also add option to put ladders/ropes/bridges?" Each drawn as mocked, a ramp hatched.
  assert.match(main, /if \(ramp\.kind === "ladder"\) drawLadder\(built, sh, top\.x, top\.y, foot\.x, foot\.y,/);
  assert.match(main, /drawBridge\(built, sh, ramp\.a\.x, ramp\.a\.y, ramp\.b\.x, ramp\.b\.y,/);
  assert.match(main, /smooth: \(canvas\.grid\?\.size \?\? 100\) \/ 12, bounds: canvas\.dimensions\?\.sceneRect \?\? null \}\)\)/, 'no cliff walls along the map\'s edge');
  assert.match(main, /const heightsSceneOn = \(key, scene = canvas\?\.scene\) => scene\?\.flags\?\.\[ID\]\?\.\[key === "walls" \? "cliffWalls" : "heightShadows"\] !== false;/);
});
