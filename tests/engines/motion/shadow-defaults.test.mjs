import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Roi: "the setting for token shadow and walls start as disabled for everyone. we should turn it on by default".
test('shadows under every token and wall shadows start on for the world, and on each screen', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  const defaultOf = (key) => { const at = main.indexOf(`registerSetting("${key}",`); assert.ok(at >= 0, key); return /default:\s*(true|false)/.exec(main.slice(at, at + 1200))[1]; };
  for (const key of ['groundShadows', 'groundShadowsLocal', 'wallShadows', 'wallShadowsLocal']) assert.equal(defaultOf(key), 'true', key);
});
