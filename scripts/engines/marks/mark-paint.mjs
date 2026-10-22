// Ground marks on this client: every client paints the same blotches from an anchor
// effect's `animaterMark` tag, on the floor under tokens, fades them over minutes and
// never saves anything. Textures are drawn here once per mark and reused; Foundry and
// the canvas are reached only through the options (main.mjs).
import { MARKS, layoutBlotches, markAlpha } from './ground-marks.mjs';
import { seededRandom } from '../fragments/fragments.mjs';

const HOLD_MS = 120000;
const FADE_MS = 180000;
const IN_MS = 300;
const CAP_FADE_MS = 2000;
const RIM_MS = 10000;

export const TEXTURE_PX = 256;
// The blotch body's radius inside its texture; spikes, drips and rims reach past it towards the edge.
const BODY = 100;
const C = TEXTURE_PX / 2;
const VARIANTS = 4;

const KINDS = new Set(Object.values(MARKS));
const AREAS = new Set(['circle', 'line', 'cone']);
const finite = Number.isFinite;
const finitePoint = (p) => !!p && finite(p.x) && finite(p.y);
const optional = (n) => n == null || finite(n);
function validTag(tag) {
  if (!tag || typeof tag !== 'object' || !KINDS.has(tag.mark) || !finitePoint(tag.at)) return false;
  if (!finite(tag.seed) || !(tag.delayMs >= 0) || !finite(tag.delayMs)) return false;
  if (tag.shape === 'spot') return optional(tag.radius);
  if (tag.shape === 'circle') return tag.radius > 0 && finite(tag.radius);
  if (tag.shape === 'line') return finitePoint(tag.endpoint) && optional(tag.width) && optional(tag.length);
  if (tag.shape === 'cone') return finitePoint(tag.endpoint) && finite(tag.angle) && optional(tag.length);
  return false;
}
const finiteBlotch = (b) => ['x', 'y', 'r', 'rotation'].every((k) => finite(b[k])) && b.r > 0;

/**
 * The layer of marks on one scene. `makeSprite(tag, blotches, mask)` builds one display object for a mark (with
 * `alpha`, `visible` and optional `rims`, the scorch's ember rims); `addToScene`/`removeFromScene` put it on the
 * floor and take it off (and destroy it). `viewedLevel()` is the level this client views; `cap()` the most blotches
 * kept; `mask(tag)` an area's template shape; `enabled()` whether this client paints marks at all.
 */
export function createMarkLayer({
  makeSprite, addToScene, removeFromScene, viewedLevel, now = () => performance.now(), cap = () => 60,
  mask, enabled = () => true, sceneId, gridSize = () => 100,
}) {
  let marks = []; // in arrival order
  const waiting = new Map(); // lasting anchor effect -> its mark, until the effect ends
  const seen = new WeakSet();
  let lastViewed;

  const shows = (tag, viewed) => !tag.level || !viewed || tag.level === viewed;

  const remove = (mark) => {
    marks = marks.filter((m) => m !== mark);
    if (mark.effect) waiting.delete(mark.effect);
    if (!mark.sprite) return;
    try { removeFromScene(mark.sprite); } catch { /* already gone */ }
    mark.sprite = null;
  };

  // One mark's look at `t`: fade-in, the ember rim, then its lifetime clock and any cap fade. Writes only what
  // changed and notes when it next needs a look (a holding mark is left alone until its fade starts).
  const update = (mark, t) => {
    const { sprite, tag } = mark;
    const age = t - mark.landAt;
    let alpha = markAlpha(age, { holdMs: Infinity, inMs: IN_MS });
    let next = age < IN_MS ? t : Infinity;
    if (!tag.lasting || mark.endedAt !== null) {
      // A lasting mark's clock starts when its anchor ends (or at the landing, if that was later).
      const clock = tag.lasting ? Math.max(mark.endedAt, mark.landAt) : mark.landAt;
      const life = t - clock;
      if (life >= HOLD_MS + FADE_MS) return remove(mark);
      if (life >= HOLD_MS) { alpha *= markAlpha(life, { holdMs: HOLD_MS, fadeMs: FADE_MS, inMs: 0 }); next = t; }
      else next = Math.min(next, clock + HOLD_MS);
    }
    if (mark.capAt !== null) {
      const k = (t - mark.capAt) / CAP_FADE_MS;
      if (k >= 1) return remove(mark);
      alpha *= 1 - k;
      next = t;
    }
    if (sprite.alpha !== alpha) sprite.alpha = alpha;
    if (sprite.rims?.length && !mark.rimDone) {
      const rim = Math.max(0, 1 - age / RIM_MS);
      for (const r of sprite.rims) r.alpha = rim;
      if (rim === 0) mark.rimDone = true;
      else next = t;
    }
    mark.nextAt = next;
  };

  const paint = (mark, t, viewed) => {
    // A Region that was not on this client yet when the effect arrived may be by now.
    if (!mark.mask && AREAS.has(mark.tag.shape) && mask) { try { mark.mask = mask(mark.tag) ?? null; } catch { mark.mask = null; } }
    const blotches = layoutBlotches(mark.tag, gridSize()).filter(finiteBlotch);
    if (!blotches.length) return remove(mark);
    mark.sprite = makeSprite(mark.tag, blotches, mark.mask);
    mark.size = blotches.length;
    mark.sprite.visible = shows(mark.tag, viewed);
    addToScene(mark.sprite, mark.tag);
    update(mark, t);
  };

  // Over the cap, the oldest painted marks fade out quickly.
  const enforceCap = (t) => {
    const live = marks.filter((m) => m.sprite && m.capAt === null).sort((a, b) => a.landAt - b.landAt);
    let total = live.reduce((n, m) => n + m.size, 0);
    const most = cap();
    for (const mark of live) {
      if (total <= most) break;
      mark.capAt = t;
      mark.nextAt = t;
      total -= mark.size;
    }
  };

  return {
    onEffect(effect) {
      const data = effect?.data, tag = data?.animaterMark;
      if (!data || data.moduleName !== 'animater' || !validTag(tag) || seen.has(effect)) return;
      try { if (!enabled()) return; } catch { return; }
      const here = sceneId?.();
      if (here !== undefined && (tag.sceneId ?? data.sceneId) !== here) return;
      seen.add(effect);
      let shape = null;
      if (AREAS.has(tag.shape) && mask) { try { shape = mask(tag) ?? null; } catch { shape = null; } }
      const t = now();
      const mark = {
        tag, mask: shape, landAt: t + tag.delayMs, endedAt: null, capAt: null,
        sprite: null, size: 0, nextAt: 0, rimDone: false, effect: tag.lasting ? effect : null,
      };
      marks.push(mark);
      if (tag.lasting) waiting.set(effect, mark);
    },

    onEnded(effect) {
      const mark = waiting.get(effect);
      if (!mark) return;
      waiting.delete(effect);
      mark.effect = null;
      mark.endedAt = now();
      mark.nextAt = 0;
    },

    // Runs on the PIXI ticker, where a throw would stop the canvas: it never throws, and a mark that fails is dropped.
    tick() {
      if (!marks.length) return;
      let t, viewed;
      try { t = now(); viewed = viewedLevel(); } catch { return; }
      const levelChanged = viewed !== lastViewed;
      lastViewed = viewed;
      let painted = false;
      for (const mark of [...marks]) {
        try {
          if (!mark.sprite) {
            if (t < mark.landAt) continue;
            paint(mark, t, viewed);
            painted = true;
            continue;
          }
          if (levelChanged) mark.sprite.visible = shows(mark.tag, viewed);
          if (t >= mark.nextAt) update(mark, t);
        } catch (err) {
          console.warn('Animater | dropped a ground mark', err);
          remove(mark);
        }
      }
      if (painted) { try { enforceCap(t); } catch { /* keep the frame */ } }
    },

    // A setting changed: switched off (or quality Off) wipes the floor; a smaller cap fades the oldest down to it.
    refresh() {
      let on;
      try { on = enabled(); } catch { on = false; }
      if (!on) return this.clear();
      try { enforceCap(now()); } catch { /* keep what is there */ }
    },

    clear() {
      for (const mark of marks) {
        if (!mark.sprite) continue;
        try { removeFromScene(mark.sprite); } catch { /* already gone */ }
      }
      marks = [];
      waiting.clear();
      lastViewed = undefined;
    },

    // Marks waiting to land or on the floor.
    count() {
      return marks.length;
    },
  };
}

const SHAPE_TYPES = { circle: ['circle', 'emanation'], line: ['line'], cone: ['cone'] };

/**
 * The placed area an area mark covers, as polygons (`polygonsOf(region)`, the runtime's areaMask), or null to leave
 * it unclipped. A tag naming its Region (`regionId`) uses that one. Otherwise, among the `regions` whose shape is of
 * the tag's type or starts at its origin, the best match by type, origin and size that holds a point well inside
 * the area: the centre of a circle, the middle of a line or cone (their origin lies on the outline itself).
 */
export function areaMaskFor(tag, { regions, grid = 100, polygonsOf }) {
  const list = Array.from(regions ?? []);
  const masks = (region) => { const p = [polygonsOf(region)].flat().filter(Boolean); return p.length ? p : null; };
  if (tag.regionId) { const region = list.find((r) => r?.id === tag.regionId); return region ? masks(region) : null; }
  const types = SHAPE_TYPES[tag.shape];
  if (!types) return null;
  const { at } = tag, end = tag.endpoint;
  const inner = tag.shape === 'circle' ? at : { x: (at.x + end.x) / 2, y: (at.y + end.y) / 2 };
  const size = tag.shape === 'circle' ? tag.radius : tag.length > 0 ? tag.length : Math.hypot(end.x - at.x, end.y - at.y);
  const near = (p) => finitePoint(p) && Math.hypot(p.x - at.x, p.y - at.y) <= grid / 2;
  // An emanation grows from its base: a token's footprint (top-left corner and size in squares) is centred on it.
  const centre = (b) => (b?.type === 'token' && b.width > 0 && b.height > 0 ? { x: b.x + b.width * grid / 2, y: b.y + b.height * grid / 2 } : null);
  // Shapes may hold their size in pixels or in squares.
  const sizeGap = (s) => {
    const own = s.type === 'line' ? s.length : s.radius;
    if (!(own > 0) || !(size > 0)) return 1;
    return Math.min(1, Math.abs(own - size) / size, Math.abs(own * grid - size) / size);
  };
  const scored = [];
  for (const region of list) {
    let best = Infinity;
    for (const s of Array.from(region?.shapes ?? [])) {
      const typed = types.includes(s?.type), starts = near(s) || near(s?.base) || near(centre(s?.base));
      if (typed || starts) best = Math.min(best, (typed ? 0 : 2) + (starts ? 0 : 1) + sizeGap(s));
    }
    if (best < Infinity) scored.push({ region, best });
  }
  for (const { region } of scored.sort((a, b) => a.best - b.best)) {
    const polygons = masks(region);
    if (polygons?.some((p) => p.contains(inner.x, inner.y))) return polygons;
  }
  return null;
}

// A deterministic seed per mark and variant, so every client and every session draws the same textures.
const seedOf = (mark, variant) => [...mark].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) ^ Math.imul(variant + 1, 0x9e3779b1);

// A ragged closed outline around the centre: a few low waves plus a little jitter.
function outline(random, radius, points = 48) {
  const waves = [2, 3, 5, 7].map((k) => ({ k, a: (0.04 + 0.08 * random()) / Math.sqrt(k / 2), p: random() * 2 * Math.PI }));
  return Array.from({ length: points }, (_, i) => {
    const a = (i / points) * 2 * Math.PI;
    const r = radius * (1 + waves.reduce((s, w) => s + w.a * Math.sin(w.k * a + w.p), 0) + 0.03 * (random() - 0.5));
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
}
const flat = (pts, scale = 1, dx = 0, dy = 0) => pts.flatMap((p) => [C + dx + p.x * scale, C + dy + p.y * scale]);

// A soft-edged blotch: the outline stacked from wide and faint to small, so it darkens towards the middle.
function blotch(g, shape, color, alpha, layers = 7, inner = 0.45) {
  for (let i = 0; i < layers; i++) {
    g.beginFill(color, alpha);
    g.drawPolygon(flat(shape, 1 - inner * (i / (layers - 1))));
    g.endFill();
  }
}

// A wandering line from (x, y) heading `angle`, forking now and then; calls back with each segment.
function branch(random, x, y, angle, length, step, forks, segment) {
  let left = length;
  while (left > 0) {
    angle += (random() - 0.5) * 0.9;
    const nx = x + Math.cos(angle) * step, ny = y + Math.sin(angle) * step;
    segment(x, y, nx, ny);
    if (forks > 0 && random() < 0.18) branch(random, nx, ny, angle + (random() < 0.5 ? -1 : 1) * (0.5 + 0.5 * random()), left * 0.5, step, forks - 1, segment);
    x = nx; y = ny; left -= step;
  }
}
function strokes(g, segments, passes) {
  for (const [width, color, alpha] of passes) {
    g.lineStyle(width, color, alpha);
    for (const [x0, y0, x1, y1] of segments) { g.moveTo(C + x0, C + y0); g.lineTo(C + x1, C + y1); }
  }
  g.lineStyle(0);
}

const RECIPES = {
  // Charred dark brown-black, darkest in patches at the middle.
  scorch(g, random, shape) {
    blotch(g, shape, 0x1c140e, 0.17);
    for (let i = 0; i < 3; i++) {
      const a = random() * 2 * Math.PI, d = BODY * 0.3 * random();
      g.beginFill(0x0b0806, 0.25);
      g.drawPolygon(flat(outline(random, BODY * (0.2 + 0.15 * random()), 24), 1, Math.cos(a) * d, Math.sin(a) * d));
      g.endFill();
    }
  },
  // Pale blue-white frost with crystal spikes reaching out of its edge.
  rime(g, random, shape) {
    blotch(g, shape, 0xd6eaff, 0.11, 6, 0.5);
    const segments = [];
    const spikes = 18 + Math.floor(random() * 8);
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * 2 * Math.PI + random() * 0.2, from = BODY * (0.7 + 0.15 * random()), to = BODY * (1.02 + 0.2 * random());
      const x0 = Math.cos(a) * from, y0 = Math.sin(a) * from, x1 = Math.cos(a) * to, y1 = Math.sin(a) * to;
      segments.push([x0, y0, x1, y1]);
      // Two short barbs halfway out, like a frost fern.
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, barb = (to - from) * 0.35;
      for (const side of [-0.6, 0.6]) segments.push([mx, my, mx + Math.cos(a + side) * barb, my + Math.sin(a + side) * barb]);
    }
    strokes(g, segments, [[3, 0xbfdcf5, 0.35], [1.5, 0xf4fbff, 0.75]]);
  },
  // Wet green-yellow stain with a glossy highlight and small drips at its edge.
  residue(g, random, shape) {
    blotch(g, shape, 0x9cb82a, 0.14);
    const drips = 5 + Math.floor(random() * 4);
    for (let i = 0; i < drips; i++) {
      const a = random() * 2 * Math.PI, d = BODY * (1.0 + 0.15 * random()), r = 4 + 5 * random();
      g.beginFill(0x86a321, 0.55);
      g.drawCircle(C + Math.cos(a) * d, C + Math.sin(a) * d, r);
      g.endFill();
    }
    const a = random() * 2 * Math.PI, d = BODY * 0.3;
    g.beginFill(0xe9f7a0, 0.3);
    g.drawEllipse(C + Math.cos(a) * d, C + Math.sin(a) * d, BODY * 0.22, BODY * 0.1);
    g.endFill();
  },
  // Thin branching burn lines, dark with a faint blue tint.
  streaks(g, random) {
    g.beginFill(0x1a1c24, 0.18);
    g.drawCircle(C, C, BODY * 0.18);
    g.endFill();
    const segments = [];
    const arms = 5 + Math.floor(random() * 4);
    for (let i = 0; i < arms; i++) branch(random, 0, 0, (i / arms) * 2 * Math.PI + random() * 0.5, BODY * (0.7 + 0.35 * random()), 9, 2, (...s) => segments.push(s));
    strokes(g, segments, [[4, 0x14151c, 0.7], [1.2, 0x6f8cff, 0.45]]);
  },
  // A soft sickly green-brown stain, fainter and softer-edged than acid.
  stain(g, random, shape) {
    blotch(g, shape, 0x5f5a2c, 0.1, 8, 0.6);
  },
  // A short radial crack pattern in the floor.
  cracks(g, random) {
    g.beginFill(0x201d1a, 0.3);
    g.drawPolygon(flat(outline(random, BODY * 0.22, 24)));
    g.endFill();
    const segments = [];
    const arms = 6 + Math.floor(random() * 4);
    for (let i = 0; i < arms; i++) branch(random, 0, 0, (i / arms) * 2 * Math.PI + random() * 0.4, BODY * (0.6 + 0.4 * random()), 11, 1, (...s) => segments.push(s));
    strokes(g, segments, [[3, 0x161412, 0.8], [1, 0x5a544c, 0.35]]);
  },
  // A dark purple-grey stain, as if the floor had withered.
  withered(g, random, shape) {
    blotch(g, shape, 0x3b3145, 0.14);
    for (let i = 0; i < 4; i++) {
      const a = random() * 2 * Math.PI, d = BODY * 0.5 * random();
      g.beginFill(0x271f2e, 0.2);
      g.drawPolygon(flat(outline(random, BODY * (0.15 + 0.15 * random()), 20), 1, Math.cos(a) * d, Math.sin(a) * d));
      g.endFill();
    }
  },
};

// The scorch's thin ember rim along the same outline, drawn on its own so the layer can cool it.
function emberRim(g, shape) {
  const ring = flat(shape, 0.97);
  g.lineStyle(7, 0xff4d00, 0.22);
  g.drawPolygon(ring);
  g.lineStyle(2.5, 0xff8a2a, 0.75);
  g.drawPolygon(ring);
  g.lineStyle(0);
}

/**
 * Procedural mark textures (256 px, 4 variants per mark), drawn into render textures on first use and kept for the
 * session. Each variant draws the same way every time. `rim` is the scorch's ember rim (null for the others).
 */
export function markTextures(PIXI, renderer) {
  const cache = new Map();
  const render = (key, draw) => {
    if (cache.has(key)) return cache.get(key);
    const g = new PIXI.Graphics();
    draw(g);
    const texture = PIXI.RenderTexture.create({ width: TEXTURE_PX, height: TEXTURE_PX });
    renderer.render(g, { renderTexture: texture, clear: true });
    g.destroy();
    cache.set(key, texture);
    return texture;
  };
  const variantOf = (v) => ((Math.floor(v) % VARIANTS) + VARIANTS) % VARIANTS || 0;
  // The body and the rim of one variant share its outline.
  const shapeOf = (mark, v) => { const random = seededRandom(seedOf(mark, v)); return { random, shape: outline(random, BODY) }; };
  return {
    get(mark, variant) {
      if (!RECIPES[mark]) return null;
      const v = variantOf(variant);
      return render(`${mark}:${v}`, (g) => { const { random, shape } = shapeOf(mark, v); RECIPES[mark](g, random, shape); });
    },
    rim(mark, variant) {
      if (mark !== 'scorch') return null;
      const v = variantOf(variant);
      return render(`${mark}:rim:${v}`, (g) => emberRim(g, shapeOf(mark, v).shape));
    },
  };
}

/**
 * One mark's display object: a sprite per blotch (and its ember rim, for a scorch), clipped to `mask` (an area's
 * template polygons) when given. Clicks pass through to the map.
 */
export function markSprite(PIXI, textures, tag, blotches, mask) {
  const root = new PIXI.Container();
  root.eventMode = 'none';
  root.rims = [];
  const place = (texture, b) => {
    const s = new PIXI.Sprite(texture);
    s.anchor.set(0.5);
    s.position.set(b.x, b.y);
    s.rotation = b.rotation;
    s.width = s.height = 2 * b.r * (C / BODY);
    root.addChild(s);
    return s;
  };
  for (const b of blotches) {
    const body = textures.get(tag.mark, b.variant);
    if (!body) continue;
    place(body, b);
    const rim = textures.rim(tag.mark, b.variant);
    if (rim) root.rims.push(place(rim, b));
  }
  const polygons = [mask].flat().filter(Boolean);
  if (polygons.length) {
    const clip = new PIXI.Graphics();
    clip.beginFill(0xffffff);
    for (const polygon of polygons) clip.drawPolygon(polygon);
    clip.endFill();
    root.addChild(clip);
    root.mask = clip;
  }
  return root;
}
