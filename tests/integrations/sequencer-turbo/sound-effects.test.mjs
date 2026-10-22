import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---- Minimal Foundry / PIXI globals -------------------------------------------------
class DisplayObject {}
class PlaceableObject extends DisplayObject {}
class Region extends PlaceableObject {}
class Document {}
const tickerListeners = [];
class Ticker {
  add(fn, context) {
    tickerListeners.push({ fn, context });
  }
}
globalThis.PIXI = { Ticker, DisplayObject, Rectangle: class {} };
globalThis.foundry = {
  canvas: { placeables: { PlaceableObject, Region } },
  abstract: { Document },
};

let shapesBuilt = 0;
let collisionTests = 0;
class FakeSoundSource {
  static defaultData = { x: 0, y: 0, elevation: 0, radius: 0, walls: true };
  constructor() {
    this.data = { ...FakeSoundSource.defaultData };
  }
  initialize(data, { reset = false } = {}) {
    if (reset) data = { ...FakeSoundSource.defaultData, ...data };
    Object.assign(this.data, data);
    shapesBuilt++;
    return this;
  }
  getVolumeMultiplier(listener) {
    return Math.max(0, 1 - Math.hypot(listener.x - this.data.x, listener.y - this.data.y) / this.data.radius);
  }
}

const soundsLayer = {
  listeners: [{ x: 0, y: 0, elevation: 0 }],
  getListenerPositions() {
    return this.listeners;
  },
  _configurePlayback(config) {
    collisionTests++;
    config.muffled = config.source.data.x > 500;
  },
};

const originalConfigure = soundsLayer._configurePlayback;

beforeEach(() => {
  shapesBuilt = 0;
  collisionTests = 0;
  globalThis.CONFIG = { Canvas: { soundSourceClass: FakeSoundSource } };
  globalThis.canvas = { sounds: soundsLayer, grid: { size: 100 }, stage: { worldTransform: {} } };
});

const { installSoundPatch, bumpGeometryEpoch } = await import('../../../scripts/integrations/sequencer-turbo/sound.mjs');
const { patchEffectPrototype } = await import('../../../scripts/integrations/sequencer-turbo/effects.mjs');

function makeState() {
  return {
    enabled: true, engine: true, effects: true, sound: true, culling: true,
    refreshFrames: 30, frame: 0,
    stats: { effectRuns: 0, effectSkips: 0, soundRuns: 0, soundSkips: 0, culled: 0 },
  };
}

// A stand-in for Sequencer's placed sound: same shape as the real update().
class BaseSound {
  update() {
    const source = new CONFIG.Canvas.soundSourceClass({ object: null });
    source.initialize({ x: this.pos.x, y: this.pos.y, elevation: 0, radius: 1000, walls: false });
    const config = { source, listener: undefined, volume: 0, walls: false, muffled: false };
    for (const l of canvas.sounds.getListenerPositions()) {
      Object.assign(config, { listener: l, volume: source.getVolumeMultiplier(l) });
    }
    canvas.sounds._configurePlayback(config);
    this.result = { volume: config.volume, muffled: config.muffled, x: source.data.x };
  }
}
class PlacedSound extends BaseSound {
  movementDuration = 0;
  _resolveLevelForSourceData() {}
  constructor(pos) {
    super();
    this.pos = pos;
  }
}

const state = makeState();
installSoundPatch(state);

function startSound(pos) {
  const sound = new PlacedSound(pos);
  new Ticker().add(sound.update, sound);
  return { sound, tick: () => tickerListeners.at(-1).fn.call(sound) };
}

test('static sound builds its source once and reuses the muffling result', () => {
  const { sound, tick } = startSound({ x: 600, y: 0 });
  for (let i = 0; i < 10; i++) tick();
  assert.equal(shapesBuilt, 1);
  assert.equal(collisionTests, 1);
  assert.deepEqual(sound.result, { volume: 0.4, muffled: true, x: 600 });
  assert.equal(CONFIG.Canvas.soundSourceClass, FakeSoundSource, 'class restored after update');
  assert.equal(soundsLayer._configurePlayback, originalConfigure, 'layer method restored');
});

test('moving sound, moving listener and wall changes recompute', () => {
  const { sound, tick } = startSound({ x: 100, y: 0 });
  tick();
  sound.pos = { x: 700, y: 0 };
  tick();
  assert.equal(shapesBuilt, 2);
  assert.deepEqual(sound.result, { volume: 0.30000000000000004, muffled: true, x: 700 });

  soundsLayer.listeners = [{ x: 100, y: 0, elevation: 0 }];
  tick();
  assert.equal(shapesBuilt, 2, 'listener move does not rebuild the source');
  assert.equal(collisionTests, 3, 'listener move re-tests muffling');

  bumpGeometryEpoch();
  tick();
  assert.equal(shapesBuilt, 3, 'wall change rebuilds the source');
  soundsLayer.listeners = [{ x: 0, y: 0, elevation: 0 }];
});

test('safety refresh rebuilds after refreshFrames', () => {
  state.refreshFrames = 5;
  const { tick } = startSound({ x: 100, y: 0 });
  for (let i = 0; i < 11; i++) tick();
  assert.equal(shapesBuilt, 3);
  state.refreshFrames = 30;
});

test('disabled sound patch runs the original every frame', () => {
  state.sound = false;
  const { tick } = startSound({ x: 100, y: 0 });
  for (let i = 0; i < 4; i++) tick();
  assert.equal(shapesBuilt, 4);
  state.sound = true;
});

// ---- Effects ----------------------------------------------------------------------------

class Token extends PlaceableObject {
  constructor() {
    super();
    this.x = 0; this.y = 0; this.w = 100; this.h = 100;
    this.document = { x: 0, y: 0, width: 1, height: 1, rotation: 0, elevation: 0, texture: { scaleX: 1, scaleY: 1 } };
    this.mesh = { x: 50, y: 50, rotation: 0, scale: { x: 1, y: 1 }, width: 100, height: 100 };
  }
}

class FakeEffect {
  calls = 0;
  constructor(source) {
    this.source = source;
    this.data = { attachTo: { active: true } };
    this.position = { x: 0, y: 0 };
    this.sprite = { width: 10, height: 10, texture: { width: 10, height: 10 } };
    this.flipX = 1; this.flipY = 1;
    this._initialization = {};
    this.owner = true;
  }
  _transformAttachedNoStretchSprite() {
    this.calls++;
    this.position.x = this.source.x + 50;
    this.position.y = this.source.y + 50;
  }
}

test('attached effect skips frames when nothing moved and recomputes on movement', () => {
  const effectState = makeState();
  const token = new Token();
  const effect = new FakeEffect(token);
  patchEffectPrototype(effect, effectState);

  for (let i = 0; i < 10; i++) effect._transformAttachedNoStretchSprite();
  assert.equal(effect.calls, 2, 'first run + one run after its own position write');

  token.x = 200;
  effect._transformAttachedNoStretchSprite();
  assert.equal(effect.position.x, 250);

  effect._initialization = {};
  const before = effect.calls;
  effect._transformAttachedNoStretchSprite();
  assert.equal(effect.calls, before + 1, 're-initialization invalidates');
});

test('unfingerprintable sources always run', () => {
  const effectState = makeState();
  const effect = new FakeEffect(new Region());
  patchEffectPrototype(effect, effectState);
  for (let i = 0; i < 5; i++) effect._transformAttachedNoStretchSprite();
  assert.equal(effect.calls, 5);
});
