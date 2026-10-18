// Damage words named next to "damage" (or @Damage[..[type]] data). Lightning and
// thunder are the D&D names of electricity and sonic.
const damageWords={acid:'acid',bludgeoning:'physical',cold:'cold',electricity:'electricity',lightning:'electricity',fire:'fire',force:'force',
  mental:'mental',psychic:'mental',necrotic:'void',radiant:'radiant',piercing:'physical',poison:'poison',slashing:'physical',sonic:'sonic',
  thunder:'sonic',void:'void',vitality:'vitality',spirit:'spirit',bleed:'bleed',physical:'physical',untyped:'untyped'};
const typeWord=Object.keys(damageWords).join('|');
const wardNames=/^(?:shield|fire-shield|force-shield|wall-of-force|protectors-sphere|shield-of-faith|shimmering-(?:shield|field)|forbidding-ward|blood-ward|protection|warding-bond|bonded)(?:-amped)?$/;
export function fxSemantics(entry, description='') {
  const raw=String(description || entry.plainDescription || entry.descriptionText || '');
  const text=raw.replace(/<[^>]*>/g,' ').replace(/@\w+\[[^\]]+\]\{([^}]+)\}/g,'$1').replace(/\s+/g,' ').toLowerCase();
  const name=String(entry.slug??entry.name??'').toLowerCase().replace(/^(?:spell[ -])?effect[ -:]*/,'').replace(/[^a-z0-9]+/g,'-');
  const types=new Set([...text.matchAll(new RegExp(`\\b(${typeWord})\\b[^.!?;]{0,25}?\\bdamage\\b|\\[(${typeWord})\\]`,'g'))].map(m=>damageWords[m[1]??m[2]]));
  // A real ward is a magical barrier, field or warding effect, not a mundane
  // shield, armor, body toughness or a bare resistance number.
  const field=/\b(?:barrier|ward(?:s|ed|ing)?|force field|shimmering[^.!?]{0,20}field|protective (?:bubble|field|aura|barrier|layer of (?:force|energy))|(?:magical|magic) (?:shield|barrier|field)|shield of (?:force|light|faith)|aegis|bubble|abjuration|globe|energy[^.!?]{0,40}shimmers|magical (?:energy|network)|cast shield|vortex)\b/.test(text)||/spells-srd\.item/.test(text);
  const mundaneShield=/\b(?:you are wielding a shield|your shield is raised|you have raised your shield|you have your shield raised|have raised your shield)\b/.test(text)&&!/\bshield of force\b|\bmagical shield\b/.test(text);
  return {
    damage:/\b(?:deal(?:s|t|ing)?|take(?:s|n)?|taking|suffer(?:s|ing)?)\b(?!\s+(?:no|zero)\b)[^.!?]{0,100}\bdamage\b/.test(text),
    healing:/\b(?:restore[sd]?|regain[sd]?|recover[sd]?|heal[sd]?)\b[^.!?]{0,70}\bhit points?\b/.test(text)||/\b(?:healing|restorative)\b[^.!?]{0,60}\b(?:hit points?|vitality)\b/.test(text),
    ward:/\b(?:gain[sd]?|grants?|provides?|gives?)\b[^.!?]{0,85}\b(?:bonus[^.!?]{0,35}(?:\bac\b|armor class)|resistance to|protective (?:barrier|shield))\b/.test(text)||wardNames.test(name),
    field:field||wardNames.test(name),
    mundane:mundaneShield,
    body:/\b(?:your (?:skin|shell|exoskeleton|muscles|limbs)|thick metal|your thralls?|while (?:you )?wear(?:ing)? this armor|armor \()/.test(text),
    teleport:/\b(?:teleport(?:s|ed|ation)?|translocate)\b/.test(text)||/^(?:translocate|teleport|dimension-door|misty-step|blink)(?:-|$)/.test(name),
    // The body itself travels: a Stride/Step/charge/dash/flight, not a stealthy Sneak.
    moves:/\b(?:strides?|striding|step(?:s|ped)?|charg(?:e|es|ing)|dash(?:es|ing)?|run(?:s|ning)?|sprint(?:s|ing)?|fl(?:y|ies|ying)|leap(?:s|ing)?|jump(?:s|ing)?|burrow(?:s|ing)?|swim(?:s|ming)?|climb(?:s|ing)?|rush(?:es|ing)?|pounc(?:e|es|ing)|trampl(?:e|es|ing)|glid(?:e|es|ing)|move(?:s)? (?:up to|your speed|twice|a distance|toward|through|into)|travel(?:s)? up to|speed)\b/.test(text),
    ...Object.fromEntries([...types].map(t=>[`dmg-${t}`,true])),
  };
}
