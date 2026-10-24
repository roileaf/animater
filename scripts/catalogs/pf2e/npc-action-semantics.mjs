// Non-damaging NPC actions often have no magical trait. Match an explicit
// effect in their own description, never turn every unknown action into magic.
export function npcActionSemantics(item) {
  const name=String(item?.name??'').toLowerCase();
  const text=String(item?.system?.description?.value??'').replace(/<[^>]*>/g,' ').toLowerCase();
  const both=`${name} ${text}`;
  const form=(id,aim='target')=>({id,aim,trigger:'use'});
  if (/\bmagnet(?:ic|ism)\b/.test(both)) return form('magnetism');
  if (/\bdisarm\b/.test(both)) return form('disarm');
  if (/\b(?:web|webbing)\b/.test(both)&&/\b(?:restrained|immobilized|escape|ensnare|entangle)\b/.test(both)) return form('bind');
  if (/\b(?:frightened|demoralize|terrified|fleeing)\b/.test(both)) return form('fear','self');
  if (/\b(?:confused|stupefied|fascinated)\b/.test(both)) return form('confuse');
  if (/\bblinded\b/.test(both)) return form('blind');
  if (/\b(?:restrained|immobilized|ensnare|entangle)\b/.test(both)) return form('bind');
  if (/\b(?:invisibility|camouflage|hide|blend in)\b/.test(name)||/\b(?:becomes?|turns?) invisible\b/.test(text)) return form('veil','self');
  if (/\b(?:regains?|restores?)\b[^.!?]{0,70}\bhit points\b/.test(text)) return form('heal','self');
  if (/\b(?:rally|inspire|encourage)\b/.test(name)) return form('rally','self');
  return null;
}
