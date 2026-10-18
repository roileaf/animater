import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSpellDescription,descriptionText } from '../../tools/spell-semantics.mjs';
import { spellRecipe } from '../../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
import { DEEP_SPELL_MOTIFS } from '../../scripts/catalogs/pf2e/spells/spell-deep-designs.mjs';
import { timedStages } from '../../scripts/engines/playback/composition.mjs';
import { resolveSpellMedia } from '../../tools/spell-asset-selection.mjs';
import { SPELL_THEMES } from '../../scripts/catalogs/pf2e/spells/spell-choreography.mjs';
const make=(slug,text,{theme='arcane',delivery='self',area=null,target=''}={})=>{
 const n={name:slug,system:{description:{value:`<p>${text}</p>`},area,target:{value:target},range:{value:''},time:{value:'2'},traits:{value:[]},damage:{}}};
 const design=analyzeSpellDescription(n,{slug,theme,delivery,kind:'spell'});
 design.assets=Object.fromEntries(['cast','bolt','hit','aura','area'].map(slot=>[slot,[`jb2a.${slot}.test`]]));
 const spell={id:slug,slug,name:slug,rank:4,theme,delivery:design.delivery,trigger:'use',area,notes:[],design};
 return {spell,recipe:spellRecipe(spell)};
};

// Edition keys from the native inventory: absence of an exact color must not
// replace an authored material or manifestation with an unrelated default.
test('authored point, surface and ghost art wins over unrelated elemental defaults in both editions',()=>{
 const row=key=>({key:`jb2a.${key}`,file:/^(magic_missile|fire_bolt)/.test(key)?'Missile_15ft_1000x400.webm':'Local_400x400.webm'});
 const common=['cast_generic.fire.01.orange','glint.yellow.few','magic_missile.purple','fire_bolt.orange',
  'fireball.explosion.orange','flames.04.loop.orange','dancing_light.red','dancing_light.yellow',
  'swirling_leaves.complete.01.green','shimmer.01.blue','toll_the_dead.green.skull_smoke',
  'sleep.target.pink','fog_cloud.01.white','cloud_of_daggers.daggers.red'];
 const db={free:common.map(row),patreon:[...common,'shimmer.01.orange','toll_the_dead.blue.skull_smoke','swirling_sparkles.01.orange'].map(row)};
 for(const [motif,theme,slot,expected] of [
  ['growingAcorns','fire','hit',/dancing_light|glint/],
  ['heatedMetal','fire','hit',/shimmer/],
  ['ghostlyThrall','dream','hit',/toll_the_dead.*skull_smoke/],
  ['rustParticles','metal','area',/swirling_sparkles|swirling_leaves/]
 ]){
  const selected=resolveSpellMedia(db,theme,DEEP_SPELL_MOTIFS[motif],SPELL_THEMES[theme],{name:motif,delivery:slot==='area'?'burst':'target',design:{pattern:DEEP_SPELL_MOTIFS[motif].pattern}});
  for(const edition of Object.keys(db)){
   const available=new Set(db[edition].map(r=>r.key)),key=selected[slot].find(k=>available.has(k));
   assert.match(key,expected,`${motif} ${edition}: ${key}`);
  }
 }
});
test('readable native reference terms survive, opaque document IDs remain unresolved',()=>{
 assert.equal(descriptionText('<p>Become @UUID[Compendium.pf2e.conditionitems.Item.invisible] then @UUID[Compendium.pf2e.actionspf2e.Item.take-cover].</p>'),'Become invisible then take cover.');
 assert.equal(descriptionText('A @UUID[Compendium.pf2e.spells-srd.Item.QQaAbbCCddEEffGG] enters.'),'A enters.');
 assert.equal(descriptionText('@UUID[Compendium.pf2e.spells-srd.Item.QQaAbbCCddEEffGG]{Mirror Image}'),'Mirror Image');
});
test('delayed weapon and gift benefits do not attack or recoil during casting',()=>{
 for(const [slug,text,theme] of [
  ['echoing-weapon','You channel energy into a weapon. At the end of its wielder turn, the weapon discharges a burst based on successful Strikes.','sonic'],
  ['elemental-gift','An elemental force fills a willing creature. Its later Strikes can deal additional or persistent damage depending on chosen element.','arcane'],
  ['magnetize','You infuse a willing creature with polarity that draws future metallic attacks.','metal'],
  ['repel-metal','You grant a repelling field. Only if the triggering attack misses does it reflect toward the attacker.','metal']
 ]){
  const {recipe}=make(slug,text,{theme,delivery:'target',target:'1 creature or weapon'});
  assert.ok(recipe.stages.every(s=>s.kind!=='motion'),slug);
  assert.ok(recipe.stages.every(s=>!/contact|shock|strike|residue/i.test(s.label)),slug);
 }
});
test('Fire Seeds creates four hand-held acorns without throwing or exploding them',()=>{
 const {recipe}=make('fire-seeds','Four acorns grow in your hand. They can later be thrown and explode.',{theme:'fire'});
 const seeds=recipe.stages.filter(s=>/acorn/i.test(s.label));
 assert.equal(seeds.length,4);
 assert.ok(seeds.every(s=>s.kind==='cast'));
 assert.ok(recipe.stages.every(s=>!['travel','projectile','motion'].includes(s.kind)));
 assert.ok(recipe.stages.every(s=>!/explos|detonat/i.test(s.label)));
});
test('red-hot metal and blue-flame torch respect literal materials without buff attacks',()=>{
 const hot=make('heat-metal','The metal becomes red-hot.',{theme:'fire',delivery:'target',target:'1 metal object'}).recipe;
 const torch=make('funeral-flames','One end of a wielded bludgeon becomes wreathed in blue flame.',{theme:'fire',delivery:'target',target:'1 club'}).recipe;
 assert.ok(hot.stages.some(s=>s.colorize&&s.tint.toLowerCase()==='#ff4938'));
 assert.ok(hot.stages.every(s=>!/residue/i.test(s.label)));
 assert.ok(torch.stages.some(s=>s.colorize&&s.tint.toLowerCase()==='#62baff'));
 assert.ok(torch.stages.every(s=>s.kind!=='motion'));
 assert.ok(!/fireball/.test(DEEP_SPELL_MOTIFS.funeralTorch.hit));
});
test('ranged and floating weapon attacks travel before their target contact',()=>{
 for(const slug of ['shooting-star','force-fling','dancing-blade']){
  const {spell,recipe}=make(slug,'A projectile or weapon flies to a foe and makes one Strike.');
  assert.ok(['bolt','target'].includes(spell.delivery),slug);
  const flight=recipe.stages.find(s=>['projectile','travel'].includes(s.kind));
  const contact=recipe.stages.find(s=>/contact|strikes/i.test(s.label));
  assert.ok(flight&&contact,slug);
  assert.equal(contact.afterStage,flight.stageId,slug);
  assert.equal(contact.timingAnchor,flight.kind==='projectile'?'end':'start',slug);
  assert.ok(recipe.stages.every(s=>!/returns/i.test(s.label)),slug);
  if(slug==='shooting-star')assert.equal(contact.colorize&&contact.tint,'#ff9638');
 }
});
test('sword flight approach precedes contact; movement returns only cosmetic pose',()=>{
 const {recipe}=make('sky-laughs-at-waves','Fly up to your Speed then make a sword Strike.');
 const move=recipe.stages.find(s=>s.kind==='motion'&&s.subject==='source');
 const contact=recipe.stages.find(s=>/Sword contact/i.test(s.label));
 assert.ok(move&&contact);
 assert.equal(contact.afterStage,move.stageId);
 assert.equal(contact.timingAnchor,'arrival');
 assert.ok(timedStages(recipe,8).find(s=>s.stageId===move.stageId).duration>2000);
});
test('wind slice labels remain wind and omit save-dependent bleed residue',()=>{
 const {recipe}=make('slashing-gust','Miniature ripples of air slice one or two creatures. Only on critical success do they bleed.',{theme:'wind',delivery:'bolt',target:'1 or 2 creatures'});
 assert.ok(recipe.stages.every(s=>!/water|splash|residue|bleed/i.test(s.label)));
});
test('chosen storms form clouds without automatically firing optional lightning',()=>{
 for(const slug of ['storm-lord','storm-of-vengeance','wrathful-storm']){
  const {recipe}=make(slug,'A storm cloud forms. Choose a storm effect when casting or Sustaining.',{theme:'electricity',delivery:slug==='storm-lord'?'emanation':'burst',area:{type:slug==='storm-lord'?'emanation':'burst',value:100}});
  assert.ok(recipe.stages.some(s=>s.kind==='template'&&/cloud/i.test(s.label)),slug);
  assert.ok(recipe.stages.every(s=>s.kind!=='motion'&&!/strike|contact|bolt|lightning/i.test(s.label)),slug);
 }
});
test('rainbow cone uses seven colored ray lanes, physical rubble uses moving objects',()=>{
 const prism=make('prismatic-spray','Rainbow light beams cascade from your hand.',{theme:'light',delivery:'cone',area:{type:'cone',value:30}}).recipe;
 const ray=prism.stages.find(s=>s.kind==='travel');
 assert.ok(ray);
 assert.equal(ray.travelDestination,'area');
 assert.equal(ray.areaLayout,'fan');
 assert.equal(ray.fanCount,7);
 assert.equal(ray.fanColors.length,7);
 const rubble=make('pummeling-rubble','Heavy rocks fly through the air in front of you.',{theme:'earth',delivery:'cone',area:{type:'cone',value:15}}).recipe;
 assert.ok(rubble.stages.some(s=>s.kind==='projectile'&&s.areaLayout==='fan'));
 assert.ok(!rubble.stages.some(s=>/lightning/i.test(s.label)));
});
test('persistent manifestations omit a falsely immediate contact',()=>{
 for(const slug of ['draconic-barrage','echoing-weapon','personal-runewell','etheric-shards','rust-cloud','sacred-nimbus']){
  const area=['personal-runewell','etheric-shards','rust-cloud','sacred-nimbus'].includes(slug)?{type:'burst',value:20}:null;
  const {recipe}=make(slug,'Creation occurs now, damage occurs only after a later event.',{delivery:area?'burst':slug==='echoing-weapon'?'target':'self',area});
  assert.ok(recipe.stages.every(s=>s.kind!=='motion'&&!/contact|impact|strike|residue/i.test(s.label)),slug);
 }
});
test('troop illusion negated music and next-composition preparation remain nonmusical',()=>{
 const troopSpell=make('boots-on-the-ground','Illusory troops duplicate an army but cannot create intelligible sounds such as music.',{theme:'illusion',delivery:'self',target:'up to 3 troops'});
 assert.equal(troopSpell.spell.delivery,'target');
 const troops=troopSpell.recipe;
 assert.ok(troops.stages.some(s=>s.kind==='sprite'&&s.subject==='targets'&&s.copies===1));
 assert.ok(troops.stages.every(s=>!/music|song|notation/i.test(s.label)));
 const prep=make('fortissimo-composition','Prepare a muse blessing for your next composition.',{theme:'sonic'}).recipe;
 assert.ok(prep.stages.every(s=>s.kind!=='motion'&&!/sound wave|shock/i.test(s.label)));
 const enthrall=make('enthrall','Speak or sing to fascinate listeners.',{theme:'mind',delivery:'target',target:'any number of creatures'}).recipe;
 assert.ok(enthrall.stages.every(s=>!/music|song|notation/i.test(s.label)));
});
test('fiery reaction hits its foe before retreating away; wind blitz actually moves',()=>{
 const {spell,recipe}=make('pyrefowl-rebuke','Fiery wings sear the attacker while you Fly directly away.',{theme:'fire'});
 assert.equal(spell.delivery,'target');
 assert.ok(recipe.stages.some(s=>s.kind==='impact'&&/attacker/i.test(s.label)));
 const retreat=recipe.stages.find(s=>s.kind==='motion');
 assert.equal(retreat.motionHeading,'away');
 assert.equal(retreat.motion,'leap');
 const blitz=make('unfolding-wind-blitz','Fly at twice your Speed and optionally make up to three unarmed Strikes.',{theme:'wind'}).recipe;
 assert.ok(blitz.stages.some(s=>s.kind==='motion'&&s.subject==='source'&&s.motion==='leap'));
 assert.ok(blitz.stages.every(s=>!/contact|strike/i.test(s.label)));
});
test('manual metal wall keeps its directed material cue instead of a dagger attack',()=>{
 const {spell,recipe}=make('wall-of-metal','A straight sheet of metal forms a wall up to 60 feet long.',{theme:'metal',delivery:'wall'});
 assert.equal(spell.design.motif,'metalBarrierCue');
 assert.ok(recipe.stages.some(s=>s.colorize&&s.tint==='#c5d2df'));
 assert.ok(recipe.stages.every(s=>s.kind!=='template'&&s.kind!=='motion'));
});
test('remote ghost creation is symbolic preparation, never a sleep spell',()=>{
 const {spell,recipe}=make('recurring-nightmare','Create a ghostly thrall at a remote location. It flies and later Strikes.');
 assert.equal(spell.delivery,'point');
 assert.equal(spell.design.motif,'ghostlyThrall');
 assert.ok(recipe.stages.every(s=>s.kind!=='motion'&&!/sleep|strike|attack/i.test(s.label)));
 assert.doesNotMatch(DEEP_SPELL_MOTIFS.ghostlyThrall.hit,/sleep/);
});
