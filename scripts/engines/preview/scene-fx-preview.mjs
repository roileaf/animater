import { effectOptions } from '../playback/optional-fx.mjs';

// FXMaster particle effects in the editor monitor. Each effect runs in its own
// small PIXI app through FXMaster's scoped particle context (dimensions,
// renderer, ticker), so the live scene is never touched. The simulated scene is
// scaled to the monitor's grid, keeping particle size and speed true to the
// table. Scene filters (bloom, fog…) stay canvas-only and keep their cue card.
const FAST_FORWARD_MAX = 12;

export class SceneFxPreview {
  constructor({ scene, recipe, PIXI, fxmaster, catalog, grid = 55 }) {
    this.scene = scene; this.recipe = recipe; this.PIXI = PIXI; this.fxmaster = fxmaster; this.grid = grid;
    this.stages = recipe.stages
      .map((stage, index) => ({ stage, index, effect: catalog?.effects?.find((e) => e.category === (stage.fxCategory ?? 'particle') && e.type === stage.fxType) }))
      .filter(({ stage, effect }) => stage.kind === 'scenefx' && (stage.fxCategory ?? 'particle') === 'particle' && effect && fxmaster?.particleEffects?.[stage.fxType]);
    this.live = new Map();
    this.frozen = true;
  }
  // Stage indexes this preview renders (their cue cards can step aside).
  handles(index) { return this.stages.some((s) => s.index === index); }
  ensureApp() {
    if (this.app) return this.app;
    const { PIXI } = this, width = Math.max(1, this.scene.clientWidth), height = Math.max(1, this.scene.clientHeight);
    this.app = new PIXI.Application({ width, height, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: globalThis.devicePixelRatio || 1 });
    const view = this.app.view;
    view.className = 'an-scenefx-preview';
    view.setAttribute('aria-hidden', 'true');
    this.scene.append(view);
    if (this.frozen) this.app.ticker.stop();
    return this.app;
  }
  create(entry) {
    const app = this.ensureApp(), { PIXI } = this, k = this.grid / 100;
    const width = app.screen.width / k, height = app.screen.height / k, sceneRect = new PIXI.Rectangle(0, 0, width, height);
    const context = { scope: 'animater-preview', dimensions: { width, height, size: 100, sceneX: 0, sceneY: 0, sceneWidth: width, sceneHeight: height, sceneRect }, renderer: app.renderer, ticker: app.ticker };
    const options = Object.fromEntries(Object.entries(effectOptions(entry.stage, entry.effect)).map(([key, value]) => [key, { value }]));
    options.__fxmParticleContext = context;
    const Effect = this.fxmaster.particleEffects[entry.stage.fxType], effect = new Effect(options);
    effect.__fxmParticleContext = context;
    const root = new PIXI.Container();
    root.scale.set(k);
    root.addChild(effect);
    app.stage.addChild(root);
    effect.play({ prewarm: false });
    return { effect, root };
  }
  destroy(index) {
    const live = this.live.get(index);
    if (!live) return;
    this.live.delete(index);
    try { live.effect.stop?.(); } catch { /* already stopped */ }
    live.root.destroy({ children: true });
  }
  // Particles cannot be rewound: a seek (or a stage entered late) rebuilds the
  // effect and fast-forwards it to the stage's local time.
  draw(frame, { seek = false } = {}) {
    for (const entry of this.stages) {
      const state = frame.stages[entry.index], playing = state?.state === 'playing';
      if (!playing || seek) this.destroy(entry.index);
      if (!playing || this.live.has(entry.index)) continue;
      const live = this.create(entry);
      this.live.set(entry.index, live);
      const seconds = Math.min(FAST_FORWARD_MAX, Math.max(0, (state.localTime ?? 0) / 1000));
      if (seconds > 0.05) for (const emitter of live.effect.emitters ?? []) { emitter.autoUpdate = false; emitter.update(seconds); }
      this.animate(live);
    }
    if (this.app && (seek || this.frozen)) this.app.render();
  }
  // Emitters advance on PIXI's shared ticker; pausing means switching them off.
  animate(live) { for (const emitter of live.effect.emitters ?? []) emitter.autoUpdate = !this.frozen; }
  freeze() { this.frozen = true; this.live.forEach((live) => this.animate(live)); this.app?.ticker.stop(); this.app?.render(); }
  resume() { this.frozen = false; this.live.forEach((live) => this.animate(live)); this.app?.ticker.start(); }
  stop() {
    for (const index of [...this.live.keys()]) this.destroy(index);
    this.app?.destroy(true, { children: true });
    this.app = null;
  }
}
