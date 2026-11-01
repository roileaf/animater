// Live performance audit of a real game, run inside Foundry as a GM (never shipped). It changes nothing in the world:
// features are switched off by overriding setting reads on this browser tab only, on the scene this tab views.
// In the browser console (F12):
//
//   const audit = await import('/modules/animater/tools/live/game-audit.mjs');
//   const report = await audit.run();          // { seconds: 4, features: [...] }
//
// It times every listener on Foundry's frame ticker and the render itself, with this world's settings as they are,
// with all of Animater's visuals off, and with each feature off alone (its cost is the difference), then watches
// JS heap and GPU textures for a while to catch growth.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Animater's visual features (world keys; their "on my screen" keys go off with them).
export const FEATURES = ['movementFeel', 'groundShadows', 'shadowsOverTokens', 'flightDust', 'dripAfterSwimming', 'trackedPrints', 'bloodTrail', 'weatherOnGround',
  'heldTorches', 'lightOrbs', 'sustainThreads', 'fireSmoke', 'fireHaze', 'litBySurroundings', 'regionLooks', 'natureLooks', 'weatherOnCreatures',
  'tokenshadeLive', 'tokenshadeLightWeather', 'conditionValueLooks', 'groundMarks', 'elementReactions', 'mapDistortion', 'effectLighting',
  'effectLightAnimation', 'afterimages', 'idleLife', 'idleHover', 'breathVapor', 'heroPointGlow', 'momentum', 'lensBlood', 'lensEffects',
  'footstepSounds', 'creatureIdleSounds'];

function overrides() {
  const settings = game.settings, get = settings.get.bind(settings), off = new Set();
  settings.get = (ns, key, ...rest) => (ns === 'animater' && (off.has(key) || off.has(key.replace(/Local$/, ''))) ? false : get(ns, key, ...rest));
  return { off, restore() { settings.get = get; } };
}

function timeFrames() {
  const ticker = canvas.app.ticker, renderer = canvas.app.renderer, totals = new Map(), undo = [];
  let frames = 0;
  const count = () => { frames++; };
  ticker.add(count, null, -1000);
  const add = (k, t) => totals.set(k, (totals.get(k) ?? 0) + t);
  for (let l = ticker._head?.next; l; l = l.next) {
    const fn = l.fn;
    if (!fn || fn === count) continue;
    const ctx = l.context?.constructor?.name ?? '';
    const label = `${ctx ? `${ctx}: ` : ''}${(fn.name && !/^bound $/.test(fn.name) ? fn.name : '') || String(fn).replace(/\s+/g, ' ').slice(0, 60)}`;
    l.fn = function timed(...args) { const t = performance.now(); try { return fn.apply(this, args); } finally { add(label, performance.now() - t); } };
    undo.push(() => { l.fn = fn; });
  }
  const render = renderer.render;
  renderer.render = function timedRender(...args) { const t = performance.now(); try { return render.apply(this, args); } finally { add('(render)', performance.now() - t); } };
  undo.push(() => { renderer.render = render; });
  const start = performance.now();
  return {
    stop() {
      for (const u of undo) u();
      ticker.remove(count);
      const n = Math.max(1, frames), rows = [...totals].map(([label, ms]) => ({ label, ms: +(ms / n).toFixed(3) })).sort((a, b) => b.ms - a.ms);
      return { frames, wall: +((performance.now() - start) / n).toFixed(2), cpu: +rows.reduce((s, r) => s + r.ms, 0).toFixed(2), render: rows.find((r) => r.label === '(render)')?.ms ?? 0, rows };
    },
  };
}

const gpu = () => {
  const r = canvas.app.renderer;
  return { textures: r.texture?.managedTextures?.length ?? null, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, displayObjects: (() => { let n = 0; const walk = (o) => { n++; for (const c of o.children ?? []) walk(c); }; walk(canvas.stage); return n; })() };
};

export async function run({ seconds = 4, features = FEATURES, watch = 30 } = {}) {
  if (!canvas?.ready) throw Error('Open a scene first.');
  const o = overrides(), report = { scene: canvas.scene.name, tokens: canvas.tokens.placeables.length, lights: canvas.effects.lightSources.size, isolate: [] };
  const measure = async () => { await sleep(1500); const t = timeFrames(); await sleep(seconds * 1000); return t.stop(); };
  try {
    report.before = gpu();
    report.on = await measure();
    // Each feature off alone: its cost is how much less the frame takes.
    const live = features.filter((k) => { try { return game.settings.get('animater', k) !== false; } catch { return false; } });
    for (const k of live) {
      o.off.add(k);
      const m = await measure();
      o.off.delete(k);
      report.isolate.push({ feature: k, savesMs: +(report.on.cpu - m.cpu).toFixed(2), cpu: m.cpu });
    }
    report.isolate.sort((a, b) => b.savesMs - a.savesMs);
    for (const k of live) o.off.add(k);
    report.off = await measure();
    o.off.clear();
    await sleep(1500);
    // Growth: heap, textures and display objects over `watch` seconds with everything back on.
    const samples = [gpu()];
    for (let i = 0; i < watch / 5; i++) { await sleep(5000); samples.push(gpu()); }
    report.growth = samples;
  } finally { o.restore(); }
  report.summary = { onCpu: report.on.cpu, offCpu: report.off.cpu, animaterMs: +(report.on.cpu - report.off.cpu).toFixed(2), wallOn: report.on.wall, wallOff: report.off.wall, fpsOn: +(1000 / report.on.wall).toFixed(0) };
  console.log('Animater audit', report.summary);
  console.table(report.isolate);
  return report;
}
