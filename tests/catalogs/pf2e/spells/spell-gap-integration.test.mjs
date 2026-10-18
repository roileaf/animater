import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_SPELLS,spellRecipe} from '../../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {GAP_SPELL_MOTIFS} from '../../../../scripts/catalogs/pf2e/spells/spell-gap-designs.mjs';
import {FIRE_SPELL_MOTIFS} from '../../../../scripts/catalogs/pf2e/spells/spell-fire-designs.mjs';
import {assetDatabases} from '../../../../tools/asset-databases.mjs';
import {assetGeometry} from '../../../../tools/spell-asset-selection.mjs';
import {resolveAsset} from '../../../../scripts/core/model.mjs';
import {spellSources} from '../../../../tools/pf2e-source.mjs';
import {analyzeSpellDescription,nativeSpellDescription} from '../../../../tools/spell-semantics.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifests=(await Promise.all(['a','b','c'].map(s=>readFile(new URL(`../../../../docs/spell-gap-${s}-review.json`,import.meta.url),'utf8')))).flatMap(raw=>{const value=JSON.parse(raw);return Array.isArray(value)?value:value.records;});
const reviewedIds=new Set(manifests.map(e=>e.id));

test('all 897 reviewed records retain complete native description provenance including GM-only records',async()=>{
  const source=await spellSources(),byId=new Map(source.spells.map(e=>[e.source._id,e.source]));
  assert.equal(manifests.length,897);
  assert.equal(new Set(manifests.map(e=>e.id)).size,897);
  for(const entry of manifests){
    const spell=PF2E_SPELLS.find(s=>s.id===entry.id),item=byId.get(entry.id);
    assert(spell&&(GAP_SPELL_MOTIFS[spell.design.motif]||FIRE_SPELL_MOTIFS[spell.design.motif]),entry.slug);
    const raw=nativeSpellDescription(item);
    assert.equal(createHash('sha256').update(raw).digest('hex'),entry.sourceHash??entry.descriptionHash,entry.slug);
    const design=analyzeSpellDescription(item,{slug:spell.slug,kind:spell.kind,delivery:spell.delivery,theme:spell.theme});
    assert.equal(design.descriptionHash,spell.design.descriptionHash,spell.name);
    assert.equal(design.motif,spell.design.motif,spell.name);
    assert.equal(design.analysis,'full-description',spell.name);
  }
});

test('all 897 reviewed spell gaps retain their intended artwork and valid stage geometry in both editions',async()=>{
  const spells=PF2E_SPELLS.filter(s=>reviewedIds.has(s.id));
  assert.equal(spells.length,897);
  const databases=await assetDatabases();
  for(const spell of spells){
    const motif=GAP_SPELL_MOTIFS[spell.design.motif]??FIRE_SPELL_MOTIFS[spell.design.motif];
    const roots=['cast','bolt','hit','aura','area'].flatMap(slot=>(motif[slot]??'').split(',')).filter(Boolean);
    const recipe=spellRecipe(spell,undefined,{sound:false});
    assert.equal(spell.design.rationale,'',spell.name);
    assert(!spell.design.visualIdentity,`${spell.name}: unrelated casting decoration`);
    assert(recipe.enabled,spell.name);
    // Lead-authored bespoke compositions (scripts/bespoke) replace the gap
    // design and are covered by tests/bespoke.test.mjs.
    if(recipe.bespoke)continue;
    for(const [edition,rows]of Object.entries(databases)){
      const byKey=new Map(rows.map(row=>[row.key,row]));
      for(const stage of recipe.stages){
        if(['motion','sprite','sound'].includes(stage.kind))continue;
        const key=resolveAsset(stage,rows),row=byKey.get(key);
        assert(row,`${spell.name}/${edition}: missing ${stage.label}`);
        assert(roots.some(root=>key===`jb2a.${root}`||key.startsWith(`jb2a.${root}.`)),`${spell.name}/${edition}: ${stage.label} selected unrelated ${key}`);
        const geometry=assetGeometry(row);
        const slot=Object.keys(spell.design.assets).find(slot=>JSON.stringify(spell.design.assets[slot])===JSON.stringify(stage.assets));
        const mediaDuration=spell.design.mediaTiming[slot]?.duration??0;
        assert(mediaDuration>0,`${spell.name}/${edition}: unmeasured ${stage.label}`);
        assert(stage.duration+1>=mediaDuration/(stage.playbackRate??1)+stage.fadeOut,`${spell.name}/${edition}: clips ${stage.label}`);
        if(stage.kind==='travel')assert(['beam','line','projectile'].includes(geometry),`${spell.name}/${edition}: stretches ${key}`);
        if(['cast','impact','aura','template'].includes(stage.kind)&&['beam','line','projectile'].includes(geometry))
          assert(stage.kind==='template'&&recipe.previewArea?.type==='line'&&stage.areaLayout==='fit',`${spell.name}/${edition}: centers directional ${key}`);
      }
    }
  }
});
