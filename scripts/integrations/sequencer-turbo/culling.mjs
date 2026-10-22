/**
 * Off-screen culling for filtered/masked effects.
 *
 * PIXI's built-in `cullable` does not help here: a container with filters or a
 * mask pushes its filter pass before culling is checked. Sequencer effects with
 * filters (glow, color matrix, masks) pay for an offscreen render pass even when
 * nowhere near the viewport. This skips render() for those effects when their
 * bounds, padded by their filters' padding, do not touch the render frame.
 *
 * Plain sprite effects are left alone: PIXI batches them cheaply and computing
 * bounds would cost more than it saves.
 */

const SCREEN_MARGIN = 64;
let bounds = null;

function filterPadding(displayObject) {
  let padding = 0;
  const filters = displayObject?.filters;
  if (filters) for (let i = 0; i < filters.length; i++) padding += filters[i]?.padding ?? 0;
  return padding;
}

function isHeavy(effect) {
  const sprite = effect.sprite;
  return !!(
    effect.filters?.length ||
    effect._mask ||
    sprite?.filters?.length ||
    sprite?._mask ||
    effect.spriteContainer?.filters?.length ||
    effect.spriteContainer?._mask
  );
}

function isOffscreen(effect, renderer, state) {
  if (!effect.visible || !effect.renderable || effect.worldAlpha <= 0) return false;
  const data = effect.data;
  if (!data || data.screenSpace || data.screenSpaceAboveUI) return false;
  if (!isHeavy(effect)) return false;

  const frame = renderer.renderTexture?.sourceFrame;
  if (!frame || !(frame.width > 0 && frame.height > 0)) return false;

  bounds ??= new PIXI.Rectangle();
  effect.getBounds(true, bounds);
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.width)) return false;
  const pad = SCREEN_MARGIN + filterPadding(effect) + filterPadding(effect.sprite) + filterPadding(effect.spriteContainer);
  bounds.pad(pad, pad);

  const transform = renderer.projection?.transform ?? undefined;
  const offscreen = !frame.intersects(bounds, transform);
  if (offscreen) state.stats.culled++;
  return offscreen;
}

function ownerOf(proto, name) {
  for (let p = proto; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
    if (Object.prototype.hasOwnProperty.call(p, name)) return p;
  }
  return null;
}

/** Install render() on the class that owns Sequencer's effect logic. */
export function patchEffectRender(effect, state) {
  const owner = ownerOf(Object.getPrototypeOf(effect), '_registerTickers');
  if (!owner || owner.__turboRender) return;
  owner.__turboRender = true;

  const baseRender = owner.render;
  owner.render = function (renderer) {
    if (state.enabled && state.culling && isOffscreen(this, renderer, state)) {
      this.__turboCulledFrame = state.frame;
      return;
    }
    this.__turboCulledFrame = -1;
    return baseRender.call(this, renderer);
  };

  // The region "punch-through" proxy re-renders the subtree; skip it when the
  // effect itself was culled this frame.
  const voidOwner = ownerOf(Object.getPrototypeOf(effect), '_renderAsVoid');
  if (voidOwner && !voidOwner._renderAsVoid.__turboOrig) {
    const baseVoid = voidOwner._renderAsVoid;
    voidOwner._renderAsVoid = function (renderer) {
      if (state.enabled && state.culling && this.__turboCulledFrame === state.frame) return;
      return baseVoid.call(this, renderer);
    };
    voidOwner._renderAsVoid.__turboOrig = baseVoid;
  }
}
