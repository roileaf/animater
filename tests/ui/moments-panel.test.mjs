import test from 'node:test';
import assert from 'node:assert/strict';
import { momentsPanelHtml, momentsPanelMode, momentsReadout, MOMENT_GLYPHS, MOMENT_GROUPS } from '../../scripts/ui/moments-panel.mjs';
import { MOMENTS, WHERES, TETHERS, SWAYS, presetsAll } from '../../scripts/engines/camera/screen-moments.mjs';

const styles = { ...Object.fromEntries(Object.entries(TETHERS).map(([k, v]) => [k, { ...v, forKind: 'tether' }])),
  ...Object.fromEntries(Object.entries(SWAYS).map(([k, v]) => [k, { ...v, forKind: 'sway' }])) };
const presets = presetsAll({ mine: { name: 'My own', moments: [{ kind: 'shake', strength: 1 }] } });
const html = momentsPanelHtml({ moments: MOMENTS, wheres: WHERES, styles, presets });

test('every moment the engine has reaches the dashboard, grouped and drawn', () => {
  for (const [kind, how] of Object.entries(MOMENTS)) {
    assert.ok(html.includes(`data-an-moment="${kind}"`), `${kind} has a tile`);
    assert.ok(html.includes(how.name), `${kind} is named`);
    assert.ok(MOMENT_GLYPHS[kind], `${kind} has a glyph: a wall of words is what this replaced`);
  }
  for (const group of MOMENT_GROUPS) assert.ok(html.includes(group.name), group.name);
});

test('a moment nobody grouped still appears, rather than quietly vanishing', () => {
  const made = momentsPanelHtml({ moments: { ...MOMENTS, newthing: { name: 'New thing', hint: 'Just added', on: 'board', holds: true, strength: 0.5 } }, wheres: WHERES, tethers: TETHERS });
  assert.ok(made.includes('data-an-moment="newthing"'));
  assert.ok(made.includes('>More<'), 'it falls into a last group');
});

test('the dashboard takes every choice a moment can carry', () => {
  for (const field of ['data-an-readout', 'data-an-strength', 'data-an-seconds', 'data-an-fade', 'data-an-style', 'data-an-colour', 'data-an-stop', 'data-an-macro', 'data-an-make', 'data-an-close']) {
    assert.ok(html.includes(field), field);
  }
  // How far a moment reaches is not typed: it is the ring on the map, sized with the wheel, as the cave-in is.
  assert.ok(!html.includes('data-an-radius'), 'no box asking for a number of squares');
  // Where and Who are both pressed rather than chosen from a list.
  assert.match(html, /data-an-seg="where"/);
  assert.match(html, /data-an-seg="who"/);
  for (const where of Object.keys(WHERES)) assert.ok(html.includes(`data-an-where="${where}"`), where);
  // Every style any moment has, grouped by whose it is, so a sway's is plainly not a tether's.
  for (const kind of [...Object.keys(TETHERS), ...Object.keys(SWAYS)]) assert.ok(html.includes(`value="${kind}"`), kind);
  assert.match(html, /<optgroup label="Tether">/);
  assert.match(html, /<optgroup label="Sway and bob">/);
  // Sets of moments, called as one, kept and forgotten.
  for (const field of ['data-an-preset', 'data-an-play', 'data-an-save', 'data-an-forget']) assert.ok(html.includes(field), field);
  assert.ok(html.includes('The roof comes down'), 'the ones we ship');
  assert.match(html, /data-an-own="1"[^>]*>My own · mine/, 'and the GM\'s own, marked as theirs');
  // The one that only makes sense sometimes starts hidden.
  assert.match(html, /data-an-style-row hidden/);
});

test('nothing a moment is called can break the page it is written into', () => {
  const nasty = momentsPanelHtml({
    moments: { bad: { name: '<img src=x onerror=alert(1)>', hint: '" onclick="alert(2)', on: 'board', holds: true, strength: 1 } },
    wheres: WHERES, tethers: TETHERS,
  });
  assert.ok(!nasty.includes('<img src=x'), 'a name is text, not markup');
  assert.ok(!nasty.includes('onclick="alert'), 'and a hint cannot climb out of its attribute');
  assert.ok(nasty.includes('&lt;img'));
});

// A stand-in for the page, so the mode filter can be tested without a browser: enough of an element to be asked
// about its children and to hold an attribute.
function fakePanel(html) {
  const tiles = [...html.matchAll(/data-an-moment="([^"]+)" data-an-wheres="([^"]*)"/g)]
    .map(([, kind, wheres]) => ({ kind, wheres, hidden: false, dataset: { anMoment: kind, anWheres: wheres },
      hasAttribute: function (a) { return a === 'hidden' ? this.hidden : false; },
      toggleAttribute: function (a, on) { if (a === 'hidden') this.hidden = !!on; } }));
  // One group per heading, each holding the tiles that follow it.
  const groups = [];
  for (const part of html.split('<section class="an-group"').slice(1)) {
    const mine = [...part.matchAll(/data-an-moment="([^"]+)"/g)].map(([, k]) => tiles.find((t) => t.kind === k));
    groups.push({ tiles: mine, hidden: false, hasAttribute: () => false, toggleAttribute: function (a, on) { if (a === 'hidden') this.hidden = !!on; },
      querySelectorAll: () => mine });
  }
  const style = { hidden: false, toggleAttribute: function (a, on) { if (a === 'hidden') this.hidden = !!on; } };
  return {
    tiles, groups, style,
    querySelectorAll: (sel) => (sel.includes('an-group') ? groups : tiles),
    querySelector: (sel) => (sel.includes('style-row') ? style : null),
    shown: () => tiles.filter((t) => !t.hidden).map((t) => t.kind),
  };
}

test('a mode shows only what it can do', () => {
  const box = fakePanel(html);
  momentsPanelMode(box, 'screen');
  const onScreen = box.shown();
  assert.ok(onScreen.includes('grey') && onScreen.includes('streak'));
  assert.ok(!onScreen.includes('sway') && !onScreen.includes('tether'), 'nothing that needs something picked');
  assert.ok(!onScreen.includes('shock'), 'and no shockwave over a whole screen');
  assert.equal(box.style.hidden, true, 'a line\'s look is a tether\'s alone');

  momentsPanelMode(box, 'tokens');
  const onThings = box.shown();
  assert.ok(onThings.includes('sway') && onThings.includes('bob') && onThings.includes('tether'));
  assert.ok(!onThings.includes('roll'), 'the view cannot lean at one token');
  assert.equal(box.style.hidden, false);

  momentsPanelMode(box, 'point');
  const atPlace = box.shown();
  assert.ok(atPlace.includes('shock') && atPlace.includes('glow') && atPlace.includes('shake'));
  assert.ok(!atPlace.includes('sway'));

  // A group with nothing left in it goes too, rather than leaving a heading over an empty space.
  momentsPanelMode(box, 'tokens');
  const empty = box.groups.filter((g) => g.tiles.every((t) => t.hidden));
  assert.ok(empty.length > 0 && empty.every((g) => g.hidden), 'an empty group is hidden');
  assert.ok(box.groups.some((g) => !g.hidden));
});

test('the readout says what is running and where, and says so plainly when nothing is', () => {
  assert.equal(momentsReadout([], MOMENTS), 'Nothing running.');
  const said = momentsReadout([{ kind: 'grey', where: 'screen' }, { kind: 'shock', where: 'point' }, { kind: 'sway', where: 'tokens' }], MOMENTS);
  assert.match(said, /<b>Grey<\/b> everywhere/);
  assert.match(said, /<b>Shock<\/b> at a place/);
  assert.match(said, /<b>Sway<\/b> on what was picked/);
  // A moment the reader has never heard of is still reported, by its own name.
  assert.match(momentsReadout([{ kind: 'mystery', where: 'screen' }], MOMENTS), /<b>mystery<\/b>/);
});
