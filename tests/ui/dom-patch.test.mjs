import test from "node:test";
import assert from "node:assert/strict";
import { reconcileChildren } from "../../scripts/ui/dom-patch.mjs";

// Minimal DOM contract, no test-only browser dependency. Exercises node reuse,
// repeated sibling keys and media disposal in the production reconciler.
class Node {
  constructor(tag, attrs = {}, childNodes = []) {
    this.nodeType = 1;
    this.nodeName = this.tagName = tag.toUpperCase();
    this.attrs = new Map(Object.entries(attrs));
    this.childNodes = [];
    this.value = attrs.value ?? "";
    this.checked = false;
    this.pauses = 0;
    this.loads = 0;
    childNodes.forEach((n) => this.insertBefore(n, null));
  }
  get attributes() {
    return [...this.attrs].map(([name, value]) => ({ name, value }));
  }
  get dataset() {
    return Object.fromEntries(
      [...this.attrs]
        .filter(([k]) => k.startsWith("data-"))
        .map(([k, v]) => [
          k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
          v,
        ]),
    );
  }
  get id() {
    return this.attrs.get("id");
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get nextSibling() {
    return (
      this.parentNode?.childNodes[
        this.parentNode.childNodes.indexOf(this) + 1
      ] ?? null
    );
  }
  getAttribute(k) {
    return this.attrs.get(k) ?? null;
  }
  hasAttribute(k) {
    return this.attrs.has(k);
  }
  setAttribute(k, v) {
    this.attrs.set(k, v);
  }
  removeAttribute(k) {
    this.attrs.delete(k);
  }
  insertBefore(n, before) {
    n.remove();
    const i = before ? this.childNodes.indexOf(before) : this.childNodes.length;
    this.childNodes.splice(i, 0, n);
    n.parentNode = this;
  }
  remove() {
    if (this.parentNode) {
      this.parentNode.childNodes.splice(
        this.parentNode.childNodes.indexOf(this),
        1,
      );
      this.parentNode = null;
    }
  }
  cloneNode(deep) {
    return new Node(
      this.tagName,
      Object.fromEntries(this.attrs),
      deep ? this.childNodes.map((n) => n.cloneNode(true)) : [],
    );
  }
  matches(selector) {
    return selector.split(",").includes(this.tagName.toLowerCase());
  }
  querySelectorAll(selector) {
    return this.childNodes.flatMap((n) => [
      ...(n.matches(selector) ? [n] : []),
      ...n.querySelectorAll(selector),
    ]);
  }
  pause() {
    this.pauses++;
  }
  load() {
    this.loads++;
  }
}
test("patch retains playing video and scroll hosts while updating field values", () => {
  const video = new Node("video", { src: "spell.webm" });
  video.currentTime = 2.75;
  const input = new Node("input", { "data-field": "duration", value: "650" });
  const inspector = new Node("aside", { class: "an-inspector" }, [
    video,
    input,
  ]);
  inspector.scrollTop = 850;
  const root = new Node("div", {}, [inspector]);
  const next = new Node("div", {}, [
    new Node("aside", { class: "an-inspector" }, [
      new Node("video", { src: "spell.webm" }),
      new Node("input", { "data-field": "duration", value: "900" }),
    ]),
  ]);
  reconcileChildren(root, next);
  assert.equal(root.firstChild, inspector);
  assert.equal(inspector.scrollTop, 850);
  assert.equal(inspector.firstChild, video);
  assert.equal(video.currentTime, 2.75);
  assert.equal(video.pauses, 0);
  assert.equal(input.value, "900");
});
test("repeated sibling keys remain distinct and removed media is released", () => {
  const a = new Node("label", { class: "an-check" }, [
    new Node("input", { "data-field": "enabled" }),
  ]);
  const b = new Node("label", { class: "an-check" }, [
    new Node("input", { "data-field": "below" }),
  ]);
  const video = new Node("video", { src: "old.webm" });
  const root = new Node("div", {}, [a, b, video]);
  const next = new Node("div", {}, [a.cloneNode(true), b.cloneNode(true)]);
  reconcileChildren(root, next);
  assert.deepEqual(root.childNodes, [a, b]);
  assert.equal(a.firstChild.dataset.field, "enabled");
  assert.equal(b.firstChild.dataset.field, "below");
  assert.equal(video.pauses, 1);
  assert.equal(video.loads, 1);
  assert.equal(video.getAttribute("src"), null);
});
test('filtered and reordered media families keep their own thumbnails and playback',()=>{
  const card=id=>new Node('article',{'data-media-id':id,class:'an-media-card'},[new Node('video',{src:`${id}.webm`})]);
  const a=card('a'),b=card('b'),c=card('c');
  b.firstChild.currentTime=3.25;c.firstChild.currentTime=1.5;
  const root=new Node('div',{},[a,b,c]);root.scrollTop=120;
  reconcileChildren(root,new Node('div',{},[card('c'),card('b')]));
  assert.deepEqual(root.childNodes,[c,b]);assert.equal(root.scrollTop,120);
  assert.equal(b.firstChild.currentTime,3.25);assert.equal(c.firstChild.currentTime,1.5);
  assert.equal(b.firstChild.loads,0);assert.equal(c.firstChild.pauses,0);
  assert.equal(a.firstChild.pauses,1);
});
