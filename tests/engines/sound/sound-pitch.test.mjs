import test from 'node:test';
import assert from 'node:assert/strict';
import {installSoundPitch,placeSound,sceneEcho} from '../../../scripts/engines/sound/sound-pitch.mjs';

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

test('a blow ringing off a shield echoes: an echo joins the sound’s effects for that play only',()=>{
 const handlers=new Map();let next=0;
 const hooks={on:(name,fn)=>{const id=++next;handlers.set(id,{name,fn});return id;},off:id=>handlers.delete(id),call:(name,data)=>{for(const h of handlers.values())if(h.name===name)h.fn(data);}};
 const node=()=>({connect(){},gain:{value:1},delayTime:{value:0},frequency:{value:0}});
 const context={createGain:node,createDelay:node,createBiquadFilter:node};
 class Sound{constructor(src){this.src=src;this.effects=[];}_createNodes(){const ended=[];this.sourceNode={context,playbackRate:{value:1},addEventListener:(e,fn)=>ended.push(fn)};this.end=()=>ended.forEach(fn=>fn());}}
 const uninstall=installSoundPitch({hooks,Sound});
 hooks.call('createSequencerSound',{file:'block.ogg',animaterPitch:1.02,animaterEcho:{delay:.09,feedback:.38}});
 const ringing=new Sound('block.ogg');ringing._createNodes();
 assert.equal(ringing.effects.length,1);assert.equal(ringing.sourceNode.playbackRate.value,1.02);
 ringing.end();assert.equal(ringing.effects.length,0,'removed once it has played');
 const dry=new Sound('block.ogg');dry._createNodes();assert.equal(dry.effects.length,0);
 uninstall();
});

test('a sound is heard from where it happens: further is quieter and duller, off to one side pans that way',()=>{
 const ear={x:0,y:0},view={x:0,y:0,width:2000};
 const near=placeSound({x:200,y:0},{ear,view,grid:100}),far=placeSound({x:3000,y:0},{ear,view,grid:100}),left=placeSound({x:-800,y:0},{ear,view,grid:100});
 assert.equal(near.gain,1);assert.ok(near.cutoff>=18000,'close by: untouched');
 assert.ok(far.gain<.7&&far.gain>=.35&&far.cutoff<6000,'thirty squares off: quieter and duller');
 assert.ok(left.pan<0&&near.pan>0&&Math.abs(far.pan)<=.6,'panned gently by its side of the screen');
 assert.equal(placeSound(null,{ear}),null);
});
test("a scene's acoustics: open air dries the echo, a cave lengthens it and gives other sounds a room",()=>{
 const echo={delay:.03,wet:.1,feedback:.05,tone:4000};
 assert.equal(sceneEcho(echo,null),echo);
 assert.ok(sceneEcho(echo,'outdoors').wet<echo.wet);
 const cave=sceneEcho(echo,'cave');assert.ok(cave.delay>echo.delay&&cave.wet>echo.wet&&cave.tone<=2500);
 assert.equal(sceneEcho(null,'outdoors'),null);assert.ok(sceneEcho(null,'hall').wet>0);
});
test('a placed sound is quieter far away, and gets a dulling filter and a panner for that play',()=>{
 const handlers=new Map();let next=0;
 const hooks={on:(name,fn)=>{const id=++next;handlers.set(id,{name,fn});return id;},off:id=>handlers.delete(id),call:(name,data)=>{for(const h of handlers.values())if(h.name===name)h.fn(data);}};
 const node=()=>({connect(){},gain:{value:1},delayTime:{value:0},frequency:{value:0},pan:{value:0}});
 const context={createGain:node,createDelay:node,createBiquadFilter:node,createStereoPanner:node};
 class Sound{constructor(src){this.src=src;this.effects=[];}_createNodes(){this.sourceNode={context,playbackRate:{value:1},addEventListener(){}};}}
 const uninstall=installSoundPitch({hooks,Sound,listener:()=>({ear:{x:0,y:0},view:{x:0,y:0,width:2000},grid:100}),acoustics:()=>'cave'});
 const data={file:'hit.ogg',volume:.8,animaterAt:{x:3000,y:0}};hooks.call('createSequencerSound',data);
 assert.ok(data.volume<.8);
 const s=new Sound('hit.ogg');s._createNodes();
 assert.equal(s.effects.length,3,'dull, pan, and the cave around it');
 // Not Animater's: untouched.
 const other={file:'music.ogg',volume:.5};hooks.call('createSequencerSound',other);assert.equal(other.volume,.5);
 uninstall();
});
