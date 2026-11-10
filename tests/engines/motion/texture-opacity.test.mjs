import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textureOpacity, TEXTURE_OPACITY } from '../../../scripts/engines/motion/region-steps.mjs';

// Roi: "lets add texture opacity slider!" (the region panel's Floor texture, beside Texture style and Pattern size).
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('a region\'s texture opacity: solid unless set, never quite gone', () => {
  assert.equal(textureOpacity({}), 1);
  assert.equal(textureOpacity({ textureOpacity: 0.4 }), 0.4);
  assert.equal(textureOpacity({ textureOpacity: '0.6' }), 0.6);
  assert.equal(textureOpacity({ textureOpacity: 0 }), TEXTURE_OPACITY.min, 'kept to the slider\'s least');
  assert.equal(textureOpacity({ textureOpacity: 5 }), 1);
  assert.equal(textureOpacity({ textureOpacity: '' }), 1);
});

test('the panel offers it with the floor texture, and the painted floor is drawn at it, grass blades too', () => {
  const panel = read('scripts/ui/region-panel-sections.mjs');
  assert.match(panel, /range\('Texture opacity', TEXTURE_OPACITY, textureOpacity\(own\), percent, \(v\) => act\(\{ textureOpacity: v \}\)/);
  assert.match(panel, /if \(textured\) parts\.push\(styleRow\(c\), opacityRow\(c\)\);/);
  const main = read('scripts/main.mjs');
  assert.match(main, /scale: stepScale\(own\), opacity: textureOpacity\(own\), blades: floorLevel\.blades/);
  const looks = read('scripts/engines/motion/floor-looks.mjs');
  assert.match(looks, /const showAt = \(mesh, alpha\) => \{ if \(!mesh\) return; mesh\.shader\.uniforms\.uAlpha = alpha; if \(mesh\.animaterBlades\)/);
  assert.match(looks, /if \(entry\.opacity !== opacity\) \{ entry\.opacity = opacity; if \(!entry\.old\) showAt\(entry\.mesh, opacity\); \}/, 'changed on a floor already drawn, at once');
  assert.match(looks, /showAt\(entry\.mesh, Math\.min\(top, u\.uAlpha \+ \(top \* seconds\)/, 'a new floor fades in up to it, not past it');
});
