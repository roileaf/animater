import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGION_KINDS, regionKindOf, kindFlags, panelSections, moreSections, summaryOf, shownFloorOf, floorOfKind, animalSizeOf, ANIMAL_SIZE, hasRoof, setRoof } from '../../scripts/ui/region-panel-model.mjs';
import { regionAnimalSize } from '../../scripts/engines/motion/region-animals.mjs';

const ids = (kind, own = {}) => panelSections(kind, own).map((s) => s.id);

// Roi: a None choice for regions Animater has nothing to do with (a teleport, a trigger).
test('None: a region with no Animater settings, and the choice that clears them', () => {
  assert.deepEqual(REGION_KINDS[0], ['none', 'fa-ban', 'None']);
  assert.equal(regionKindOf({}, null), 'none'); assert.equal(regionKindOf({}, 'grass'), 'none', 'the floor shown for it is only the scene\'s');
  assert.equal(regionKindOf({ indoors: false, overWater: false, cavern: '', regionAnimals: { cows: '' } }, 'grass'), 'none', 'settings left empty are none');
  assert.equal(regionKindOf({}, 'water'), 'water', 'water by its name stays water'); assert.equal(regionKindOf({ floor: 'grass' }, 'grass'), 'ground');
  assert.equal(regionKindOf({ regionWeather: 'fog' }, 'grass'), 'ground', 'any setting at all and it is Animater\'s');
  assert.deepEqual(panelSections('none', {}), []); assert.deepEqual(moreSections('none', {}), []);
  assert.deepEqual(kindFlags('none', { floor: 'stone', drips: true, keepOut: { rats: true } }), { '-=floor': null, '-=drips': null, '-=keepOut': null });
  assert.equal(regionKindOf({}, 'stone'), 'none', 'cleared, it reads None again');
});

// Roi: Lava, then Dock, did nothing. Every kind, switched to every other, becomes that kind.
test('every kind switches to every other kind', () => {
  // The floor the panel is handed for a region, as the opener works it out: its own, else a cave's when it has cave decor.
  const floorOf = (own) => own.floor || (own.cavern ? 'cavern' : null);
  // Saved as Foundry saves: a `-=key` deletes that key.
  const saved = (own, flags) => { const out = { ...own }; for (const [k, v] of Object.entries(flags)) { if (k.startsWith('-=')) delete out[k.slice(2)]; else out[k] = v; } return out; };
  const start = { none: {}, water: { floor: 'water' }, ground: { floor: 'grass' }, indoors: { floor: 'stone', indoors: true }, cave: { floor: '', cavern: 'fungus-green' }, deck: { floor: 'wood', overWater: true }, lava: { floor: 'lava' } };
  for (const [from] of REGION_KINDS) for (const [to] of REGION_KINDS) {
    if (from === to) continue;
    const own0 = start[from], own = saved(own0, kindFlags(to, own0));
    assert.equal(regionKindOf(own, floorOf(own)), to, `${from} -> ${to}: ${JSON.stringify(own)}`);
  }
});

test('the seven kinds, with their icons and labels', () => {
  assert.deepEqual(REGION_KINDS.map(([id]) => id), ['none', 'water', 'ground', 'indoors', 'cave', 'lava'], 'a dock is Ground with Over water on');
  assert.deepEqual(REGION_KINDS.find(([id]) => id === 'cave'), ['cave', 'fa-mountain', 'Cave']);
});

test('regionKindOf reads the kind off the flags and floor', () => {
  assert.equal(regionKindOf({}, 'water'), 'water');
  assert.equal(regionKindOf({ overWater: true }, 'wood'), 'deck');
  assert.equal(regionKindOf({}, 'lava'), 'lava');
  assert.equal(regionKindOf({}, 'cavern'), 'cave');
  assert.equal(regionKindOf({ cavern: 'fungus-green' }, 'grass'), 'cave');
  assert.equal(regionKindOf({ floor: 'grass' }, 'grass'), 'ground');
  assert.equal(regionKindOf({}, null), 'none', 'no settings at all: None');
  assert.equal(regionKindOf({ drips: true }, 'cavern'), 'cave');
  assert.equal(regionKindOf({ indoors: true }, 'wood'), 'indoors');
  assert.equal(regionKindOf({ indoors: true }, 'water'), 'water');
});

test('kindFlags says what to save to make a region that kind', () => {
  assert.deepEqual(kindFlags('water', {}), { floor: 'water', overWater: false, indoors: false });
  assert.deepEqual(kindFlags('ground', { floor: 'water' }), { floor: 'grass', overWater: false, indoors: false });
  assert.deepEqual(kindFlags('ground', { floor: 'sand' }), { floor: 'sand', overWater: false, indoors: false });
  assert.deepEqual(kindFlags('ground', { floor: 'cavern' }), { floor: 'grass', overWater: false, indoors: false });
  assert.deepEqual(kindFlags('indoors', {}), { floor: 'wood', indoors: true, overWater: false });
  assert.equal(kindFlags('deck', { floor: 'water' }).floor, 'wood');
  assert.deepEqual(kindFlags('deck', { floor: 'stone' }), { overWater: true, floor: 'stone', indoors: false });
  assert.deepEqual(kindFlags('lava', {}), { floor: 'lava', indoors: false });
});

test('a cave has no floor of its own: its decor makes it one, glowing fungus if it has none', () => {
  assert.deepEqual(kindFlags('cave', {}), { indoors: false, floor: '', cavern: 'fungus-green' });
  assert.deepEqual(kindFlags('cave', { cavern: 'webs' }), { indoors: false, floor: '' }, 'its own decor kept');
  assert.equal(regionKindOf({ ...{ floor: 'grass' }, ...kindFlags('cave', { floor: 'grass' }) }, ''), 'cave');
});

test('from lava to a cave, the lava steps go as caveKindFlags takes them', () => {
  assert.deepEqual(kindFlags('cave', { floor: 'lava', steps: [{ name: 'Crust' }], step: 1 }), { indoors: false, floor: '', steps: null, stepsFloor: null, step: 0, stepHidden: false, cavern: 'fungus-green' });
});

test('leaving a kind undoes it: Indoors to Ground, Cave to Water, Cave to Lava', () => {
  const after = (own, kind) => { const next = { ...own, ...kindFlags(kind, own) }; return regionKindOf(next, next.floor); };
  assert.equal(after({ floor: 'wood', indoors: true }, 'ground'), 'ground');
  assert.equal(kindFlags('ground', { floor: 'wood', indoors: true }).indoors, false);
  assert.equal(after({ cavern: 'fungus-green' }, 'water'), 'water');
  assert.equal(kindFlags('water', { cavern: 'fungus-green' }).cavern, '');
  assert.equal(after({ cavern: 'crystals-rose' }, 'lava'), 'lava');
  assert.equal(after({ cavern: 'mist' }, 'deck'), 'deck');
  assert.equal(after({ floor: 'wood', indoors: true }, 'cave'), 'cave');
  assert.ok(!('cavern' in kindFlags('water', {})), 'nothing to undo: no cavern written');
});

test('section icons as the mock has them', () => {
  const icon = (id) => panelSections('water', {}).find((s) => s.id === id)?.icon;
  assert.equal(icon('steps'), 'fa-shoe-prints'); assert.equal(icon('air'), 'fa-cloud-sun'); assert.equal(icon('look'), 'fa-palette');
});

test('panelSections: the sections each kind has, the first open', () => {
  const first = panelSections('water', {})[0];
  assert.equal(first.id, 'water'); assert.equal(first.open, true);
  assert.ok(!ids('water').includes('cavern'));
  assert.deepEqual(ids('water'), ['water', 'steps', 'animals', 'air', 'look']);
  // Decorations show only on a region the brush has painted into (region-panel-decor.test.mjs).
  assert.deepEqual(ids('ground'), ['ground', 'animals', 'steps', 'air', 'look']);
  assert.deepEqual(ids('indoors'), ['ground', 'animals', 'air', 'look']);
  assert.deepEqual(ids('cave'), ['cavern', 'drips', 'air', 'animals']);
  assert.deepEqual(ids('deck'), ['deck', 'steps', 'look']);
  assert.deepEqual(ids('lava'), ['steps', 'air', 'look']);
  for (const [kind] of REGION_KINDS.filter(([id]) => id !== 'none')) {
    const open = panelSections(kind, {}).filter((s) => s.open);
    assert.equal(open.length, 1, kind);
    for (const s of panelSections(kind, {})) assert.ok(s.icon && s.title && typeof s.summary === 'string', `${kind}/${s.id}`);
  }
});

test('on ground the animals section opens when animals are set, else the ground does', () => {
  const open = (own) => panelSections('ground', own).filter((s) => s.open).map((s) => s.id);
  assert.equal(panelSections('ground', { regionAnimals: { cows: 'usual' } }).find((s) => s.id === 'animals').open, true);
  assert.deepEqual(open({ regionAnimals: { cows: 'usual' } }), ['animals']);
  assert.deepEqual(open({}), ['ground']);
});

test('summaryOf: animals in words', () => {
  assert.match(summaryOf('animals', { regionAnimals: { cows: 'usual', dogs: 'few' } }), /3 cows.*a dog/);
  assert.equal(summaryOf('animals', { regionAnimals: { cows: 'usual', sheep: 'usual', dogs: 'usual' } }), '3 cows, 6 sheep, a dog');
  assert.equal(summaryOf('animals', { regionAnimals: { owls: 'many', foxes: 'usual' } }), 'a fox, an owl');
  assert.equal(summaryOf('animals', {}), 'None');
});

test('summaryOf: water, steps, air, cavern, deck, ground', () => {
  assert.equal(summaryOf('water', {}, 'water'), 'Pond · still · medium');
  assert.equal(summaryOf('water', { waterDepth: 'deep' }, 'water'), 'Pond · still · deep');
  assert.match(summaryOf('water', { flowTo: 'e', waterDepth: 'shallow' }, 'water'), /^River · flowing east · shallow$/);
  assert.match(summaryOf('steps', {}, 'grass'), /\(\d+ of \d+\)$/);
  assert.equal(summaryOf('steps', { steps: [{ name: 'Dry', walks: 'grass' }, { name: 'Wet', walks: 'grass' }], step: 1, stepsFloor: 'grass', stepsEdited: true }, 'grass'), 'Wet (2 of 2)');
  assert.equal(summaryOf('air', {}), 'As the scene');
  assert.equal(summaryOf('air', { regionWeather: 'light-snow' }), 'Light Snow');
  assert.equal(summaryOf('cavern', { cavern: 'fungus-green' }, 'cavern'), 'Glowing fungus · In bloom');
  assert.equal(summaryOf('cavern', { cavern: 'crystals-quartz', caveStep: 0 }, 'cavern'), 'Crystals · Dim');
  assert.equal(summaryOf('cavern', {}, 'cavern'), 'Bare');
  assert.equal(summaryOf('deck', { overWater: true }, 'wood'), 'Over water · Plain · shadow');
  assert.equal(summaryOf('deck', { overWater: true, dockStyle: 'railed', castShadow: false }, 'wood'), 'Over water · Railed pier · no shadow');
  assert.equal(summaryOf('ground', { floor: 'grass' }, 'grass'), 'Grass · seasons as the scene');
  assert.equal(summaryOf('ground', { floor: 'sand', season: 'off' }, 'sand'), 'Sand · no seasons');
  assert.equal(summaryOf('ground', { floor: 'sand', season: 'on' }, 'sand'), 'Sand · seasons');
});

test('a drip pool is a Drips setting, not a kind', () => {
  assert.equal(regionKindOf({ floor: 'stone', drips: true, dripDepth: 'pool' }, 'stone'), 'ground');
  assert.equal(regionKindOf({ drips: true, dripDepth: 'deep' }, null), 'ground');
  const own = { floor: 'stone', drips: true, dripDepth: 'pool' };
  assert.deepEqual(kindFlags('ground', own), { floor: 'stone', overWater: false, indoors: false });
  assert.equal(regionKindOf({ ...own, ...kindFlags('indoors', own) }, 'stone'), 'indoors');
});

test('cave: no floor of its own, or a cave-menu growth; room dressing on a floor is not a cave', () => {
  assert.equal(regionKindOf({ floor: 'stone', cavern: 'webs' }, 'stone'), 'ground');
  assert.equal(regionKindOf({ floor: 'stone', cavern: 'webs', indoors: true }, 'stone'), 'indoors');
  assert.equal(regionKindOf({ floor: 'stone', cavern: 'foul' }, 'stone'), 'ground');
  assert.equal(regionKindOf({ cavern: 'webs' }, undefined), 'cave', 'no floor of its own');
  assert.equal(regionKindOf({ cavern: 'mist' }, undefined), 'cave');
  assert.equal(regionKindOf({ floor: 'stone', cavern: 'crystals-rose' }, 'stone'), 'cave', 'a growth');
});

test('kindFlags keeps room dressing between the other kinds, and a sensible floor between Ground and Indoors', () => {
  const room = { floor: 'stone', cavern: 'webs' };
  assert.ok(!('cavern' in kindFlags('ground', room)), 'clicking Ground keeps the cobwebs');
  assert.ok(!('cavern' in kindFlags('indoors', room)));
  assert.ok(!('cavern' in kindFlags('water', room)));
  assert.equal(kindFlags('indoors', room).floor, 'stone', 'a stone room stays stone indoors');
  assert.equal(kindFlags('indoors', { floor: 'dirt' }).floor, 'dirt');
  assert.equal(kindFlags('indoors', { floor: 'grass' }).floor, 'wood', 'grass is no room floor');
  assert.equal(kindFlags('indoors', { floor: 'water' }).floor, 'wood');
  assert.equal(kindFlags('ground', { floor: 'stone', indoors: true }).floor, 'stone');
  assert.equal(kindFlags('water', { cavern: 'fungus-green' }).cavern, '', 'a growth still goes');
  assert.equal(kindFlags('ground', { cavern: 'webs' }).cavern, '', 'a floorless cave of cobwebs stops being one');
});

test('shownFloorOf: one floor for display and controls, by kind, when the region has none of its own', () => {
  assert.equal(shownFloorOf({}, undefined), 'grass');
  assert.equal(shownFloorOf({}, null), 'grass');
  assert.equal(shownFloorOf({ indoors: true }, undefined), 'wood');
  assert.equal(shownFloorOf({ overWater: true }, undefined), 'wood');
  assert.equal(shownFloorOf({ cavern: 'fungus-green' }, undefined), 'cavern');
  assert.equal(shownFloorOf({ cavern: 'webs' }, undefined), 'cavern');
  assert.equal(shownFloorOf({}, 'sand'), 'sand');
  assert.equal(shownFloorOf({ floor: 'stone' }, 'stone'), 'stone');
  assert.equal(floorOfKind('water'), 'water'); assert.equal(floorOfKind('lava'), 'lava'); assert.equal(floorOfKind('ground'), 'grass');
  // The summaries use the same floor.
  assert.equal(panelSections('ground', {}).find((s) => s.id === 'ground').summary, summaryOf('ground', {}, 'grass'));
  assert.equal(panelSections('indoors', { indoors: true }).find((s) => s.id === 'ground').summary, summaryOf('ground', {}, 'wood'));
});

test('a section set off its defaults always shows; the others wait under More sections', () => {
  assert.ok(ids('deck', { overWater: true, regionWeather: 'fog' }).includes('air'), 'dock with its own weather');
  assert.ok(!ids('deck', { overWater: true }).includes('air'));
  assert.ok(ids('ground', { floor: 'stone', drips: true }).includes('drips'), 'a stone room with drips');
  assert.ok(ids('cave', { cavern: 'mist', tokenshade: 'Haunted' }).includes('look'));
  assert.ok(ids('lava', { regionAnimals: { rats: 'few' } }).includes('animals'));
  assert.ok(ids('deck', { overWater: true, tavern: true }).includes('air'));
  assert.ok(ids('cave', { cavern: 'mist', steps: [{ name: 'A' }], stepsEdited: true }).includes('steps'));
  assert.ok(ids('deck', { overWater: true, keepOut: { rats: true } }).includes('animals'));
  assert.ok(!ids('deck', { overWater: true, keepOut: { rats: false } }).includes('animals'), 'an unticked box is the default');
  assert.ok(ids('ground', { floor: 'stone', cavern: 'webs' }).includes('air'), 'room dressing lives in Air');
  const more = (kind, own = {}) => moreSections(kind, own).map((s) => s.id);
  assert.ok(more('cave', { cavern: 'mist' }).includes('look'), 'Cave offers Look');
  assert.ok(more('cave', { cavern: 'mist' }).includes('steps'));
  assert.ok(!more('cave', { cavern: 'mist', tokenshade: 'Haunted' }).includes('look'), 'not when it already shows');
  assert.deepEqual(more('ground', {}), ['drips']);
  assert.ok(!more('water', {}).includes('drips'), 'water holds its drips in its own section');
  for (const s of moreSections('deck', {})) assert.ok(s.icon && s.title, s.id);
  // Every optional section is either shown or offered, for every kind.
  // (None holds nothing: picking a kind is the way back.)
  for (const [kind] of REGION_KINDS.filter(([k]) => k !== 'none')) for (const id of ['air', 'animals', 'look', 'steps']) assert.ok(ids(kind).includes(id) || more(kind).includes(id), `${kind}/${id}`);
  assert.deepEqual(panelSections('deck', { overWater: true }, 'wood', ['air']).map((s) => s.id), ['deck', 'steps', 'look', 'air'], 'one added by hand');
});

test('animalSizeOf: a number from 0.5 to 2, old words kept', () => {
  assert.deepEqual(ANIMAL_SIZE, { min: 0.5, max: 2, step: 0.05 });
  assert.equal(animalSizeOf({}), 1);
  assert.equal(animalSizeOf(), 1);
  assert.equal(animalSizeOf({ regionAnimalSize: 'small' }), 0.75);
  assert.equal(animalSizeOf({ regionAnimalSize: 'big' }), 1.3);
  assert.equal(animalSizeOf({ regionAnimalSize: 1.6 }), 1.6);
  assert.equal(animalSizeOf({ regionAnimalSize: 9 }), 2);
  assert.equal(animalSizeOf({ regionAnimalSize: 0.1 }), 0.5);
  assert.equal(animalSizeOf({ regionAnimalSize: 'huge' }), 1);
  assert.equal(regionAnimalSize({ regionAnimalSize: 1.6 }), 1.6);
  assert.equal(regionAnimalSize({ regionAnimalSize: 'big' }), 1.3);
});

test('a roof is a Suppress Weather behavior: added when there is none, switched on and off when there is', async () => {
  const made = [], changed = [];
  const doc = (behaviors) => ({ behaviors, createEmbeddedDocuments: async (n, d) => made.push([n, d]), updateEmbeddedDocuments: async (n, d) => changed.push([n, d]) });
  assert.equal(hasRoof(doc([])), false);
  assert.equal(hasRoof(doc([{ id: 'b', type: 'suppressWeather', disabled: true }])), false, 'switched off: no roof');
  assert.equal(hasRoof(doc([{ id: 'b', type: 'suppressWeather' }])), true);
  await setRoof(doc([{ id: 't', type: 'teleportToken' }]), true);
  assert.deepEqual(made, [['RegionBehavior', [{ name: 'Roof', type: 'suppressWeather' }]]]);
  await setRoof(doc([{ id: 'b', type: 'suppressWeather', disabled: true }]), true);
  await setRoof(doc([{ id: 'b', type: 'suppressWeather' }]), false);
  assert.deepEqual(changed, [['RegionBehavior', [{ _id: 'b', disabled: false }]], ['RegionBehavior', [{ _id: 'b', disabled: true }]]], 'one set up by hand is only switched, never deleted');
  assert.equal(await setRoof(doc([]), false), null, 'no roof to take off: nothing done');
});
