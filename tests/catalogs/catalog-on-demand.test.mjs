import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

// CaptainKerns (Discord): "Initial load times are pretty rough for my players ... a 15-30 second hang ... on the first
// connect of the night." A PF2e world's players downloaded and parsed ~58 MB of catalog data with the module, catalogs
// on or off. In the browser the data now loads when asked for.
const url = (p) => new URL(`../../scripts/${p}`, import.meta.url).href;
const run = (code) => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {encoding: 'utf8'});
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout.trim().split('\n').at(-1));
};
const browser = `globalThis.game={system:{id:'pf2e'}};globalThis.document={querySelectorAll:()=>[]};`;

test('in the browser no catalog data loads with the module; asked for, it fills the same lists and indexes', () => {
  const result = run(`${browser}
    const data=await import(${JSON.stringify(url('catalogs/shared/catalog-data.mjs'))});
    const feats=await import(${JSON.stringify(url('catalogs/pf2e/feats/feat-catalog.mjs'))});
    const spells=await import(${JSON.stringify(url('catalogs/pf2e/spells/spell-catalog.mjs'))});
    const weapons=await import(${JSON.stringify(url('catalogs/pf2e/weapons/weapon-catalog.mjs'))});
    const before={feats:feats.PF2E_FEATS.length,spells:spells.PF2E_SPELLS.length,natural:weapons.PF2E_WEAPONS.length,sfLoaded:data.catalogDataLoaded('sf2e')};
    const kept=feats.normalizeFeatCatalogState({enabled:true,selected:['abc123','pf2e-feat-def456']}).selected;
    const list=feats.PF2E_FEATS;
    await data.loadCatalogData({systems:['pf2e'],names:['feats','weapons']});
    const first=feats.PF2E_FEATS[0];
    console.log(JSON.stringify({before,kept,same:list===feats.PF2E_FEATS,feats:feats.PF2E_FEATS.length,found:feats.catalogFeat(first.id)?.id===first.id,
      dropped:feats.normalizeFeatCatalogState({selected:['abc123',first.id]}).selected,
      weapons:weapons.PF2E_WEAPONS.length,dagger:weapons.catalogWeapon('pf2e-weapon-'+weapons.PF2E_WEAPONS.find(w=>w.slug==='dagger')?.id)?.slug??null,
      spells:spells.PF2E_SPELLS.length,loaded:[data.catalogDataLoaded('pf2e','feats'),data.catalogDataLoaded('pf2e','spells')]}));`);
  assert.equal(result.before.feats, 0);
  assert.equal(result.before.spells, 0);
  assert.ok(result.before.natural > 0, 'creature attacks (Jaws, Claw) need no data file');
  assert.equal(result.before.sfLoaded, false);
  assert.deepEqual(result.kept, ['abc123', 'def456'], 'a saved choice survives being read before the data is in');
  assert.equal(result.same, true);
  assert.ok(result.feats > 1000);
  assert.equal(result.found, true);
  assert.equal(result.dropped.length, 1, 'once loaded, an unknown id is dropped as before');
  assert.ok(result.weapons > result.before.natural);
  assert.equal(result.dagger, 'dagger');
  assert.equal(result.spells, 0, 'only what was asked for loads');
  assert.deepEqual(result.loaded, [true, false]);
});

test('the module asks for the catalogs that are on after the canvas, and for all of them when the window opens', () => {
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /Hooks\.once\("canvasReady", \(\) => \{ start\(\); \}\)/);
  assert.match(main, /await loadWorldCatalogs\(\{ all: true \}\);\s*const \{ Workspace \} = await import\("\.\/ui\/workspace\.mjs"\);/);
  assert.match(main, /Hooks\.on\("updateSetting"/);
  for (const file of ['catalogs/pf2e/feats/feat-catalog.mjs', 'catalogs/pf2e/spells/spell-catalog.mjs', 'catalogs/pf2e/state-catalog.mjs', 'catalogs/pf2e/ability-catalog.mjs',
    'catalogs/pf2e/npc-abilities.mjs', 'catalogs/pf2e/weapons/weapon-catalog.mjs', 'catalogs/sf2e/sf2e-catalog.mjs', 'catalogs/sf2e/sf2e-npc-actions.mjs',
    'catalogs/dnd5e/dnd5e-catalog.mjs', 'catalogs/dnd5e/dnd5e-npc-actions.mjs'])
    assert.doesNotMatch(readFileSync(new URL(`../../scripts/${file}`, import.meta.url), 'utf8'), /catalogDataNeeded\(/, `${file} loads only through catalogData`);
});
