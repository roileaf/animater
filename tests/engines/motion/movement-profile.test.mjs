import test from 'node:test';
import assert from 'node:assert/strict';
import { movementSoundMix, resolveMovementSound, movementContactWeight, createMovementPreview } from '../../../scripts/engines/motion/movement-profile.mjs';
import { movementSoundsForm } from '../../../scripts/ui/movement-sounds-config.mjs';

test('token overrides preserve automatic defaults and reject unsupported flag values', () => {
  const automatic = resolveMovementSound({ name: 'Riding Horse' });
  assert.equal(automatic.gait, 'hooves');
  assert.equal(automatic.body, null);
  const chosen = resolveMovementSound({ name: 'Riding Horse' }, { gait: 'paws', body: 'air', flight: 'flight', contact: 0, weight: 0.5, tremor: 2 });
  assert.equal(chosen.gait, 'paws'); assert.equal(chosen.body, 'air'); assert.equal(chosen.flight, 'flight');
  assert.equal(chosen.sound.contact, 0); assert.equal(chosen.sound.weight, 0.5); assert.equal(chosen.sound.tremor, 2);
  assert.equal(resolveMovementSound({ name: 'Air Elemental' }, { body: 'none' }).body, null);
  const v = movementSoundMix({ gait: '<script>', body: 'lava', flight: 'evil', contact: -10, weight: 900, tremor: 'NaN', pitch: '', silent: 'false' });
  assert.deepEqual(v, { gait: '', body: '', flight: '', contact: 0, weight: 2, tremor: 1, pitch: 1, silent: false });
  assert.equal(movementContactWeight('hooves', 3), 2);
  assert.equal(movementContactWeight('paws', 3), 3);
});

test('preview stop cancels remaining steps, queued layers and active sounds; restart isolates sessions', () => {
  let next = 0, stops = 0;
  const timers = new Map(), steps = [], stoppedTremors = [];
  const preview = createMovementPreview({
    setTimer: (fn) => { const id = ++next; timers.set(id, fn); return id; }, clearTimer: (id) => timers.delete(id),
    stopTremor: (id) => stoppedTremors.push(id),
    playStep: (options) => steps.push(options),
  });
  const first = preview.start({ floor: 'wood' });
  first.sounds.add({ stop: () => stops++ });
  const layer = ++next; timers.set(layer, () => assert.fail('cancelled layer played')); first.timers.add(layer);
  assert.equal(steps.length, 1); assert.equal(timers.size, 4);
  const second = preview.start({ floor: 'snow' });
  assert.equal(first.active, false); assert.equal(stops, 1); assert.notEqual(first.id, second.id);
  assert.equal(timers.size, 3); assert.equal(steps.at(-1).floor, 'snow');
  preview.stop(); assert.equal(timers.size, 0); assert.equal(second.active, false);
  assert.deepEqual(stoppedTremors, [first.id, second.id]);
  preview.stop(); assert.equal(stoppedTremors.length, 2);
});

test('movement form saves through native token flags and keeps preview inputs out of submission', () => {
  const form = movementSoundsForm({ contact: 0, gait: 'hooves', body: 'none' });
  assert.match(form, /name="flags.animater.movementSound.contact"[^>]*value="0"/);
  assert.match(form, /value="hooves" selected/);
  assert.match(form, /data-movement-preview/);
  assert.ok(!/name="[^\"]*(?:preview|floor|action)/.test(form));
  assert.ok(!form.includes('<script>'));
});
