import test from 'node:test';
import assert from 'node:assert/strict';
import {hitSoundsForm,hitSoundsValues,HIT_SOUND_FIELDS} from '../../scripts/ui/hit-sounds-settings.mjs';
import {installSoundPitch} from '../../scripts/engines/sound/sound-pitch.mjs';

const values={surfaceSounds:true,hitSounds:true,surfaceVolume:.8,surfaceGore:'subtle',surfaceEcho:1,surfaceSpace:false};
test('one menu holds the whole hit sounds engine; only the GM sees the world switch',()=>{
 const gm=hitSoundsForm(values,{isGM:true}),player=hitSoundsForm(values);
 assert.match(gm,/name="surfaceSounds" checked/);assert.doesNotMatch(player,/surfaceSounds/);
 for(const f of HIT_SOUND_FIELDS.filter(f=>f.scope==='client'))assert.match(player,new RegExp(`name="${f.key}"`));
 assert.match(player,/<option value="subtle" selected>/);assert.doesNotMatch(player,/name="surfaceSpace" checked/);
});
test('saving: unchecked boxes are off, numbers stay in range, players cannot change the world switch',()=>{
 assert.deepEqual(hitSoundsValues({hitSounds:false,surfaceVolume:'4',surfaceGore:'gory',surfaceEcho:'0.5',surfaceSpace:true,surfaceSounds:false}),
  {hitSounds:false,surfaceVolume:1,surfaceEcho:.5,surfaceSpace:true});
 assert.equal(hitSoundsValues({surfaceSounds:false},{isGM:true}).surfaceSounds,false);
});
test('a player who turns the engine off hears no surface hits and no shaping',()=>{
 const handlers=[];const hooks={on:(n,fn)=>handlers.push(fn),off(){},call:d=>handlers.forEach(fn=>fn(d))};
 class Sound{_createNodes(){}}
 const uninstall=installSoundPitch({hooks,Sound,enabled:()=>false});
 const hit={file:'a.ogg',volume:.6,animaterSurface:'cue',animaterPitch:1.1},swing={file:'b.ogg',volume:.5,animaterAt:{x:0,y:0}};
 hooks.call(hit);hooks.call(swing);
 assert.equal(hit.volume,0);assert.equal(swing.volume,.5);
 uninstall();
});
