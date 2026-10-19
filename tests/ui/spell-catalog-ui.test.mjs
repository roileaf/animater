import test from "node:test";
import assert from "node:assert/strict";
import { spellCatalogHTML } from "../../scripts/ui/spell-catalog-ui.mjs";
import { PF2E_SPELLS, useCatalogSpell } from "../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import {withUnconfiguredSpell} from '../helpers/catalog-fixtures.mjs';
function view(spell, state = {}, recipes = [], environment = {}) {
  return spellCatalogHTML({
    spellFilters: { search: spell.name },
    selectedSpell: spell.id,
    spellPage: 0,
    busy: false,
    recipePreviewHTML: () => "<div data-recipe-scene></div>",
    previewDuration: () => 1000,
    host: {
      catalogState: () => state,
      recipes: () => recipes,
      enabled: () => false,
      environment: () => ({
        systemId: "pf2e",
        ready: true,
        motionReady: true,
        ...environment,
      }),
    },
  });
}

test("unavailable motion explains loaded server manifest and distinguishes server stop/start from browser reload", () => {
  const spell = PF2E_SPELLS.find((s) => s.name === "Runic Weapon");
  const html = view(spell, {}, [], {
    motionReady: false,
    motionServerVersion: "0.1.0",
  });
  assert.match(html, /Server loaded Animater 0\.1\.0/);
  assert.match(
    html,
    /Stop and start the Foundry server instance serving this world/,
  );
  assert.match(html, /Reloading a browser cannot register this channel/);
  assert.doesNotMatch(html, /Server restart required/);
  assert.doesNotMatch(view(spell), /an-sync-notice/);
  assert.doesNotMatch(
    view(spell, { motion: false }, [], { motionReady: false }),
    /an-sync-notice/,
  );
});
test("catalog starts with direct use and optional customization while keeping step highlights visible", () => {
  const spell = PF2E_SPELLS.find((s) => s.name === "Runic Weapon");
  const html = view(spell);
  assert.match(html, /Not playing automatically/);
  assert.match(html, /data-action="use-spell" class="an-primary"\s*>Use animation/);
  assert.match(html, /data-action="copy-spell" class="an-quiet"\s*>Customize/);
  assert.match(html, /data-action="recipe-preview"[^>]*>▶ Preview<\/button>[\s\S]*data-action="preview"[^>]*>▷ On canvas/, "both previews in one row");
  assert.match(html, /<details class="an-advanced an-entry-details"><summary>Details: stages, sounds and source/);
  assert.match(html, /Use entire catalog/);
  assert.match(html, /data-stage-drag="0"/);
  assert.match(html, /data-action="item-details" data-kind="spell"/);
  assert.match(html, /aria-label="Open Runic Weapon details"/);
  assert.doesNotMatch(html, /Add & customize|catalog-choreography/);
});
test("direct catalog choice shows active status without Setup dependency or a custom recipe", () => {
  const spell = PF2E_SPELLS.find((s) => s.name === "Runic Weapon");
  const html = view(spell, useCatalogSpell({}, spell.id));
  assert.match(html, /an-entry-status is-on[\s\S]*Plays automatically/);
  assert.match(html, /On: [^<]+/);
  assert.doesNotMatch(html, /data-action="use-spell"/, "already playing: no Use button");
  assert.doesNotMatch(html, /Also turn on Automatic playback/);
});
test("unconfigured ritual entries expose configuration rather than unrelated casting art", async () => {
 await withUnconfiguredSpell('Atone',ritual=>{
  const html = view(ritual);
  assert.match(html, /Configure animation/);
  assert.match(html, /No built-in animation yet/);
  assert.doesNotMatch(html,/data-action="play"/);
  assert.doesNotMatch(html, /data-action="use-spell"/);
 });
});

test('unmatched spell detail exposes configuration without promising a generic preview',async()=>{
 await withUnconfiguredSpell('500 Toads',s=>{
 const html=view(s,{enabled:true});
 assert.match(html,/Needs setup/);
 assert.match(html,/Skipped by plug &amp; play/);
  assert.match(html,/animations ready · [\d,]+ need configuration/);
 assert.match(html,/Configure animation/);
 assert.doesNotMatch(html,/data-action="(?:use-spell|recipe-preview|preview|play)"/);
 assert.doesNotMatch(html,/Distinct catalog composition|Arcane casting cue/);
 });
});
