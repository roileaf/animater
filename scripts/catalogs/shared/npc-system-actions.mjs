import {validateRecipe} from '../../core/model.mjs';
import {applyBespoke} from './bespoke.mjs';

const BASE={
 self:{kind:'aura',subject:'source',assets:['jb2a.impact.009.orange']},
 target:{kind:'impact',targetSelection:'first',assets:['jb2a.impact.009.orange']},
 area:{kind:'template',assets:['jb2a.impact.009.orange']},
};

// Reuse authored visual vocabulary without pretending another system's native
// action is a PF2e item. Only design lookup uses the PF2e composition namespace.
export function buildNpcActionRecipe(action,{systemId=action?.systemId,motion=true,soundCatalog,sounds,soundVolume}={}){
 const form=action?.form;if(!form||!BASE[form.aim])return null;
 const recipe=validateRecipe({id:action.id,name:action.name,trigger:form.trigger??'use',systemId:'pf2e',catalogEntry:`npc-${form.id}`,
  stages:[{stageId:'native-base',duration:1200,...BASE[form.aim],...(form.targetSelection?{targetSelection:form.targetSelection}:{})}]});
 const result=applyBespoke(recipe,{id:`npc-${form.id}`,systemId:'pf2e'},{motion,soundCatalog:soundCatalog??sounds,soundVolume,...(form.variant?{variant:{id:form.variant}}:{})});
 if(!result.bespoke)return null;
 return validateRecipe({...result,systemId,catalogEntry:action.id,
  ...(action.activityId?{activityId:action.activityId,activityType:action.activityType,activityName:action.activityName??''}:{})});
}
