/**
 * Animation engine patch.
 *
 * Sequencer's SequencerAnimationEngine is a module-private singleton, so it is
 * captured at the moment it starts: its start() calls `this.nextFrame.bind(this)`.
 * A one-shot Function.prototype.bind hook recognises that call, swaps in the
 * turbo frame function and replaces the per-frame methods on the engine object.
 *
 * The replacements keep the original semantics (including the accumulation of
 * relative/absolute deltas per target property) but drop the per-frame
 * allocations: no path.split per attribute, no filter() arrays, in-place
 * compaction of the animation list, and a decorated sort in addAnimation.
 *
 * Portions derived from Sequencer (MIT, Copyright (c) 2022 Fantasy Computerworks Ltd.).
 */

const toStr = Object.prototype.toString;

function isFunction(fn) {
  if (!fn) return false;
  const tag = toStr.call(fn);
  return tag === '[object Function]' || tag === '[object AsyncFunction]';
}

function isUUID(inId) {
  return (
    typeof inId === 'string' &&
    (inId.startsWith('Scene') || inId.startsWith('Actor') || inId.startsWith('Item')) &&
    (inId.match(/\./g) || []).length &&
    !inId.endsWith('.')
  );
}

export function getObjectIdentifier(inObject) {
  const uuid = isUUID(inObject?.uuid) ? inObject?.uuid : undefined;
  return (
    uuid ??
    inObject?.id ??
    inObject?.document?.name ??
    inObject?.name ??
    (inObject?.tag !== '' ? inObject?.tag : undefined) ??
    (inObject?.label !== '' ? inObject?.label : undefined) ??
    inObject?.sound_id
  );
}

/** Same behaviour as Sequencer's lib.deep_get, with a pre-split path. */
export function getPath(obj, path) {
  try {
    let i;
    for (i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    return obj[path[i]];
  } catch (err) {
    return undefined;
  }
}

/** Same behaviour as Sequencer's lib.deep_set, with a pre-split path. */
export function setPath(obj, path, value) {
  try {
    let i;
    for (i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    const key = path[i];
    if (isFunction(obj[key])) obj[key](value);
    else obj[key] = value;
  } catch (err) {
    // Sequencer swallows errors from targets that were destroyed mid-animation.
  }
}

function pathOf(attribute) {
  return attribute._turboPath ??= attribute.propertyName.split('.');
}

function addAnimation(origin, attributes = [], timeDifference = 0) {
  if (!this.__turbo.enabled) return this.__turbo.orig.addAnimation.call(this, origin, attributes, timeDifference);
  if (!Array.isArray(attributes)) attributes = [attributes];

  return new Promise((resolve) => {
    this._animations.push({
      origin,
      attributes: attributes.map((attribute) => {
        attribute.targetId = getObjectIdentifier(attribute.target) + '-' + attribute.propertyName;
        attribute.id = foundry.utils.randomID();
        attribute.started = false;
        attribute.initialized = false;
        attribute.finishing = false;
        attribute.complete = false;
        attribute.previousValue = null;
        attribute.progress = 0;
        attribute.value = 0;
        attribute.coreValue = 0;
        attribute.isFunkyProperty = attribute.propertyName.startsWith('scale.');
        attribute._turboPath = attribute.propertyName.split('.');

        attribute.duration = attribute.duration ?? 0;
        attribute.durationDone = timeDifference ?? 0;

        if (attribute?.looping) {
          attribute.loopDuration = attribute.loopDuration ?? attribute.duration ?? 0;
          attribute.loopDurationDone = timeDifference % attribute.loopDuration ?? 0;
          attribute.loops = attribute.loops ?? 0;
          attribute.loopsDone = Math.floor(attribute.durationDone / attribute.duration);
          attribute.index = attribute.loopsDone % attribute.values.length;
          attribute.nextIndex = (attribute.loopsDone + 1) % attribute.values.length;
          if (!attribute.pingPong && attribute.nextIndex === 0) {
            attribute.index = 0;
            attribute.nextIndex = 1;
          }
        }
        return attribute;
      }),
      complete: false,
      totalDt: timeDifference,
      resolve: resolve,
    });

    // Same ordering as the original comparator (most unfinished absolute attributes first), with
    // each count computed once. The sort is stable, so an already-ordered list (the usual case:
    // the new animation lands last) is left as it is.
    const animations = this._animations;
    let ordered = true;
    for (let i = 0; i < animations.length; i++) {
      const attributes = animations[i].attributes;
      let n = 0;
      for (let j = 0; j < attributes.length; j++) if (!attributes[j].complete && attributes[j].absolute) n++;
      animations[i]._turboAbsolute = n;
      if (i > 0 && n > animations[i - 1]._turboAbsolute) ordered = false;
    }
    if (!ordered) animations.sort((a, b) => b._turboAbsolute - a._turboAbsolute);

    if (!this.ticker) this.start();
  });
}

function nextFrame() {
  if (!this.__turbo.enabled) return this.__turbo.orig.nextFrame.call(this);
  const animations = this._animations;
  if (animations.length === 0) {
    this._coreValues = {};
    return;
  }

  const stored = (this._storedValues = {});

  for (let i = 0; i < animations.length; i++) this._animate(animations[i]);

  for (const key in stored) {
    const delta = stored[key];
    setPath(delta.target, delta._turboPath ?? delta.propertyName.split('.'), delta.value);
  }

  // endAnimations() may have swapped the array out; compact whichever is current.
  const current = this._animations;
  let write = 0;
  for (let i = 0; i < current.length; i++) {
    const animation = current[i];
    if (!animation.complete) current[write++] = animation;
  }
  current.length = write;
}

function animate(animation) {
  if (!this.__turbo.enabled) return this.__turbo.orig._animate.call(this, animation);
  animation.totalDt += this.ticker.elapsedMS;
  const totalDt = animation.totalDt;
  const attributes = animation.attributes;
  let incomplete = 0;

  for (let i = 0; i < attributes.length; i++) {
    const attr = attributes[i];
    if (!attr.complete && totalDt >= attr.delay) {
      this._animateAttribute(attr);
      if (attr.finishing) {
        attr.complete = true;
        if (this._coreValues[attr.targetId]) delete this._coreValues[attr.targetId];
      }
    }
    if (!attr.complete) incomplete++;
  }

  animation.complete = incomplete === 0;
  if (animation.complete) animation.resolve();
}

function animateAttribute(attribute) {
  if (!this.__turbo.enabled) return this.__turbo.orig._animateAttribute.call(this, attribute);
  const targetId = attribute.targetId;
  const path = pathOf(attribute);

  let core = this._coreValues[targetId];
  if (core === undefined) {
    core = this._coreValues[targetId] = {
      id: attribute.id,
      value: getPath(attribute.target, path),
    };
  }

  let stored = this._storedValues[targetId];
  if (stored === undefined) {
    stored = this._storedValues[targetId] = {
      value: core.value,
      target: attribute.target,
      propertyName: attribute.propertyName,
      targetId,
      _turboPath: path,
    };
  }

  if (attribute?.looping && attribute?.indefinite) {
    this._handleIndefiniteLoop(attribute);
  } else if (attribute?.looping) {
    this._handleLoops(attribute);
  } else {
    this._handleDefault(attribute);
  }

  // The _handle* methods may replace the core entry; always read it back.
  core = this._coreValues[targetId];
  if (attribute.absolute) {
    core.value = attribute.value;
    const delta = core.value - stored.value;
    stored.value += delta;
  } else if (attribute.isFunkyProperty) {
    const coreValue = core.value;
    attribute.delta = coreValue * attribute.value - coreValue;
    stored.value += attribute.delta;
  } else {
    stored.value += attribute.value;
  }
}

/**
 * Replace the engine's hot methods in place. Returns the function the ticker
 * should call each frame.
 */
export function turboizeEngine(engine, state = { enabled: true }) {
  if (engine.__turbo) return engine.nextFrame;
  engine.__turbo = {
    get enabled() {
      return state.enabled;
    },
    orig: {
      addAnimation: engine.addAnimation,
      nextFrame: engine.nextFrame,
      _animate: engine._animate,
      _animateAttribute: engine._animateAttribute,
    },
  };
  engine.addAnimation = addAnimation;
  engine.nextFrame = nextFrame;
  engine._animate = animate;
  engine._animateAttribute = animateAttribute;
  return engine.nextFrame;
}

function looksLikeEngine(fn, thisArg) {
  return (
    fn?.name === 'nextFrame' &&
    thisArg &&
    typeof thisArg === 'object' &&
    Array.isArray(thisArg._animations) &&
    typeof thisArg.addAnimation === 'function' &&
    typeof thisArg._animateAttribute === 'function' &&
    '_coreValues' in thisArg
  );
}

/**
 * Install the one-shot bind hook. Must run before Sequencer's first animation
 * (module top level is early enough: the engine starts lazily).
 */
export function installEngineCapture(state, onCaptured) {
  const nativeBind = Function.prototype.bind;
  let done = false;
  function turboBind(thisArg, ...args) {
    if (!done && looksLikeEngine(this, thisArg)) {
      done = true;
      Function.prototype.bind = nativeBind;
      try {
        const frame = turboizeEngine(thisArg, state);
        onCaptured?.(thisArg);
        return nativeBind.call(frame, thisArg, ...args);
      } catch (err) {
        console.error('Sequencer Turbo | failed to patch animation engine', err);
      }
    }
    return nativeBind.call(this, thisArg, ...args);
  }
  Object.defineProperty(turboBind, 'name', { value: 'bind' });
  Function.prototype.bind = turboBind;
  return () => {
    if (Function.prototype.bind === turboBind) Function.prototype.bind = nativeBind;
    done = true;
  };
}
