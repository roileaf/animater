import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORCE_CHOICES, PICK_CHOICES } from '../../scripts/engines/props/success-choices.mjs';
import { propSceneFieldsHTML } from '../../scripts/ui/prop-config.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const block = (from, span = 2000) => {
  const at = main.indexOf(from);
  assert.ok(at > 0, from);
  return main.slice(at, at + span);
};

test('the GM is asked only where they asked to be, and the scene is where they say so', () => {
  const html = propSceneFieldsHTML({ on: true });
  assert.ok(html.includes('flags.animater.askSuccess"'), 'the switch is with the rest of the breakable-props ones');
  assert.ok(!html.includes('askSuccess" checked'), 'off by default: a success did what the rules say at once before this existed');
  assert.ok(propSceneFieldsHTML({ on: true, askSuccess: true }).includes('askSuccess" checked'));
  // Both rolls read the one switch, and it means nothing on a scene with no breakable props at all.
  assert.match(main, /const askSuccessOn = \(scene\) => scene\?\.flags\?\.\[ID\]\?\.askSuccess === true && scene\?\.flags\?\.\[ID\]\?\.breakableProps === true;/);
  assert.equal(main.split('askSuccessOn(scene)').length - 1, 2, 'the switch is read where each roll lands, and nowhere else');
});

test('a won Force Open waits for the GM before the door moves', () => {
  // It sits after the roll has been judged good and before anything is written, so a bad roll never asks at all.
  const apply = block('async function applyWallBreak(', 2600);
  const judged = apply.indexOf('if (!check.ok)');
  const asked = apply.indexOf('askForceOutcome(doc, scene, cause)');
  const written = apply.indexOf('await doc.update(update,');
  assert.ok(judged > 0 && asked > judged, 'the roll is judged first, so only a success is ever asked about');
  assert.ok(written > asked, 'and nothing is written until the GM has said what happens');
  assert.match(apply, /if \(!said\) return false;/, 'a dialog closed rather than answered leaves the door as it stands');
  assert.match(apply, /if \(said\.choice !== "break" && await applyForceChoice\(doc, scene, cause, said\)\) return true;/);
});

test('every choice the dialog offers is one the shell can really write', () => {
  const ask = block('async function askForceOutcome(', 2000);
  assert.match(ask, /forceOpenChoices\(\{ crit: judged\.crit === true, system: sys \}\)/, 'the list comes from the engine');
  assert.match(ask, /FORCE_CHOICES\[choice\]/, 'and so do the words, so the two can never drift');
  assert.match(ask, /default: choice === "break"/, 'what the roll already did is the button under the cursor');
  assert.match(ask, /name="damage"/, 'a measured blow is a number the GM types');

  const act = block('async function applyForceChoice(', 1400);
  assert.match(act, /if \(said\.choice === "none"\) \{ markForceOpenUsed\(cause\); return true; \}/, 'it does not open, and the roll is spent');
  assert.match(act, /ds: CONST\.WALL_DOOR_STATES\.OPEN/, 'forced open and whole: it stands open, so it is not locked either');
  assert.match(act, /if \(out\.broken\) return false;/, 'a blow that took its last HP breaks it through the one path that breaks doors');
  assert.match(act, /flags\.\$\{ID\}\.breakWall\.hp/, 'and one that did not comes off its HP');
  assert.match(act, /postDoorLine\(out\)/, 'told to the GM the way every other door hit is');
  // Four ways out of a won roll: break it (down the ordinary path), open it, damage it, or nothing at all.
  assert.deepEqual(Object.keys(FORCE_CHOICES), ['break', 'open', 'damage', 'none']);
  assert.match(act, /forceDamageResult\(\{ own: [\s\S]{0,60}material: traits\.material, damage: said\.damage \}\)/,
    'the one choice left over is the measured blow, and the engine measures it');
  // Spent exactly once per way out, so one roll can never force the same door twice.
  assert.equal(main.split('markForceOpenUsed(cause)').length - 1, 4);
});

test('a lock that gives waits too, and holding it shut loses nothing', () => {
  const ask = block('async function askPickOutcome(', 900);
  assert.match(ask, /pickLockChoices\(\)/);
  assert.match(ask, /PICK_CHOICES\[choice\]/);
  assert.match(ask, /default: choice === "open"/);
  assert.match(ask, /return typeof said === "string" \? said : "none";/, 'a dialog closed rather than answered leaves it locked');
  assert.ok(PICK_CHOICES.open && PICK_CHOICES.none);

  const judge = block('async function judgePickLock(', 2200);
  assert.match(judge, /if \(opened && askSuccessOn\(scene\) && \(await askPickOutcome\(doc, kind\)\) === "none"\)/,
    'only a lock that actually gave is asked about');
  assert.match(judge, /held = lockHeldProgress\(needed\);/, 'and one held shut sits on the brink');
  assert.match(judge, /const update = opened/, 'what is written follows the GM, not the roll alone');
});
