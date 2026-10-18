import test from "node:test";
import assert from "node:assert/strict";
import { SceneFxPreview } from "../../../scripts/engines/preview/scene-fx-preview.mjs";

class Container { constructor() { this.children = []; this.scale = { set: (v) => { this.scale.value = v; } }; } addChild(c) { this.children.push(c); } destroy() { this.destroyed = true; } }
function fakes() {
  const made = [];
  class Bats {
    constructor(options) { this.options = options; this.emitters = [{ autoUpdate: true, advanced: 0, update(s) { this.advanced += s; } }]; made.push(this); }
    play() { this.playing = true; }
    stop() { this.playing = false; }
  }
  const PIXI = {
    Container,
    Rectangle: class { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } },
    Application: class {
      constructor({ width, height }) { this.screen = { width, height }; this.stage = new Container(); this.view = { setAttribute() {} }; this.renderer = {}; this.ticker = { stop() { this.on = false; }, start() { this.on = true; } }; }
      render() {} destroy() { this.gone = true; }
    },
  };
  const scene = { clientWidth: 550, clientHeight: 275, append(v) { this.view = v; } };
  const catalog = { effects: [{ category: "particle", type: "bats", fields: [{ key: "density", type: "number", value: 0.5, min: 0.1, max: 5 }] }] };
  return { made, PIXI, scene, catalog, fxmaster: { particleEffects: { bats: Bats } } };
}
const recipe = { stages: [{ kind: "cast" }, { kind: "scenefx", fxCategory: "particle", fxType: "bats", fxOptions: { density: 2 } }, { kind: "scenefx", fxCategory: "filter", fxType: "bloom" }] };
const frame = (state, localTime = 0) => ({ stages: [{ state: "done" }, { state, localTime }, { state }] });

test("FXMaster particles run in a scoped context scaled to the monitor grid", () => {
  const f = fakes();
  const p = new SceneFxPreview({ ...f, recipe, grid: 55 });
  assert.equal(p.handles(1), true);
  assert.equal(p.handles(2), false, "scene filters stay canvas-only");
  p.draw(frame("pending"));
  assert.equal(f.made.length, 0);
  p.resume();
  p.draw(frame("playing"));
  const [fx] = f.made;
  assert.equal(fx.options.density.value, 2);
  const ctx = fx.options.__fxmParticleContext;
  assert.equal(ctx.dimensions.size, 100);
  assert.equal(Math.round(ctx.dimensions.width), 1000, "550px monitor at 55px grid = 10 squares");
  assert.equal(fx.__fxmParticleContext, ctx);
  assert.equal(fx.emitters[0].autoUpdate, true);
  p.draw(frame("done"));
  assert.equal(p.live.size, 0);
});

test("seeking rebuilds particles at the stage's local time and stays frozen", () => {
  const f = fakes();
  const p = new SceneFxPreview({ ...f, recipe, grid: 55 });
  p.freeze();
  p.draw(frame("playing", 2500), { seek: true });
  const emitter = f.made[0].emitters[0];
  assert.equal(emitter.advanced, 2.5);
  assert.equal(emitter.autoUpdate, false);
  p.resume();
  assert.equal(emitter.autoUpdate, true);
  p.stop();
  assert.equal(p.app, null);
});
