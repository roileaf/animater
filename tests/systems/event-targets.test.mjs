import test from 'node:test';
import assert from 'node:assert/strict';
import {eventTargets} from '../../scripts/systems/adapters.mjs';

const a={id:'a',document:{id:'a'}},b={id:'b',document:{id:'b'}},c={id:'c',document:{id:'c'}};
test("a spell's damage plays on every creature the roller targets, not only the first PF2e records",()=>{
 const arc={type:'damage',item:{type:'spell'}};
 assert.deepEqual(eventTargets(arc,a,[a,b]),[a,b],'Electric Arc: both enemies, in targeting order');
 assert.deepEqual(eventTargets(arc,a,[a]),[a]);
 // The roller has since moved on to other creatures: the recorded one stands.
 assert.deepEqual(eventTargets(arc,a,[b,c]),[a]);
});
test("a weapon's damage stays on the one creature its Strike hit",()=>{
 assert.deepEqual(eventTargets({type:'damage',item:{type:'weapon'}},a,[a,b]),[a]);
 assert.deepEqual(eventTargets({type:'attack',item:{type:'spell'}},a,[a,b]),[a],'a spell attack roll is against one target');
 assert.deepEqual(eventTargets({type:'damage',item:{type:'spell'}},null,[a,b]),[]);
});
