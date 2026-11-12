import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shapeKey } from '../../../scripts/engines/motion/floor-looks.mjs';
import { lookKey } from '../../../scripts/engines/motion/decorations.mjs';
import { floorSlot } from '../../../scripts/engines/motion/floor-slot.mjs';

// The audit of how floors, decorations and heights are drawn (Roi: "audit our process of drawing floors\decorations\heights
// elements", then "Fix all of them").
const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');

test('a floor look is keyed by its holes too, so a new hole repaints it', () => {
  const outline = () => Object.assign([0, 0, 100, 0, 100, 100, 0, 100], { holes: [] });
  const holed = outline(); holed.holes = [[40, 40, 60, 40, 60, 60]];
  assert.notEqual(shapeKey([outline()]), shapeKey([holed]));
  assert.equal(shapeKey([outline()]), shapeKey([outline()]));
});

test('decorations are keyed by snow only where they have trees', () => {
  const look = { season: 'winter', snow: 0.75 };
  assert.equal(lookKey({ settings: { kinds: { crate: {} } }, look }).snow, 0, 'crates take their snow from the light');
  assert.equal(lookKey({ settings: { kinds: { oak: {} } }, look }).snow, 0.75, 'a tree\'s crown carries its own');
  assert.equal(lookKey({ settings: { kinds: {}, brushed: [{ kind: 'pine' }] }, look }).snow, 0.75, 'a brushed tree too');
});

test('a floor drawn on a tile sits half a step over it, never tied with the next tile', () => {
  assert.equal(floorSlot({ id: { kind: 'tile', tileId: 't' }, role: 'floor', elevation: 0, sort: 3 }, 'floorLooks').sort, 3.5);
});

test('the clock and unrelated changes build nothing again; the brush and heights only what changed', () => {
  assert.match(main, /const lookSunlit = \(\) => \{[^\n]*decorationsLook\(\)/, 'the clock only looks at the decorations\' key');
  assert.match(main, /const decorationsLook = \(force = false\) => \{ const key = decorWeatherNow\(\); if \(force \|\| key !== decorWeatherKey\)/);
  assert.match(main, /if \(hook === "updateSetting"\) return String\(first\?\.key \?\? ""\)\.startsWith\(`\$\{ID\}\.`\);/, 'only this module\'s settings');
  assert.match(main, /if \(hook === "updateScene"\) return first\?\.id === canvas\?\.scene\?\.id;/, 'only this scene');
  assert.match(main, /if \(options\?\.animaterGround\) return false;/, 'not the ground weather\'s saves');
  assert.match(main, /decorBrushSyncSoon\(\);/, 'a dab shows again at most every tenth of a second');
  assert.match(main, /if \(key !== decorTreesKey && !decorBrushing\)/, 'no canopy rebuild mid-stroke');
  assert.match(main, /if \(key === heightsDrawn\.key && value === heightsDrawn\.value && roots\[1\] === heightsDrawn\.root\) return;/, 'heights drawn again only when they change');
  assert.match(main, /for \(const box of shadowRoot\.children\) stillPicture\(box\);/, 'blurred shadows drawn once into a picture');
  assert.match(main, /const decorBrushRoot = floorLayer\("decorBrush"\);/, 'one brush layer, made once');
  assert.match(main, /flat: decorDrawRoot\("decorFlat"\), shadows: decorDrawRoot\("decorShadows"\), ground: decorDrawRoot\("decorations"\), above: decorDrawRoot\("decorCrowns"\)/, 'decorations on their tile');
});