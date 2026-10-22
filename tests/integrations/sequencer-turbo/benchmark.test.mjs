import { test } from 'node:test';
import assert from 'node:assert/strict';

const { BENCH_PATCHES, benchPhases, benchDrift, summarizeBenchmark } = await import('../../../scripts/integrations/sequencer-turbo/benchmark.mjs');

const row = (avgMs, extra = {}) => ({ avgMs, p95Ms: avgMs * 1.5, fps: Math.round(1000 / avgMs), effectSkips: 0, soundSkips: 0, culled: 0, ...extra });

test('phases measure all off and all on at the start and again at the end', () => {
  const labels = benchPhases().map(([label]) => label);
  assert.deepEqual(labels, ['all off', 'all on', ...BENCH_PATCHES.map((p) => `${p} only`), 'all off (end)', 'all on (end)']);
  const phases = Object.fromEntries(benchPhases());
  assert.deepEqual(phases['all off (end)'], {});
  assert.deepEqual(phases['all on (end)'], Object.fromEntries(BENCH_PATCHES.map((p) => [p, true])));
  assert.deepEqual(phases['sound only'], { sound: true });
});

test('drift is the signed change of each repeated phase from its first run', () => {
  const drift = benchDrift({ 'all off': row(20), 'all on': row(10), 'all off (end)': row(22), 'all on (end)': row(9) });
  assert.ok(Math.abs(drift['all off'] - 0.1) < 1e-9);
  assert.ok(Math.abs(drift['all on'] + 0.1) < 1e-9);
  assert.deepEqual(benchDrift({ 'all off': row(20) }), {});
});

test('summary compares against the mean of both all-off runs and reports drift on the end rows', () => {
  const table = summarizeBenchmark({
    'all off': row(18), 'all on': row(18), 'sound only': row(22, { soundSkips: 4 }),
    'all off (end)': row(22), 'all on (end)': row(16),
  });
  assert.equal(table['all off']['vs off'], '—');
  assert.equal(table['all on']['vs off'], '10.0% less');
  assert.equal(table['sound only']['vs off'], '10.0% more');
  assert.equal(table['sound only']['sound skips'], 4);
  assert.equal(table['all on (end)']['vs off'], '20.0% less');
  assert.equal(table['all off (end)'].drift, '+22.2%');
  assert.equal(table['all on (end)'].drift, '-11.1%');
  assert.equal(table['all on'].drift, '—');
});

test('summary without an all-off run leaves the comparison blank', () => {
  const table = summarizeBenchmark({ 'all on': row(10) });
  assert.equal(table['all on']['vs off'], '—');
});
