import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANIMAL_GROUPS, MOST_PLACED, animalPreset, animalsPanelHtml, placedChanges, placedList, withPlaced, withoutPlaced } from '../../scripts/ui/animals-panel.mjs';

const rabbit = (id, x = 1, y = 2) => ({ id, kind: 'rabbit', x, y });

test('it offers every creature the scene already has a setting for', () => {
  const kinds = ANIMAL_GROUPS.flatMap(([, list]) => list.map(([k]) => k)).sort();
  assert.deepEqual(kinds, ['bats', 'crawlers', 'deer', 'fish', 'foxes', 'frogs', 'insects', 'moths', 'owls', 'rabbits', 'rats', 'waterBirds', 'wildBirds', 'wolves', 'squirrels', 'snakes'].sort());
});

test('a preset sets the outdoors and leaves dark places alone', () => {
  const out = animalPreset('many');
  assert.equal(out.rabbits, 'many');
  assert.equal(out.frogs, 'many');
  assert.equal('rats' in out, false);
  assert.equal('wolves' in out, false, 'wolves only when asked for');
  assert.equal(animalPreset('').deer, '', 'usual is the empty value the scene settings use');
});

test('placed animals are tidied, capped, and taken away last first', () => {
  assert.deepEqual(placedList(null), []);
  assert.deepEqual(placedList([rabbit('a'), { id: 'b', kind: 'dragon', x: 1, y: 1 }, { id: 'c', kind: 'fox', x: 'no', y: 1 }, { kind: 'fox', x: 1, y: 1 }]), [rabbit('a')]);
  let list = [];
  for (let i = 0; i < MOST_PLACED + 3; i++) list = withPlaced(list, rabbit(`r${i}`));
  assert.equal(list.length, MOST_PLACED);
  assert.equal(list[0].id, 'r3', 'the oldest go');
  const mixed = [rabbit('a'), { id: 'f', kind: 'fox', x: 0, y: 0 }, rabbit('b')];
  assert.deepEqual(withoutPlaced(mixed, 'rabbit').map((p) => p.id), ['a', 'f']);
  assert.deepEqual(withoutPlaced(mixed, 'rabbit', { all: true }).map((p) => p.id), ['f']);
  assert.deepEqual(withoutPlaced(mixed, 'deer').map((p) => p.id), ['a', 'f', 'b']);
});

test('each screen adds what it lacks and drops what has gone', () => {
  const { add, remove } = placedChanges(new Set(['a', 'old']), [rabbit('a'), rabbit('b')]);
  assert.deepEqual(add.map((p) => p.id), ['b']);
  assert.deepEqual(remove, ['old']);
});

test('the panel shows the scene settings as they are', () => {
  const html = animalsPanelHtml({ flags: { outdoorLife: 'on', rabbits: 'many', deerSize: 'huge', placedAnimals: [rabbit('a')] }, count: 12 });
  assert.ok(html.includes('class="is-active" data-action="setAnimal" data-key="rabbits" data-value="many"'));
  assert.ok(html.includes('class="is-active" data-action="setAnimal" data-key="foxes" data-value=""'), 'unset is Usual');
  assert.ok(/data-size-key="deerSize"[^>]*value="180"/.test(html), 'a name saved before the sliders keeps its size');
  assert.ok(/data-size-key="foxesSize"[^>]*value="100"/.test(html), 'unset is the usual size');
  assert.ok(/data-size-key="animalScale"[^>]*value="100"/.test(html), 'and so is the whole map');
  assert.ok(/data-size-key="frogsSize" min="10" max="300" step="5"/.test(animalsPanelHtml({ flags: {} })));
  assert.ok(/data-size-key="wolvesSize"[^>]*value="35"/.test(animalsPanelHtml({ flags: { wolvesSize: 35 } })));
  assert.ok(html.includes('class="is-active" data-action="setLife" data-value="on"'));
  assert.ok(html.includes('12 about on your screen'));
  assert.ok(html.includes('class="is-active" data-action="setAnimal" data-key="wolves" data-value=""'), 'no wolves until chosen');
  assert.ok(/data-kind="rabbit" data-tooltip="Take away the last one" aria-label/.test(html), 'one to take away');
  assert.ok(/data-kind="fox" data-tooltip="Take away the last one" disabled/.test(html), 'none to take away');
  assert.ok(animalsPanelHtml({ flags: {} }).includes('class="is-active" data-action="setLife" data-value=""'), 'off until chosen');
  assert.ok(animalsPanelHtml({ flags: {}, note: '<x>' }).includes('&lt;x&gt;'));
  assert.ok(animalsPanelHtml({ aiming: 'fox' }).includes('class="is-active" data-action="placeAnimal" data-kind="fox"'));
});
