import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AppliedLooks, normalizeApplied, withApplied, touchesApplied, appliedDocs, APPLIED_ON, APPLIED_FLAG } from '../../../scripts/engines/playback/applied-looks.mjs';

// Roi: "we need to add a button to apply to token" (the Tokenshade studio's Use it card).
const prone = { kind: 'tokenfx', assets: [], fxLibrary: 'tokenshade', fxPreset: 'Prone', subject: 'source', duration: 3000 };
const doc = (looks) => ({ id: 't1', flags: { animater: { [APPLIED_FLAG]: looks } } });

test('the flag keeps token filter looks only, once each; the same look again replaces the older', () => {
  assert.deepEqual(normalizeApplied([{ id: 'a', stage: { kind: 'sound' } }, { id: 'b', stage: prone }, { id: 'b', stage: prone }, null]).map((l) => l.id), ['b']);
  const one = withApplied([], { name: 'Prone', stage: prone }, 'x1');
  const again = withApplied(one, { name: 'Prone', stage: prone }, 'x2');
  assert.deepEqual(again.map((l) => l.id), ['x2']);
  const two = withApplied(again, { name: 'Glow', stage: { ...prone, fxPreset: 'Glow' } }, 'x3');
  assert.deepEqual(two.map((l) => l.name), ['Prone', 'Glow']);
});

test('each screen draws what the flags ask for and stops what they drop', async () => {
  const log = [];
  const looks = new AppliedLooks({ retain: async (stage) => { log.push(`on ${stage.fxPreset} ${stage.destination.id}`); return async () => { log.push(`off ${stage.fxPreset}`); }; } });
  await looks.sync(doc(withApplied([], { name: 'Prone', stage: prone }, 'p')));
  await looks.sync(doc(withApplied([], { name: 'Prone', stage: prone }, 'p')));
  assert.deepEqual(log, ['on Prone t1'], 'nothing redrawn when nothing changed');
  await looks.sync(doc([]));
  assert.deepEqual(log, ['on Prone t1', 'off Prone']);
  await looks.sync(doc(withApplied([], { name: 'Prone', stage: prone }, 'p')));
  await looks.clear();
  assert.equal(log.at(-1), 'off Prone', 'leaving the scene stops them');
});

test('removed while it is still being drawn, the look still comes off (found live: it stayed)', async () => {
  const log = [];
  const looks = new AppliedLooks({ retain: async () => { await new Promise((r) => setTimeout(r, 30)); log.push('on'); return async () => { log.push('off'); }; } });
  const on = looks.sync(doc(withApplied([], { name: 'Prone', stage: prone }, 'p'))), off = looks.sync(doc([]));
  await Promise.all([on, off]);
  assert.deepEqual(log, ['on', 'off']);
  assert.equal(looks.shown.size, 0);
});

test('the studio offers Apply to selected tokens and Remove, through the host', () => {
  const studio = readFileSync(new URL('../../../scripts/ui/tokenshade-studio.mjs', import.meta.url), 'utf8');
  assert.match(studio, /data-action="studio-apply"[^>]*>Apply to selected tokens</);
  assert.match(studio, /data-action="studio-unapply"[^>]*>Remove</);
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /applyTokenFx:async\(stage,name\)=>/);
  assert.match(main, /doc\.setFlag\(ID,APPLIED_FLAG,withApplied\(/);
  assert.match(main, /Hooks\.on\(`update\$\{name\}`, \(doc, change\) => \{ if \(doc\.parent === canvas\?\.scene && touchesApplied\(change, ID\)\) void appliedLooks\.sync\(doc\); \}\);/);
});

// Roi: Tokenshade on drawings and tiles.
test('tiles and drawings keep looks in the same flag: a change to it is told from any other change', () => {
  assert.deepEqual(APPLIED_ON, ['Token', 'Tile', 'Drawing']);
  assert.equal(touchesApplied({ flags: { animater: { [APPLIED_FLAG]: [] } } }), true);
  assert.equal(touchesApplied({ flags: { animater: { [`-=${APPLIED_FLAG}`]: null } } }), true);
  assert.equal(touchesApplied({ flags: { animater: { sunlight: 'tree' } } }), false);
  assert.equal(touchesApplied({ flags: { other: { [APPLIED_FLAG]: [] } } }), false);
  assert.equal(touchesApplied({ x: 10 }), false);
  assert.equal(touchesApplied({ flags: { animater: null } }), false);
  assert.deepEqual(appliedDocs({ tokens: ['t'], tiles: ['i'], drawings: ['d'] }), ['t', 'i', 'd']);
  assert.deepEqual(appliedDocs(null), []);
});

test('a tile\'s look is drawn on the tile and stopped when its flag goes', async () => {
  const drawn = [], stopped = [];
  const looks = new AppliedLooks({ retain: async (stage) => { drawn.push(stage.destination.documentName); return async () => { stopped.push(stage.fxPreset); }; } });
  const tile = { id: 'tile1', documentName: 'Tile', flags: { animater: { [APPLIED_FLAG]: withApplied([], { name: 'Prone', stage: prone }, 'x1') } } };
  await looks.sync(tile);
  assert.deepEqual(drawn, ['Tile']);
  tile.flags.animater = {};
  await looks.sync(tile);
  assert.deepEqual(stopped, ['Prone']);
});
