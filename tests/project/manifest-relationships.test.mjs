import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../../module.json', import.meta.url), 'utf8'));

// A player reported that installing Animater also installed Gambit's FXMaster, which they had never used, and then
// libWrapper warned them about it. Foundry's install dialog ("this package has dependencies") lists everything under
// `recommends` with its checkbox already ticked (templates/setup/install-dependencies.html), and the activation dialog
// ticks them too, so a recommendation is in practice an install. Animater asks for nothing it cannot run without: the
// optional companions are named in the README instead, for the GM to install if they want them.
test('the manifest asks Foundry to install nothing beyond what Animater cannot run without', () => {
  assert.deepEqual(manifest.relationships?.recommends ?? [], [], 'a recommendation is installed and enabled by default');
  const requires = manifest.relationships?.requires ?? [];
  assert.deepEqual(requires.map((r) => r.id), ['sequencer'], 'Sequencer plays every effect; nothing else is required');
});

// All Animater does with FXMaster is play its effects from a recipe stage, guarded by whether it is active, so it must
// not be asked for. (Its weather is its own: Animater no longer reads, follows or hides it.)
test('FXMaster is never asked for, in any relationship', () => {
  const all = [...(manifest.relationships?.requires ?? []), ...(manifest.relationships?.recommends ?? []), ...(manifest.relationships?.conflicts ?? [])];
  assert.ok(!all.some((r) => r.id === 'fxmaster'), 'its scene effects are a bonus, not a dependency');
  const fx = readFileSync(new URL('../../scripts/engines/playback/optional-fx.mjs', import.meta.url), 'utf8');
  assert.match(fx, /modules\?\.get\('fxmaster'\)\?\.active/, 'and the code checks for it rather than assuming it');
});
