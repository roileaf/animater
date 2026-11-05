import test from 'node:test';
import assert from 'node:assert/strict';
import { bloodDropsNow,auraCalm,stepCalm,isAuraLook} from '../../../scripts/engines/playback/outside-combat.mjs';

const fight={started:true},none=null,waiting={started:false};
test('auras follow the outside-combat choice until combat starts',()=>{
 assert.equal(auraCalm('hidden',none),'hidden');
 assert.equal(auraCalm('subtle',waiting),'subtle','an encounter not yet started is still outside combat');
 assert.equal(auraCalm('hidden',fight),'show');
 assert.equal(auraCalm(undefined,none),'show');
 assert.equal(auraCalm('nonsense',none),'show');
});
test('footsteps go quieter and closer, or silent, outside combat only',()=>{
 assert.deepEqual(stepCalm('quieter',none),{gain:.5,range:'close'});
 assert.deepEqual(stepCalm('off',none),{gain:0,range:null});
 assert.deepEqual(stepCalm('normal',none),{gain:1,range:null});
 assert.deepEqual(stepCalm('off',fight),{gain:1,range:null});
});
test('an aura look is the emitter\'s ring, not an ally\'s token-sized copy',()=>{
 const ring={stages:[{kind:'aura',persist:true,auraRadius:30}]},plain={stages:[{kind:'aura',persist:true}]};
 assert.equal(isAuraLook({animaterAura:{slug:'x'}},plain),true);
 assert.equal(isAuraLook({},ring),true);
 assert.equal(isAuraLook({},ring,{granted:true}),false);
 assert.equal(isAuraLook({},plain),false);
});

test("the wounded drip as the GM chose: always, only in combat, or never", () => {
  const fight = { started: true }, waiting = { started: false };
  for (const combat of [fight, waiting, null]) assert.equal(bloodDropsNow("always", combat), true);
  for (const combat of [fight, waiting, null]) assert.equal(bloodDropsNow("never", combat), false);
  assert.equal(bloodDropsNow("combat", fight), true);
  assert.equal(bloodDropsNow("combat", waiting), false, "an encounter not yet begun is not combat");
  assert.equal(bloodDropsNow("combat", null), false);
  assert.equal(bloodDropsNow(undefined, null), true, "an unset choice drips as before");
});
