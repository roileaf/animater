// Reviewed against complete native descriptions. These activities share a word,
// not a recipient, movement path, attack sequence, or preparation phase.
export const TOSS_MEDIA = {
  'distracting-toss': {cast:['glint.yellow.few','glint'],bolt:['dagger.throw.01.white','dagger.throw'],hit:['impact.001.white','impact.001'],aura:['glint.yellow.few','glint']},
  'rebounding-toss': {cast:['wind_lines.01.02.white'],bolt:['dagger.throw.01.white','dagger.throw'],hit:['impact.002.white','impact.001']},
  'feral-toss': {cast:['wind_lines.01.01.white'],hit:['melee_generic.piercing.one_handed','unarmed_strike.physical.02'],aura:['smoke.puff.side.02.white','smoke.puff.side.grey']},
  'friendly-fling': {cast:['wind_lines.01.01.white'],horn:['melee_generic.piercing.one_handed','dagger.melee.02.white'],landing:['smoke.puff.side.grey']},
  'friendly-toss': {cast:['smoke.puff.centered.grey'],aura:['wind_lines.01.02.white'],landing:['smoke.puff.ring.01.white']},
  'jotuns-boost': {cast:['wind_lines.01.02.white'],aura:['wind_lines.01.01.white'],landing:['smoke.puff.side.02.white']},
  'whirlwind-toss': {cast:['wind_lines.01.02.white'],hit:['unarmed_strike.physical.02','unarmed_strike.physical'],landing:['smoke.puff.centered.grey']},
  'wind-tossed-spell': {cast:['wind_lines.01.01.white'],aura:['wind_lines.01.02.white']},
};

export const TOSS_NOTES = {
  'distracting-toss':'Upward distraction, one thrown-weapon Strike, then a symbolic catch cue. The airborne glint marks the first weapon; the dagger flight represents the second configurable thrown weapon. Feint and catching outcomes stay with PF2e.',
  'feral-toss':'Head shake, one horn/antler/tusk Strike, then a confirmed-hit push cue. Native piercing footage approximates the natural weapon. Preview shows the 5-foot success branch; critical distance and eligible creature size require the resolved native result.',
  'friendly-fling':'Horn scoop, small piercing contact, then a low 20-foot ally toss and upright landing. The selected first recipient must be a smaller willing adjacent ally. The ally\'s optional reaction Strike is separate.',
  'friendly-toss':'Backward wind-up and forward heave, then a high 30-foot ally arc with an upright landing. The selected first recipient must be a willing adjacent ally of eligible size. No horn contact or automatic ally Strike.',
  'jotuns-boost':'Brace, vertical ally lift, then a flatter 25-foot outward ally toss and upright landing. Two free hands allow the native 30-foot alternative; customize that branch. The selected first recipient must be a smaller willing adjacent ally.',
  'rebounding-toss':'One thrown weapon hits the first foe, then rebounds from that foe to the second only after a confirmed first hit. Preview illustrates the successful branch. Select two ordered enemies; their native 10-foot separation and attack results remain PF2e.',
  'whirlwind-toss':'Whirl the held victim, Thrash, apply one collateral contact to each other selected adjacent foe, then illustrate the optional 10-foot toss of the held victim. Select the grabbed victim first. No other recipient is thrown; prone and actual movement remain manual.',
  'wind-tossed-spell':'Two source wind curls prepare the next spell. No attack, target impact or creature throw happens during this spellshape action.',
};

export function tossFeatRecipe(feat,{effect,cast,impact,aura,motion,copy,travel}) {
  if(!TOSS_MEDIA[feat.slug])return null;
  const first={targetSelection:'first',targetLimit:1};
  const after=(stage,extra={})=>({afterStage:stage.stageId,timingAnchor:'end',...extra});
  const arrival=stage=>({afterStage:stage.stageId,timingAnchor:'arrival',...first});
  const arc=(label,delay,duration,distance,jumpHeight,extra={})=>motion('leap','targets',label,delay,duration,{...first,motionRange:'distance',motionHeading:'away',distance,jumpHeight,motionArrival:55,motionHold:15,intensity:.5,...extra});
  const land=(stage,label,extra={})=>effect('aura','landing',label,0,1100,{subject:'targets',attach:true,below:true,scale:.8,opacity:.7,...arrival(stage),...extra});
  let stages;
  switch(feat.slug){
    case 'friendly-fling': {
      const scoop=motion('throw','source','Head lowers, then horns scoop and fling',0,1700,{distance:.24,intensity:.6});
      const horns=effect('impact','horn','Small piercing contact from the horns',600,1300,{...first,scale:.65});
      const flight=arc('Low horn-assisted ally arc (20 feet)',0,4100,4,.55,after(horns));
      stages=[scoop,cast('Horn scoop airflow',300,1300,{scale:.8,rotation:-30}),horns,flight,land(flight,'Low forward landing wisp')];break;
    }
    case 'friendly-toss': {
      const windup=motion('recoil','source','Lean back to gather the ally',0,1800,{distance:.24,intensity:.65});
      const heave=motion('lunge','source','Forward two-arm heave',0,1500,{...after(windup),distance:.24,intensity:.65});
      const flight=arc('High barbarian ally throw (30 feet)',0,5200,6,1.25,{afterStage:heave.stageId,timingAnchor:'start',startOffset:550});
      stages=[windup,cast('Feet brace in dust',0,1500,{below:true,scale:1.2}),heave,flight,
        aura('source','Air displacement at release',0,1300,{afterStage:flight.stageId,timingAnchor:'start',scale:1.25,rotation:90}),land(flight,'Wide upright landing dust ring',{scale:1.3})];break;
    }
    case 'jotuns-boost': {
      const brace=motion('pulse','source','Giant strength braces for the boost',0,1800,{intensity:.4});
      const lift=motion('rush','targets','Lift the willing ally upright',700,3200,{...first,motionRange:'distance',motionHeading:'up',distance:1.1,intensity:.5,motionArrival:35,motionHold:20});
      const flight=arc('Flatter outward giant boost (25 feet)',0,4800,5,.35,{afterStage:lift.stageId,timingAnchor:'arrival'});
      stages=[brace,cast('Upward lifting draft',300,1800,{rotation:-90,scale:1.1}),lift,
        aura('targets','Air lifts the ally',0,1500,{...first,afterStage:lift.stageId,timingAnchor:'start',offsetY:-.3,scale:.85}),flight,land(flight,'Upright boosted landing trail')];break;
    }
    case 'distracting-toss': {
      const juggle=cast('Upward weapon distraction marker',0,2100,{scale:.65,offsetY:-.4,
        tracks:[{property:'position.y',from:0,to:-1.2,duration:1000,ease:'easeOutQuad'},{property:'position.y',from:-1.2,to:0,duration:900,delay:1200,ease:'easeInQuad'}]});
      const release=motion('lunge','source','Draw and throw the second weapon',800,1400,{distance:.2,intensity:.65});
      const shot=travel('Second thrown weapon strikes the distracted foe',1250,{...first});
      stages=[juggle,release,shot,impact('One thrown-weapon contact',0,1300,{...first,...after(shot)}),
        aura('source','Original weapon catch marker (if caught)',0,1000,{...after(shot),scale:.45,offsetY:-.3})];break;
    }
    case 'rebounding-toss': {
      const release=motion('lunge','source','Release one rebounding weapon',0,1500,{distance:.2,intensity:.65});
      const shot=travel('Thrown weapon to the first foe',600,{...first});
      const hit=impact('First weapon contact',0,1300,{...first,...after(shot)});
      const rebound=travel('Successful rebound from first foe to second',0,{afterStage:shot.stageId,timingAnchor:'end',travelOrigin:'firstTarget',targetSelection:'second',targetLimit:2,requiresHit:true});
      stages=[cast('Throw release air trail',100,1200,{scale:.75}),release,shot,hit,rebound,
        impact('Second weapon contact after successful rebound',0,1300,{...after(rebound),targetSelection:'second',targetLimit:2,requiresHit:true})];break;
    }
    case 'feral-toss': {
      const ram=motion('lunge','source','Horn, antler or tusk thrust',550,1700,{distance:.24,intensity:.65});
      const hit=impact('One natural piercing Strike',1100,1500,{...first});
      stages=[motion('shake','source','Feral head shake',0,1300,{distance:.16,intensity:.5}),cast('Short head-thrust air trail',500,1200,{scale:.7}),ram,hit,
        motion('rush','targets','Confirmed-hit 5-foot push illustration',0,3000,{...after(hit),...first,requiresHit:true,motionRange:'distance',motionHeading:'away',distance:1,motionArrival:45,motionHold:20,intensity:.4}),
        aura('source','Natural weapon settles',2200,1100,{scale:.65,opacity:.65})];break;
    }
    case 'whirlwind-toss': {
      const whirl=motion('spin','targets','Whirl the grabbed victim',0,2400,{...first,intensity:.6});
      const thrash=impact('Thrash the held victim once',0,1500,{...after(whirl),...first});
      const toss=motion('roll','targets','Optional held-victim toss after Thrash',0,3400,{...after(thrash),...first,motionRange:'distance',motionHeading:'away',distance:2,motionArrival:55,motionHold:15,intensity:.65});
      stages=[cast('Whirling air around the holder',0,2400,{scale:1.3}),whirl,
        copy('Held-victim whirl echo',200,{...first,subject:'targets',copies:1,duration:2000,copySpread:.25}),thrash,
        impact('Collateral Thrash once per other adjacent foe',0,1500,{afterStage:thrash.stageId,timingAnchor:'start',targetSelection:'secondary',targetStagger:180}),toss,
        land(toss,'Optional held-victim landing dust')];break;
    }
    case 'wind-tossed-spell':
      stages=[cast('Wind curls gather for the next spell',0,1800,{rotation:-35,scale:1.15}),
        aura('source','Crosswind holds the spellshape preparation',850,2100,{rotation:70,scale:.95}),motion('pulse','source','Settle the wind preparation',600,1900,{intensity:.18})];break;
  }
  return {stages,note:TOSS_NOTES[feat.slug]};
}
