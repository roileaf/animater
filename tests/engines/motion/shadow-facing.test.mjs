import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { laidArt } from '../../../scripts/engines/motion/flier-silhouette.mjs';
import { mirrorOf } from '../../../scripts/engines/motion/water-mirror.mjs';

// Where a picture's up (0, -1) and its right (1, 0) land on the map, under a turn and a mirror.
const turn = (a, [x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const near = (a, b, why) => assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9, `${why}: ${a} vs ${b}`);
// The shadow: the container turned along the light, the art inside turned and mirrored as laidArt says.
const shadowOf = (along, pose, v) => turn(along, turn(pose.rotation, [v[0] * pose.mirror, v[1]]));
// The reflection: the copy turned as mirrorOf says, flipped top to bottom.
const reflectionOf = (c, v) => turn(c.rotation, [v[0], -v[1]]);

// Roi, Celdar by the water: his reflection lies head away from the bank, his shield side where it should be; his
// shadow kept its head up the map whichever way the light threw it.
test('a standing creature\'s shadow lies as its reflection does: head away from the light, its sides kept', () => {
  const water = [[200, -100, 400, -100, 400, 100, 200, 100]];
  for (const [rotation, x, y] of [[0, 150, 0], [0.6, 150, 0]]) {
    const c = mirrorOf({ id: 'a', x, y, w: 100, h: 100, rotation }, water.map((p) => Object.assign(p, { holes: [] })), { grid: 100 });
    const along = Math.atan2(c.way.y, c.way.x), pose = laidArt({ along, laid: true, rotation });
    near(shadowOf(along, pose, [0, -1]), reflectionOf(c, [0, -1]), 'its head');
    near(shadowOf(along, pose, [1, 0]), reflectionOf(c, [1, 0]), 'its right side');
  }
  // Thrown down the map, the head points down it; thrown east, east.
  near(shadowOf(Math.PI / 2, laidArt({ along: Math.PI / 2, laid: true }), [0, -1]), [0, 1], 'head down the map');
  near(shadowOf(0, laidArt({ along: 0, laid: true }), [0, -1]), [1, 0], 'head east');
});

// Sherp: two tokens side by side under the sun, their shadows thrown up the map leaning opposite ways, one token
// flipped. Thrown up the map (away from the viewer), a shadow shows the creature as its token does, not mirrored: its
// right side stays on the right, flipped token or not, turned with the token too.
test('a shadow thrown up the map keeps the token\'s sides, flipped or not', () => {
  const drawn = (rotation, flip, v) => turn(rotation, [v[0] * flip, v[1]]);
  for (const along of [-Math.PI / 2, -Math.PI / 2 + 0.7, -Math.PI / 2 - 0.7]) {
    for (const rotation of [0, 0.4]) {
      for (const flip of [1, -1]) {
        const pose = laidArt({ along, laid: true, rotation });
        const laid = (v) => turn(along, turn(pose.rotation, [v[0] * flip * pose.mirror, v[1]]));
        // The token's picture turned so its head points along the light: no mirror between them.
        const lay = (v) => turn(along + Math.PI / 2, drawn(rotation, flip, v));
        near(laid([0, -1]), lay([0, -1]), `head (along ${along}, turn ${rotation}, flip ${flip})`);
        near(laid([1, 0]), lay([1, 0]), `right side (along ${along}, turn ${rotation}, flip ${flip})`);
      }
    }
  }
  // Straight up the map, unturned: the shadow is the token's picture moved up, its right side east.
  near(shadowOf(-Math.PI / 2, laidArt({ along: -Math.PI / 2, laid: true }), [1, 0]), [1, 0], 'right side east');
});

test('a flier\'s, or one under a light straight above, keeps the art as drawn from above', () => {
  const pose = laidArt({ along: 1.1, laid: false, rotation: 0.3 });
  near(shadowOf(1.1, pose, [0, -1]), turn(0.3, [0, -1]), 'its own turn');
  assert.equal(pose.mirror, 1);
});

test('the sun, moon and lamps lay it so, and so do windows', () => {
  const feel = readFileSync(new URL('../../../scripts/engines/motion/movement-feel.mjs', import.meta.url), 'utf8');
  assert.match(feel, /laid: grounded && off > 0\.5/);
  const render = readFileSync(new URL('../../../scripts/engines/motion/movement-feel-render.mjs', import.meta.url), 'utf8');
  assert.match(render, /laidArt\(\{ along, laid: geom\.laid === true, rotation: art\.rotation \}\)/);
  const walls = readFileSync(new URL('../../../scripts/engines/motion/wall-shadows.mjs', import.meta.url), 'utf8');
  assert.match(walls, /laidArt\(\{ along, laid: true, rotation: art\.rotation \}\)/);
});
