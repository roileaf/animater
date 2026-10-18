import test from 'node:test';
import assert from 'node:assert/strict';
import {spellGroupIdentity,groupSpellRecipes} from '../../../../tools/audit-spell-groups.mjs';
const rows=[
 {key:'jb2a.cast_generic.blue',file:'CastBlue_400x400.webm'},
 {key:'jb2a.cast_generic.purple',file:'CastPurple_400x400.webm'},
 {key:'jb2a.cloud.blue',file:'CloudBlue_400x400.webm'},
 {key:'jb2a.cloud.alias',file:'CloudBlue_400x400.webm'},
 {key:'jb2a.cloud.red',file:'CloudRed_400x400.webm'},
];
const stage=(kind,asset,extra={})=>({kind,assets:asset?[asset]:[],tracks:[],opacity:1,subject:'targets',offsetX:0,offsetY:0,repeats:1,repeatScope:'perTarget',...extra});
const base=()=>({stages:[stage('cast','jb2a.cast_generic.blue',{subject:'source'}),stage('impact','jb2a.cloud.blue')]});
test('different tracked casting seals cannot hide an identical main effect',()=>{
 const a=base(),b=base();
 b.stages[0].assets=['jb2a.cast_generic.purple'];
 b.stages[0].tracks=[{property:'position.x',from:-.5,to:.5}];
 b.stages.push(stage('cast','jb2a.cast_generic.purple',{subject:'source',offsetY:-.5}));
 assert.equal(spellGroupIdentity(a,rows),spellGroupIdentity(b,rows));
});
test('names, rank-size, timing, sound, motion and optional filters do not produce new bodies',()=>{
 const a=base(),b=base();
 b.name='Different spell';b.stages[1].label='Another label';b.stages[1].scale=3;
 b.stages[1].delay=1200;b.stages[1].duration=9000;
 b.stages.push(stage('motion',null,{motion:'pulse'}),stage('sound','some.sound'),stage('tokenfx',null),stage('scenefx',null));
 assert.equal(spellGroupIdentity(a,rows),spellGroupIdentity(b,rows));
});
test('aliases of identical footage compare equal while actual color variants differ',()=>{
 const a=base(),b=base();b.stages[1].assets=['jb2a.cloud.alias'];
 assert.equal(spellGroupIdentity(a,rows),spellGroupIdentity(b,rows));
 b.stages[1].assets=['jb2a.cloud.red'];
 assert.notEqual(spellGroupIdentity(a,rows),spellGroupIdentity(b,rows));
});
test('native cone versus circle changes body geometry; area radius alone does not',()=>{
 const a=base(),b=base();a.stages[1].kind=b.stages[1].kind='template';
 a.previewArea={type:'circle',value:15};b.previewArea={type:'circle',value:30};
 assert.equal(spellGroupIdentity(a,rows),spellGroupIdentity(b,rows));
 b.previewArea.type='cone';
 assert.notEqual(spellGroupIdentity(a,rows),spellGroupIdentity(b,rows));
});
test('target routing and total-versus-per-target volleys remain visible differences',()=>{
 const a=base(),b=base();b.stages[1].subject='source';
 assert.notEqual(spellGroupIdentity(a,rows),spellGroupIdentity(b,rows));
 b.stages[1].subject='targets';b.stages[1].repeatScope='total';
 assert.notEqual(spellGroupIdentity(a,rows),spellGroupIdentity(b,rows));
 b.stages[1].repeatScope='perTarget';b.stages[1].targetSelection='chain';
 assert.notEqual(spellGroupIdentity(a,rows),spellGroupIdentity(b,rows));
});
test('cross-theme edition collisions are counted separately from same-theme siblings',()=>{
 const spells=[{id:'one',name:'One',theme:'healing',design:{motif:'a'}},{id:'two',name:'Two',theme:'water',design:{motif:'b'}}];
 const result=groupSpellRecipes(spells,()=>base(),{free:rows});
 assert.equal(result.free.affectedSpells,2);
 assert.equal(result.free.themes.healing.sameThemeSpells,0);
 assert.equal(result.free.themes.healing.repeatedAcrossCatalog,1);
 assert.equal(result.free.missing.length,0);
});
test('audit reports missing selected footage rather than treating it as a valid substitute',()=>{
 const spells=[{id:'one',name:'One',theme:'water',design:{motif:'a'}}];
 const result=groupSpellRecipes(spells,()=>({stages:[stage('impact','jb2a.absent',{stageId:'payload'})]}),{free:rows});
 assert.equal(result.free.missing.length,1);
 assert.equal(result.free.missing[0].stage,'payload');
});
