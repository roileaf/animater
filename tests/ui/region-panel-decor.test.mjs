import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moreSections, panelSections, summaryOf } from '../../scripts/ui/region-panel-model.mjs';
import { decorSettings } from '../../scripts/engines/motion/decor-regions.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('the Decorations section: its summary says where, how many kinds and what was painted by hand', () => {
  assert.equal(summaryOf('decor', {}), 'None');
  assert.equal(summaryOf('decor', { decor: { on: true, where: 'cave', kinds: { rock: {}, bones: { off: true } }, brushed: [{}, {}] } }), 'Underground, 1 kind, 2 by hand');
  assert.equal(summaryOf('decor', { decor: { on: true, kinds: { rock: {}, oak: {} } } }), 'Outdoors, 2 kinds');
});

test('any region whose decorations are on shows the section; others can add it', () => {
  assert.ok(panelSections('water', { decor: { on: true } }).some((s) => s.id === 'decor'));
  assert.ok(moreSections('water', {}).some((s) => s.id === 'decor'));
});

test('an unticked kind keeps its size and amount but scatters nothing', () => {
  const s = decorSettings({ on: true, kinds: { rock: { size: 2, amount: 1, off: true }, oak: { size: 1, amount: 1 } } });
  assert.deepEqual(Object.keys(s.kinds), ['oak']);
});

test('the panel saves each control into the region\'s decor flag, and offers the brush', () => {
  const sections = read('scripts/ui/region-panel-sections.mjs');
  assert.match(sections, /decor: decorSection/);
  for (const saved of ['decor: { where', 'decor: { density', 'decor: { scale', 'decor: { seed', 'decor: { brushed: \\[\\], erased: \\[\\] }', 'decor: { kinds:']) assert.match(sections, new RegExp(saved));
  assert.match(sections, /c\.brush\(doc\)/);
  const main = read('scripts/main.mjs');
  assert.match(main, /createRegionPanel\(\{ brush: \(doc\) => startDecorBrush\(doc\)/);
  assert.match(main, /decorSettings\(region\.flags\?\.\[ID\]\?\.decor\)/);
});

test('a brush stroke on open ground makes a region of circles along it, not one every dab', async () => {
  const { strokeShapes, circleArea } = await import('../../scripts/engines/motion/decor-regions.mjs');
  const dabs = Array.from({ length: 20 }, (_, i) => [100 + i * 10, 200, 60]), shapes = strokeShapes(dabs);
  assert.ok(shapes.length >= 5 && shapes.length < 20);
  for (const s of shapes) { assert.equal(s.type, 'ellipse'); assert.equal(s.radiusX, 60); assert.equal(s.hole, false); }
  assert.equal(strokeShapes([]).length, 0);
  assert.equal(circleArea(0, 0, 10).length, 32);
});

test('the brush bar offers each place its own kinds and remembers what is ticked', async () => {
  const { brushKindsFor, brushChoices } = await import('../../scripts/ui/decor-brush-bar.mjs');
  assert.ok(brushKindsFor('surface').includes('oak') && !brushKindsFor('surface').includes('stalagmite'));
  assert.ok(brushKindsFor('cave').includes('stalagmite') && brushKindsFor('cave').includes('rock'));
  const c = brushChoices(); assert.equal(c.where, 'surface'); assert.ok(c.size > 0 && c.thick > 0);
  // It paints one kind at a time: picking a chip puts out the one lit before.
  assert.equal(c.kinds.length, 1);
  const bar = read('scripts/ui/decor-brush-bar.mjs');
  assert.match(bar, /c\.addEventListener\('click', \(\) => \{ remembered\.kinds\[remembered\.where\] = \[id\]; draw\(\); onChange\(\); \}\);/);
  assert.doesNotMatch(bar, /Select all/);
  // Its Decoration size scales what it lays, on open ground and on top of a region's own scale.
  assert.equal(c.scale, 1);
  assert.match(bar, /slider\('Decoration size', BRUSH_SCALE, 'scale', 0\.1\)/);
  const main = read('scripts/main.mjs');
  assert.match(main, /density: c\.thick, scale: c\.scale \}/);
  assert.match(main, /scale: s\.scale \* brushChoices\(\)\.scale \}/);
});

test('the Decorations tool sits in Animater\'s controls and can be hidden', () => {
  const main = read('scripts/main.mjs');
  assert.match(main, /name: "animaterDecorate"[^\n]*icon: "fa-solid fa-tree"[^\n]*visible: toolShown\("toolDecorate"\)/);
  assert.match(main, /onChange: \(\) => \(decorBrushing \? stopDecorBrush\(\) : startDecorBrush\(\)\)/);
  assert.match(main, /\['toolDecorate','Show the Decorations button'/);
  assert.match(main, /const data = \{ name: "Decorations", color: "#7a9a4a", shapes: strokeShapes\(circles\)/);
  assert.match(main, /await canvas\.scene\.createEmbeddedDocuments\("Region", \[data\]\)/);
  assert.match(read('scripts/ui/settings-window.mjs'), /\{ local: "toolDecorate" \}/);
  // A stroke is heard on the window first and kept from Foundry's canvas, so its drag-select box never shows.
  assert.match(main, /window\.addEventListener\("pointerdown", down, true\); window\.addEventListener\("pointermove", move, true\)/);
  assert.match(main, /if \(e\.button !== 0\) return; e\.stopImmediatePropagation\(\); e\.preventDefault\(\);/);
  // Panning (a right-drag) keeps the brush; a right-click that stays put stops it.
  assert.match(main, /if \(e\.button === 2\) \{ state\.rightAt = \{ x: e\.clientX, y: e\.clientY \}; return; \}/);
  assert.match(main, /Math\.hypot\(e\.clientX - from\.x, e\.clientY - from\.y\) > 6\) return;/);
});

test('Ctrl+Z takes back a brush stroke and Ctrl+Shift+Z or Ctrl+Y puts it back, ahead of Foundry\'s own undo', () => {
  const main = read('scripts/main.mjs');
  assert.match(main, /rememberDecorStep\(\{ kind: "edit", id: target\.id, before: \{ brushed: before\.brushed, erased: before\.erased \}, after \}\)/);
  assert.match(main, /rememberDecorStep\(\{ kind: "create", id: made\.id, data \}\)/);
  assert.match(main, /if \(undo \|\| redo\) \{ e\.preventDefault\(\); e\.stopImmediatePropagation\(\);/);
  // Taken back, a stroke into a region restores what it held; one that made a region deletes it; put back makes it again.
  assert.match(main, /if \(step\.kind === "edit"\) await decorRegion\(step\.id\)\?\.update\(\{ flags: \{ \[ID\]: \{ decor: step\.before \} \} \}/);
  assert.match(main, /else await decorRegion\(step\.id\)\?\.delete\(\);/);
  assert.match(main, /const \[made\] = await canvas\.scene\.createEmbeddedDocuments\("Region", \[step\.data\]\); if \(made\) step\.id = made\.id;/);
  assert.match(read('scripts/ui/decor-brush-bar.mjs'), /Ctrl\+Z undo/);
});

test('the wheel still zooms; Ctrl+wheel sets the brush size and Shift+wheel its density', () => {
  const main = read('scripts/main.mjs'), bar = read('scripts/ui/decor-brush-bar.mjs');
  assert.match(main, /if \(e\.target !== view \|\| !\(e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey \|\| e\.altKey\)\) return;/);
  assert.match(main, /if \(e\.shiftKey && !\(e\.ctrlKey \|\| e\.metaKey\)\) \{ if \(free\) state\.bar\?\.setThick\(brushChoices\(\)\.thick \+ \(up \? 0\.1 : -0\.1\)\); \}/);
  assert.match(main, /window\.addEventListener\("wheel", wheel, \{ capture: true, passive: false \}\)/);
  assert.match(main, /window\.removeEventListener\("wheel", wheel, \{ capture: true \}\)/);
  assert.match(bar, /setThick: \(v\) =>/);
  assert.match(bar, /Ctrl\+wheel: size · Shift\+wheel: density/);
  // Alt+wheel: the decorations' own size.
  assert.match(main, /if \(e\.altKey && !\(e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey\)\) state\.bar\?\.setScale\(brushChoices\(\)\.scale \+ \(up \? 0\.1 : -0\.1\)\);/);
  assert.match(bar, /setScale: \(v\) =>/);
  assert.match(bar, /Alt\+wheel: decoration size/);
});

test('decorations feed the other engines: canopy trees, moving water, the cavern', () => {
  const main = read('scripts/main.mjs');
  assert.match(main, /\[\.\.\.tree, \.\.\.decorations\.trees\(\)\]/);
  assert.match(main, /for \(const pool of decorations\.water\(\)\)/);
  assert.match(main, /decor = decorations\.cavern\(\)/);
  assert.match(main, /decorations\.creatures\(tokensOnFloor\(\)\); decorations\.tick\(seconds\)/);
});

test('a ghost of the next dab follows the brush, changes with the bar, and a click lays exactly it', () => {
  const main = read('scripts/main.mjs');
  assert.match(main, /floorLayer\("decorBrush", 1102\)\(\)\.addChild\(ghost, ring\)/);
  assert.match(main, /openBrushBar\(\{ onClose: \(\) => stopDecorBrush\(\), onChange: \(\) => draw\(\) \}\)/);
  assert.match(main, /const showGhost = !!state\.at && !state\.down && !state\.erasing; ghost\.visible = showGhost;/);
  assert.match(main, /if \(first && state\.ghostItems\.length\) \{ for \(const g of state\.ghostItems\)/);
  assert.match(main, /dab\(p, e\.shiftKey, true\)/);
  assert.match(read('scripts/engines/motion/decorations.mjs'), /sprite\(d, look = \{\}\) \{ const \{ pic, scale \} = picture\(d, look\);/);
});
