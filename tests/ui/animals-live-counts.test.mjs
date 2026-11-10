import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autoCounts, animalsPanelHtml, mapTotals, mapTotalText } from '../../scripts/ui/animals-panel.mjs';
import { FISH_REFILL } from '../../scripts/engines/motion/wildlife.mjs';

// Roi: "can you verify the number of animals on the scene agianst the window data?" Checked live: the rows matched
// when drawn, but the panel never updated while open (fish went 3 to 2, it kept 3), and the fish drained 5 to 1 off a
// river that runs off the map, made good only one per 45-120 s.
test('the rows left on Auto follow the live count; a set number and the town\'s keep theirs', () => {
  const counts = autoCounts({ frogs: '1', fish: 'few' }, { fish: 2, frogs: 3, rabbits: 3.4, pigeons: 5 });
  assert.equal(counts.fish, 2);
  assert.equal(counts.rabbits, 3);
  assert.equal(counts.frogs, undefined, 'Frogs set to 1 keeps showing 1');
  assert.equal(counts.pigeons, undefined, 'the town starts at none and shows its number');
});

test('the panel marks each row and the count above, and refreshes them every two seconds while open', () => {
  const html = animalsPanelHtml({ flags: { outdoorLife: 'on' }, count: 12, live: { fish: 4 } });
  assert.match(html, /class="animater-an-row" data-kind="fish"/);
  assert.match(html, /<small data-animals-about>12 about on your screen<\/small>/);
  const src = readFileSync(new URL('../../scripts/ui/animals-panel.mjs', import.meta.url), 'utf8');
  assert.match(src, /this\._countsTimer = setInterval\(\(\) => this\._refreshCounts\(\), 2000\);/);
  assert.match(src, /async close\(options\) \{ clearInterval\(this\._countsTimer\);/, 'and stops when closed');
});

// Roi: "the animals dashboard doesn't actually tell us the animals in the regions ... so we know the full number of
// animals total in the scene + regions".
test('the regions\' own animals show beside each kind, and the whole map\'s count above, kept up while open', () => {
  assert.deepEqual(mapTotals({ fish: 4, rabbits: 2 }, { gulls: 5, fish: 15 }), { all: 26, inRegions: 20 });
  assert.equal(mapTotalText({ all: 26, inRegions: 20 }), '26 on this map now, 20 of them in regions');
  assert.equal(mapTotalText({ all: 3, inRegions: 0 }), '3 on this map now');
  const html = animalsPanelHtml({ flags: { outdoorLife: 'on' }, count: 6, live: { fish: 4, rabbits: 2 }, regions: { gulls: 5, fish: 15 } });
  assert.match(html, /<span data-map-total>26 on this map now, 20 of them in regions<\/span>/);
  assert.match(html, /data-kind="fish"><span>Fish<small class="animater-an-regions" data-region-count>\+15 in regions<\/small>/);
  assert.match(html, /data-kind="rabbits"><span>Rabbits<small class="animater-an-regions" data-region-count><\/small>/, 'none in regions: nothing said');
  const src = readFileSync(new URL('../../scripts/ui/animals-panel.mjs', import.meta.url), 'utf8');
  assert.match(src, /const total = this\.element\.querySelector\('\[data-map-total\]'\); if \(total\) total\.textContent = mapTotalText\(mapTotals\(live\(\), regions\)\);/);
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /regionLive: \(\) => \{ try \{ const out = \{\}; for \(const life of regionLife\.values\(\)\) for \(const \[kind, n\] of Object\.entries\(animalTally\(life\)\)\)/);
});

test('fish lost off the map are made good quickly enough to keep the river stocked', () => {
  assert.ok(FISH_REFILL.first[1] <= 15 && FISH_REFILL.next[1] <= 20, 'a few seconds, not a minute or two');
  assert.ok(FISH_REFILL.caught[0] >= FISH_REFILL.next[0], 'one the heron took comes back a little later');
  const src = readFileSync(new URL('../../scripts/engines/motion/wildlife.mjs', import.meta.url), 'utf8');
  assert.ok(!src.includes('fishIn = between(Math.random, 45, 120)'), 'the old slow refill is gone');
});
