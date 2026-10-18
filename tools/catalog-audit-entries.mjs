import {PF2E_SPELLS,spellRecipe} from '../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {PF2E_FEATS,featRecipe} from '../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {PF2E_WEAPONS,weaponRecipe} from '../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS,stateRecipe} from '../scripts/catalogs/pf2e/state-catalog.mjs';
import {starterRecipes} from '../scripts/core/presets.mjs';
import {ORB_ELEMENTS,orbRecipe} from '../scripts/catalogs/shared/orb-builder.mjs';
import {SPELL_SOUND_DESIGNS} from '../scripts/engines/sound/spell-sounds.mjs';
import {FEAT_SOUND_DESIGNS,WEAPON_SOUND_DESIGNS} from '../scripts/engines/sound/ability-sounds.mjs';
import {dndEntries,dndRecipe} from '../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';

// Single exhaustive list keeps alpha, timing, scale and topology audits aligned.
export function catalogAuditEntries(){return [
 ...PF2E_SPELLS.filter(item=>!item.design?.unavailable&&item.design?.motif!=='generic').map(item=>({domain:'spell',item,build:options=>spellRecipe(item,undefined,options),sound:SPELL_SOUND_DESIGNS[item.id]})),
 ...PF2E_FEATS.map(item=>({domain:'feat',item,build:options=>featRecipe(item,options),sound:FEAT_SOUND_DESIGNS[item.id]})),
 ...PF2E_WEAPONS.flatMap(item=>item.modes.map(mode=>({domain:'weapon',item,mode:mode.mode,build:options=>weaponRecipe(item,mode.mode,options),sound:WEAPON_SOUND_DESIGNS[`${item.id}:${mode.mode}`]}))),
 ...[...PF2E_CONDITIONS,...PF2E_EFFECTS].map(item=>({domain:item.kind,item,build:options=>stateRecipe(item,{catalog:options?.catalog})})),
 ...PF2E_CONDITIONS.flatMap(item=>Object.keys(item.damageVariants??{}).map(damageType=>({domain:'damageVariant',item,mode:damageType,build:options=>stateRecipe(item,{damageType,catalog:options?.catalog})}))),
 ...PF2E_EFFECTS.flatMap(item=>Object.keys(item.elementVariants??{}).map(element=>({domain:'elementVariant',item,mode:element,build:options=>stateRecipe(item,{element,aura:null,catalog:options?.catalog})}))),
 ...PF2E_EFFECTS.flatMap(item=>Object.keys(item.auraDesign?.variants??{}).map(auraVariant=>({domain:'auraVariant',item,mode:auraVariant,build:options=>stateRecipe(item,{auraVariant,catalog:options?.catalog})}))),
 ...starterRecipes().map(recipe=>({domain:'starter',item:recipe,build:()=>recipe})),
 ...Object.keys(ORB_ELEMENTS).map(element=>({domain:'orb',item:{id:`chromatic-orb-${element}`,name:`Chromatic orb · ${ORB_ELEMENTS[element]}`},mode:element,build:()=>orbRecipe({element})})),
 ...(process.argv.includes('--all-systems')?dndEntries().flatMap(item=>item.variants.map(variant=>({domain:`dnd5e-${item.kind}`,item,mode:variant.id,build:options=>dndRecipe(item,variant.id,options),sound:{profile:variant.soundProfile}}))):[]),
 ];}
export const auditScope=()=>catalogAuditEntries().reduce((counts,e)=>({...counts,[e.domain]:(counts[e.domain]??0)+1}),{});
