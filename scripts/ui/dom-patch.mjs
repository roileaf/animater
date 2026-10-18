// Reconcile native nodes instead of replacing the application subtree. Unchanged
// videos keep their decoder/currentTime, inputs keep focus, and scroll hosts stay.
const key = (node) => {
  if (node.nodeType !== 1) return null;
  const d = node.dataset;
  if (d.mediaId) return `media:${d.mediaId}`;
  if (d.mediaFilter) return `media-filter:${d.mediaFilter}`;
  if (d.mediaPreview) return `media-preview:${d.mediaPreview}`;
  if (d.action)
    return `action:${d.action}:${d.id ?? d.key ?? d.page ?? d.index ?? d.mode ?? d.element ?? d.value ?? ""}`;
  if (d.field) return `field:${d.field}:${d.index ?? ""}:${d.track ?? ""}`;
  if (d.builder) return `builder:${d.builder}`;
  if (d.catalogFilter) return `catalog-filter:${d.catalogFilter}`;
  if (d.layerStage !== undefined)
    return `layer:${d.layerStage}:${d.copy ?? ""}`;
  if (d.stageDrag !== undefined) return `stage:${d.stageDrag}`;
  return node.id || node.getAttribute("class")?.split(" ")[0] || null;
};
function release(node) {
  const media =
    node.nodeType === 1
      ? [
          ...node.querySelectorAll("video,audio"),
          ...(node.matches("video,audio") ? [node] : []),
        ]
      : [];
  for (const item of media) {
    item.pause();
    item.removeAttribute("src");
    item.load();
  }
}
function sync(old, next) {
  if (old.nodeType !== 1) {
    if (old.nodeValue !== next.nodeValue) old.nodeValue = next.nodeValue;
    return;
  }
  for (const attr of [...old.attributes])
    if (!next.hasAttribute(attr.name)) old.removeAttribute(attr.name);
  for (const attr of next.attributes)
    if (old.getAttribute(attr.name) !== attr.value)
      old.setAttribute(attr.name, attr.value);
  if (["INPUT", "TEXTAREA", "SELECT"].includes(old.tagName)) {
    // Select values must be applied after syncing their options below.
    if (old.tagName !== "SELECT" && old.value !== next.value)
      old.value = next.value;
    if (old.tagName === "INPUT") old.checked = next.checked;
  }
  children(old, next);
  if (old.tagName === "SELECT" && old.value !== next.value)
    old.value = next.value;
}
export function reconcileChildren(parent, nextParent) {
  let cursor = parent.firstChild;
  const used = new Set();
  for (const next of [...nextParent.childNodes]) {
    const identity = key(next);
    let candidate = cursor;
    if (identity)
      candidate = [...parent.childNodes].find(
        (n) =>
          !used.has(n) &&
          key(n) === identity &&
          n.nodeType === next.nodeType &&
          n.nodeName === next.nodeName,
      );
    const compatible =
      candidate &&
      candidate.nodeType === next.nodeType &&
      candidate.nodeName === next.nodeName &&
      key(candidate) === identity;
    if (compatible) {
      if (candidate !== cursor) parent.insertBefore(candidate, cursor);
      sync(candidate, next);
      used.add(candidate);
      cursor = candidate.nextSibling;
    } else {
      const added = next.cloneNode(true);
      parent.insertBefore(added, cursor);
      used.add(added);
    }
  }
  while (cursor) {
    const removed = cursor;
    cursor = cursor.nextSibling;
    release(removed);
    removed.remove();
  }
}
const children = reconcileChildren;
export function patchDOM(root, html) {
  const template = root.ownerDocument.createElement("template");
  template.innerHTML = html;
  children(root, template.content);
}
