import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureFeatReviews, FEAT_REVIEW_GENERATORS } from '../../../../tools/ensure-feat-reviews.mjs';

test('fresh checkout restores every development review without source caches', () => {
  const source = fileURLToPath(new URL('../../../../', import.meta.url));
  const root = mkdtempSync(join(tmpdir(), 'animater-feat-reviews-'));
  try {
    for (const dir of ['tools', 'data']) mkdirSync(join(root, dir));
    for (const file of ['data/pf2e-feats.mjs', ...FEAT_REVIEW_GENERATORS.map(g => g.script)]) {
      copyFileSync(join(source, file), join(root, file));
    }
    ensureFeatReviews(root);
    ensureFeatReviews(source);
    for (const { output } of FEAT_REVIEW_GENERATORS) {
      assert.deepEqual(readFileSync(join(root, output)), readFileSync(join(source, output)), output);
    }
    // Existing local review edits must survive later build invocations.
    const before = FEAT_REVIEW_GENERATORS.map(g => readFileSync(join(root, g.output)));
    ensureFeatReviews(root);
    FEAT_REVIEW_GENERATORS.forEach((g, i) => assert.deepEqual(readFileSync(join(root, g.output)), before[i]));
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'animater-feat-reviews-')));
    rmSync(root, { recursive: true, force: true });
  }
});
