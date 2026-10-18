import test from 'node:test';
import assert from 'node:assert/strict';
import {starterRecipes} from '../../scripts/core/presets.mjs';
import {STARTER_MEDIA_TIMING} from '../../data/starter-media-timing.mjs';
import {timedStages} from '../../scripts/engines/playback/composition.mjs';
test('starter flights finish their films and impacts follow measured native contact',()=>{
 for(const r of starterRecipes()){
  const travel=r.stages.find(s=>s.kind==='travel');if(!travel)continue;
  assert.ok(travel.oneShot,r.name);assert.ok(travel.duration>=STARTER_MEDIA_TIMING[r.id].duration,r.name);
  const stages=timedStages(r),flight=stages.find(s=>s.stageId===travel.stageId),impact=stages.find(s=>s.kind==='impact');
  if(impact)assert.equal(impact.delay,flight.delay+STARTER_MEDIA_TIMING[r.id].contact,r.name);
 }
 const cinematic=timedStages(starterRecipes().find(r=>r.id==='cinematic-blade'));
 const strike=cinematic.find(s=>s.kind==='impact'),reaction=cinematic.find(s=>s.subject==='targets');
 assert.equal(starterRecipes().find(r=>r.id==='blade').stages[0].kind,'impact','Melee footage stays localized');
 assert.equal(reaction.delay,strike.delay+STARTER_MEDIA_TIMING['cinematic-blade'].contact);
 assert.ok(cinematic.find(s=>s.subject==='source').duration>reaction.delay);
});
