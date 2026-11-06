import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WATER_MOTION, WATER_SHADERS, flowBend, flowField, ringSlot, wakeRingDue, waterFoam, waveSheet } from '../../../scripts/engines/motion/water-engine.mjs';
import { floorDetail } from '../../../scripts/core/quality.mjs';

// A band running top to bottom, soft at its sides.
const band = (w, h) => { const soft = new Uint8Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) soft[j * w + i] = Math.max(0, 255 - Math.abs(i - w / 2) * 30); return soft; };
const dirAt = (out, w, i, j) => { const k = (j * w + i) * 4; return [(out[k] - 127.5) / 127.5, (out[k + 1] - 127.5) / 127.5, out[k + 2]]; };

test('still water has no way to go', () => {
  const out = flowField(band(8, 8), 8, 8, null);
  assert.equal(out[2], 0);
  assert.ok(Math.abs(dirAt(out, 8, 4, 4)[0]) < 0.02);
});

test('a river runs along its banks, the way it is told, even when told a little off', () => {
  const w = 40, h = 40, south = Math.PI / 2, askew = Math.PI / 2 + 0.6;
  for (const angle of [south, askew]) {
    const [x, y, flows] = dirAt(flowField(band(w, h), w, h, angle), w, 15, 20);
    assert.equal(flows, 255);
    assert.ok(y > 0.9, `down the band, got ${y}`);
    assert.ok(Math.abs(x) < 0.4);
  }
  const [, up] = dirAt(flowField(band(w, h), w, h, -Math.PI / 2), w, 15, 20);
  assert.ok(up < -0.9);
});

test('where a region is cut off across its flow the water runs on through, not sideways along the cut', () => {
  // A band running down, stopped short: full at the top, fading out across its width in the last rows.
  const w = 40, h = 40, soft = band(w, h); for (let j = 32; j < h; j++) for (let i = 0; i < w; i++) soft[j * w + i] *= Math.max(0, 1 - (j - 32) / 6);
  const out = flowField(soft, w, h, Math.PI / 2);
  for (const i of [15, 20, 25]) { const [x, y] = dirAt(out, w, i, 36); assert.ok(y > 0.85, `at ${i}: down, got ${y}`); assert.ok(Math.abs(x) < 0.5, `at ${i}: not sideways, got ${x}`); }
});

test('open water with no banks near goes the way it is told', () => {
  const soft = new Uint8Array(100).fill(255), [x, y] = dirAt(flowField(soft, 10, 10, 0), 10, 5, 5);
  assert.ok(x > 0.95 && Math.abs(y) < 0.05);
});

test('the wave sheet tiles and is made the same each time', () => {
  const a = waveSheet(64), b = waveSheet(64);
  assert.deepEqual(a, b);
  assert.equal(a.length, 64 * 64 * 4);
  let lo = 255, hi = 0; for (let i = 0; i < a.length; i += 4) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); }
  assert.ok(hi - lo > 30, 'it has waves');
  // Smooth at the size it is used: neighbouring slopes change gently, with no crease for the light to draw as a line.
  const S = 512, big = waveSheet(S); let jump = 0; for (let j = 0; j < S; j++) for (let i = 1; i < S; i++) jump = Math.max(jump, Math.abs(big[(j * S + i) * 4] - big[(j * S + i - 1) * 4]));
  assert.ok(jump < 64, `no creases, got ${jump}`);
  let seam = 0; for (let j = 0; j < S; j++) seam = Math.max(seam, Math.abs(big[j * S * 4] - big[(j * S + S - 1) * 4]));
  assert.ok(seam < 64, `its edges meet, got ${seam}`);
});

test('the quality levels say how much water to draw', () => {
  assert.equal(floorDetail('full').water, 'full');
  assert.equal(floorDetail('light').water, 'full');
  assert.equal(floorDetail('balanced').water, 'simple');
  assert.equal(floorDetail('low').water, null);
  assert.equal(floorDetail('off').water, null);
});

test('every kind of water moves its own way', () => {
  assert.deepEqual(Object.keys(WATER_MOTION), ['still', 'river', 'rapids', 'falls', 'sea']);
  assert.equal(WATER_MOTION.still.pace, 0);
  assert.ok(WATER_MOTION.rapids.pace > WATER_MOTION.river.pace && WATER_MOTION.rapids.foam > 0);
  assert.ok(WATER_MOTION.falls.pace > WATER_MOTION.rapids.pace && WATER_MOTION.falls.streak === 1);
  assert.ok(WATER_MOTION.sea.swell > 1);
});

test('foam follows how strong the stream is', () => {
  assert.ok(waterFoam('falls', 1) > waterFoam('falls', 0.4) && waterFoam('falls', 0.4) > waterFoam('falls', 0.1));
  assert.equal(waterFoam('falls', 1), WATER_MOTION.falls.foam);
  assert.ok(waterFoam('falls', 0) > 0);
  assert.ok(waterFoam('rapids', 1) > waterFoam('rapids', 0.2));
  assert.equal(waterFoam('river', 0.4), 0);
  assert.ok(waterFoam('river', 1) > 0 && waterFoam('river', 1) < waterFoam('rapids', 1));
  assert.equal(waterFoam('still', 1), 0);
  assert.equal(waterFoam('sea', 0.1), WATER_MOTION.sea.foam);
  assert.ok(Number.isFinite(waterFoam('nonsense', 'much')));
});

test('an animal rings the water now and then, from its first stroke', () => {
  assert.equal(wakeRingDue(undefined, 5), true);
  assert.equal(wakeRingDue(5, 5.4), false);
  assert.equal(wakeRingDue(5, 6), true);
});

test('an animal never takes the place of a creature\'s ring still spreading', () => {
  const rings = new Float32Array(3 * 4).fill(-99), keeps = [true, false, true];
  rings[2] = 10; rings[6] = 10; rings[10] = 10;
  assert.equal(ringSlot(keeps, rings, 10.5, 0, true), 0);
  assert.equal(ringSlot(keeps, rings, 10.5, 0, false), 1);
  assert.equal(ringSlot([true, true, true], rings, 10.5, 0, false), -1);
  assert.equal(ringSlot([true, true, true], rings, 12, 2, false), 2);
});

test('a fall has foam only at its foot, and nothing times the clock by where it is', () => {
  const frag = WATER_SHADERS.full, part = frag.slice(frag.indexOf('float clots, foam'), frag.indexOf('} else {', frag.indexOf('float clots, foam')));
  assert.ok(part.includes('band = way < land'), 'foam where it lands');
  assert.ok(part.includes('crest'), 'and on the rings it throws out');
  assert.ok(frag.includes('float land = mix(0.78, 0.86, uStrength)'), 'a stronger fall lands no further up');
  assert.ok(!part.includes('rough'), 'wave height makes no foam on its face');
  assert.ok(!part.includes('lip'));
  assert.ok(!/uTime[^;]*(foot|way)/.test(part), 'no shear');
  assert.ok(part.includes('bubbles('), 'foam is made of bubbles');
  assert.ok(part.includes('thick > 0.01'), 'worked out only where there is foam');
  assert.ok(frag.includes('min(uCurrent, 2.0)'), 'speed does not grow the waves without end');
});

test('the timing of the flow never bends the pattern into arcs, even at its swiftest', () => {
  assert.ok(flowBend(1) < 0.25, `got ${flowBend(1)}`);
  assert.ok(flowBend(0.4) < flowBend(1));
});

test('the sea has swells of its own and foam only from its surf and crests', () => {
  assert.equal(WATER_MOTION.sea.sea, 1);
  assert.equal(WATER_MOTION.river.sea, undefined);
  const frag = WATER_SHADERS.full;
  assert.ok(frag.includes('if (uSea > 0.5) {') && frag.includes('swashRun(u)'), 'waves that run up the shore and draw back');
  assert.ok(!frag.includes('foamLace'), 'foam is not a sheet with holes in it');
  assert.ok(!frag.includes('float fine ='), 'no grain pinned in place');
  assert.ok(frag.includes('merged = waveJoin(merged, front'), 'waves that meet become one front');
  assert.ok(!frag.includes('wash +='), 'no wave drawn over another');
  assert.ok(frag.includes('shoal * 26.0') && frag.includes('breaking = (1.0 - smoothstep(0.34, 0.62, depth))'), 'waves shoal in along the shore and break in the shallows');
  assert.ok(frag.includes('float depth = flowed.x'), 'colour and waves go by depth');
  assert.ok(frag.includes('texture2D(uSand, tile)'), 'the beach is the sand floor\'s own painted tile');
  assert.ok(frag.includes('float line = uBeach > 0.5 ? shoreLine(w, mask.b)') && frag.includes('float shoreAway = uBeach > 0.5 ? shoreLine(w, mask.b)'), 'the waves and the sand share one smooth line');
  assert.ok(frag.includes('float shoreLine(vec2 w, float away)'), 'the water and a look on it share one waterline');
  assert.ok(frag.includes('uBedColour > 0.5 ? 7.0 : 0.0'), 'a painted water floor gives its colour, not its baked waves');
  assert.ok(frag.includes('mask.b + mask.b * '), 'the beach fades to nothing at the region\'s very edge, whatever the noise');
  assert.ok(frag.includes('0.09 * uSoft'), 'as wide as its edge softness');
  assert.ok(frag.includes('(1.0 - smoothstep(0.62, 0.86, mask.b))'), 'no shore wash out in open water');
  assert.ok(/vec2 foamWeb[\s\S]*?bubbles\(p \* 5\.5, uTime[\s\S]*?\)\.y/.test(frag), 'old foam is threads between the cells, not holes in a film');
  assert.ok(frag.includes('float thick = clamp(fresh * 1.2'), 'new foam is solid, old foam is thin: it goes by thinning, not by fading to grey');
  assert.ok(frag.includes('float fresh = 1.0 - (1.0 - min(caps, 1.0))'), 'all the foam is one web');
  assert.ok(frag.includes('if (fresh > 0.01)'), 'worked out only where there is foam');
  assert.ok(frag.includes('float sunHere = uSun * sunReach(vWorld)'), 'no glare from a sun a wall or a tree is shading');
  assert.ok(frag.indexOf('uFishSwing[i]') > 0 && frag.indexOf('uFishSwing[i]') < frag.indexOf('The sky on what tilts') && frag.indexOf('The sky on what tilts') < frag.indexOf('foamWeb(w, fresh)'.replace('foamWeb', 'vec2 web = foamWeb')), 'fish are drawn under the light and the foam');
  assert.ok(/vec2 off = seen - fish\.xy/.test(frag), 'and bent by the waves as the bed is');
  assert.ok(frag.includes('strike *= (1.0 - smoothstep(waterline + 0.02'), 'a wave splashes only where it reaches the shore');
  assert.ok(frag.includes('if (strike > 0.01)') && frag.includes('spray = max(spray, strike * 0.3)'), 'with droplets, and spray going off with the wind');
  assert.ok(frag.includes('caps *= offshore; wash *= swashed; bore *= afloat; spray *= afloat;'), 'no foam starts on the sand: waves only run up it from the water');
  assert.ok(frag.includes('smoothstep(0.0, 0.3, fresh) - 0.12'), 'no clumps of foam out where there is hardly any');
  assert.ok(frag.includes('noise(p * 8.0 + 41.0)'), 'threads have gaps, so they do not close into cells');
  assert.ok(frag.includes('float blown = dot(uWindDir, toDeep)') && frag.includes('if (spray > 0.01)'), 'spray goes off the crest with the wind');
  assert.ok(frag.includes('1.0 / max(uPix, 1.0)'), 'threads too fine for the zoom are left out, so they do not shimmer');
  assert.ok(frag.includes('uBeach > 0.5') && frag.includes('calm * seaEdge'), 'a beach, whose edge hides the shape of the region');
  assert.ok(frag.includes('smoothstep(0.2, 0.45, rough) * smoothstep(0.42, 0.62, clots)'), 'river foam needs rough water, not just noise');
  assert.ok(!frag.includes('clots + rough'));
  assert.ok(frag.includes('max(uWind, 0.45)'), 'never still, wind or none');
  assert.ok(frag.includes('one = uSwellDir'), 'its waves can be set their own way');
  assert.ok(/float face = normalize\(vec3\(-slope/.test(frag) && !/float face[^;]*heave/.test(frag), 'a swell is too broad to glint, or a whole crest would flash');
});

test('foam is drawn last, after the light on the waves', () => {
  for (const frag of [WATER_SHADERS.full, WATER_SHADERS.simple]) { assert.ok(frag.indexOf('float clots') > frag.indexOf('A flame near')); assert.ok(frag.indexOf('float clots') < frag.indexOf('Where it has frozen')); }
});

test('the shaders are whole, and the simple one lacks the costly parts', () => {
  for (const frag of [WATER_SHADERS.full, WATER_SHADERS.simple]) assert.ok(!frag.includes('${'));
  assert.ok(WATER_SHADERS.full.includes('#define FULL 1'));
  assert.ok(WATER_SHADERS.simple.includes('#define FULL 0'));
});

test('a beach drawn inside the water keeps its crabs on its sand, inside the shore', async () => {
  const { beachBand } = await import('../../../scripts/engines/motion/coast.mjs');
  const band = beachBand(100), onSand = (fromEdge) => { const on = fromEdge + band.line; return on < 0 && on > -band.width; };
  assert.equal(onSand(20), true);
  assert.equal(onSand(-10), false, 'not out on the land');
  assert.equal(onSand(60), false, 'not in the water');
});

test('a sea with no beach has the edge of its region for a shore', () => {
  for (const frag of [WATER_SHADERS.full, WATER_SHADERS.simple]) assert.match(frag, /float line = uBeach > 0\.5 \? shoreLine\(w, mask\.b\) : mask\.g/);
  assert.doesNotMatch(WATER_SHADERS.full, /else seaEdge/);
});

test('a fish in the water has no line running out past its nose', () => {
  for (const frag of [WATER_SHADERS.full, WATER_SHADERS.simple]) assert.match(frag, /smoothstep\(0\.9, 1\.05, abs\(along\)\)/);
});

test('moving water stays inside its region and out of its holes, however soft its edge', async () => {
  const { heldInside, WATER_SHADERS: S } = await import('../../../scripts/engines/motion/water-engine.mjs');
  // Across: outside the region, its edge, inside, a hole, inside.
  const soft = Uint8Array.from([60, 128, 255, 200, 255]), sharp = Uint8Array.from([0, 128, 255, 0, 255]), held = heldInside(soft, sharp);
  assert.deepEqual([...held.data], [0, 128, 255, 0, 255]);
  assert.equal(held.peak, 1);
  assert.ok(Math.abs(heldInside(Uint8Array.from([100, 128]), Uint8Array.from([255, 255])).peak - 128 / 255) < 1e-9, 'a stream narrower than its blur: as full as it gets');
  for (const frag of [S.full, S.simple]) { assert.match(frag, /uniform float uPeak;/); assert.match(frag, /smoothstep\(uPeak \* 0\.4, uPeak \* 0\.7, mask\.r\)/); }
});

test('a region standing over water is taken out of it, not made a hole in it', async () => {
  const { readFileSync } = await import('node:fs');
  const engine = readFileSync(new URL('../../../scripts/engines/motion/water-engine.mjs', import.meta.url), 'utf8'), main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(engine, /takenOut\(held\.data,/, 'taken out of what shows, not made a hole: one past the water\'s edge would fill in on the land beyond');
  assert.ok(!/shapeOf\([^\n]*cuts\)/.test(engine), 'only what shows is cut: the water, its waves and its shores run on beneath');
  assert.match(engine, /\(spec\.over \?\? \[\]\)\.map\(\(o\) => \[o\.areas,/, 'changing the dock redraws the water');
  assert.ok(main.includes('box("overWater")'), 'the box');
  assert.ok(main.includes('r.flags?.[ID]?.overWater === true'), 'off unless ticked');
  assert.ok(main.includes('!onBeach(x, y) && !overDock(x, y)'), 'nothing swims under it');
  assert.ok(main.includes('if (overWater || regionFloor('), 'ticking it is noticed at once');
});

test('how far the middle of a sea lies from its shore', async () => {
  const { deepestInside } = await import('../../../scripts/engines/motion/water-engine.mjs');
  const full = (w, h) => new Uint8Array(w * h).fill(255);
  assert.equal(deepestInside(full(9, 9), 9, 9), 5, 'the middle of a square, its sides all shore');
  assert.equal(deepestInside(full(21, 5), 21, 5), 3, 'a long narrow one goes by its width');
  assert.ok(deepestInside(full(9, 9), 9, 9, { left: true, right: true, top: true, bottom: true }) >= 18, 'all map: no shore at all');
  assert.equal(deepestInside(full(5, 9), 5, 9, { top: true, bottom: true }), 3, 'open at both ends: still its width');
  const cut = full(11, 11); for (let y = 0; y < 11; y++) cut[y * 11 + 5] = 0;
  assert.equal(deepestInside(cut, 11, 11), 3, 'a dock across it halves it');
  assert.equal(deepestInside(new Uint8Array(16), 4, 4), 0, 'nothing there');
});

test('a sea keeps its usual long shore unless it is too narrow for it', async () => {
  const { seaBlurs } = await import('../../../scripts/engines/motion/water-engine.mjs');
  assert.deepEqual(seaBlurs(1000, 100), { shore: 150, deep: 350 }, 'wide water: as it always was');
  const narrow = seaBlurs(200, 100);
  assert.equal(narrow.shore, 100);
  assert.equal(narrow.deep, 120, 'its middle gets away from the shore');
  for (const frag of [WATER_SHADERS.full, WATER_SHADERS.simple]) if (frag.includes('float shoal')) { assert.ok(!frag.includes('uFronts'), 'too narrow for waves all round: they come from one side'); }
});

test('a sea too small for an open sea of its own, or told which way, has its waves come from one side', () => {
  for (const frag of [WATER_SHADERS.full, WATER_SHADERS.simple]) if (frag.includes('float shoal =')) {
    assert.ok(frag.includes('6.28318 * (uWaveClock - dot(w, one) / uWaveGap)'), 'fronts run the way the waves go, not out from its middle');
    assert.ok(frag.includes('-dot(uSwellDir, toDeep)'), 'and break on the shore they run into');
    assert.ok(frag.includes('void breaker(vec2 w, float from, vec2 dir'), 'fronts from one side');
    assert.ok(frag.includes('smoothstep(0.03, 0.3, uSeaState)'), 'none in a light air: only ripples');
    assert.ok(frag.includes('exp(-behind / combed)'), 'foam thinning behind its front');
    assert.ok(frag.includes('1.0 - smoothstep(thin * 0.5, thin * 1.02 + 0.03, cellsSmall)'), 'opening from solid into lace as it thins');
    assert.ok(frag.includes('float shoreAhead ='), 'and only where a shore lies ahead');
    assert.ok(frag.includes('float gust = smoothstep') && frag.includes('float ripples ='), 'and air on the water even when it is calm');
    assert.ok(frag.includes('* facing * swashed * uBeach'), 'no wash on a shore that is not drawn: it would float out on the water');
    assert.ok(frag.includes('clamp(uGrid / 70.0, 1.0, 3.0)'), 'foam as fine on a map with big squares');
  }
  const source = readFileSync(new URL('../../../scripts/engines/motion/water-engine.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('uAimed: blurs && (Number.isFinite(spec.waves) || blurs.deep < size * 3.5) ? 1 : 0'));
});

test('a dock throws its shadow by how far it stands above the water', async () => {
  const { overLiftOf, WATER_SHADERS: S } = await import('../../../scripts/engines/motion/water-engine.mjs');
  assert.equal(overLiftOf({ above: 5, water: 0, distance: 5, grid: 100 }), 45, 'a square up');
  assert.ok(overLiftOf({ above: 10, water: 0, distance: 5, grid: 100 }) > overLiftOf({ above: 5, water: 0, distance: 5, grid: 100 }), 'higher, longer');
  assert.equal(overLiftOf({ above: 10, water: 5, distance: 5, grid: 100 }), 45, 'the difference counts, not the height');
  assert.equal(overLiftOf({ above: 0, water: 0, distance: 5, grid: 100 }), 15, 'right on the water: a little');
  assert.equal(overLiftOf({ above: 0, water: 20, distance: 5, grid: 100 }), 15, 'below it: a little');
  assert.equal(overLiftOf({ above: 500, water: 0, distance: 5, grid: 100 }), 300, 'a few squares at most');
  assert.equal(overLiftOf({ above: -Infinity, water: 0, distance: 5, grid: 100 }), 15, 'no height set');
  for (const frag of [S.full, S.simple]) { assert.match(frag, /sunHere \*= 1\.0 - min\(1\.0, overShade/, 'no sun, so no glitter, in its shadow'); assert.match(frag, /uToSun \* uOverLift/, 'away from the sun'); }
});

test('each floor has its own shadows over water, and a region keeps its choice for each', async () => {
  const { OVER_SHADOWS, overShadowChoices, overShadowOf } = await import('../../../scripts/engines/motion/region-steps.mjs');
  assert.deepEqual(overShadowChoices('wood').map(([k]) => k), ['planks', 'slats', 'beams', 'solid']);
  assert.deepEqual(overShadowChoices('stone').map(([k]) => k), ['solid', 'arches']);
  assert.deepEqual(overShadowChoices('glass').map(([k]) => k), ['stained', 'frosted', 'leaded']);
  assert.deepEqual(overShadowChoices('unknown').map(([k]) => k), ['solid']);
  for (const floor of ['wood', 'stone', 'metal', 'glass', 'ice', 'grass', 'dirt', 'mud', 'sand', 'pebbles', 'snow']) for (const [key, name] of overShadowChoices(floor)) { assert.ok(OVER_SHADOWS.includes(key), key); assert.ok(name, key); }
  assert.equal(overShadowOf({}, 'wood').kind, 'planks', 'its usual');
  const own = { overShadows: { wood: 'beams', stone: 'arches' } };
  assert.equal(overShadowOf(own, 'wood').kind, 'beams');
  assert.equal(overShadowOf(own, 'stone').kind, 'arches', 'a choice for each');
  assert.equal(overShadowOf({ overShadows: { wood: 'arches' } }, 'wood').kind, 'planks', 'not one of this floor\'s');
  assert.deepEqual([overShadowOf({ overShadowSoft: 9, overShadowDark: 0 }, 'wood').soft, overShadowOf({ overShadowSoft: 9, overShadowDark: 0 }, 'wood').dark], [1, 0.1], 'kept in range');
  assert.equal(overShadowOf({}, 'wood').dark, 0.45);
  assert.ok(OVER_SHADOWS.length <= 15, 'blue holds them with their way, in steps of 8');
});

test('water runs a little way under a painted dock, and up to the edge of a plain one', async () => {
  const { takenOut } = await import('../../../scripts/engines/motion/water-engine.mjs');
  const row = () => Uint8Array.from([255, 255, 255, 255, 255, 255, 255]), cut = Uint8Array.from([0, 0, 255, 255, 255, 0, 0]);
  assert.deepEqual([...takenOut(row(), cut, 7, 1, 0)], [255, 255, 0, 0, 0, 255, 255], 'to its very edge');
  assert.deepEqual([...takenOut(row(), cut, 7, 1, 1)], [255, 255, 255, 0, 255, 255, 255], 'a cell short on each side');
  assert.deepEqual([...takenOut(Uint8Array.from([0, 0, 0]), Uint8Array.from([0, 255, 0]), 3, 1, 0)], [0, 0, 0], 'never adds water');
});

test('waves from one side come as often as the wind says, and never faster for it', async () => {
  const { wavePeriod } = await import('../../../scripts/engines/motion/water-engine.mjs');
  assert.equal(wavePeriod(0), 2.5, 'choppy in a light air');
  assert.equal(wavePeriod(1), 8, 'long in a gale');
  assert.ok(wavePeriod(0.5) > 4.5 && wavePeriod(0.5) < 6, 'a fresh breeze, about every five seconds');
  assert.equal(wavePeriod(undefined), 2.5);
  assert.equal(wavePeriod(9), 8);
});

test('foam cells repeat at their edges and come out the same on every screen', async () => {
  const { foamCells } = await import('../../../scripts/engines/motion/water-engine.mjs');
  const size = 64, a = foamCells(size, 8);
  assert.deepEqual(a, foamCells(size, 8), 'the same each time');
  assert.equal(a.length, size * size * 4);
  const red = (x, y) => a[(y * size + x) * 4];
  let jump = 0, edge = 0; for (let y = 0; y < size; y += 1) { jump = Math.max(jump, Math.abs(red(0, y) - red(size - 1, y))); edge = Math.max(edge, Math.abs(red(0, y) - red(1, y))); }
  assert.ok(jump <= edge * 2 + 8, 'no seam where the tile meets itself');
  const walls = []; for (let i = 1; i < a.length; i += 4) walls.push(a[i]);
  assert.ok(Math.min(...walls) < 20 && Math.max(...walls) > 100, 'walls and the room between them');
});

test('waves keep their pace on a small water, and turn slowly with the wind', async () => {
  const { turnedToward, waveGap } = await import('../../../scripts/engines/motion/water-engine.mjs');
  assert.equal(waveGap(5, 100), 4.5, 'open water: by how often they come');
  assert.ok(Math.abs(waveGap(8, 6) - 3.3) < 1e-9, 'a small water still sees them');
  assert.equal(waveGap(8, 1), 1.5);
  const turned = turnedToward([1, 0], [0, 1], 0.05);
  assert.ok(turned[1] > 0 && turned[1] < 0.1, 'a little way');
  assert.ok(Math.abs(Math.hypot(...turned) - 1) < 1e-9, 'a unit length');
  assert.deepEqual(turnedToward([1, 0], [-1, 0], 0.5), [-1, 0], 'never nothing, turned right round');
});
