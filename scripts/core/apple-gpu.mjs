// Metal GPUs (every Apple Silicon Mac, and Intel Macs, in any browser whose WebGL runs on Metal: Chrome's
// ANGLE over Metal, Safari): PIXI's batch renderer writes every batch of a frame into one and the same
// vertex buffer on desktops (BatchRenderer.canUploadSameBuffer), and turns that off only for iPhones and
// iPads. Metal never renames a buffer a frame is still drawing from, so each overwrite makes the driver stop
// and restart its render pass: a canvas of 41 plain tokens drew at 26 frames a second on an M1 Max in
// Chrome, and a busy Animater scene at 36 to 64, where both draw at the display's full 120 with a buffer of
// their own per batch (PIXI's iOS path). Windows and Linux GPUs rename buffers themselves, so PCs were never
// slowed. This affects the whole canvas, Foundry's own drawing and every module's, not only Animater's.

// The GPU's name as WebGL reports it ("ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max, ...)", "Apple GPU"),
// or '' where the browser keeps it to itself.
export function gpuName(gl) {
  if (!gl?.getParameter) return '';
  try {
    const info = gl.getExtension?.('WEBGL_debug_renderer_info');
    return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  } catch { return ''; }
}
// Whether WebGL draws through Metal here: an Apple GPU, or ANGLE's Metal renderer (Intel Macs' AMD and Intel GPUs too).
export const drawsOnMetal = (name) => /\bapple\b|metal/i.test(String(name ?? ''));
// Gives each batch of a frame its own vertex buffer on Metal. Returns whether it changed anything. Safe to call again.
export function separateBatchBuffers(PIXI, gl) {
  const Batch = PIXI?.BatchRenderer;
  if (!Batch || !('canUploadSameBuffer' in Batch) || !drawsOnMetal(gpuName(gl))) return false;
  if (Batch.canUploadSameBuffer === false) return false;
  Batch.canUploadSameBuffer = false;
  return true;
}
