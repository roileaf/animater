import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IMMERSION_FEATURES, SETUP_PROFILES, profileChoices, profilesWantMapMaking, profileToolWrites, immersionHTML } from '../../scripts/ui/immersion-setup.mjs';

// A GM who has just installed this is asked to choose among seventeen features, which is the same wall as the
// settings in smaller print. The four starts tick a sensible set for them; the list then shows what they would get,
// and nothing is written until Save, so a start is a suggestion and never a surprise.
const ids = IMMERSION_FEATURES.map((f) => f.id);
const of = (...names) => SETUP_PROFILES.filter((p) => names.includes(p.id));
const choices = (...names) => profileChoices(of(...names), IMMERSION_FEATURES);
const on = (...names) => ids.filter((f) => choices(...names).get(f));
const TOOLS = ['toolCaveIn', 'toolEnergyBlast', 'toolDecorate', 'toolClearRubble', 'toolRepairProps', 'toolBreachWall', 'toolMoments', 'toolClearBlood', 'toolSplatBlood', 'toolBakeBlood', 'toolClearGroundMarks', 'toolAnimals', 'toolWeather', 'toolDetectWater', 'toolClouds', 'toolFlames', 'toolCarry'];
const buttons = (...names) => TOOLS.filter((key) => profileToolWrites(of(...names), TOOLS).get(key));

test('each start names features that exist', () => {
  for (const profile of SETUP_PROFILES)
    for (const id of profile.features ?? []) assert.ok(ids.includes(id), `${profile.id} wants ${id}`);
});

test('Everything is everything, and the others are less than it', () => {
  assert.deepEqual(on('everything'), ids);
  for (const id of ['animations', 'drama', 'maps']) assert.ok(on(id).length < ids.length, id);
});

test('Animations leaves the world alone; Map making builds it', () => {
  // The complaint this answers: a GM who wants creatures to move, not weather, caves, towns and tracks to set up.
  for (const world of ['weather', 'caves', 'town', 'tracks', 'outdoors']) assert.ok(!on('animations').includes(world), world);
  for (const world of ['weather', 'caves', 'shores', 'sound']) assert.ok(on('maps').includes(world), world);
  assert.ok(!on('maps').includes('blood'), 'the one thing Everything has that Map making does not');
  assert.ok(on('drama').includes('blood') && on('drama').includes('aftermath'));
});

test('only the starts that build maps ask for the map making tools', () => {
  const flag = (id) => SETUP_PROFILES.find((p) => p.id === id).mapMaking;
  assert.equal(flag('animations'), false);
  assert.equal(flag('drama'), false);
  assert.equal(flag('maps'), true);
  assert.equal(flag('everything'), true);
  // Pressed together, one asking is enough — nobody loses a tool they pressed a start for.
  assert.equal(profilesWantMapMaking(of('animations', 'maps')), true);
  assert.equal(profilesWantMapMaking(of('animations', 'drama')), false);
  assert.equal(profilesWantMapMaking([]), false);
});

test('two starts add together, and pressing none is what the world already had', () => {
  // The question this answers: a table that wants its creatures to move AND its fights to leave blood.
  const both = on('animations', 'drama');
  for (const id of [...on('animations'), ...on('drama')]) assert.ok(both.includes(id), id);
  assert.ok(both.includes('light') && both.includes('blood'), 'one from each');
  assert.ok(!both.includes('weather'), 'and nothing neither of them asked for');
  const before = new Map(ids.map((id) => [id, id === 'weather']));
  assert.deepEqual([...profileChoices([], IMMERSION_FEATURES, before)], [...before], 'none pressed leaves the world as it is');
});

test('a start brings its own buttons and leaves the rest off the bar', () => {
  // What the bar looked like before: every button, whatever the table had chosen.
  assert.deepEqual(buttons('everything'), TOOLS);
  for (const tool of ['toolDecorate', 'toolDetectWater', 'toolWeather', 'toolCaveIn', 'toolEnergyBlast'])
    assert.ok(!buttons('animations').includes(tool), `${tool} is not an animation`);
  for (const tool of ['toolCaveIn', 'toolEnergyBlast', 'toolBreachWall', 'toolClearBlood', 'toolSplatBlood'])
    assert.ok(buttons('drama').includes(tool), tool);
  for (const tool of ['toolDecorate', 'toolDetectWater', 'toolWeather', 'toolAnimals'])
    assert.ok(buttons('maps').includes(tool), tool);
  assert.ok(!buttons('maps').includes('toolCaveIn'), 'a cave-in is played, not built');
  // Pressed together they add, the same as the features do.
  const both = buttons('animations', 'drama');
  for (const tool of [...buttons('animations'), ...buttons('drama')]) assert.ok(both.includes(tool), tool);
  assert.ok(!both.includes('toolDecorate'), 'and still no brush');
  assert.deepEqual([...profileToolWrites([], TOOLS).values()].filter(Boolean), [], 'none pressed writes no button on');
});

test('a start is offered to the GM alone, and marked once pressed', () => {
  const page = (over) => immersionHTML({ features: IMMERSION_FEATURES, choices: new Map(), isGM: true, ...over });
  assert.equal((page({}).match(/data-profile=/g) ?? []).length, SETUP_PROFILES.length);
  assert.match(page({ profile: ['maps'] }), /data-profile="maps" class="on"/);
  assert.ok(!page({ profile: ['maps'] }).includes('data-profile="drama" class="on"'), 'only what was pressed');
  // Two pressed are both marked: they add together rather than replacing one another.
  const two = page({ profile: ['animations', 'drama'] });
  assert.match(two, /data-profile="animations" class="on"/);
  assert.match(two, /data-profile="drama" class="on"/);
  assert.ok(!two.includes('data-profile="maps" class="on"'));
  // A player's screen is their own: the starts set the table's switches, so a player is not shown them.
  assert.ok(!immersionHTML({ features: IMMERSION_FEATURES, choices: new Map(), isGM: false }).includes('data-profile'));
});

test('the first time, the window leads with the starts instead of the list', () => {
  const page = (over) => immersionHTML({ features: IMMERSION_FEATURES, choices: new Map(), isGM: true, ...over });
  assert.match(page({ first: true }), /Pick a start below/);
  assert.ok(!page({}).includes('Pick a start below'), 'an update asks about what arrived, as it did');
  // A player is never shown the starts, first time or not: they set the table's switches.
  assert.ok(!immersionHTML({ features: IMMERSION_FEATURES, choices: new Map(), isGM: false, first: true }).includes('data-profile'));
});

test('a first install is told apart from an update by what this world has been asked', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  const offer = main.slice(main.indexOf('async function offerImmersion()'), main.indexOf('win.prepare();'));
  assert.match(offer, /const first = game\.user\.isGM && !\(seen \?\? \[\]\)\.length;/);
  assert.match(offer, /new Window\(\{ only: fresh\.map\(\(f\) => f\.id\), first \}\)/);
  // The flag is read from what was stored before this run writes every id to it.
  assert.ok(offer.indexOf('const first =') < offer.indexOf('await game.settings.set(ID, key'), 'read before it is written');
});

test('pressing a start writes nothing, and Save writes the switch only for a start', () => {
  const source = readFileSync(new URL('../../scripts/ui/immersion-setup.mjs', import.meta.url), 'utf8');
  const start = source.slice(source.indexOf('startFrom(profileId) {'), source.indexOf('previewNow() {'));
  assert.ok(!/await s\.set|settings\(\)\.set/.test(start), 'a start only ticks boxes');
  assert.match(start, /this\.choices = profileChoices\(picked, this\.features, this\.before\)/);
  assert.match(start, /if \(pressed\.has\(profile\.id\)\) pressed\.delete\(profile\.id\); else pressed\.add\(profile\.id\);/, 'pressed again, it comes back out');
  assert.match(source, /this\.profiles = null;/, 'a box changed by hand is no longer one of the starts');
  const save = source.slice(source.indexOf('const pressed = SETUP_PROFILES.filter'), source.indexOf('const place = isGM()'));
  assert.match(save, /if \(pressed\.length && isGM\(\) && s\.settings\.get\(`\$\{id\}\.mapMaking`\) && s\.get\(id, "mapMaking"\) !== wantsMaps\)/);
  assert.match(save, /for \(const \[key, want\] of profileToolWrites\(pressed, keys\)\)/, 'and the bar follows the starts');
});
