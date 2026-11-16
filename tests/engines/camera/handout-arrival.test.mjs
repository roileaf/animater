import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HANDOUT_ARRIVALS, HANDOUT_MS, HANDOUT_LOOKS,
  handoutAt, handoutHere, handoutMs, handoutPick, handoutSeed,
  handoutHasRod, handoutHasRods, handoutHasDust, handoutDust, handoutLight,
} from '../../../scripts/engines/camera/handout-arrival.mjs';

test('every look that arrives takes a known time, and off takes none', () => {
  for (const look of HANDOUT_LOOKS) {
    assert.ok(HANDOUT_MS[look] > 0, `${look} lasts`);
    assert.ok(HANDOUT_MS[look] <= 1500, `${look} is not something anyone waits through`);
    assert.ok(HANDOUT_ARRIVALS[look], `${look} is offered by name`);
  }
  assert.equal(handoutMs('off'), 0);
  assert.equal(handoutMs('nonsense'), 0, 'a look nobody has heard of simply does not arrive');
});

test('every look ends exactly at rest, so nothing is left leaning or adrift', () => {
  for (const look of HANDOUT_LOOKS) {
    const end = handoutAt(look, 1);
    assert.equal(end.opacity, 1, `${look} is fully there`);
    assert.equal(end.scale, 1, `${look} is its true size`);
    assert.equal(end.dx, 0, `${look} is home across`);
    assert.equal(end.dy, 0, `${look} is home down`);
    assert.equal(end.rot, 0, `${look} is square`);
    assert.equal(end.fold, 0); assert.equal(end.crease, 0); assert.equal(end.roll, 0);
    assert.equal(end.spread, 0, `${look} is open to both edges`);
    // -0 reads back out of a saved frame as a minus sign nobody wrote.
    for (const [key, v] of Object.entries(end)) assert.ok(!Object.is(v, -0), `${look}.${key} is 0, never -0`);
  }
});

test('off is already at rest on its first frame: Foundry’s own window, untouched', () => {
  assert.deepEqual(handoutAt('off', 0), handoutAt('off', 1));
  assert.equal(handoutAt('off', 0).opacity, 1);
});

test('each look starts somewhere other than where it lands', () => {
  const start = (look) => handoutAt(look, 0);
  assert.equal(start('unfold').fold, 1, 'a letter starts folded shut');
  assert.ok(start('unfold').crease > 0.3, 'with its top and bottom still away');
  assert.equal(start('unroll').roll, 1, 'a scroll starts rolled up');
  assert.equal(start('spread').spread, 0.5, 'a map starts shut at its middle, half the width away on each side');
  assert.ok(start('laid').dy > 0.5, 'a laid page comes up from below');
  assert.ok(start('held').dy > 0.5, 'so does one held up');
  assert.ok(start('blown').dy < -0.5, 'a blown page comes in from above');
  assert.ok(Math.abs(start('blown').rot) > 10, 'tumbling');
  for (const look of HANDOUT_LOOKS) assert.equal(start(look).opacity, 0, `${look} fades up rather than appearing`);
});

test('a page is readable almost at once, however it arrives', () => {
  // Opacity is about being seen, not about the motion: a handout nobody can read yet is a handout nobody is reading.
  for (const look of HANDOUT_LOOKS) assert.equal(handoutAt(look, 0.2).opacity, 1, look);
});

test('nothing moves backwards: every look eases home and stays there', () => {
  for (const look of HANDOUT_LOOKS) {
    let last = Infinity;
    for (let i = 0; i <= 10; i++) {
      const f = handoutAt(look, i / 10);
      const away = Math.abs(f.dy) + Math.abs(f.fold) + Math.abs(f.roll) + Math.abs(f.spread);
      assert.ok(away <= last + 1e-9, `${look} at ${i / 10} is no further out than before`);
      last = away;
    }
  }
});

test('a frame past either end is the frame at that end', () => {
  for (const look of HANDOUT_LOOKS) {
    assert.deepEqual(handoutAt(look, -3), handoutAt(look, 0));
    assert.deepEqual(handoutAt(look, 9), handoutAt(look, 1));
    assert.deepEqual(handoutAt(look, NaN), handoutAt(look, 0));
  }
});

test('the scene speaks first, then the table, then nothing', () => {
  assert.equal(handoutHere('unroll', 'laid'), 'unroll', 'the scene’s own choice wins');
  assert.equal(handoutHere(null, 'laid'), 'laid', 'else the table’s');
  assert.equal(handoutHere(undefined, undefined), 'off', 'and with neither, nothing happens');
  assert.equal(handoutHere('rubbish', 'held'), 'held', 'a flag nobody recognises is not a look');
  assert.equal(handoutHere('off', 'held'), 'off', 'a scene may say plainly that it wants none');
});

test('whichever suits it picks one look, the same one for the same handout', () => {
  const a = handoutPick('any', handoutSeed('The Duke’s letter'));
  const b = handoutPick('any', handoutSeed('The Duke’s letter'));
  assert.equal(a, b, 'one handout arrives the same way on every screen it opens on');
  assert.ok(HANDOUT_LOOKS.includes(a));
  // Across many handouts it reaches more than one look, or "whichever suits it" is a lie.
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(handoutPick('any', handoutSeed(`page ${i}`)));
  assert.ok(seen.size > 1, 'different handouts do not all arrive alike');
  assert.equal(handoutPick('unroll', 0.9), 'unroll', 'a chosen look is never swapped');
});

test('the seed is a number between 0 and 1, whatever it is handed', () => {
  for (const text of ['', 'a', 'The Duke’s letter', 'שלום', null, undefined]) {
    const n = handoutSeed(text);
    assert.ok(n >= 0 && n < 1, `${text}: ${n}`);
  }
});

test('a map opens out from the middle, evenly, and goes nowhere while it does', () => {
  // Two hands pulling against each other: the same amount uncovered on each side, every frame.
  for (let i = 0; i <= 10; i++) {
    const f = handoutAt('spread', i / 10);
    assert.ok(f.spread >= 0 && f.spread <= 0.5, `${i / 10}: ${f.spread}`);
    assert.equal(f.dx, 0, 'a map is opened where it lies');
    assert.equal(f.dy, 0);
    assert.equal(f.roll, 0, 'it is not the one-edged scroll');
    assert.equal(f.fold, 0, 'nor a folded letter');
  }
  // The roll holds for a moment before it breaks open, so it reads as paper under tension.
  assert.ok(handoutAt('spread', 0.1).spread > handoutAt('unroll', 0.1).roll * 0.5 * 0.9);
  assert.ok(handoutAt('spread', 0.5).spread < 0.25, 'and is more than half open by halfway');
  assert.ok(handoutHasRods('spread'), 'a map is wound on two rods');
  assert.ok(!handoutHasRods('unroll'), 'a scroll on one');
  assert.ok(!handoutHasRod('spread'), 'and the single running edge is not a map');
});

test('only the looks that want extras get them', () => {
  assert.ok(handoutHasRod('unroll')); assert.ok(!handoutHasRod('laid'));
  assert.ok(handoutHasDust('laid')); assert.ok(!handoutHasDust('unroll'));
  assert.equal(handoutDust('unroll', 0.5), 0, 'a scroll knocks up no dust');
  assert.equal(handoutDust('laid', 0.1), 0, 'and dust waits until the page lands');
  assert.ok(handoutDust('laid', 0.55) > 0.5, 'then it is there');
  assert.equal(handoutDust('laid', 1), 0, 'and gone by the end');
});

test('the light on the page is the light of the scene it arrives into', () => {
  const noon = handoutLight({ darkness: 0, weather: '' });
  assert.ok(noon.warm < 0.2 && noon.veil < 0.1, 'daylight is not firelight');
  assert.ok(noon.paper > 0.9, 'and the page is simply bright');
  assert.equal(noon.flicker, false);

  const torch = handoutLight({ darkness: 0.9, weather: '', lit: true });
  assert.ok(torch.warm > 0.7, 'a torch at midnight is warm');
  assert.ok(torch.veil > 0.3, 'and the map behind it is dark');
  assert.equal(torch.flicker, true, 'a flame is never steady');

  const rain = handoutLight({ darkness: 0.2, weather: 'rain' });
  assert.equal(rain.wet, true, 'rain runs over the view');
  assert.ok(rain.cool > 0.4, 'and the light is cold');
  assert.equal(handoutLight({ darkness: 0.2, weather: 'thunderstorm' }).wet, true);
  assert.equal(handoutLight({ darkness: 0.2, weather: 'snow' }).wet, false, 'snow is not rain');
  assert.ok(handoutLight({ darkness: 0.2, weather: 'snow' }).cool > 0.4, 'but it is just as cold');

  const deep = handoutLight({ darkness: 0, weather: 'rain', underground: true });
  assert.equal(deep.warm, 1, 'below ground, what they carry is the only light');
  assert.equal(deep.wet, false, 'and no weather reaches them');
  assert.equal(deep.cool, 0);
});

test('a handout is never too dark to read, whatever the scene is doing', () => {
  for (const darkness of [0, 0.3, 0.6, 0.9, 1]) {
    for (const weather of ['', 'rain', 'blizzard', 'fog']) {
      for (const underground of [false, true]) {
        const light = handoutLight({ darkness, weather, underground });
        assert.ok(light.paper >= 0.5, `${darkness}/${weather}/${underground}: ${light.paper}`);
        for (const key of ['warm', 'cool', 'veil', 'paper']) {
          assert.ok(light[key] >= 0 && light[key] <= 1, `${key} stays within itself`);
        }
      }
    }
  }
});

test('nonsense asked of the light is daylight, not a crash', () => {
  const bad = handoutLight({ darkness: NaN, weather: null, underground: undefined, lit: undefined });
  assert.ok(Number.isFinite(bad.warm) && Number.isFinite(bad.paper));
  assert.equal(handoutLight().wet, false);
});
