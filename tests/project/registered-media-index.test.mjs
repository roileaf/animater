import test from 'node:test';
import assert from 'node:assert/strict';
import {registeredMedia} from '../../scripts/engines/media/media-library-model.mjs';

// Mirrors Sequencer's Database: per-key lookups scan every entry and match by prefix.
function database(paths) {
  const entries = paths.map(([dbPath, files]) => ({dbPath, template: [100, 0, 0], getAllFiles: () => files, getFile: () => files[0]}));
  return {
    entries: {jb2a: entries},
    searchFor: () => ['jb2a'],
    getPathsUnder: () => [...new Set(entries.map(e => e.dbPath))],
    getEntry(key) {
      const exact = entries.filter(e => e.dbPath === key), found = exact.length ? exact : entries.filter(e => e.dbPath.startsWith(key));
      return found.length === 1 ? found[0] : found;
    },
    getAllFileEntries: key => [...new Set(entries.filter(e => e.dbPath.startsWith(key)).flatMap(e => e.getAllFiles()))],
  };
}

test('the indexed catalog matches Sequencer lookups, including prefix collisions and entry order', () => {
  const db = database([
    ['jb2a.spark.10', ['modules/jb2a/spark_10.webm']],
    ['jb2a.spark.1', ['modules/jb2a/spark_1_b.webm', 'modules/jb2a/spark_1_a.webm']],
    ['jb2a.aura', ['modules/jb2a/aura.webm']],
    ['jb2a.spark.1', ['modules/jb2a/spark_1_c.webm']],
  ]);
  const {entries, ...api} = db;
  assert.deepEqual(registeredMedia(db), registeredMedia(api));
  assert.deepEqual(registeredMedia(db).find(i => i.key === 'jb2a.spark.1').files,
    ['modules/jb2a/spark_1_b.webm', 'modules/jb2a/spark_10.webm', 'modules/jb2a/spark_1_a.webm', 'modules/jb2a/spark_1_c.webm']);
});

test('a large database is catalogued without per-key scans', () => {
  const paths = Array.from({length: 8000}, (_, i) => [`jb2a.effect_${i}.blue`, [`modules/jb2a/effect_${i}.webm`]]);
  const db = database(paths);
  db.getEntry = db.getAllFileEntries = () => assert.fail('per-key Sequencer lookup');
  assert.equal(registeredMedia(db).length, 8000);
});
