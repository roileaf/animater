import test from 'node:test';
import assert from 'node:assert/strict';
import { BLADE_SHADERS, FLOOR_SHADERS, GRASS_BLADES, MOST_BLADES, MOST_PRESSES, bladeCount, createBladePresses, skyForFloors, swaysInWind } from '../../../scripts/engines/motion/floor-looks.mjs';
import { STEP_LOOKS, TEXTURE_STYLES } from '../../../scripts/engines/motion/region-steps.mjs';

test('every floor style has a painter of its own, with nothing left unfilled', () => {
  for (const [floor, styles] of Object.entries(TEXTURE_STYLES)) {
    const seen = new Set();
    for (const [style] of styles) {
      const source = FLOOR_SHADERS.tileFrag(floor, style);
      assert.ok(source.startsWith('precision'), `${floor}/${style} starts as a shader`);
      assert.ok(!source.includes('${'), `${floor}/${style} has nothing unfilled`);
      assert.match(source, /vec4 surface\(vec2 p\)/);
      assert.match(source, /void main\(\)/);
      seen.add(source);
    }
    assert.equal(seen.size, styles.length, `${floor}: every style is painted its own way`);
  }
});

test('every look has a painter of its own, with nothing left unfilled', () => {
  const seen = new Set();
  for (const [key, id] of Object.entries(STEP_LOOKS)) {
    if (!id) continue;
    const source = FLOOR_SHADERS.lookFrag(id);
    assert.ok(!source.includes('${'), `${key} has nothing unfilled`);
    assert.ok(!source.includes('return vec4(0.0);\n}\nvoid main'), `${key} has a painter`);
    seen.add(source);
  }
  assert.equal(seen.size, Object.values(STEP_LOOKS).filter(Boolean).length, 'no two looks share a painter');
});

test('painted grass bends in the wind; hard floors do not', () => {
  assert.equal(swaysInWind('grass'), true);
  for (const floor of ['stone', 'wood', 'metal', 'glass', 'ice', 'pebbles']) assert.equal(swaysInWind(floor), false, floor);
});

test('a flame lights the blades facing it, in its colour, and throws their shadows away from it, even in the dark', () => {
  const { BLADE_VERT, BLADE_FRAG, BLADE_SHADOW_VERT, BLADE_SHADOW_FRAG } = BLADE_SHADERS;
  assert.ok(BLADE_VERT.includes('float flamesAt(out vec2 away, out vec3 glow)') && BLADE_VERT.includes('dot(across, away) * side'), 'lit on the side toward it');
  assert.ok(BLADE_FRAG.includes('c *= 1.0 + vFlame'), 'in its colour');
  assert.ok(BLADE_SHADOW_VERT.includes('mix(-uToSun * uReach, away, near)'), 'its shadow falls away from the flame');
  assert.ok(BLADE_SHADOW_FRAG.includes('max(uStrength * sunReach(vWorld), vNear * 0.9)'), 'and shows with no sun');
});

test('every grass style has blades of its own', () => {
  for (const [style] of TEXTURE_STYLES.grass) {
    const b = GRASS_BLADES[style];
    assert.ok(b, `${style} has blades`);
    assert.ok(b.perSquare > 0 && b.length > 0 && b.width > 0, `${style}: sizes`);
    assert.equal(b.low.length, 3); assert.equal(b.high.length, 3);
  }
  assert.ok(GRASS_BLADES.long.length > GRASS_BLADES.turf.length, 'long grass is longer than turf');
});

test('blades grow with the region up to a cap, and thin out rather than cost more', () => {
  assert.equal(bladeCount(2, 100), 200);
  assert.equal(bladeCount(1e6, 100), MOST_BLADES);
  assert.ok(MOST_BLADES <= 20000);
  assert.equal(bladeCount(0, 100), 0);
});

test('the floors read the sun and the moon', () => {
  assert.equal(skyForFloors(null).strength, 0, 'no sky, no light');
  const noon = skyForFloors({ angle: 0, height: 80, strength: 1 }), dusk = skyForFloors({ angle: 0, height: 8, strength: 1 }), moon = skyForFloors({ angle: 90, height: 60, strength: 1, moon: true });
  assert.ok(Math.abs(noon.toSun[0] - 1) < 1e-9 && Math.abs(noon.toSun[1]) < 1e-9, 'the way to the sun');
  assert.ok(Math.abs(moon.toSun[1] - 1) < 1e-9, 'and to the moon');
  assert.ok(dusk.reach > noon.reach, 'a low sun throws long shadows');
  assert.ok(dusk.rim > noon.rim, 'and warms the tips');
  assert.ok(moon.strength < noon.strength, 'the moon is weaker');
  assert.equal(moon.rim, 0, 'and no warm rim');
  assert.equal(skyForFloors({ angle: 'x', height: 'y', strength: 'z' }).strength, 0, 'nonsense is dark');
});

test('a creature presses the grass where it stands, and leaves a trail that recovers', () => {
  const presses = createBladePresses({ life: 2 });
  const token = (x) => ({ id: 'a', x, y: 0, width: 100 });
  let out = presses.step([token(0)], 0, 100);
  assert.equal(out.count, 1, 'standing: only where it stands');
  assert.equal(out.data[0], 0); assert.equal(out.data[2], 55, 'about its own width'); assert.equal(out.data[3], 1, 'at full press');
  out = presses.step([token(50)], 0.1, 100);
  assert.equal(out.count, 2, 'moved far enough: a mark behind it');
  const trail = presses.step([token(50)], 1.1, 100);
  assert.ok(trail.data[7] < 1 && trail.data[7] > 0, 'the mark is recovering');
  const gone = presses.step([token(50)], 5, 100);
  assert.equal(gone.count, 1, 'and is gone');
  assert.equal(presses.step([], 5.1, 100).count, 0, 'nobody there, nothing pressed');
});

test('presses stay within what the shader holds, the strongest kept', () => {
  const presses = createBladePresses({ life: 100 });
  let out;
  for (let i = 0; i < 80; i++) out = presses.step([{ id: 'a', x: i * 100, y: 0, width: 100 }], i * 0.1, 100);
  assert.equal(out.count, MOST_PRESSES);
  assert.equal(out.data.length, MOST_PRESSES * 4);
  assert.equal(out.data[0], 7900, 'the creature itself is always among them');
});

test('surfaces answer the sky by what they are made of', async () => {
  const { surfaceShine } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  const { TEXTURE_STYLES } = await import('../../../scripts/engines/motion/region-steps.mjs');
  for (const [floor, styles] of Object.entries(TEXTURE_STYLES)) for (const [style] of styles) {
    for (const [key, value] of Object.entries(surfaceShine(floor, style))) assert.ok(Number.isFinite(value) && value >= 0, `${floor}/${style} ${key}`);
  }
  assert.ok(surfaceShine('glass', 'mosaic').gloss > surfaceShine('stone', 'cobbles').gloss);
  assert.ok(surfaceShine('glass', 'mosaic').sharp > surfaceShine('glass', 'frosted').sharp);
  assert.ok(surfaceShine('snow', 'powder').glitter > 0);
  assert.equal(surfaceShine('grass', 'meadow').gloss, 0);
  assert.equal(surfaceShine('nonsense', 'constructor').gloss, 0);
});

test('a surface must lean further to shine under a low sun, and the moon is weaker', async () => {
  const { skyForFloors } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  const high = skyForFloors({ angle: 0, height: 90, strength: 1 }), low = skyForFloors({ angle: 0, height: 10, strength: 1 }), moon = skyForFloors({ angle: 0, height: 45, strength: 1, moon: true });
  assert.ok(Math.abs(Math.hypot(...low.half) - 1) < 1e-9);
  assert.ok(Math.abs(high.half[2] - 1) < 1e-9);
  assert.ok(low.half[2] < high.half[2] && low.half[0] > 0);
  assert.ok(moon.strength < high.strength);
  assert.ok(skyForFloors(null).half.every(Number.isFinite));
});

test('the glare stays on the floor and goes only as the sun or moon goes', async () => {
  const { glareAt, skyForFloors } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  const box = { x: 1000, y: 500, w: 2000, h: 1000 }, west = skyForFloors({ angle: 180, height: 20, strength: 1 }), east = skyForFloors({ angle: 0, height: 20, strength: 1 }), high = skyForFloors({ angle: 0, height: 90, strength: 1 });
  assert.ok(glareAt(box, west)[0] < 2000 && glareAt(box, east)[0] > 2000);
  assert.ok(Math.abs(glareAt(box, high)[0] - 2000) < 1e-6);
  assert.deepEqual(glareAt(box, west), glareAt(box, west));
  assert.ok(glareAt(null, null).every(Number.isFinite));
});

test('clouds take the sun off the floors', () => {
  const clear = skyForFloors({ angle: 0, height: 45, strength: 1 }, 0), grey = skyForFloors({ angle: 0, height: 45, strength: 1 }, 1);
  assert.ok(grey.strength < clear.strength * 0.2 && grey.strength > 0);
  assert.equal(skyForFloors({ angle: 0, height: 45, strength: 1 }).strength, clear.strength);
  assert.ok(Number.isFinite(skyForFloors({ angle: 0, height: 45, strength: 1 }, 'much').strength));
});

test('rain soaks what soaks, and the wind moves only water', async () => {
  const { surfaceShine } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  assert.equal(surfaceShine('stone', 'cobbles').wets, 1);
  for (const floor of ['water', 'ice', 'snow', 'grass']) assert.equal(surfaceShine(floor, '').wets, 0, floor);
  assert.ok(surfaceShine('water', 'deep').ripple > 0);
  assert.equal(surfaceShine('glass', 'mosaic').ripple, 0);
});

test('a floor answers the lit lights nearest the view, as many as it can take', async () => {
  const { floorLights, FLOOR_SHADERS } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  const view = { x: 0, y: 0, w: 1000, h: 1000 }, most = FLOOR_SHADERS.MOST_FLOOR_LIGHTS;
  const many = Array.from({ length: most + 3 }, (_, i) => ({ x: 500 + i * 10, y: 500, radius: 300, color: [1, 0, 0] }));
  const got = floorLights([{ x: 90000, y: 90000, radius: 300 }, { x: 500, y: 500, radius: 0 }, ...many], view);
  assert.equal(got.count, most);
  assert.equal(got.lights[0], 500);
  assert.equal(got.lights[(most - 1) * 4], 500 + (most - 1) * 10);
  assert.equal(floorLights([], view).count, 0);
  assert.equal(floorLights().count, 0);
  const warm = floorLights([{ x: 500, y: 500, radius: 300 }], view);
  assert.ok(warm.colors[0] > warm.colors[2]);
});

test('shiny looks say how they shine, the rest do not, and their shader is whole', async () => {
  const { lookShine } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  for (const look of ['blood', 'oil', 'wet', 'frost', 'frozen', 'blackice', 'flooded', 'acid']) { assert.ok(look in STEP_LOOKS, look); const s = lookShine(look); assert.ok(s.gloss > 0 || s.glitter > 0, look); }
  // Every look with a surface answers the light through its bumps, however dull; light and vapour have none, and nor does what is no look.
  for (const look of ['moss', 'bones', 'burnt', 'ash']) { assert.ok(look in STEP_LOOKS, look); assert.ok(lookShine(look).relief > 0, look); }
  // A stain lies flat: nothing raises it, however wet.
  for (const look of ['blood', 'dried', 'oil']) { assert.equal(lookShine(look).relief, 0, look); assert.equal(lookShine(look).edge, 0, look); assert.equal(FLOOR_SHADERS.bodyOf(STEP_LOOKS[look]), 0, look); }
  assert.equal(lookShine('moss').gloss, 0);
  for (const look of ['burning', 'arcane', 'misty', 'none', 'constructor']) assert.equal(lookShine(look), null, look);
  for (const frag of [FLOOR_SHADERS.SHOW_FRAG, FLOOR_SHADERS.SHEEN_FRAG, BLADE_SHADERS.BLADE_FRAG, BLADE_SHADERS.BLADE_SHADOW_FRAG]) assert.ok(frag.includes('sunReach(vWorld)'), 'the sun stops at walls, roofs and trees');
  assert.ok(!FLOOR_SHADERS.SHEEN_FRAG.includes('${'));
  assert.ok(FLOOR_SHADERS.SHEEN_FRAG.includes('uLights[' + FLOOR_SHADERS.MOST_FLOOR_LIGHTS + ']'));
});

test('the moon is faint on what it lights, yet its reflection shows', () => {
  const moon = skyForFloors({ angle: 0, height: 45, strength: 0.2, moon: true }), sun = skyForFloors({ angle: 0, height: 45, strength: 1 }), grey = skyForFloors({ angle: 0, height: 45, strength: 0.2, moon: true }, 1);
  assert.ok(moon.strength < 0.2);
  assert.ok(moon.shine >= 0.7);
  assert.equal(sun.shine, 1);
  assert.ok(grey.shine < 0.2);
  assert.equal(skyForFloors(null).shine, 0);
});

test('each quality level leaves less of the floors, cheapest last to go', async () => {
  const { floorDetail } = await import('../../../scripts/core/quality.mjs');
  assert.deepEqual(floorDetail('full'), { show: true, motion: true, blades: true, shine: true, sheen: true, lights: 6, water: 'full', tile: 2048 });
  assert.equal(floorDetail('light').lights, 3);
  assert.ok(floorDetail('light').blades && floorDetail('light').sheen);
  assert.equal(floorDetail('light').tile, 2048, 'floors stay sharp on Light');
  assert.equal(floorDetail('balanced').tile, 1024, 'and take a quarter of the memory on Balanced');
  const balanced = floorDetail('balanced'); assert.ok(balanced.show && balanced.shine && !balanced.blades && !balanced.motion && !balanced.sheen && balanced.lights === 2);
  const low = floorDetail('low'); assert.ok(low.show && !low.shine && !low.sheen && !low.motion && low.lights === 0);
  assert.equal(floorDetail('off').show, false);
  assert.equal(floorDetail('nonsense').lights, 6);
});

test('a level can ask for fewer lights', async () => {
  const { floorLights } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  const many = Array.from({ length: 5 }, (_, i) => ({ x: i, y: 0, radius: 100 }));
  assert.equal(floorLights(many, { x: 0, y: 0, w: 100, h: 100 }, 2).count, 2);
  assert.equal(floorLights(many, { x: 0, y: 0, w: 100, h: 100 }, 0).count, 0);
});

const fakeGl = ({ aside = true, links = true } = {}) => { const log = { deleted: 0, ready: false, built: 0 }; return { log, VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, LINK_STATUS: 3, getExtension: () => (aside ? { COMPLETION_STATUS_KHR: 9 } : null), createShader: () => ({}), shaderSource() {}, compileShader() {}, createProgram: () => { log.built++; return { program: true }; }, attachShader() {}, linkProgram() {}, deleteShader() { log.deleted++; }, getProgramInfoLog: () => 'nope', getProgramParameter: (p, what) => (what === 9 ? log.ready : links) }; };
test('a shader is made aside, once, and ready when the browser says', async () => {
  const { createBackgroundPrograms } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  const gl = fakeGl(), made = createBackgroundPrograms({ gl, sourcesOf: () => ({ vertexSrc: 'v', fragmentSrc: 'f' }) });
  assert.equal(made.get('a'), null);
  assert.equal(made.get('a'), null);
  assert.equal(gl.log.built, 1);
  gl.log.ready = true;
  assert.deepEqual(made.get('a'), { program: true });
  assert.equal(gl.log.deleted, 2);
  assert.deepEqual(made.get('a'), { program: true });
  assert.equal(gl.log.deleted, 2);
});

test('without that browser feature a shader is simply ready; one that fails says so', async () => {
  const { createBackgroundPrograms } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  const sourcesOf = () => ({ vertexSrc: 'v', fragmentSrc: 'f' });
  assert.deepEqual(createBackgroundPrograms({ gl: fakeGl({ aside: false }), sourcesOf }).get('a'), { program: true });
  const warned = console.warn; console.warn = () => {};
  try { assert.equal(createBackgroundPrograms({ gl: fakeGl({ aside: false, links: false }), sourcesOf }).get('a'), false); } finally { console.warn = warned; }
});

test('the sun changes colour with its height, and the moon does not', async () => {
  const { sunColour } = await import('../../../scripts/engines/motion/floor-looks.mjs');
  const blue = (height) => skyForFloors({ strength: 1, angle: 0, height }).color[2];
  assert.ok(blue(70) > blue(30) && blue(30) > blue(10) && blue(10) > blue(1), 'warmer the lower it stands');
  assert.deepEqual(sunColour(90), sunColour(50), 'overhead it stops changing');
  assert.deepEqual(sunColour(-5), sunColour(0), 'below the horizon it stays at its deepest');
  assert.deepEqual(skyForFloors({ strength: 1, angle: 0, height: 5, moon: true }).color, [0.7, 0.8, 1]);
  assert.deepEqual(skyForFloors({ strength: 1, angle: 0 }).color, sunColour(45), 'a sky with no height reads as mid-morning');
});


test('the shaders a scene draws at once are warmed in the background, as the very programs its meshes use, each once', async () => {
  const { sceneShaderSources, sceneShaderPrograms } = await import('../../../scripts/engines/motion/scene-shaders.mjs');
  const { warmPrograms } = await import('../../../scripts/engines/tokenshade/warmup.mjs');
  const sources = sceneShaderSources();
  assert.ok(sources.length >= 20);
  for (const [vertex, fragment] of sources) { assert.equal(typeof vertex, 'string'); assert.ok(vertex.includes('void main')); assert.ok(fragment.includes('gl_FragColor')); }
  assert.notEqual(sceneShaderSources({ fullWater: false }).map((s) => s[1]).join(), sources.map((s) => s[1]).join(), 'water follows the quality');
  const cache = new Map();
  class Program { constructor(v, f) { this.vertexSrc = v; this.fragmentSrc = f; this.glPrograms = {}; } static from(v, f) { const k = v + f; if (!cache.has(k)) cache.set(k, new Program(v, f)); return cache.get(k); } }
  const programs = sceneShaderPrograms({ Program });
  assert.equal(programs[0], Program.from(...sources[0]));
  const gl = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, LINK_STATUS: 3, ACTIVE_ATTRIBUTES: 4, getExtension: (n) => (n === 'KHR_parallel_shader_compile' ? {} : null), isContextLost: () => false, createShader: () => ({}), shaderSource() {}, compileShader() {}, createProgram: () => ({}), attachShader() {}, linkProgram() {}, getProgramParameter: (p, k) => (k === 4 ? 1 : true), getActiveAttrib: () => ({ name: 'aVertexPosition' }), bindAttribLocation() {}, deleteShader() {}, deleteProgram() {} };
  const built = [], renderer = { gl, CONTEXT_UID: 7, shader: { generateProgram: ({ program }) => { built.push(program); program.glPrograms[7] = {}; } } };
  const few = [programs[0], programs[1], programs[0], programs[2]];
  programs[2].glPrograms[7] = {};
  assert.equal(await warmPrograms(renderer, few, { tick: 0 }), 2, 'once each, and not what is already built');
  assert.deepEqual(built, [programs[0], programs[1]]);
  assert.equal(await warmPrograms({ ...renderer, gl: { ...gl, getExtension: () => null } }, [programs[3]], { tick: 0 }), 0, 'nothing without background compiling: it would freeze the canvas just the same');
});
