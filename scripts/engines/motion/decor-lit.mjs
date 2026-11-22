// Light on a decoration: the sun and the lamps near it falling across its surfaces.
//
// A decoration's picture holds colour and grain and no light (decor-kit.mjs). Beside it is painted a second picture:
// how high each part of it stands (red) and how much it shines (green). From the slope of those heights this works
// out which way each bit of surface faces, and lights it from where the light really is: the side of a barrel's rim
// toward the sun goes pale and the far side dark, an iron hoop glints where it turns toward a torch, and all of it
// moves as the sun does and as a torch is carried past. Flat floor-facing surfaces are left exactly as painted, so a
// piece under no light at all is its picture and nothing else.
//
// Pure where it can be: `litUniforms` is what is tested. The shader is PIXI's and is drawn by decorations.mjs and
// by the proof page (tools/fx-gallery/decor-kit-proof.html).

/**
 * How many times finer than the map's grid a lit piece is painted. Painted at the grid's own size, a piece went soft
 * the moment a GM zoomed in: its picture was being stretched. (Roi, of a table shown at twice its painted size: "why
 * does it look so... blurry?") Twice as fine, with mipmaps for when it is seen small, it stays sharp either way.
 */
export const LIT_OVERSAMPLE = 2;
/** How many lights one decoration answers to: the sun (or moon) and its three nearest lamps. */
export const LIT_LIGHTS = 4;

export const LIT_VERT = `
attribute vec2 aVertexPosition; attribute vec2 aUvs;
uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
varying vec2 vUv;
void main() { vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;

export const LIT_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uArt; uniform sampler2D uMaps;
uniform vec2 uTexel; uniform float uRot; uniform float uFlip; uniform float uRelief; uniform float uAlpha; uniform float uSteps; uniform float uGentle; uniform float uShade; uniform float uGlint; uniform vec3 uTint;
uniform vec3 uDir[${LIT_LIGHTS}]; uniform vec4 uCol[${LIT_LIGHTS}];
void main() {
  vec4 art = texture2D(uArt, vUv);
  if (art.a < 0.004) { gl_FragColor = vec4(0.0); return; }
  vec2 m = texture2D(uMaps, vUv).rg;
  // The slope of the heights here, in the picture's own directions, then turned the way the decoration is turned.
  float hl = texture2D(uMaps, vUv - vec2(uTexel.x, 0.0)).r, hr = texture2D(uMaps, vUv + vec2(uTexel.x, 0.0)).r;
  float hu = texture2D(uMaps, vUv - vec2(0.0, uTexel.y)).r, hd = texture2D(uMaps, vUv + vec2(0.0, uTexel.y)).r;
  vec2 slope = vec2((hr - hl) * uFlip, hd - hu) * uRelief;
  float c = cos(uRot), s = sin(uRot);
  vec3 n = normalize(vec3(-(c * slope.x - s * slope.y), -(s * slope.x + c * slope.y), 1.0));
  float shine = m.g;
  vec3 lit = vec3(0.0), glint = vec3(0.0);
  for (int i = 0; i < ${LIT_LIGHTS}; i++) {
    float amt = uCol[i].a; if (amt <= 0.0) continue;
    vec3 L = uDir[i];
    // Against a flat surface under the same light: brighter where it faces the light more, darker where less.
    float d = dot(n, L) - L.z;
    lit += uCol[i].rgb * amt * d;
    // What shines throws the light back: sharp and bright on metal, broad and faint on polished wood.
    vec3 h = normalize(L + vec3(0.0, 0.0, 1.0));
    float level = pow(h.z, mix(6.0, 48.0, shine));
    glint += uCol[i].rgb * amt * shine * max(0.0, pow(max(dot(n, h), 0.0), mix(6.0, 48.0, shine)) - level);
  }
  // (uShade: how much of the shading across its form is laid on, apart from what shines. A picture somebody already
  // painted with its light in wants none of it — shaded again it bulges — but its iron should still catch a torch.)
  lit *= 2.2 * uShade; glint *= 2.4 * uGlint;
  if (uSteps > 0.0) {
    // Painted, not rendered: the light falls in flat tones with an edge between them, as a brush lays shade — so many
    // steps to full light — and only metal throws it back, as a hard bright fleck.
    // (And gently: a third of the smooth light's strength. At full strength every edge was a bright rim and a dark
    // one, and the piece looked embossed — rendered, not painted.)
    lit *= uGentle;
    float v = dot(lit, vec3(0.3333)), x = v * uSteps, i = floor(x + 0.5), f = x + 0.5 - i;
    float q = (i - 1.0 + smoothstep(0.0, 0.14, f)) / uSteps;
    lit = abs(v) > 0.0005 ? lit * (q / v) : vec3(0.0);
    float g = dot(glint, vec3(0.3333));
    glint = shine > 0.5 && g > 0.0005 ? glint * (smoothstep(0.1, 0.16, g) * 0.32 / g) : vec3(0.0);
  }
  vec3 rgb = art.rgb * uTint * clamp(vec3(1.0) + lit, 0.3, 2.1) + glint * art.a;
  gl_FragColor = vec4(rgb, art.a) * uAlpha;
}`;

const unit3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const rgbOf = (c) => (typeof c === 'number' ? [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255] : Array.isArray(c) ? c : [1, 1, 1]);

/**
 * The lights on one decoration (pure): `at` { x, y } it, `sun` { angle (radians, the way its shadows fall), length (a
 * shadow's length per unit of height), strength 0-1, color } or null, `lamps` [{ x, y, radius, strength 0-1, color,
 * height (px above the floor) }]. Returns { dirs: Float32Array(3 × LIT_LIGHTS) toward each light, cols:
 * Float32Array(4 × LIT_LIGHTS) its colour and how much of it there is }. The sun first, then the lamps that reach it,
 * strongest first; a lamp fades to nothing at its radius.
 */
export function litUniforms({ at = { x: 0, y: 0 }, sun = null, lamps = [], grid = 100 } = {}) {
  const dirs = new Float32Array(3 * LIT_LIGHTS), cols = new Float32Array(4 * LIT_LIGHTS), list = [];
  if (sun && sun.strength > 0) {
    // Its shadows fall along `angle`, `length` long for each unit of height: so it stands the other way, that high.
    const len = Math.max(0.05, sun.length ?? 1);
    list.push({ dir: unit3(-Math.cos(sun.angle) * len, -Math.sin(sun.angle) * len, 1), col: rgbOf(sun.color), amt: Math.min(1, sun.strength) });
  }
  const near = [];
  for (const l of lamps ?? []) {
    const dx = l.x - at.x, dy = l.y - at.y, d = Math.hypot(dx, dy), r = Math.max(1, l.radius ?? grid * 4); if (d >= r) continue;
    const fade = 1 - d / r, amt = Math.min(1, (l.strength ?? 1) * fade * fade); if (amt <= 0.01) continue;
    near.push({ dir: unit3(dx, dy, l.height ?? grid * 0.9), col: rgbOf(l.color), amt });
  }
  near.sort((a, b) => b.amt - a.amt);
  list.push(...near.slice(0, LIT_LIGHTS - list.length));
  list.forEach((l, i) => { dirs.set(l.dir, i * 3); cols.set([...l.col, l.amt], i * 4); });
  return { dirs, cols };
}

/**
 * (`steps`: 0 lights it smoothly; 3 or 4 lays the light in that many flat tones each way, as painted shading.)
 * A decoration as a lit mesh: `art` and `maps` textures of one size. Its position, rotation and scale are set like a
 * sprite's (anchored at its middle); `aimLit` hands it its lights. `mirror` when it is drawn flipped left to right.
 */
export function createLitMesh(PIXI, { art, maps, relief = 10, mirror = false, oversample = 1, steps = 0, gentle = 0.35, shade = 1, glint = 1, tint = [1, 1, 1] }) {
  // (`oversample`: how many times finer than the map's grid the pictures were painted — LIT_OVERSAMPLE. The slope is
  // read across the same distance on the map whatever that is, so a piece is lit the same painted fine or coarse.)
  const w = art.width, h = art.height, reach = 1.5 * Math.max(1, oversample);
  const geometry = new PIXI.Geometry().addAttribute('aVertexPosition', [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2], 2).addAttribute('aUvs', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
  const mesh = new PIXI.Mesh(geometry, PIXI.Shader.from(LIT_VERT, LIT_FRAG, { uArt: art, uMaps: maps, uTexel: [reach / w, reach / h], uRot: 0, uFlip: mirror ? -1 : 1, uRelief: relief, uAlpha: 1, uSteps: steps, uGentle: gentle, uShade: shade, uGlint: glint, uTint: tint, uDir: new Float32Array(3 * LIT_LIGHTS), uCol: new Float32Array(4 * LIT_LIGHTS) }));
  mesh.eventMode = 'none'; mesh.texture = art; mesh.lit = true;
  return mesh;
}
/** Hands a lit mesh its lights (litUniforms' answer), and the way it is turned now. */
export function aimLit(mesh, { dirs, cols }) { const u = mesh.shader.uniforms; u.uDir = dirs; u.uCol = cols; u.uRot = mesh.rotation; u.uAlpha = mesh.worldAlpha ?? 1; }
