import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSmartModel, webgpuFp16 } from '../../scripts/ui/smart-model.mjs';

// A player on an RX 9070 XT in Chrome: navigator.gpu was there, but Chrome gave "No available adapters" and the model failed
// with "The device (webgpu) does not support fp16." Now WebGPU is used only when an adapter with shader-f16 answers, and a
// WebGPU load that still fails is tried again on the CPU.
const fakeLib = (fail = () => false) => {
  const calls = [];
  return {
    calls,
    env: {},
    RawImage: class {},
    Sam2Model: { from_pretrained: async (repo, opts) => { calls.push(opts.device); if (fail(opts.device)) throw new Error('The device (webgpu) does not support fp16.'); return {}; } },
    AutoProcessor: { from_pretrained: async () => ({}) },
  };
};

test('webgpuFp16 needs an adapter that has shader-f16', async () => {
  assert.equal(await webgpuFp16({ gpu: undefined }), false);
  assert.equal(await webgpuFp16({ gpu: { requestAdapter: async () => null } }), false, 'No available adapters');
  assert.equal(await webgpuFp16({ gpu: { requestAdapter: async () => ({ features: new Set() }) } }), false);
  assert.equal(await webgpuFp16({ gpu: { requestAdapter: async () => { throw new Error('x'); } } }), false);
  assert.equal(await webgpuFp16({ gpu: { requestAdapter: async () => ({ features: new Set(['shader-f16']) }) } }), true);
});

test('no fp16 WebGPU loads on the CPU', async () => {
  const t = fakeLib();
  const seg = await loadSmartModel({ importer: async () => t, gpu: async () => false, reset: true });
  assert.equal(seg.device, 'wasm');
  assert.deepEqual(t.calls, ['wasm']);
});

test('a WebGPU load that fails is tried again on the CPU', async () => {
  const t = fakeLib((device) => typeof device === 'object');
  const seg = await loadSmartModel({ importer: async () => t, gpu: async () => true, reset: true });
  assert.equal(seg.device, 'wasm');
  assert.equal(t.calls.length, 2);
  assert.equal(t.calls[1], 'wasm');
});

test('fp16 WebGPU keeps the split encoder', async () => {
  const t = fakeLib();
  const seg = await loadSmartModel({ importer: async () => t, gpu: true, reset: true });
  assert.equal(seg.device, 'webgpu');
  assert.deepEqual(t.calls, [{ vision_encoder: 'webgpu', prompt_encoder_mask_decoder: 'wasm' }]);
});
