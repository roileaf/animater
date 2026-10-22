import test from 'node:test';
import assert from 'node:assert/strict';
import {installSoundPitch,placeSound,sceneEcho} from '../../../scripts/engines/sound/sound-pitch.mjs';
import {createRoomCache,roomFor,reverbSend} from '../../../scripts/engines/sound/room-acoustics.mjs';
import {createReverbBuses} from '../../../scripts/engines/sound/reverb-bus.mjs';

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

// Room-aware sound, wired as main.mjs wires it: the walls' room (a fake sweep), the shared reverb buses (a fake
// audio context), and the scene's own Acoustics choice.
function fakeContext(){
 const made=[];
 const node=(kind,extra={})=>{const n={kind,outs:[],connect(to){this.outs.push(to);return to;},disconnect(){this.outs.length=0;},...extra};made.push(n);return n;};
 return {sampleRate:1000,made,destination:{kind:'destination',outs:[]},gainNode:{kind:'master',outs:[],connect(){}},
  createGain:()=>node('gain',{gain:{value:1}}),createDelay:()=>node('delay',{delayTime:{value:0}}),createStereoPanner:()=>node('pan',{pan:{value:0}}),
  createConvolver:()=>node('convolver',{buffer:null}),createBiquadFilter:()=>node('filter',{type:'lowpass',frequency:{value:350}}),
  createBuffer:(channels,length,rate)=>{const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate:rate,copyToChannel:(src,i)=>data[i].set(src)};}};
}
// Closed square rooms, by where the sound is: a cell (x < 1000), a room (to 2000), a hall beyond.
const walls=(centre)=>{const side=centre.x<1000?4:centre.x<2000?6:15,h=side*50;return [centre.x-h,centre.y-h,centre.x+h,centre.y-h,centre.x+h,centre.y+h,centre.x-h,centre.y+h];};
async function roomRig({muffle=()=>false}={}){
 const handlers=new Map();let next=0;
 const hooks={on:(name,fn)=>{const id=++next;handlers.set(id,{name,fn});return id;},off:id=>handlers.delete(id),call:(name,data)=>{for(const h of handlers.values())if(h.name===name)h.fn(data);}};
 const context=fakeContext(),world={acoustics:null,sweeps:0};
 const impulse={numberOfChannels:1,sampleRate:1000,length:3000,getChannelData:()=>new Float32Array(3000).fill(1)};
 const buses=createReverbBuses({loadImpulse:async()=>impulse,contextOf:()=>context});
 buses.ready();await new Promise((r)=>setImmediate(r));
 const cache=createRoomCache({sweep:(at)=>{world.sweeps++;return walls(at);}});
 const room=(data)=>{
  const r=roomFor(data,{sceneAcoustics:world.acoustics,viewedScene:'S1',enabled:true,cache,gridPx:100});
  return r.kind==='reverb'?{node:(c)=>buses.send(c,r.room,reverbSend(r.room,1))}:null;
 };
 class Sound{constructor(src){this.src=src;this.effects=[];}_createNodes(){const ended=[];this.sourceNode={context,playbackRate:{value:1},addEventListener:(e,fn)=>ended.push(fn)};this.end=()=>ended.forEach(fn=>fn());}}
 const uninstall=installSoundPitch({hooks,Sound,room,muffle,acoustics:()=>world.acoustics});
 const play=(at,extra={})=>{hooks.call('createSequencerSound',{file:'boom.ogg',volume:1,animaterAt:at,animaterScene:'S1',animaterLevel:'L1',...extra});const s=new Sound('boom.ogg');s._createNodes();return s;};
 const convolvers=()=>context.made.filter((n)=>n.kind==='convolver');
 return {play,context,world,convolvers,uninstall};
}
// What a node feeds once the sound connects to it: a reverb send taps into a convolver, an echo into a delay line.
const feeds=(n)=>{if(typeof n.onConnectFrom!=='function')return [];const probe={outs:[],connect(to){this.outs.push(to);return to;}};n.onConnectFrom(probe);return probe.outs;};
const sendOf=(s)=>s.effects.find((n)=>feeds(n).some((t)=>t.outs?.some((o)=>o.kind==='convolver')));
test('unset scene adds a send into the room\'s bus',async()=>{
 const {play,convolvers,uninstall}=await roomRig();
 const s=play({x:1500,y:500});
 assert.equal(s.effects.length,1,'the send alone: no other shaping asked for');
 const send=s.effects[0];assert.equal(send.gain.value,1,'the dry sound passes through untouched');
 const source={outs:[],connect(to){this.outs.push(to);return to;}};source.connect(send);send.onConnectFrom(source);
 const tap=source.outs.find((n)=>n!==send),room=convolvers().find((c)=>c.buffer.length===800);
 assert.ok(Math.abs(tap.gain.value-.22)<1e-9);assert.deepEqual(tap.outs,[room]);
 uninstall();
});
test('GM choice wins after a change',async()=>{
 const {play,world,uninstall}=await roomRig();
 assert.ok(sendOf(play({x:2500,y:500})),'unset: the hall rings');
 world.acoustics='hall';
 const s=play({x:2500,y:500});
 assert.equal(s.effects.length,1,'the scene\'s own echo only');
 assert.equal(feeds(s.effects[0])[0]?.kind,'delay','its feedback echo, not a reverb send');
 assert.equal(sendOf(s),undefined);
 world.acoustics=null;assert.ok(sendOf(play({x:2500,y:500})),'back to the walls once cleared');
 uninstall();
});
test('other scene plays dry',async()=>{
 const {play,world,uninstall}=await roomRig();
 const s=play({x:1500,y:500},{animaterScene:'S2'});
 assert.equal(s.effects.length,0);assert.equal(world.sweeps,0,'no sweep of walls that are not loaded');
 assert.equal(play({x:1500,y:500},{animaterScene:undefined}).effects.length,0);
 uninstall();
});
test('muffled behind a wall',async()=>{
 const asked=[];
 const {play,uninstall}=await roomRig({muffle:(data)=>{asked.push(data.animaterAt);return data.animaterAt.y>1000;}});
 const behind=play({x:500,y:1500}),open=play({x:500,y:500});
 const lowpass=(s)=>s.effects.filter((n)=>n.kind==='filter'&&n.type==='lowpass');
 assert.deepEqual(lowpass(behind).map((n)=>n.frequency.value),[600],'Foundry\'s door muffling: lowpass at intensity 5');
 assert.equal(lowpass(open).length,0);
 assert.equal(asked.length,2,'one test per sound');
 // Muffling follows the walls in a scene with a GM choice too, and on its own (no room, no other shaping).
 const quiet=await roomRig({muffle:()=>true});quiet.world.acoustics='outdoors';
 assert.deepEqual(quiet.play({x:500,y:500}).effects.map((n)=>n.frequency?.value),[600]);
 quiet.uninstall();uninstall();
});
test('send is removed when the sound ends',async()=>{
 const {play,uninstall}=await roomRig({muffle:()=>true});
 const s=play({x:500,y:500});
 assert.equal(s.effects.length,2,'muffled, then sent to the cell');
 assert.equal(s.effects[0].kind,'filter');assert.ok(sendOf(s)===s.effects[1]);
 s.end();assert.equal(s.effects.length,0);
 uninstall();
});
test('ten sounds, one bus each class',async()=>{
 const {play,convolvers,world,uninstall}=await roomRig();
 const spots=[300,500,700,1200,1500,1800,2200,2600,3000,3400];
 for(const x of spots)assert.ok(sendOf(play({x,y:500})),`a send at ${x}`);
 assert.equal(convolvers().length,3,'small, room and hall, shared');
 const before=world.sweeps;play({x:310,y:520});assert.equal(world.sweeps,before,'same square: no second sweep');
 uninstall();
});
