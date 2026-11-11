import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { smartModelWorker } from '../../scripts/ui/smart-model.mjs';

// Roi: "the whole server froze!" The model ran on Foundry's page; now it runs in a background worker and the page only waits
// for its answers.
class FakeWorker {
  constructor(url, options) { this.url = String(url); this.options = options; this.sent = []; FakeWorker.last = this; }
  postMessage(msg, transfer = []) {
    this.sent.push({ msg, transfer });
    const reply = (data, delay = 0) => setTimeout(() => this.onmessage?.({ data: { id: msg.id, ...data } }), delay);
    if (msg.type === 'load') { setTimeout(() => this.onmessage?.({ data: { type: 'progress', loaded: 50, total: 100 } }), 0); reply({ ok: true, device: 'webgpu' }, 1); }
    else if (msg.type === 'read') reply({ ok: true, view: 7 });
    else if (msg.type === 'masks') reply(msg.points[0].x < 0 ? { ok: false, error: 'off the map' } : { ok: true, masks: [new Uint8Array(4), new Uint8Array(4).fill(1), new Uint8Array(4)], scores: [0.9, 0.8, 0.7] });
  }
  terminate() { this.ended = true; }
}

test('the model in a worker: loads with progress, reads a map once, answers points, and passes its errors back', async () => {
  const progress = [];
  const seg = await smartModelWorker({ Worker: FakeWorker, onProgress: (l, t) => progress.push([l, t]) }).ready;
  const w = FakeWorker.last;
  assert.equal(w.options.type, 'module');
  assert.match(w.url, /workers\/smart-model-worker\.mjs$/);
  assert.deepEqual(progress, [[50, 100]]);
  assert.equal(seg.device, 'webgpu');
  const rgba = new Uint8ClampedArray([1, 2, 3, 255]);
  const view = await seg.read(rgba, 1, 1);
  assert.equal(view, 7);
  const read = w.sent.find((s) => s.msg.type === 'read');
  assert.equal(read.transfer.length, 1, 'the map goes over as a transferred copy');
  assert.equal(rgba[0], 1, 'the page keeps its own map');
  const r = await seg.masks(view, [{ x: 0, y: 0, label: 1 }]);
  assert.equal(r.masks.length, 3); assert.deepEqual(r.scores, [0.9, 0.8, 0.7]);
  await assert.rejects(seg.masks(view, [{ x: -1, y: 0, label: 1 }]), /off the map/);
  seg.close(); assert.equal(w.ended, true);
});

// Roi: also move Floor regions' Smart selection onto it. One worker for the page: Floor regions and Map painting share it.
test('one shared worker for the page: the same model for every caller, progress to the latest, a failed load tried afresh', async () => {
  const { smartModelShared } = await import('../../scripts/ui/smart-model.mjs');
  let made = 0;
  class Counting extends FakeWorker { constructor(...a) { super(...a); made++; } }
  const seen = [];
  const a = smartModelShared({ Worker: Counting, onProgress: () => seen.push('a') });
  const b = smartModelShared({ Worker: Counting, onProgress: () => seen.push('b') });
  assert.equal(a, b, 'the same loading');
  assert.equal((await a).device, 'webgpu'); assert.equal(made, 1);
  assert.deepEqual(seen, ['b'], 'progress goes to whoever asked last');
  class Failing extends FakeWorker { postMessage(msg) { setTimeout(() => this.onmessage?.({ data: { id: msg.id, ok: false, error: 'no network' } }), 0); } }
  smartModelShared({ reset: true });
  await assert.rejects(smartModelShared({ Worker: Failing }), /no network/);
  assert.equal((await smartModelShared({ Worker: Counting })).device, 'webgpu', 'tried afresh after a failure');
});

test('Floor regions\' Smart selection and Map painting both take the shared worker', () => {
  const ui = readFileSync(new URL('../../scripts/ui/floor-regions-ui.mjs', import.meta.url), 'utf8'), main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(ui, /smart = smartModelShared,/);
  assert.match(main, /const seg = await smartModelShared\(\{ onProgress:/);
});

test('the worker loads the model with the page\'s own loader and sends masks back as transferred buffers', () => {
  const src = readFileSync(new URL('../../scripts/workers/smart-model-worker.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{ loadSmartModel \} from '\.\.\/ui\/smart-model\.mjs';/);
  assert.match(src, /self\.postMessage\(\{ id, ok: true, masks, scores: r\.scores \}, masks\.map\(\(m\) => m\.buffer\)\);/);
});
