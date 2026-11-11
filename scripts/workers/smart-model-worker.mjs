// The smart model (SAM 2.1, ui/smart-model.mjs) in a background worker, so loading it, reading a map and answering points never
// hold up Foundry's page. Messages: { type: "load" } (progress posted as it downloads), { type: "read", rgba (ArrayBuffer),
// width, height } (returns a view number), { type: "masks", view, points }, { type: "drop", view }. Every answer carries the
// message's id, with ok, and error when it failed.

import { loadSmartModel } from '../ui/smart-model.mjs';

let seg = null, next = 1;
const views = new Map();
self.onmessage = async ({ data }) => {
  const { id, type } = data ?? {};
  try {
    if (type === 'load') {
      seg ??= await loadSmartModel({ onProgress: (loaded, total) => self.postMessage({ type: 'progress', loaded, total }) });
      self.postMessage({ id, ok: true, device: seg.device });
    } else if (type === 'read') {
      const view = await seg.read(new Uint8ClampedArray(data.rgba), data.width, data.height), key = next++;
      views.set(key, view);
      self.postMessage({ id, ok: true, view: key });
    } else if (type === 'masks') {
      const view = views.get(data.view); if (!view) throw new Error('That map is no longer read.');
      const r = await seg.masks(view, data.points);
      const masks = r.masks.map((m) => (m instanceof Uint8Array ? m : Uint8Array.from(m)));
      self.postMessage({ id, ok: true, masks, scores: r.scores }, masks.map((m) => m.buffer));
    } else if (type === 'drop') {
      views.delete(data.view);
      self.postMessage({ id, ok: true });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
