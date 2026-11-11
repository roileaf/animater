// The segmentation model behind smart selection: SAM 2.1 large, run in the GM's browser with transformers.js.
// Nothing loads until the GM chooses Smart selection and agrees to the download; then the library comes from
// cdn.jsdelivr.net and the model from huggingface.co, and the browser keeps both cached. The map never leaves
// the machine.
//
// The model's image encoder runs on WebGPU and its small prompt decoder on the CPU: on WebGPU the bigger SAM 2
// decoders return all-zero scores, while the split matches a CPU-only run exactly (about 2 s to read a map,
// 0.2 s per mark). Without WebGPU everything runs on the CPU, which is much slower to read a map.

export const SMART_MODEL = Object.freeze({
  name: "SAM 2.1 large",
  repo: "onnx-community/sam2.1-hiera-large-ONNX",
  dtype: "fp16",
  size: "456 MB",
  library: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js",
});

let loading = null;

// Whether this browser already holds the model's weights in transformers.js's cache, so loading it downloads nothing.
export async function isSmartModelCached({ cacheStorage = globalThis.caches } = {}) {
  try {
    const cache = await cacheStorage?.open?.("transformers-cache");
    if (!cache) return false;
    return (await cache.keys()).some((request) => request.url.includes(SMART_MODEL.repo) && /\.onnx(_data)?(\?|$)/.test(request.url));
  } catch {
    return false;
  }
}

// The model, loaded once per page. `onProgress(loaded, total)` in bytes while downloading.
export function loadSmartModel({ onProgress, importer = (url) => import(url), gpu = !!globalThis.navigator?.gpu } = {}) {
  loading ??= (async () => {
    const t = await importer(SMART_MODEL.library);
    t.env.allowLocalModels = false;
    const files = new Map();
    const progress_callback = (p) => {
      if (p.status !== "progress" || !p.total) return;
      files.set(p.file, [p.loaded, p.total]);
      let loaded = 0, total = 0; for (const [l, n] of files.values()) { loaded += l; total += n; }
      onProgress?.(loaded, total);
    };
    const device = gpu ? { vision_encoder: "webgpu", prompt_encoder_mask_decoder: "wasm" } : "wasm";
    const model = await t.Sam2Model.from_pretrained(SMART_MODEL.repo, { dtype: SMART_MODEL.dtype, device, progress_callback });
    const processor = await t.AutoProcessor.from_pretrained(SMART_MODEL.repo);
    return segmenter(t, model, processor, gpu ? "webgpu" : "wasm");
  })().catch((error) => { loading = null; throw error; });
  return loading;
}

// The same model in a background worker (workers/smart-model-worker.mjs), so it never holds up Foundry's page: `.ready` gives
// { device, read(rgba, width, height) → view, masks(view, points) → { masks, scores }, drop(view), close() }, as loadSmartModel's
// does. The map is sent as a copy (transferred); the masks come back transferred.
export function smartModelWorker({ onProgress, Worker = globalThis.Worker, url = new URL('../workers/smart-model-worker.mjs', import.meta.url) } = {}) {
  const worker = new Worker(url, { type: 'module' }), waiting = new Map();
  let next = 1;
  worker.onmessage = ({ data }) => {
    if (data?.type === 'progress') { onProgress?.(data.loaded, data.total); return; }
    const w = waiting.get(data?.id); if (!w) return;
    waiting.delete(data.id);
    if (data.ok) w.resolve(data); else w.reject(new Error(data.error || 'The smart model failed.'));
  };
  worker.onerror = (event) => { const error = new Error(event?.message || 'The smart model worker failed.'); for (const w of waiting.values()) w.reject(error); waiting.clear(); };
  const ask = (message, transfer = []) => new Promise((resolve, reject) => { const id = next++; waiting.set(id, { resolve, reject }); worker.postMessage({ ...message, id }, transfer); });
  const ready = ask({ type: 'load' }).then((loaded) => ({
    device: loaded.device,
    async read(rgba, width, height) { const copy = new Uint8ClampedArray(rgba); return (await ask({ type: 'read', rgba: copy.buffer, width, height }, [copy.buffer])).view; },
    async masks(view, points) { const answer = await ask({ type: 'masks', view, points }); return { masks: answer.masks, scores: answer.scores }; },
    drop: (view) => ask({ type: 'drop', view }).catch(() => {}),
    close: () => worker.terminate(),
  }));
  ready.catch(() => worker.terminate());
  return { ready };
}

// One worker for the page, shared by Floor regions' Smart selection and Map painting's Edges: Model (one download, one model in
// memory). A promise of the worker's model, as loadSmartModel's; download progress goes to whoever asked last. A failed load is
// tried afresh next time. (Where there are no workers, it loads on the page as before.) `reset` forgets it (tests).
let sharedModel = null, sharedProgress = null;
export function smartModelShared({ onProgress, Worker = globalThis.Worker, url, reset = false } = {}) {
  if (reset) { sharedModel = null; sharedProgress = null; return null; }
  if (onProgress) sharedProgress = onProgress;
  if (!Worker) return loadSmartModel({ onProgress });
  sharedModel ??= smartModelWorker({ Worker, url, onProgress: (loaded, total) => sharedProgress?.(loaded, total) }).ready.catch((error) => { sharedModel = null; throw error; });
  return sharedModel;
}

function segmenter(t, model, processor, device) {
  const ip = processor.image_processor ?? processor;
  return {
    device,
    // Read a map once (RGBA at the generator's read size). The result answers any number of marks.
    async read(rgba, width, height) {
      const image = new t.RawImage(rgba instanceof Uint8ClampedArray ? rgba : new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength), width, height, 4).rgb();
      const inputs = await processor(image);
      const embeddings = await model.get_image_embeddings(inputs);
      return { embeddings, original_sizes: inputs.original_sizes, reshaped_input_sizes: inputs.reshaped_input_sizes, width, height };
    },
    // The three nested masks (Uint8Array, read size) and the model's score for each, for points
    // `{ x, y, label }`: 1 adds, 0 removes, 2 and 3 are a box's corners.
    async masks(view, points) {
      const { original_sizes, reshaped_input_sizes } = view, q = { ...view.embeddings };
      q.input_points = ip.reshape_input_points([points.map((p) => [p.x, p.y])], original_sizes, reshaped_input_sizes);
      q.input_labels = ip.add_input_labels([points.map((p) => p.label)], q.input_points);
      const out = await model(q);
      const data = (await ip.post_process_masks(out.pred_masks, original_sizes, reshaped_input_sizes))[0].data, n = view.width * view.height;
      return { masks: [0, 1, 2].map((i) => data.slice(i * n, (i + 1) * n)), scores: Array.from(out.iou_scores.data).slice(0, 3) };
    },
  };
}
