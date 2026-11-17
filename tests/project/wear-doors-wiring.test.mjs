import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wallDamageResult, defaultWallStats, defaultDoorStats, DOOR_ATTACK_SYSTEMS } from '../../scripts/engines/props/door-attack.mjs';
import { forceDamageResult } from '../../scripts/engines/props/success-choices.mjs';
import { propSceneFieldsHTML } from '../../scripts/ui/prop-config.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const block = (from, span = 1800) => {
  const at = main.indexOf(from);
  assert.ok(at > 0, from);
  return main.slice(at, at + span);
};

test('a door and a wall take a blow by the same arithmetic, and say which they are', () => {
  // A wooden door is Hardness 5 / HP 20; a wooden plain wall is a structure, Hardness 10 / HP 40 (Table 11-4).
  assert.equal(defaultDoorStats('wood').hardness, 5);
  assert.equal(defaultWallStats('wood').hardness, 10);
  const door = wallDamageResult({ kind: 'door', material: 'wood', damage: 28 });
  assert.equal(door.dealt, 20, 'a fireball of 28 takes a wooden door out');
  assert.equal(door.broken, true);
  assert.match(door.line, /^Door:/);
  const wall = wallDamageResult({ kind: 'wall', material: 'wood', damage: 28 });
  assert.equal(wall.dealt, 18, 'the same roll on a plank wall gets past Hardness 10');
  assert.equal(wall.hp, 22);
  assert.equal(wall.broken, false);
  assert.match(wall.line, /^Wall:/, 'a wall is not called a door');

  // Hardness is a wall it never gets past, not a discount: 9 on a stone wall is nothing at all.
  const nothing = wallDamageResult({ kind: 'wall', material: 'stone', damage: 9 });
  assert.equal(nothing.dealt, 0);
  assert.match(nothing.line, /does not get past its Hardness 14/);
  // Damage already taken carries: a door at 4 HP falls to the next blow that gets through.
  assert.equal(wallDamageResult({ own: { hp: 4 }, kind: 'door', material: 'wood', damage: 10 }).broken, true);
  // And a door the GM gave its own HP uses those, not the material's.
  assert.equal(wallDamageResult({ own: { maxHp: 60, hardness: 0 }, kind: 'door', material: 'wood', damage: 10 }).hp, 50);
  // The GM's measured Force Open blow is the same arithmetic, so the two can never disagree about one door.
  assert.deepEqual(forceDamageResult({ material: 'wood', damage: 12 }), wallDamageResult({ kind: 'door', material: 'wood', damage: 12 }));
});

test('the switch is the scene’s, off, and only where doors have HP at all', () => {
  const html = propSceneFieldsHTML({ on: true, wearSystem: true });
  assert.ok(html.includes('flags.animater.wearDoors"'));
  assert.ok(!html.includes('wearDoors" checked'), 'off by default: it changes what a fireball already does');
  assert.ok(propSceneFieldsHTML({ on: true, wearSystem: true, wearDoors: true }).includes('wearDoors" checked'));
  // No table, no switch: a system whose doors have no HP is not offered a rule it cannot follow.
  assert.ok(!propSceneFieldsHTML({ on: true }).includes('wearDoors'));
  assert.match(main, /wearSystem: DOOR_ATTACK_SYSTEMS\.has\(game\.system\.id\)/);
  assert.match(main, /const wearsDownHere = \(scene\) => scene\?\.flags\?\.\[ID\]\?\.wearDoors === true && DOOR_ATTACK_SYSTEMS\.has\(game\.system\.id\);/);
  assert.deepEqual([...DOOR_ATTACK_SYSTEMS], ['pf2e']);
});

test('with it on, the animation landing breaks no door: there is no number yet', () => {
  const t = block('function breakAreaThings(', 5200);
  assert.match(t, /const wearing = wearsDownHere\(scene\) && typeof messageId !== "string";/,
    'the animation pass is the one with no damage roll behind it');
  assert.match(t, /\.filter\(\(\{ thing \}\) => !\(wearing && worn\(thing, scene\)\)\)/);
  assert.match(main, /const worn = \(wall, scene\) => \["door", "wall"\]\.includes\(wallTraits\(wall, scene, game\.system\.id\)\.kind\);/,
    'doors and walls wear down; a window has no HP and shatters at impact as it always has');
  // Props, decorations and powder are not held back by any of this.
  const hits = t.slice(t.indexOf('const hits ='), t.indexOf('\r\n', t.indexOf('const hits =')));
  assert.ok(hits.length > 20 && !hits.includes('wearing'), 'props still break at impact, held back by none of this');
});

test('the blow is the roll, read by the GM from its own copy of the message', () => {
  const r = block('function areaPlaceRoll(', 1200);
  assert.match(r, /const message = game\.messages\?\.get\(cause\.messageId\)/, 'its own copy, never the sender’s number');
  assert.match(r, /total: types\.length \? Math\.max\(0, Math\.floor\(Number\(d\.total\) \|\| 0\)\) : 0/,
    'a roll this area’s item and caster did not make buys nothing, its number least of all');
  assert.match(main, /rollTotal: doc \? areaPlaceRoll\(doc, cause, user, now\)\.total : 0/);
  // The number itself is the whole roll, because a structure has one Hardness and one pool of HP.
  const dm = readFileSync(new URL('../../scripts/engines/playback/damage-moments.mjs', import.meta.url), 'utf8');
  assert.match(dm, /const total = parts\.reduce\(\(n, p\) => n \+ \(Number\(p\.total\) \|\| 0\), 0\);/);
});

test('a worn door keeps standing; only the blow that takes its last HP breaks it', () => {
  const w = block('async function wearWall(', 1400);
  assert.match(w, /if \(!\(damage > 0\)\) \{[\s\S]{0,140}return \{ broken: false, done: false \};/,
    'no damage roll, no break: the spell leaves it standing rather than going by its damage type');
  assert.match(w, /if \(out\.broken\) return \{ broken: true, done: false \};/, 'and the last HP sends it down the one path that breaks doors');
  assert.match(w, /flags\.\$\{ID\}\.breakWall\.hp/, 'what is written is the same HP flag a Strike writes');
  assert.match(w, /postDoorLine\(\{ \.\.\.out, name: traits\.kind === "wall" \? "Wall" : "Door" \}\)/);

  const apply = block('async function applyWallBreak(', 3000);
  assert.match(apply, /if \(cause\.kind === "area" && wearsDownHere\(scene\) && worn\(wallView\(doc\), scene\)\)/,
    'only a spell’s area, only where it is switched on, only on a kind that has HP');
  const asked = apply.indexOf('wearWall(doc, scene');
  assert.ok(apply.indexOf('if (!check.ok)') < asked, 'the request is checked first, as every other break is');
  assert.ok(asked < apply.indexOf('await doc.update(update,'), 'and a door that holds never reaches the break');
  assert.match(apply, /if \(!wear\.broken\) return wear\.done;/);
});
