import { test } from "node:test";
import assert from "node:assert/strict";
import { selectExcludedAreaAt, waterProposalFromLoops } from "../../../scripts/engines/regions/water-detect.mjs";

const box = (x,y,w,h,hole=false) => ({points:[x,y,x+w,y,x+w,y+h,x,y+h],hole});
function image(water, patches, width=12, height=12) {
  const rgba = new Uint8Array(width*height*4);
  for(let p=0;p<width*height;p++) rgba.set([...water,255],p*4);
  for(const [pixels,color] of patches) for(const p of pixels) rgba.set([...color,255],p*4);
  return rgba;
}
const all = waterProposalFromLoops([box(0,0,12,12)],12,12).pixels;
const pick = (rgba,x,y,options={}) => selectExcludedAreaAt(rgba,12,12,{x,y},{targetPixels:all,...options});

test("exact seed keeps single pixels, thin pieces and disconnected surfaces separate",()=>{
  for(const color of [[80,100,50],[90,65,40],[80,80,80]]) {
    for(const pixels of [[26],[26,27,28],[26,38,50]]) {
      const rgba=image([144,180,90],[[pixels,color],[[100],color]]);
      const result=pick(rgba,2,2);
      assert.equal(result.status,"found");
      assert.deepEqual([...result.proposal.pixels].sort((a,b)=>a-b),pixels);
      assert.equal(result.proposal.loops.length,1);
      assert.equal(result.proposal.loops[0].hole,false);
    }
  }
});

test("hue plus saturation and brightness separates surfaces hue alone accepts",()=>{
  for(const [dock,water] of [
    [[80,100,50],[144,180,90]],
    [[90,100,75],[45,100,0]],
  ]) {
    const rgba=image(water,[[[26,27],dock]]);
    for(const broad of [false,true]) assert.deepEqual([...pick(rgba,2,2,{broad}).proposal.pixels],[26,27]);
  }
});

test("Wide follows more connected shades while keeping disconnected color out",()=>{
  const rgba=image([180,210,160],[[[26],[80,100,50]],[[27],[110,140,70]],[[100],[110,140,70]]]);
  assert.deepEqual([...pick(rgba,2,2).proposal.pixels],[26]);
  assert.deepEqual([...pick(rgba,2,2,{broad:true}).proposal.pixels],[26,27]);
});

test("exclusion stays inside ownership, rejects holes and outside clicks without nearest fallback",()=>{
  const rgba=image([80,80,80],[]);
  const targetPixels=waterProposalFromLoops([box(2,2,6,6),box(4,4,2,2,true)],12,12).pixels;
  assert.equal(pick(rgba,4,4,{targetPixels}).reason,"outside-target");
  assert.equal(pick(rgba,1,2,{targetPixels}).reason,"outside-target");
  assert.equal(pick(rgba,-1,2,{targetPixels}).reason,"outside-target");
  assert.deepEqual(pick(rgba,2,2,{targetPixels}).proposal.pixels,targetPixels);
  rgba[26*4+3]=0;
  assert.equal(pick(rgba,2,2,{targetPixels}).reason,"no-colour");
});

test("diagonal contacts refuse safely without filling extra excluded pixels",()=>{
  const pixels=[26,27,38,40,50,51,52];
  const rgba=image([180,210,160],[[pixels,[80,80,80]]]);
  const result=pick(rgba,2,2);
  assert.equal(result.status,"none");
  assert.equal(result.reason,"invalid-exclusion");
});

test("hue and neutral color limits exclude distinct connected surfaces",()=>{
  const cases=[
    [[40,100,40],[40,40,100],false,false],
    [[80,80,80],[110,110,110],false,false],
    [[80,80,80],[110,110,110],true,true],
    [[90,100,90],[95,95,95],false,false],
    [[90,100,90],[95,95,95],true,false],
  ];
  for(const [seed,neighbor,broad,includes] of cases) {
    const rgba=image([220,220,220],[[[26],seed],[[27],neighbor]]);
    assert.equal(pick(rgba,2,2,{broad}).proposal.pixels.includes(27),includes);
    rgba[27*4+3]=0;
    assert.equal(pick(rgba,2,2,{broad}).proposal.pixels.includes(27),false);
  }
});

test("selection coverage includes fractional boundary cells but leaves full hole cells clear",async()=>{
  const {waterSelectionPixels}=await import("../../../scripts/engines/regions/water-detect.mjs");
  const pixels=waterSelectionPixels([box(.25,.25,9,9),box(3,3,2,2,true)],12,12);
  assert.equal(pixels.length,96);
  assert.ok(pixels.includes(9*12+9));
  assert.equal(pixels.includes(3*12+3),false);
  const triangle=[{points:[.25,.25,2.25,.25,.25,2.25],hole:false}];
  assert.deepEqual([...waterSelectionPixels(triangle,4,4)],[0,1,2,4,5,8]);
});
