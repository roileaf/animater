// Sunlight past overhead tiles: trees cast dappled shade on the ground away from the sun (or moon), broken by sun
// flecks that drift and wink as the leaves move; roofs cast a building's solid shadow outside and let light in only
// through their holes. Which tiles do what and where their shade falls is pure; the light is drawn by one shader over
// the map (createCanopyLight).
import { sunReach } from './sun.mjs';

// Words in a tile's file name that say it is a tree (the big asset packs name their trees so).
const TREE = /(?:^|[^a-z])(trees?|canop(?:y|ies)|foliage|leaf|leaves|bush(?:es)?|shrubs?|oak|pine|palm|willow|birch|maple|elm|ash_?tree|cedar|cypress|spruce|fir|redwood|sequoia|baobab|mangrove|forest|woods|jungle|grove|orchard|hedge|ivy|vines?)(?=$|[^a-z])/i;
// An Auto tile that is this opaque inside its outline reads as a roof, whatever its name.
const OPAQUE = 0.95;
// Words that say a tile is a building's top (a roof, a tent, a tower), for its shadow.
const BUILDING = /(?:^|[^a-z])(roofs?|rooftops?|house|houses|home|building|hut|cabin|cottage|shack|barn|shed|stable|mill|tower|keep|castle|fort|temple|church|chapel|shrine|tavern|inn|shop|store|smithy|forge|hall|manor|mansion|tent|pavilion|awning|gazebo|bridge|outhouse|warehouse|granary|lighthouse|ceiling)(?=$|[^a-z])/i;
// An Auto tile drawn this solid (a roof seen from above), unnamed, still casts a building's shadow.
const ROOF_SOLID = 0.85;

const nameOf = (src) => decodeURIComponent(String(src ?? '').split(/[?#]/)[0].split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '');

/**
 * How much of a tile's picture is solid (0–1), from its alpha read small (`pixels`: RGBA bytes), counting only inside
 * its drawn outline (rows and columns with anything in them); null when unreadable.
 */
export function solidShare(pixels, size = 32) {
  if (!pixels?.length) return null;
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (pixels[(y * size + x) * 4 + 3] > 24) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (maxX < 0) return 0;
  let solid = 0, all = 0;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { all++; if (pixels[(y * size + x) * 4 + 3] > 200) solid++; }
  return all ? solid / all : null;
}

export const SUNLIGHT_KINDS = Object.freeze(['tree', 'roof', 'none']);
/**
 * What an overhead tile does with the sun: 'tree' (its leaves let light through: dappled shade), 'roof' (a building's
 * top: a solid shadow outside, light only through its holes), or null (nothing: a fog or bird tile). Its own choice
 * (Tile configuration → Animater → Sunlight) decides. Auto: a tile above the floor named as a tree is one, unless its
 * picture is a solid block (then a roof); one that keeps out the light or the weather (`restricts`: Foundry's own mark
 * of a roof), named as a building, or drawn solid, is a roof. Its shape alone never makes a tree: a broken roof is
 * ragged too.
 */
export function tileSunlight({ src, choice, overhead = false, solid = null, restricts = false } = {}) {
  if (SUNLIGHT_KINDS.includes(choice)) return choice === 'none' ? null : choice;
  if (!overhead) return null;
  const name = nameOf(src), block = Number.isFinite(solid) && solid >= OPAQUE;
  if (TREE.test(name)) return block ? 'roof' : 'tree';
  return restricts || BUILDING.test(name) || (Number.isFinite(solid) && solid >= ROOF_SOLID) ? 'roof' : null;
}

// How thick a tree's leaves are (0–1 of its picture's shade): its own choice (Tile configuration → Animater → Leaves),
// else by what it is called, else by how many gaps its picture has (`solid`: solidShare's). Sparse leaves cast a lighter
// shade, full of flecks; dense ones a deep shade with few.
export const LEAVES = Object.freeze({ sparse: 0.55, medium: 0.8, dense: 1 });
const SPARSE = /(?:^|[^a-z])(birch|willow|palm|olive|aspen|acacia|jacaranda|dead|bare|leafless|autumn)(?=$|[^a-z])/i;
const DENSE = /(?:^|[^a-z])(oak|pine|spruce|fir|cedar|yew|jungle|redwood|sequoia|cypress|hedge|evergreen|banyan|mangrove)(?=$|[^a-z])/i;
export function tileLeaves({ src, own = null, solid = null } = {}) {
  if (LEAVES[own]) return LEAVES[own];
  const name = nameOf(src);
  if (SPARSE.test(name)) return LEAVES.sparse;
  if (DENSE.test(name)) return LEAVES.dense;
  // A picture with many gaps is a thin crown; a full one a thick crown.
  if (Number.isFinite(solid)) return solid < 0.6 ? LEAVES.sparse : solid > 0.85 ? LEAVES.dense : LEAVES.medium;
  return LEAVES.medium;
}

// A tree's usual height by what it is called, in feet: a tall one, a bush or hedge, else a tree's.
const TALL = /(?:^|[^a-z])(oak|pine|redwood|sequoia|cedar|spruce|fir|cypress|baobab|willow|elm|maple|ash_?tree)(?=$|[^a-z])/i;
const LOW = /(?:^|[^a-z])(bush(?:es)?|shrubs?|hedge|ivy|vines?|leaf|leaves|foliage)(?=$|[^a-z])/i;
const TREE_FEET = { tall: 30, low: 6, usual: 25 };
/**
 * How tall an overhead tile stands for its shade, in squares: its own Height (Tile configuration → Animater, in the
 * scene's units; `own`), else a roof's level (a building as tall as its storey: `level` { bottom, top } in the same
 * units), else a tree's by its name. `per`: the scene's units in a square; `foot`: a foot in squares.
 */
export function tileHeight({ kind, src, own = null, level = null, per = 5, foot = 0.2 } = {}) {
  const units = Number(own);
  if (own !== null && own !== '' && Number.isFinite(units) && units > 0) return units / (Number(per) || 5);
  if (kind === 'roof') {
    const storey = (Number(level?.top) || 0) - (Number(level?.bottom) || 0);
    return storey > 0 && Number.isFinite(storey) ? storey / (Number(per) || 5) : 20 * foot;
  }
  const name = nameOf(src);
  return (TALL.test(name) ? TREE_FEET.tall : LOW.test(name) ? TREE_FEET.low : TREE_FEET.usual) * foot;
}

/**
 * Where the canopy's shade falls and how it looks, from the sun (sun.mjs: { angle toward it in degrees, height in
 * degrees, strength, moon }). `height`: the canopy's height above the floor in squares. Null when there is no light to
 * cast it. `shift`: the shade's offset in pixels away from the light; `dir` that way as a unit vector; `stretch`: how
 * long the flecks are drawn along it (round under a high sun, long at dusk).
 */
export function canopyFall(sun, { height = 3, grid = 100, darkness = 0 } = {}) {
  if (!sun) return null;
  const light = (sun.moon ? 1 : Math.max(0, 1 - (Number(darkness) || 0) * 1.2)) * Math.max(0, Math.min(1, Number(sun.strength) || 0));
  if (!(light > 0.02)) return null;
  const away = ((Number(sun.angle) || 0) + 180) * Math.PI / 180, dir = [Math.cos(away), Math.sin(away)];
  const reach = Math.min(6 * grid, sunReach(Math.max(0.5, Number(height) || 0) * grid, sun.height));
  const up = Math.max(3, Math.min(89, Number(sun.height) || 0)) * Math.PI / 180;
  return { shift: [dir[0] * reach, dir[1] * reach], dir, stretch: Math.min(3, 1 / Math.sin(up)), light };
}


const VERT = `
precision highp float;
attribute vec2 aVertexPosition; attribute vec2 aUvs;
uniform mat3 translationMatrix, projectionMatrix;
varying vec2 vUv;
void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
// One pass draws the shade (uMode 0, over the map), one the light (uMode 1, added): the trees' flecks and the sun through
// holes in roofs. Masks, each baked soft over the scene: the trees' leaves and the roofs where their shade falls (each
// tile moved away from the sun by its own height), the roofs where they stand and the ground each covers (its whole
// tile), and indoors (the regions that keep the weather out).
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTrees, uTreesAt, uRoofCast, uRoofs, uRoofArea, uIndoor;
uniform vec2 uSize, uShift, uRoofShift, uDir, uWindDir;
uniform float uTime, uWind, uStrength, uStretch, uGrid, uMode, uHasTrees, uHasRoofs, uRoofShade, uLeafRate;
uniform vec3 uColor, uShade, uLeafA, uLeafB;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float at(sampler2D map, vec2 px){ vec2 uv = px / uSize; return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : texture2D(map, uv).a; }
float flecks(vec2 src, vec2 px, float t){
  vec2 sway = vec2(sin(t * 1.3 + px.y * 0.004), cos(t * 1.1 + px.x * 0.005)) * uGrid * (0.02 + 0.1 * uWind);
  vec2 side = vec2(-uDir.y, uDir.x);
  vec2 q = vec2(dot(src + sway, uDir) / uStretch, dot(src + sway, side));
  float cell = uGrid * 0.34, best = 0.0;
  vec2 c0 = floor(q / cell);
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 c = c0 + vec2(float(i), float(j));
    vec2 h = hash2(c);
    vec2 centre = (c + 0.2 + 0.6 * h) * cell;
    float r = cell * (0.16 + 0.22 * hash(c + 7.0));
    float open = smoothstep(0.42, 0.7, noise(c * 1.7 + vec2(t * 0.9, -t * 0.6) + h * 9.0));
    best = max(best, open * (1.0 - smoothstep(r * 0.55, r, length(q - centre))));
  }
  return best;
}
// Leaves falling from the crowns: each leaves its tree now and then, drifts out on the wind turning over, and settles.
vec4 fallingLeaves(vec2 px){
  float cell = uGrid * 0.9, life = 6.0;
  vec2 c0 = floor(px / cell);
  vec4 leaf = vec4(0.0);
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
    vec2 c = c0 + vec2(float(i), float(j));
    float h = hash(c + 2.7);
    if (h > uLeafRate) continue;
    vec2 home = (c + 0.5 + (hash2(c) - 0.5) * 0.8) * cell;
    if (at(uTreesAt, home) < 0.25) continue;
    float age = fract(uTime / life + h * 7.0);
    vec2 pos = home + uWindDir * age * uGrid * (0.4 + 1.2 * uWind) + vec2(sin(age * 9.0 + h * 20.0), cos(age * 7.0 + h * 13.0)) * uGrid * 0.15 * (1.0 - age * 0.5);
    float turn = age * 8.0 + h * 6.0;
    vec2 d = px - pos; d = vec2(cos(turn) * d.x + sin(turn) * d.y, -sin(turn) * d.x + cos(turn) * d.y);
    float shape = 1.0 - smoothstep(0.7, 1.0, length(vec2(d.x / (uGrid * 0.09), d.y / (uGrid * 0.042))));
    float a = shape * smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.75, 1.0, age)) * 0.9;
    // Catching the light as it turns over.
    if (a > leaf.a) leaf = vec4(mix(uLeafA, uLeafB, hash(c + 9.1)) * (0.95 + 0.3 * cos(turn)), a);
  }
  return leaf;
}
void main(){
  vec2 px = vUv * uSize;
  if (uMode > 1.5) { vec4 leaf = fallingLeaves(px); gl_FragColor = vec4(leaf.rgb * leaf.a, leaf.a); return; }
  float t = uTime * (0.25 + 1.6 * uWind);
  // Trees: the leaves' shade on this spot (baked where each tree throws it), with each gap's fleck.
  vec2 src = px - uShift;
  float cover = uHasTrees > 0.5 ? at(uTrees, px) : 0.0, fleck = 0.0;
  if (cover > 0.01) fleck = flecks(src, px, t) * mix(0.25, 1.0, 1.0 - smoothstep(0.55, 0.95, cover));
  // Roofs: a building's shadow on the open ground beside it; inside, light where the roof above toward the sun has a hole.
  float shadow = 0.0, hole = 0.0;
  if (uHasRoofs > 0.5) {
    vec2 above = px - uRoofShift;
    float inside = at(uIndoor, px), roof = at(uRoofs, above);
    shadow = at(uRoofCast, px) * (1.0 - inside);
    hole = inside * at(uIndoor, above) * at(uRoofArea, px) * at(uRoofArea, above) * (1.0 - smoothstep(0.15, 0.45, roof));
  }
  if (uMode < 0.5) {
    float a = 1.0 - (1.0 - cover * (1.0 - fleck) * 0.5) * (1.0 - shadow * uRoofShade);
    a *= uStrength;
    gl_FragColor = vec4(uShade * a, a);
  } else {
    float a = (fleck * cover * 0.3 + hole * 0.35) * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }
}`;

// The masks are baked this small (a soft shade needs no detail), at most this wide.
const RESOLUTION = 0.25, MAX_TEXTURE = 2048;

/**
 * The sunlight past the overhead tiles. build({ trees, roofs, indoors, bounds, grid, sun }) bakes the tree and roof
 * tiles' pictures (each { texture, x, y, width, height, rotation, anchorX, anchorY, alpha, up (its height in squares),
 * leaves (a tree's, tileLeaves) }
 * in scene pixels), each tree's and roof's shade moved away from the sun (sun.mjs's) as far as its own height throws it,
 * and the indoor polygons (flat x, y pairs) into soft masks: built again as the sun moves (treeShade false: the trees
 * only drop their leaves, casting no shade). look({ fall, roofFall, color,
 * wind, windAngle, roofShade, leaves }) aims and colours it (canopyFall's for the trees and the roofs at their own
 * heights; a null fall hides the shade; roofShade: how dark a building's shadow is; leaves: ambient-life.mjs leavesOf's,
 * the leaves falling from the trees whatever the light); tick(seconds) moves the leaves. `above()`: where the falling
 * leaves are drawn (by default `root()`, with the shade).
 */
export function createCanopyLight({ PIXI, root, render, above = root }) {
  let masks = [], meshes = [], own = [], hasTrees = false;
  const drop = () => {
    for (const m of meshes) { try { m.parent?.removeChild(m); m.destroy(); } catch { /* gone with the canvas */ } }
    for (const m of masks) { try { m.destroy(true); } catch { /* gone */ } }
    meshes = []; masks = []; own = [];
  };
  return {
    build({ trees = [], roofs = [], indoors = [], bounds, grid = 100, sun = null, treeShade = true } = {}) {
      drop();
      if ((!trees.length && !roofs.length) || !bounds) return;
      const k = Math.min(RESOLUTION, MAX_TEXTURE / Math.max(1, bounds.width, bounds.height));
      const w = Math.max(1, Math.ceil(bounds.width * k)), h = Math.max(1, Math.ceil(bounds.height * k));
      const bake = (fill, blur = 3) => {
        const stage = new PIXI.Container();
        fill(stage);
        stage.filters = [new PIXI.BlurFilter(blur)];
        const texture = PIXI.RenderTexture.create({ width: w, height: h });
        try { render(stage, texture); } finally { try { stage.destroy({ children: true }); } catch { /* drawn */ } }
        masks.push(texture);
        return texture;
      };
      // How far a tile's shade lands from it: away from the sun, as far as its height throws it.
      const away = sun ? ((Number(sun.angle) || 0) + 180) * Math.PI / 180 : 0;
      const fall = (t) => { const reach = sun ? Math.min(6 * grid, sunReach(Math.max(0.5, Number(t.up) || 0) * grid, sun.height)) : 0; return [Math.cos(away) * reach, Math.sin(away) * reach]; };
      const sprites = (tiles, solid = false, cast = false) => (stage) => {
        for (const t of tiles) {
          if (!t?.texture) continue;
          const s = solid ? new PIXI.Sprite(PIXI.Texture.WHITE) : new PIXI.Sprite(t.texture);
          const [dx, dy] = cast ? fall(t) : [0, 0];
          s.anchor.set(t.anchorX ?? 0.5, t.anchorY ?? 0.5);
          s.position.set((t.x + dx - bounds.x) * k, (t.y + dy - bounds.y) * k);
          s.width = Math.abs(t.width) * k; s.height = Math.abs(t.height) * k;
          s.rotation = t.rotation ?? 0;
          // A tree's leaves, as thick as they are (tileLeaves): a sparse crown's shade is lighter, and full of flecks.
          s.alpha = solid ? 1 : (t.alpha ?? 1) * (t.leaves ?? 1);
          stage.addChild(s);
        }
      };
      const polygons = (list) => (stage) => {
        const g = new PIXI.Graphics();
        for (const p of list) { const at = (q) => q.map((v, i) => (v - (i % 2 ? bounds.y : bounds.x)) * k); g.beginFill(0xffffff, 1); g.drawPolygon(at(p)); for (const hole of p.holes ?? []) { g.beginHole(); g.drawPolygon(at(hole)); g.endHole(); } g.endFill(); }
        stage.addChild(g);
      };
      const none = () => {};
      const uniforms = {
        uTrees: bake(trees.length ? sprites(trees, false, true) : none), uTreesAt: bake(trees.length ? sprites(trees) : none, 1), uRoofCast: bake(roofs.length ? sprites(roofs, false, true) : none, 2),
        uRoofs: bake(roofs.length ? sprites(roofs) : none, 2),
        uRoofArea: bake(roofs.length ? sprites(roofs, true) : none, 1), uIndoor: bake(indoors.length ? polygons(indoors) : none, 1),
        uSize: [bounds.width, bounds.height], uShift: [0, 0], uRoofShift: [0, 0], uDir: [1, 0], uTime: 0, uWind: 0.35, uStrength: 0, uStretch: 1,
        uGrid: grid, uRoofShade: 0.45, uMode: 0, uHasTrees: treeShade && trees.length ? 1 : 0, uHasRoofs: roofs.length ? 1 : 0, uColor: [1, 0.95, 0.84], uShade: [0.06, 0.09, 0.07],
        uWindDir: [Math.SQRT1_2, Math.SQRT1_2], uLeafRate: 0, uLeafA: [0.44, 0.6, 0.23], uLeafB: [0.56, 0.7, 0.29],
      };
      const geometry = new PIXI.Geometry()
        .addAttribute('aVertexPosition', [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height, bounds.x, bounds.y + bounds.height], 2)
        .addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
      // The light draws the same leaves and roofs (each pass its own copy of the uniforms, kept alike) and adds to the map.
      own = [uniforms, { ...uniforms, uMode: 1 }, { ...uniforms, uMode: 2 }];
      const shade = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[0]));
      const light = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[1]));
      const leaves = new PIXI.Mesh(geometry, PIXI.Shader.from(VERT, FRAG, own[2]));
      light.blendMode = PIXI.BLEND_MODES.ADD;
      meshes = [shade, light, leaves];
      hasTrees = trees.length > 0;
      // The leaves can lie elsewhere than the shade (`above`; by default with it, under the tree tiles).
      for (const m of meshes) { m.eventMode = 'none'; m.visible = false; (m === leaves ? above : root)().addChild(m); }
    },
    look({ fall = null, roofFall = null, color = [1, 0.95, 0.84], wind = 0.35, windAngle = Math.PI / 4, roofShade = 0.45, leaves = null } = {}) {
      if (!own.length) return;
      const rgb = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
      const rate = hasTrees && leaves?.rate > 0.01 && leaves.colors?.length ? leaves.rate : 0;
      for (const u of own) Object.assign(u, { uWind: wind, uWindDir: [Math.cos(windAngle), Math.sin(windAngle)], uLeafRate: rate * 0.6,
        ...(rate ? { uLeafA: rgb(leaves.colors[0]), uLeafB: rgb(leaves.colors[leaves.colors.length - 1]) } : {}) });
      meshes[2].visible = rate > 0;
      const on = !!fall;
      meshes[0].visible = meshes[1].visible = on;
      if (!on) return;
      const roof = roofFall ?? fall;
      for (const u of own) Object.assign(u, { uShift: fall.shift, uRoofShift: roof.shift, uDir: fall.dir, uStretch: fall.stretch, uStrength: fall.light, uColor: color, uRoofShade: roofShade });
    },
    tick(seconds) { for (const u of own) u.uTime += seconds; },
    clear: drop,
    get shown() { return meshes.some((m) => m.visible); },
    // The trees' shade as baked (alpha: how deep), over the same scene rectangle; null when no tree casts one.
    get treeShade() { return own[0]?.uHasTrees > 0.5 ? own[0].uTrees : null; },
    // Where the trees' crowns stand (not their shade): the ground the fallen leaves lie on.
    get crowns() { return own[0]?.uTreesAt ?? null; },
  };
}

// How far a tree's crown sways in the wind (0 still – 1 a gale), in pixels on the map for a `grid`-pixel square: a
// little even in still air, a good deal in a gale.
export const swayOf = (wind, grid = 100) => (0.01 + 0.05 * Math.min(1, Math.max(0, Number(wind) || 0))) * grid;

// High precision: the filter vertex stage declares inputSize and outputFrame so, and a uniform shared by both stages
// must match (a mismatch fails to link and the tree draws as nothing).
const SWAY = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputSize, outputFrame;
uniform vec3 uView;     // the stage's offset (x, y) and scale: screen = map * scale + offset
uniform vec2 uDir, uSeed;
uniform float uTime, uAmp, uGrid;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  vec2 screen = vTextureCoord * inputSize.xy + outputFrame.xy, map = (screen - uView.xy) / uView.z;
  vec2 w = map / (uGrid * 2.2) + uSeed;
  // The crown leans with the gusts, each part a little after the next, so it rolls rather than slides.
  float gust = 0.55 + 0.45 * sin(uTime * 0.45 + uSeed.x * 3.0) * sin(uTime * 0.31 + uSeed.y);
  float lean = sin(uTime * 1.3 + w.x * 1.7 + w.y * 1.1) * 0.6 + (noise(w + uTime * 0.35) - 0.5);
  vec2 off = uDir * lean * gust;
  // And the leaves flutter, finer and quicker.
  vec2 f = map / (uGrid * 0.45) + uSeed;
  off += vec2(noise(f + uTime * 1.9) - 0.5, noise(f - uTime * 2.1 + 7.3) - 0.5) * 0.35;
  gl_FragColor = texture2D(uSampler, vTextureCoord + off * uAmp * uView.z * inputSize.zw);
}`;

// The trees swaying in the wind: a light ripple of each tree tile's own picture (its mesh), leaning the way the wind
// blows and fluttering, each tree out of step with the others. attach(meshes) puts it on the tree tiles (any others
// lose it), set({ wind, angle, view }) follows the wind and the camera, tick(seconds) moves it, clear() takes it off.
export function createTreeSway({ PIXI, grid = () => 100 }) {
  const on = new Map();
  const off = (mesh) => {
    const filter = on.get(mesh);
    on.delete(mesh);
    try { if (mesh && !mesh.destroyed && mesh.filters) mesh.filters = mesh.filters.filter((f) => f !== filter); } catch { /* gone with the canvas */ }
    try { filter?.destroy?.(); } catch { /* gone */ }
  };
  return {
    attach(meshes = []) {
      const want = new Set(meshes.filter((m) => m && !m.destroyed));
      for (const mesh of [...on.keys()]) if (!want.has(mesh)) off(mesh);
      let n = 0;
      for (const mesh of want) {
        n++;
        if (on.has(mesh)) continue;
        const filter = new PIXI.Filter(undefined, SWAY, { uView: [0, 0, 1], uDir: [1, 0], uSeed: [n * 3.17, n * 1.93], uTime: n * 4.1, uAmp: 0, uGrid: grid() });
        filter.padding = 0.08 * grid();
        mesh.filters = [...(mesh.filters ?? []), filter];
        on.set(mesh, filter);
      }
    },
    set({ wind = 0, angle = 0, view = null } = {}) {
      if (!view) return;
      for (const filter of on.values()) Object.assign(filter.uniforms, { uAmp: swayOf(wind, grid()), uDir: [Math.cos(angle), Math.sin(angle)], uView: [view.x, view.y, view.scale], uGrid: grid() });
    },
    tick(seconds) { for (const filter of on.values()) filter.uniforms.uTime += seconds; },
    clear() { for (const mesh of [...on.keys()]) off(mesh); },
    get swaying() { return on.size; },
  };
}
