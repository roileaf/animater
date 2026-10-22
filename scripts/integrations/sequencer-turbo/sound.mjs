/**
 * Positional sound patch.
 *
 * Sequencer's placed sounds run update() every frame. Each call constructs a
 * new PointSoundSource and initializes it, which rebuilds the sound polygon
 * (a wall sweep when walls are on), then runs a wall collision test for muffling.
 *
 * During update() this patch temporarily swaps:
 *  - CONFIG.Canvas.soundSourceClass for a factory that returns one cached source
 *    per sound. initialize() is skipped while its data and the walls are
 *    unchanged; otherwise (and every `refreshFrames` frames) the source is
 *    re-initialized with reset, which is how a fresh source starts.
 *  - canvas.sounds._configurePlayback for a memo keyed on every input it reads.
 */

let geometryEpoch = 0;

export function bumpGeometryEpoch() {
  geometryEpoch++;
}

function sameShallow(a, b) {
  if (!a || !b) return false;
  let count = 0;
  for (const key in b) {
    if (!Object.is(a[key], b[key])) return false;
    count++;
  }
  for (const key in a) count--;
  return count === 0;
}

function createCache(Real, state) {
  const cache = {
    Real,
    source: null,
    data: null,
    epoch: -1,
    frames: 0,
    realConfigure: null,
    layer: null,
    playback: { valid: false },
  };

  function createSource() {
    const source = new Real({ object: null });
    const realInitialize = source.initialize;
    source.initialize = function (data, options) {
      cache.frames++;
      if (
        cache.epoch === geometryEpoch &&
        cache.frames < state.refreshFrames &&
        sameShallow(cache.data, data)
      ) {
        state.stats.soundSkips++;
        return this;
      }
      cache.data = { ...data };
      cache.epoch = geometryEpoch;
      cache.frames = 0;
      cache.playback.valid = false;
      state.stats.soundRuns++;
      // reset: start from default data, as a freshly constructed source would.
      return realInitialize.call(this, data, { ...options, reset: true });
    };
    return source;
  }

  cache.Factory = function TurboSoundSource() {
    return (cache.source ??= createSource());
  };

  cache.configure = function (config) {
    const p = cache.playback;
    const l = config.listener;
    const level = canvas.level?.id;
    if (
      l && p.valid &&
      p.source === config.source &&
      p.epoch === geometryEpoch &&
      p.walls === config.walls &&
      p.level === level &&
      p.volumeIn === config.volume &&
      p.x === l.x && p.y === l.y && p.elevation === l.elevation
    ) {
      config.volume = p.volumeOut;
      config.muffled = p.muffled;
      return;
    }
    const volumeIn = config.volume;
    cache.realConfigure.call(cache.layer, config);
    if (!l) {
      p.valid = false;
      return;
    }
    p.valid = true;
    p.source = config.source;
    p.epoch = geometryEpoch;
    p.walls = config.walls;
    p.level = level;
    p.volumeIn = volumeIn;
    p.x = l.x;
    p.y = l.y;
    p.elevation = l.elevation;
    p.volumeOut = config.volume;
    p.muffled = config.muffled;
  };

  return cache;
}

function makeTurboUpdate(orig, state) {
  const wrapped = function () {
    if (!state.enabled || !state.sound || !canvas?.sounds) return orig.call(this);

    const canvasConfig = CONFIG.Canvas;
    const Real = canvasConfig.soundSourceClass;
    let cache = this.__turboSound;
    if (!cache || cache.Real !== Real) cache = this.__turboSound = createCache(Real, state);

    const layer = canvas.sounds;
    const hadOwn = Object.prototype.hasOwnProperty.call(layer, '_configurePlayback');
    const previous = layer._configurePlayback;
    cache.realConfigure = previous;
    cache.layer = layer;

    canvasConfig.soundSourceClass = cache.Factory;
    layer._configurePlayback = cache.configure;
    try {
      return orig.call(this);
    } finally {
      canvasConfig.soundSourceClass = Real;
      if (hadOwn) layer._configurePlayback = previous;
      else delete layer._configurePlayback;
    }
  };
  wrapped.__turboOrig = orig;
  return wrapped;
}

function isPlacedSound(fn, context) {
  return (
    context &&
    typeof fn === 'function' &&
    fn === context.update &&
    'movementDuration' in context &&
    typeof context._resolveLevelForSourceData === 'function'
  );
}

function patchSoundOwner(sound, state) {
  for (let p = Object.getPrototypeOf(sound); p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
    if (!Object.prototype.hasOwnProperty.call(p, 'update')) continue;
    if (!p.update.__turboOrig) p.update = makeTurboUpdate(p.update, state);
    return;
  }
}

/**
 * Sound classes are module-private; catch instances when they register their
 * per-frame update with a ticker.
 */
export function installSoundPatch(state) {
  const Ticker = PIXI.Ticker.prototype;
  const nativeAdd = Ticker.add;
  Ticker.add = function (fn, context, priority) {
    if (isPlacedSound(fn, context)) {
      try {
        patchSoundOwner(context, state);
        fn = context.update;
      } catch (err) {
        console.error('Sequencer Turbo | failed to patch sound', err);
      }
    }
    return nativeAdd.call(this, fn, context, priority);
  };
}
