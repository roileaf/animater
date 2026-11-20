import test from 'node:test';
import assert from 'node:assert/strict';
import { dressingOf, dressingKey, festivalColour, handDressing, DRESSING_PLAIN, DRESSING_COLOURS_MOST } from '../../../scripts/engines/motion/holiday-dressing.mjs';

// Roi, passing on a question from another table: "Like if we play on a IRL holiday" — a feast called by hand, with
// no calendar module behind it at all.
test('a feast the GM calls needs no calendar, and wears up to three colours', () => {
  assert.equal(handDressing(null), null, 'nothing called, nothing hung up');
  assert.equal(handDressing({ on: false, colours: ['#ff0000'] }), null, 'a feast turned off is not a feast');
  const one = handDressing({ on: true });
  assert.deepEqual(one.colours, [DRESSING_PLAIN], 'with no colour said, the one everybody hangs out');
  assert.equal(one.name, 'Holiday');
  const three = handDressing({ on: true, name: ' Thanksgiving ', colours: ['#C04000', '#f0a', 'nonsense', '#2e6f3e', '#ffffff'] });
  assert.equal(three.name, 'Thanksgiving', 'named, and tidied');
  assert.deepEqual(three.colours, ['#c04000', '#ff00aa', '#2e6f3e'], 'what is not a colour is dropped, and only three are kept');
  assert.equal(three.colours.length <= DRESSING_COLOURS_MOST, true);
  assert.equal(three.colour, '#c04000', 'the first is the one a roof paints with');
  assert.notEqual(dressingKey(three), dressingKey(handDressing({ on: true, colours: ['#c04000'] })), 'changing the colours changes what is painted');
});

// Roi: "holiday doesnt work?" — and it did not: the bar had a tick that saved a flag, the flag went into the
// roof's key, and nothing anywhere read a calendar or hung anything up.

test('a feast day in the calendar is a colour on the eaves', () => {
  const day = dressingOf({ name: 'Ritual of Stardust', festivalKey: 'ritualstardustsm', color: '#8164B1' });
  assert.equal(day.name, 'Ritual of Stardust');
  assert.equal(day.key, 'ritualstardustsm');
  assert.equal(day.colour, '#8164b1', 'the day’s own colour, however it was written');
});

test("a colour arrives as a string or as Foundry's own Color, and both are read", () => {
  assert.equal(festivalColour('#8164B1'), '#8164b1');
  assert.equal(festivalColour({ css: '#2e7d4f' }), '#2e7d4f', 'a Color says it in css');
  assert.equal(festivalColour({ toString: () => '#b0432e' }), '#b0432e', 'or by being turned into a word');
  assert.equal(festivalColour('#abc'), '#aabbcc', 'three figures mean six');
  assert.equal(festivalColour('scarlet'), null, 'a name is not a colour here');
  assert.equal(festivalColour(null), null);
});

test('a feast with no colour of its own still keeps the day', () => {
  const day = dressingOf({ name: 'Harvest Feast' });
  assert.equal(day.colour, DRESSING_PLAIN, 'lamplight suits any of them');
  assert.equal(day.key, 'harvestfeast', 'and it is known by its name when it has no key');
});

test('an ordinary day hangs nothing up', () => {
  assert.equal(dressingOf(null), null);
  assert.equal(dressingOf(undefined), null);
  assert.equal(dressingOf({}), null, 'a festival with no name is not a festival');
  assert.equal(dressingOf({ name: '   ' }), null);
  assert.equal(dressingKey(null), '', 'and says nothing in the key, so nothing is painted again');
});

test('a day can carry several feasts, and keeps every one of them', () => {
  // Roi: "also there are three holidays right now..." — 21 Sarenith carries Days of Wrath, the Sunwrought
  // Festival and the Ritual of Stardust at once, and only the first was going up.
  const day = dressingOf([
    { name: 'Sunwrought Festival', festivalKey: 'sunwroughtfestiv', color: '#FF6347' },
    { name: 'Days of Wrath', festivalKey: 'daysofwrathsum00', color: '#B22E3D' },
    { name: 'Ritual of Stardust', festivalKey: 'ritualstardustsm', color: '#8164B1' },
  ]);
  assert.deepEqual(day.names, ['Sunwrought Festival', 'Days of Wrath', 'Ritual of Stardust']);
  assert.deepEqual(day.colours, ['#ff6347', '#b22e3d', '#8164b1'], 'all three colours go up');
  assert.equal(day.colour, '#ff6347', 'and the first is still the one a single colour means');
  assert.equal(day.days.length, 3);
});

test('one feast on its own still works exactly as it did', () => {
  const day = dressingOf({ name: 'Days of Wrath', festivalKey: 'daysofwrathsum00', color: '#B22E3D' });
  assert.deepEqual(day.colours, ['#b22e3d']);
  assert.equal(day.colour, '#b22e3d');
});

test('the word for the day covers every feast on it', () => {
  const three = dressingOf([
    { name: 'A', festivalKey: 'a', color: '#111111' },
    { name: 'B', festivalKey: 'b', color: '#222222' },
  ]);
  const one = dressingOf({ name: 'A', festivalKey: 'a', color: '#111111' });
  assert.notEqual(dressingKey(three), dressingKey(one), 'two feasts are not the same picture as one');
  assert.ok(dressingKey(three).includes('+'), 'and the key says both');
});

test('the word changes when the day does, and only then', () => {
  const one = dressingOf({ name: 'Candlemark', festivalKey: 'candlemark000000', color: '#FFA500' });
  const same = dressingOf({ name: 'Candlemark', festivalKey: 'candlemark000000', color: '#ffa500' });
  const other = dressingOf({ name: 'Crystalhue', festivalKey: 'crystalhue000000', color: '#00CED1' });
  assert.equal(dressingKey(one), dressingKey(same), 'the same day written differently is the same day');
  assert.notEqual(dressingKey(one), dressingKey(other));
});
