// Read-only: finds the sprite that throws "Cannot read properties of null (reading 'uvsFloat32')" every frame.
//
// That error is PIXI's Sprite.calculateVertices reaching into a texture whose _uvs is gone: the sprite is still
// parented and visible, but the texture under it was destroyed. Nothing on screen says which sprite it is, so this
// walks the canvas and names it — its class, its texture's state, and the chain of parents up to the root, which is
// what tells us whose engine left it behind.
//
// Paste in the browser console on the scene that crashes:
//   (await import("/modules/animater/tools/dead-texture-probe.mjs")).deadTextureProbe()
//
// Changes nothing. Walks the display tree and reads fields.

const nameOf = (node) => {
  if (!node) return "?";
  const own = node.name || node.animaterKey || "";
  const cls = node.constructor?.name ?? "Object";
  const layer = Number.isFinite(node.sortLayer) ? `@${node.sortLayer}` : "";
  return `${cls}${own ? `("${own}")` : ""}${layer}`;
};

// Up from a sprite to the stage, so a nameless sprite is still placed by the container it sits in.
const chainOf = (node) => {
  const out = [];
  for (let n = node; n; n = n.parent) out.push(nameOf(n));
  return out.reverse().join(" > ");
};

// What is wrong with one texture, or null when nothing is.
// A null texture is not the fault we are hunting: PIXI Graphics, PointSourceMesh and Foundry's own meshes carry a
// null `texture` field by design and draw fine. Only a texture that EXISTS and is dead throws in calculateVertices.
const faultOf = (tex) => {
  if (!tex) return null;
  if (tex.destroyed) return "texture.destroyed";
  if (!tex._uvs) return "texture._uvs is null (destroyed, or never updated)";
  const base = tex.baseTexture;
  if (!base) return "no baseTexture";
  if (base.destroyed) return "baseTexture.destroyed";
  if (!base.valid) return "baseTexture not valid";
  return null;
};

// Every node under a root, with a cap so a runaway tree cannot hang the tab.
const walk = (root, seen, max) => {
  const out = [];
  const stack = [root];
  while (stack.length && out.length < max) {
    const n = stack.pop();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    for (const c of n.children ?? []) stack.push(c);
    // A mask sprite is rendered too, and is not a child of anything.
    const m = n.mask?.maskObject ?? n.mask;
    if (m && typeof m === "object") stack.push(m);
    if (n.filters?.length) for (const f of n.filters) { const t = f?.maskSprite ?? f?.sprite; if (t) stack.push(t); }
  }
  return out;
};

/**
 * Reports every sprite-like node whose texture cannot be drawn, worst first (the ones actually being rendered).
 * Returns a plain object; also console.table's the hits so a screenshot carries them.
 */
export function deadTextureProbe({ max = 40000 } = {}) {
  const roots = [];
  const push = (label, node) => { if (node) roots.push({ label, node }); };
  push("primary", globalThis.canvas?.primary);
  push("interface", globalThis.canvas?.interface);
  push("effects", globalThis.canvas?.effects);
  push("stage", globalThis.canvas?.stage);

  const seen = new Set();
  const hits = [];
  let looked = 0;
  for (const { label, node } of roots) {
    for (const n of walk(node, seen, max)) {
      looked++;
      // Only things that will reach calculateVertices: they own a texture and are not plain containers.
      if (!("texture" in n)) continue;
      const fault = faultOf(n.texture);
      if (!fault) continue;
      // PIXI.Texture.EMPTY is a legitimate placeholder and has no uvs problem, but guard anyway.
      if (n.texture === globalThis.PIXI?.Texture?.EMPTY) continue;
      // Would it actually be drawn this frame? An invisible or detached sprite never throws.
      let drawn = n.visible !== false && n.renderable !== false && (n.worldAlpha ?? 1) > 0;
      for (let p = n.parent; p && drawn; p = p.parent) if (p.visible === false || p.renderable === false) drawn = false;
      hits.push({ root: label, drawn, fault, what: nameOf(n), where: chainOf(n) });
    }
  }
  hits.sort((a, b) => Number(b.drawn) - Number(a.drawn));

  const report = { looked, hits: hits.length, drawn: hits.filter((h) => h.drawn).length, list: hits };
  try { console.table(hits.map(({ root, drawn, fault, what }) => ({ root, drawn, fault, what }))); } catch { /* no table */ }
  for (const h of hits.filter((x) => x.drawn)) console.warn("DRAWN WITH A DEAD TEXTURE:", h.where, "--", h.fault);
  if (!hits.length) console.info("No dead textures in the display tree right now. If it still throws, run this again at the moment it fires.");
  return report;
}

export default deadTextureProbe;
