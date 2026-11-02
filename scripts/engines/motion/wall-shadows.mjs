// Walls in the sun (the "Walls cast shadows in sunlight" setting): each wall that stops light throws its shadow on the
// floor away from the sun (sun.mjs), as long as its height and the sun's make it. Foundry's own lights already stop at
// walls; the sun had nothing. The shadows are baked once into one soft picture under the creatures and kept until the
// sun, the walls or the scene change, so a scene in daylight costs one sprite a frame.

// The longest a wall's shadow grows (squares), with the sun on the horizon: past it, it is cut.
export const WALL_SHADOW_CAP = 12;
// The picture is drawn at this share of the scene's size: soft by nature, and cheap.
const RESOLUTION = 0.25;
// How soft its edges are (blur at the picture's size).
const SOFTNESS = 2;
// The largest picture made (pixels a side).
const MAX_TEXTURE = 4096;

// How much of the sun a wall stops: its light restriction (Foundry's: 0 none, 10 limited, 20 normal, 30 proximity,
// 40 distance), a window or foliage half; an open door none.
export function wallShadowStrength(wall = {}) {
  if (Number(wall.door) > 0 && Number(wall.ds) === 1) return 0;
  const light = Number(wall.light) || 0;
  return light >= 20 && light < 30 ? 1 : light > 0 ? 0.5 : 0;
}

// Where a wall stands for its shadow, in squares up from the level's floor: { top, bottom } (null where nothing says:
// the world's "Wall height", from the floor). From its `flags`: the Wall Height module's top and bottom first, else its
// own (Wall configuration → Animater shadow: flags.animater.shadowTop / shadowBottom); without a top, the level's
// ceiling. All in scene units: `floor` the level's floor, `ceiling` its top (null none), `per` scene units a square.
export function wallSpan(flags = {}, { floor = 0, per = 1, ceiling = null } = {}) {
  const given = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const up = (v) => (Number(v) - (Number(floor) || 0)) / (Number(per) || 1);
  const module = flags?.['wall-height'] ?? {}, own = flags?.animater ?? {};
  const top = given(module.top) ? module.top : given(own.shadowTop) ? own.shadowTop : given(ceiling) && Number(ceiling) > (Number(floor) || 0) ? ceiling : null;
  const bottom = given(module.bottom) ? module.bottom : given(own.shadowBottom) ? own.shadowBottom : null;
  return { top: top === null ? null : up(top), bottom: bottom === null ? null : up(bottom) };
}

// How far (squares) a wall `height` squares tall throws its shadow with the sun `sunHeight` degrees up.
export function wallShadowReach(height, sunHeight) {
  const up = Math.max(0, Math.min(89.9, Number(sunHeight) || 0)) * Math.PI / 180;
  return Math.min(WALL_SHADOW_CAP, Math.max(0, Number(height) || 0) / Math.max(1e-6, Math.tan(up)));
}

// Each wall's shadow: { points (a quadrilateral, flat x, y pairs), alpha, top, bottom (its height and where it starts,
// squares) }. `walls`: [{ c: [x1, y1, x2, y2], light, door, ds, top?, bottom? (its own, in squares up from the floor:
// Wall Height's, a level's) }]; `sun` sun.mjs's ({ angle, height, strength }, null none); `grid` the square in pixels;
// `height` how tall a wall stands (squares) when it gives no top of its own. A wall raised off the floor (a rail, a
// high window) throws its shadow from its bottom's to its top's, lit beside it.
export function wallShadowQuads({ walls = [], sun = null, grid = 100, height = 2 } = {}) {
  if (!sun || !(Number(sun.strength) > 0)) return [];
  const away = ((Number(sun.angle) || 0) + 180) * Math.PI / 180, dx = Math.cos(away), dy = Math.sin(away);
  const given = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const out = [];
  for (const wall of walls) {
    const alpha = wallShadowStrength(wall), c = wall?.c;
    if (!(alpha > 0) || !Array.isArray(c) || c.length < 4) continue;
    const bottom = given(wall.bottom) ? Math.max(0, Number(wall.bottom)) : 0;
    const top = given(wall.top) && Number(wall.top) > 0 ? Number(wall.top) : bottom + height;
    if (!(top > bottom)) continue;
    const near = wallShadowReach(bottom, sun.height) * grid, far = wallShadowReach(top, sun.height) * grid;
    if (!(far - near > 0.5)) continue;
    const [ax, ay, bx, by] = c.map(Number);
    out.push({ points: [ax + dx * near, ay + dy * near, bx + dx * near, by + dy * near, bx + dx * far, by + dy * far, ax + dx * far, ay + dy * far], alpha, top, bottom });
  }
  return out;
}

// Light through windows and open doors (the "Light through windows" setting): the sun, or the moon, shining through an
// opening lands on the floor beyond it, away from the light, from where its sill's light reaches to where its head's
// does. It shows only under a roof (outside, that floor is lit already). The longest a shaft grows (squares):
export const WINDOW_SHAFT_CAP = 8;
// A wall's opening the light passes, squares up from the floor ({ bottom, top, alpha }), or null: a window (light
// restriction proximity or distance, Foundry's window) from a 3 ft sill to a 7 ft head, glass taking some; an open
// door from the floor to 7 ft, whole. Real sizes, whatever the wall's height (a level's 20 ft ceiling made 17 ft
// windows): `foot` is a foot in squares (a 5 ft square: 0.2). Never past the wall's own top.
export function windowOpening(wall = {}, height = 2, foot = 0.2) {
  const given = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const bottom = given(wall.bottom) ? Math.max(0, Number(wall.bottom)) : 0;
  const top = given(wall.top) && Number(wall.top) > bottom ? Number(wall.top) : bottom + height, ft = Number(foot) > 0 ? Number(foot) : 0.2;
  const upTo = (feet) => Math.min(top, bottom + feet * ft);
  if (Number(wall.door) > 0) return Number(wall.ds) === 1 ? { bottom, top: upTo(7), alpha: 1 } : null;
  // A window: Foundry's Window (light proximity or distance), or glass drawn as a wall that lets the light through
  // freely (none) but stops movement.
  const light = Number(wall.light) || 0, glass = light === 0 && Number(wall.move) > 0;
  return (light >= 30 || glass) && upTo(7) > upTo(3) ? { bottom: upTo(3), top: upTo(7), alpha: 0.8 } : null;
}
// Each opening's patch of light: { points (a quadrilateral, flat x, y pairs; its first two points along the near
// edge), alpha }. As wallShadowQuads, for the same walls, sun and height. `indoors` the roofs: an opening whose sunward
// side is under one too (a door between two rooms) lets no daylight through.
export function windowShafts({ walls = [], sun = null, grid = 100, height = 2, indoors = [], foot = 0.2 } = {}) {
  if (!sun || !(Number(sun.strength) > 0)) return [];
  const away = ((Number(sun.angle) || 0) + 180) * Math.PI / 180, dx = Math.cos(away), dy = Math.sin(away);
  const out = [];
  for (const wall of walls) {
    const open = windowOpening(wall, height, foot), c = wall?.c;
    if (!open || !Array.isArray(c) || c.length < 4) continue;
    // From the opening itself (seen from above the light streams in from the window), out to where its head's light
    // lands: a high sill's gap below it would leave the patch floating, never reading as the window's.
    const near = 0, far = Math.min(WINDOW_SHAFT_CAP, wallShadowReach(open.top, sun.height)) * grid;
    if (!(far - near > grid * 0.1)) continue;
    const [ax, ay, bx, by] = c.map(Number);
    const sunward = { x: (ax + bx) / 2 - dx * grid * 0.5, y: (ay + by) / 2 - dy * grid * 0.5 };
    if (indoors.some((p) => inside(sunward, p))) continue;
    out.push({ points: [ax + dx * near, ay + dy * near, bx + dx * near, by + dy * near, bx + dx * far, by + dy * far, ax + dx * far, ay + dy * far], alpha: open.alpha });
  }
  return out;
}

// The shafts' layer: build({ shafts, bounds, indoors (the roofs, as for the shadows), color (0xrrggbb), alpha }) bakes
// them, brightest at the opening and spreading fainter across the floor, kept only under the roofs; clear() drops them.
// Added to `root()` over the lit scene.
export function createWindowShafts({ PIXI, root, render }) {
  let sprite = null, texture = null;
  const drop = () => {
    try { sprite?.parent?.removeChild(sprite); sprite?.destroy(); } catch { /* gone with the canvas */ }
    try { texture?.destroy(true); } catch { /* gone */ }
    sprite = null; texture = null;
  };
  const SLICES = 6;
  return {
    build({ shafts = [], bounds, indoors = [], color = 0xfff2d8, alpha = 1 } = {}) {
      drop();
      if (!shafts.length || !indoors.length || !bounds || !(alpha > 0)) return;
      const k = Math.min(RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      const at = (p) => p.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k);
      const stage = new PIXI.Container(), g = new PIXI.Graphics();
      // Each patch in slices from the opening out, fading as the light spreads.
      for (const s of shafts) {
        const [ax, ay, bx, by, cx, cy, ex, ey] = s.points, lerp = (p, q, t) => p + (q - p) * t;
        for (let i = 0; i < SLICES; i++) {
          const t0 = i / SLICES, t1 = (i + 1) / SLICES;
          g.beginFill(0xffffff, s.alpha * (1 - 0.65 * (i + 0.5) / SLICES));
          g.drawPolygon(at([lerp(ax, ex, t0), lerp(ay, ey, t0), lerp(bx, cx, t0), lerp(by, cy, t0), lerp(bx, cx, t1), lerp(by, cy, t1), lerp(ax, ex, t1), lerp(ay, ey, t1)]));
          g.endFill();
        }
      }
      // Only under the roofs.
      const roofs = new PIXI.Graphics();
      for (const p of indoors) { roofs.beginFill(0xffffff, 1); roofs.drawPolygon(at(p)); roofs.endFill(); }
      g.mask = roofs;
      stage.addChild(g, roofs);
      stage.filters = [new PIXI.BlurFilter(SOFTNESS * 1.5)];
      texture = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      sprite = new PIXI.Sprite(texture);
      sprite.eventMode = 'none';
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      sprite.tint = color;
      sprite.position.set(bounds.x, bounds.y);
      sprite.scale.set(1 / k, 1 / k);
      sprite.alpha = alpha;
      root().addChild(sprite);
    },
    clear: drop,
    get built() { return !!sprite; },
  };
}

// Whether `point` lies in a wall's shadow, and how deep (the strongest covering it, 0 none): a creature `elevation`
// squares up (flying, or standing on something) is above a wall no taller than that.
export function inWallShade(point, quads = [], { elevation = 0 } = {}) {
  let deepest = 0;
  for (const q of quads) {
    if (!(q.alpha > deepest) || (Number(elevation) || 0) >= q.top) continue;
    if (inside(point, q.points)) deepest = q.alpha;
  }
  return deepest;
}

// How much of a creature `width` pixels across, standing at `point`, lies in walls' shadows (0–1): its footprint
// sampled three by three, so a dragon with a third of it out in the sun keeps a third of its sun shadow.
export function shadeAcross(point, width, quads = [], { elevation = 0 } = {}) {
  if (!quads.length) return 0;
  const step = (Number(width) || 0) / 3;
  let total = 0;
  for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) total += inWallShade({ x: point.x + i * step, y: point.y + j * step }, quads, { elevation });
  return total / 9;
}

// Even-odd point in a polygon (flat x, y pairs).
function inside({ x, y }, p) {
  let hit = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// The layer: build({ quads, bounds (the scene's { x, y, width, height }), alpha (how dark, the sun's strength in it),
// indoors (polygons, flat x, y pairs: under a roof the sun never reaches) }) bakes them; clear() drops them. `render(g,
// rt)` draws a display object into a render texture (Foundry's renderer; in tests, a record).
export function createWallShadows({ PIXI, root, render }) {
  let sprite = null, texture = null, sunlitTexture = null, sunlit = null;
  const drop = () => {
    try { sprite?.parent?.removeChild(sprite); sprite?.destroy(); } catch { /* gone with the canvas */ }
    try { texture?.destroy(true); } catch { /* gone */ }
    try { sunlitTexture?.destroy(true); } catch { /* gone */ }
    sprite = null; texture = null; sunlitTexture = null; sunlit = null;
  };
  return {
    build({ quads = [], bounds, alpha = 1, indoors = [] } = {}) {
      drop();
      if (!quads.length || !bounds || !(alpha > 0)) return;
      // Never past what any graphics card takes (a huge scene's picture is drawn a little smaller still).
      const k = Math.min(RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      const at = (p) => p.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k);
      const g = new PIXI.Graphics();
      // A whole wall's shadow drawn solid (overlapping ones never darker), a half one at half.
      for (const q of quads) { g.beginFill(0x000000, q.alpha); g.drawPolygon(at(q.points)); g.endFill(); }
      // Under a roof (a region that keeps the weather out) the sun never reaches: nothing drawn there.
      if (indoors.length) {
        const roof = new PIXI.Graphics();
        roof.blendMode = PIXI.BLEND_MODES.ERASE;
        for (const p of indoors) { roof.beginFill(0xffffff, 1); roof.drawPolygon(at(p)); roof.endFill(); }
        g.addChild(roof);
      }
      g.filters = [new PIXI.BlurFilter(SOFTNESS)];
      texture = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(g, texture); } finally { try { g.destroy({ children: true }); } catch { /* drawn */ } }
      sprite = new PIXI.Sprite(texture);
      sprite.eventMode = 'none';
      sprite.position.set(bounds.x, bounds.y);
      sprite.scale.set(1 / k, 1 / k);
      sprite.alpha = alpha;
      root().addChild(sprite);
      // The sunlit floor beside it: white where the sun reaches, cut out where a wall shades it (half behind a half
      // wall) or a roof covers it, as soft. Creatures' sun shadows are masked by it, so a floor already in a wall's
      // shade never darkens twice. Never drawn itself.
      const lit = new PIXI.Graphics();
      lit.beginFill(0xffffff, 1); lit.drawPolygon([0, 0, w, 0, w, h, 0, h]); lit.endFill();
      const shade = new PIXI.Graphics();
      shade.blendMode = PIXI.BLEND_MODES.ERASE;
      for (const q of quads) { shade.beginFill(0xffffff, q.alpha); shade.drawPolygon(at(q.points)); shade.endFill(); }
      for (const p of indoors) { shade.beginFill(0xffffff, 1); shade.drawPolygon(at(p)); shade.endFill(); }
      lit.addChild(shade);
      lit.filters = [new PIXI.BlurFilter(SOFTNESS)];
      sunlitTexture = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(lit, sunlitTexture); } finally { try { lit.destroy({ children: true }); } catch { /* drawn */ } }
      sunlit = { texture: sunlitTexture, x: bounds.x, y: bounds.y, scale: 1 / k };
    },
    clear: drop,
    get built() { return !!sprite; },
    // { texture, x, y, scale } (laid as a sprite at x, y, scaled), or null with no wall shading the floor.
    get sunlit() { return sunlit; },
  };
}
