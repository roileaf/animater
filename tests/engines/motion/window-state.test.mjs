import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closesWindow, mayUseWindow, windowClick, windowInReach, windowLockState, windowSenses, applyWindowEdge, nextWindowState } from '../../../scripts/engines/motion/window-state.mjs';
import { windowFlashes, windowGlows, windowOpening, windowShafts } from '../../../scripts/engines/motion/wall-shadows.mjs';
import { airOpenings } from '../../../scripts/engines/motion/air-seep.mjs';

test('shut wood stops everything; shut glass lets the light and sight through; open, either lets all through', () => {
  assert.deepEqual(windowSenses('woodWindow', false), { light: 20, sight: 20, sound: 20 });
  assert.deepEqual(windowSenses('glassWindow', false), { light: 0, sight: 0, sound: 20 });
  for (const kind of ['woodWindow', 'glassWindow']) assert.deepEqual(windowSenses(kind, true), { light: 0, sight: 0, sound: 0 });
  assert.equal(closesWindow('woodWindow'), true);
  assert.equal(closesWindow('glass'), false, 'a plain glass window has no control');
  assert.equal(closesWindow(null), false);
});

test('a window changes the working edge, never the wall', () => {
  const edge = { light: 30, sight: 30, sound: 20, move: 20 };
  assert.equal(applyWindowEdge(edge, 'woodWindow', false), true);
  assert.deepEqual(edge, { light: 20, sight: 20, sound: 20, move: 20 }, 'nobody walks through a window');
  applyWindowEdge(edge, 'woodWindow', true);
  assert.deepEqual(edge, { light: 0, sight: 0, sound: 0, move: 20 });
  const other = { light: 30, sight: 30, sound: 20 };
  assert.equal(applyWindowEdge(other, 'glass', true), false, 'other windows keep what they have');
  assert.deepEqual(other, { light: 30, sight: 30, sound: 20 });
  assert.equal(applyWindowEdge(null, 'woodWindow', true), false);
});
test('its light comes through only as it should', () => {
  const at = (kind, open) => windowOpening({ c: [0, 0, 100, 0], light: 0, move: 20, kind, open }, 2, 0.2);
  assert.equal(at('woodWindow', false), null, 'shut wood: none');
  assert.equal(at('woodWindow', true).kind, 'open');
  assert.equal(at('woodWindow', true).alpha, 1);
  assert.equal(at('glassWindow', false).kind, 'glass');
  assert.equal(at('glassWindow', false).alpha, 0.8);
  assert.equal(at('glassWindow', true).alpha, 1, 'more through it open');
});

test('fog gets in only through what stands open', () => {
  const rooms = ['room'], inside = (p) => p.y > 100, wall = (w) => airOpenings({ walls: [{ id: 'w', c: [0, 100, 100, 100], light: 0, ...w }], rooms, inside }).length;
  assert.equal(wall({ kind: 'glassWindow', open: false }), 0, 'shut glass lets the light through, not the air');
  assert.equal(wall({ kind: 'glassWindow', open: true }), 1);
  assert.equal(wall({ kind: 'woodWindow', open: false, light: 20 }), 0);
  assert.equal(wall({ kind: 'woodWindow', open: true }), 1);
  assert.equal(wall({ kind: 'glass' }), 1, 'other windows as before');
});

test('who may use one: as a door', () => {
  assert.equal(mayUseWindow({ isGM: true, paused: true }), true);
  assert.equal(mayUseWindow({ canDoors: true }), true);
  assert.equal(mayUseWindow({ canDoors: true, paused: true }), false);
  assert.equal(mayUseWindow({ canDoors: false }), false);
});

test('a player has to be near a window to use it; the GM does not', () => {
  const wall = [100, 0, 300, 0], grid = 100;
  assert.equal(windowInReach([{ x: 200, y: 100, radius: 50 }], wall, grid), true, 'beside it');
  assert.equal(windowInReach([{ x: 200, y: 200, radius: 50 }], wall, grid), true, 'up to its reach past its own edge');
  assert.equal(windowInReach([{ x: 200, y: 201, radius: 50 }], wall, grid), false, 'a step further');
  assert.equal(windowInReach([{ x: 700, y: 0, radius: 50 }], wall, grid), false, 'along the wall past its end, by its end');
  assert.equal(windowInReach([{ x: 450, y: 0, radius: 0 }], wall, grid), true, 'by its end');
  assert.equal(windowInReach([{ x: 200, y: -100, radius: 50 }], wall, grid), true, 'from either side');
  assert.equal(windowInReach([], wall, grid), false, 'with nobody');
  assert.equal(windowInReach([{ x: 900, y: 900 }, { x: 200, y: 50 }], wall, grid), true, 'any of them');
  assert.equal(mayUseWindow({ canDoors: true, inReach: false }), false);
  assert.equal(mayUseWindow({ isGM: true, inReach: false }), true);
});

test('a locked window will not open until the GM unlocks it, and is shut to be locked', () => {
  assert.equal(windowClick({ locked: true }), 'rattle');
  assert.equal(windowClick({ locked: false }), 'toggle');
  assert.deepEqual(windowLockState({ locked: true }), { open: false, slats: false, locked: false });
});

test('three to choose from, and shutters go by way of their slats', () => {
  assert.deepEqual(windowSenses('woodWindow', false), { light: 20, sight: 20, sound: 20 }, 'a wooden window stops it all');
  assert.deepEqual(windowSenses('shutterWindow', false), { light: 20, sight: 20, sound: 20 }, 'so do shut shutters');
  assert.deepEqual(windowSenses('glassWindow', false), { light: 0, sight: 0, sound: 20 }, 'glass lets both');
  assert.deepEqual(windowSenses('shutterWindow', true), { light: 0, sight: 0, sound: 0 });
  assert.equal(closesWindow('shutterWindow'), true);
  const at = (kind, open, slats) => windowOpening({ c: [0, 0, 100, 0], light: 0, move: 20, kind, open, slats }, 2, 0.2);
  assert.equal(at('shutterWindow', false, false), null, 'shut: no light');
  assert.equal(at('shutterWindow', false, true).kind, 'shuttered', 'slats open: its light in bands');
  assert.equal(at('shutterWindow', true, false).kind, 'open', 'then all of it');
  assert.equal(at('woodWindow', false, true), null, 'a wooden window has no slats');
  const air = (w) => airOpenings({ walls: [{ id: 'w', c: [0, 100, 100, 100], light: 0, kind: 'shutterWindow', ...w }], rooms: ['room'], inside: (p) => p.y > 100 }).length;
  assert.equal(air({ open: false, slats: true }), 0, 'slats open still keep the fog out');
  assert.equal(air({ open: true }), 1);
});

test('a click takes it to its next state', () => {
  let state = { open: false, slats: false };
  state = nextWindowState('shutterWindow', state); assert.deepEqual(state, { open: false, slats: true }, 'slats first');
  state = nextWindowState('shutterWindow', state); assert.deepEqual(state, { open: true, slats: false }, 'then the window');
  state = nextWindowState('shutterWindow', state); assert.deepEqual(state, { open: false, slats: false }, 'then all shut');
  assert.deepEqual(nextWindowState('woodWindow', { open: false }), { open: true, slats: false });
  assert.deepEqual(nextWindowState('glassWindow', { open: true }), { open: false, slats: false });
  assert.deepEqual(windowLockState({ locked: false }), { open: false, slats: false, locked: true }, 'locking shuts all of it');
});

test('slats open: Foundry\'s whole light stops there, and what comes through is drawn in bands, of lamp and sun alike', () => {
  const edge = { light: 0, sight: 0, sound: 0 };
  applyWindowEdge(edge, 'shutterWindow', false);
  assert.deepEqual(edge, { light: 20, sight: 20, sound: 20 }, 'shut stops it all');
  applyWindowEdge(edge, 'shutterWindow', false, true);
  assert.deepEqual(edge, { light: 20, sight: 0, sound: 20 }, 'slats open: the eye passes, or the bands past them could not be seen; Foundry\'s own light does not');
  applyWindowEdge(edge, 'woodWindow', false, true);
  assert.equal(edge.sight, 20, 'a wooden window has no slats');
  const wall = (state) => ({ c: [400, 100, 500, 100], light: 0, move: 20, kind: 'shutterWindow', ...state }), room = [0, 100, 1000, 100, 1000, 1000, 0, 1000];
  const lamp = (state) => windowGlows({ walls: [wall(state)], indoors: [room], lights: [{ x: 450, y: 400, radius: 900 }], grid: 100 });
  assert.ok(lamp({ slats: true })[0].slats > 0, 'lamp: bands');
  assert.equal(lamp({ open: true })[0].slats, 0, 'window open: whole');
  assert.equal(lamp({}).length, 0, 'shut: none');
  // The sun on the wall's far side, up the map, outside the room.
  const sun = { strength: 1, angle: 90, height: 30 }, shafts = (state, indoors = [[0, 200, 1000, 200, 1000, 1000, 0, 1000]]) => windowShafts({ walls: [wall(state)], sun, indoors, grid: 100 });
  assert.equal(shafts({}).length, 0, 'sun, shut: none');
  const banded = windowShafts({ walls: [wall({ slats: true })], sun: { ...sun, angle: -90 }, indoors: [], grid: 100 });
  assert.ok(banded[0]?.slats > 0, 'sun: bands');
  assert.equal(windowShafts({ walls: [wall({ open: true })], sun: { ...sun, angle: -90 }, indoors: [], grid: 100 })[0].slats, 0, 'sun, window open: whole');
  assert.ok(Array.isArray(windowFlashes({ walls: [], indoors: [] })));
});

test('a wall just outside an opening: no sun gets in, and the glow knows where it starts, to be cut there', () => {
  const wall = { c: [400, 100, 500, 100], kind: 'glassWindow', open: true, move: 20 }, sun = { strength: 1, angle: -90, height: 30 };
  assert.equal(windowShafts({ walls: [wall], sun, grid: 100 }).length, 1, 'open air');
  assert.equal(windowShafts({ walls: [wall], sun, grid: 100, blocked: () => true }).length, 0, 'a wall there');
  const room = [[0, 100, 1000, 100, 1000, 1000, 0, 1000]];
  assert.equal(windowFlashes({ walls: [wall], indoors: room, grid: 100 }).length, 1, 'lightning, open air');
  assert.equal(windowFlashes({ walls: [wall], indoors: room, grid: 100, blocked: () => true }).length, 0, 'lightning, a wall there');
  const [glow] = windowGlows({ walls: [wall], indoors: [[0, 100, 1000, 100, 1000, 1000, 0, 1000]], lights: [{ x: 450, y: 400, radius: 900 }], grid: 100 });
  assert.ok(glow.past.y < 100 && Math.abs(glow.past.x - 450) < 1e-9, 'just outside, the side away from the room');
});
