import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeVariant, rangeLanding } from '../../../scripts/engines/playback/range-landing.mjs';
import { MEDIA_LANDINGS } from '../../../data/media-landings.mjs';

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
  const table = { 'jb2a.x.a.15ft': 600, 'jb2a.x.a.60ft': 800, 'jb2a.x.b.15ft': 700, 'jb2a.x.b.60ft': 750 };
  assert.equal(rangeLanding('jb2a.x.a', 300, 100, table), 600);
  assert.equal(rangeLanding('jb2a.x.a', 1200, 100, table), 800);
  assert.equal(rangeLanding('jb2a.x.a.60ft', 300, 100, table), 800);
  // Sequencer picks one of a partial path's entries at random: the latest of them.
  assert.equal(rangeLanding('jb2a.x', 300, 100, table), 700);
  assert.equal(rangeLanding('jb2a.x', 1200, 100, table), 800);
  assert.equal(rangeLanding('jb2a.y', 300, 100, table), null);
  assert.equal(rangeLanding('jb2a.x.a', 300, 100, {}), null);
  assert.equal(rangeLanding(undefined, 300, 100, table), null);
  // Not a prefix match on a partial word.
  assert.equal(rangeLanding('jb2a.x.', 300, 100, table), null);
});

test('the measured table holds JB2A ranged weapon variants, later for longer ranges', () => {
  const arrow = (ft) => MEDIA_LANDINGS[`jb2a.arrow.physical.white.01.${ft}`];
  for (const ft of ['05ft', '15ft', '30ft', '60ft', '90ft']) assert.ok(Number.isFinite(arrow(ft)), ft);
  assert.ok(arrow('05ft') <= arrow('15ft') && arrow('15ft') <= arrow('60ft') && arrow('60ft') <= arrow('90ft'));
  for (const ms of Object.values(MEDIA_LANDINGS)) assert.ok(Number.isInteger(ms) && ms > 0 && ms % 10 === 0);
});
