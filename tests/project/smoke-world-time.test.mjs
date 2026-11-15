import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { smokeAfterRounds, smokeUpdatesFor, THICK, THIN, DROP_FLOOR } from '../../scripts/engines/props/smoke-field.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

test('a clock jumped forward ages the smoke, and a clock wound back does not', () => {
  const cells = { 5: THICK, 9: THIN };
  // Twenty rounds is two minutes of the world's time: a dent, not a clearance.
  const soon = smokeAfterRounds(cells, 20);
  assert.equal(soon.cells.length, 2, 'both cells are still standing');
  assert.ok(soon.cells[0].v < THICK, 'and both have thinned');
  assert.ok(soon.cells[0].v > THICK * 0.6, 'but not by much');

  // Eight hours is 4800 rounds. Nothing survives that.
  assert.deepEqual(smokeAfterRounds(cells, 4800), { cells: [] }, 'a night of rest leaves nothing');

  // Backwards, or standing still, is not a change: winding the calendar back does not un-burn a fire.
  assert.equal(smokeAfterRounds(cells, 0), null);
  assert.equal(smokeAfterRounds(cells, -4800), null);
  assert.equal(smokeAfterRounds(cells, NaN), null);
});

test('ageing never leaves more smoke than playing the rounds out would have', () => {
  // The fade alone is the least a cell loses; a room with a way out vents on top of it. So for any number of rounds the
  // aged value must sit at or under the plain fade, and must fall as time goes on.
  let last = Infinity;
  for (const rounds of [1, 5, 20, 60, 199, 500]) {
    const [cell] = smokeAfterRounds({ 7: THICK }, rounds)?.cells ?? [{ v: 0 }];
    const v = cell?.v ?? 0;
    assert.ok(v <= THICK * Math.pow(0.98, rounds) + 1e-9, `${rounds} rounds is at most the fade`);
    // Once it is out of the model it stays out; until then every step leaves less than the one before.
    assert.ok(v < last || (v === 0 && last === 0), `${rounds} rounds leaves less than the step before`);
    last = v;
  }
  // About two hundred rounds is where a sealed room's thickest cell drops out of the model.
  assert.ok((smokeAfterRounds({ 7: THICK }, 199)?.cells.length ?? 0) === 0, 'gone by 199 rounds');
  assert.ok((smokeAfterRounds({ 7: THICK }, 150)?.cells[0]?.v ?? 0) > DROP_FLOOR, 'still there at 150');
});

test('the aged cells become a scene update, dropped ones deleted by name', () => {
  const scene = { flags: { animater: { smoke: { 5: THICK, 9: THIN } } } };
  const [fields] = smokeUpdatesFor(smokeAfterRounds({ 5: THICK, 9: THIN }, 40), { scene });
  assert.ok(fields['flags.animater.smoke.5'] < THICK, 'the cell that survives is written lower');
  assert.ok(!('flags.animater.smoke.-=5' in fields), 'and not deleted');
  const [gone] = smokeUpdatesFor(smokeAfterRounds({ 5: THICK, 9: THIN }, 4800), { scene });
  assert.equal(gone['flags.animater.smoke.-=5'], null, 'what is gone is deleted by name');
  assert.equal(gone['flags.animater.smoke.-=9'], null);
});

test('main hangs the ageing on world time and lets the drawn cloud go with it', () => {
  const at = main.indexOf('Hooks.on("updateWorldTime", (worldTime, delta)');
  assert.ok(at > 0, 'the world clock is listened to');
  const hook = main.slice(at, at + 400);
  assert.match(hook, /dropRoomAir\(\)/, 'every client lets its own cloud go — prime only ever raises');
  assert.match(hook, /smokeAgeBy\(Number\(delta\)\)/, 'and the GM ages what is stored');
  const body = main.slice(main.indexOf('const smokeAgeBy = '), at);
  assert.match(body, /activeGM\?\.isSelf !== true/, 'only the active GM writes, as every smoke write does');
  assert.match(body, /afterFireRound\(scene\)/, 'a round in flight finishes first');
  assert.match(body, /clearSmokeNow\(scene\)/, 'nothing left takes the region and geometry with it');
});
