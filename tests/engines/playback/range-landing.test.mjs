import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeVariant, rangeLanding } from '../../../scripts/engines/playback/range-landing.mjs';
import { MEDIA_LANDINGS, RANGE_UNMEASURED } from '../../../data/media-landings.mjs';

test('rangeVariant picks the variant Sequencer does for a line length', () => {
  // ftToDistanceMap: 05 ft from 0, 15 ft from 2 squares, 30 ft from 5, 60 ft from 9, 90 ft from 15.
  const cases = [[0, '05ft'], [199, '05ft'], [200, '15ft'], [499, '15ft'], [500, '30ft'], [899, '30ft'], [900, '60ft'], [1499, '60ft'], [1500, '90ft'], [9000, '90ft']];
  for (const [px, ft] of cases) assert.equal(rangeVariant(px, 100), ft, `${px} px`);
  // The grid size scales the thresholds.
  assert.equal(rangeVariant(300, 150), '15ft');
  assert.equal(rangeVariant(299, 150), '05ft');
});

test('rangeVariant among the variants a clip has: the shortest covers from 0, the longest on and on', () => {
  assert.equal(rangeVariant(0, 100, ['15ft', '60ft']), '15ft');
  assert.equal(rangeVariant(899, 100, ['15ft', '60ft']), '15ft');
  assert.equal(rangeVariant(5000, 100, ['15ft', '60ft']), '60ft');
  assert.equal(rangeVariant(100, 100, []), null);
});

test('rangeLanding reads the picked variant, a named variant, or the latest of a partial path', () => {
  const tables = { landings: { 'jb2a.x.a.15ft': 600, 'jb2a.x.a.60ft': 800, 'jb2a.x.b.15ft': 700, 'jb2a.x.b.60ft': 750 }, unmeasured: ['jb2a.z.c.15ft', 'jb2a.z.c.60ft', 'jb2a.x.a.90ft'] };
  const at = (asset, px) => rangeLanding(asset, px, 100, tables);
  assert.deepEqual(at('jb2a.x.a', 300), { range: true, landing: 600 });
  assert.deepEqual(at('jb2a.x.a', 1200), { range: true, landing: 800 });
  assert.deepEqual(at('jb2a.x.a.60ft', 300), { range: true, landing: 800 });
  // A trailing file index on a named variant plays that variant.
  assert.deepEqual(at('jb2a.x.a.60ft.0', 300), { range: true, landing: 800 });
  // Sequencer picks one of a partial path's entries at random: the latest of them.
  assert.deepEqual(at('jb2a.x', 300), { range: true, landing: 700 });
  assert.deepEqual(at('jb2a.x', 1200), { range: true, landing: 800 });
  // A variant left unmeasured (others of the clip still play their landing), or a named variant not in the table.
  assert.deepEqual(at('jb2a.x.a', 1600), { range: true, landing: null });
  assert.deepEqual(at('jb2a.x', 1600), { range: true, landing: null });
  assert.deepEqual(at('jb2a.z.c', 300), { range: true, landing: null });
  assert.deepEqual(at('jb2a.z', 300), { range: true, landing: null });
  assert.deepEqual(at('jb2a.x.a.30ft', 300), { range: true, landing: null });
  // No range variants: Sequencer stretches the one file.
  assert.deepEqual(at('jb2a.y', 300), { range: false });
  assert.deepEqual(at(undefined, 300), { range: false });
  // Not a prefix match on a partial word.
  assert.deepEqual(at('jb2a.x.', 300), { range: false });
});

test('the measured table holds JB2A ranged weapon and beam variants, later for longer ranges', () => {
  const arrow = (ft) => MEDIA_LANDINGS[`jb2a.arrow.physical.white.01.${ft}`];
  for (const ft of ['05ft', '15ft', '30ft', '60ft', '90ft']) assert.ok(Number.isFinite(arrow(ft)), ft);
  assert.ok(arrow('05ft') <= arrow('15ft') && arrow('15ft') <= arrow('60ft') && arrow('60ft') <= arrow('90ft'));
  assert.ok(Number.isFinite(MEDIA_LANDINGS['jb2a.fireball.beam.orange.15ft']));
  for (const ms of Object.values(MEDIA_LANDINGS)) assert.ok(Number.isInteger(ms) && ms > 0 && ms % 10 === 0);
  // A variant is either measured or listed as unmeasured, never both.
  for (const key of RANGE_UNMEASURED) assert.ok(!(key in MEDIA_LANDINGS) && /\.\d\dft$/.test(key), key);
});
