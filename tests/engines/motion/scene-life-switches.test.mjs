import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');

// Roi: Scene configuration's Outdoor life and Town life went, as the Animals panel switches each kind. Outdoor life stays
// the panel's On/Off; the town's animals come by their counts there, and an old Town life switch becomes those counts once.
test('scene configuration no longer has Outdoor life or Town life', () => {
  assert.doesNotMatch(main, /name="flags\.\$\{ID\}\.outdoorLife"/);
  assert.doesNotMatch(main, /name="flags\.\$\{ID\}\.townLife"/);
});

test('the town comes from the Animals panel counts, without Outdoor life', () => {
  assert.match(main, /const sceneTownWant = \(\) => \{ if \(!canvas\?\.ready \|\| !outdoorOn\("townLife"\) \|\| undergroundScene\(\)\) return null;/);
  assert.match(main, /const level = townPreview \?\? asked\?\.level \?\? null,/);
  assert.match(main, /const townLevel = \(\) => sceneTownWant\(\)\?\.level \?\? null;/);
});

test('an old Town life switch turns into counts, keeping any the GM set', () => {
  const OLD_TOWN = Function(`return ${main.match(/const OLD_TOWN = (\{[^;]+\});/)[1]}`)();
  assert.deepEqual(Object.keys(OLD_TOWN.quiet), ['pigeons', 'hens', 'cats']);
  assert.equal(OLD_TOWN.busy.dogs, 1, 'a busy town has its stray dog');
  assert.match(main, /exactCountOf\(flags\[kind\]\) === null/);
  assert.match(main, /scene\.unsetFlag\(ID, "townLife"\)/);
});
