import test from 'node:test';
import assert from 'node:assert/strict';
import {NPC_ACTIONS}from'../../scripts/catalogs/pf2e/npc-abilities.mjs';
import {REVIEWED_ACTIONS}from'../../scripts/catalogs/pf2e/npc-reviewed-b.mjs';
import designs from'../../scripts/catalogs/bespoke/pf2e-npc-reviewed-b.mjs';

const reviewed=name=>{
  const action=NPC_ACTIONS.find(a=>a.name===name&&REVIEWED_ACTIONS[a.id]);
  assert.ok(action,`reviewed source for ${name}`);
  return REVIEWED_ACTIONS[action.id];
};
const stages=form=>designs[`pf2e:npc-${form.id}`].build({recipe:{name:'Native action'}});

test('native attack activities get preparation, never a duplicated attack payload',()=>{
  for(const name of ['A Kanabo to an Oni','Aquatic Opportunity','Protect Passenger','Spellstrike','Reactive Strike (Tentacle Only)']){
    const form=reviewed(name);assert.equal(form.delivery,'strike');assert.equal(form.aim,'self');
    assert.ok(stages(form).every(s=>['motion','sprite'].includes(s.kind)),name);
  }
});
test('a trigger mentioning a Strike does not turn a weakening rider into another Strike',()=>{
  for(const name of ['Enfeebling Strike','Lasting Debilitating Strike','Precise Debilitations','Weakening Strike']){
    const form=reviewed(name);assert.equal(form.delivery,'cue');assert.equal(form.aim,'target');
    assert.equal(form.id,'review-b-debilitation');assert.ok(!stages(form).some(s=>['travel','projectile','impact'].includes(s.kind)),name);
  }
});
test('sustain, redirection and counteracting do not pretend to cast another spell',()=>{
  for(const name of ['Effortless Concentration','Sovereign of the False','Forgotten Presence','Scoff at the Divine'])
    assert.equal(reviewed(name).delivery,'cue',name);
  assert.equal(reviewed('Divine Protection').id,'review-b-ward-ally');
  assert.equal(reviewed('Dispelling Strike').delivery,'spell','this payload actually casts dispel magic');
});
test('distinct crystal, ink, prismatic and spirit actions retain their material cues',()=>{
  for(const [name,id]of [['Crystallize','crystal-contact'],['Ink Blood','ink-release'],['Prismatic Backlash','prismatic-surge'],['Throw Spirits','spirit-projection']])
    assert.equal(reviewed(name).id,`review-b-${id}`,name);
  assert.equal(reviewed('Liberating Trick').aim,'self','can free itself without a separate target');
  const many=stages(reviewed('Reel In')).find(s=>s.subject==='targets');
  assert.equal(many.optionalTargets,true);assert.equal(many.targetSelection,'all');
});
