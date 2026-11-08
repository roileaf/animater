import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGION_KINDS, regionKindOf, kindFlags, panelSections, summaryOf, animalSizeOf, ANIMAL_SIZE } from '../../scripts/ui/region-panel-model.mjs';
import { regionAnimalSize } from '../../scripts/engines/motion/region-animals.mjs';

const ids = (kind, own = {}) => panelSections(kind, own).map((s) => s.id);

test('the six kinds, with their icons and labels', () => {
  assert.deepEqual(REGION_KINDS.map(([id]) => id), ['water', 'ground', 'indoors', 'cave', 'deck', 'lava']);
  assert.deepEqual(REGION_KINDS.find(([id]) => id === 'deck'), ['deck', 'fa-bridge', 'Dock']);
  assert.deepEqual(REGION_KINDS.find(([id]) => id === 'cave'), ['cave', 'fa-mountain', 'Cave']);
});

test('regionKindOf reads the kind off the flags and floor', () => {
  assert.equal(regionKindOf({}, 'water'), 'water');
  assert.equal(regionKindOf({ overWater: true }, 'wood'), 'deck');
  assert.equal(regionKindOf({}, 'lava'), 'lava');
  assert.equal(regionKindOf({}, 'cavern'), 'cave');
  assert.equal(regionKindOf({ cavern: 'fungus-green' }, 'grass'), 'cave');
  assert.equal(regionKindOf({}, 'grass'), 'ground');
  assert.equal(regionKindOf({}, null), 'ground');
  assert.equal(regionKindOf({ drips: true, dripDepth: 'pool' }, null), 'water');
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
  assert.deepEqual(ids('ground'), ['ground', 'animals', 'steps', 'air', 'look']);
  assert.deepEqual(ids('indoors'), ['ground', 'animals', 'air', 'look']);
  assert.deepEqual(ids('cave'), ['cavern', 'drips', 'air', 'animals']);
  assert.deepEqual(ids('deck'), ['deck', 'steps', 'look']);
  assert.deepEqual(ids('lava'), ['steps', 'air', 'look']);
  for (const [kind] of REGION_KINDS) {
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
  assert.equal(summaryOf('deck', { overWater: true }, 'wood'), 'Plain · shadow');
  assert.equal(summaryOf('deck', { overWater: true, dockStyle: 'railed', castShadow: false }, 'wood'), 'Railed pier · no shadow');
  assert.equal(summaryOf('ground', { floor: 'grass' }, 'grass'), 'Grass · seasons as the scene');
  assert.equal(summaryOf('ground', { floor: 'sand', season: 'off' }, 'sand'), 'Sand · no seasons');
  assert.equal(summaryOf('ground', { floor: 'sand', season: 'on' }, 'sand'), 'Sand · seasons');
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
