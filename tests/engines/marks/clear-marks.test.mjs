import test from 'node:test';
import assert from 'node:assert/strict';
import { CLEAR_MARKS_MESSAGE, clearGroundMarks, receiveClearMarks } from '../../../scripts/engines/marks/clear-marks.mjs';

function host({ isGM = false, gmIds = ['gm'] } = {}) {
  const out = { cleared: 0, sent: [] };
  const deps = {
    isGM: () => isGM,
    clear: () => { out.cleared++; },
    emit: (data) => out.sent.push(data),
    sender: 'me',
    userId: isGM ? 'gm' : 'p1',
    isGMUser: (id) => gmIds.includes(id),
  };
  return { out, deps };
}

test('a GM clears their own screen and tells everyone by default', () => {
  const { out, deps } = host({ isGM: true });
  assert.deepEqual(clearGroundMarks({}, deps), { here: true, everyone: true });
  assert.equal(out.cleared, 1);
  assert.deepEqual(out.sent, [{ type: CLEAR_MARKS_MESSAGE, sender: 'me', userId: 'gm' }]);
});

test('a GM can clear only their own screen', () => {
  const { out, deps } = host({ isGM: true });
  assert.deepEqual(clearGroundMarks({ everyone: false }, deps), { here: true, everyone: false });
  assert.equal(out.cleared, 1);
  assert.deepEqual(out.sent, []);
});

test('a player clears only their own screen, even when asking for everyone', () => {
  const { out, deps } = host();
  assert.deepEqual(clearGroundMarks({}, deps), { here: true, everyone: false });
  assert.deepEqual(clearGroundMarks({ everyone: true }, deps), { here: true, everyone: false });
  assert.equal(out.cleared, 2);
  assert.deepEqual(out.sent, []);
});

test('no options at all works', () => {
  const { out, deps } = host({ isGM: true });
  clearGroundMarks(undefined, deps);
  assert.equal(out.cleared, 1);
  assert.equal(out.sent.length, 1);
});

test('a failing socket still clears this screen', () => {
  const { out, deps } = host({ isGM: true });
  deps.emit = () => { throw Error('socket down'); };
  assert.deepEqual(clearGroundMarks({}, deps), { here: true, everyone: false });
  assert.equal(out.cleared, 1);
});

test('a clear from a GM wipes this screen', () => {
  const { out, deps } = host();
  assert.equal(receiveClearMarks({ type: CLEAR_MARKS_MESSAGE, userId: 'gm' }, 'gm', deps), true);
  assert.equal(out.cleared, 1);
});

test('the relayed sender id wins over the one in the message', () => {
  const { out, deps } = host();
  assert.equal(receiveClearMarks({ type: CLEAR_MARKS_MESSAGE, userId: 'gm' }, 'p2', deps), false);
  assert.equal(out.cleared, 0);
});

test('a clear from a player or another message is ignored', () => {
  const { out, deps } = host();
  assert.equal(receiveClearMarks({ type: CLEAR_MARKS_MESSAGE, userId: 'p2' }, undefined, deps), false);
  assert.equal(receiveClearMarks({ type: 'activity-stop', userId: 'gm' }, 'gm', deps), false);
  assert.equal(receiveClearMarks(null, 'gm', deps), false);
  assert.equal(out.cleared, 0);
});
