// A local stress scene for the Sequencer speed-ups: attached, stretched and off-screen filtered effects
// plus wall-aware positional sounds, measured with every speed-up off, all on, and each one alone.
// Everything plays locally and unsaved (no flags, nothing sent to other players) and is ended afterwards.
export const BENCH_PATCHES = ['engine', 'effects', 'sound', 'culling'];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function viewRect() {
  const { x, y, width, height } = canvas.app.renderer.screen;
  const t = canvas.stage.worldTransform, scale = t.a;
  return { x: (x - t.tx) / scale, y: (y - t.ty) / scale, width: width / scale, height: height / scale };
}

function buildScene(name, { effects, sounds, durationMs }) {
  const tokens = canvas.tokens.placeables.filter((token) => token.visible);
  if (tokens.length < 2) throw Error('Animater benchmark: place at least two visible tokens on the scene first.');
  const view = viewRect(), grid = canvas.grid.size;
  const sequence = new Sequence({ moduleName: 'animater' });
  for (let i = 0; i < effects; i++) {
    const token = tokens[i % tokens.length], other = tokens[(i + 1) % tokens.length];
    const effect = sequence.effect().file('icons/svg/aura.svg').name(name).duration(durationMs).locally();
    switch (i % 3) {
      case 0: // attached, spinning and pulsing
        effect.attachTo(token).scaleToObject(1.6)
          .loopProperty('sprite', 'rotation', { from: 0, to: 360, duration: 4000 })
          .loopProperty('alphaFilter', 'alpha', { values: [0.5, 1], duration: 1000, pingPong: true });
        break;
      case 1: // stretched between two tokens, following both
        effect.attachTo(token).stretchTo(other, { attachTo: true })
          .loopProperty('alphaFilter', 'alpha', { values: [0.6, 1], duration: 1500, pingPong: true });
        break;
      default: // filtered, parked off-screen to the right of the view
        effect.atLocation({ x: view.x + view.width + grid * (4 + (i % 10)), y: view.y + view.height / 2 + grid * (i % 7) })
          .size(grid * 2).filter('Glow', { distance: 10, outerStrength: 4, color: 0xff8800 })
          .loopProperty('sprite', 'rotation', { from: 0, to: 360, duration: 3000 });
    }
  }
  for (let i = 0; i < sounds; i++) {
    sequence.sound().file('sounds/drums.wav').name(name).attachTo(tokens[i % tokens.length])
      .radius(20).constrainedByWalls(true).volume(0).duration(durationMs).loopOptions({ loops: 0 }).locally();
  }
  return sequence;
}

export async function runBenchmark({ state, profile, effects = 60, sounds = 6, seconds = 6 } = {}) {
  if (!canvas?.ready || typeof globalThis.Sequence !== 'function') throw Error('Animater benchmark: needs an active scene and Sequencer.');
  const phases = [
    ['all off', {}],
    ['all on', Object.fromEntries(BENCH_PATCHES.map((p) => [p, true]))],
    ...BENCH_PATCHES.map((p) => [`${p} only`, { [p]: true }]),
  ];
  const saved = Object.fromEntries(['enabled', ...BENCH_PATCHES].map((k) => [k, state[k]]));
  const name = `animater-benchmark-${foundry.utils.randomID()}`;
  const durationMs = (phases.length * (seconds + 1) + 6) * 1000;
  const rows = {};
  try {
    // Effects register their per-frame handlers when they start, so play them with the speed-ups on.
    Object.assign(state, { enabled: true }, Object.fromEntries(BENCH_PATCHES.map((p) => [p, true])));
    await buildScene(name, { effects, sounds, durationMs }).play();
    await wait(2500); // let textures load and effects settle
    for (const [label, on] of phases) {
      for (const p of BENCH_PATCHES) state[p] = Boolean(on[p]);
      await wait(1000);
      rows[label] = await profile(seconds, { quiet: true });
    }
  } finally {
    Object.assign(state, saved);
    await globalThis.Sequencer?.EffectManager?.endEffects?.({ name }, false);
    globalThis.Sequencer?.SoundManager?.endSounds?.({ name }, false);
  }
  const off = rows['all off'];
  const table = Object.fromEntries(Object.entries(rows).map(([label, r]) => [label, {
    'avg ms/frame': r.avgMs, 'p95 ms': r.p95Ms, fps: r.fps,
    'vs off': label === 'all off' ? '—' : `${(((off.avgMs - r.avgMs) / off.avgMs) * 100).toFixed(1)}% less`,
    'effect skips': r.effectSkips, 'sound skips': r.soundSkips, culled: r.culled,
  }]));
  console.log(`Animater | Sequencer speed-ups benchmark: ${effects} effects, ${sounds} sounds, ${seconds}s per phase`);
  console.table(table);
  return table;
}
