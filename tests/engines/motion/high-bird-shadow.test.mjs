import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shadowFall } from '../../../scripts/engines/motion/movement-feel.mjs';
import { createSoftShadows } from '../../../scripts/engines/motion/soft-shadow.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const wildlife = readFileSync(new URL('../../../scripts/engines/motion/wildlife.mjs', import.meta.url), 'utf8');

// Roi: "I don't see the hawk shadow at all". A shadow thrown from six squares up fades to a twentieth (its length past
// the cap), and the hawk took a fifth of that: about 1% dark. A high bird's shadow now lands by its height but is as dark
// as the light makes it from low down; the soft copy shows the height.
test('a hawk high up casts a shadow you can see', () => {
  const sun = { angle: 51, elevation: 45, strength: 1 };
  const high = shadowFall({ width: 90, lift: 6, sun }), low = shadowFall({ width: 90, lift: 0.8, sun });
  assert.ok(high.alpha < low.alpha / 4, 'the fall alone fades a high flier to nearly nothing');
  assert.match(main, /if \(bird && lift > BIRD_SHADOW_LIFT\) \{ const low = shadowFall\(\{ width, lift: BIRD_SHADOW_LIFT,[^}]*\}\); return \{ \.\.\.fall, alpha: low\.alpha \}; \}/);
  const factor = Number(wildlife.match(/Math\.min\(0\.34, c\.alpha \* \((0\.\d+) \+ \(1 - height\)/)?.[1]);
  assert.ok(Math.min(0.34, low.alpha * factor) >= 0.15, 'soaring, it is plainly there');
});

// The painted animals are sharp pictures (resolution 2.5): a frame in the texture's units covers 2.5 times as many of
// its pixels. The soft copy read only the top-left corner of the bird, mostly empty, so its shadow vanished too.
test('the soft shadow copies the whole of a sharp picture', () => {
  const calls = [];
  const document = { createElement: () => ({ getContext: () => ({ filter: '', drawImage: (...a) => calls.push(a) }) }) };
  const PIXI = { Texture: class { constructor(b) { this.baseTexture = b; } }, BaseTexture: class { constructor(s) { this.source = s; } } };
  const soft = createSoftShadows({ PIXI, document });
  const source = {}, texture = { baseTexture: { resolution: 2.5, resource: { source } }, frame: { x: 4, y: 8, width: 40, height: 20 } };
  soft.of(texture, 1);
  assert.deepEqual(calls[0].slice(0, 5), [source, 10, 20, 100, 50]);
});
