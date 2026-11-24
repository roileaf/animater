import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECS } from '../../../scripts/engines/tokenshade/filters/index.mjs';

// A look left out of Foundry's second, outline-only drawing of a token (engine.mjs leanVoid) must leave the outline
// exactly as it found it: every pixel's alpha is the art's own there. This pins which looks say so, and that each one's
// shader does keep to it — one that shifts, grows or eats the art would cut a wrong outline if it said so too.
const PAINT_ONLY = ['adjustment', 'ddTint', 'replaceColor', 'colorGradient', 'dot', 'oldfilm', 'flatten', 'veins', 'material', 'wash', 'bevel', 'lit'];

test('the looks that only repaint the art, and no others, are left out of the outline drawing', () => {
  const said = Object.values(SPECS).filter((s) => s.paintOnly === true).map((s) => s.type).sort();
  assert.deepEqual(said, [...PAINT_ONLY].sort());
});

test('each of them writes the art\'s own alpha, read where the pixel is', () => {
  for (const type of PAINT_ONLY) {
    const glsl = SPECS[type].glsl;
    const main = glsl.slice(glsl.lastIndexOf('void main()'));
    // The art is read at the pixel itself, unshifted.
    const read = main.match(/vec4 (\w+) = fxSample\(vTextureCoord\);/);
    assert.ok(read, `${type}: reads the art at the pixel`);
    const art = read[1];
    // Every colour it writes carries that alpha: the art's sample itself, its `.a`, or a float set from its `.a` alone.
    // (Times uAlpha, for a look that can fade the art: engine.mjs paintOnly counts it only while that is 1.)
    const alphaVar = main.match(new RegExp(`float (\\w+) = ${art}\\.a(?: \\* uAlpha)?;`))?.[1];
    const writes = [...main.matchAll(/gl_FragColor = ([^;]+);/g)].map((m) => m[1]);
    assert.ok(writes.length > 0, `${type}: writes a colour`);
    for (const w of writes) {
      const ok = w === art || w.endsWith(`, ${art}.a)`) || (alphaVar && w.endsWith(`, ${alphaVar})`));
      assert.ok(ok, `${type}: writes ${w}`);
    }
    assert.equal(SPECS[type].reach?.({}) ?? 0, 0, `${type}: reaches no further than the art`);
  }
});
