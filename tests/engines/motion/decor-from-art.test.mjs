import test from 'node:test';
import assert from 'node:assert/strict';
import { readRelief, reliefPixels, silhouettePixels, greenShare, burningShare, snowCover, underConditions, decorationFromArt, shineShare, SHINES_ENOUGH } from '../../../scripts/engines/motion/decor-from-art.mjs';

// A picture W by H: a disc of one colour on nothing, with a darker cross cut into it (a join between boards).
const W = 64, H = 64;
function disc([r, g, b], { cross = true } = {}) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.hypot(x - 32, y - 32) > 24) continue;
    const i = (y * W + x) * 4, cut = cross && (Math.abs(x - 32) < 2 || Math.abs(y - 32) < 2) ? 0.35 : 1;
    data[i] = r * cut; data[i + 1] = g * cut; data[i + 2] = b * cut; data[i + 3] = 255;
  }
  return data;
}
const at = (x, y) => y * W + x;
const BROWN = [150, 100, 55], GREEN = [70, 140, 50], GREY = [128, 130, 133];

test('a picture is read as standing nowhere outside its outline, and highest well inside it', () => {
  const { height, shine } = readRelief(disc(BROWN, { cross: false }), W, H);
  assert.equal(height[at(2, 2)], 0); assert.equal(height[at(62, 32)], 0);
  assert.ok(height[at(40, 40)] > height[at(32 + 22, 32)], 'its middle stands above its rim');
  assert.ok(height.every((v) => v >= 0 && v <= 1) && shine.every((v) => v >= 0 && v <= 1));
});

test('what is painted dark is read as down in: a join lies below the boards beside it', () => {
  const { height } = readRelief(disc(BROWN), W, H);
  assert.ok(height[at(32, 44)] < height[at(38, 44)] - 0.03);
});

test('grey is read as likelier to shine than strong colour', () => {
  const grey = readRelief(disc(GREY, { cross: false }), W, H).shine[at(40, 40)], brown = readRelief(disc(BROWN, { cross: false }), W, H).shine[at(40, 40)];
  assert.ok(grey > 0.3 && grey > brown * 3);
});

test('the relief for the shader holds height in red, shine in green and the outline in alpha', () => {
  const px = reliefPixels(disc(GREY), W, H);
  assert.equal(px[at(2, 2) * 4 + 3], 0); assert.equal(px[at(40, 40) * 4 + 3], 255);
  assert.ok(px[at(40, 40) * 4] > 60 && px[at(40, 40) * 4 + 1] > 60 && px[at(40, 40) * 4 + 2] === 0);
});

test('how much of a picture shines says whether it is worth drawing lit: iron does, wood and leaves do not', () => {
  const of = (colour) => shineShare(reliefPixels(disc(colour, { cross: false }), W, H), W, H);
  assert.ok(of(GREY) > 0.5, 'grey iron'); assert.equal(of(BROWN), 0); assert.equal(of(GREEN), 0);
  assert.ok(of(GREY) >= SHINES_ENOUGH && of(BROWN) < SHINES_ENOUGH);
  // A barrel: wood with one iron hoop across it.
  const barrel = disc(BROWN, { cross: false }); for (let y = 30; y < 34; y++) for (let x = 12; x < 52; x++) { const i = (y * W + x) * 4; if (barrel[i + 3]) { barrel[i] = 128; barrel[i + 1] = 130; barrel[i + 2] = 133; } }
  const share = shineShare(reliefPixels(barrel, W, H), W, H);
  assert.ok(share >= SHINES_ENOUGH && share < 0.3, `a hoop is enough (${share})`);
  assert.equal(shineShare(new Uint8ClampedArray(W * H * 4), W, H), 0, 'an empty picture shines nowhere');
});

test('the outline for shadows is white where the picture is and nothing where it is not', () => {
  const px = silhouettePixels(disc(BROWN), W, H);
  assert.deepEqual([...px.slice(at(40, 40) * 4, at(40, 40) * 4 + 4)], [255, 255, 255, 255]);
  assert.deepEqual([...px.slice(at(2, 2) * 4, at(2, 2) * 4 + 4)], [0, 0, 0, 0]);
});

test('a bush is told from a barrel by its green', () => {
  assert.ok(greenShare(disc(GREEN), W, H) > 0.8); assert.equal(greenShare(disc(BROWN), W, H), 0);
});

test('conditions give a new picture and leave the first as it was', () => {
  const first = disc(GREEN), copy = Uint8ClampedArray.from(first), out = underConditions(first, W, H, { season: 'autumn', wet: 1, snow: 1 });
  assert.deepEqual(first, copy); assert.notDeepEqual(out, first);
  assert.deepEqual(underConditions(first, W, H, {}), first, 'summer, dry and clear changes nothing');
});

test('autumn turns greens toward red and leaves brown alone', () => {
  const i = at(40, 40) * 4, leaf = underConditions(disc(GREEN), W, H, { season: 'autumn' }), wood = underConditions(disc(BROWN), W, H, { season: 'autumn' });
  assert.ok(leaf[i] > leaf[i + 1], 'no longer green'); assert.deepEqual([...wood.slice(i, i + 3)], BROWN);
  const dead = underConditions(disc(GREEN), W, H, { season: 'winter' });
  assert.ok(Math.max(dead[i], dead[i + 1], dead[i + 2]) - Math.min(dead[i], dead[i + 1], dead[i + 2]) < 60, 'winter drains it');
});

test('rain darkens and never touches the outline', () => {
  const first = disc(BROWN), wet = underConditions(first, W, H, { wet: 1 }), i = at(40, 40) * 4;
  assert.ok(wet[i] < first[i] && wet[i + 1] < first[i + 1]); assert.equal(wet[i + 3], 255); assert.equal(wet[at(2, 2) * 4 + 3], 0);
});

test('snow lies in part at half a fall, all over at a full one, and on tops before sides', () => {
  const first = disc(BROWN, { cross: false }), { height } = readRelief(first, W, H);
  const white = (px) => { let n = 0, seen = 0; for (let i = 0; i < W * H; i++) if (first[i * 4 + 3]) { seen++; if (px[i * 4] > 200 && px[i * 4 + 2] > 200) n++; } return n / seen; };
  const half = white(underConditions(first, W, H, { snow: 0.5, height })), full = white(underConditions(first, W, H, { snow: 1, height }));
  assert.ok(half > 0.1 && half < 0.85, `half a fall covers part (${half})`); assert.ok(full > 0.95, `a full fall covers it (${full})`);
  // The same picture with its height turned over: snow goes where the height is.
  const high = new Float32Array(W * H).fill(1), low = new Float32Array(W * H);
  assert.ok(white(underConditions(first, W, H, { snow: 0.45, height: high })) > white(underConditions(first, W, H, { snow: 0.45, height: low })));
});

test('a light fall only dusts, and a heavy one still leaves some of the piece showing', () => {
  const first = disc(BROWN, { cross: false }), { height } = readRelief(first, W, H);
  const share = (snow) => { const c = snowCover(first, W, H, { snow, height }); let n = 0, seen = 0; for (let i = 0; i < W * H; i++) if (first[i * 4 + 3]) { seen++; if (c[i] > 0.5) n++; } return n / seen; };
  const [dust, half, heavy, full] = [0.25, 0.5, 0.8, 1].map(share);
  assert.ok(dust < 0.3, `dust ${dust}`); assert.ok(dust < half && half < heavy && heavy <= full); assert.ok(heavy < 0.97, `heavy ${heavy}`);
  assert.equal(snowCover(first, W, H, { snow: 0 }).some((v) => v > 0), false);
});

test('no snow lies on a fire or close round it, though it lies on the stones further out', () => {
  // A wide grey hearth with a glowing heart.
  const fire = disc(GREY, { cross: false });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - 32, y - 32) < 7) { const i = at(x, y) * 4; fire[i] = 250; fire[i + 1] = 170; fire[i + 2] = 40; }
  assert.ok(burningShare(fire, W, H) > 0.004); assert.equal(burningShare(disc([230, 120, 30]), W, H), 0, 'a carrot is not a fire');
  const c = snowCover(fire, W, H, { snow: 1 }), cold = snowCover(disc(GREY, { cross: false }), W, H, { snow: 1 });
  assert.equal(c[at(32, 32)], 0); assert.equal(c[at(36, 32)], 0); assert.ok(c[at(32 + 21, 32)] > 0.9, 'the rim is under snow'); assert.ok(cold[at(32, 32)] > 0.9);
  const made = decorationFromArt({ data: fire, width: W, height: H }, { snow: 1 });
  assert.equal(made.burning, true); assert.ok(made.art[at(32, 32) * 4 + 2] < 120, 'the fire is still fire');
});

test('snow is matt and smooths what is under it: no shine, and the joins gone from the relief', () => {
  const data = disc(GREY), bare = decorationFromArt({ data, width: W, height: H }, {}), snowed = decorationFromArt({ data, width: W, height: H }, { snow: 1 });
  const i = at(40, 40) * 4, dip = (px) => px[at(38, 44) * 4] - px[at(32, 44) * 4];
  assert.ok(bare.relief[i + 1] > 60); assert.ok(snowed.relief[i + 1] < 8);
  assert.ok(dip(bare.relief) > 8 && dip(snowed.relief) < dip(bare.relief) * 0.6);
});

test('everything the engines need comes from the one picture, and only what grows turns', () => {
  const bush = decorationFromArt({ data: disc(GREEN), width: W, height: H }, { season: 'autumn' }), barrel = decorationFromArt({ data: disc(GREEN.map((v, k) => (k === 1 ? 90 : v + 60))), width: W, height: H }, { season: 'autumn' });
  for (const k of ['art', 'relief', 'silhouette']) assert.equal(bush[k].length, W * H * 4);
  assert.equal(bush.growing, true); assert.ok(bush.art[at(40, 40) * 4] > bush.art[at(40, 40) * 4 + 1]);
  assert.equal(barrel.growing, false);
  // A cart of cabbages: some green on it, not a plant — its greens stay. Told so by hand, it turns.
  const cart = disc(BROWN); for (let y = 28; y < 36; y++) for (let x = 36; x < 44; x++) { const i = at(x, y) * 4; cart[i] = 70; cart[i + 1] = 140; cart[i + 2] = 50; }
  const kept = decorationFromArt({ data: cart, width: W, height: H }, { season: 'autumn' }), told = decorationFromArt({ data: cart, width: W, height: H }, { season: 'autumn' }, { growing: true });
  assert.equal(kept.art[at(40, 32) * 4 + 1], 140); assert.ok(told.art[at(40, 32) * 4] > told.art[at(40, 32) * 4 + 1]);
});
