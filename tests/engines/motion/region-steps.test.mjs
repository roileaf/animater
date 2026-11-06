import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOORS } from '../../../scripts/engines/motion/movement-feel.mjs';
import { STEP_EFFECTS, STEP_LOOKS, TEXTURE_STYLES, textureStyleOf, activeStep, changeStep, defaultSteps, STEP_SCALE, stepScale, fallWindAngle, flowChoices, noLifeOnWater, WATER_KINDS, waterFlows, waterKindFlags, waterKindOf, floodedByStep, unfitForLife, paintsOverWater, setStepSpeed, setStepStrength, stepStrength, STEP_STRENGTH, showsTexture, spreadFrom, stepEdge, stepFlags, takesSeason, stepLook, stepMenu, textureFloor } from '../../../scripts/engines/motion/region-steps.mjs';

test('a step\'s look strength is kept to its range, as painted when unset or nonsense', () => {
  assert.equal(stepStrength({}), STEP_STRENGTH.usual);
  assert.equal(stepStrength({ strength: 'much' }), STEP_STRENGTH.usual);
  assert.equal(stepStrength({ strength: 9 }), STEP_STRENGTH.max);
  assert.equal(stepStrength({ strength: 0 }), STEP_STRENGTH.min);
  assert.equal(stepStrength({ strength: 1.4 }), 1.4);
});

test('look strength belongs to the step it was set on, and the layers are told it', () => {
  const list = defaultSteps('grass'), blood = list.findIndex((s) => s.look === 'blood');
  const own = { ...changeStep({}, 'grass', blood), floor: 'grass' };
  const saved = { ...own, ...setStepStrength(own, 'grass', 1.6) };
  assert.equal(saved.steps[blood].strength, 1.6);
  assert.equal(stepLook(saved, 'grass').strength, 1.6);
  assert.equal(stepMenu(saved, 'grass').strength, 1.6);
  const other = { ...saved, step: list.findIndex((s) => s.look === 'frost') };
  assert.equal(stepLook(other, 'grass').strength, STEP_STRENGTH.usual);
});

test('look strength survives the presets being merged in, and a step with no look offers none', () => {
  const list = defaultSteps('grass'), blood = list.findIndex((s) => s.look === 'blood');
  const own = { floor: 'grass', stepsFloor: 'grass', step: blood, steps: list.map((s, i) => (i === blood ? { ...s, strength: 0.5 } : s)) };
  assert.equal(stepMenu(own, 'grass').strength, 0.5);
  assert.equal(stepMenu({ ...own, step: 0 }, 'grass').strength, null);
  assert.equal(stepMenu({ floor: 'grass' }, 'grass').strength, null);
});

test('a kind of water is said outright, else goes by its flow, and the ticks are their own', () => {
  assert.equal(waterKindOf({}), 'still');
  assert.equal(waterKindOf({ flowTo: 's' }), 'river');
  assert.equal(waterKindOf({ flowTo: 's', waterfall: true }), 'river');
  assert.equal(waterKindOf({ sea: true }), 'still');
  assert.equal(waterKindOf({ waterKind: 'rapids', flowTo: 's' }), 'rapids');
  assert.equal(waterKindOf({ waterKind: 'constructor', flowTo: 's' }), 'river');
  assert.deepEqual(WATER_KINDS.map(([k]) => k), ['still', 'river', 'rapids', 'falls', 'sea']);
});

test('choosing a kind sets how it runs and leaves the waterfall and sea ticks alone', () => {
  assert.deepEqual(waterKindFlags({}, 'falls'), { waterKind: 'falls', flowTo: 's', current: 'swift' });
  assert.equal('waterfall' in waterKindFlags({ waterfall: true }, 'river'), false);
  assert.equal('sea' in waterKindFlags({}, 'sea'), false);
  assert.equal(waterKindFlags({ flowTo: 'e' }, 'river').flowTo, 'e');
  assert.equal(waterKindFlags({ flowTo: 'e', current: 'slow' }, 'river').current, undefined);
  assert.deepEqual(waterKindFlags({ flowTo: 'e', waterfall: true }, 'still'), { waterKind: 'still', flowTo: '', current: '' });
  assert.equal(waterKindFlags({}, 'rapids').current, 'swift');
  for (const [kind, flows] of [['still', false], ['river', true], ['rapids', true], ['falls', true], ['sea', false]]) assert.equal(waterFlows(kind), flows);
});

test('ground a step floods is no pond, real water is', () => {
  const grass = defaultSteps('grass'), stone = defaultSteps('stone');
  const onStep = (floor, steps, name) => ({ floor, stepsFloor: floor, steps, step: steps.findIndex((s) => s.name === name) });
  assert.equal(floodedByStep(onStep('stone', stone, 'Flooded'), 'stone'), true);
  assert.equal(floodedByStep(onStep('stone', stone, 'Dry'), 'stone'), false);
  assert.equal(floodedByStep(onStep('grass', grass, 'Frost-bitten'), 'grass'), false);
  assert.equal(floodedByStep({ floor: 'water' }, 'water'), false);
  const water = defaultSteps('water');
  assert.equal(floodedByStep(onStep('water', water, 'Clear'), 'water'), false);
  assert.equal(floodedByStep({ ...onStep('stone', stone, 'Flooded'), stepHidden: true }, 'stone'), false);
});

test('water counts as painted over the map when a look or texture covers it', () => {
  const water = defaultSteps('water'), onStep = (name) => ({ floor: 'water', stepsFloor: 'water', steps: water, step: water.findIndex((s) => s.name === name) });
  assert.equal(paintsOverWater(onStep('Clear'), 'water', undefined), false);
  assert.equal(paintsOverWater(onStep('Bloody'), 'water', undefined), true);
  assert.equal(paintsOverWater({ floor: 'water', texture: 'on' }, 'water', undefined), true);
  assert.equal(paintsOverWater({ floor: 'water' }, 'water', undefined), false);
});

test('every floor starts with steps of its own, the first leaving it as painted', () => {
  for (const floor of FLOORS) {
    const list = defaultSteps(floor);
    assert.ok(list.length >= 3, `${floor} has steps`);
    assert.equal(list[0].look, 'none', `${floor} starts as painted`);
    assert.equal(list[0].effect, '', `${floor} starts with no effect`);
    for (const step of list) {
      assert.ok(step.name, `${floor}: a step has a name`);
      assert.ok(step.look in STEP_LOOKS, `${floor}/${step.name}: a look that is drawn`);
      assert.ok(FLOORS.includes(step.walks), `${floor}/${step.name}: walks on a real floor`);
      assert.ok(STEP_EFFECTS.some(([v]) => v === step.effect), `${floor}/${step.name}: an effect Animater has`);
    }
    assert.ok(list.some((s) => s.look === 'blood'), `${floor} can be bloodied`);
  }
  assert.deepEqual(defaultSteps('no such floor'), [], 'no floor, no steps');
});

test('default steps are copies, so editing one leaves the next region alone', () => {
  defaultSteps('grass')[0].name = 'Changed';
  assert.notEqual(defaultSteps('grass')[0].name, 'Changed');
});

test('a region with no steps is left exactly as it was', () => {
  const own = { floor: 'grass' };
  assert.equal(activeStep(own), null);
  assert.equal(stepFlags(own), own);
  assert.equal(stepFlags(undefined), undefined);
  assert.equal(stepLook(own, 'grass').look, 'none');
});

test('the current step decides the floor, the cave effect and the river speed', () => {
  const steps = [
    { name: 'Plain', look: 'none', walks: 'stone', effect: '' },
    { name: 'Vents', look: 'none', walks: 'stone', effect: 'steam' },
    { name: 'Flooded', look: 'wet', walks: 'water', effect: 'drips', speed: 'slow' },
    { name: 'Rushing', look: 'none', walks: 'water', effect: '', speed: 'gentle' },
  ];
  const own = (step) => ({ floor: 'stone', cavern: 'webs', current: 'swift', steps, step });
  assert.equal(stepFlags(own(1)).cavern, 'steam');
  assert.equal(stepFlags(own(0)).cavern, 'webs', 'no effect in the step keeps what the region was given');
  const flooded = stepFlags(own(2));
  assert.equal(flooded.floor, 'water'); assert.equal(flooded.drips, true); assert.equal(flooded.current, 'slow'); assert.equal(flooded.cavern, 'webs');
  assert.equal(stepFlags(own(3)).current, '', 'gentle is the river dropdown\'s empty choice');
  assert.equal(own(1).cavern, 'webs', 'the flags themselves are not touched');
});

test('a hidden step does nothing until it is shown again', () => {
  const own = { floor: 'grass', steps: defaultSteps('grass'), step: 2, stepHidden: true };
  assert.equal(activeStep(own), null);
  assert.equal(stepLook(own, 'grass').look, 'none');
  assert.equal(activeStep({ ...own, stepHidden: false }).look, 'blood');
});

test('a step index out of range falls back to the first step', () => {
  const steps = defaultSteps('grass');
  assert.equal(activeStep({ steps, step: 99 }), steps[0]);
  assert.equal(activeStep({ steps, step: -1 }), steps[0]);
  assert.equal(activeStep({ steps, step: 'x' }), steps[0]);
});

test('changing step saves the list, the step and where it was clicked', () => {
  const change = changeStep({ floor: 'grass' }, 'grass', 2, { x: 10, y: 20 });
  assert.equal(change.step, 2);
  assert.deepEqual(change.stepAt, { x: 10, y: 20 });
  assert.equal(change.steps.length, defaultSteps('grass').length);
  const size = change.steps.length;
  assert.equal(changeStep(change, 'grass', size).step, 0, 'next from the last goes round to the first');
  assert.equal(changeStep(change, 'grass', -1).step, size - 1);
  assert.equal(changeStep(change, 'grass', 1).stepAt, null, 'no click, no spot to spread from');
  const own = { steps: [{ name: 'Mine', look: 'wet', walks: 'stone', effect: '' }, { name: 'Two', look: 'none', walks: 'stone', effect: '' }] };
  assert.equal(changeStep(own, 'grass', 1).steps[0].name, 'Mine', 'a list of the GM\'s own is kept');
});

test('a step\'s look comes with how it changes', () => {
  const own = { floor: 'water', steps: defaultSteps('water'), step: 1, stepAt: { x: 5, y: 6 }, stepHow: 'fade', stepSeconds: 3, flowTo: 's' };
  const spec = stepLook(own, 'water');
  assert.equal(spec.look, own.steps[1].look); assert.equal(spec.how, 'fade'); assert.equal(spec.seconds, 3); assert.deepEqual(spec.at, { x: 5, y: 6 }); assert.equal(spec.flowTo, 's'); assert.equal(spec.cover, true);
  const plain = stepLook({ steps: defaultSteps('grass'), step: 2 }, 'grass');
  assert.equal(plain.how, 'spread'); assert.equal(plain.seconds, 6); assert.equal(plain.cover, false);
  assert.equal(stepLook({ steps: defaultSteps('grass'), step: 2, stepSeconds: 0 }, 'grass').seconds, 0, 'at once');
  assert.equal(stepLook({ steps: defaultSteps('grass'), step: 2, stepSeconds: -5 }, 'grass').seconds, 6, 'nonsense is the usual');
});

test('the menu offers a floor its own steps, and water its speed and reflections', () => {
  const grass = stepMenu({ floor: 'grass' }, 'grass');
  assert.deepEqual(grass.steps, defaultSteps('grass').map((s) => s.name));
  assert.equal(grass.current, 0);
  assert.equal(grass.speed, null, 'no speed on grass'); assert.equal(grass.reflections, null);
  const river = stepMenu({ floor: 'water', flowTo: 's', current: 'slow' }, 'water');
  assert.equal(river.speed, 'slow'); assert.equal(river.reflections, true);
  assert.equal(stepMenu({ floor: 'water' }, 'water').speed, null, 'still water has no speed');
  assert.equal(stepMenu({ floor: 'water', reflections: 'off' }, 'water').reflections, false);
  const frozen = defaultSteps('water').findIndex((s) => s.walks === 'ice');
  assert.equal(stepMenu({ floor: 'water', flowTo: 's', steps: defaultSteps('water'), step: frozen }, 'water').speed, null, 'frozen, it has no speed');
});

test('a step\'s speed is saved on that step alone', () => {
  const own = { floor: 'water', flowTo: 's', steps: defaultSteps('water'), step: 1 };
  const change = setStepSpeed(own, 'water', 'swift');
  assert.equal(change.steps[1].speed, 'swift');
  assert.equal(change.steps[0].speed, undefined);
  assert.equal(own.steps[1].speed, undefined, 'the region\'s own list is not touched until it is saved');
});

test('a change spreads from the click, a river from upstream, with nothing out of reach', () => {
  const box = [0, 0, 100, 0, 100, 300, 0, 300];
  const clicked = spreadFrom([box], { x: 50, y: 50 }, '');
  assert.deepEqual([clicked.x, clicked.y], [50, 50]);
  assert.ok(clicked.reach >= Math.hypot(50, 250));
  const river = spreadFrom([box], { x: 50, y: 50 }, 's');
  assert.equal(river.y, 0, 'south-flowing water starts at the north end');
  assert.ok(river.reach >= 300);
  assert.equal(spreadFrom([box], null, '').y, 150, 'no click: the middle');
  assert.equal(spreadFrom([], null, ''), null);
});

test('a painted map stays as it is until the scene or the region asks for a floor texture', () => {
  assert.equal(showsTexture({}, undefined), false);
  assert.equal(showsTexture({}, 'on'), true);
  assert.equal(showsTexture({ texture: 'on' }, ''), true);
  assert.equal(showsTexture({ texture: 'off' }, 'on'), false, 'the region has the last word');
});

test('the texture follows the floor the step walks as', () => {
  const steps = defaultSteps('water'), frozen = steps.findIndex((s) => s.walks === 'ice');
  assert.equal(textureFloor({}, 'water'), 'water');
  assert.equal(textureFloor({ steps, step: frozen }, 'water'), 'ice');
  assert.equal(textureFloor({ steps, step: frozen, stepHidden: true }, 'water'), 'water');
});

test('changing a region\'s floor leaves its old list behind, and changing back brings it back', () => {
  const grass = defaultSteps('grass'), own = { floor: 'stone', steps: grass, step: 1 };
  assert.equal(activeStep(own), null, 'grass steps do not apply to stone');
  assert.equal(stepFlags(own), own, 'so the floor set is the floor walked on');
  assert.equal(textureFloor(own, 'stone'), 'stone');
  assert.equal(stepLook(own, 'stone').look, 'none');
  const menu = stepMenu(own, 'stone');
  assert.deepEqual(menu.steps, defaultSteps('stone').map((s) => s.name), 'the menu offers stone\'s own list');
  assert.equal(menu.current, 0);
  const change = changeStep(own, 'stone', 1);
  assert.equal(change.steps[0].walks, 'stone', 'a step chosen now saves stone\'s list');
  assert.equal(change.stepsFloor, 'stone');
  assert.equal(activeStep({ ...own, floor: 'grass' }).name, grass[1].name, 'back on grass, its list and its step return');
});

test('a list saved for a floor stays with it, whatever its first step walks as', () => {
  const steps = [{ name: 'Flooded', look: 'wet', walks: 'water', effect: '' }, { name: 'Dry', look: 'none', walks: 'stone', effect: '' }];
  const own = { floor: 'stone', stepsFloor: 'stone', steps, step: 0 };
  assert.equal(activeStep(own).name, 'Flooded');
  assert.equal(stepFlags(own).floor, 'water');
  assert.equal(activeStep({ ...own, floor: 'grass' }), null);
  assert.equal(setStepSpeed({ floor: 'water', flowTo: 's' }, 'water', 'slow').stepsFloor, 'water');
});

test('a region named as water, with no floor set, keeps its list', () => {
  const steps = defaultSteps('water');
  assert.equal(activeStep({ steps, step: 1 }).name, steps[1].name);
});

test('a region follows the season as the GM ticks it, else only if it paints its floor', () => {
  assert.equal(takesSeason({}, ''), false, 'on a painted map it stays out of it');
  assert.equal(takesSeason({ texture: 'on' }, ''), true);
  assert.equal(takesSeason({}, 'on'), true, 'the scene paints its regions');
  assert.equal(takesSeason({ season: 'on' }, ''), true);
  assert.equal(takesSeason({ season: 'off', texture: 'on' }, 'on'), false, 'the tick has the last word');
});

test('the menu offers the season only while the region is grass', () => {
  assert.equal(stepMenu({ floor: 'grass' }, 'grass').grassy, true);
  assert.equal(stepMenu({ floor: 'stone' }, 'stone').grassy, false);
  const steps = defaultSteps('grass'), burnt = steps.findIndex((s) => s.walks === 'dirt');
  assert.equal(stepMenu({ floor: 'grass', steps, step: burnt }, 'grass').grassy, false, 'burnt, it is dirt');
});

test('a region keeps its own edge softness, within what can be drawn', () => {
  assert.equal(stepEdge({}), 1, 'about a square unless set');
  assert.equal(stepEdge({ stepEdge: 2.5 }), 2.5);
  assert.equal(stepEdge({ stepEdge: 0 }), 0.1, 'never quite a hard line');
  assert.equal(stepEdge({ stepEdge: 99 }), 3);
  assert.equal(stepEdge({ stepEdge: 'x' }), 1);
  assert.equal(stepLook({ stepEdge: 2 }, 'grass').edge, 2, 'the look is drawn with it');
  assert.equal(stepMenu({ stepEdge: 2 }, 'grass').edge, 2, 'the menu shows it');
});

test('every floor has a choice of textures, the first its usual one', () => {
  for (const floor of FLOORS) {
    const styles = TEXTURE_STYLES[floor];
    assert.ok(styles?.length >= 5, `${floor} has at least five styles`);
    assert.equal(new Set(styles.map(([key]) => key)).size, styles.length, `${floor}: no style twice`);
    for (const [key, name] of styles) assert.ok(key && name, `${floor}: a style has a key and a name`);
  }
});

test('a region keeps the style chosen for each floor, so a step that changes the floor uses that floor\'s own', () => {
  const [first, second] = TEXTURE_STYLES.stone.map(([key]) => key);
  assert.equal(textureStyleOf({}, 'stone'), first, 'unset: the usual one');
  assert.equal(textureStyleOf({ textureStyles: { stone: second } }, 'stone'), second);
  assert.equal(textureStyleOf({ textureStyles: { stone: second } }, 'grass'), TEXTURE_STYLES.grass[0][0], 'each floor its own');
  assert.equal(textureStyleOf({ textureStyles: { stone: 'gone' } }, 'stone'), first, 'an unknown style is the usual one');
});

test('every floor offers the full range of effects, its own first', () => {
  for (const floor of FLOORS) {
    const list = defaultSteps(floor), looks = new Set(list.map((s) => s.look));
    assert.ok(list.length >= 18, `${floor} has ${list.length} presets`);
    assert.equal(new Set(list.map((s) => s.name)).size, list.length, `${floor}: no preset twice`);
    for (const wanted of ['blood', 'steam', 'misty', 'burnt', 'arcane', 'cursed']) assert.ok(looks.has(wanted), `${floor} has ${wanted}`);
  }
  for (const floor of FLOORS.filter((f) => f !== 'ice' && f !== 'snow')) assert.ok(defaultSteps(floor).some((s) => s.look === 'frozen'), `${floor} can freeze`);
  assert.equal(defaultSteps('water').find((s) => s.look === 'frozen').walks, 'ice', 'frozen water walks as ice');
  assert.equal(defaultSteps('stone').find((s) => s.look === 'steam').effect, 'steam', 'steam also switches on the vents');
  assert.equal(defaultSteps('grass')[0].name, 'Fresh', 'a floor\'s own come first');
});

test('a list only saved by picking a step keeps up with the presets, on the step it was on', () => {
  const old = [{ name: 'Clear', look: 'none', walks: 'water', effect: '' }, { name: 'Bloody', look: 'blood', walks: 'water', effect: '', speed: 'slow' }, { name: 'Frozen over', look: 'none', walks: 'ice', effect: '' }];
  const own = { floor: 'water', steps: old, step: 2 };
  const menu = stepMenu(own, 'water');
  assert.equal(menu.steps.length, defaultSteps('water').length, 'all the presets are offered');
  assert.deepEqual(menu.steps.slice(0, 3), ['Clear', 'Bloody', 'Frozen over'], 'in the order it had');
  assert.equal(menu.current, 2, 'still on its step');
  const change = changeStep(own, 'water', 2);
  assert.equal(change.steps[2].look, 'frozen', 'a preset takes its newest look');
  assert.equal(change.steps[1].speed, 'slow', 'and keeps the speed set on it');
  assert.equal(change.steps.length, defaultSteps('water').length);
});

test('a list the GM edited stays as they made it', () => {
  const mine = [{ name: 'Mine', look: 'wet', walks: 'stone', effect: '' }, { name: 'Bloodied', look: 'wet', walks: 'stone', effect: '' }];
  const own = { floor: 'stone', stepsFloor: 'stone', stepsEdited: true, steps: mine };
  assert.deepEqual(stepMenu(own, 'stone').steps, ['Mine', 'Bloodied']);
  assert.equal(changeStep(own, 'stone', 1).steps[1].look, 'wet');
  assert.equal(changeStep(own, 'stone', 1).steps.length, 2);
});

test('a region can make its pattern bigger or smaller, within reason', () => {
  assert.equal(stepScale({}), 1);
  assert.equal(stepScale({ stepScale: 0.5 }), 0.5);
  assert.equal(stepScale({ stepScale: 99 }), STEP_SCALE.max);
  assert.equal(stepScale({ stepScale: 0 }), STEP_SCALE.min);
  assert.equal(stepScale({ stepScale: 'x' }), 1);
  assert.equal(stepMenu({ stepScale: 2 }, 'glass').scale, 2);
});

test('any flowing water can follow the wind, and a fall turns only as the wind really turns', () => {
  assert.equal(flowChoices('river')[0][0], 'wind');
  assert.equal(flowChoices('river')[0][1], 'Follows the wind');
  assert.equal(flowChoices('rapids')[0][0], 'wind');
  assert.equal(flowChoices('falls')[0][0], 'wind');
  assert.ok(Math.abs(fallWindAngle(0.1)) < 1e-9, 'a small shift changes nothing');
  assert.ok(Math.abs(fallWindAngle(Math.PI / 2 + 0.2) - Math.PI / 2) < 1e-9);
  assert.equal(fallWindAngle(undefined), 0);
  assert.equal(waterKindFlags({ flowTo: 'wind' }, 'river').flowTo, 'wind');
  assert.equal(waterKindFlags({ flowTo: 'wind' }, 'falls').flowTo, 'wind');
  assert.equal(waterKindOf({ flowTo: 'wind' }), 'river');
});

test('animals keep off ground a step has made dangerous or foul, and not off what they would cross', () => {
  const steps = (look) => ({ steps: [{ name: 'Fresh', look: 'none', walks: 'grass' }, { name: 'Now', look, walks: 'grass' }], step: 1 });
  for (const look of ['burning', 'lavacracks', 'hot', 'boiling', 'acid', 'poison', 'electric', 'oil', 'burnt', 'ash', 'blight', 'cursed', 'deadmagic', 'withered', 'blood']) assert.equal(unfitForLife(steps(look)), true, look);
  for (const look of ['none', 'wet', 'flowers', 'vines', 'moss', 'snowed', 'frost', 'misty', 'bones', 'dried', 'rubble']) assert.equal(unfitForLife(steps(look)), false, look);
  assert.equal(unfitForLife({ steps: steps('burning').steps, step: 0 }), false, 'only the step it is on');
  assert.equal(unfitForLife(undefined), false, 'a region with no steps');
  for (const look of ['burning', 'blood', 'dried', 'bones']) assert.ok(look in STEP_LOOKS, look);
});

test('water depth: medium is the look water always had, and each step down holds more of its own colour', async () => {
  const { WATER_DEPTHS, waterDepthLook } = await import('../../../scripts/engines/motion/region-steps.mjs');
  assert.deepEqual(waterDepthLook(''), { hold: 1, dark: 0 });
  assert.deepEqual(waterDepthLook(undefined), { hold: 1, dark: 0 });
  assert.deepEqual(waterDepthLook('nonsense'), { hold: 1, dark: 0 });
  const deeper = WATER_DEPTHS.filter(([key]) => !waterDepthLook(key).tint), looks = deeper.map(([key]) => waterDepthLook(key));
  for (let i = 1; i < looks.length; i++) assert.ok(looks[i].hold > looks[i - 1].hold, deeper[i][1]);
  assert.ok(waterDepthLook('abyss').dark > waterDepthLook('deep').dark);
  assert.ok(WATER_DEPTHS.some(([key]) => key === 'turquoise'), 'a clear sea is among them');
  assert.deepEqual(waterDepthLook('turquoise'), { hold: 1, dark: 0, tint: true }, 'its colour its own, no darker for it');
});
