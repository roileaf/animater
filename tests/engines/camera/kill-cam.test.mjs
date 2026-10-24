import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KILL_CAM, killCamLength, canKillCam, killCamPlan, killCamEffects, slowEffects, createKillCam } from '../../../scripts/engines/camera/kill-cam.mjs';

test('length: the whole kill-cam when the table uses it on an NPC, else nothing to wait for', () => {
  assert.equal(killCamLength({ worldOn: true, npc: true }), KILL_CAM.ms);
  assert.equal(killCamLength({ worldOn: false, npc: true }), 0);
  assert.equal(killCamLength({ worldOn: true, npc: false }), 0);
  assert.equal(killCamLength(), 0);
});

test('plays only with both settings on, Full or Light, the target on this scene and seen', () => {
  const ok = { worldOn: true, localOn: true, quality: 'full', sameScene: true, visible: true, hidden: false };
  assert.equal(canKillCam(ok), true);
  assert.equal(canKillCam({ ...ok, quality: 'light' }), true);
  assert.equal(canKillCam({ ...ok, quality: 'balanced' }), false);
  assert.equal(canKillCam({ ...ok, quality: 'off' }), false);
  assert.equal(canKillCam({ ...ok, worldOn: false }), false);
  assert.equal(canKillCam({ ...ok, localOn: false }), false);
  assert.equal(canKillCam({ ...ok, sameScene: false }), false);
  assert.equal(canKillCam({ ...ok, visible: false }), false);
  assert.equal(canKillCam({ ...ok, hidden: true }), false);
});

test('plan: pans to the token with a ×1.2 zoom capped by max zoom, then back to the old view', () => {
  const plan = killCamPlan({ tokenCenter: { x: 500, y: 300 }, view: { x: 100, y: 50, scale: 1 }, maxZoom: 3 });
  assert.deepEqual(plan.panIn, { x: 500, y: 300, scale: 1.2, duration: 450 });
  assert.deepEqual(plan.panOut, { at: 750, x: 100, y: 50, scale: 1, duration: 450 });
  assert.equal(plan.slow.rate, 0.3);
  assert.equal(plan.slow.restoreAt, 700);
  assert.ok(plan.panOut.at + plan.panOut.duration <= plan.ms);
  assert.equal(killCamPlan({ tokenCenter: { x: 0, y: 0 }, view: { x: 0, y: 0, scale: 2.8 }, maxZoom: 3 }).panIn.scale, 3);
  // Already past the cap: never zooms out.
  assert.equal(killCamPlan({ tokenCenter: { x: 0, y: 0 }, view: { x: 0, y: 0, scale: 4 }, maxZoom: 3 }).panIn.scale, 4);
});

test('plan: a broadcast length stretches every timing; bad input gives no plan', () => {
  const plan = killCamPlan({ tokenCenter: { x: 0, y: 0 }, view: { x: 0, y: 0, scale: 1 }, ms: 600 });
  assert.equal(plan.ms, 600);
  assert.equal(plan.panIn.duration, 225);
  assert.equal(plan.slow.restoreAt, 350);
  assert.equal(killCamPlan({ tokenCenter: { x: NaN, y: 0 }, view: { x: 0, y: 0, scale: 1 } }), null);
  assert.equal(killCamPlan({ tokenCenter: { x: 0, y: 0 }, view: { x: 0, y: 0, scale: 0 } }), null);
});

test('effects: Animater effects tied to the token or playing at it, nobody else\'s', () => {
  const uuid = 'Scene.s.Token.t';
  const fx = (data, position) => ({ data: { moduleName: 'animater', ...data }, position });
  const onIt = fx({ source: uuid }), atIt = fx({ target: { x: 510, y: 300 } }), attached = fx({ attachTo: { uuid } });
  const far = fx({ target: { x: 2000, y: 300 } }), placed = fx({}, { x: 520, y: 290 });
  const theirs = { data: { moduleName: 'jb2a', source: uuid } };
  const picked = killCamEffects([onIt, atIt, attached, far, placed, theirs, null], { uuid, center: { x: 500, y: 300 }, radius: 50 });
  assert.deepEqual(picked, [onIt, atIt, attached, placed]);
});

test('slowing: each effect at ×0.3 of its own rate, restored once to that rate', () => {
  const a = { mediaPlaybackRate: 1 }, b = { mediaPlaybackRate: 2 }, gone = { mediaPlaybackRate: 1, destroyed: false };
  const restore = slowEffects([a, b, gone], 0.3);
  assert.equal(a.mediaPlaybackRate, 0.3);
  assert.ok(Math.abs(b.mediaPlaybackRate - 0.6) < 1e-9);
  gone.destroyed = true;
  a.mediaPlaybackRate = 0.3;
  restore();
  assert.equal(a.mediaPlaybackRate, 1);
  assert.equal(b.mediaPlaybackRate, 2);
  assert.equal(gone.mediaPlaybackRate, 0.3);
  a.mediaPlaybackRate = 5;
  restore();
  assert.equal(a.mediaPlaybackRate, 5);
});

const fakeHost = (over = {}) => {
  const timers = [], log = [];
  const effect = { data: { moduleName: 'animater', source: 'T' }, mediaPlaybackRate: 1 };
  const host = {
    log, timers, effect,
    target: (id) => (id === 't' ? { center: { x: 500, y: 300 }, uuid: 'T', radius: 50 } : null),
    view: () => ({ x: 0, y: 0, scale: 1 }),
    maxZoom: () => 3,
    pan: (p) => log.push(['pan', p.x, p.y, p.scale]),
    dragging: () => false,
    effects: () => [effect],
    vignette: { show: (ms) => log.push(['show', ms]), hide: (ms) => log.push(['hide', ms]) },
    schedule: (fn, ms) => { const h = { fn, ms }; timers.push(h); return h; },
    cancel: (h) => { h.cancelled = true; },
    ...over,
  };
  host.run = (until) => { for (const h of [...timers].sort((x, y) => x.ms - y.ms)) if (h.ms <= until && !h.cancelled && !h.done) { h.done = true; h.fn(); } };
  return host;
};

test('kill-cam: pans in, slows and vignettes, then restores and pans back', () => {
  const host = fakeHost(), cam = createKillCam(host);
  assert.equal(cam.play({ tokenId: 't' }), true);
  assert.deepEqual(host.log, [['pan', 500, 300, 1.2], ['show', 200]]);
  assert.equal(host.effect.mediaPlaybackRate, 0.3);
  assert.equal(cam.play({ tokenId: 't' }), false, 'one at a time');
  host.run(700);
  assert.equal(host.effect.mediaPlaybackRate, 1);
  assert.deepEqual(host.log.at(-1), ['hide', 300]);
  host.run(750);
  assert.deepEqual(host.log.at(-1), ['pan', 0, 0, 1]);
  host.run(KILL_CAM.ms);
  assert.equal(cam.playing, false);
});

test('kill-cam: an unseen token plays nothing; a dragging viewer keeps the camera', () => {
  const host = fakeHost();
  assert.equal(createKillCam(host).play({ tokenId: 'other' }), false);
  assert.deepEqual(host.log, []);
  const dragging = fakeHost({ dragging: () => true });
  assert.equal(createKillCam(dragging).play({ tokenId: 't' }), true);
  dragging.run(KILL_CAM.ms);
  assert.equal(dragging.log.some(([k]) => k === 'pan'), false);
  assert.equal(dragging.effect.mediaPlaybackRate, 1);
});

test('kill-cam: clearing (scene teardown) restores the effects and drops the vignette at once', () => {
  const host = fakeHost(), cam = createKillCam(host);
  cam.play({ tokenId: 't' });
  cam.clear();
  assert.equal(host.effect.mediaPlaybackRate, 1);
  assert.deepEqual(host.log.at(-1), ['hide', 0]);
  assert.ok(host.timers.every((h) => h.cancelled));
  assert.equal(cam.playing, false);
  assert.equal(cam.play({ tokenId: 't' }), true);
});

test('kill-cam: a host error never breaks the canvas', () => {
  const traces = [];
  const host = fakeHost({ effects: () => { throw new Error('no Sequencer'); }, trace: (s, d) => traces.push(d) });
  assert.equal(createKillCam(host).play({ tokenId: 't' }), true);
  host.run(KILL_CAM.ms);
  assert.ok(traces.some((d) => d.includes('no Sequencer')));
});
