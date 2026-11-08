import test from 'node:test';
import assert from 'node:assert/strict';
import { gpuName, drawsOnMetal, separateBatchBuffers } from '../../scripts/core/apple-gpu.mjs';

const glFor = (name, { debugInfo = true } = {}) => ({
  RENDERER: 0x1f01,
  getExtension: (n) => (debugInfo && n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null),
  getParameter: (p) => (p === 0x9246 ? name : 'WebKit WebGL'),
});

test('the GPU is read from WebGL, its unmasked name where the browser gives it', () => {
  assert.equal(gpuName(glFor('ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max, Unspecified Version)')), 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max, Unspecified Version)');
  assert.equal(gpuName(glFor('x', { debugInfo: false })), 'WebKit WebGL');
  assert.equal(gpuName(null), '');
  assert.equal(gpuName({ getParameter() { throw new Error('lost'); } }), '');
});

test('Metal is recognised on Apple Silicon and Intel Macs, never on PCs', () => {
  for (const mac of ['ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max, Unspecified Version)', 'Apple GPU', 'ANGLE (AMD, ANGLE Metal Renderer: AMD Radeon Pro 5500M, Unspecified Version)', 'ANGLE (Intel, ANGLE Metal Renderer: Intel(R) UHD Graphics 630, Unspecified Version)'])
    assert.equal(drawsOnMetal(mac), true, mac);
  for (const pc of ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)', '', null])
    assert.equal(drawsOnMetal(pc), false, String(pc));
});

test('on Metal each batch gets its own buffer; elsewhere PIXI is left as it is', () => {
  const mac = { BatchRenderer: { canUploadSameBuffer: true } };
  assert.equal(separateBatchBuffers(mac, glFor('ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max, Unspecified Version)')), true);
  assert.equal(mac.BatchRenderer.canUploadSameBuffer, false);
  assert.equal(separateBatchBuffers(mac, glFor('Apple GPU')), false, 'already done: nothing to change');
  const pc = { BatchRenderer: { canUploadSameBuffer: true } };
  assert.equal(separateBatchBuffers(pc, glFor('ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)')), false);
  assert.equal(pc.BatchRenderer.canUploadSameBuffer, true);
  assert.equal(separateBatchBuffers({}, glFor('Apple GPU')), false, 'a PIXI without the switch');
  assert.equal(separateBatchBuffers(null, null), false);
});
