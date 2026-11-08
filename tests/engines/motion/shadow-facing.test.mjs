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
