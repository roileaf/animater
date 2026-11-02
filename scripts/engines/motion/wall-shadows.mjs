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
