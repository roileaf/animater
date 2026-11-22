// Decorations on the map: each region's painted rocks, trees, puddles and the rest (decor-paint.mjs draws them, decor-regions.mjs
// says where). Three layers: their shadows on the ground, the decorations themselves under the creatures (and a tree's trunk), and
// the trees' crowns over the creatures, opening round any creature beneath them. Puddles hand their water to the water engine,
// trees their shade to the canopy, and underground the glowing kinds go to the cavern and the webs.
//
// A picture is painted once a kind, look and variant and shared by every decoration of it: the same rock turned and flipped
// reads as another, so a region of hundreds costs a few dozen small pictures.

import { gustAt } from './flame-wind.mjs';
import { DECOR_KINDS, DECOR_VARIANTS, paintDecor, paintSeedOf, trunkRadius, waterOutline } from './decor-paint.mjs';
import { CAVERN_KINDS, canopyKindOf, decorPlacements, decorRole } from './decor-regions.mjs';
import { SNOW_LOOK } from './snow-look.mjs';
import { decorKeyed, decorLightOut } from '../props/decor-break.mjs';
import { aimLit, createLitMesh, litUniforms } from './decor-lit.mjs';

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
  // A light snow catches only toward its top, where its picture is light (the lit tops of leaves and stone); as it deepens it
  // spreads down its sides and over its darker parts too, until a barrel or a bale is capped white like the ground round it.
  float lum = dot(art.rgb / max(art.a, 0.001), vec3(0.3, 0.59, 0.11)), depth = smoothstep(0.3, 0.9, uAmount);
  float top = smoothstep(0.6 - 0.32 * depth, 0.95 - 0.3 * depth, h), catches = mix(smoothstep(0.15, 0.45, lum), 1.0, 0.8 * depth);
  float a = lie * (0.44 + 0.1 * speck + (0.49 - 0.1 * speck) * thick) * top * catches * (0.82 + 0.12 * depth) * art.a;
  vec3 tone = snowTone(snowLit(slope, uToSun, uZ, uLow), speck, uSunColor, uZ);
  gl_FragColor = vec4(tone * a, a);
}`;
export const DECOR_SHADER_SOURCES = Object.freeze([[SNOW_VERT, SNOW_FRAG]]);

// How many looks a kind has (its seed picks one), and the sizes each is painted at (a decoration is drawn at the nearest).
export const VARIANTS = DECOR_VARIANTS;
const SIZE_STEPS = [0.6, 0.85, 1.2, 1.7];
/** Which painted picture a decoration uses (pure): its kind, one of a few looks, and the size step nearest its own. */
export function pictureOf(d, look = {}) {
  const k = DECOR_KINDS[d.kind], rel = d.size / k.size, step = SIZE_STEPS.reduce((best, s) => (Math.abs(s - rel) < Math.abs(best - rel) ? s : best), SIZE_STEPS[0]);
  return { variant: (d.seed >>> 0) % VARIANTS, step, size: k.size * step, key: `${d.kind}|${(d.seed >>> 0) % VARIANTS}|${step}|${look.season ?? ''}|${look.wet ? 1 : 0}|${look.snow ? Math.round(look.snow * 4) : 0}|${look.cave ? 1 : 0}|${look.night ? 1 : 0}` };
}
// How a decoration turns: crowns, plants and round things any way; solid things only a little, so a crate stays near square to the map.
const FREE_TURN = new Set(['bush', 'agave', 'fern', 'mushrooms', 'pebbles', 'grass', 'reeds', 'flowers', 'moss', 'leaves', 'lichen', 'rubble', 'glowShrooms', 'stalagmite']);
/**
 * The wind on a piece of cloth now (pure): { push 0-1, dir [x, y] } in its picture's own frame (turned `rotation`). Below a breath
 * of wind none; in a wind as strong as it is, more in its gusts, each piece out of step with the next.
 */
export function clothMotion(d, air = {}, t = 0, rotation = 0) {
  const felt = Math.max(0, Math.min(1, Number(air.strength) || 0)), local = (Number(air.angle) || 0) - rotation, dir = [Math.cos(local), Math.sin(local)];
  if (felt < 0.04) return { push: 0, dir };
  const seed = ((d?.seed ?? 0) % 997) / 997;
  return { push: felt * (0.55 + 0.45 * gustAt(t, seed)), dir };
}
// The cloth itself rippling: its picture drawn through a wave along the wind, only where its mask says cloth (full in the middle,
// nothing where it is tied to its frame), the folds catching the light as they lift; poles, frame and wares stay where they are.
const CLOTH_VERT = `precision highp float;
attribute vec2 aVertexPosition, aUvs;
uniform mat3 projectionMatrix, translationMatrix;
varying vec2 vUv;
void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
const CLOTH_FRAG = `precision highp float;
varying vec2 vUv;
uniform sampler2D uArt, uCloth;
uniform float uTime, uPush, uSeed, uAlpha, uRadial, uAmp, uShade, uSpeed, uEdge;
uniform vec2 uDir;
void main(){
  float mask = texture2D(uCloth, vUv).a;
  float m = mix(mix(smoothstep(0.5, 1.0, mask), smoothstep(0.06, 0.48, length(vUv - 0.5)), uRadial), smoothstep(0.08, 0.4, mask) * (1.0 - smoothstep(0.55, 0.95, mask)), uEdge);
  vec2 n = vec2(-uDir.y, uDir.x);
  float along = dot(vUv, uDir) * 9.0, across = dot(vUv, n) * 4.0;
  // (A stronger wind moves it further, hardly faster: the ripples keep their pace, their reach grows.)
  float time = uTime * uSpeed, wave = sin(along * 2.6 - time * (1.4 + 0.5 * uPush) + uSeed + sin(across * 1.7 + time * 0.5) * 0.8) * 0.65 + sin(along * 5.3 - time * (2.3 + 0.7 * uPush) + uSeed * 2.1) * 0.35;
  // (A plant or a crown leans with the wind as well as tossing: a steady push along it, the gusts on top.)
  vec2 lean = uDir * uPush * 0.004 * uRadial;
  vec4 c = texture2D(uArt, vUv - (lean + (uDir * 0.006 + n * 0.003) * wave * uPush) * m * uAmp);
  // (Cloth reads its wind mostly as billows of light and shade rolling over it: a broad swell along the wind, the ripple on it.)
  float swell = sin(along * 0.9 - time * 0.9 + uSeed) * 0.6 + wave * 0.4;
  gl_FragColor = vec4(c.rgb * (1.0 + mix(wave, swell, 1.0 - uRadial) * 0.12 * uShade * uPush * m), c.a) * uAlpha;
}`;
// The plants that sway in the wind (a tree's crown sways too, more slowly).
export const PLANTS = new Set(['bush', 'fern', 'agave', 'grass', 'reeds', 'flowers']);
export const CLOTH_SHADER_SOURCES = Object.freeze([[CLOTH_VERT, CLOTH_FRAG]]);
export const turnOf = (d) => (d.fixed || DECOR_KINDS[d.kind]?.flat || DECOR_KINDS[d.kind]?.tree || FREE_TURN.has(d.kind) ? d.turn : d.turn * 0.4);
/** How far a decoration's shadow reaches from it (pure): `height` in squares, `length` the sun's shadow length per unit of height. */
export const shadowReach = (height, length, grid) => Math.max(0, height * length * grid * 0.5);

/**
 * Whether a region's blurred shadow layer is worth drawing (pure). Every one of them is a blur, and a blur is a pass
 * over the screen whether or not anything comes of it: a layer with nothing in it, or one turned right down (no sun on
 * the cast shadows, say), costs that pass for nothing at all. One whose shadows lie further than `margin` outside the
 * view costs it for something nobody can see. `box` is where the layer's shadows are on the map and `view` what is on
 * the screen, both { x, y, w, h }; a layer comes back on its own as the view nears it again. Told no view, or no box,
 * a layer with something in it is drawn: a rule that cannot see must not hide anything.
 */
export function shadowLayerShown({ count = 0, alpha = 1, box = null } = {}, view = null, margin = 300) {
  if (!(count > 0) || !(alpha > 0.004)) return false;
  if (!view || !box) return true;
  const m = Math.max(0, Number(margin) || 0);
  return box.x - m < view.x + view.w && box.x + box.w + m > view.x
    && box.y - m < view.y + view.h && box.y + box.h + m > view.y;
}
/**
 * How a shadow's blur is drawn. A PIXI blur is four passes each way at full size by default, which is what a sharp
 * edge needs; a shadow is the one thing on the map whose whole purpose is to have no edge, so it is drawn in two
 * passes at half size. That is about an eighth of the work for a softness nobody can tell apart from the old one,
 * and unlike leaving a layer out it saves that work wherever the layer is — which is the case a GM looking at the
 * whole map at once is always in.
 */
export const SHADOW_BLUR = Object.freeze({ quality: 2, resolution: 0.5 });
/** A blur for shadows: `PIXI`'s own, drawn as SHADOW_BLUR says. */
export function softBlur(PIXI, strength) {
  const f = new PIXI.BlurFilter(strength);
  try { f.quality = SHADOW_BLUR.quality; f.resolution = SHADOW_BLUR.resolution; } catch { /* an older filter takes what it is given */ }
  return f;
}
/**
 * Whether a floor's merged shadow layer is worth drawing (pure). The blur sits on this one layer, so it costs its pass
 * once for every region standing on that floor; it is worth paying only while one of those regions still has shadows
 * in it that are being drawn (`renderable`, which shadowLayerShown above turns off for the regions off the side of
 * the screen). A layer turned right down — a cast layer with no sun on it — is never worth it.
 */
export const floorLayerShown = (layer) => !!layer && (layer.alpha ?? 1) > 0.004
  && (layer.children ?? []).some((c) => c?.renderable !== false && (c.isSprite === true || (c.children?.length ?? 0) > 0));
/** A region's box grown to hold one more decoration's shadows (pure): `reach` how far round it they can fall. */
export function boxWith(box, { x, y }, reach) {
  const x0 = x - reach, y0 = y - reach, x1 = x + reach, y1 = y + reach;
  if (!box) return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const ax = Math.min(box.x, x0), ay = Math.min(box.y, y0), bx = Math.max(box.x + box.w, x1), by = Math.max(box.y + box.h, y1);
  return { x: ax, y: ay, w: bx - ax, h: by - ay };
}
/** How tall a decoration stands, in squares (pure): its kind's height, scaled by how big it was painted against the kind's own size,
 *  and by its Height (`tall`, 0.3 to 3: the brush's and its region's together). */
export const decorHeight = (d) => {
  // (A tile standing as a thing says its own height outright: it is no kind of ours.)
  if (Number.isFinite(d?.high)) return Math.max(0, d.high);
  const k = DECOR_KINDS[d?.kind]; if (!k || !(k.size > 0) || !(d.size > 0)) return 0;
  const tall = Number.isFinite(Number(d.tall)) && d.tall !== null && d.tall !== undefined ? Math.min(3, Math.max(0.3, Number(d.tall))) : 1;
  return k.height * (d.size / k.size) * tall;
};
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
 * The lights a region's decorations carry (pure): each lamp post, brazier or candle among `placements` at its place, scaled with its
 * size. One not `shown` (broken) is out while it is a light prop (decor-break decorLightOut: its own Light prop, the region's
 * `prop`, its kind's), and still lit when set not to be.
 *
 * Each id says where its light stands, never which place it holds in the list. Counting through the list meant that one more
 * decoration — a single dab of the brush — renamed every lamp after it, and a renamed light is destroyed, built again and
 * Foundry asked to redo its lighting and its vision. Painting beside a row of lamp posts was dropping frames for that alone.
 */
export function decorLightList(id, placements, shown, prop) {
  const out = [], standing = shown === placements ? null : new Set(shown);
  for (const d of placements) {
    const l = DECOR_KINDS[d.kind]?.light; if (!l || (standing && !standing.has(d) && decorLightOut(d, prop))) continue;
    const k = Math.sqrt(d.size / DECOR_KINDS[d.kind].size);
    out.push({ id: `decor:${id}:${d.kind}:${Math.round(d.x)}:${Math.round(d.y)}:${d.seed}`, x: d.x, y: d.y, dim: l.dim * k, bright: l.bright * k, color: l.color, animation: l.animation ?? null });
  }
  return out;
}
// A painted picture is its decoration's size plus 12% of padding each side (decor-paint paintDecor).
const CROWN_PAD = 1.24;
/** The stump a broken tree leaves, in px across (pure): the trunk it was, as painted (decor-paint trunkRadius, in squares, times the grid). */
export const treeStump = (kind, size, grid = 100) => Math.max(8, Math.round(2 * (trunkRadius(kind, Number(size)) ?? 0) * Number(grid)) || 0);
/** The leaves a tree keeps while it burns (pure): a share of its own. This one factor alone thins the shade (canopy-light multiplies alpha by leaves, so alpha is left at 1) and the falling leaves with it. */
export const burningLeaves = (leaves) => leaves * 0.4;
/** One tree as the canopy's shade is fed it (pure): its crown's picture and place, kind, leaves (thinned while `burning`) and id. */
export function treeFeed({ d, crown, region, kind, burning = null }) {
  const lit = burning?.has(`${region}:${d.kind}:${Math.round(d.x)}:${Math.round(d.y)}`) === true;
  return { texture: crown.texture, x: d.x, y: d.y, width: crown.width, height: crown.height, rotation: crown.rotation, anchorX: 0.5, anchorY: 0.5, alpha: 1, up: decorHeight(d), leaves: lit ? burningLeaves(kind.leaves) : kind.leaves, kind: kind.kind, seed: (d.seed >>> 0) % 997, id: `${region}:${d.seed}` };
}
/**
 * A broken decoration's wreck as a tile (pure), shaped as createPropWreckage reads one: its picture (`art`, from the engine's
 * art()) at its drawn size, centred where it stands, turned and mirrored as the painter draws it.
 */
export function decorWreckTile(view, art, { elevation = 0, grid = 0 } = {}) {
  const d = view.decor.d, tree = !!DECOR_KINDS[d.kind]?.tree;
  return {
    // A tree's tile is its crown (the picture burns away over it), but what it leaves is a stump: `stump` is that footprint in px.
    ...(tree ? { tree: true, stump: treeStump(d.kind, d.size, grid > 0 ? grid : art.width / (d.size * CROWN_PAD)) } : {}),
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
// The look a region is keyed by: its snow only where it has trees (their crowns carry their own painted snow); the rest are
// painted without snow and take theirs from the snow layer's light, so a snowfall never builds them again (the audit's finding).
const hasTrees = (spec) => Object.keys(spec.settings?.kinds ?? {}).some((k) => DECOR_KINDS[k]?.tree) || (spec.settings?.brushed ?? []).some((d) => DECOR_KINDS[d?.kind]?.tree);
export const lookKey = (spec) => (hasTrees(spec) ? spec.look : { ...(spec.look ?? {}), snow: 0 });

export function createDecorations({ PIXI, shadows: shadowsOf, ground: groundOf, above: aboveOf, flat: flatOf = groundOf, grid = () => 100, make = null, render = null }) {
  // (Each layer asked for the region being drawn (`at`, its spec): on a raised floor tile its decorations go on that tile, not
  // under it. Set while sync draws a region; null otherwise.)
  let at = null;
  const shadows = () => shadowsOf(at), ground = () => groundOf(at), above = () => aboveOf(at), flat = () => flatOf(at);
  const pictures = new Map(), regions = new Map(), PICTURES_KEPT = 240;
  // The tiles standing on the map as things (props(), below) are kept as one region more among the rest, under a name no region has.
  const PROPS = '\u0000tile-props';
  // Shadows are blurred once for the whole floor, not once a region. Each region keeps a plain container of its own
  // inside these three — so a region can still be taken away, or its feet baked, on its own — but the blur and the
  // strength sit here, over the lot. That is three blurs on a map however many strokes have been painted on it
  // (it was three a region, dozens on a planted map), and shadows from two strokes laid over each other no longer
  // darken the ground twice: they go into one layer at their full strength and that layer is laid down once.
  // One set a floor, not a scene: a region on a raised floor tile draws into that tile's own shadow container
  // (`shadowsOf`), and merging those would put its shadows on the ground below it.
  const floors = new Map();
  const dropFloor = (floor) => {
    if (!floor) return;
    for (const layer of [floor.contact, floor.cast, floor.lamp]) { try { layer.parent?.removeChild(layer); layer.destroy({ children: true }); } catch { /* gone with the canvas */ } }
    floors.delete(floor.host);
  };
  const floorOf = () => {
    const host = shadows(), g = grid(), Alpha = PIXI.AlphaFilter ?? PIXI.filters?.AlphaFilter;
    const had = floors.get(host);
    // (The host is remade when its tile is: a floor whose layers have left it is built again rather than drawn into.)
    if (had && !had.contact.destroyed && had.contact.parent === host) {
      if (had.grid !== g) { for (const [layer, strength, alpha] of [[had.contact, g * 0.05, false], [had.cast, g * 0.015, true], [had.lamp, g * 0.02, true]]) if (PIXI.BlurFilter) layer.filters = [softBlur(PIXI, strength), ...(alpha && Alpha ? [new Alpha(1)] : [])]; had.grid = g; }
      return had;
    }
    if (had) dropFloor(had);
    const layer = (strength, alpha, soften) => {
      const c = new PIXI.Container(); c.eventMode = 'none';
      if (PIXI.BlurFilter) c.filters = [softBlur(PIXI, strength), ...(soften && Alpha ? [new Alpha(1)] : [])];
      c.alpha = alpha; host.addChild(c); return c;
    };
    // The dark at each foot, then the cast shadows (their strength is the sun's, aim()), then the lamps'.
    const floor = { host, grid: g, count: 0, contact: layer(g * 0.05, 0.5, false), cast: layer(g * 0.015, 0, true), lamp: layer(g * 0.02, 0.6, true) };
    floors.set(host, floor);
    return floor;
  };
  // The wind now (0-1, blowing toward angle in radians) and a clock for the cloth it stirs.
  let air = { strength: 0, angle: 0 }, clock = 0, litTrees = null;
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
      for (const { d, pic, scale } of items) { const tex = useShadow ? pic.shadow : pic.art; if (!tex) continue; const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.position.set((d.x - box.x) * k, (d.y - box.y) * k); s.rotation = turnOf(d); s.scale.set(scale * k * (d.mirror ? -1 : 1), scale * k * (d.squash ?? 1)); stage.addChild(s); }
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
  // The dark at each decoration's foot is the one shadow that never moves: not with the sun, which only stretches the
  // cast ones, and not with the lamps, which have a layer of their own. Once a region has settled it is drawn once
  // into a picture, and that picture laid down in its place — so dozens of sprites drawn every frame become one quad.
  // (Its picture is of the shadows themselves, sharp: the floor's blur lies over it where it lay over them, and what
  // it is laid down at is the floor's strength, so the merge sees it as the sprites it stands for.)
  // Taken away again the moment anything is added to the region
  // or taken out of it (the brush, a decoration broken), and made afresh when the stroke ends.
  const dropContactBake = (r) => {
    if (!r?.baked) return;
    try { r.baked.sprite.parent?.removeChild(r.baked.sprite); r.baked.sprite.destroy(); r.baked.texture.destroy(true); } catch { /* gone with the canvas */ }
    r.sprites = r.sprites.filter((s) => s !== r.baked.sprite);
    r.baked = null;
    if (r.contact) r.contact.visible = true;
  };
  const bakeContact = (r) => {
    dropContactBake(r);
    if (!render || !PIXI.RenderTexture || !PIXI.Matrix || !r?.contact?.children?.length || !r.box) return;
    // Room round the shadows for the floor's blur to spread into, and never a picture too big to make.
    const pad = grid() * 0.4, box = { x: r.box.x - pad, y: r.box.y - pad, w: r.box.w + pad * 2, h: r.box.h + pad * 2 };
    const k = Math.min(1, 2048 / Math.max(box.w, box.h, 1)), w = Math.max(1, Math.ceil(box.w * k)), h = Math.max(1, Math.ceil(box.h * k));
    let texture = null;
    const was = { alpha: r.contact.alpha, visible: r.contact.visible };
    try {
      texture = PIXI.RenderTexture.create({ width: w, height: h });
      // Drawn at its full strength and shown at the layer's, so the picture is the shadows and nothing else.
      r.contact.alpha = 1; r.contact.visible = true;
      render(r.contact, texture, new PIXI.Matrix().translate(-box.x, -box.y).scale(k, k));
    } catch { try { texture?.destroy(true); } catch { /* never made */ } texture = null; }
    r.contact.alpha = was.alpha; r.contact.visible = was.visible;
    if (!texture) return;
    const sprite = new PIXI.Sprite(texture);
    sprite.eventMode = 'none'; sprite.position.set(box.x, box.y); sprite.scale.set(1 / k); sprite.alpha = was.alpha;
    // In the layer where the live one stood, so the shadows keep their order among themselves.
    const layer = r.contact.parent;
    if (layer) layer.addChildAt(sprite, layer.getChildIndex(r.contact)); else { try { sprite.destroy(); texture.destroy(true); } catch { /* gone */ } return; }
    r.contact.visible = false;
    r.baked = { sprite, texture };
    r.sprites.push(sprite);
  };
  const canvasOf = make ?? ((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  // A picture: its painting and silhouette as textures, made the first time it is asked for and kept.
  const picture = (d, look) => {
    const p = pictureOf(d, look);
    if (!pictures.has(p.key)) {
      const art = paintDecor(d.kind, paintSeedOf(d), p.size * grid(), { ...look, unit: grid(), liveWater: true }, canvasOf);
      const tex = (c) => (c ? PIXI.Texture.from(c) : null);
      pictures.set(p.key, art ? { art: tex(art.canvas), shadow: tex(art.shadow), trunk: tex(art.trunk), cloth: tex(art.cloth), width: art.width, painted: p.size, canvas: art.canvas } : null);
    }
    return { pic: pictures.get(p.key), scale: d.size / p.size };
  };
  const dropRegion = (r) => {
    dropContactBake(r);
    for (const s of r.sprites) { try { s.parent?.removeChild(s); s.destroy({ children: true }); } catch { /* gone with the canvas */ } }
    r.sprites = [];
    if (r.snow) { try { r.snow.mesh.parent?.removeChild(r.snow.mesh); r.snow.mesh.destroy(); for (const t of r.snow.textures) t.destroy(true); } catch { /* gone */ } r.snow = null; }
    // The last region to leave a floor takes its three blurred layers with it: an empty one is a pass for nothing.
    if (r.floor) { r.floor.count = Math.max(0, r.floor.count - 1); if (!r.floor.count) dropFloor(r.floor); r.floor = null; }
    r.contact = null; r.castLayer = null; r.lampLayer = null;
  };
  // What moves in the wind and how: cloth by its mask; plants and tree crowns from their middle out.
  const SWAY = { paper: { radial: 0, amp: 0.8, shade: 2.2, speed: 1.3, edge: 1 }, cloth: { radial: 0, amp: 0.35, shade: 2.6, speed: 0.8 }, plant: { radial: 1, amp: 1.5, shade: 0.35, speed: 0.7 }, crown: { radial: 1, amp: 0.6, shade: 0.25, speed: 0.45 } };
  const clothMesh = (pic, d, scale, mode = 'cloth') => {
    const w = pic.art.width, h = pic.art.height, geometry = new PIXI.Geometry().addAttribute('aVertexPosition', [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2], 2).addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(CLOTH_VERT, CLOTH_FRAG, { uArt: pic.art, uCloth: pic.cloth ?? PIXI.Texture.WHITE, uTime: 0, uPush: 0, uSeed: ((d.seed >>> 0) % 997) / 97, uDir: [1, 0], uAlpha: 1, uRadial: SWAY[mode].radial, uAmp: SWAY[mode].amp, uShade: SWAY[mode].shade, uSpeed: SWAY[mode].speed, uEdge: SWAY[mode].edge ?? 0 }));
    mesh.position.set(d.x, d.y); mesh.rotation = turnOf(d); mesh.scale.set(scale, scale); mesh.eventMode = 'none'; mesh.decor = d; mesh.texture = pic.art; return mesh;
  };
  const place = (sprite, d, pic, scale) => { sprite.anchor.set(0.5); sprite.position.set(d.x, d.y); sprite.rotation = turnOf(d); const k = scale; sprite.scale.set((d.flip && DECOR_KINDS[d.kind]?.flat ? -1 : 1) * (d.mirror ? -1 : 1) * k, k * (d.squash ?? 1)); sprite.eventMode = 'none'; return sprite; };
  const aim = (r) => {
    // A region under cover takes no sun at all, however bright it is outside: a table standing in a room threw its
    // shadow across the floor as though the ceiling were not there. Whether a region is under cover is the caller's
    // to say — only it knows what counts as a roof on this scene — and it travels with the region (`indoors`). The
    // lamps' own shadows are unaffected: those are what a room indoors is lit by.
    const lit = r.indoors === true ? null : sun;
    // Each standing one's shadow away from the sun or moon, stretched by how tall it stands; a tree's only when the canopy is not drawing it.
    for (const s of r.shadowSprites) {
      const d = s.decor, k = DECOR_KINDS[d.kind], cast = lit && lit.strength > 0 && !(k?.tree && canopyTrees) && d.indoors !== true;
      s.visible = !!cast; if (!cast) continue;
      const reach = shadowReach(decorHeight(d), lit.length, grid()), w = s.texture.width * Math.abs(s.baseScale);
      s.position.set(d.x + Math.cos(lit.angle) * reach * 0.5, d.y + Math.sin(lit.angle) * reach * 0.5);
      // Stretched along the way it falls: a child rotated to the sun inside, the silhouette turned back to the decoration's own way.
      s.rotation = lit.angle; s.scale.set((1 + reach / Math.max(w, 1) * 0.9), 1); s.inner.rotation = turnOf(d) - lit.angle;
    }
    // How strong the cast shadows are is the floor's, not this region's: laid on once over all of them, so two strokes
    // standing side by side cast one shadow's worth of dark where they fall together.
    if (r.floor) r.floor.cast.alpha = sun ? Math.min(0.6, sun.strength) : 0;
  };
  // One decoration drawn into a region's layers, keeping hold of what it made (`r.drawn`) so that one can be taken away on
  // its own. The brush adds to a region dab by dab; without this the whole region — every sprite, every shadow — was thrown
  // away and built again ten times a second, which is what made painting into a full region stutter.
  // The light on the tiles drawn lit (props()): the sun or moon, unless it stands under a roof, and the lamps near it.
  let lampsNow = [];
  const relight = (r) => { if (!r?.lit?.length) return; const g = grid(); for (const m of r.lit) { try { aimLit(m, litUniforms({ at: m.decor, sun: m.indoors ? null : sun, lamps: lampsNow, grid: g })); } catch { /* gone with the canvas */ } } };
  const drawOne = (d, r, look, where, g, contact, cast) => {
    const role = decorRole(d, where); if (!role || role === 'cavern') return null;
    // (Standing ones take their snow from the snow layer over them, flat ones the ground's lying over them; a tree's crown has its own painted.)
    const seenLook = role !== 'tree' && render ? { ...look, snow: 0 } : look; r.pictures.add(pictureOf(d, seenLook).key);
    const { pic, scale } = picture(d, seenLook); if (!pic) return null;
    const mine = { d, inLayers: [], inShadows: [] };
    if (pic.shadow && role !== 'flat') {
      // The baked picture of this region's feet is a picture of the region as it was: one more foot and it is stale.
      dropContactBake(r);
      const foot = place(new PIXI.Sprite(pic.shadow), d, pic, scale); foot.tint = 0x06070c; foot.position.set(d.x + g * 0.02, d.y + g * 0.03); foot.scale.set(foot.scale.x * 1.06, foot.scale.y * 1.06); contact.addChild(foot);
      // The cast one: an outer holder turned to the sun (to stretch), the silhouette inside turned to the decoration's own way.
      const holder = new PIXI.Container(), inner = new PIXI.Container(), sil = place(new PIXI.Sprite(pic.shadow), d, pic, scale); sil.position.set(0, 0); sil.rotation = 0; sil.tint = 0x06070c;
      inner.addChild(sil); holder.addChild(inner); holder.decor = d; holder.inner = inner; holder.baseScale = sil.scale.x; holder.texture = pic.shadow; cast.addChild(holder); r.shadowSprites.push(holder);
      const caster = { d, pic, scale, height: decorHeight(d), shadows: [] }; r.casters.push(caster);
      // Where this region's shadows are, kept as they are drawn, for the layers that can be left undrawn off screen.
      // (It only ever grows: one taken away leaves the box as it was, which can keep a layer drawn but never hide one.)
      r.box = boxWith(r.box, d, d.size * g * 0.7); r.tall = Math.max(r.tall ?? 0, decorHeight(d));
      mine.inShadows.push(foot, holder); mine.caster = caster;
    }
    if (role === 'tree') {
      if (pic.trunk) { const trunk = ground().addChild(place(new PIXI.Sprite(pic.trunk), d, pic, scale)); r.sprites.push(trunk); mine.inLayers.push(trunk); }
      const crown = above().addChild(where !== 'cave' && PIXI.Mesh ? clothMesh(pic, d, scale, 'crown') : place(new PIXI.Sprite(pic.art), d, pic, scale)); crown.decor = d; r.crowns.push(crown); r.sprites.push(crown); if (crown.shader) r.cloth.push(crown);
      mine.inLayers.push(crown);
    // Flat ones (moss, flowers, a puddle's mud) lie on the ground itself, under the lying snow; the rest stand over it.
    } else if (DECOR_KINDS[d.kind].cloth && pic.cloth && where !== 'cave' && PIXI.Mesh) { const mesh = (role === 'flat' ? flat() : ground()).addChild(clothMesh(pic, d, scale, DECOR_KINDS[d.kind].cloth === 'paper' ? 'paper' : 'cloth')); r.sprites.push(mesh); r.cloth.push(mesh); mine.inLayers.push(mesh); }
    else if (PLANTS.has(d.kind) && where !== 'cave' && PIXI.Mesh) { const mesh = (role === 'flat' ? flat() : ground()).addChild(clothMesh(pic, d, scale, 'plant')); r.sprites.push(mesh); r.cloth.push(mesh); mine.inLayers.push(mesh); }
    else { const sprite = (role === 'flat' ? flat() : ground()).addChild(place(new PIXI.Sprite(pic.art), d, pic, scale)); r.sprites.push(sprite); mine.inLayers.push(sprite); }
    r.drawn.push(mine);
    return mine;
  };
  // One decoration taken off the map again, leaving the rest of its region standing (a scatter the brush has just covered).
  const dropOne = (r, mine) => {
    dropContactBake(r);
    const gone = new Set([...mine.inLayers, ...mine.inShadows]);
    for (const o of gone) { try { o.parent?.removeChild(o); o.destroy({ children: true }); } catch { /* gone with the canvas */ } }
    r.sprites = r.sprites.filter((s) => !gone.has(s));
    r.shadowSprites = r.shadowSprites.filter((s) => !gone.has(s));
    r.crowns = r.crowns.filter((s) => !gone.has(s));
    r.cloth = r.cloth.filter((s) => !gone.has(s));
    if (mine.caster) r.casters = r.casters.filter((c) => c !== mine.caster);
    r.drawn = r.drawn.filter((m) => m !== mine);
    r.shown = r.shown.filter((d) => d !== mine.d);
  };
  // A scattered decoration the brush has just put something over: decor-regions' own rule (`clear`), so what a stroke clears
  // as it goes is what the finished region keeps.
  const covers = (hand, d, g) => !DECOR_KINDS[d.kind].flat && !DECOR_KINDS[hand.kind].flat
    && (hand.x - d.x) ** 2 + (hand.y - d.y) ** 2 <= ((hand.size + d.size) * g * 0.42) ** 2;
  // Which of the drawn are the GM's own (the region's Size and a kind's size scale one, so it is told by kind, place and seed):
  // a dab covers the scatter, never another decoration somebody placed.
  const handKey = (d) => `${d.kind}:${Math.round(d.x)}:${Math.round(d.y)}:${d.seed}`;
  return {
    /** A sprite of one decoration's picture, placed and turned as it would stand (for the brush's ghost), or null. */
    sprite(d, look = {}) { const { pic, scale } = picture(d, look); return pic?.art ? place(new PIXI.Sprite(pic.art), d, pic, scale) : null; },
    /** One decoration's painted picture, for its wreck: the shared texture, the canvas it was painted on, its drawn width and picture key; or null. */
    art(d, look = {}) { const { pic, scale } = picture(d, look); return pic?.art ? { texture: pic.art, canvas: pic.canvas, width: pic.art.width * scale, key: pictureOf(d, look).key } : null; },
    sync(list = []) {
      const seen = new Set(), g = grid();
      for (const spec of list) {
        seen.add(spec.id);
        // (The switch that lets them break and the region's breaking options draw nothing: changing them never rebuilds. A break
        // does, from the cached pictures. The options are kept on the region for its lights, below.)
        const { canBreak: _switch, prop: _options, ...drawn } = spec.settings ?? {};
        // (An area's holes are a property of its array, which JSON drops: written out, so a new hole rebuilds too.)
        const shape = (spec.areas ?? []).map((a) => [Array.from(a), a.holes ?? []]);
        const key = JSON.stringify([drawn, shape, lookKey(spec), g, spec.broken ?? [], !!spec.live]), had = regions.get(spec.id);
        if (had?.key === key) { had.prop = spec.settings?.prop; continue; }
        // What the region is apart from what the brush has laid by hand: while a stroke paints, this is all that must match
        // for the dabs so far to stand as they are.
        const { brushed: fresh = [], ...rest } = drawn;
        const restKey = JSON.stringify([rest, shape, lookKey(spec), g, spec.broken ?? [], !!spec.live]);
        // A stroke adding to what it has already laid (the brush pushes onto one array; rubbing out makes a new one): draw
        // only the new dabs and clear what they cover, rather than building the whole region again on every dab.
        if (spec.live && had?.restKey === restKey && had.brushedRef === fresh && fresh.length > had.brushedCount) {
          at = spec;
          const added = fresh.slice(had.brushedCount), hidden = new Set(spec.settings?.off ?? []);
          const grow = (d) => (spec.settings?.scale ?? 1) * (spec.settings?.kinds?.[d.kind]?.size ?? 1);
          const tall = (d) => ((spec.settings?.height ?? 1) === 1 ? d : { ...d, tall: +((d.tall ?? 1) * spec.settings.height).toFixed(3) });
          for (const raw of added) {
            if (hidden.has(raw.kind) || !DECOR_KINDS[raw.kind]) continue;
            const d = tall(grow(raw) === 1 ? raw : { ...raw, size: +(raw.size * grow(raw)).toFixed(3) });
            for (const mine of [...had.drawn]) if (!mine.hand && covers(d, mine.d, g)) dropOne(had, mine);
            had.shown.push(d); had.placements.push(d);
            // (It goes on top of what is already drawn: a stroke's own order, which settles into the region's when it ends.)
            const mine = drawOne(d, had, spec.look, had.where, g, had.contact, had.castLayer);
            if (mine) mine.hand = true;
          }
          had.key = key; had.restKey = restKey; had.brushedCount = fresh.length; had.prop = spec.settings?.prop;
          // A room can be roofed or opened while the map is up, so this is taken again rather than kept from before.
          had.indoors = spec.indoors === true;
          aim(had); if (!spec.live) bakeContact(had); at = null;
          continue;
        }
        if (had) dropRegion(had);
        at = spec;
        const { placements, shown } = decorShown(spec, g), where = spec.settings?.where ?? 'surface';
        const r = { key, restKey, brushedRef: fresh, brushedCount: fresh.length, placements: [...placements], shown: [...shown], where, look: spec.look, prop: spec.settings?.prop, indoors: spec.indoors === true, sprites: [], shadowSprites: [], crowns: [], cloth: [], castLayer: null, contact: null, floor: null, drawn: [], pictures: new Set(), box: null, tall: 0, baked: null };
        // Shadows: the soft dark at each standing one's foot whatever the light, the cast ones, and the lights' ones
        // (filled as the lights near them are told, lamps()). This region's own three, with nothing on them: the blur
        // and the strength belong to the floor they go into, so every region on that floor shares one of each.
        const floor = floorOf(), contact = new PIXI.Container(), cast = new PIXI.Container(), lampLayer = new PIXI.Container();
        for (const c of [contact, cast, lampLayer]) c.eventMode = 'none';
        r.floor = floor; r.contact = contact; r.castLayer = cast; r.lampLayer = lampLayer; r.casters = [];
        const byHand = new Set(fresh.map(handKey));
        for (const d of shown) { const mine = drawOne(d, r, spec.look, where, g, contact, cast); if (mine && byHand.has(handKey(d))) mine.hand = true; }
        floor.contact.addChild(contact); floor.cast.addChild(cast); floor.lamp.addChild(lampLayer); floor.count++; r.sprites.push(contact, cast, lampLayer);
        // Snow on the standing ones (not underground). (A tree's crown carries its own, painted, as it opens over the creatures.)
        // (Not while a stroke still paints it (`live`): baked once, when the stroke ends.)
        if (where !== 'cave' && !spec.live) { const standing = shown.filter((d) => decorRole(d, where) === 'standing' && !DECOR_KINDS[d.kind].light).map((d) => ({ d, ...picture(d, { ...spec.look, snow: 0 }) })).filter((it) => it.pic); try { r.snow = bakeSnow(r, standing); } catch (err) { console.warn('Animater | decoration snow', err); } }
        regions.set(spec.id, r); aim(r); if (!spec.live) bakeContact(r); at = null;
      }
      for (const [id, r] of regions) if (!seen.has(id) && id !== PROPS) { dropRegion(r); regions.delete(id); }
      // (Pictures for looks no longer shown let go once there are many: out of PIXI's cache, not destroyed, so a wreck or the
      // brush's ghost still holding one keeps it. Kept for good till the scene closed, a season, the wet, night and snow each
      // made a whole new set: the audit's finding.)
      if (pictures.size > PICTURES_KEPT) { const used = new Set(); for (const r of regions.values()) for (const k of r.pictures ?? []) used.add(k); for (const [k, p] of pictures) { if (used.has(k)) continue; pictures.delete(k); for (const t of [p?.art, p?.shadow, p?.trunk, p?.cloth]) { try { if (t) { PIXI.Texture.removeFromCache?.(t); PIXI.BaseTexture.removeFromCache?.(t.baseTexture); } } catch { /* gone */ } } } }
    },
    /**
     * The scene's tiles that stand on the map as things — a barrel, a cart, a bush somebody else painted — given what the
     * painted decorations have: the dark at the foot, a shadow from the sun or moon that turns and lengthens with it, one
     * from each lamp near, the ground's snow lying on top, and rain's darkening. Nothing of a tile is changed: its picture
     * is drawn once more over its shadows (which lie over the tiles), and the shadows are that same picture made dark.
     * 'list' [{ id, texture, x, y (its middle), width, height (as drawn; negative: mirrored), rotation (radians), high
     * (squares; 0 casts nothing), alpha, indoors (under a roof: no sun shadow), art (another picture of it to draw, as a
     * bush in autumn), snowless (a fire), maps (its relief, decor-from-art.mjs reliefPixels: with it the light falls
     * across it — its iron glints toward the sun and a torch) }]; 'wet' 0-1; 'shade' 0-1 how much of the light's shading
     * across its form is laid on beside the glints (none by default: a painted picture has its own).
     */
    props(list = [], { wet = 0, shade = 0 } = {}) {
      const g = grid(), soaked = Math.max(0, Math.min(1, Number(wet) || 0)), form = Math.max(0, Math.min(1, Number(shade) || 0));
      const shown = list.filter((p) => p?.texture && !p.texture.destroyed && p.texture.width > 0 && p.texture.height > 0 && Math.abs(p.width) > 0 && Math.abs(p.height) > 0);
      const key = JSON.stringify([shown.map((p) => [p.id, Math.round(p.x), Math.round(p.y), Math.round(p.width), Math.round(p.height), +(Number(p.rotation) || 0).toFixed(3), +(Number(p.high) || 0).toFixed(2), p.alpha ?? 1, !!p.indoors, !!p.snowless]), g, soaked, form]);
      const had = regions.get(PROPS), same = (a, b) => a.length === b.length && a.every((t, i) => t === b[i]), textures = shown.flatMap((p) => [p.texture, p.art ?? null, p.maps ?? null]);
      if (had?.key === key && same(had.textures, textures)) return;
      if (had) { dropRegion(had); regions.delete(PROPS); }
      if (!shown.length) return;
      at = null;
      const r = { key, textures, placements: [], shown: [], where: 'surface', look: {}, prop: undefined, indoors: false, sprites: [], shadowSprites: [], crowns: [], cloth: [], castLayer: null, contact: null, floor: null, drawn: [], pictures: new Set(), box: null, tall: 0, baked: null, casters: [], lit: [] };
      const floor = floorOf(), contact = new PIXI.Container(), cast = new PIXI.Container(), lampLayer = new PIXI.Container();
      for (const c of [contact, cast, lampLayer]) c.eventMode = 'none';
      r.floor = floor; r.contact = contact; r.castLayer = cast; r.lampLayer = lampLayer;
      // (Wet: a touch darker and bluer, as the painted ones go.)
      const dry = 255 - Math.round(51 * soaked), tint = ((dry - Math.round(5 * soaked)) << 16) | (dry << 8) | Math.min(255, dry + Math.round(8 * soaked)), snowed = [];
      for (const p of shown) {
        const sx = p.width / p.texture.width, sy = p.height / p.texture.height, scale = Math.abs(sx);
        const d = { x: p.x, y: p.y, turn: Number(p.rotation) || 0, fixed: true, size: Math.max(Math.abs(p.width), Math.abs(p.height)) / g, high: Math.max(0, Number(p.high) || 0), squash: sy / scale, seed: 0, ...(sx < 0 ? { mirror: true } : {}), ...(p.indoors ? { indoors: true } : {}) };
        const pic = { art: p.art ?? p.texture, shadow: p.texture };
        if (d.high > 0) {
          const foot = place(new PIXI.Sprite(pic.shadow), d, pic, scale); foot.tint = 0x06070c; foot.position.set(d.x + g * 0.02, d.y + g * 0.03); foot.scale.set(foot.scale.x * 1.06, foot.scale.y * 1.06); contact.addChild(foot);
          const holder = new PIXI.Container(), inner = new PIXI.Container(), sil = place(new PIXI.Sprite(pic.shadow), d, pic, scale); sil.position.set(0, 0); sil.rotation = 0; sil.tint = 0x06070c;
          inner.addChild(sil); holder.addChild(inner); holder.decor = d; holder.inner = inner; holder.baseScale = sil.scale.x; holder.texture = pic.shadow; cast.addChild(holder); r.shadowSprites.push(holder);
          r.casters.push({ d, pic, scale, height: d.high, shadows: [] });
          r.box = boxWith(r.box, d, d.size * g * 0.7); r.tall = Math.max(r.tall, d.high);
          if (!p.snowless) snowed.push({ d, pic, scale });
        }
        // With its relief it is drawn lit (decor-lit.mjs): placed as its sprite would be, its lights handed to it by light() and lamps().
        const lit = p.maps && !p.maps.destroyed && PIXI.Mesh && PIXI.Geometry && PIXI.Shader ? createLitMesh(PIXI, { art: pic.art, maps: p.maps, relief: 8, mirror: !!d.mirror, shade: form, glint: 2.4, tint: [((tint >> 16) & 255) / 255, ((tint >> 8) & 255) / 255, (tint & 255) / 255] }) : null;
        if (lit) { lit.position.set(d.x, d.y); lit.rotation = d.turn; lit.scale.set((d.mirror ? -1 : 1) * scale, scale * d.squash); lit.decor = d; lit.indoors = d.indoors === true; r.lit.push(lit); }
        const sprite = ground().addChild(lit ?? place(new PIXI.Sprite(pic.art), d, pic, scale)); sprite.alpha = Math.max(0, Math.min(1, Number(p.alpha ?? 1))); if (!lit) sprite.tint = tint; r.sprites.push(sprite);
      }
      floor.contact.addChild(contact); floor.cast.addChild(cast); floor.lamp.addChild(lampLayer); floor.count++; r.sprites.push(contact, cast, lampLayer);
      try { r.snow = bakeSnow(r, snowed); } catch (err) { console.warn('Animater | tile snow', err); }
      regions.set(PROPS, r); aim(r); relight(r); bakeContact(r);
    },
    // snowAmount 0-1: how much snow lies now (as the ground's), its light from the same sun or moon (moon: its cooler colour).
    light({ sun: now = null, treesByCanopy = false, snowAmount = 0, moon = false } = {}) {
      sun = now; canopyTrees = treesByCanopy;
      snow = { amount: Math.max(0, Math.min(1, Number(snowAmount) || 0)), toSun: now ? [Math.cos(now.angle + Math.PI), Math.sin(now.angle + Math.PI)] : [0, 0], z: now ? Math.max(0, Math.min(1, now.strength)) : 0, low: now ? Math.min(2.25, Math.max(0.35, now.length)) : 1, color: moon ? [0.72, 0.8, 1] : [1, 0.97, 0.9] };
      for (const r of regions.values()) { aim(r); relight(r); if (r.snow) { snowUniforms(r.snow.uniforms); r.snow.mesh.visible = snow.amount > 0.01; } }
    },
    // The lights now ([{ x, y, radius, strength (against the sky) }]): each standing decoration near one throws a shadow away
    // from it, the two nearest lights each. A few times a second, as lights move with the creatures carrying them.
    lamps(list = []) {
      const g = grid(), lights = list.filter((l) => l && l.radius > 0 && (l.strength ?? 1) > 0.03);
      lampsNow = lights.map((l) => ({ x: l.x, y: l.y, radius: l.radius, strength: l.strength ?? 1, color: l.color ?? [1, 0.74, 0.46], height: g * LAMP_HEIGHT * 0.6 })); relight(regions.get(PROPS));
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
    /** The wind now: strength 0-1, blowing toward angle (radians). Awnings, tents and washing stir in it (not underground). */
    wind({ strength = 0, angle = 0 } = {}) { air = { strength: Math.max(0, Math.min(1, Number(strength) || 0)), angle: Number(angle) || 0 }; },
    creatures(list = []) { const g = grid(); for (const r of regions.values()) for (const c of r.crowns) open.set(c, crownOpen(c.decor, list, g)); },
    // `view` what is on the screen now ({ x, y, w, h } on the map), for the shadow layers that need not be drawn.
    tick(seconds, view = null) {
      // The shadow layers. Each region has three of its own — the dark at each foot, the cast shadows, the lamps' —
      // and the floor they stand on has the three that carry the blur. A region with nothing standing in it, and one
      // well off the side of the screen, are drawings paid for nothing; a floor whose regions are all in that state,
      // or whose layer is turned right down (no sun on the cast shadows), is a whole blur pass paid for nothing.
      // Each comes back by itself as the view nears it again.
      const g = grid();
      for (const r of regions.values()) {
        const near = g * 0.5, cast = near + shadowReach(r.tall ?? 1, sun?.length ?? 0, g), lamp = Math.max(cast, near + g * 2);
        const show = (layer, margin) => { if (layer) layer.renderable = shadowLayerShown({ count: layer.children.length, alpha: layer.alpha, box: r.box }, view, margin); };
        show(r.contact, near); show(r.castLayer, cast); show(r.lampLayer, lamp);
        // The baked picture of the feet goes the same way: one quad, but one off the side of the screen all the same.
        if (r.baked?.sprite) r.baked.sprite.renderable = shadowLayerShown({ count: 1, alpha: r.baked.sprite.alpha, box: r.box }, view, near);
      }
      for (const f of floors.values()) { f.contact.renderable = floorLayerShown(f.contact); f.cast.renderable = floorLayerShown(f.cast); f.lamp.renderable = floorLayerShown(f.lamp); }
      // A crown eases open over a creature and closes again after it has gone (a third of a second either way).
      const rate = Math.min(1, seconds * 3);
      for (const r of regions.values()) for (const c of r.crowns) { const want = 1 - 0.75 * (open.get(c) ?? 0); c.alpha += (want - c.alpha) * rate; }
      // Cloth in the wind: its fabric rippling along it, in gusts, each piece out of step with the next; still in a calm.
      // (A frame's worth at most: back from a hidden or minimised window the sway carries on where it was, never racing to catch up.)
      clock += Math.min(0.1, Math.max(0, Number(seconds) || 0));
      for (const r of regions.values()) for (const s of r.cloth) { const m = clothMotion(s.decor, air, clock, s.rotation), u = s.shader.uniforms; u.uTime = clock; u.uPush = m.push; u.uDir = m.dir; u.uAlpha = s.alpha; }
    },
    // The trees on fire now, told ahead of trees() (a Set of burningDecorIds; none clears it).
    burning(ids) { litTrees = ids ?? null; },
    // The trees for the canopy's shade: each crown's picture where it stands, its height, kind and leaves.
    // `burning`: ids (decor-break burningDecorIds) of the trees on fire, whose shade thins and whose leaves fall fewer. (A broken tree has no crown left to list.)
    // `burning` may be given here, else the set last told by burning() is used (so the canopy's feed keeps its plain `trees()` call).
    trees({ burning = litTrees } = {}) {
      const out = [];
      for (const [id, r] of regions) for (const c of r.crowns) {
        const d = c.decor, k = canopyKindOf(d.kind, r.look?.season); if (!k) continue;
        out.push(treeFeed({ d, crown: { texture: c.texture, width: c.texture.width * Math.abs(c.scale.x), height: c.texture.height * Math.abs(c.scale.y), rotation: c.rotation }, region: id, kind: k, burning }));
      }
      return out;
    },
    // The water of each puddle and pool, for the water engine: its id, outline and how deep it looks.
    water() {
      const out = [];
      for (const [id, r] of regions) r.placements.forEach((d, i) => { if (!DECOR_KINDS[d.kind].water) return; const o = waterOutline(d, grid(), r.look ?? {}); if (o) out.push({ id: `decor:${id}:${i}`, areas: [o], deep: r.where === 'cave' }); });
      return out;
    },
    // The lights the decorations carry (a lamp post's lantern, a brazier's fire, candles): where each stands and its light, scaled
    // with the decoration's size, for real light sources on the map. A broken one (not shown) is out until it is repaired;
    // the ids still count through every placement, so the others keep theirs.
    lights() {
      const out = [];
      for (const [id, r] of regions) out.push(...decorLightList(id, r.placements, r.shown, r.prop));
      return out;
    },
    // What the cavern and the webs draw in place of their paintings, underground: a small round area each. A broken cobweb's
    // area comes too, apart (websGone): the web engine lays out every corner with it, then leaves its web out, so taking one
    // web away never moves, adds or lengthens another (its corners share one seeded stream).
    cavern() {
      const out = { fungus: [], crystals: [], lava: [], webs: [], websGone: [] }, ring = (x, y, rad) => Array.from({ length: 12 }, (_, i) => [x + Math.cos(i / 12 * 6.283) * rad, y + Math.sin(i / 12 * 6.283) * rad]).flat();
      const TONES = { fungus: ['green', 'blue', 'violet'], crystals: ['amethyst', 'quartz', 'rose'] };
      for (const r of regions.values()) if (r.where === 'cave') { const standing = r.shown === r.placements ? null : new Set(r.shown); for (const d of r.placements) {
        const what = CAVERN_KINDS[d.kind]; if (!what) continue;
        if (standing && !standing.has(d)) { if (what === 'webs') out.websGone.push(ring(d.x, d.y, d.size * grid() * 1.2)); continue; }
        const g = grid(), area = ring(d.x, d.y, d.size * g * (what === 'webs' ? 1.2 : 0.5)), scale = d.size / DECOR_KINDS[d.kind].size;
        if (what === 'fungus') out.fungus.push({ areas: [area], color: TONES.fungus[d.seed % 3], scale });
        else if (what === 'crystals') out.crystals.push({ areas: [area], stone: TONES.crystals[d.seed % 3], scale });
        else if (what === 'lava') out.lava.push({ areas: [area], heat: 0.7 });
        else out.webs.push(area);
      } }
      return out;
    },
    get count() { let n = 0; for (const r of regions.values()) n += r.placements.length; return n; },
    get busy() { return regions.size > 0; },
    clear() { for (const r of regions.values()) dropRegion(r); regions.clear(); for (const f of [...floors.values()]) dropFloor(f); open = new Map(); for (const p of pictures.values()) for (const t of [p?.art, p?.shadow, p?.trunk, p?.cloth]) { try { t?.destroy(true); } catch { /* gone */ } } pictures.clear(); },
  };
}
