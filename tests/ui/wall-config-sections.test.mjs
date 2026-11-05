import test from 'node:test';
import assert from 'node:assert/strict';
import { appendWallSection } from '../../scripts/ui/wall-config-sections.mjs';

// Just enough of a form: `after` records which element a section was placed behind.
const fieldset = (details = null) => {
  const f = { closest: (s) => (s === 'details' ? details : null), after: (section) => { f.followedBy = section; } };
  return f;
};
const formWith = (fieldsets, body = null) => ({
  querySelectorAll: () => fieldsets,
  querySelector: () => body,
  append(section) { this.appended = section; },
});

test('a section goes after the last fieldset of a plain wall form', () => {
  const first = fieldset(), last = fieldset(), section = {};
  appendWallSection(formWith([first, last]), section);
  assert.equal(last.followedBy, section);
  assert.equal(first.followedBy, undefined);
});

test("in the palette a section goes after Foundry's hidden door animation block, not inside it", () => {
  const block = { after(section) { this.followedBy = section; } }, inside = fieldset(block), section = {};
  appendWallSection(formWith([fieldset(), inside]), section);
  assert.equal(block.followedBy, section);
  assert.equal(inside.followedBy, undefined);
});

test('several sections keep their order: each goes after the one before', () => {
  const block = { after(section) { this.followedBy = section; } }, one = fieldset(), fieldsets = [fieldset(block)];
  const root = formWith(fieldsets);
  appendWallSection(root, one);
  fieldsets.push(one);
  const two = {};
  appendWallSection(root, two);
  assert.equal(block.followedBy, one);
  assert.equal(one.followedBy, two);
});

test('with no fieldset at all it goes into the scrolling body, else the root', () => {
  const body = { append(section) { this.appended = section; } }, section = {};
  appendWallSection(formWith([], body), section);
  assert.equal(body.appended, section);
  const bare = formWith([]);
  appendWallSection(bare, section);
  assert.equal(bare.appended, section);
});
