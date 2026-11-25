import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIFTED_MATERIAL, liftedRegionProp, liftedPropUpdate } from '../../../scripts/engines/props/lifted-props.mjs';

// Roi: "when we use lift from map it should be considered as a decoration to be set as breakable".
const tile = (animater = {}) => ({ flags: { animater: { sunlight: 'prop', lifted: true, ...animater } } });
const given = (prop) => JSON.stringify(prop);

test('a lifted thing takes how it breaks from the region it stands in, as a decoration does', () => {
  assert.equal(liftedRegionProp(tile(), null), null);
  assert.equal(liftedRegionProp(tile(), { on: true }), null, 'only where the region says its decorations break');
  assert.deepEqual(liftedRegionProp(tile(), { canBreak: true }), { material: LIFTED_MATERIAL });
  assert.equal(LIFTED_MATERIAL, 'wood');
  assert.deepEqual(liftedRegionProp(tile(), { canBreak: true, prop: { material: 'stone', style: 'topple', nonsense: 1 } }), { material: 'stone', style: 'topple' });
  // A bush or a tree burns, whatever the region's things are made of.
  assert.deepEqual(liftedRegionProp(tile({ sunlight: 'tree' }), { canBreak: true, prop: { material: 'stone', contents: 'water', light: 'yes' } }), { material: 'plant' });
});

test('the region gives a lifted thing its break options, and takes them back', () => {
  const on = { canBreak: true, prop: { material: 'clay', contents: 'water' } };
  // Nothing of its own: the region's are written, and what was written is remembered.
  assert.deepEqual(liftedPropUpdate(tile(), on), { 'flags.animater.prop.material': 'clay', 'flags.animater.prop.contents': 'water', 'flags.animater.liftedProp': given({ material: 'clay', contents: 'water' }) });
  // Already as the region has it: nothing to write.
  const had = tile({ prop: { material: 'clay', contents: 'water' }, liftedProp: given({ material: 'clay', contents: 'water' }) });
  assert.equal(liftedPropUpdate(had, on), null);
  // The region changes its mind: what it gave before and no longer does is taken away.
  assert.deepEqual(liftedPropUpdate(had, { canBreak: true, prop: { material: 'wood' } }), { 'flags.animater.prop.material': 'wood', 'flags.animater.prop.-=contents': null, 'flags.animater.liftedProp': given({ material: 'wood' }) });
  // The region stops breaking, or the thing is moved out of it: all it gave goes; a break it carries is not touched.
  assert.deepEqual(liftedPropUpdate(tile({ prop: { material: 'clay', contents: 'water', broken: { seed: 1 } }, liftedProp: given({ material: 'clay', contents: 'water' }) }), null), { 'flags.animater.prop.-=material': null, 'flags.animater.prop.-=contents': null, 'flags.animater.-=liftedProp': null });
  assert.equal(liftedPropUpdate(tile(), null), null);
  assert.equal(liftedPropUpdate(tile(), { on: true }), null);
});

test("a lifted thing's own choice wins over its region's", () => {
  const on = { canBreak: true, prop: { material: 'clay' } };
  // Set with the brush or in Tile configuration: never written over.
  assert.equal(liftedPropUpdate(tile({ prop: { material: 'stone' } }), on), null);
  assert.equal(liftedPropUpdate(tile({ prop: { material: 'none' } }), on), null, "Won't break is a choice");
  // Changed by hand after the region gave it something: it is the thing's own from then on.
  assert.deepEqual(liftedPropUpdate(tile({ prop: { material: 'stone' }, liftedProp: given({ material: 'clay' }) }), on), { 'flags.animater.-=liftedProp': null });
  // Set back to Automatic by hand (the form saves blanks): the region's again.
  assert.deepEqual(liftedPropUpdate(tile({ prop: { material: '', style: '' }, liftedProp: given({ material: 'clay' }) }), on), { 'flags.animater.prop.material': 'clay', 'flags.animater.liftedProp': given({ material: 'clay' }) });
  // What was remembered cannot be read: treated as nothing given.
  assert.equal(liftedPropUpdate(tile({ prop: { material: 'stone' }, liftedProp: '{' }), on), null);
});

test('only a lifted thing is touched', () => {
  assert.equal(liftedPropUpdate({ flags: { animater: { sunlight: 'prop' } } }, { canBreak: true }), null);
  assert.equal(liftedPropUpdate(null, { canBreak: true }), null);
});

test('the GM keeps the lifted things of a scene in step with its regions', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /import \{ liftedPropUpdate \} from "\.\/engines\/props\/lifted-props\.mjs";/);
  assert.match(main, /const syncLiftedProps = async \(\) => \{/);
  assert.match(main, /game\.users\?\.activeGM\?\.id !== game\.user\?\.id\) return;/);
  assert.match(main, /liftedPropUpdate\(d, region\?\.flags\?\.\[ID\]\?\.decor \?\? null\)/);
  assert.match(main, /for \(const hook of \["createTile", "updateTile", "createRegion", "updateRegion", "deleteRegion"\]\) Hooks\.on\(hook, \(first, changes, options\) => \{ if \(first\?\.parent === canvas\?\.scene && !quietSave\(first, changes, options\)\) liftedSoon\(\); \}\);/);
  assert.match(main, /lifted: \(doc\) => liftedIn\(doc\)\.length/);
});
