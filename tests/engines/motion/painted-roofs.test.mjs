import test from 'node:test';
import assert from 'node:assert/strict';
import { roomAt, roofsOf, roofLook, under, crosses, ROOM_MOST } from '../../../scripts/engines/motion/roof-looks.mjs';
import { ROOF_IDS, ROOF_FORM_IDS, ROOF_CHOICES, ROOF_FORM_CHOICES, ROOF_KINDS, ROOF_FORMS, formFor, formFits, roofFor, hippedRoof, gabledRoof, shedRoof, pyramidRoof, conicalRoof, chimneyAt, paintRoofPicture, alongFace } from '../../../scripts/engines/motion/roof-paint.mjs';
import { createPaintedRoofs, FADED, FADE_TIME } from '../../../scripts/engines/motion/painted-roofs.mjs';

// Roi: "lets also add roofs so we can create full buildings, i remind you that all assets should support weather and
// seasons" — and later, that every roof looked the same, which is what the forms are for.

// A room four squares by three, walled all round, on a 100px grid.
const ROOM_WALLS = [
  { c: [100, 100, 500, 100] }, { c: [500, 100, 500, 400] },
  { c: [500, 400, 100, 400] }, { c: [100, 400, 100, 100] },
];
const BOUNDS = { x: 0, y: 0, w: 1000, h: 800 };

// ---------------------------------------------------------------------------------------------------- the room

test('a click inside a walled room finds that room', () => {
  const room = roomAt({ x: 300, y: 250 }, ROOM_WALLS, { grid: 100, bounds: BOUNDS });
  assert.ok(room, 'it found one');
  assert.deepEqual([room.x, room.y, room.w, room.h], [100, 100, 400, 300]);
  assert.equal(room.squares, 12, 'four by three');
});

test('a click in the open air is not a room', () => {
  assert.equal(roomAt({ x: 800, y: 700 }, ROOM_WALLS, { grid: 100, bounds: BOUNDS }), null);
});

test('a room with a gap in its wall is not a room: it leaks out', () => {
  const leaky = ROOM_WALLS.slice(1);
  assert.equal(roomAt({ x: 300, y: 250 }, leaky, { grid: 100, bounds: BOUNDS }), null);
});

test('a room is only as big as the walls allow, however much space there is', () => {
  const split = [...ROOM_WALLS, { c: [300, 100, 300, 400] }];
  const left = roomAt({ x: 200, y: 250 }, split, { grid: 100, bounds: BOUNDS });
  const right = roomAt({ x: 400, y: 250 }, split, { grid: 100, bounds: BOUNDS });
  assert.deepEqual([left.x, left.w], [100, 200], 'the near side of the partition');
  assert.deepEqual([right.x, right.w], [300, 200], 'and the far side');
});

test('a space too big to be a room is given up on rather than walked forever', () => {
  assert.equal(roomAt({ x: 300, y: 250 }, [], { grid: 100, bounds: null, most: 50 }), null);
  assert.ok(ROOM_MOST > 100, 'but a real room has room to be found');
});

test('nonsense asks get nothing, not a throw', () => {
  assert.equal(roomAt(null, ROOM_WALLS, { grid: 100 }), null);
  assert.equal(roomAt({ x: Number.NaN, y: 0 }, ROOM_WALLS, { grid: 100 }), null);
  assert.equal(roomAt({ x: 1, y: 1 }, null, { grid: 0 }), null);
});

test('two segments cross, or they do not', () => {
  assert.equal(crosses([0, 0], [10, 0], [5, -5], [5, 5]), true);
  assert.equal(crosses([0, 0], [10, 0], [5, 1], [5, 5]), false, 'not if it stops short');
  assert.equal(crosses([0, 0], [10, 0], [0, 1], [10, 1]), false, 'nor if they are parallel');
});

// ---------------------------------------------------------------------------------------------------- the roofs

test('a scene keeps its roofs, and nonsense in the flags is left out', () => {
  const roofs = roofsOf({ roofs: [
    { id: 'a', x: 100, y: 100, w: 400, h: 300, kind: 'thatch' },
    { id: 'b', x: 0, y: 0, w: 0, h: 10 },
    { id: 'c', x: 'nope', y: 0, w: 10, h: 10 },
    null,
  ] });
  assert.equal(roofs.length, 1);
  assert.equal(roofs[0].kind, 'thatch');
});

test('a roof with no kind takes the one its walls would carry, and a shape to fit its room', () => {
  const [long] = roofsOf({ roofs: [{ id: 'a', x: 0, y: 0, w: 600, h: 200, material: 'timber' }] }, { grid: 100 });
  assert.equal(long.kind, roofFor('timber'));
  assert.equal(long.form, 'gable', 'a long room gables');
  const [square] = roofsOf({ roofs: [{ id: 'b', x: 0, y: 0, w: 300, h: 300 }] }, { grid: 100 });
  assert.equal(square.form, 'pyramid', 'a small square one comes to a point');
  assert.equal(formFor({ w: 200, h: 100 }, { grid: 100 }), 'shed', 'and a little narrow one leans to');
});

test('changing a roof changes what it is, so it is painted again', () => {
  const one = (extra) => roofsOf({ roofs: [{ id: 'a', x: 0, y: 0, w: 400, h: 200, kind: 'tile', ...extra }] })[0];
  const was = one({});
  assert.notEqual(one({ kind: 'slate' }).key, was.key);
  assert.notEqual(one({ age: 0.8 }).key, was.key);
  assert.notEqual(one({ chimney: 'brick' }).key, was.key);
  assert.notEqual(one({ w: 500 }).key, was.key);
  assert.equal(one({}).key, was.key, 'and the same roof is the same roof');
});

test('a cone is only put on a room it can cover', () => {
  // Roi, looking at a round roof on a long house: "Conical doesnt fit rectangular houses". Its corners were open.
  assert.equal(formFits('cone', { w: 300, h: 300 }), true, 'a tower takes one');
  assert.equal(formFits('cone', { w: 320, h: 300 }), true, 'near enough square does too');
  assert.equal(formFits('cone', { w: 1000, h: 500 }), false, 'a long house does not');
  for (const form of ['hip', 'gable', 'shed', 'pyramid']) assert.equal(formFits(form, { w: 1000, h: 200 }), true, `${form} covers whatever box it is given`);
  // Roi again, on a square room wearing a round roof with its corners in the open: "we still allow conical roof on
  // a rectangle walls\room". Square is not round: what tells them apart is how much of its own box the room fills.
  const square = { w: 400, h: 400, squares: 16 };            // fills its box: every corner is a corner
  const round = { w: 400, h: 400, squares: 12 };             // about a quarter of pi of it: a round room
  assert.equal(formFits('cone', square, { grid: 100 }), false, 'a square room keeps its corners, so no cone');
  assert.equal(formFits('cone', round, { grid: 100 }), true, 'a round one takes one');
  assert.equal(formFits('cone', { w: 400, h: 400 }, { grid: 100 }), true, 'with nothing said about the room, only its shape can be asked');
  // Roi: "i cant manage to put a circle wall to use conical roof". A tower two squares across fills every square of
  // its own box however round its walls are, so when the walls have been asked, their answer is the one that counts.
  assert.equal(formFits('cone', { w: 200, h: 200, squares: 4, round: true }, { grid: 100 }), true, 'a small tower is round if its walls are');
  assert.equal(formFits('cone', { w: 400, h: 400, squares: 12, round: false }, { grid: 100 }), false, 'and a square room is not, whatever its squares come to');
  // And one asked for anyway falls back to the shape that fits, rather than leaving the corners open.
  const [roof] = roofsOf({ roofs: [{ id: 'a', x: 0, y: 0, w: 1000, h: 500, kind: 'slate', form: 'cone' }] }, { grid: 100 });
  assert.equal(roof.form, 'gable');
  // A scene only keeps a roof's box, and a round room's box is a square one's box. So a cone has to have said for
  // itself that the room was round when it was laid; one that says nothing was laid where it did not belong.
  const [tower] = roofsOf({ roofs: [{ id: 'b', x: 0, y: 0, w: 300, h: 300, kind: 'slate', form: 'cone', round: true }] }, { grid: 100 });
  assert.equal(tower.form, 'cone', 'a cone that knows its room was round is kept');
  const [sayless] = roofsOf({ roofs: [{ id: 'c', x: 0, y: 0, w: 300, h: 300, kind: 'slate', form: 'cone' }] }, { grid: 100 });
  assert.equal(sayless.form, 'pyramid', 'one that says nothing takes the shape that fits a square room');
});

test('every face is wound the way the covering is laid on it', () => {
  // Roi: "upper part horizontal tiles, lower part vertical, why?" — because half the faces started up the fall
  // instead of along the eave. alongFace takes pts[0]->pts[1] as the eave and walks u from there to the ridge, so
  // a face wound the other way has its across and its up swapped, and its slates come out on their side.
  for (const [form, make] of Object.entries(ROOF_FORMS)) {
    const shape = make.make(0, 0, 600, 400, 20);
    for (const [i, face] of shape.faces.entries()) {
      const eaveMid = alongFace(face, 0.5, 0), up = alongFace(face, 0.5, 1);
      const fall = [up[0] - eaveMid[0], up[1] - eaveMid[1]];
      const len = Math.hypot(...fall);
      assert.ok(len > 1, `${form} face ${i}: the face has a fall to climb`);
      // Going up the face must go against the way it faces: the ridge is inward, the eave is out.
      const withAway = (fall[0] * face.away[0] + fall[1] * face.away[1]) / len;
      assert.ok(withAway < 0.2, `${form} face ${i}: climbs away from its eave, not along it (${withAway.toFixed(2)})`);
    }
  }
});

test('both slopes of a roof are laid in the same courses', () => {
  for (const form of ['hip', 'gable']) {
    const shape = ROOF_FORMS[form].make(0, 0, 600, 400, 20);
    // The two long slopes face opposite ways; their eaves are the long sides, so both run the same way on the map.
    const long = shape.faces.filter((f) => f.pts.length > 3);
    const ways = long.map((f) => {
      const a = alongFace(f, 0, 0), b = alongFace(f, 1, 0);
      const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d) || 1;
      return [Math.abs(d[0] / l) < 1e-6 ? 0 : Math.abs(d[0] / l), Math.abs(d[1] / l) < 1e-6 ? 0 : Math.abs(d[1] / l)];
    });
    for (const way of ways) assert.deepEqual(way.map((n) => +n.toFixed(3)), ways[0].map((n) => +n.toFixed(3)), `${form}: every slope's courses run the same way`);
  }
});

test('a roof keeps the colour it was painted in, and says so in its key', () => {
  const [plain] = roofsOf({ roofs: [{ id: 'a', x: 0, y: 0, w: 400, h: 300, kind: 'tile' }] }, { grid: 100 });
  const [red] = roofsOf({ roofs: [{ id: 'a', x: 0, y: 0, w: 400, h: 300, kind: 'tile', tint: '#b03a2e' }] }, { grid: 100 });
  assert.equal(plain.tint, null, 'a roof with no colour chosen keeps the covering’s own');
  assert.equal(red.tint, '#b03a2e');
  assert.notEqual(red.key, plain.key, 'a change of colour is a change of picture');
  const [junk] = roofsOf({ roofs: [{ id: 'a', x: 0, y: 0, w: 400, h: 300, kind: 'tile', tint: 'scarlet' }] }, { grid: 100 });
  assert.equal(junk.tint, null, 'and what is not a colour is not kept');
});

test('what is lying on the ground is lying on the roof', () => {
  // Roi, looking at bare slate over a snowed-in map: "i dont see weather integration on the roofs at all".
  // The snow was worked out from the calendar alone, so a scene carrying snow out of season had clean roofs.
  assert.equal(roofLook({ snow: 1 }, { season: 'summer' }).snow, 1, 'snow on the ground is snow on the roof');
  assert.equal(roofLook({ snow: 0.4 }, { season: 'winter' }).snow, 0.4, 'and the amount is the ground’s, not a guess');
  assert.equal(roofLook({ snow: 0 }, { season: 'winter' }).snow, 0, 'a winter that has not snowed leaves it bare');
  // With nothing said at all, the season still answers, as it did before.
  assert.equal(roofLook({}, { season: 'winter' }).snow, 0.9);
  assert.equal(roofLook({}, { season: 'summer' }).snow, 0);
  assert.equal(roofLook({ wet: 0.8 }, { season: 'autumn' }).wet, 0.8, 'rain darkens it too');
});

test('under says who is beneath a roof', () => {
  const room = { x: 100, y: 100, w: 400, h: 300 };
  assert.equal(under(room, 300, 250), true);
  assert.equal(under(room, 50, 250), false);
  assert.equal(under(null, 1, 1), false);
});

// ---------------------------------------------------------------------------------------------------- weather

test('a roof takes the year: snow in winter, leaves in autumn, moss with the years', () => {
  assert.ok(roofLook({}, { season: 'winter' }).snow > 0);
  assert.equal(roofLook({}, { season: 'summer' }).snow, 0);
  assert.equal(roofLook({}, { season: 'autumn' }).leaves, 0.8);
  assert.equal(roofLook({}, { season: 'summer' }).leaves, 0);
  assert.equal(roofLook({}, { season: 'summer', age: 0 }).moss, 0, 'a new roof has no moss on it');
  assert.ok(roofLook({}, { season: 'summer', age: 0.8 }).moss > 0);
  assert.equal(roofLook({}, { season: 'winter', age: 1 }).moss, 0, 'and none in a frost');
});

// ---------------------------------------------------------------------------------------------------- the shapes

test('every form is a real shape with faces and an eave', () => {
  for (const id of ROOF_FORM_IDS) {
    const shape = ROOF_FORMS[id].make(0, 0, 400, 200, 10);
    assert.ok(shape.faces.length >= 1, `${id} has faces`);
    assert.ok(shape.eave.length >= 3, `${id} has an eave`);
    assert.ok(shape.box.w > 0 && shape.box.h > 0);
  }
  assert.deepEqual(ROOF_FORM_CHOICES.map((f) => f.id).sort(), ROOF_FORM_IDS.slice().sort());
  assert.deepEqual(ROOF_CHOICES.map((c) => c.id).sort(), ROOF_IDS.slice().sort());
});

test('each form is framed the way that form is framed', () => {
  assert.equal(hippedRoof(0, 0, 400, 200, 0).faces.length, 4, 'a hip falls four ways');
  assert.equal(gabledRoof(0, 0, 400, 200, 0).faces.length, 2, 'a gable only two');
  assert.equal(shedRoof(0, 0, 400, 200, 0).faces.length, 1, 'a lean-to one');
  assert.equal(pyramidRoof(0, 0, 300, 300, 0).faces.length, 4);
  assert.ok(conicalRoof(0, 0, 300, 300, 0).faces.length > 8, 'a cone is many');
  // A cone is round, whatever room it is put on: stretched over a long room it came out an ellipse.
  const long = conicalRoof(0, 0, 800, 200, 0);
  assert.ok(Math.abs(long.box.w - long.box.h) < 1e-9, 'as wide as it is deep');
  assert.equal(long.box.w, 200, 'taking the room the narrow way');
  assert.ok(pyramidRoof(0, 0, 300, 300, 0).peak, 'and a pyramid comes to a point');
});

test("the eaves hang past the room, which is what makes it look like a building", () => {
  const tight = gabledRoof(100, 100, 400, 200, 0).box, over = gabledRoof(100, 100, 400, 200, 20).box;
  assert.equal(over.w, tight.w + 40);
  assert.equal(over.x, tight.x - 20);
});

test('a chimney stands on the ridge, or on the point', () => {
  const g = gabledRoof(0, 0, 400, 200, 0);
  assert.deepEqual(chimneyAt(g, 0), g.ridge[0]);
  assert.deepEqual(chimneyAt(g, 1), g.ridge[1]);
  const mid = chimneyAt(g, 0.5);
  assert.ok(Math.abs(mid[0] - 200) < 1e-9);
  const p = pyramidRoof(0, 0, 300, 300, 0);
  assert.deepEqual(chimneyAt(p, 0.2), p.peak, 'a pyramid has only its point to stand one on');
});

// ---------------------------------------------------------------------------------------------------- the picture

const quietContext = () => ({
  canvas: null, save() {}, restore() {}, scale() {}, translate() {}, rotate() {}, clip() {}, fill() {}, stroke() {}, beginPath() {},
  moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {}, ellipse() {}, fillRect() {},
  createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  set fillStyle(v) {}, get fillStyle() { return ''; }, set strokeStyle(v) {}, get strokeStyle() { return ''; },
  set lineWidth(v) {}, get lineWidth() { return 1; }, set lineCap(v) {}, get lineCap() { return ''; },
  set lineJoin(v) {}, get lineJoin() { return ''; }, set filter(v) {}, get filter() { return 'none'; },
  set globalAlpha(v) {}, get globalAlpha() { return 1; },
});
const quietCanvas = (w, h) => ({ width: w, height: h, getContext: () => quietContext() });

test('every covering paints, in every form, through the whole year', () => {
  for (const kind of ROOF_IDS) {
    for (const form of ROOF_FORM_IDS) {
      const picture = paintRoofPicture({ x: 100, y: 100, w: 400, h: 300 }, kind, { grid: 100, form, snow: 0.8, moss: 0.6, leaves: 0.5, wet: 0.4, soot: 0.3, chimney: 'brick' }, quietCanvas);
      assert.ok(picture, `${kind} as ${form}`);
      assert.ok(picture.box.w > 400, 'with room for the eaves and the shadow');
      assert.ok(picture.chimney, 'and it says where the smoke comes from');
    }
  }
  assert.equal(paintRoofPicture({ x: 0, y: 0, w: 0, h: 0 }, 'tile', {}, quietCanvas), null, 'a room with no size has no roof');
});

test('a roof across a whole map is painted smaller, not at its full size', () => {
  const huge = paintRoofPicture({ x: 0, y: 0, w: 20000, h: 9000 }, 'tile', { grid: 100 }, quietCanvas, 2048);
  assert.ok(huge.canvas.width <= 2048 && huge.scale < 1);
});

// ---------------------------------------------------------------------------------------------------- the layer

class Sprite {
  constructor(texture) { this.texture = texture; this.alpha = 1; this.width = 0; this.height = 0; this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }; }
  destroy() { this.destroyed = true; }
}
const PIXI = { Sprite, Texture: { from: (canvas) => ({ canvas, destroy() { this.destroyed = true; } }) } };
const newRoot = () => ({
  children: [],
  addChild(c) { c.parent = this; this.children.push(c); return c; },
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parent = null; return c; },
});
const newLayer = () => { const root = newRoot(); return { root, layer: createPaintedRoofs({ PIXI, root: () => root, grid: () => 100, make: quietCanvas }) }; };

// A canvas that keeps a note of what was rubbed out of it, so a test can see where the roof was opened.
const newCutter = () => {
  const drawn = [];
  const cutting = (w, h) => {
    const sheet = quietCanvas(w, h);
    const was = sheet.getContext;
    sheet.getContext = () => {
      const g = was();
      // The quiet context swallows `filter`; here we want to read back what was asked for.
      let soft = '';
      Object.defineProperty(g, 'filter', { configurable: true, get: () => soft, set: (v) => { soft = v; } });
      g.globalCompositeOperation = 'source-over';
      g.clearRect = () => {};
      g.closePath = () => {};
      g.drawImage = (from, ...rest) => drawn.push({ copied: from, put: rest.length >= 8 ? rest.slice(4) : null });
      g.beginPath = () => { g.path = []; };
      g.moveTo = (x, y) => g.path?.push([x, y]);
      g.lineTo = (x, y) => g.path?.push([x, y]);
      g.fill = () => { if (g.globalCompositeOperation === 'destination-out') drawn.push({ rubbed: g.path, how: g.globalCompositeOperation, soft: g.filter }); };
      return g;
    };
    return sheet;
  };
  const PIXI2 = { ...PIXI, Texture: { from: (c) => ({ canvas: c, update() { this.updated = (this.updated ?? 0) + 1; }, destroy() { this.destroyed = true; } }) } };
  const root = newRoot();
  return { drawn, root, layer: createPaintedRoofs({ PIXI: PIXI2, root: () => root, grid: () => 100, make: cutting }) };
};
const SEEN = [150, 150, 400, 150, 400, 350, 150, 350];
const ROOFS = (extra = {}) => roofsOf({ roofs: [{ id: 'a', x: 100, y: 100, w: 400, h: 300, kind: 'tile', ...extra }] });

test('a roof is laid over its room', () => {
  const { layer, root } = newLayer();
  layer.populate({ roofs: ROOFS() });
  layer.settle();
  assert.equal(root.children.length, 1);
  assert.ok(root.children[0].position.x < 100, 'its picture starts before the room, for the eaves');
  assert.equal(root.children[0].alpha, 1);
});

test('a roof fades while somebody is under it, and comes back when they leave', () => {
  const { layer, root } = newLayer();
  const roofs = ROOFS();
  layer.populate({ roofs }); layer.settle();
  const sprite = root.children[0];
  layer.cover([roofs[0].key]);
  layer.step(FADE_TIME / 3);
  assert.ok(sprite.alpha < 1 && sprite.alpha > FADED, `part way: ${sprite.alpha.toFixed(2)}`);
  layer.step(FADE_TIME);
  assert.ok(Math.abs(sprite.alpha - FADED) < 1e-9, 'down to almost nothing');
  layer.cover([]);
  layer.step(FADE_TIME);
  assert.equal(sprite.alpha, 1, 'and back when they go');
  assert.equal(layer.state.fading, 0);
});

test('a roof opens where a creature can see, and stays whole rather than fading', () => {
  const { layer, root, drawn } = newCutter();
  const roofs = ROOFS();
  layer.populate({ roofs }); layer.settle();
  const sprite = root.children[0];
  const painted = sprite.texture;
  layer.cover([roofs[0].key]); // somebody is inside, so the old behaviour would lift the whole lid
  layer.open(new Map([[roofs[0].key, [SEEN]]]));
  layer.step(FADE_TIME);
  assert.equal(sprite.alpha, 1, 'the roof does not fade: the opening is what shows the room');
  assert.notEqual(sprite.texture, painted, 'it wears a cut picture instead');
  assert.equal(layer.state.opened, 1);
  const copied = drawn.find((d) => d.copied), rubbed = drawn.find((d) => d.rubbed);
  assert.ok(copied, 'the painted roof is copied rather than painted again');
  assert.equal(rubbed.how, 'destination-out', 'and what can be seen is rubbed out of the copy');
  assert.ok(/blur/.test(rubbed.soft), 'softly, so it is not a torch beam through a ceiling');
  // The picture is painted bigger than the roof is laid, so the cut is measured in the picture's own pixels.
  const sharp = copied.copied.width / sprite.width;
  assert.ok(sharp > 1, 'the picture is painted bigger than the roof is laid');
  assert.deepEqual(rubbed.rubbed[0], [(SEEN[0] - sprite.position.x) * sharp, (SEEN[1] - sprite.position.y) * sharp], 'in the picture\'s own corner');
});

test('a step only puts back the stretch the view moved across', () => {
  const { layer, root, drawn } = newCutter();
  const roofs = ROOFS();
  layer.populate({ roofs }); layer.settle();
  const sprite = root.children[0];
  layer.open(new Map([[roofs[0].key, [SEEN]]]));
  const first = drawn.filter((d) => d.copied).at(-1);
  assert.ok(first.put, 'the first cut lays the whole picture');
  const whole = first.put[2] * first.put[3];
  // One step east: nothing at the far side of the roof has changed, so nothing there is painted again.
  const stepped = SEEN.map((n, i) => (i % 2 === 0 ? n + 20 : n));
  layer.open(new Map([[roofs[0].key, [stepped]]]));
  const again = drawn.filter((d) => d.copied).at(-1);
  assert.notEqual(again, first, 'the step is cut');
  assert.ok(again.put[2] * again.put[3] < whole, 'and puts back less than the whole roof');
  assert.ok(again.put[0] > 0 || again.put[1] > 0, 'starting where the opening is, not at the corner');
  assert.ok(sprite.texture, 'the roof still wears its cut picture');
});

test('a mask is only cut again when what can be seen has changed', () => {
  const { layer, drawn } = newCutter();
  const roofs = ROOFS();
  layer.populate({ roofs }); layer.settle();
  const same = new Map([[roofs[0].key, [SEEN]]]);
  layer.open(same);
  const once = drawn.filter((d) => d.rubbed).length;
  layer.open(new Map([[roofs[0].key, [SEEN.map((n, i) => n + (i % 2 ? 0.2 : 0.3))]]]));
  assert.equal(drawn.filter((d) => d.rubbed).length, once, 'a fraction of a pixel is not a new view');
  layer.open(new Map([[roofs[0].key, [SEEN.map((n, i) => (i % 2 ? n : n + 90))]]]));
  assert.equal(drawn.filter((d) => d.rubbed).length, once * 2, 'a step across the room is');
});

test('when nobody is looking any more the roof closes over the room again', () => {
  const { layer, root } = newCutter();
  const roofs = ROOFS();
  layer.populate({ roofs }); layer.settle();
  const sprite = root.children[0];
  const painted = sprite.texture;
  layer.open(new Map([[roofs[0].key, [SEEN]]]));
  const opened = sprite.texture;
  layer.open(new Map());
  assert.equal(sprite.texture, painted, 'the lid is back on, as it was painted');
  assert.equal(layer.state.opened, 0);
  assert.ok(opened.destroyed, 'and the cut picture is let go of, not left in the memory');
  assert.equal(root.children.length, 1, 'with nothing extra left lying on the map');
});

test('with nothing to cut a mask with, a roof falls back to lifting the whole lid', () => {
  const root = newRoot();
  // No renderer: an old client, or a canvas that has gone away under us.
  const layer = createPaintedRoofs({ PIXI, root: () => root, grid: () => 100, make: quietCanvas });
  const roofs = ROOFS();
  layer.populate({ roofs }); layer.settle();
  layer.open(new Map([[roofs[0].key, [SEEN]]]));
  layer.step(FADE_TIME);
  assert.equal(root.children[0].alpha, FADED, 'the old way still works');
  assert.equal(layer.state.opened, 0);
});

test('a roof painted again keeps the one it has until the new one is up', () => {
  // Roi: "when moving the sun it removes the roof while it redraws it". The sun is part of how a roof is painted,
  // so every step of it changes the picture — and taking the old one down first left the building bare until the
  // queue got round to the new one.
  const { layer, root } = newLayer();
  const first = ROOFS();
  layer.populate({ roofs: first }); layer.settle();
  assert.equal(root.children.length, 1);
  const was = root.children[0];
  // The same roof, painted under a sun that has moved: a new key, the same building.
  const moved = first.map((r) => ({ ...r, key: `${r.key}:s3` }));
  layer.populate({ roofs: moved });
  assert.equal(root.children.length, 1, 'the old picture is still on the map while the new one is painted');
  assert.equal(root.children[0], was, 'and it is the same one, not a gap');
  layer.settle();
  assert.equal(root.children.length, 1, 'then only the new one is left');
  assert.notEqual(root.children[0], was, 'which is a different picture');
  assert.equal(layer.state.laid, 1, 'and nothing is kept that nobody can see');
});

test('a roof taken off goes at once, with nothing coming to replace it', () => {
  const { layer, root } = newLayer();
  layer.populate({ roofs: ROOFS() }); layer.settle();
  layer.populate({ roofs: [] });
  assert.equal(root.children.length, 0, 'gone is gone');
});

test('a roof faded for somebody underneath stays faded when it is painted again', () => {
  const { layer, root } = newLayer();
  const first = ROOFS();
  layer.populate({ roofs: first }); layer.settle();
  layer.cover([first[0].key]);
  layer.step(FADE_TIME);
  assert.equal(root.children[0].alpha, FADED, 'down for whoever is under it');
  layer.populate({ roofs: first.map((r) => ({ ...r, key: `${r.key}:s3` })) });
  layer.settle();
  assert.equal(root.children[0].alpha, FADED, 'and the new picture comes up just as faded, not solid');
});

test('fading does not paint anything again: it is the same picture throughout', () => {
  const { layer, root } = newLayer();
  const roofs = ROOFS();
  layer.populate({ roofs }); layer.settle();
  const was = root.children.slice();
  layer.cover([roofs[0].key]); layer.step(FADE_TIME);
  assert.deepEqual(root.children, was);
  assert.equal(layer.populate({ roofs }), 0, 'and nothing is queued for repainting');
});

test('a roof that is gone takes its picture with it', () => {
  const { layer, root } = newLayer();
  layer.populate({ roofs: ROOFS() }); layer.settle();
  layer.populate({ roofs: [] });
  assert.equal(root.children.length, 0);
  assert.deepEqual(layer.state, { laid: 0, waiting: 0, fading: 0, opened: 0, keys: [] });
});

test('a roof with a chimney says where its smoke rises from', () => {
  const { layer } = newLayer();
  layer.populate({ roofs: ROOFS({ chimney: 'brick' }) }); layer.settle();
  const [one] = layer.chimneys;
  assert.ok(one && Number.isFinite(one.at[0]) && Number.isFinite(one.at[1]));
  const bare = newLayer();
  bare.layer.populate({ roofs: ROOFS() }); bare.layer.settle();
  assert.deepEqual(bare.layer.chimneys, [], 'and one without a chimney says nothing');
});

test('with no canvas to lay it on, nothing is lost', () => {
  const layer = createPaintedRoofs({ PIXI, root: () => null, grid: () => 100, make: quietCanvas });
  layer.populate({ roofs: ROOFS() });
  assert.equal(layer.step(0, 2), 1, 'it waits');
  assert.equal(layer.state.laid, 0);
});
