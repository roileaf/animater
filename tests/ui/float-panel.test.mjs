import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adrift, placing, floated } from '../../scripts/ui/float-panel.mjs';

// Issue #25: "When I click on either Map Painter or Moments the right-hand Foundry menu moves over to the left, but I
// can't seem to select anything." Foundry's body is a flex row, so a panel the stylesheet has not reached is not just
// unstyled: it becomes a column of that row and pushes the sidebar aside. Forcing the Moments panel to position:
// static on a live world moved #sidebar left by exactly the panel's width, which is what the screenshot shows.
const fake = (position) => { const set = []; return { set, style: { setProperty: (n, v, p) => set.push([n, v, p]) }, position }; };
const put = (seen) => (el) => seen.push(el);

test('a floating panel the stylesheet never reached places itself', () => {
  assert.equal(adrift('static'), true);
  assert.equal(adrift(''), true, 'no answer at all is adrift too');
  assert.equal(adrift(undefined), true);
  assert.equal(adrift('fixed'), false);
  assert.equal(adrift('absolute'), false, 'placed is placed, however it was done');

  const seen = [], el = fake('static');
  assert.equal(floated(el, 'panel', put(seen), (e) => ({ position: e.position })), true, 'it had to place it');
  assert.deepEqual(seen, [el], 'and it was put on the page first, either way');
  const by = Object.fromEntries(el.set.map(([n, v]) => [n, v]));
  assert.equal(by.position, 'fixed', 'out of the flex row: the sidebar keeps its place');
  assert.deepEqual([by.right, by.bottom], ['18px', '18px'], 'in the corner its stylesheet would have used');
  assert.equal(by['max-height'], '80vh', 'and never taller than the window, so all of it can be reached');
  assert.ok(el.set.every(([, , p]) => p === 'important'), 'firmly: whatever left it static does not get to keep it there');
});

test('a panel the stylesheet did reach is left exactly as it was', () => {
  const seen = [], el = fake('fixed');
  assert.equal(floated(el, 'panel', put(seen), (e) => ({ position: e.position })), false);
  assert.deepEqual(el.set, [], 'nothing of ours is written over a working stylesheet');
  assert.deepEqual(seen, [el], 'it still goes on the page');
  // Told nothing about how it landed, nothing is changed: a rule that cannot see must not reach for the element.
  const blind = fake('static');
  assert.equal(floated(blind, 'panel', put([]), () => null), false);
  assert.deepEqual(blind.set, []);
  assert.equal(floated(null, 'panel', put([])), false, 'and no element is nothing to place');
});

test('each kind of floating thing is placed as its own sort', () => {
  // A layer that is only looked at never swallows a click; one meant to be clicked does not say so.
  assert.equal(placing('cover')['pointer-events'], 'none');
  assert.equal(placing('cover').inset, '0');
  assert.equal(placing('stage').inset, '0');
  assert.equal(placing('stage')['pointer-events'], undefined, 'a handout waiting to be put down must be clickable');
  // One that puts itself where it points keeps its own top and left: it is only taken out of the row.
  assert.deepEqual(Object.keys(placing('point')).sort(), ['position', 'z-index']);
  assert.deepEqual(placing('nonsense'), placing('panel'), 'an unknown kind is a panel');
  assert.notEqual(placing('panel'), placing('panel'), 'each caller gets its own, so one cannot edit the next one’s');
});

test('every floating thing the module puts on the page goes through it', () => {
  const files = ['scripts/main.mjs', 'scripts/ui/region-panel.mjs', 'scripts/ui/hover-explain.mjs',
    'scripts/ui/token-looks.mjs', 'scripts/ui/tour-engine.mjs', 'scripts/engines/flash/flash-combat.mjs'];
  for (const name of files) {
    const text = readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
    assert.ok(/import \{ floated \}/.test(text), `${name} knows how to place what it floats`);
    // Nothing is put on the page behind its back: the one body.append left is the one inside a floated() of its own,
    // where the caller does the putting itself (that layer goes after the board, not at the end of the body).
    const loose = text.split('\n').filter((line) => line.includes('document.body.append(') && !line.includes('floated('));
    assert.deepEqual(loose, [], `${name} floats everything it puts on the page`);
  }
  // The panel in the report, by name, and the one beside it.
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /floated\(box, "panel"\);/);
  const region = readFileSync(new URL('../../scripts/ui/region-panel.mjs', import.meta.url), 'utf8');
  assert.match(region, /floated\(box, 'panel'\);/);
});
