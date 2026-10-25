import test from 'node:test';
import assert from 'node:assert/strict';
import { awarenessOf, expectedFor, verdict } from '../../tools/live/hidden-footsteps.mjs';

test('awarenessOf: Visioner state first, else the creature\'s conditions, else seen', () => {
  assert.equal(awarenessOf({ state: 'observed' }), 'seen');
  assert.equal(awarenessOf({ state: 'concealed' }), 'seen');
  assert.equal(awarenessOf({ state: 'hidden' }), 'heard');
  assert.equal(awarenessOf({ state: 'undetected' }), 'unknown');
  assert.equal(awarenessOf({ state: 'unnoticed' }), 'unknown');
  assert.equal(awarenessOf({ conditions: ['undetected'] }), 'unknown');
  assert.equal(awarenessOf({ conditions: ['hidden'] }), 'heard');
  assert.equal(awarenessOf({ conditions: ['invisible'] }), 'heard');
  assert.equal(awarenessOf({}), 'seen');
});

test('expectedFor: tracks follow sight; steps follow hearing and earshot (unsure right at the edge)', () => {
  assert.deepEqual(expectedFor('seen', 2, 6), { shown: true, heard: true });
  assert.deepEqual(expectedFor('heard', 2, 6), { shown: false, heard: true });
  assert.deepEqual(expectedFor('heard', 12, 6), { shown: false, heard: false });
  assert.deepEqual(expectedFor('heard', 6, 6), { shown: false, heard: null }, 'at the edge either is fine');
  assert.deepEqual(expectedFor('unknown', 2, 6), { shown: false, heard: false });
  assert.deepEqual(expectedFor('seen', 12, 6), { shown: true, heard: false });
});

test('verdict: passes when what happened matches, unsure expectations always pass', () => {
  assert.equal(verdict({ shown: true, heard: true }, { shown: 4, played: 2 }), 'PASS');
  assert.equal(verdict({ shown: false, heard: true }, { shown: 0, played: 3 }), 'PASS');
  assert.equal(verdict({ shown: false, heard: true }, { shown: 0, played: 0 }), 'FAIL: no step heard');
  assert.equal(verdict({ shown: false, heard: false }, { shown: 2, played: 0 }), 'FAIL: tracks shown');
  assert.equal(verdict({ shown: false, heard: null }, { shown: 0, played: 0 }), 'PASS');
});
