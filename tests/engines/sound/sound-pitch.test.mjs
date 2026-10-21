import test from 'node:test';
import assert from 'node:assert/strict';
import {installSoundPitch} from '../../../scripts/engines/sound/sound-pitch.mjs';

function fakes(){
 const handlers=new Map();let next=0;
 const hooks={on:(name,fn)=>{const id=++next;handlers.set(id,{name,fn});return id;},off:id=>handlers.delete(id),call:(name,data)=>{for(const h of handlers.values())if(h.name===name)h.fn(data);}};
 class Sound{constructor(src){this.src=src;}_createNodes(){this.sourceNode={playbackRate:{value:1}};}}
 return {hooks,Sound};
}
test('a sound announced with a pitch plays shifted on this client; others keep their pitch',()=>{
 const {hooks,Sound}=fakes(),uninstall=installSoundPitch({hooks,Sound});
 hooks.call('createSequencerSound',{file:'modules/animater/assets/sounds/surfaces/kenney/impactPlate_heavy_000.ogg',animaterPitch:1.06});
 const shifted=new Sound('modules/animater/assets/sounds/surfaces/kenney/impactPlate_heavy_000.ogg');shifted._createNodes();
 assert.equal(shifted.sourceNode.playbackRate.value,1.06);
 const again=new Sound('modules/animater/assets/sounds/surfaces/kenney/impactPlate_heavy_000.ogg');again._createNodes();
 assert.equal(again.sourceNode.playbackRate.value,1,'one shift per announced play');
 const other=new Sound('sounds/other.ogg');other._createNodes();assert.equal(other.sourceNode.playbackRate.value,1);
 uninstall();
});
test('installing twice wraps once, and uninstalling restores Foundry',()=>{
 const {hooks,Sound}=fakes(),original=Sound.prototype._createNodes;
 const a=installSoundPitch({hooks,Sound});installSoundPitch({hooks,Sound});
 a();assert.equal(Sound.prototype._createNodes,original);
});
