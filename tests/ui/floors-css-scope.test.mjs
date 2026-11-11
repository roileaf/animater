import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Roi: "what happened to the properties sidebar??" The Floor regions window's unscoped `.an-inspector { display: none }`
// hid the workspace's inspector, in the studio and on every catalog page.
test('the Floor regions window styles only its own window', () => {
  const css = readFileSync(new URL('../../styles/animater.css', import.meta.url), 'utf8').split(/\r?\n/);
  const start = css.findIndex((l) => l.startsWith('/* Floor regions window'));
  const end = css.findIndex((l, i) => i > start && l.startsWith('/* Ambient Light configuration'));
  assert.ok(start > 0 && end > start);
  for (const line of css.slice(start + 1, end)) {
    const m = line.match(/^\s*([^{}@\/\s-][^{]*?)\s*\{/);
    if (!m) continue;
    for (const sel of m[1].split(',')) assert.match(sel.trim(), /\.animater-floors\b/, sel.trim());
  }
  assert.ok(!css.some((l) => /^\s*\.an-inspector\s*\{[^}]*display:\s*none/.test(l)), 'nothing hides every inspector');
});
