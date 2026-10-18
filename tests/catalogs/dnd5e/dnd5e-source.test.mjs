import test from "node:test";
import assert from "node:assert/strict";
import { effectiveActivity, sourceActivities, hasNativeActivation } from "../../../tools/dnd5e-source.mjs";

test("D&D native activity metadata inherits item fields without mutating public source", () => {
  const item={
    type:"spell",
    system:{
      activation:{type:"bonus",value:1},
      range:{units:"ft",value:"30"},
      target:{template:{type:"sphere",size:"20",units:"ft"},affects:{type:"creature"}},
      duration:{units:"minute",value:"1"},
      activities:{native:{
        type:"utility",activation:{type:"action",override:false},
        target:{template:{units:"ft"},prompt:true,override:false},
        range:{units:"self",override:false},duration:{units:"inst",override:false}
      }}
    }
  };
  const before=JSON.stringify(item);
  const [activity]=sourceActivities(item,{effective:true});
  assert.equal(activity.activation.type,"bonus");
  assert.equal(activity.range.units,"ft");
  assert.equal(activity.target.template.type,"sphere");
  assert.equal(activity.target.template.size,"20");
  assert.equal(activity.target.prompt,true);
  assert.equal(activity.duration.units,"minute");
  assert.equal(JSON.stringify(item),before);
});

test("D&D explicit activity override preserves follow-up target and activation", () => {
  const source={system:{activation:{type:"action"},target:{template:{type:"line",size:"100"}}}};
  const followup={_id:"after",type:"save",activation:{type:"",override:true},target:{template:{type:""},affects:{type:"creature",count:"1"},override:true}};
  const effective=effectiveActivity(source,followup);
  assert.equal(effective.activation.type,"");
  assert.equal(effective.target.template.type,"");
  assert.equal(effective.target.affects.count,"1");
});

test("D&D rider activity does not inherit unrelated parent item geometry", () => {
  const source={flags:{dnd5e:{riders:{activity:["rider"]}}},system:{target:{template:{type:"sphere",size:"20"}}}};
  assert.equal(effectiveActivity(source,{_id:"rider",target:{template:{type:""},override:false}}).target.template.type,"");
});

test("D&D damage riders count as activated features while passive metadata stays excluded", () => {
  assert.equal(hasNativeActivation({system:{activities:{rider:{type:"damage",activation:{type:""}}}}}),true);
  assert.equal(hasNativeActivation({system:{activities:{tracking:{type:"utility",activation:{type:""}}}}}),false);
  assert.equal(hasNativeActivation({system:{activation:{type:"bonus"},activities:{native:{type:"utility",activation:{type:"",override:false}}}}}),true);
});
