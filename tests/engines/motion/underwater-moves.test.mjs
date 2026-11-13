import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { outOfWater, swimOutWaypoints, MOVE_SOUND_FILES, moveSoundGap, moveSoundFile } from '../../../scripts/engines/motion/movement-feel.mjs';

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

// Roi: "bug with swimming underwater showing shadow (anything thats under the ground should not cast shadow)".
test('a creature under the water or the earth casts no ground shadow', () => {
  const feel = read('scripts/engines/motion/movement-feel.mjs');
  assert.match(feel, /if \(groundShadows\(\) && token\.visible && token\.shadow !== false && !under && !medium\.submerged\) \{/);
});

// Roi: "the sound of diving and resurfacing doesnt play".
test('going under and coming up each splash, every time', () => {
  for (const kind of ['dive', 'surface']) {
    assert.ok(MOVE_SOUND_FILES[kind].length >= 3, kind);
    for (const file of MOVE_SOUND_FILES[kind]) assert.ok(existsSync(new URL(`../../../${file.replace('modules/animater/', '')}`, import.meta.url)), file);
    assert.equal(moveSoundGap(kind, 2), 0, `${kind} is never held back by the step pace`);
    assert.ok(moveSoundFile(kind, 0, { seed: 't' }));
  }
  const credits = read('assets/sounds/wildlife/splash/License.txt');
  for (const id of ['398039', '364700', '398032']) assert.match(credits, new RegExp(`sounds/${id}/ \\(CC0 1\\.0\\)`));
  const feel = read('scripts/engines/motion/movement-feel.mjs');
  assert.match(feel, /if \(move\.submerged === false && medium\.submerged && token\.visible\) sound\('water', point, token, 'dive'\);/);
  assert.match(feel, /sound\('water', point, token, 'surface'\);/);
});

// Roi: "going from water to another floor type that isnt water should automatically change from swim to stride\travel
// and if it's diving underwater it should resurface".
test('a swimmer that ends its move off the water walks, and one under the surface comes up', () => {
  assert.deepEqual(outOfWater({ action: 'swim', floor: 'dirt', elevation: 0, base: 0 }), { movementAction: 'walk' });
  assert.deepEqual(outOfWater({ action: 'swim', floor: 'stone', elevation: -5, base: 0 }), { movementAction: 'walk', elevation: 0 });
  assert.deepEqual(outOfWater({ action: 'swim', floor: 'ice', elevation: -10, base: 5 }), { movementAction: 'walk', elevation: 5 }, 'up to its level\'s floor');
  assert.equal(outOfWater({ action: 'swim', floor: 'water', elevation: -5 }), null, 'still in the water');
  assert.equal(outOfWater({ action: 'walk', floor: 'dirt' }), null, 'already walking');
  assert.equal(outOfWater({ action: 'fly', floor: 'dirt', elevation: 20 }), null, 'a flier is left alone');
  assert.equal(outOfWater({ action: 'swim', floor: null }), null, 'no floor known: nothing changes');
  assert.deepEqual(outOfWater({ action: 'swim', floor: 'dirt', elevation: -5, walk: null }), { elevation: 0 }, 'no walking action: it still comes up');
  const main = read('scripts/main.mjs');
  assert.match(main, /if \(userId !== game\.user\?\.id \|\| !\("x" in change \|\| "y" in change \|\| "elevation" in change\)\) return;/, 'done once, by whoever moved it');
  assert.match(main, /registerSetting\('swimOutOnLand',\{name:'Swimmers walk out of the water'/);
  assert.match(read('scripts/ui/settings-window.mjs'), /"underwaterOpacity", "swimOutOnLand",/);
});

// Roi: "it changes to stride oonly at the END of the movement rather than when the floor changes".
test('a swimmer\'s path walks from where it leaves the water, not once it stops', () => {
  const shore = (p) => (p.x < 300 ? 'water' : 'dirt'); // water left of x 300
  const out = swimOutWaypoints({ x: 0, y: 0, elevation: 0, action: 'swim' }, [{ x: 600, y: 0 }], shore, { step: 25 });
  assert.deepEqual(out.map((w) => [w.x, w.action]), [[300, 'swim'], [600, 'walk']], 'swims to the bank, walks the rest');
  // Under the water: it comes up at the bank, then walks on at the floor's height.
  const under = swimOutWaypoints({ x: 0, y: 0, elevation: -10, action: 'swim' }, [{ x: 600, y: 0, elevation: -10 }], shore, { step: 25, base: 0 });
  assert.deepEqual(under.map((w) => [w.x, w.elevation, w.action]), [[300, -10, 'swim'], [300, 0, 'walk'], [600, 0, 'walk']]);
  // Later waypoints of the same move walk too; one asking for another action keeps it.
  const many = swimOutWaypoints({ x: 0, y: 0, elevation: 0, action: 'swim' }, [{ x: 400, y: 0 }, { x: 400, y: 300 }, { x: 500, y: 300, action: 'fly', elevation: 20 }], shore, { step: 25 });
  assert.deepEqual(many.map((w) => w.action), ['swim', 'walk', 'walk', 'fly']);
  // Staying in the water, or not swimming: the move as asked.
  const wet = [{ x: 200, y: 0 }];
  assert.deepEqual(swimOutWaypoints({ x: 0, y: 0, action: 'swim' }, wet, shore), wet);
  const walking = [{ x: 600, y: 0 }];
  assert.deepEqual(swimOutWaypoints({ x: 0, y: 0, action: 'walk' }, walking, shore), walking);
  // A destination's keys left undefined carry on from where it was (Foundry's own reading).
  const dest = swimOutWaypoints({ x: 0, y: 0, elevation: 0, action: 'swim' }, [{ x: 600, y: undefined, elevation: undefined, action: undefined }], shore, { step: 25 });
  assert.deepEqual(dest.map((w) => [w.x, w.action]), [[300, 'swim'], [600, 'walk']]);
  // The token's position maps to the point it stands on (its middle).
  const centred = swimOutWaypoints({ x: 0, y: 0, action: 'swim' }, [{ x: 600, y: 0 }], shore, { step: 25, centre: (p) => ({ x: p.x + 50, y: p.y + 50 }) });
  assert.equal(centred[0].x, 250, 'its middle reaches the bank when its corner is 50 px short of it');
  const main = read('scripts/main.mjs');
  assert.match(main, /const wrap = function \(wrapped, changed, options, user\) \{ swimOutHere\(this, changed, options\);/, 'every move (a drag, the keys, the API) is walked out where it leaves the water, inside the one libWrapper wrapper');
  assert.match(main, /const move = options\?\.movement\?\.\[doc\?\.id\];/, 'from the waypoints Foundry is handed, before it reads them');
  assert.doesNotMatch(main, /proto\._preUpdate = walkOut/, 'no wrapping behind libWrapper');
});

// Roi: "it changes it but the floor still considers the swim footprint for some reason". The marks read the token's
// chosen mode (still Swim until it stops), not the walking waypoint being animated.
test('marks and sounds go by the waypoint being animated, not the token\'s chosen mode', () => {
  const main = read('scripts/main.mjs');
  assert.match(main, /const actionNow = \(t\) => \(t\.movementAnimationPromise && movingAction\.get\(t\)\) \|\| t\.document\?\.movementAction;/);
  assert.match(main, /if \(context\?\.name === this\.movementAnimationName && typeof options\?\.action === "string"\) movingAction\.set\(this, options\.action\);/);
  assert.match(main, /const action = actionNow\(t\), signature = \[/);
  assert.match(main, /elevation: d\.elevation \?\? 0, base, action,/);
  assert.match(main, /Hooks\.once\("setup", installMoveAction\);/);
});

// Roi: "it does swim to stride footprint right but the movement type remsains on swim..".
test('a move rewritten to end walking also sets the token\'s mode to walk, in the same update', () => {
  const main = read('scripts/main.mjs');
  assert.match(main, /if \(changed && out\.at\(-1\)\?\.action === walk\) changed\.movementAction = walk;/);
  assert.match(main, /swimOutMove\(doc, options, changed\);/);
});
