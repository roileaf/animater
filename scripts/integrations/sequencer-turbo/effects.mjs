/**
 * Dirty-checking for Sequencer's per-frame effect handlers.
 *
 * attachTo / stretchTo / rotateTowards / scaleToObject effects recompute their
 * transform every frame: position lookups, offsets, a new Ray, and for stretchTo
 * an async chain of awaits. When neither the source, the target nor the effect
 * itself changed, the result is the same, so the call is skipped.
 *
 * The fingerprint covers what Sequencer reads to compute the transform. Anything
 * it cannot see (e.g. a Sequencer plugin moving positions) is handled by forcing
 * a full recompute every `refreshFrames` frames.
 */

export const DIRTY_METHODS = [
  '_transformStretchToAttachedSprite',
  '_transformAttachedNoStretchSprite',
  '_transformRotateTowardsAttachedSprite',
  '_applyScaleToObject',
];

/** Pushes numbers describing `o` into `out`. Returns false when `o` cannot be fingerprinted. */
function pushObject(out, o) {
  if (o === null || o === undefined) {
    out.push(-1);
    return true;
  }
  if (typeof o !== 'object') return false;

  const P = foundry.canvas.placeables;
  if (P.Region && o instanceof P.Region) return false;
  const ctorName = o.constructor?.name ?? '';
  if (ctorName.includes('Crosshair')) return false;

  out.push(o.destroyed ? 1 : 0);

  if (o instanceof P.PlaceableObject) {
    const d = o.document;
    out.push(
      o.x, o.y, o.w, o.h,
      d?.x, d?.y, d?.width, d?.height, d?.rotation, d?.elevation,
      d?.direction, d?.distance, d?.angle, d?.width,
      d?.texture?.scaleX, d?.texture?.scaleY,
    );
    const m = o.mesh;
    if (m && !m.destroyed) out.push(m.x, m.y, m.rotation, m.scale.x, m.scale.y, m.width, m.height);
    // A Drawing moved by a Sequencer motion moves its shape.
    const s = o.shape;
    if (s) out.push(s.x, s.y);
    return true;
  }

  if (o instanceof PIXI.DisplayObject) {
    // Another CanvasEffect (or display object) used as a source/target:
    // its world position is derived from these transforms.
    const wt = (o.sprite ?? o).worldTransform;
    const st = canvas.stage.worldTransform;
    out.push(wt.tx, wt.ty, wt.a, wt.b, st.tx, st.ty, st.a, st.d);
    return true;
  }

  if (o instanceof foundry.abstract.Document) {
    out.push(o.x, o.y, o.width, o.height, o.rotation, o.elevation, o.direction, o.distance);
    return true;
  }

  // Plain {x, y} location.
  out.push(o.x, o.y, o.elevation);
  return true;
}

function fingerprint(effect, out, args) {
  // Temporary effects owned by another user read positions pushed over sockets.
  if (effect.data?.temporary && !effect.owner) return false;
  if (!pushObject(out, effect.source)) return false;
  if (!pushObject(out, effect.data?.stretchTo || effect.data?.rotateTowards ? effect.target : null)) return false;

  const sprite = effect.sprite;
  const texture = sprite?.texture;
  out.push(
    effect.position.x, effect.position.y,
    effect.rotationContainer?.rotation,
    sprite?.width, sprite?.height,
    texture?.width, texture?.height,
    effect.flipX, effect.flipY,
    canvas.grid?.size,
  );
  for (let i = 0; i < args.length; i++) out.push(args[i]);
  return true;
}

function sameValues(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

function makeDirtyChecked(name, orig, state) {
  const wrapped = function (...args) {
    if (!state.enabled || !state.effects || this.destroyed) return orig.apply(this, args);

    const caches = (this.__turboDirty ??= {});
    let cache = caches[name];
    if (!cache) cache = caches[name] = { last: [], next: [], init: undefined, data: undefined, frames: 0, valid: false };

    const next = cache.next;
    next.length = 0;
    const ok = fingerprint(this, next, args);

    if (
      ok &&
      cache.valid &&
      cache.init === this._initialization &&
      cache.data === this.data &&
      ++cache.frames < state.refreshFrames &&
      sameValues(next, cache.last)
    ) {
      state.stats.effectSkips++;
      return;
    }

    cache.frames = 0;
    cache.valid = ok;
    cache.next = cache.last;
    cache.last = next;
    cache.init = this._initialization;
    cache.data = this.data;
    state.stats.effectRuns++;
    return orig.apply(this, args);
  };
  wrapped.__turboOrig = orig;
  return wrapped;
}

function ownerOf(proto, name) {
  for (let p = proto; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
    if (Object.prototype.hasOwnProperty.call(p, name)) return p;
  }
  return null;
}

const wrapperFor = new Map();

/** Patch the class that owns Sequencer's effect methods. Safe to call repeatedly. */
export function patchEffectPrototype(effect, state) {
  const proto = Object.getPrototypeOf(effect);
  for (const name of DIRTY_METHODS) {
    const owner = ownerOf(proto, name);
    if (!owner) continue;
    const orig = owner[name];
    if (typeof orig !== 'function' || orig.__turboOrig) continue;
    const wrapped = makeDirtyChecked(name, orig, state);
    owner[name] = wrapped;
    wrapperFor.set(orig, wrapped);
  }
}

/** Effects registered before the patch hold references to the original handlers. */
export function repointTickHandlers(effect) {
  const handlers = effect._perEffectTickHandlers;
  if (!Array.isArray(handlers)) return;
  for (let i = 0; i < handlers.length; i++) {
    const wrapped = wrapperFor.get(handlers[i]);
    if (wrapped) handlers[i] = wrapped;
  }
}
