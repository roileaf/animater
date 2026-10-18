import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveFeatMedia } from '../../../../tools/feat-asset-selection.mjs';
import { FEAT_MOTIFS } from '../../../../scripts/catalogs/pf2e/feats/feat-choreography.mjs';
import { SPELL_THEMES } from '../../../../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
import { assetGeometry } from '../../../../tools/spell-asset-selection.mjs';
const databases=JSON.parse(readFileSync(new URL('../../../fixtures/feat-native-inventory.json',import.meta.url),'utf8'));
const media=(motif,weapon,shape,theme='weapon',count=1,slug='sample')=>resolveFeatMedia(databases,theme,FEAT_MOTIFS[motif],SPELL_THEMES[theme],{
 name:'Sample activity',slug,motif,rationale:shape,description:shape,
 direction:{weapon,shape,approach:shape,contacts:{count,distribution:'same-target'},finish:[]},
});

test('native contact footage distinguishes reviewed claw, fist, thrust, broad cut and heavy weapon',()=>{
 const samples=[
  ['doubleStrike','claw','rapid-pair',2,/creature_attack\.claw\.002/],
  ['unarmed','fist','descending',1,/creature_attack\.fist\.002/],
  ['strike','sword','narrow thrust',1,/piercing/],
  ['heavyStrike','melee','wide cleave',1,/slash\.02\.002/],
  ['heavyStrike','two-handed-melee','heavy windup',1,/greatsword\.melee\.standard/],
 ];
 for(const [motif,weapon,shape,count,pattern] of samples){
  const result=media(motif,weapon,shape,'weapon',count);
  const patreon=result.assets.hit.find(key=>databases.patreon.some(row=>row.key===key));
  assert.match(patreon,pattern,`${weapon}/${shape}`);
  for(const edition of ['patreon','free']){
   const row=databases[edition].find(row=>result.assets.hit.includes(row.key));
   assert.ok(row,edition);
   assert.equal(assetGeometry(row),'radial');
   assert.ok(['melee','melee_large'].includes(row.templateName));
  }
 }
});

test('semantic contact colors use native fire and cold variants when available',()=>{
 const fire=media('strike','melee','single slash','fire'),ice=media('strike','melee','single slash','cold');
 assert.match(fire.assets.hit[0],/orange|red|yellow/);
 assert.match(ice.assets.hit[0],/blue|white/);
 assert.notEqual(fire.assets.hit[0],ice.assets.hit[0]);
});

test('care, shielded advance and firearm-powered jump preserve non-attack source media',()=>{
 for(const [slug,theme,pattern] of [['doctors-visitation','healing',/^jb2a\.healing_generic/],['guarded-advance','ward',/^jb2a\.shield/],['black-powder-boost','weapon',/^jb2a\.muzzle_flash/]]){
  const result=media('movement','none','source cue',theme,0,slug);
  const keys=slug==='doctors-visitation'?result.assets.hit:result.assets.cast;
  assert.ok(keys.every(key=>pattern.test(key)),`${slug}: ${keys.join(',')}`);
 }
});
