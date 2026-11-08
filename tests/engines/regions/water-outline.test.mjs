import { test } from "node:test";
import assert from "node:assert/strict";
import { changeVertex, validateOutline, smoothOutline, outlinePoint, hitOutline, unionOutlines, subtractOutlines } from "../../../scripts/engines/regions/water-outline.mjs";
import { waterProposalFromLoops } from "../../../scripts/engines/regions/water-detect.mjs";
const ring = (points, hole = false) => ({ points, hole });
const box = (x, y, w, h, hole = false) => ring([x,y,x+w,y,x+w,y+h,x,y+h], hole);

test("continuous outline coordinates include map edges at any zoom and hits use CSS pixels", () => {
  for (const zoom of [0.5, 1, 4]) {
    const rect = { left: 30, top: 20, width: 100 * zoom, height: 50 * zoom };
    assert.deepEqual(outlinePoint({ clientX: 30 + rect.width, clientY: 20 + rect.height }, rect, 100, 50), { x: 100, y: 50 });
    assert.deepEqual(hitOutline([box(0,0,100,50)], { clientX: 35, clientY: 20 }, rect, 100, 50), { ring: 0, vertex: 0 });
    assert.equal(hitOutline([box(0,0,100,50)], { clientX: 38, clientY: 28 }, rect, 100, 50), null);
  }
});

test("move, insert and delete keep source immutable and refresh the mask from exact loops", () => {
  const original = [box(0,0,10,10)];
  const moved = changeVertex(original, { ring: 0, vertex: 1, x: 6.25, y: 0 });
  assert.equal(validateOutline(original, moved, 10, 10), "");
  assert.deepEqual(original, [box(0,0,10,10)]);
  assert.equal(moved[0].points[2], 6.25);
  assert.ok(waterProposalFromLoops(moved, 10, 10).pixels.length < 100);
  const inserted = changeVertex(moved, { ring: 0, vertex: 0, action: "insert", x: 3, y: 0 });
  assert.equal(validateOutline(moved, inserted, 10, 10), "");
  assert.deepEqual(changeVertex(inserted, { ring: 0, vertex: 1, action: "delete" }), moved);
});

test("invalid topology and bounds are rejected atomically, including cross-ring contacts and nesting", () => {
  const before = [box(0,0,20,20), box(5,5,3,3,true), box(30,0,10,10)];
  const frozen = structuredClone(before);
  for (const points of [[0,0,20,20,20,0,0,20], [0,0,NaN,0,20,20], [0,0,21,0,20,20], [0,0,0,20,20,20,20,0], [0,0,0,0,0,0]]) {
    assert.ok(validateOutline(before, [ring(points), ...before.slice(1)], 40, 20));
  }
  assert.match(validateOutline(before, [before[0], box(19,5,3,3,true), before[2]], 40,20), /cross|touch|inside/);
  assert.match(validateOutline(before, [before[0], box(25,12,3,3,true), before[2]], 40,20), /inside/);
  assert.ok(validateOutline(before, [box(0,0,39,20), ...before.slice(1)], 40,20));
  assert.deepEqual(before, frozen);
  const triangle = [ring([0,0,10,0,5,10])];
  assert.match(validateOutline(triangle, changeVertex(triangle, { ring: 0, vertex: 1, action: "delete" }), 10,10), /three/);
  const outside = [box(-5,0,10,10), box(20,0,10,10)];
  assert.equal(validateOutline(outside, [outside[0], box(21,0,9,10)], 30,10), "");
});

function distanceToRing(x, y, p) {
  let best = Infinity;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length, dx = p[j]-p[i], dy = p[j+1]-p[i+1];
    const t = Math.max(0,Math.min(1,((x-p[i])*dx+(y-p[i+1])*dy)/(dx*dx+dy*dy)));
    best = Math.min(best, Math.hypot(x-p[i]-t*dx,y-p[i+1]-t*dy));
  }
  return best;
}

test("explicit smoothing reduces a staircase and stays within two pixels in both directions, preserving holes", () => {
  const points = [0,0,40,0,40,40];
  for (let i = 39; i >= 0; i--) points.push(i+1,i,i,i);
  points.splice(-2);
  const before = [ring(points), box(25,5,3,3,true)];
  const after = smoothOutline(before);
  assert.equal(validateOutline(before,after,40,40), "");
  assert.ok(after[0].points.length < points.length / 2);
  assert.strictEqual(after[1],before[1]);
  for (const [a,b] of [[points,after[0].points],[after[0].points,points]]) {
    for (let i=0;i<a.length;i+=2) for (let step=0;step<=20;step++) {
      const j=(i+2)%a.length,t=step/20;
      assert.ok(distanceToRing(a[i]*(1-t)+a[j]*t,a[i+1]*(1-t)+a[j+1]*t,b)<=2+1e-8);
    }
  }
});

test("polygon union preserves fractional edited edges while adding water, holes, and disconnected shores", () => {
  const left = [box(0.25,0,5,10), box(1,3,1,1,true)];
  const right = [box(4,0,5,10), box(12,0,2,2)];
  const loops = unionOutlines(left,right);
  assert.equal(loops.filter((l)=>!l.hole).length,2);
  assert.equal(loops.filter((l)=>l.hole).length,1);
  assert.ok(loops[0].points.includes(0.25));
  const result = waterProposalFromLoops(loops,20,10);
  assert.equal(result.pixels.length,93);
  assert.equal(result.pixels.includes(3*20+1),false);
  assert.deepEqual(unionOutlines(left,left), [box(0.25,0,5,10), ring([1,4,2,4,2,3,1,3],true)]);
});

test("union masks match both inputs for intersecting synthetic polygons and filled holes", () => {
  const inputs = [
    [[box(1.25,1,8,8)], [ring([4,0,13,8,4,13])]],
    [[box(0,0,10,10),box(3,3,4,4,true)], [box(4,4,4,4)]],
    [[box(0,0,4,4)], [box(4,0,4,4)]],
    [[box(0,0,10,10)], [box(2,2,3,3)]],
    [[box(2,2,3,3)], [box(0,0,10,10)]],
  ];
  for (const [left,right] of inputs) {
    const expected = new Set([...waterProposalFromLoops(left,20,20).pixels,...waterProposalFromLoops(right,20,20).pixels]);
    const actual = new Set(waterProposalFromLoops(unionOutlines(left,right),20,20).pixels);
    assert.deepEqual(actual,expected);
  }
  assert.throws(()=>unionOutlines([box(0,0,4,4)],[box(4,4,4,4)]),/touch/);
});

test("crowded handles pick the nearest vertex, and edge insertions stay within map bounds", () => {
  const loops = [ring([0,0,5,0,10,0,20,0,20,20,0,20])];
  for (const zoom of [0.5, 1, 4]) {
    const rect = {left:0,top:0,width:100*zoom,height:100*zoom};
    for (const vertex of [1,2]) assert.deepEqual(hitOutline(loops,{clientX:vertex*5*zoom,clientY:0},rect,100,100),{ring:0,vertex});
  }
  const rect = {left:0,top:0,width:443.1,height:1024*0.4431};
  const before = [box(0,0,1000,1024)];
  const hit = hitOutline(before,{clientX:rect.width,clientY:rect.height*0.37},rect,1000,1024);
  assert.ok(hit.x <= 1000 && Math.abs(hit.x - 1000) < 1e-8);
  assert.equal(validateOutline(before,changeVertex(before,{...hit,vertex:hit.edge,action:"insert"}),1000,1024),"");
});

test("existing off-map shores can be repaired one vertex at a time", () => {
  const before = [box(-5,0,15,10)];
  for (const edit of [{vertex:1,x:9,y:0},{vertex:0,x:0,y:0}]) {
    assert.equal(validateOutline(before,changeVertex(before,{ring:0,...edit}),20,20),"");
  }
  assert.match(validateOutline(before,changeVertex(before,{ring:0,vertex:1,x:21,y:0}),20,20),/inside/);
});

test("tiny disconnected pieces do not prevent smoothing the larger shore", () => {
  for (const tiny of [box(22,5,1,1),box(22,5,1,20)]) {
    const before = [box(0,0,20,20),tiny];
    const after = smoothOutline(before);
    assert.strictEqual(after[1],tiny);
    assert.notDeepEqual(after[0],before[0]);
    assert.equal(validateOutline(before,after,40,40),"");
  }
});

test("difference creates holes, notches, split shores, enlarged holes and water islands", () => {
  const shore = [box(0.25,0.25,9,9)];
  const cases = [
    [shore, [box(3,3,2,2)], 77, 1, 1],
    [shore, [box(0,3,3,2)], 75, 1, 0],
    [shore, [box(4,0,1,10)], 72, 2, 0],
    [[...shore,box(3,3,2,2,true)], [box(4,3,2,2)], 75, 1, 1],
    [[...shore,box(3,3,2,2,true)], [box(3.5,3.5,1,1)], 77, 1, 1],
    [shore, [box(2,2,5,5),box(3,3,2,2,true)], 60, 2, 1],
  ];
  for (const [left,right,count,outer,holes] of cases) {
    const before = structuredClone(left);
    const loops = subtractOutlines(left,right);
    assert.equal(waterProposalFromLoops(loops,10,10).pixels.length,count);
    assert.equal(loops.filter(l=>!l.hole).length,outer);
    assert.equal(loops.filter(l=>l.hole).length,holes);
    assert.ok(loops.some(l=>l.points.includes(0.25) && l.points.includes(9.25)));
    assert.deepEqual(left,before);
    assert.deepEqual(subtractOutlines(loops,right),loops);
  }
  assert.deepEqual(subtractOutlines(shore,[box(0,0,10,10)]),[]);
  assert.throws(()=>subtractOutlines(shore,[box(0.25,0.25,2,2),box(2.25,2.25,2,2)]),/touch|invalid/);
});
