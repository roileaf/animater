// Live performance check, run inside a Foundry world as a GM (never shipped): how much the world-feel features cost per
// frame on a busy scene. In the browser console (F12):
//
//   const perf = await import('/modules/animater/tools/live/world-feel-perf.mjs');
//   const report = await perf.run();               // { seconds: 6, keep: false, isolate: ['fireSmoke', …] }
//
// It builds a temporary scene (24 creatures: 8 carrying torches, 4 lanterns, 4 Light orbs, one Dancing Lights; 6
// braziers; 6 sustained spells; a region look; night), then times every function on Foundry's frame ticker — Animater's
// and Foundry's own render — with the world-feel settings on, then off, on this screen only (settings are put back).
// console.table prints milliseconds per frame by listener, and the totals.

const SCENE_NAME = 'Animater perf check (temporary)';
const FEATURES = ['heldTorches', 'lightOrbs', 'fireSmoke', 'fireHaze', 'sustainThreads', 'litBySurroundings', 'regionLooks', 'natureLooks', 'shadowsOverTokens', 'flightDust', 'dripAfterSwimming'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wraps every listener on the ticker to time it; returns { stop() → [{ label, ms }] } (ms per frame).
function timeTicker(ticker) {
  const totals = new Map(), wrapped = [];
  let frames = 0;
  const count = () => { frames++; };
  ticker.add(count, null, -1000);
  for (let l = ticker._head?.next; l; l = l.next) {
    if (!l.fn || l.fn === count) continue;
    const fn = l.fn, label = (fn.name && fn.name !== 'bound ' ? fn.name : '') || String(fn).replace(/\s+/g, ' ').slice(0, 70);
    l.fn = function timed(...args) {
      const t0 = performance.now();
      try { return fn.apply(this, args); } finally { totals.set(label, (totals.get(label) ?? 0) + performance.now() - t0); }
    };
    wrapped.push([l, fn]);
  }
  return {
    stop() {
      for (const [l, fn] of wrapped) l.fn = fn;
      ticker.remove(count);
      return [...totals].map(([label, ms]) => ({ label, ms: +(ms / Math.max(1, frames)).toFixed(3) })).sort((a, b) => b.ms - a.ms);
    },
    get frames() { return frames; },
  };
}

export async function run({ seconds = 6, keep = false, isolate = [] } = {}) {
  if (!game.user.isGM) throw Error('Run the perf check as a GM.');
  const home = canvas.scene, GRID = 100;
  for (const old of game.scenes.filter((s) => s.name === SCENE_NAME)) await old.delete();
  const scene = await Scene.create({ name: SCENE_NAME, width: 24 * GRID, height: 14 * GRID, padding: 0, grid: { size: GRID },
    backgroundColor: '#6b6256', environment: { darknessLevel: 0.75, globalLight: { enabled: false } }, tokenVision: false });
  const saved = Object.fromEntries(FEATURES.map((k) => [k, game.settings.get('animater', k)]));
  const report = {};
  try {
    await scene.view();
    for (let i = 0; i < 60 && !(canvas.ready && canvas.scene?.id === scene.id); i++) await sleep(200);
    const base = game.actors.find((a) => a.type === 'character') ?? game.actors.find((a) => a.type === 'npc');
    const torch = { dim: 40, bright: 20, color: '#ff9a40', alpha: 0.4, animation: { type: 'torch', speed: 5, intensity: 5 } };
    const docs = [];
    for (let i = 0; i < 24; i++) {
      const kind = i < 8 ? 'torch' : i < 12 ? 'lantern' : i < 16 ? 'orb' : i === 16 ? 'dancing' : 'plain';
      const light = kind === 'plain' ? {} : kind === 'orb' || kind === 'dancing' ? { dim: 20, bright: 10, color: '#e7f3f1', alpha: 0.2, animation: { type: 'pulse' } } : torch;
      const lightAs = kind === 'lantern' ? 'lantern' : kind === 'torch' ? 'torch' : kind === 'orb' || kind === 'dancing' ? 'orb' : '';
      docs.push((await base.getTokenDocument({ actorLink: false, x: (2 + (i % 8) * 2.5) * GRID, y: (2 + Math.floor(i / 8) * 4) * GRID, width: 1, height: 1, light, flags: { animater: { lightAs } } })).toObject());
    }
    const tokens = await scene.createEmbeddedDocuments('Token', docs);
    await scene.createEmbeddedDocuments('AmbientLight', Array.from({ length: 6 }, (_, i) => ({ x: (3 + i * 3.5) * GRID, y: 12.5 * GRID, config: { ...torch, dim: 30, bright: 10 } })));
    await scene.createEmbeddedDocuments('Region', [{ name: 'Perf haunted', shapes: [{ type: 'rectangle', x: 0, y: 5 * GRID, width: 24 * GRID, height: 3 * GRID }], flags: { animater: { tokenshade: 'Haunted ground' } } }]);
    await sleep(1500);
    const actorOf = (doc) => canvas.tokens.get(doc.id)?.actor;
    await actorOf(tokens[16])?.createEmbeddedDocuments('Item', [{ name: 'Spell Effect: Dancing Lights', type: 'effect', img: 'icons/svg/light.svg' }]);
    for (let i = 0; i < 6; i++) {
      await actorOf(tokens[17 + i])?.createEmbeddedDocuments('Item', [{ name: `Spell Effect: Perf Ward ${i}`, type: 'effect', img: 'icons/svg/aura.svg',
        system: { duration: { value: 1, unit: 'minutes', sustained: true, expiry: 'turn-start' }, context: { origin: { actor: actorOf(tokens[i]).uuid, token: null, item: null, spellcasting: null }, target: null, roll: null } } }]);
    }
    canvas.pan({ x: 12 * GRID, y: 7 * GRID, scale: 0.6 });
    await sleep(4000);
    const d = game.modules.get('animater').api.debug;
    report.drawn = { torches: d.heldTorches(), lanterns: d.heldLanterns(), orbs: d.lightOrbs(), threads: d.sustainThreads(), smoke: d.smokePuffs(), hazes: d.fireHazes() };
    const measure = async (label) => {
      const t = timeTicker(canvas.app.ticker), start = performance.now();
      await sleep(seconds * 1000);
      const rows = t.stop(), frames = t.frames, wall = (performance.now() - start) / Math.max(1, frames);
      report[label] = { frames, msPerFrame: +wall.toFixed(2), tickerMs: +rows.reduce((s, r) => s + r.ms, 0).toFixed(2), rows: rows.slice(0, 12) };
    };
    await measure('on');
    // Each feature named in `isolate` switched off alone (the rest on): what that one costs.
    for (const k of isolate) {
      await game.settings.set('animater', k, false); await sleep(2000);
      await measure(`without ${k}`);
      await game.settings.set('animater', k, true); await sleep(1500);
    }
    for (const k of FEATURES) await game.settings.set('animater', k, false);
    await sleep(2500);
    await measure('off');
  } finally {
    for (const [k, v] of Object.entries(saved)) await game.settings.set('animater', k, v);
    if (!keep) {
      if (home && game.scenes.get(home.id)) await home.view();
      await scene.delete();
    }
  }
  console.log('Animater perf: drawn', report.drawn);
  for (const label of ['on', 'off']) if (report[label]) { console.log(`Animater perf (${label}): ${report[label].msPerFrame} ms/frame wall, ${report[label].tickerMs} ms/frame in the ticker`); console.table(report[label].rows); }
  return report;
}
