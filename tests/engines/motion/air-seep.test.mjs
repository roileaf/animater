import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEEP_RINGS, airOpenings, seepReach, seepStep } from '../../../scripts/engines/motion/air-seep.mjs';

// One room, everything with y over 100 in it; a wall along y = 100.
const room = 'room', rooms = [room], inside = (p) => p.y > 100;
const along = { c: [0, 100, 100, 100] };

test('an open door or a wall that lets light through lets the air in; a shut door or solid wall does not', () => {
  const of = (w) => airOpenings({ walls: [{ id: 'w', ...along, ...w }], rooms, inside });
  assert.equal(of({ door: 1, ds: 1, light: 20 }).length, 1, 'an open door');
  assert.equal(of({ door: 1, ds: 0, light: 20 }).length, 0, 'a shut one');
  assert.equal(of({ door: 1, ds: 0, light: 0 }).length, 0, 'a shut door, even of glass, holds the air');
  assert.equal(of({ door: 0, light: 0 }).length, 1, 'a window');
  assert.equal(of({ door: 0, light: 20 }).length, 0, 'a wall');
  assert.equal(airOpenings({ walls: [{ id: 'w', ...along, door: 1, ds: 1 }], rooms: [], inside }).length, 0, 'no rooms, no indoors');
});

test('only between a room and outside, and it knows the way in', () => {
  const [open] = airOpenings({ walls: [{ id: 'w', ...along, door: 1, ds: 1 }], rooms, inside });
  assert.equal(open.id, 'w');
  assert.equal(open.ny, 1, 'into the room');
  assert.ok(open.y > 100, 'starting just inside');
  assert.equal(airOpenings({ walls: [{ id: 'w', ...along, door: 1, ds: 1 }], rooms, inside: () => true }).length, 0, 'between two rooms');
  assert.equal(airOpenings({ walls: [{ id: 'w', ...along, door: 1, ds: 1 }], rooms, inside: () => false }).length, 0, 'between nothing');
});

test('the wind blows it in, or keeps it out', () => {
  const opening = { nx: 0, ny: 1 }, reach = (wind, windAngle) => seepReach(opening, { wind, windAngle, grid: 100 });
  const still = reach(0, 0), inward = reach(1, Math.PI / 2), outward = reach(1, -Math.PI / 2), across = reach(1, 0);
  assert.equal(still, 160);
  assert.ok(inward > still * 3, 'far with the wind');
  assert.ok(outward < still * 0.3, 'hardly at all against it');
  assert.ok(Math.abs(across - still) < 1, 'as if still when it blows across');
});

test('it creeps in, and thins away when the door shuts', () => {
  let state = seepStep(new Map(), new Set(['d']), 1);
  assert.ok(state.moved);
  assert.ok(state.amounts.get('d') > 0 && state.amounts.get('d') < 0.3, 'not all at once');
  for (let i = 0; i < 20; i++) state = seepStep(state.amounts, new Set(['d']), 1);
  assert.equal(state.amounts.get('d'), 1);
  assert.equal(seepStep(state.amounts, new Set(['d']), 1).moved, false, 'settled: nothing to draw again');
  const closing = seepStep(state.amounts, new Set(), 1);
  assert.ok(closing.moved && closing.amounts.get('d') < 1 && closing.amounts.get('d') > 0, 'thins, not gone');
  let gone = closing; for (let i = 0; i < 10; i++) gone = seepStep(gone.amounts, new Set(), 1);
  assert.equal(gone.amounts.has('d'), false);
  assert.ok(Math.abs(SEEP_RINGS.reduce((sum, [, a]) => sum + a, 0) - 1) < 1e-9, 'all its rings add up to full');
});
