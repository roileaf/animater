// Decorations on the map: each region's painted rocks, trees, puddles and the rest (decor-paint.mjs draws them, decor-regions.mjs
// says where). Three layers: their shadows on the ground, the decorations themselves under the creatures (and a tree's trunk), and
// the trees' crowns over the creatures, opening round any creature beneath them. Puddles hand their water to the water engine,
// trees their shade to the canopy, and underground the glowing kinds go to the cavern and the webs.
//
// A picture is painted once a kind, look and variant and shared by every decoration of it: the same rock turned and flipped
// reads as another, so a region of hundreds costs a few dozen small pictures.

import { DECOR_KINDS, paintDecor, waterOutline } from './decor-paint.mjs';
import { CAVERN_KINDS, canopyKindOf, decorPlacements, decorRole } from './decor-regions.mjs';
import { SNOW_LOOK } from './snow-look.mjs';
import { decorKeyed } from '../props/decor-break.mjs';

// Snow on the decorations: the ground's own snow (snow-look.mjs, as sky-light.mjs lays it), on each one's top. A region's
// standing decorations baked small twice: their pictures (where snow can catch: their lighter parts) and their silhouettes
// blurred into domes (how high each point stands, so it gathers on top and shades round the sides). Over them one quad.
const SNOW_VERT = `precision highp float;
attribute vec2 aVertexPosition;
uniform mat3 projectionMatrix, translationMatrix;
varying vec2 vWorld;
void main(){ vWorld = aVertexPosition; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
const SNOW_FRAG = `precision highp float;
varying vec2 vWorld;
uniform sampler2D uArt, uDome;
uniform vec4 uBox;
uniform float uGrid, uAmount, uZ, uLow;
uniform vec2 uToSun;
uniform vec3 uSunColor;
${SNOW_LOOK}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 uv = (vWorld - uBox.xy) / uBox.zw;
  vec4 art = texture2D(uArt, uv);
  if (art.a < 0.35 || uAmount < 0.01) { gl_FragColor = vec4(0.0); return; }
  vec2 e = vec2(uGrid * 0.03) / uBox.zw;
  float h = texture2D(uDome, uv).a;
  vec2 slope = vec2(texture2D(uDome, uv + vec2(e.x, 0.0)).a - texture2D(uDome, uv - vec2(e.x, 0.0)).a, texture2D(uDome, uv + vec2(0.0, e.y)).a - texture2D(uDome, uv - vec2(0.0, e.y)).a) * 9.0;
  vec2 px = vWorld, skew = vec2(px.x * 0.8 + px.y * 0.6, px.y * 0.8 - px.x * 0.6);
  float speck = 0.5 * noise(skew / (uGrid * 0.2)) + 0.3 * noise(px / (uGrid * 0.085) + 7.3) + 0.2 * noise(vec2(skew.y, -skew.x) / (uGrid * 0.033) + 3.9);
  float line = 1.0 - uAmount * 1.15, edgeAt = snowFieldAt(px, uGrid) + (h - 0.5) * 0.14 + (speck - 0.5) * 0.008;
  float lie = smoothstep(line, line + 0.03, edgeAt), thick = smoothstep(0.2, 0.4, h + (speck - 0.5) * 0.03) * smoothstep(line, line + 0.1, edgeAt);
  // Only toward its top, and where its picture is light (the lit tops of leaves and stone), not over all of it.
  float lum = dot(art.rgb / max(art.a, 0.001), vec3(0.3, 0.59, 0.11));
  float a = lie * (0.44 + 0.1 * speck + (0.49 - 0.1 * speck) * thick) * smoothstep(0.6, 0.95, h) * smoothstep(0.15, 0.45, lum) * 0.82 * art.a;
  vec3 tone = snowTone(snowLit(slope, uToSun, uZ, uLow), speck, uSunColor, uZ);
  gl_FragColor = vec4(tone * a, a);
}`;
export const DECOR_SHADER_SOURCES = Object.freeze([[SNOW_VERT, SNOW_FRAG]]);

// How many looks a kind has (its seed picks one), and the sizes each is painted at (a decoration is drawn at the nearest).
export const VARIANTS = 6;
const SIZE_STEPS = [0.6, 0.85, 1.2, 1.7];
/** Which painted picture a decoration uses (pure): its kind, one of a few looks, and the size step nearest its own. */
export function pictureOf(d, look = {}) {
  const k = DECOR_KINDS[d.kind], rel = d.size / k.size, step = SIZE_STEPS.reduce((best, s) => (Math.abs(s - rel) < Math.abs(best - rel) ? s : best), SIZE_STEPS[0]);
  return { variant: (d.seed >>> 0) % VARIANTS, step, size: k.size * step, key: `${d.kind}|${(d.seed >>> 0) % VARIANTS}|${step}|${look.season ?? ''}|${look.wet ? 1 : 0}|${look.snow ? Math.round(look.snow * 4) : 0}|${look.cave ? 1 : 0}|${look.night ? 1 : 0}` };
}
// How a decoration turns: crowns, plants and round things any way; solid things only a little, so a crate stays near square to the map.
const FREE_TURN = new Set(['bush', 'agave', 'fern', 'mushrooms', 'pebbles', 'grass', 'reeds', 'flowers', 'moss', 'leaves', 'lichen', 'rubble', 'glowShrooms', 'stalagmite']);
export const turnOf = (d) => (DECOR_KINDS[d.kind]?.flat || DECOR_KINDS[d.kind]?.tree || FREE_TURN.has(d.kind) ? d.turn : d.turn * 0.4);
/** How far a decoration's shadow reaches from it (pure): `height` in squares, `length` the sun's shadow length per unit of height. */
export const shadowReach = (height, length, grid) => Math.max(0, height * length * grid * 0.5);
// How high a light stands, in squares (a torch in a hand, a lantern on a post), for how long the shadows it throws are.
export const LAMP_HEIGHT = 1.6;
/**
 * The shadow a light throws of a decoration (pure), or null: `d` it ({ x, y }), `height` its height in squares, `light`
 * { x, y, radius, strength (against the sky, 0-1) }. Away from the light, as long as the thing is tall against the light's own
 * height and as far as it stands from it (never past the light's reach), as dark as the light is strong and near.
 */
export function lampShadow(d, height, light, grid = 100) {
  const dx = d.x - light.x, dy = d.y - light.y, dist = Math.hypot(dx, dy), radius = Number(light.radius) || 0, strength = Number(light.strength ?? 1) || 0;
  if (!(radius > 0) || strength < 0.03 || dist >= radius || dist < grid * 0.15 || !(height > 0.04)) return null;
  // (Close by, a light beside a big rock still throws a long shadow off it: never shorter than the thing is tall.)
  const room = radius - dist, reach = Math.min(room, Math.max(height * grid * 0.9, (dist * height) / Math.max(0.25, LAMP_HEIGHT - Math.min(height, LAMP_HEIGHT - 0.25))));
  const alpha = Math.min(1, strength) * (1 - dist / radius) ** 0.7;
  return alpha < 0.03 ? null : { angle: Math.atan2(dy, dx), reach, alpha };
}
/**
 * What a region draws (pure): `placements` all of them (the water's ids count through these), `shown` those not broken.
 * `spec.broken` holds the broken decorations' keys; with none, nothing is keyed.
 */
export function decorShown(spec, grid) {
  const broken = spec.broken ?? [];
  if (!broken.length) { const placements = decorPlacements({ settings: spec.settings, areas: spec.areas, grid, id: spec.id }); return { placements, shown: placements }; }
  const gone = new Set(broken), keyed = decorKeyed({ id: spec.id, settings: spec.settings, areas: spec.areas }, grid);
  return { placements: keyed.map((k) => k.d), shown: keyed.filter((k) => !gone.has(k.key)).map((k) => k.d) };
}
/**
 * A broken decoration's wreck as a tile (pure), shaped as createPropWreckage reads one: its picture (`art`, from the engine's
 * art()) at its drawn size, centred where it stands, turned and mirrored as the painter draws it.
 */
export function decorWreckTile(view, art, { elevation = 0 } = {}) {
  const d = view.decor.d;
  return {
    id: view.id, x: d.x, y: d.y, width: art.width, height: art.width, rotation: (turnOf(d) * 180) / Math.PI, elevation, sort: 0, levels: view.levels,
    texture: { src: view.texture.src, anchorX: 0.5, anchorY: 0.5, scaleX: d.flip && DECOR_KINDS[d.kind].flat ? -1 : 1, scaleY: 1 },
    flags: view.flags, decor: view.decor, art,
  };
}
/** How much a crown over a creature opens (pure, 0 not at all - 1 fully): any creature within its reach. */
export function crownOpen(d, creatures = [], grid = 100) {
  const reach = (d.size * 0.46 + 0.45) * grid;
  let open = 0;
  for (const c of creatures) { const r = reach + ((Number(c.width) || grid) / 2 - grid * 0.5), dist = Math.hypot(c.x - d.x, c.y - d.y); if (dist < r) open = Math.max(open, 1 - Math.max(0, dist - r * 0.6) / (r * 0.4)); }
  return Math.min(1, open);
}

/**
 * The layer. `shadows()`, `ground()`, `above()`: containers on the map for the shadows, the decorations (under the creatures) and
 * the crowns (over them). sync(regions): [{ id, settings (decorSettings'), areas, look ({ season, wet, snow, night, cave }) }].
 * light({ sun: { angle (radians, toward the shadow), length, strength } | null, treesByCanopy }) aims the shadows.
 * creatures([{ x, y, width }]) and tick(seconds) open the crowns over them. Feeds: trees(), water(), cavern(). clear().
 */
export function createDecorations({ PIXI, shadows, ground, above, flat = ground, grid = () => 100, make = null, render = null }) {
  const pictures = new Map(), regions = new Map();
  let sun = null, canopyTrees = false, open = new Map(), snow = { amount: 0, toSun: [0, 0], z: 0, low: 1, color: [1, 0.97, 0.9] };
  const snowUniforms = (u) => Object.assign(u, { uAmount: snow.amount, uToSun: snow.toSun, uZ: snow.z, uLow: snow.low, uSunColor: snow.color });
  // A region's snow: its standing decorations' pictures and domes baked small, one quad over them on the ground layer.
  const bakeSnow = (r, items) => {
    if (!render || !items.length || !PIXI.RenderTexture) return null;
    const g = grid(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sizes = 0;
    for (const { d } of items) { const reach = d.size * g * 0.7; x0 = Math.min(x0, d.x - reach); y0 = Math.min(y0, d.y - reach); x1 = Math.max(x1, d.x + reach); y1 = Math.max(y1, d.y + reach); sizes += d.size; }
    const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, k = Math.min(0.5, 1024 / Math.max(box.w, box.h)), w = Math.max(1, Math.ceil(box.w * k)), h = Math.max(1, Math.ceil(box.h * k));
    const bake = (useShadow, blur) => {
      const stage = new PIXI.Container();
      for (const { d, pic, scale } of items) { const tex = useShadow ? pic.shadow : pic.art; if (!tex) continue; const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.position.set((d.x - box.x) * k, (d.y - box.y) * k); s.rotation = turnOf(d); s.scale.set(scale * k); stage.addChild(s); }
      if (blur > 0 && PIXI.BlurFilter) { const f = new PIXI.BlurFilter(blur); f.padding = Math.ceil(blur * 3); stage.filters = [f]; stage.filterArea = new PIXI.Rectangle(0, 0, w, h); }
      const rt = PIXI.RenderTexture.create({ width: w, height: h });
      try { render(stage, rt); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
      return rt;
    };
    const art = bake(false, 0), dome = bake(true, Math.max(2, (sizes / items.length) * g * 0.16 * k));
    const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', [box.x, box.y, box.x + box.w, box.y, box.x + box.w, box.y + box.h, box.x, box.y + box.h], 2).addIndex([0, 1, 2, 0, 2, 3]);
    const uniforms = snowUniforms({ uArt: art, uDome: dome, uBox: [box.x, box.y, box.w, box.h], uGrid: g });
    const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(SNOW_VERT, SNOW_FRAG, uniforms)); mesh.eventMode = 'none'; mesh.visible = snow.amount > 0.01;
    ground().addChild(mesh);
    return { mesh, uniforms, textures: [art, dome] };
  };
  const canvasOf = make ?? ((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  // A picture: its painting and silhouette as textures, made the first time it is asked for and kept.
  const picture = (d, look) => {
    const p = pictureOf(d, look);
    if (!pictures.has(p.key)) {
      const art = paintDecor(d.kind, 7919 * (p.variant + 1) + d.kind.length, p.size * grid(), { ...look, unit: grid(), liveWater: true }, canvasOf);
      const tex = (c) => (c ? PIXI.Texture.from(c) : null);
      pictures.set(p.key, art ? { art: tex(art.canvas), shadow: tex(art.shadow), trunk: tex(art.trunk), width: art.width, painted: p.size, canvas: art.canvas } : null);
    }
    return { pic: pictures.get(p.key), scale: d.size / p.size };
  };
  const dropRegion = (r) => {
    for (const s of r.sprites) { try { s.parent?.removeChild(s); s.destroy({ children: true }); } catch { /* gone with the canvas */ } }
    r.sprites = [];
    if (r.snow) { try { r.snow.mesh.parent?.removeChild(r.snow.mesh); r.snow.mesh.destroy(); for (const t of r.snow.textures) t.destroy(true); } catch { /* gone */ } r.snow = null; }
  };
  const place = (sprite, d, pic, scale) => { sprite.anchor.set(0.5); sprite.position.set(d.x, d.y); sprite.rotation = turnOf(d); const k = scale; sprite.scale.set((d.flip && DECOR_KINDS[d.kind].flat ? -1 : 1) * k, k); sprite.eventMode = 'none'; return sprite; };
  const aim = (r) => {
    // Each standing one's shadow away from the sun or moon, stretched by how tall it stands; a tree's only when the canopy is not drawing it.
    for (const s of r.shadowSprites) {
      const d = s.decor, k = DECOR_KINDS[d.kind], cast = sun && sun.strength > 0 && !(k.tree && canopyTrees);
      s.visible = !!cast; if (!cast) continue;
      const reach = shadowReach(k.height, sun.length, grid()), w = s.texture.width * Math.abs(s.baseScale);
      s.position.set(d.x + Math.cos(sun.angle) * reach * 0.5, d.y + Math.sin(sun.angle) * reach * 0.5);
      // Stretched along the way it falls: a child rotated to the sun inside, the silhouette turned back to the decoration's own way.
      s.rotation = sun.angle; s.scale.set((1 + reach / Math.max(w, 1) * 0.9), 1); s.inner.rotation = turnOf(d) - sun.angle;
    }
    if (r.castLayer) r.castLayer.alpha = sun ? Math.min(0.6, sun.strength) : 0;
  };
  return {
    /** A sprite of one decoration's picture, placed and turned as it would stand (for the brush's ghost), or null. */
    sprite(d, look = {}) { const { pic, scale } = picture(d, look); return pic?.art ? place(new PIXI.Sprite(pic.art), d, pic, scale) : null; },
    /** One decoration's painted picture, for its wreck: the shared texture, the canvas it was painted on, its drawn width and picture key; or null. */
    art(d, look = {}) { const { pic, scale } = picture(d, look); return pic?.art ? { texture: pic.art, canvas: pic.canvas, width: pic.art.width * scale, key: pictureOf(d, look).key } : null; },
    sync(list = []) {
      const seen = new Set(), g = grid();
      for (const spec of list) {
        seen.add(spec.id);
        // (The switch that lets them break draws nothing: flipping it never rebuilds. A break does, from the cached pictures.)
        const { canBreak: _switch, ...drawn } = spec.settings ?? {};
        const key = JSON.stringify([drawn, spec.areas, spec.look, g, spec.broken ?? []]), had = regions.get(spec.id);
        if (had?.key === key) continue;
        if (had) dropRegion(had);
        const { placements, shown } = decorShown(spec, g), where = spec.settings?.where ?? 'surface';
        const r = { key, placements, shown, where, look: spec.look, sprites: [], shadowSprites: [], crowns: [], castLayer: null };
        // Shadows: the soft dark at each standing one's foot whatever the light, then the cast ones in a layer of their own (one alpha for all, so overlaps never stack darker).
        const contact = new PIXI.Container(), cast = new PIXI.Container(), Alpha = PIXI.AlphaFilter ?? PIXI.filters?.AlphaFilter;
        if (PIXI.BlurFilter) { contact.filters = [new PIXI.BlurFilter(g * 0.05)]; cast.filters = [new PIXI.BlurFilter(g * 0.015), ...(Alpha ? [new Alpha(1)] : [])]; }
        contact.alpha = 0.5; r.castLayer = cast;
        // The lights' shadows: a layer of their own, filled as the lights near them are told (lamps()).
        const lampLayer = new PIXI.Container(); if (PIXI.BlurFilter) lampLayer.filters = [new PIXI.BlurFilter(g * 0.02), ...(Alpha ? [new Alpha(1)] : [])]; lampLayer.alpha = 0.6;
        r.lampLayer = lampLayer; r.casters = [];
        for (const d of shown) {
          const role = decorRole(d, where); if (!role || role === 'cavern') continue;
          // (Standing ones take their snow from the snow layer over them, flat ones the ground's lying over them; a tree's crown has its own painted.)
          const { pic, scale } = picture(d, role !== 'tree' && render ? { ...spec.look, snow: 0 } : spec.look); if (!pic) continue;
          if (pic.shadow && role !== 'flat') {
            const foot = place(new PIXI.Sprite(pic.shadow), d, pic, scale); foot.tint = 0x06070c; foot.position.set(d.x + g * 0.02, d.y + g * 0.03); foot.scale.set(foot.scale.x * 1.06, foot.scale.y * 1.06); contact.addChild(foot);
            // The cast one: an outer holder turned to the sun (to stretch), the silhouette inside turned to the decoration's own way.
            const holder = new PIXI.Container(), inner = new PIXI.Container(), sil = place(new PIXI.Sprite(pic.shadow), d, pic, scale); sil.position.set(0, 0); sil.rotation = 0; sil.tint = 0x06070c;
            inner.addChild(sil); holder.addChild(inner); holder.decor = d; holder.inner = inner; holder.baseScale = sil.scale.x; holder.texture = pic.shadow; cast.addChild(holder); r.shadowSprites.push(holder);
            r.casters.push({ d, pic, scale, height: DECOR_KINDS[d.kind].height, shadows: [] });
          }
          if (role === 'tree') {
            if (pic.trunk) r.sprites.push(ground().addChild(place(new PIXI.Sprite(pic.trunk), d, pic, scale)));
            const crown = above().addChild(place(new PIXI.Sprite(pic.art), d, pic, scale)); crown.decor = d; r.crowns.push(crown); r.sprites.push(crown);
          // Flat ones (moss, flowers, a puddle's mud) lie on the ground itself, under the lying snow; the rest stand over it.
          } else r.sprites.push((role === 'flat' ? flat() : ground()).addChild(place(new PIXI.Sprite(pic.art), d, pic, scale)));
        }
        shadows().addChild(contact); shadows().addChild(cast); shadows().addChild(lampLayer); r.sprites.push(contact, cast, lampLayer);
        // Snow on the standing ones (not underground). (A tree's crown carries its own, painted, as it opens over the creatures.)
        if (where !== 'cave') { const standing = shown.filter((d) => decorRole(d, where) === 'standing').map((d) => ({ d, ...picture(d, { ...spec.look, snow: 0 }) })).filter((it) => it.pic); try { r.snow = bakeSnow(r, standing); } catch (err) { console.warn('Animater | decoration snow', err); } }
        regions.set(spec.id, r); aim(r);
      }
      for (const [id, r] of regions) if (!seen.has(id)) { dropRegion(r); regions.delete(id); }
    },
    // snowAmount 0-1: how much snow lies now (as the ground's), its light from the same sun or moon (moon: its cooler colour).
    light({ sun: now = null, treesByCanopy = false, snowAmount = 0, moon = false } = {}) {
      sun = now; canopyTrees = treesByCanopy;
      snow = { amount: Math.max(0, Math.min(1, Number(snowAmount) || 0)), toSun: now ? [Math.cos(now.angle + Math.PI), Math.sin(now.angle + Math.PI)] : [0, 0], z: now ? Math.max(0, Math.min(1, now.strength)) : 0, low: now ? Math.min(2.25, Math.max(0.35, now.length)) : 1, color: moon ? [0.72, 0.8, 1] : [1, 0.97, 0.9] };
      for (const r of regions.values()) { aim(r); if (r.snow) { snowUniforms(r.snow.uniforms); r.snow.mesh.visible = snow.amount > 0.01; } }
    },
    // The lights now ([{ x, y, radius, strength (against the sky) }]): each standing decoration near one throws a shadow away
    // from it, the two nearest lights each. A few times a second, as lights move with the creatures carrying them.
    lamps(list = []) {
      const g = grid(), lights = list.filter((l) => l && l.radius > 0 && (l.strength ?? 1) > 0.03);
      for (const r of regions.values()) {
        if (!r.lampLayer) continue;
        for (const c of r.casters) {
          const near = lights.map((l) => lampShadow(c.d, c.height, l, g)).filter(Boolean).sort((a, b) => b.alpha - a.alpha).slice(0, 2);
          // A holder each shadow, made when first wanted: an outer turned to the light (to stretch), the silhouette inside turned back.
          while (c.shadows.length < near.length) { const holder = new PIXI.Container(), inner = new PIXI.Container(), sil = place(new PIXI.Sprite(c.pic.shadow), c.d, c.pic, c.scale); sil.position.set(0, 0); sil.rotation = 0; sil.tint = 0x06070c; inner.addChild(sil); holder.addChild(inner); holder.inner = inner; holder.width0 = c.pic.shadow.width * c.scale; r.lampLayer.addChild(holder); c.shadows.push(holder); }
          c.shadows.forEach((h, i) => {
            const s = near[i]; h.visible = !!s; if (!s) return;
            h.position.set(c.d.x + Math.cos(s.angle) * s.reach * 0.5, c.d.y + Math.sin(s.angle) * s.reach * 0.5);
            h.rotation = s.angle; h.scale.set(1 + (s.reach / Math.max(h.width0, 1)) * 0.9, 1); h.inner.rotation = turnOf(c.d) - s.angle; h.alpha = s.alpha;
          });
        }
      }
    },
    creatures(list = []) { const g = grid(); for (const r of regions.values()) for (const c of r.crowns) open.set(c, crownOpen(c.decor, list, g)); },
    tick(seconds) {
      // A crown eases open over a creature and closes again after it has gone (a third of a second either way).
      const rate = Math.min(1, seconds * 3);
      for (const r of regions.values()) for (const c of r.crowns) { const want = 1 - 0.75 * (open.get(c) ?? 0); c.alpha += (want - c.alpha) * rate; }
    },
    // The trees for the canopy's shade: each crown's picture where it stands, its height, kind and leaves.
    trees() {
      const out = [];
      for (const [id, r] of regions) for (const c of r.crowns) {
        const d = c.decor, k = canopyKindOf(d.kind, r.look?.season); if (!k) continue;
        out.push({ texture: c.texture, x: d.x, y: d.y, width: c.texture.width * Math.abs(c.scale.x), height: c.texture.height * Math.abs(c.scale.y), rotation: c.rotation, anchorX: 0.5, anchorY: 0.5, alpha: 1, up: DECOR_KINDS[d.kind].height, leaves: k.leaves, kind: k.kind, seed: (d.seed >>> 0) % 997, id: `${id}:${d.seed}` });
      }
      return out;
    },
    // The water of each puddle and pool, for the water engine: its id, outline and how deep it looks.
    water() {
      const out = [];
      for (const [id, r] of regions) r.placements.forEach((d, i) => { if (!DECOR_KINDS[d.kind].water) return; const o = waterOutline(d, grid(), r.look ?? {}); if (o) out.push({ id: `decor:${id}:${i}`, areas: [o], deep: r.where === 'cave' }); });
      return out;
    },
    // What the cavern and the webs draw in place of their paintings, underground: a small round area each.
    cavern() {
      const out = { fungus: [], crystals: [], lava: [], webs: [] }, ring = (x, y, rad) => Array.from({ length: 12 }, (_, i) => [x + Math.cos(i / 12 * 6.283) * rad, y + Math.sin(i / 12 * 6.283) * rad]).flat();
      const TONES = { fungus: ['green', 'blue', 'violet'], crystals: ['amethyst', 'quartz', 'rose'] };
      for (const r of regions.values()) if (r.where === 'cave') for (const d of r.shown) {
        const what = CAVERN_KINDS[d.kind]; if (!what) continue;
        const g = grid(), area = ring(d.x, d.y, d.size * g * (what === 'webs' ? 1.2 : 0.5)), scale = d.size / DECOR_KINDS[d.kind].size;
        if (what === 'fungus') out.fungus.push({ areas: [area], color: TONES.fungus[d.seed % 3], scale });
        else if (what === 'crystals') out.crystals.push({ areas: [area], stone: TONES.crystals[d.seed % 3], scale });
        else if (what === 'lava') out.lava.push({ areas: [area], heat: 0.7 });
        else out.webs.push(area);
      }
      return out;
    },
    get count() { let n = 0; for (const r of regions.values()) n += r.placements.length; return n; },
    get busy() { return regions.size > 0; },
    clear() { for (const r of regions.values()) dropRegion(r); regions.clear(); open = new Map(); for (const p of pictures.values()) for (const t of [p?.art, p?.shadow, p?.trunk]) { try { t?.destroy(true); } catch { /* gone */ } } pictures.clear(); },
  };
}
