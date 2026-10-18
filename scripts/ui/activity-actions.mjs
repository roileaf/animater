// Activity page actions: what a log entry remembers so it can be acted on later,
// the live "Now playing" list, and the catalog/recipe stores Exclude writes to.

// An origin is a built-in catalog entry ({type:"catalog", system?, kind, id}) or a saved
// recipe ({type:"recipe", id}). Anything else (older entries, bad data) is no origin.
export function cleanOrigin(origin) {
  if (!origin || typeof origin !== "object" || !origin.id) return null;
  if (origin.type === "recipe") return { type: "recipe", id: String(origin.id) };
  if (origin.type === "catalog" && origin.kind)
    return { type: "catalog", ...(origin.system ? { system: String(origin.system) } : {}), kind: String(origin.kind), id: String(origin.id) };
  return null;
}
export const originKey = (origin) => {
  const o = cleanOrigin(origin);
  return !o ? "" : o.type === "recipe" ? `recipe:${o.id}` : `catalog:${o.system ?? ""}:${o.kind}:${o.id}`;
};
// The few fields a log entry keeps: recipe id, origin, what is still running, preview/automatic.
export function activityEntryMeta(recipe, meta) {
  const out = {};
  if (recipe?.id) out.recipeId = String(recipe.id);
  const origin = cleanOrigin(meta?.origin);
  if (origin) out.origin = origin;
  if (meta?.session) out.session = String(meta.session);
  if (meta?.key) out.key = String(meta.key);
  if (meta?.preview) out.preview = true;
  if (meta?.automatic) out.automatic = true;
  return out;
}
// Running runtime sessions and lasting condition/effect layers, newest first.
export function nowPlayingRows(sessions = [], states = []) {
  const rows = [
    ...(sessions ?? []).filter((s) => s?.session).map((s) => ({ ...s, id: `session:${s.session}`, kind: "session" })),
    ...(states ?? []).filter((s) => s?.key).map((s) => ({ ...s, id: `state:${s.key}`, kind: "state" })),
  ];
  return rows.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
}
export function elapsedLabel(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000)), pad = (n) => String(n).padStart(2, "0");
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${pad(Math.floor(s / 60) % 60)}m`;
}
// The catalog settings an origin's exclusion list lives in, through the host's own setters
// (the same ones the catalog pages' Exclude buttons use).
export function catalogStoreFor(host, origin, abilityProfile) {
  const o = cleanOrigin(origin);
  if (o?.type !== "catalog") return null;
  const { kind } = o;
  if (o.system === "sf2e" && host.setSfCatalogState) return { get: () => host.sfCatalogState(kind), set: (c) => host.setSfCatalogState(kind, c) };
  if (o.system === "dnd5e" && host.setDndCatalogState) return { get: () => host.dndCatalogState(kind), set: (c) => host.setDndCatalogState(kind, c) };
  if (o.system === "daggerheart" && host.setDhCatalogState) return { get: () => host.dhCatalogState(kind), set: (c) => host.setDhCatalogState(kind, c) };
  if (o.system && o.system !== "pf2e") return null;
  if (kind === "spell") return { get: () => host.catalogState(), set: (c) => host.setCatalogState(c) };
  if (kind === "weapon") return { get: () => host.weaponCatalogState(), set: (c) => host.setWeaponCatalogState(c) };
  if (["condition", "effect"].includes(kind)) return { get: () => host.stateCatalogState(kind), set: (c) => host.setStateCatalogState(kind, c) };
  const profile = abilityProfile?.(kind);
  if (profile && host[profile.setStateKey]) return { get: () => host[profile.stateKey](), set: (c) => host[profile.setStateKey](c) };
  return null;
}
// Excludes (or, with on=false, includes again) an origin. Returns false when nothing changed.
export async function setOriginExcluded(host, origin, excluded, { abilityProfile, drafts } = {}) {
  const o = cleanOrigin(origin);
  if (!o) throw Error("This animation has no catalog entry or recipe to exclude.");
  if (o.type === "recipe") {
    const saved = host.recipes?.() ?? [], found = saved.find((r) => r.id === o.id);
    if (!found) throw Error("That recipe is no longer saved.");
    // Saved right away, as a catalog exclusion is; an open draft follows so a later Save keeps it.
    await host.save(saved.map((r) => (r.id === o.id ? { ...r, enabled: !excluded } : r)));
    const draft = drafts?.get?.(o.id);
    if (draft) draft.enabled = !excluded;
    return true;
  }
  const store = catalogStoreFor(host, o, abilityProfile);
  if (!store) throw Error("This catalog cannot be changed here.");
  const list = store.get()?.excluded ?? [];
  if (excluded === list.includes(o.id)) return false;
  await store.set({ excluded: excluded ? [...list, o.id] : list.filter((id) => id !== o.id) });
  return true;
}

// What a Now playing row previews: the first stage that shows footage (its asset key), the item
// icon, and the token portrait. All plain strings, so a row stays small.
const VISUAL_KINDS = new Set(["impact", "aura", "attach", "sprite"]);
export const mainVisual = (plan) => String((plan ?? []).find((s) => VISUAL_KINDS.has(s?.kind) && s.asset)?.asset ?? "");
export const portraitOf = (token) => String(token?.document?.texture?.src ?? token?.texture?.src ?? token?.actor?.img ?? token?.document?.actor?.img ?? "");
export function previewFields(plan, token, item) {
  const out = {}, asset = mainVisual(plan), portrait = portraitOf(token), icon = item?.img ? String(item.img) : "";
  if (asset) out.asset = asset;
  if (portrait) out.portrait = portrait;
  if (icon) out.icon = icon;
  return out;
}
// A short name for an asset: a JB2A key loses its "jb2a." prefix; a file path becomes its file name.
export const assetLabel = (asset) => String(asset ?? "").split(/[\/]/).pop().replace(/^jb2a\./i, "");
