import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTIONS, validateRecipe } from '../../../scripts/core/model.mjs';
import { motionPose, motionDirection, combineMotionPoses, poseTransform, TokenMotionPlayer, heldPose, withFragmentSeed, HOLD_LIMIT_MS, HOLD_RELEASE_MS, HIDDEN_ALPHA } from '../../../scripts/engines/motion/motion.mjs';
import * as motionModule from '../../../scripts/engines/motion/motion.mjs';
import { GENERATED_MOTION_DURATION } from '../../../scripts/engines/motion/motion-pacing.mjs';

const NEW = ['press', 'sink', 'flicker', 'throw', 'brace', 'stagger', 'cower', 'slam', 'drift', 'electrocute'];
const stage = motion => ({ kind: 'motion', motion, duration: 1000, distance: 0.35, intensity: 1 });

test('new gestures are registered, paced and settle exactly at rest', () => {
  for (const motion of NEW) {
    assert.ok(MOTIONS[motion], motion);
    assert.ok(GENERATED_MOTION_DURATION[motion] > 0, motion);
    for (const p of [0, 1]) assert.deepEqual(motionPose(stage(motion), p, { x: 1, y: 0 }, 100), { x: 0, y: 0, rotation: 0, scale: 1 }, motion);
    const mid = motionPose(stage(motion), 0.5, { x: 1, y: 0 }, 100);
    const moved = Math.abs(mid.x) + Math.abs(mid.y) + Math.abs(mid.rotation) + Math.abs(1 - mid.scale) + Math.abs(1 - (mid.scaleX ?? 1)) + Math.abs(1 - (mid.scaleY ?? 1)) + Math.abs(1 - (mid.alpha ?? 1));
    assert.ok(moved > 0.01, `${motion} visibly animates`);
  }
});
test('gesture semantics: press squashes down, sink fades, brace and stagger move away from the other token, throw winds up then reaches', () => {
  const press = motionPose(stage('press'), 0.5, { x: 1, y: 0 }, 100);
  assert.ok(press.y > 0 && press.scaleY < 1 && press.scaleX > 1);
  const sink = motionPose(stage('sink'), 0.5, { x: 1, y: 0 }, 100);
  assert.ok(sink.y > 0 && sink.alpha < 1);
  assert.ok(motionPose(stage('brace'), 0.5, { x: 1, y: 0 }, 100).x < 0);
  assert.ok(motionPose(stage('stagger'), 0.5, { x: 1, y: 0 }, 100).x < 0);
  assert.ok(motionPose(stage('throw'), 0.15, { x: 1, y: 0 }, 100).x < 0);
  assert.ok(motionPose(stage('throw'), 0.7, { x: 1, y: 0 }, 100).x > 0);
  assert.ok(motionPose(stage('slam'), 0.5, { x: 1, y: 0 }, 100).y < 0, 'slam rises before falling');
});
test('electrocute: stiff, jittering bursts that weaken, a still gap between them, a slump at the end, alike everywhere', () => {
  const s = { ...stage('electrocute'), duration: 1300 };
  const at = (p) => motionPose(s, p, { x: 1, y: 0 }, 100);
  const jitter = (from, to) => { let most = 0; for (let p = from; p < to; p += 0.005) { const q = at(p); most = Math.max(most, Math.hypot(q.x, q.y)); } return most; };
  const first = jitter(0.06, 0.33), second = jitter(0.45, 0.6), third = jitter(0.72, 0.81);
  assert.ok(first > 2 && first < 8, `a few pixels of twitch, not a wobble across the square (${first})`);
  assert.ok(first > second && second > third && third > 0.5, 'each burst weaker than the last');
  assert.equal(Math.hypot(at(0.39).x, at(0.39).y), 0, 'a still beat between bursts');
  assert.ok(at(0.2).scaleY > 1, 'the body locks stiff while the current runs');
  assert.ok(at(0.92).y > 0 && at(0.92).scaleY < 1, 'then slumps as it lets go');
  const steps = new Set(); for (let p = 0.1; p < 0.3; p += 0.004) steps.add(at(p).x.toFixed(4));
  assert.ok(steps.size >= 7, 'a new twitch every 30 ms (about 9 in this window)');
  assert.deepEqual(at(0.2), at(0.2), 'deterministic: every client draws the same twitch');
});
test('optional channels combine multiplicatively and legacy poses keep their shape', () => {
  assert.deepEqual(combineMotionPoses([{ x: 1, y: 0, rotation: 0, scale: 1 }]), { x: 1, y: 0, rotation: 0, scale: 1 });
  const c = combineMotionPoses([{ x: 0, y: 0, rotation: 0, scale: 1, alpha: 0.5 }, { x: 0, y: 0, rotation: 0, scale: 1, alpha: 0.5, scaleY: 0.8 }]);
  assert.equal(c.alpha, 0.25); assert.equal(c.scaleY, 0.8); assert.equal(c.scaleX, undefined);
  assert.equal(poseTransform({ x: 1, y: 2, rotation: 0, scale: 2, scaleY: 0.5 }), 'translate(1px,2px) rotate(0rad) scale(2,1)');
  assert.equal(poseTransform({ x: 0, y: 0, rotation: 0, scale: 1.2 }), 'translate(0px,0px) rotate(0rad) scale(1.2)');
});
test('canvas player applies squash and opacity and restores the token afterwards', async () => {
  let t = 0, queued;
  const player = new TokenMotionPlayer({ frame: cb => (queued = cb, 1), cancel: () => {}, now: () => t, grid: () => 100 });
  const mesh = { position: { x: 10, y: 20, set(x, y) { this.x = x; this.y = y; } }, rotation: 0, alpha: 1, scale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } } };
  const token = { mesh, visible: true, document: { x: 0, y: 0, rotation: 0, width: 1, height: 1, texture: {} } };
  const done = player.play(token, stage('sink'), { x: 1, y: 0 }, 'owner');
  t = 500; queued(t);
  assert.ok(mesh.alpha < 1 && mesh.scale.y < 1 && mesh.position.y > 20);
  t = 1200; queued(t);
  await done;
  assert.equal(mesh.alpha, 1); assert.equal(mesh.scale.y, 1); assert.equal(mesh.position.y, 20);
});


const hold = (motion, extra = {}) => ({ kind: 'motion', motion, duration: 1000, distance: 3, intensity: 1, motionRange: 'distance', motionHeading: 'away', motionEnd: 'hold', ...extra });

test('a held path motion ends at its offset instead of coming back', () => {
  for (const motion of ['rush', 'leap', 'roll']) {
    const end = motionPose(hold(motion, { motionOffset: { x: 2, y: -1 } }), 1, { x: 1, y: 0 }, 100);
    assert.ok(Math.abs(end.x - 200) < 1e-6, `${motion} x`);
    assert.ok(Math.abs(end.y + 100) < 1e-6, `${motion} y`);
  }
  const returning = motionPose({ ...hold('rush'), motionEnd: undefined }, 1, { x: 1, y: 0 }, 100);
  assert.deepEqual(returning, { x: 0, y: 0, rotation: 0, scale: 1 }, 'without hold it still settles at rest');
});

test('a held motion without an offset ends at its authored distance and heading', () => {
  const end = motionPose(hold('rush'), 1, { x: 1, y: 0 }, 100);
  assert.ok(Math.abs(end.x + 300) < 1e-6, 'away from the other token, 3 squares');
});

test('fade dims the token and, when held, stays invisible at the end', () => {
  assert.equal(MOTIONS.fade, 'Fade out');
  assert.ok(GENERATED_MOTION_DURATION.fade > 0);
  const fade = { kind: 'motion', motion: 'fade', duration: 900, intensity: 1 };
  assert.ok(motionPose(fade, 0.5).alpha > 0 && motionPose(fade, 0.5).alpha < 1);
  assert.deepEqual(motionPose(fade, 1), { x: 0, y: 0, rotation: 0, scale: 1 });
  assert.equal(motionPose({ ...fade, motionEnd: 'hold' }, 1).alpha, 0);
});

test('a held pose stays put, then eases back to rest if nothing moves the token', () => {
  const stage = hold('rush', { motionOffset: { x: 2, y: 0 } });
  assert.ok(Math.abs(heldPose(stage, 0, { x: 1, y: 0 }, 100).x - 200) < 1e-6);
  assert.ok(Math.abs(heldPose(stage, HOLD_LIMIT_MS, { x: 1, y: 0 }, 100).x - 200) < 1e-6);
  const easing = heldPose(stage, HOLD_LIMIT_MS + HOLD_RELEASE_MS / 2, { x: 1, y: 0 }, 100).x;
  assert.ok(easing > 0 && easing < 200);
  assert.equal(heldPose(stage, HOLD_LIMIT_MS + HOLD_RELEASE_MS, { x: 1, y: 0 }, 100), null);
  assert.equal(heldPose({ ...stage, motionEnd: undefined }, 0, { x: 1, y: 0 }, 100), null);
});

test('validation keeps hold and offset only where they mean something', () => {
  const v = (stage) => validateRecipe({ id: 'h', name: 'H', trigger: 'manual', stages: [{ assets: [], ...stage }] }).stages[0];
  assert.equal(v(hold('leap')).motionEnd, 'hold');
  assert.deepEqual(v(hold('leap', { motionOffset: { x: 30, y: -1.5 } })).motionOffset, { x: 20, y: -1.5 });
  assert.equal(v({ kind: 'motion', motion: 'shake', motionEnd: 'hold' }).motionEnd, undefined);
  assert.equal(v({ kind: 'motion', motion: 'fade', motionEnd: 'hold', motionOffset: { x: 1, y: 1 } }).motionOffset, undefined);
});

test('the player keeps a held mesh at its end pose after the motion resolves', async () => {
  let now = 0, queued = null;
  const player = new TokenMotionPlayer({ frame: (cb) => (queued = cb), cancel: () => {}, now: () => now, grid: () => 100 });
  const mesh = { position: { x: 100, y: 100, set(x, y) { this.x = x; this.y = y; } }, rotation: 0, scale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } }, alpha: 1 };
  const token = { mesh, visible: true, document: { x: 50, y: 50, rotation: 0, width: 1, height: 1, texture: {} } };
  const done = player.play(token, hold('rush', { motionOffset: { x: 2, y: 0 }, duration: 100 }), { x: 1, y: 0 }, 'me');
  now = 150; queued(now);
  assert.equal(await done, true, 'callers continue once the travel lands');
  assert.equal(mesh.position.x, 300, 'held at the landing square');
  assert.ok(player.active.has(token), 'still holding until the document moves or the hold times out');
});

test('a held travel rebases onto the moved document and keeps the later collapse playing', async () => {
  let now = 0, queued = null;
  const player = new TokenMotionPlayer({ frame: (cb) => (queued = cb), cancel: () => {}, now: () => now, grid: () => 100 });
  const mesh = { position: { x: 100, y: 100, set(x, y) { this.x = x; this.y = y; } }, rotation: 0, scale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } }, alpha: 1 };
  const token = { mesh, visible: true, document: { x: 50, y: 50, rotation: 0, width: 1, height: 1, texture: {} } };
  void player.play(token, hold('rush', { motionOffset: { x: 2, y: 0 }, duration: 100 }), { x: 1, y: 0 }, 'me');
  const fall = player.play(token, { kind: 'motion', motion: 'collapse', duration: 1000, distance: 0.25, intensity: 0.8, motionRange: 'distance' }, { x: 1, y: 0 }, 'me');
  now = 150; queued(now);
  assert.equal(mesh.position.x, 300, 'the rush landed two squares over');
  token.document.x += 200;
  now = 300; queued(now);
  assert.ok(player.active.has(token), 'the run survives the document write');
  assert.notEqual(mesh.rotation, 0, 'the collapse still tips the token');
  assert.equal(mesh.position.x, 300, 'new base (100 + 200) plus the collapse x (0)');
  now = 1200; queued(now);
  assert.equal(await fall, true);
  assert.ok(!player.active.has(token));
});

test('a moved document without a held track still ends the run in place', () => {
  let now = 0, queued = null;
  const player = new TokenMotionPlayer({ frame: (cb) => (queued = cb), cancel: () => {}, now: () => now, grid: () => 100 });
  const mesh = { position: { x: 100, y: 100, set(x, y) { this.x = x; this.y = y; } }, rotation: 0, scale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } }, alpha: 1 };
  const token = { mesh, visible: true, document: { x: 50, y: 50, rotation: 0, width: 1, height: 1, texture: {} } };
  void player.play(token, { kind: 'motion', motion: 'collapse', duration: 1000, distance: 0.25, intensity: 0.8 }, { x: 1, y: 0 }, 'me');
  now = 100; queued(now);
  token.document.x += 200;
  now = 200; queued(now);
  assert.ok(!player.active.has(token));
});

const pathStage = (extra = {}) => ({ kind: 'motion', motion: 'path', subject: 'targets', duration: 1000, motionEnd: 'hold', intensity: 1,
  keyframes: [{ at: 0 }, { at: 0.5, x: 1, y: 1, rotation: 90, ease: 'linear' }, { at: 1, x: 2, y: 0, scale: 0.5, ease: 'linear' }], ...extra });
const v = (stage) => validateRecipe({ id: 'p', name: 'P', trigger: 'manual', stages: [{ assets: [], ...stage }] }).stages[0];

test('a keyframed path moves the real token through its points, away from the other token', () => {
  assert.equal(MOTIONS.path, 'Keyframed path');
  assert.ok(GENERATED_MOTION_DURATION.path > 0);
  const s = v(pathStage());
  const mid = motionPose(s, 0.5, { x: 1, y: 0 }, 100);
  assert.ok(Math.abs(mid.x - 100) < 1e-6 && Math.abs(mid.y - 100) < 1e-6);
  assert.ok(Math.abs(mid.rotation - Math.PI / 2) < 1e-6);
  const end = motionPose(s, 1, { x: 1, y: 0 }, 100);
  assert.ok(Math.abs(end.x - 200) < 1e-6 && Math.abs(end.scale - 0.5) < 1e-6, 'held at the last keyframe');
  const turned = motionPose(s, 1, { x: 0, y: 1 }, 100);
  assert.ok(Math.abs(turned.y - 200) < 1e-6 && Math.abs(turned.x) < 1e-6, 'the frame turns with the direction');
});

test('a finisher frame aims and shrinks the path, ignoring the motion direction', () => {
  const end = motionPose(v(pathStage({ motionFrame: { cos: 0, sin: -1, k: 0.5 } })), 1, { x: 1, y: 0 }, 100);
  assert.ok(Math.abs(end.x) < 1e-6 && Math.abs(end.y + 100) < 1e-6);
});

test('without hold, a path plays in the first 85% and settles back to rest', () => {
  const s = v(pathStage({ motionEnd: undefined }));
  const last = motionPose(s, 0.85, { x: 1, y: 0 }, 100);
  assert.ok(Math.abs(last.x - 200) < 1e-6, 'reaches the last keyframe at 85%');
  assert.deepEqual(motionPose(s, 1, { x: 1, y: 0 }, 100), { x: 0, y: 0, rotation: 0, scale: 1 });
  const settling = motionPose(s, 0.95, { x: 1, y: 0 }, 100).x;
  assert.ok(settling > 0 && settling < 200);
});

test('opacity is only touched when a keyframe fades', () => {
  assert.equal(motionPose(v(pathStage()), 0.5, { x: 1, y: 0 }, 100).alpha, undefined);
  const faded = v(pathStage({ keyframes: [{ at: 0 }, { at: 1, alpha: 0 }] }));
  assert.equal(motionPose(faded, 1, { x: 1, y: 0 }, 100).alpha, 0);
});

test('validation repairs path keyframes and keeps the finisher frame only on paths', () => {
  assert.equal(v({ kind: 'motion', motion: 'path' }).keyframes.length, 2, 'an old or empty path gets the default shove');
  assert.equal(v({ kind: 'motion', motion: 'path', keyframes: 'garbage' }).keyframes.at(-1).x, 1);
  assert.deepEqual(v(pathStage({ motionFrame: { cos: 2, sin: -1, k: 4 } })).motionFrame, { cos: 1, sin: -1, k: 1 });
  assert.equal(v({ kind: 'motion', motion: 'rush', motionFrame: { cos: 1, sin: 0, k: 1 }, keyframes: [] }).motionFrame, undefined);
  assert.equal(v({ kind: 'motion', motion: 'rush', keyframes: [] }).keyframes, undefined);
  assert.equal(v(pathStage()).motionEnd, 'hold', 'a path may hold where it lands');
});

const straight = (extra = {}) => v({ kind: 'motion', motion: 'path', subject: 'targets', duration: 1000, motionEnd: 'hold', ...extra });
test('a path eases its whole motion with pathEase, not keyframe by keyframe', () => {
  const two = straight({ keyframes: [{ at: 0 }, { at: 1, x: 4 }], pathEase: 'easeInQuad' });
  assert.ok(Math.abs(motionPose(two, 0.5, { x: 1, y: 0 }, 100).x - 100) < 1e-6, 'ease-in: a quarter of the way at half time');
  assert.ok(Math.abs(motionPose(straight({ keyframes: [{ at: 0 }, { at: 1, x: 4 }] }), 0.5, { x: 1, y: 0 }, 100).x - 200) < 1e-6, 'linear by default');
  // Linear keyframes and one whole-path ease: no stop at the middle keyframe.
  const three = straight({ keyframes: [{ at: 0 }, { at: 0.5, x: 2 }, { at: 1, x: 4 }], pathEase: 'easeOutCubic' });
  const mid = 1 - Math.cbrt(0.5), w = 0.005;
  assert.ok(Math.abs(motionPose(three, mid, { x: 1, y: 0 }, 100).x - 200) < 1e-6, 'on the middle keyframe');
  const speed = (motionPose(three, mid + w, { x: 1, y: 0 }, 100).x - motionPose(three, mid - w, { x: 1, y: 0 }, 100).x) / (2 * w);
  assert.ok(speed > 100, `still moving through the middle keyframe: ${speed} px per stage`);
});

test('an overshooting pathEase never carries the path past its end', () => {
  const s = straight({ keyframes: [{ at: 0 }, { at: 1, x: 2 }], pathEase: 'easeOutBack' });
  for (let n = 0; n <= 100; n++) assert.ok(motionPose(s, n / 100, { x: 1, y: 0 }, 100).x <= 200 + 1e-9, `at ${n}%`);
  assert.ok(Math.abs(motionPose(s, 1, { x: 1, y: 0 }, 100).x - 200) < 1e-9);
});

test('a returning path eases its first 85% with pathEase and still settles back', () => {
  const s = straight({ motionEnd: undefined, keyframes: [{ at: 0 }, { at: 1, x: 4 }], pathEase: 'easeInQuad' });
  assert.ok(Math.abs(motionPose(s, 0.425, { x: 1, y: 0 }, 100).x - 100) < 1e-6, 'a quarter of the way at half of 85%');
  assert.ok(Math.abs(motionPose(s, 0.85, { x: 1, y: 0 }, 100).x - 400) < 1e-6);
  assert.deepEqual(motionPose(s, 1, { x: 1, y: 0 }, 100), { x: 0, y: 0, rotation: 0, scale: 1 });
});

test('pathEase is kept only on path stages and repaired to linear', () => {
  assert.equal(v(pathStage({ pathEase: 'easeOutCubic' })).pathEase, 'easeOutCubic');
  assert.equal(v(pathStage()).pathEase, 'linear', 'missing');
  assert.equal(v(pathStage({ pathEase: 'bogus' })).pathEase, 'linear', 'invalid');
  assert.equal(v({ kind: 'motion', motion: 'rush', pathEase: 'easeOutCubic' }).pathEase, undefined);
  assert.equal(v({ kind: 'motion', motion: 'lunge', pathEase: 'easeInQuad' }).pathEase, undefined);
});

test('a path faces away from the other token, like a recoil', () => {
  const token = { center: { x: 100, y: 0 } }, other = { center: { x: 0, y: 0 } };
  const dir = motionDirection(token, other, token, 'path', 100);
  assert.ok(Math.abs(dir.x - 1) < 1e-6 && Math.abs(dir.y) < 1e-6);
});

test('a path or recoil with no other token faces +x wherever the token stands', () => {
  const token = { id: 't', center: { x: 1250, y: 450 } };
  for (const motion of ['path', 'recoil']) {
    assert.deepEqual(motionDirection(token, token, null, motion, 100), { x: 1, y: 0 }, `${motion}: token is its own source, no target`);
    assert.deepEqual(motionDirection(token, null, token, motion, 100), { x: 1, y: 0 }, `${motion}: no source`);
    assert.deepEqual(motionDirection(token, token, token, motion, 100), { x: 1, y: 0 }, `${motion}: self-only`);
  }
});

test('an overshooting ease never turns a path inside out or past fully visible', () => {
  const kf = (at, extra = {}) => ({ at, x: 0, y: 0, rotation: 0, scale: 1, alpha: 1, ease: 'linear', sharp: false, ...extra });
  const shrink = { kind: 'motion', motion: 'path', motionEnd: 'hold', keyframes: [kf(0), kf(1, { scale: 0.05, ease: 'easeOutBack' })] };
  const fade = { kind: 'motion', motion: 'path', motionEnd: 'hold', keyframes: [kf(0), kf(0.5, { alpha: 0.9 }), kf(1, { alpha: 0, ease: 'easeOutBack' })] };
  for (let n = 0; n <= 100; n++) {
    assert.ok(motionPose(shrink, n / 100).scale >= 0.01, `scale at ${n}%`);
    const alpha = motionPose(fade, n / 100).alpha ?? 1;
    assert.ok(alpha >= 0 && alpha <= 1, `alpha at ${n}%`);
  }
});

const stretchy = (extra = {}) => v(pathStage({ keyframes: [{ at: 0 }, { at: 0.5, x: 1, stretch: 0.2, ease: 'linear' }, { at: 1, x: 2, ease: 'linear' }], ...extra }));
test('a stretched path stretches the token along its travel direction', () => {
  const along = motionPose(stretchy(), 0.5, { x: 1, y: 0 }, 100);
  assert.ok(along.scaleX > 1 && 1 > along.scaleY, `x ${along.scaleX} y ${along.scaleY}`);
  assert.equal(along.scale, 1, 'uniform size stays its own channel');
  const down = motionPose(stretchy(), 0.5, { x: 0, y: 1 }, 100);
  assert.ok(Math.abs(down.scaleX - along.scaleY) < 1e-9 && Math.abs(down.scaleY - along.scaleX) < 1e-9, 'turned with the direction');
  assert.equal(motionPose(v(pathStage()), 0.5, { x: 1, y: 0 }, 100).scaleX, undefined, 'an unstretched path never touches scaleX/scaleY');
});

test('a frame-aimed stretched path uses the frame angle, not the direction', () => {
  const aimed = motionPose(stretchy({ motionFrame: { cos: 0, sin: 1, k: 1 } }), 0.5, { x: 1, y: 0 }, 100);
  assert.ok(aimed.scaleY > 1 && 1 > aimed.scaleX, `x ${aimed.scaleX} y ${aimed.scaleY}`);
});

test('the stretch is measured against the pose rotation', () => {
  const turned = v(pathStage({ keyframes: [{ at: 0 }, { at: 0.5, x: 1, rotation: 90, stretch: 0.2, ease: 'linear' }, { at: 1, x: 2, rotation: 90, ease: 'linear' }] }));
  const p = motionPose(turned, 0.5, { x: 1, y: 0 }, 100);
  assert.ok(p.scaleY > 1 && 1 > p.scaleX, 'a token turned 90 degrees stretches along its own y');
});

test('a returning stretched path settles its stretch back to rest with the other channels', () => {
  const s = stretchy({ motionEnd: undefined, keyframes: [{ at: 0 }, { at: 1, x: 2, stretch: 0.3, ease: 'linear' }] });
  const reached = motionPose(s, 0.85, { x: 1, y: 0 }, 100), settling = motionPose(s, 0.95, { x: 1, y: 0 }, 100);
  assert.ok(settling.scaleX > 1 && settling.scaleX < reached.scaleX, `${settling.scaleX} between 1 and ${reached.scaleX}`);
});

test('squash on impact flattens along the direction, springs back and rests at both ends', () => {
  assert.equal(MOTIONS.squash, 'Squash on impact');
  assert.equal(GENERATED_MOTION_DURATION.squash, 450);
  const s = v({ kind: 'motion', motion: 'squash', duration: 450, intensity: 1 });
  assert.equal(s.motion, 'squash');
  assert.equal(s.motionEnd, undefined, 'never holds');
  for (const p of [0, 1]) assert.deepEqual(motionPose(s, p, { x: 1, y: 0 }, 100), { x: 0, y: 0, rotation: 0, scale: 1 });
  const flat = motionPose(s, 0.225, { x: 1, y: 0 }, 100);
  assert.ok(flat.scaleX < 1 && flat.scaleY > 1, `flattened along x: ${flat.scaleX} ${flat.scaleY}`);
  assert.ok(Math.abs(flat.scaleX - 0.65) < 1e-9, 'full squash of 0.35 at its peak');
  assert.deepEqual([flat.x, flat.y, flat.rotation], [0, 0, 0], 'no position change');
  const across = motionPose(s, 0.225, { x: 0, y: 1 }, 100);
  assert.ok(across.scaleY < 1 && across.scaleX > 1, 'flattened along y for a downward hit');
  const spring = motionPose(s, 0.6, { x: 1, y: 0 }, 100);
  assert.ok(spring.scaleX > 1, 'springs back past rest');
  const end = motionPose(s, 0.999, { x: 1, y: 0 }, 100);
  assert.ok(Math.abs(end.scaleX - 1) < 1e-3, 'settled by the end');
});

test('squash faces away from the other token like a recoil, with a +x fallback', () => {
  const token = { id: 't', center: { x: 0, y: 100 } }, other = { center: { x: 0, y: 0 } };
  const dir = motionDirection(token, other, token, 'squash', 100);
  assert.ok(Math.abs(dir.x) < 1e-6 && Math.abs(dir.y - 1) < 1e-6);
  assert.deepEqual(motionDirection(token, token, null, 'squash', 100), { x: 1, y: 0 });
});

test('a held stretched end eases its stretch back with the rest of the hold', () => {
  const s = v(pathStage({ keyframes: [{ at: 0 }, { at: 1, stretch: 0.3, ease: 'linear' }] }));
  const held = heldPose(s, 0, { x: 1, y: 0 }, 100), releasing = heldPose(s, HOLD_LIMIT_MS + HOLD_RELEASE_MS / 2, { x: 1, y: 0 }, 100);
  assert.ok(held.scaleX > 1.29, 'held stretched');
  assert.ok(releasing.scaleX > 1 && releasing.scaleX < held.scaleX && releasing.scaleY < 1 && releasing.scaleY > held.scaleY, 'easing back');
});

const fragStage = (extra = {}) => v({ kind: 'motion', motion: 'fragments', subject: 'targets', duration: 100, pattern: 'halves', seed: 5, ...extra });

test('fragments are a token motion that keeps the real token invisible', () => {
  assert.equal(MOTIONS.fragments, 'Token fragments');
  assert.ok(GENERATED_MOTION_DURATION.fragments > 0);
  const s = fragStage();
  assert.equal(s.pattern, 'halves');
  assert.equal(s.seed, 5);
  assert.equal(motionPose(s, 0.5, { x: 1, y: 0 }, 100).alpha, 0);
  assert.deepEqual(motionPose(s, 1, { x: 1, y: 0 }, 100), { x: 0, y: 0, rotation: 0, scale: 1 });
  assert.equal(motionPose(fragStage({ motionEnd: 'hold' }), 1, { x: 1, y: 0 }, 100).alpha, 0, 'held: stays invisible until hidden');
  assert.equal(v({ kind: 'motion', motion: 'shake', pattern: 'dust' }).pattern, undefined);
});

test('the seed is set once before broadcast and never overwritten', () => {
  const s = { kind: 'motion', motion: 'fragments' };
  const seeded = withFragmentSeed(s, () => 0.5);
  assert.ok(Number.isInteger(seeded.seed));
  assert.equal(withFragmentSeed(seeded, () => 0.9), seeded);
  const other = { kind: 'motion', motion: 'shake' };
  assert.equal(withFragmentSeed(other), other);
});

test('the player drives the fragment renderer and never leaves the token visible or pieces behind', async () => {
  let now = 0, queued = null;
  const log = [];
  const fragments = { start: (_t, stage, angle) => { log.push(['start', stage.pattern, Math.round(angle * 100) / 100]); return { update: (p) => log.push(['update', Math.round(p * 100) / 100]), destroy: () => log.push(['destroy']) }; } };
  const player = new TokenMotionPlayer({ frame: (cb) => (queued = cb), cancel: () => {}, now: () => now, grid: () => 100, fragments });
  const mesh = { position: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }, rotation: 0, scale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } }, alpha: 1 };
  const token = { mesh, visible: true, document: { x: 0, y: 0, rotation: 0, width: 1, height: 1, texture: {} } };
  const done = player.play(token, fragStage({ motionEnd: 'hold' }), { x: 0, y: 1 }, 'me');
  now = 50; queued(now);
  assert.equal(mesh.alpha, HIDDEN_ALPHA, 'invisible while the pieces fly');
  now = 150; queued(now);
  assert.equal(await done, true);
  assert.equal(mesh.alpha, HIDDEN_ALPHA, 'still invisible while held');
  assert.deepEqual(log[0], ['start', 'halves', 1.57], 'cut follows the swing direction');
  assert.ok(log.some((e) => e[0] === 'update'));
  assert.deepEqual(log.at(-1), ['destroy'], 'pieces are gone when the stage ends');

  const log2 = [];
  const p2 = new TokenMotionPlayer({ frame: (cb) => (queued = cb), cancel: () => {}, now: () => now, grid: () => 100, fragments: { start: () => ({ update: () => {}, destroy: () => log2.push('destroy') }) } });
  const t2 = { ...token, mesh: { ...mesh, alpha: 1, position: { ...mesh.position }, scale: { ...mesh.scale } } };
  now = 0; void p2.play(t2, fragStage(), { x: 1, y: 0 }, 'me'); now = 20; queued(now);
  p2.stop();
  assert.deepEqual(log2, ['destroy'], 'Stop destroys pieces');
});

const fragRig = (fragments) => {
  const r = { now: 0, queued: null, warns: [] };
  r.player = new TokenMotionPlayer({ frame: (cb) => (r.queued = cb), cancel: () => {}, now: () => r.now, grid: () => 100, fragments });
  r.mesh = { position: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }, rotation: 0, scale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } }, alpha: 1 };
  r.token = { mesh: r.mesh, visible: true, document: { x: 0, y: 0, rotation: 0, width: 1, height: 1, texture: {} } };
  return r;
};

test('a renderer whose start throws never breaks the run or leaves the token stuck', async () => {
  const warn = console.warn, warns = [];
  console.warn = (...a) => warns.push(a);
  try {
    const r = fragRig({ start: () => { throw new Error('boom'); } });
    const done = r.player.play(r.token, fragStage(), { x: 1, y: 0 }, 'me');
    r.now = 50; r.queued(r.now);
    assert.equal(r.mesh.alpha, HIDDEN_ALPHA, 'stays hidden for the stage as designed');
    r.now = 60; r.queued(r.now);
    r.now = 150; r.queued(r.now);
    assert.equal(await done, true);
    assert.equal(r.mesh.alpha, 1, 'alpha restored at the end');
    assert.equal(r.player.active.size, 0);
    assert.equal(warns.length, 1, 'logged once');
    assert.equal(warns[0][0], 'Animater fragments:');
    assert.equal(warns[0][1], 'boom');
  } finally { console.warn = warn; }
});

test('a renderer whose update throws has its pieces destroyed and the tick survives', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    let destroyed = 0, starts = 0;
    const r = fragRig({ start: () => { starts++; return { update: () => { throw new Error('bad'); }, destroy: () => { destroyed++; } }; } });
    const done = r.player.play(r.token, fragStage(), { x: 1, y: 0 }, 'me');
    r.now = 50;
    assert.doesNotThrow(() => r.queued(r.now));
    assert.equal(destroyed, 1);
    r.now = 60; r.queued(r.now);
    assert.equal(starts, 1, 'does not restart after failing');
    r.now = 150; r.queued(r.now);
    assert.equal(await done, true);
    assert.equal(r.mesh.alpha, 1);
  } finally { console.warn = warn; }
});

test('a throwing destroy does not stop end() from restoring and resolving', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const r = fragRig({ start: () => ({ update: () => {}, destroy: () => { throw new Error('d'); } }) });
    const done = r.player.play(r.token, fragStage(), { x: 1, y: 0 }, 'me');
    r.now = 20; r.queued(r.now);
    assert.doesNotThrow(() => r.player.stop());
    assert.equal(await done, true);
    assert.equal(r.mesh.alpha, 1);
  } finally { console.warn = warn; }
});

test('a tick at progress 0 does not start the pieces', () => {
  let starts = 0;
  const r = fragRig({ start: () => { starts++; return { update: () => {}, destroy: () => {} }; } });
  r.now = 100;
  void r.player.play(r.token, fragStage(), { x: 1, y: 0 }, 'me');
  r.queued(90);
  assert.equal(starts, 0);
  r.now = 100; r.queued(120);
  assert.equal(starts, 1);
});

test('the player gives the renderer the un-posed transform', () => {
  let seen;
  const r = fragRig({ start: (_t, _s, _a, base) => { seen = base; return { update: () => {}, destroy: () => {} }; } });
  void r.player.play(r.token, fragStage(), { x: 1, y: 0 }, 'me');
  r.now = 20; r.queued(r.now);
  assert.equal(typeof seen, 'function', 'a live getter');
  assert.deepEqual(seen(), { x: 0, y: 0, rotation: 0, sx: 1, sy: 1, alpha: 1 });
});

test('the pieces spawn where the token is drawn and stay anchored there', () => {
  let seen;
  const r = fragRig({ start: (_t, _s, _a, base) => { seen = base; return { update: () => {}, destroy: () => {} }; } });
  const lift = v({ kind: 'motion', motion: 'levitate', subject: 'targets', duration: 100 });
  void r.player.play(r.token, lift, { x: 1, y: 0 }, 'me');
  void r.player.play(r.token, fragStage({ duration: 1000 }), { x: 1, y: 0 }, 'me');
  r.now = 50; r.queued(r.now);
  const want = motionPose(lift, 0.5, { x: 1, y: 0 }, 100);
  assert.ok(want.y < 0);
  assert.ok(Math.abs(seen().y - want.y) < 1e-9 && seen().x === 0, 'pose of the other tracks at start time is included');
  r.now = 80; r.queued(r.now);
  assert.ok(Math.abs(seen().y - want.y) < 1e-9 && seen().x === 0, 'the other tracks moving on do not drag the pieces');
});

test('pieces spawned on a held shove stay put when the shove is written to the document', () => {
  let seen;
  const r = fragRig({ start: (_t, _s, _a, base) => { seen = base; return { update: () => {}, destroy: () => {} }; } });
  void r.player.play(r.token, hold('rush', { motionOffset: { x: 2, y: 0 }, duration: 100 }), { x: 1, y: 0 }, 'me');
  void r.player.play(r.token, fragStage({ duration: 1000 }), { x: 1, y: 0 }, 'me');
  r.now = 120; r.queued(r.now);
  assert.ok(Math.abs(seen().x - 200) < 1e-6, 'spawned on the shoved square');
  r.token.document.x += 200;
  r.now = 150; r.queued(r.now);
  assert.equal(r.player.active.get(r.token).original.x, 200, 'rebased');
  assert.ok(Math.abs(seen().x - 200) < 1e-6, 'the shove is not counted twice once it is written');
});

test('pieces spawned mid-travel stay where the token was when the travel lands and is written', () => {
  let seen;
  const r = fragRig({ start: (_t, _s, _a, base) => { seen = base; return { update: () => {}, destroy: () => {} }; } });
  const travel = v({ kind: 'motion', motion: 'path', subject: 'targets', motionEnd: 'hold', duration: 1000, keyframes: [{ at: 0, x: 0, y: 0 }, { at: 1, x: 2, y: 0 }] });
  void r.player.play(r.token, travel, { x: 1, y: 0 }, 'me');
  r.now = 400; r.queued(r.now);
  void r.player.play(r.token, fragStage({ duration: 3000 }), { x: 1, y: 0 }, 'me');
  r.now = 500; r.queued(r.now);
  const spawned = seen().x;
  assert.ok(spawned > 0 && spawned < 200, `spawned mid-flight (${spawned})`);
  r.now = 1000; r.queued(r.now);
  // The finisher writes the landing at travelEnd: the held travel is rebased onto the document.
  r.token.document.x += 200;
  r.now = 1050; r.queued(r.now);
  assert.equal(r.player.active.get(r.token).original.x, 200, 'rebased');
  assert.ok(Math.abs(seen().x - spawned) < 1e-6, `pieces stay where they spawned (${seen().x} vs ${spawned})`);
});

test('pieces spawned on a held travel stay put through a test play with no write, hold release included', () => {
  let seen;
  const r = fragRig({ start: (_t, _s, _a, base) => { seen = base; return { update: () => {}, destroy: () => {} }; } });
  void r.player.play(r.token, hold('rush', { motionOffset: { x: 2, y: 0 }, duration: 100 }), { x: 1, y: 0 }, 'me');
  void r.player.play(r.token, fragStage({ duration: HOLD_LIMIT_MS + HOLD_RELEASE_MS + 500 }), { x: 1, y: 0 }, 'me');
  r.now = 120; r.queued(r.now);
  for (const t of [1000, 100 + HOLD_LIMIT_MS + 200, 100 + HOLD_LIMIT_MS + HOLD_RELEASE_MS + 100]) {
    r.now = t; r.queued(r.now);
    assert.ok(Math.abs(seen().x - 200) < 1e-6, `at ${t}: ${seen().x}`);
  }
});

test('pieces follow the token when it is moved by someone else while a hold keeps the run alive', () => {
  let seen;
  const r = fragRig({ start: (_t, _s, _a, base) => { seen = base; return { update: () => {}, destroy: () => {} }; } });
  void r.player.play(r.token, v({ kind: 'motion', motion: 'fade', subject: 'targets', motionEnd: 'hold', duration: 100 }), { x: 1, y: 0 }, 'me');
  void r.player.play(r.token, fragStage({ duration: 1000 }), { x: 1, y: 0 }, 'me');
  r.now = 120; r.queued(r.now);
  assert.equal(seen().x, 0);
  r.token.document.x += 300;
  r.now = 150; r.queued(r.now);
  assert.equal(seen().x, 300, 'a move the held pose does not account for carries the pieces along');
});

test('the sender stores the cut angle with the seed, and the player prefers it', () => {
  const { withFragmentCut } = motionModule;
  const s = withFragmentCut({ kind: 'motion', motion: 'fragments' }, { x: 0, y: -1 });
  assert.ok(Math.abs(s.cutAngle + Math.PI / 2) < 1e-9);
  assert.equal(withFragmentCut(s, { x: 1, y: 0 }), s, 'never overwritten');
  const other = { kind: 'motion', motion: 'shake' };
  assert.equal(withFragmentCut(other, { x: 1, y: 0 }), other);
  assert.ok(Math.abs(fragStage({ cutAngle: s.cutAngle }).cutAngle - s.cutAngle) < 1e-9, 'validation keeps it');
  let seen;
  const r = fragRig({ start: (_t, _s, angle) => { seen = angle; return { update: () => {}, destroy: () => {} }; } });
  void r.player.play(r.token, fragStage({ cutAngle: 2 }), { x: 1, y: 0 }, 'me');
  r.now = 20; r.queued(r.now);
  assert.equal(seen, 2, 'the broadcast angle wins over this client\'s direction');
});

// Live repro (Twin Takedown, Local preview): fragments at 450 ms zeroed the target's mesh alpha,
// and PF2e Visioner hid every Sequencer effect at a token whose art reads as hidden
// (alpha <= 0), cutting the recipe's opening slashes and splash on that token.
test('a token hidden by its own motion draws nothing yet never reads as hidden art', () => {
  const readsHidden = mesh => mesh.visible === false || mesh.renderable === false || mesh.alpha <= 0;
  const drawsNothing = mesh => mesh.alpha * 255 < 0.5;
  const r = fragRig({ start: () => ({ update: () => {}, destroy: () => {} }) });
  void r.player.play(r.token, fragStage({ motionEnd: 'hold' }), { x: 1, y: 0 }, 'me');
  r.now = 50; r.queued(r.now);
  assert.ok(drawsNothing(r.mesh), 'the pieces replace the token');
  assert.equal(readsHidden(r.mesh), false, 'effects anchored at the token keep drawing');
  const f = fragRig();
  void f.player.play(f.token, { kind: 'motion', motion: 'fade', duration: 100, distance: 0, intensity: 1, motionEnd: 'hold' }, { x: 1, y: 0 }, 'me');
  f.now = 100; f.queued(f.now);
  assert.ok(drawsNothing(f.mesh), 'a full fade is gone');
  assert.equal(readsHidden(f.mesh), false, 'a full fade keeps effects at the token');
});

test('fragments linked to a held travel\'s end burst on the landing, with or without the move written', () => {
  // The runtime starts both from one clock, so the pieces can arrive a few ms before the travel lands.
  const travel = v({ kind: 'motion', motion: 'path', subject: 'targets', motionEnd: 'hold', duration: 1000, pathEase: 'easeOutCubic',
    keyframes: [{ at: 0, x: 0, y: 0 }, { at: 1, x: 6, y: 0 }], motionFrame: { cos: 0, sin: 1, k: 1 } });
  for (const lead of [0, 5]) for (const commit of [false, true]) {
    let seen;
    const r = fragRig({ start: (_t, _s, _a, base) => { seen = base; return { update: () => {}, destroy: () => {} }; } });
    void r.player.play(r.token, travel, { x: 1, y: 0 }, 'me');
    r.now = 500; r.queued(r.now);
    r.now = 1000 - lead;
    void r.player.play(r.token, fragStage({ motionEnd: 'hold', duration: 1600 }), { x: 1, y: 0 }, 'me');
    r.now = 1000 - lead + 16; r.queued(r.now);
    const label = `lead ${lead}, ${commit ? 'written' : 'test play'}`;
    assert.ok(seen, `${label}: pieces drawn`);
    assert.ok(Math.abs(seen().x) < 1e-6 && Math.abs(seen().y - 600) < 1, `${label}: spawned on the landing (${seen().x}, ${seen().y})`);
    if (commit) { r.token.document.y += 600; r.now = 1040; r.queued(r.now); }
    for (const t of [1300, 2500]) { r.now = t; r.queued(r.now); assert.ok(Math.abs(seen().y - 600) < 1, `${label} at ${t}: ${seen().y}`); }
    assert.equal(r.mesh.alpha, HIDDEN_ALPHA, `${label}: the token stays hidden under the pieces`);
  }
});
