import test from 'node:test';
import assert from 'node:assert/strict';
import { sustainLinks, threadPoint, threadMotes, concentrationLinks } from '../../../scripts/engines/motion/sustain-threads.mjs';

test('a thread runs from the caster to each creature carrying a spell it sustains', () => {
  const tokens = [
    { id: 'wiz', actorId: 'A', effects: [{ id: 'self', sustained: true, originActorId: 'A' }] },
    { id: 'ally', actorId: 'B', effects: [{ id: 'ward', sustained: true, originActorId: 'A' }, { id: 'bless', sustained: false, originActorId: 'A' }] },
    { id: 'foe', actorId: 'C', effects: [{ id: 'hex', sustained: true, originActorId: 'A' }, { id: 'gone', sustained: true, originActorId: 'Z' }] },
    { id: 'spy', actorId: 'D', effects: [{ id: 'secret', sustained: true, originActorId: 'A', hidden: true }] },
  ];
  assert.deepEqual(sustainLinks(tokens).map((l) => l.key), ['wiz>ally:ward', 'wiz>foe:hex'],
    'not to itself, not unsustained, not from a caster off the scene, not a secret one');
});

test('the thread sags between its ends and wavers; motes flow from caster to target', () => {
  const a = { x: 0, y: 0 }, b = { x: 400, y: 0 };
  assert.deepEqual(threadPoint(a, b, 0, 1), a);
  const end = threadPoint(a, b, 1, 1);
  assert.ok(Math.abs(end.x - 400) < 1e-9 && Math.abs(end.y) < 1e-6);
  assert.ok(Math.abs(threadPoint(a, b, 0.5, 0).y) > 20, 'it sags in the middle');
  const m0 = threadMotes('k', 1), m1 = threadMotes('k', 1.2);
  assert.ok(m0.every((m) => m.u >= 0 && m.u < 1 && m.alpha >= 0));
  assert.ok(m1[0].u > m0[0].u || m1[0].u < 0.1, 'moving toward the target');
});

test('D&D concentration: a thread to each creature holding the caster\u2019s effect, and to what it summoned', () => {
  const target = { id: 'orc', actor: { uuid: 'Actor.orc', effects: [] }, document: { uuid: 'Scene.s.Token.orc' } };
  const summon = { id: 'wolf', actor: { uuid: 'Actor.wolf', effects: [] }, document: { uuid: 'Scene.s.Token.wolf' } };
  const concentrating = { statuses: new Set(['concentrating']), getDependents: () => [
    { documentName: 'ActiveEffect', id: 'hold', parent: { uuid: 'Actor.orc' } },
    { documentName: 'Token', id: 'wolf', uuid: 'Scene.s.Token.wolf' },
    { documentName: 'ActiveEffect', id: 'self', parent: { uuid: 'Actor.wiz' } },
    { documentName: 'MeasuredTemplate', id: 'wall', uuid: 'Scene.s.MeasuredTemplate.wall' },
  ] };
  const caster = { id: 'wiz', actor: { uuid: 'Actor.wiz', effects: [concentrating, { statuses: new Set(['blessed']) }] }, document: { uuid: 'Scene.s.Token.wiz' } };
  assert.deepEqual(concentrationLinks([caster, target, summon]).map((l) => l.key), ['wiz>orc:hold', 'wiz>wolf:wolf']);
  assert.deepEqual(concentrationLinks([caster]), [], 'targets off the scene draw nothing');
});
