import test from 'node:test';
import assert from 'node:assert/strict';
import { guardSequencerMotions } from '../../scripts/integrations/sequencer-motions.mjs';

// Sequencer's motion manager: every motion, local or from another client, starts in _startMotion.
const manager = () => {
  const started = [];
  return { started, _startMotion(data) { started.push(data); return { duration: 400, finished: Promise.resolve('ran') }; } };
};

test('a passing motion on a token Animater is moving never starts', async () => {
  const m = manager();
  guardSequencerMotions(m, { claims: (data) => data.uuid === 'Scene.s.Token.busy' });
  const result = m._startMotion({ uuid: 'Scene.s.Token.busy' });
  assert.equal(m.started.length, 0);
  assert.equal(result.duration, 0, 'the sequence waits for nothing');
  await result.finished;
});

test('other tokens, and motions meant to last, start as usual', () => {
  const m = manager();
  guardSequencerMotions(m, { claims: () => true });
  const free = guardSequencerMotions(manager(), { claims: () => false });
  m._startMotion({ uuid: 'a', persist: true });
  m._startMotion({ uuid: 'a', persistUntilUpdate: true });
  assert.equal(m.started.length, 2, 'a lasting motion skipped now would be gone until reload');
  assert.ok(free);
});

test('a free token gets the original result, and a broken check never blocks a motion', () => {
  const m = manager();
  guardSequencerMotions(m, { claims: () => { throw Error('canvas gone'); } });
  assert.equal(m._startMotion({ uuid: 'a' }).duration, 400);
  assert.equal(m.started.length, 1);
});

test('guarding twice wraps once, and unguarding restores Sequencer', () => {
  const m = manager(), original = m._startMotion;
  const off = guardSequencerMotions(m, { claims: () => true });
  guardSequencerMotions(m, { claims: () => true });
  off();
  assert.equal(m._startMotion, original);
  assert.equal(guardSequencerMotions(null, { claims: () => true })(), undefined, 'no Sequencer, nothing to guard');
});
