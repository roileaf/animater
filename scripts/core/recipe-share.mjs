// Recipe sharing: a share code is one line a GM can paste in chat or Discord, and a macro body
// imports the same recipes in another world. Pure: no Foundry calls except the injected clipboard.
export const SHARE_PREFIX = "animater-recipe:1:";
const BAD = "That share code is broken or incomplete. Copy it again.";

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(code) {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
const exportData = (recipes) => ({ schema: 1, recipes: [...(recipes ?? [])] });

export const encodeShareCode = (recipes) => SHARE_PREFIX + toBase64Url(JSON.stringify(exportData(recipes)));
export const hasShareCode = (text) => typeof text === "string" && text.includes(SHARE_PREFIX);
// Every code in a paste, in order. A chat client may wrap a long code over several lines: whitespace
// inside a code is dropped, and each code is the longest run of pieces that decodes (words typed after
// it, like "and also", are not part of it).
function decodeOne(chunk) {
  const pieces = (chunk.match(/^[A-Za-z0-9_\-+/=\s]*/)?.[0] ?? "").split(/\s+/).filter(Boolean);
  for (let n = pieces.length; n > 0; n--) {
    let data;
    try { data = JSON.parse(fromBase64Url(pieces.slice(0, n).join(""))); } catch { continue; }
    if (data?.schema === 1 && Array.isArray(data.recipes)) return data;
  }
  throw Error(BAD);
}
export const decodeShareCodes = (text) => String(text ?? "").split(SHARE_PREFIX).slice(1).map(decodeOne);
// The recipes of several codes as one export; a later code wins an id an earlier one also holds.
export function combineShareCodes(text) {
  const byId = new Map();
  for (const data of decodeShareCodes(text)) for (const r of data.recipes) { byId.delete(r?.id); byId.set(r?.id, r); }
  return exportData(byId.values());
}
// A script macro body: run it in any world with Animater to import the recipes (GM only).
export const shareMacro = (recipes) =>
  `// Animater: import ${(recipes ?? []).length === 1 ? `"${String(recipes[0]?.name ?? "").replace(/[\r\n]/g, " ")}"` : `${(recipes ?? []).length} recipes`}\n` +
  `await game.modules.get("animater").api.importRecipes(${JSON.stringify(exportData(recipes))});\n`;

// Import merges by id: an imported recipe replaces the one with its id, new ones go last.
export function mergeImported(existing, incoming) {
  const old = existing ?? [], replacements = new Map((incoming ?? []).map((r) => [r.id, r]));
  const oldIds = new Set(old.map((r) => r.id));
  const recipes = old.map((r) => replacements.get(r.id) ?? r).concat((incoming ?? []).filter((r) => !oldIds.has(r.id)));
  if (recipes.length > 200) throw Error("Maximum 200 recipes.");
  const replaced = (incoming ?? []).filter((r) => oldIds.has(r.id)).length;
  return { recipes, added: (incoming ?? []).length - replaced, replaced };
}

// Foundry's clipboard helper, else the browser's.
export async function copyPlainText(text, env = globalThis) {
  if (typeof env.game?.clipboard?.copyPlainText === "function") return env.game.clipboard.copyPlainText(text);
  if (typeof env.navigator?.clipboard?.writeText === "function") return env.navigator.clipboard.writeText(text);
  throw Error("This browser does not allow copying to the clipboard here.");
}
