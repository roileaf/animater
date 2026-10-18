// Visual cues for contents released by a native bomb Strike. These never apply
// conditions, persistent damage, splash targeting or terrain rules.
export const WEAPON_COLORS = {physical:'#d8bf8a',fire:'#ff875f',cold:'#82d8ff',electricity:'#acb0ff',acid:'#b8e580',poison:'#8dd998',void:'#9366bf',negative:'#9366bf',vitality:'#fff0ab',positive:'#fff0ab',sonic:'#b9cff5',mental:'#c591e5',force:'#c9b8ff',spirit:'#fff0cf',bleed:'#c53750',water:'#7dcced',mud:'#b48b60',glue:'#ddd49e',light:'#fff5b3',silver:'#cbd5eb',foam:'#cbbfac',unholy:'#7a3f9e',holy:'#fff0cf',air:'#e6f0f5',earth:'#b48b60',plant:'#96ba65',shadow:'#4a4458'};
export const WEAPON_ACCENTS = {
 // impact.001 has no white film; 005/007/009 do. Never fall through to impact.001.blue.
 physical:['impact.005.white','impact.007.white','impact.001.orange','impact.005','impact.001'],
 fire:['impact.fire.01.orange','fireball.explosion.orange'],
 cold:['impact.frost.white.01','impact_themed.ice_shard.blue'],
 electricity:['lightning_ball.blue','lightning_orb.01.complete.blue'],
 acid:['liquid.splash.green','liquid.splash'],
 poison:['impact_themed.poison.greenyellow','liquid.splash.green','liquid.splash'],
 void:['toll_the_dead.purple.skull_smoke','toll_the_dead.green.skull_smoke','smoke.puff.centered.grey'],
 negative:['toll_the_dead.purple.skull_smoke','toll_the_dead.green.skull_smoke','smoke.puff.centered.grey'],
 vitality:['divine_smite.target.yellowwhite','divine_smite.target.blueyellow'],
 positive:['divine_smite.target.yellowwhite','divine_smite.target.blueyellow'],
 sonic:['shatter.blue','thunderwave.center.blue'],
 mental:['explosion.02.purple','explosion.02.blue'],
 force:['explosion.02.purple','explosion.02.blue'],
 spirit:['divine_smite.target.yellowwhite','divine_smite.target.blueyellow'],
 bleed:['liquid.splash.red','liquid.splash02.red'],
 // Unholy spirit is the dark counterpart of holy radiance, never yellow-white.
 unholy:['divine_smite.target.dark_purple','smoke.puff.centered.dark_purple','smoke.puff.centered.grey'],
 // Trait/construction flourishes (see weapon-semantics traitFlavors).
 holy:['divine_smite.target.yellowwhite','divine_smite.target.blueyellow'],
 light:['impact.007.yellow','impact.005.yellow'],
 air:['wind_lines.01.01.white','wind_lines.01.02.white'],
 earth:['impact.ground_crack.01.orange','impact.earth.01.browngreen'],
 water:['water_splash.circle.01.blue','liquid.splash.blue'],
 plant:['swirling_leaves.outburst.01.greenorange','wind_lines.01.leaves.01.green'],
 shadow:['smoke.puff.centered.dark_black','smoke.puff.centered.grey'],
};
export const BOMB_PAYLOADS = {
 crossFire:{roots:['fireball.explosion.orange'],label:'Crossed flame release'},
 radiation:{roots:['particles.002.001.complete.many.greenyellow','particles.002.001.complete.many'],label:'Radioactive particles'},
 silverLight:{roots:['particles.002.001.complete.many.white','particles.002.001.complete.many'],label:'Silver emotional radiance'},
 algae:{roots:['liquid.splash.green','liquid.splash'],label:'Glowing algae splash'},
 needles:{roots:['particles.002.001.complete.few.greenyellow','particles.002.001.complete.few'],label:'Cactus needles scatter'},
 insects:{roots:['particles.002.001.complete.many.white','particles.002.001.complete.many'],label:'Biting swarm approximation'},
 liquid:{roots:['liquid.splash'],label:'Liquid splash'},
 gas:{roots:['smoke.puff.centered.grey'],label:'Gas release'},
 fire:{roots:['fireball.explosion.orange'],label:'Ignition splash'},
 frost:{roots:['impact.frost.white.01'],label:'Freezing splash'},
 lightning:{roots:['lightning_ball.blue'],label:'Electrical discharge'},
 void:{roots:['toll_the_dead.purple.skull_smoke','toll_the_dead.green.skull_smoke'],label:'Void miasma'},
 radiance:{roots:['divine_smite.target.yellowwhite','divine_smite.target.blueyellow'],label:'Radiant burst'},
 force:{roots:['explosion.02.purple','explosion.02.blue'],label:'Force burst'},
 sonic:{roots:['shatter.blue'],label:'Sonic shockwave'},
 shrapnel:{roots:['explosion.shrapnel.bomb.01.black'],label:'Shrapnel splash'},
 crystal:{roots:['impact_themed.ice_shard.blue'],label:'Crystal fragmentation'},
 pressure:{roots:['explosion.04.blue'],label:'Pressure wave'},
 firework:{roots:['firework.01.orangeyellow'],label:'Firecracker burst'},
 light:{roots:['particles.002.001.complete.many.white','particles.002.001.complete.many.blue'],label:'Bioluminescent flare'},
 web:{roots:['web.01','web.complete.002.white'],label:'Silken swarm cue'},
 thorns:{roots:['entangle.02.complete.02.green','entangle.green'],label:'Brambles burst'},
 spores:{roots:['particles.002.001.complete.few.greenyellow','particles.002.001.complete.few'],label:'Mold spores scatter'},
 foam:{roots:['liquid.splash'],label:'Expanding foam'},
};
export function payloadAppearance(element,assets=[]) {
 if(element==='physical')return {};
 const materialColors={plant:'#96ba65',crystal:'#ba7451',redPowder:'#c64e49',darkInsects:'#77686f'};
 if(materialColors[element])return {colorize:true,tintEnabled:true,tint:materialColors[element]};
 // Preserve authored highlights and secondary hues when both edition choices
 // already show the intended material. Neutralize only off-color substitutes.
 const palette={fire:/\.(?:orange|orangered|orangeyellow|yellow)\b/,cold:/\.(?:blue|white)\b/,electricity:/\.blue\b/,acid:/\.green\b/,poison:/\.(?:green|greenyellow)\b/,water:/\.blue\b/,void:/\.purple\b/,negative:/\.purple\b/,vitality:/\.(?:yellowwhite|blueyellow)\b/,positive:/\.(?:yellowwhite|blueyellow)\b/,spirit:/\.(?:yellowwhite|blueyellow)\b/,bleed:/\.red\b/,sonic:/\.blue\b/,force:/\.purple\b/,mental:/\.purple\b/,light:/\.(?:white|yellow)\b/,silver:/\.white\b/,unholy:/\.dark_purple\b/,holy:/\.(?:yellowwhite|blueyellow)\b/,air:/\.white\b/,earth:/\.(?:orange|browngreen)\b/,shadow:/\.dark_black\b/}[element];
 if(assets.length&&palette&&assets.every(key=>palette.test(key)))return {};
 // Neutralize source color before tinting: multiplying a blue Free liquid by
 // green alone makes it dark, rather than producing an acid-green splash.
 return {colorize:true,tintEnabled:true,tint:WEAPON_COLORS[element]??WEAPON_COLORS.physical};
}
