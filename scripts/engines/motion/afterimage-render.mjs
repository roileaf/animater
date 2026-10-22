// Afterimage ghosts: pooled copies of the token's own art left where a fast motion drew it, fading out in order.
import { ghostAlpha } from './afterimages.mjs';
import { nextFrame, cancelFrame } from './canvas-frame.mjs';

// A motion with no tint of its own trails a soft cool white.
const SOFT_WHITE = 0xdfe8ff;
const tintNumber = (tint) => (typeof tint === 'string' && /^#?[0-9a-f]{6}$/i.test(tint) ? parseInt(tint.replace('#', ''), 16) : SOFT_WHITE);

// Foundry's primary group sorts by elevation, sortLayer, sort, then zIndex: one zIndex under the token.
export function placeUnder(sprite, mesh, layer = mesh.parent ?? globalThis.canvas?.primary) {
  for (const key of ['elevation', 'sortLayer', 'sort']) if (mesh[key] !== undefined) sprite[key] = mesh[key];
  sprite.zIndex = (mesh.zIndex ?? 0) - 1;
  layer?.addChild(sprite);
}

// Clocks are the motion player's: `drop` and `tick` take its time; once a motion ends, `fadeOut`
// hands its ghosts to this renderer's own frames on the same clock (`now`).
export function createAfterimages({ makeSprite, place, enabled, max = 8, now = () => performance.now(), frame = nextFrame, cancel = cancelFrame }) {
  const ghosts = new Map(), fading = new Set(), pool = [];
  let loop = null;
  const recycle = (sprite) => {
    try { sprite.parent?.removeChild(sprite); } catch { /* keep cleaning */ }
    if (sprite.destroyed) return;
    sprite.visible = false;
    pool.push(sprite);
  };
  const forget = (token) => {
    for (const ghost of ghosts.get(token) ?? []) recycle(ghost.sprite);
    ghosts.delete(token);
    fading.delete(token);
  };
  const tick = (token, clockMs) => {
    const list = ghosts.get(token);
    if (!list) return;
    const kept = list.filter((ghost) => {
      const alpha = ghost.sprite.destroyed ? 0 : ghostAlpha(clockMs - ghost.born);
      if (alpha > 0) { ghost.sprite.alpha = alpha; return true; }
      recycle(ghost.sprite);
      return false;
    });
    if (kept.length) ghosts.set(token, kept);
    else forget(token);
  };
  // Runs on the canvas ticker: one broken ghost list is dropped, never thrown.
  const run = () => {
    loop = null;
    const time = now();
    for (const token of [...fading]) {
      try { tick(token, time); } catch (error) { console.warn('Animater afterimages:', error?.message ?? error); forget(token); }
    }
    if (fading.size) loop = frame(run);
  };
  return {
    drop(token, mesh, tint, clockMs) {
      if (!mesh || mesh.destroyed || !mesh.texture || !enabled()) return;
      let sprite = pool.pop();
      if (sprite) sprite.texture = mesh.texture;
      else sprite = makeSprite(mesh.texture);
      sprite.position.set(mesh.position.x, mesh.position.y);
      sprite.rotation = mesh.rotation;
      sprite.scale.set(mesh.scale.x, mesh.scale.y);
      sprite.anchor.set(mesh.anchor?.x ?? 0.5, mesh.anchor?.y ?? 0.5);
      sprite.tint = tintNumber(tint);
      sprite.alpha = ghostAlpha(0);
      sprite.visible = true;
      try { place(sprite, mesh); } catch (error) { recycle(sprite); throw error; }
      const list = ghosts.get(token) ?? [];
      list.push({ sprite, born: clockMs });
      ghosts.set(token, list);
      // Over the cap the oldest goes at once.
      while (list.length > max) recycle(list.shift().sprite);
    },
    tick,
    fadeOut(token) {
      if (!ghosts.has(token)) return;
      fading.add(token);
      loop ??= frame(run);
    },
    clear() {
      cancel(loop);
      loop = null;
      for (const sprite of [...[...ghosts.values()].flat().map((ghost) => ghost.sprite), ...pool]) {
        try { sprite.destroy(); } catch { /* keep cleaning */ }
      }
      ghosts.clear();
      fading.clear();
      pool.length = 0;
    },
  };
}
