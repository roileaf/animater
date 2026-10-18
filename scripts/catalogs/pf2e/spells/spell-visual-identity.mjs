// Shared spell families retain their semantic delivery. Visible casting seals
// give siblings different spatial compositions; never add attacks or conditions.
export const SPELL_SEAL_LAYOUTS = [
 'bloom','fold','rise','descend','sweep','returnSweep','diagonal','returnDiagonal',
 'orbit','counterOrbit','weave','crossWeave',
];
export const SPELL_SEAL_FINISHES = ['settle','lift','sink','part','gather','unwind','wind','breathe','crest','root'];
const track=(property,from,to,duration,extra={})=>({property,from,to,duration,delay:0,ease:'easeInOutQuad',loop:false,pingPong:false,fromEnd:false,...extra});
export function applySpellVisualIdentity(spell,layers,stage) {
 const identity=spell.design?.visualIdentity;
 if(!identity) return layers;
 const result=layers.map(s=>({...s}));
 // Change only a local casting seal. Directed flight, target contact and native
 // areas keep the exact authored choreography and asset role.
 const index=result.findIndex(s=>s.kind==='cast'&&(!s.subject||s.subject==='source')&&s.mediaSlot==='cast');
 if(index<0)return layers;
 const seal=result[index], duration=Math.max(1400,seal.duration);
 const movement=1100;
 const layouts={
  bloom:[track('scale.x',.5,1,movement),track('scale.y',.5,1,movement)],
  fold:[track('scale.x',1.5,1,movement),track('scale.y',1.5,1,movement)],
  rise:[track('position.y',.5,-.5,movement)],
  descend:[track('position.y',-.5,.5,movement)],
  sweep:[track('position.x',-.5,.5,movement)],
  returnSweep:[track('position.x',.5,-.5,movement)],
  diagonal:[track('position.x',-.5,.5,movement),track('position.y',.5,-.5,movement)],
  returnDiagonal:[track('position.x',.5,-.5,movement),track('position.y',-.5,.5,movement)],
  orbit:[track('rotation',0,180,movement),track('position.x',-.5,.5,movement,{pingPong:true,loop:true})],
  counterOrbit:[track('rotation',0,-180,movement),track('position.y',-.5,.5,movement,{pingPong:true,loop:true})],
  weave:[track('position.x',-.5,.5,movement,{pingPong:true,loop:true}),track('scale.y',.5,1,movement)],
  crossWeave:[track('position.y',-.5,.5,movement,{pingPong:true,loop:true}),track('scale.x',.5,1,movement)],
 };
 result[index]={...seal,duration,scale:Math.max(.85,seal.scale??1),scaleInDuration:0,scaleOutDuration:0,
  tracks:[...(seal.tracks??[]),...(layouts[identity.layout]??[])],
 };
 // The finishing seal is cosmetic cast punctuation, not a repeated hit or
 // implied successful save. It uses the casting asset, never target footage.
 const finish=identity.finish;
 if(finish==='settle')return result;
 const finishes={
  lift:{offsetY:-.5,tracks:[track('position.y',0,-.5,1100)]},
  sink:{below:true,offsetY:.5,tracks:[track('position.y',0,.5,1100)]},
  part:{offsetX:-.5,tracks:[track('position.x',0,-.5,1100)]},
  gather:{offsetX:.5,tracks:[track('position.x',.5,0,1100)]},
  unwind:{tracks:[track('rotation',0,-180,1100)]},
  wind:{tracks:[track('rotation',0,180,1100)]},
  breathe:{tracks:[track('scale.x',.5,1.5,1100,{loop:true,pingPong:true}),track('scale.y',.5,1.5,1100,{loop:true,pingPong:true})]},
  crest:{offsetY:-.5,below:false,tracks:[track('scale.x',.5,1,1100)]},
  root:{below:true,tracks:[track('scale.y',1,.5,1100)]},
 };
 if(result.length>=10)return result;
 const closing=stage('cast','cast',Math.max(0,...result.filter(s=>s.kind!=='motion').map(s=>s.delay+s.duration))-900,1400,
  {subject:'source',stageId:`${spell.id}-identity-close`,label:'Casting seal echo',scale:.85,opacity:.85,fadeIn:150,fadeOut:250,...finishes[finish]});
 result.push(closing);
 return result;
}
