import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { viewedRegions } from '../../scripts/core/viewed-regions.mjs';

test('a region on another level does not count; one with no say in it does', () => {
  const here = { id: 'here', viewed: true }, below = { id: 'below', viewed: false }, old = { id: 'old' };
  assert.deepEqual(viewedRegions([here, below, old]).map((r) => r.id), ['here', 'old']);
  assert.deepEqual(viewedRegions(undefined), []);
  assert.deepEqual(viewedRegions(new Set([below])), []);
});

test('Animater reads regions by level, so a region on one floor never reaches the others', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  const loose = [...main.matchAll(/for \(const \w+ of canvas\??\.scene\?\.regions/g)];
  assert.equal(loose.length, 0, `${loose.length} loops over every region of the scene`);
});
