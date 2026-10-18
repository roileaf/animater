// GPU cost of Tokenshade presets, for the FX gallery (run from its page console):
//   const { benchPresets } = await import('/modules/animater/tools/fx-gallery/bench.mjs');
//   await benchPresets({ app: fxGallery.app })
// Renders 25 tokens with a preset into a 1600px render texture and forces a sync with a
// 1-pixel readPixels (gl.finish does not block on ANGLE). Each repetition times the same
// scene without filters right before, so GPU clock changes cancel out. Cost per token per
// frame: median(time with − time without) / 25.
import * as PIXI from '/preview-pixi.mjs';
import { PRESETS, presetFilters as ownFilters } from '../../scripts/engines/tokenshade/index.mjs';

export async function benchPresets({ app, art = '/icons/svg/mystery-man.svg', size = 200, reps = 15, frames = 4,
  names = null, presets = null, presetFilters = ownFilters, warmup = 1500 } = {}) {
  const renderer = app.renderer, gl = renderer.gl;
  app.ticker.stop();
  const texture = await PIXI.Assets.load(art);
  const rt = PIXI.RenderTexture.create({ width: 1600, height: 1600 });
  const stage = new PIXI.Container();
  const sprites = [];
  for (let i = 0; i < 25; i++) {
    const s = new PIXI.Sprite(texture);
    s.anchor.set(0.5);
    s.scale.set(size / Math.max(texture.width, texture.height));
    s.position.set((i % 5 + 0.5) * 320, (Math.floor(i / 5) + 0.5) * 320);
    stage.addChild(s); sprites.push(s);
  }
  const pixel = new Uint8Array(4);
  const sync = () => { renderer.renderTexture.bind(rt); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); };
  const run = () => {
    sync();
    const start = performance.now();
    for (let k = 0; k < frames; k++) renderer.render(stage, { renderTexture: rt, clear: true });
    sync();
    return (performance.now() - start) / frames;
  };
  const measure = (perSprite, all, t0) => {
    const diffs = [];
    for (let r = 0; r < reps; r++) {
      for (const f of all) f.update(1000 + r * 37, t0 + r * 37);
      sprites.forEach(s => { s.filters = null; });
      const plain = run();
      sprites.forEach((s, i) => { s.filters = perSprite[i]; });
      diffs.push(run() - plain);
    }
    diffs.sort((a, b) => a - b);
    return diffs[diffs.length >> 1] / 25;
  };
  // Wake the GPU up to its working clocks before timing anything.
  const heavy = PRESETS.find(p => p.name === 'pure-fire-aura');
  const warm = sprites.map(() => presetFilters(PIXI, heavy, { tokenSize: { width: size, height: size }, key: 'bench' }));
  sprites.forEach((s, i) => { s.filters = warm[i]; });
  for (const end = performance.now() + warmup; performance.now() < end;) run();
  warm.flat().forEach(f => f.destroy());
  const results = [];
  const list = presets ?? PRESETS.filter(p => !names || names.includes(p.name));
  for (const preset of list) {
    const perSprite = sprites.map(() => { const fs = presetFilters(PIXI, preset, { tokenSize: { width: size, height: size }, key: 'bench' }); return fs.length ? fs : null; });
    const all = perSprite.flat().filter(Boolean);
    measure(perSprite, all, Date.now()); // compile + warm up
    const ms = measure(perSprite, all, Date.now());
    results.push({ name: preset.name, library: preset.library, filters: preset.params.map(p => p.filterType).join('+'), ms: +Math.max(0, ms).toFixed(4) });
    sprites.forEach(s => { s.filters = null; });
    all.forEach(f => f.destroy());
    await null;
  }
  stage.destroy({ children: true }); rt.destroy(true);
  app.ticker.start();
  return { ...summary(results), results };
}

export function summary(results) {
  const sorted = results.map(r => r.ms).sort((a, b) => a - b);
  const pct = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { median: pct(0.5), p90: pct(0.9), max: sorted.at(-1) };
}

// Visual A/B: renders each preset at the same moments with two filter builders (say the
// last commit's engine and the working copy) and measures how far the pixels differ.
// Returns per preset the mean and 99th-percentile channel difference (0..255) and, with
// `images`, a strip per preset: A | B | |A−B|×4.
export async function comparePresets({ app, presetsA, presetsB = ownFilters, art = '/icons/svg/mystery-man.svg', size = 200,
  names = null, presets = null, times = [700, 2300], images = false } = {}) {
  const renderer = app.renderer;
  const texture = await PIXI.Assets.load(art);
  const W = Math.ceil(size * 2.6);
  const rt = PIXI.RenderTexture.create({ width: W, height: W });
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5); sprite.scale.set(size / Math.max(texture.width, texture.height)); sprite.position.set(W / 2, W / 2 + size * 0.2);
  const stage = new PIXI.Container(); stage.addChild(sprite);
  const grab = (build, preset, t) => {
    const fs = build(PIXI, preset, { tokenSize: { width: size, height: size }, key: 'compare' });
    for (const f of fs) f.update(t, 1e6 + t);
    sprite.filters = fs.length ? fs : null;
    renderer.render(stage, { renderTexture: rt, clear: true });
    const px = renderer.extract.pixels(rt);
    sprite.filters = null; fs.forEach(f => f.destroy());
    return px;
  };
  const list = presets ?? PRESETS.filter(p => !names || names.includes(p.name));
  const out = [];
  for (const preset of list) {
    const diffs = [];
    let strip = null;
    for (const [i, t] of times.entries()) {
      const a = grab(presetsA, preset, t), b = grab(presetsB, preset, t);
      const d = new Uint8ClampedArray(a.length);
      for (let k = 0; k < a.length; k++) { const v = Math.abs(a[k] - b[k]); diffs.push(v); d[k] = k % 4 === 3 ? 255 : v * 4; }
      if (images && i === 0) {
        const c = document.createElement('canvas'); c.width = W * 3; c.height = W;
        const g = c.getContext('2d');
        g.fillStyle = '#2a2e26'; g.fillRect(0, 0, W * 2, W);
        for (const [j, px] of [a, b].entries()) {
          const tmp = document.createElement('canvas'); tmp.width = tmp.height = W;
          tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), W, W), 0, 0);
          g.drawImage(tmp, j * W, 0);
        }
        g.putImageData(new ImageData(d, W, W), W * 2, 0);
        strip = c.toDataURL('image/png');
      }
    }
    diffs.sort((x, y) => x - y);
    const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
    out.push({ name: preset.name, library: preset.library, mean: +mean.toFixed(3), p99: diffs[Math.floor(diffs.length * 0.99)], p999: diffs[Math.floor(diffs.length * 0.999)], strip });
    await null;
  }
  stage.destroy({ children: true }); rt.destroy(true);
  return out;
}

// Interleaved A/B timing: per repetition the scene is timed without filters, with A's,
// without, with B's, so both builders see the same GPU clocks. Returns ms per token per
// frame for each preset under A and B.
export async function benchCompare({ app, presetsA, presetsB = ownFilters, art = '/icons/svg/mystery-man.svg', size = 200,
  reps = 15, frames = 4, names = null, presets = null, warmup = 1500 } = {}) {
  const renderer = app.renderer, gl = renderer.gl;
  app.ticker.stop();
  const texture = await PIXI.Assets.load(art);
  const rt = PIXI.RenderTexture.create({ width: 1600, height: 1600 });
  const stage = new PIXI.Container();
  const sprites = [];
  for (let i = 0; i < 25; i++) {
    const s = new PIXI.Sprite(texture);
    s.anchor.set(0.5); s.scale.set(size / Math.max(texture.width, texture.height));
    s.position.set((i % 5 + 0.5) * 320, (Math.floor(i / 5) + 0.5) * 320);
    stage.addChild(s); sprites.push(s);
  }
  const pixel = new Uint8Array(4);
  const sync = () => { renderer.renderTexture.bind(rt); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); };
  const run = sets => {
    sprites.forEach((s, i) => { s.filters = sets ? sets[i] : null; });
    sync();
    const start = performance.now();
    for (let k = 0; k < frames; k++) renderer.render(stage, { renderTexture: rt, clear: true });
    sync();
    return (performance.now() - start) / frames;
  };
  const build = (builder, preset) => sprites.map(() => { const fs = builder(PIXI, preset, { tokenSize: { width: size, height: size }, key: 'bench' }); return fs.length ? fs : null; });
  const heavy = PRESETS.find(p => p.name === 'pure-fire-aura');
  const warm = build(presetsA, heavy);
  for (const end = performance.now() + warmup; performance.now() < end;) run(warm);
  warm.flat().filter(Boolean).forEach(f => f.destroy());
  const list = presets ?? PRESETS.filter(p => !names || names.includes(p.name));
  const results = [];
  for (const preset of list) {
    const A = build(presetsA, preset), B = build(presetsB, preset);
    const all = [...A, ...B].flat().filter(Boolean);
    const da = [], db = [];
    for (let r = -2; r < reps; r++) {
      for (const f of all) f.update(1000 + r * 37, Date.now());
      const pa = run(null), ta = run(A), pb = run(null), tb = run(B);
      if (r >= 0) { da.push(ta - pa); db.push(tb - pb); }
    }
    const med = d => { d.sort((x, y) => x - y); return +Math.max(0, d[d.length >> 1] / 25).toFixed(4); };
    results.push({ name: preset.name, library: preset.library, filters: preset.params.map(p => p.filterType).join('+'), a: med(da), b: med(db) });
    sprites.forEach(s => { s.filters = null; });
    all.forEach(f => f.destroy());
    await null;
  }
  stage.destroy({ children: true }); rt.destroy(true);
  app.ticker.start();
  const pick = k => summary(results.map(r => ({ ms: r[k] })));
  return { a: pick('a'), b: pick('b'), results };
}
