// One draft per area in the floor creator. The inspector and the embedded region panel both write it.
// Geometry stays on the proposal. Nothing here writes a Foundry document.

import { pickerFloor, patchFlags } from "../engines/regions/floor-detect.mjs";
import { kindFlags } from "./region-panel-model.mjs";

const WATER_KEYS = ["waterKind", "flowTo", "current", "waveTo", "seaBeach"];

const blank = () => ({ flags: {}, intent: new Set(), deleted: new Set(), roof: null, roofBase: false, roofTouched: false });

// Nested objects are already merged by the section that sends them, so the patch is shallow.
function applyPatch(draft, patch) {
  patchFlags(draft.flags, patch);
  for (const key of Object.keys(patch ?? {})) {
    const deletes = key.startsWith("-="), real = deletes ? key.slice(2) : key;
    (deletes ? draft.deleted : draft.intent).add(real);
    (deletes ? draft.intent : draft.deleted).delete(real);
  }
}

export function createAreaDrafts() {
  const drafts = new Map();
  const ensure = (id) => {
    let draft = drafts.get(id);
    if (!draft) drafts.set(id, draft = blank());
    return draft;
  };
  return {
    // Copy saved flags in once. A later edit is kept.
    seed(id, flags = {}, { roofed = false } = {}) {
      const draft = ensure(id);
      if (draft.intent.size || draft.deleted.size || draft.roofTouched) return draft;
      draft.flags = { ...flags };
      draft.roofBase = roofed === true;
      draft.roof = null;
      return draft;
    },
    get(id) { return drafts.get(id) ?? null; },
    apply(id, patch) { const draft = ensure(id); applyPatch(draft, patch); return draft; },
    setRoof(id, enabled) {
      const draft = ensure(id);
      draft.roof = enabled === true;
      draft.roofTouched = true;
      return draft;
    },
    // The floor dropdown. Cave is the one kind change that has to clear the other kind's flags.
    chooseFloor(id, floor) {
      const own = ensure(id).flags;
      if (floor === "cavern") {
        const clear = Object.fromEntries(WATER_KEYS.map((key) => [`-=${key}`, null]));
        return this.apply(id, { ...kindFlags("cave", own), ...clear });
      }
      if (pickerFloor(own) === "cavern") {
        const kind = floor === "water" ? "water" : floor === "lava" ? "lava" : "ground";
        return this.apply(id, { ...kindFlags(kind, own), floor });
      }
      return this.apply(id, { floor });
    },
    drop(id) { drafts.delete(id); },
    copy(from, to) {
      const draft = drafts.get(from);
      if (!draft || from === to) return;
      drafts.set(to, { flags: { ...draft.flags }, intent: new Set(draft.intent), deleted: new Set(draft.deleted), roof: draft.roof, roofBase: draft.roofBase, roofTouched: draft.roofTouched });
    },
    read(id) {
      const draft = drafts.get(id);
      if (!draft) return { own: {}, roofed: false };
      return { own: { ...draft.flags }, roofed: draft.roof === null ? draft.roofBase === true : draft.roof === true };
    },
    // Null until the GM changes something, so a seeded area does not rewrite a region on Save.
    export(id) {
      const draft = drafts.get(id);
      if (!draft || (!draft.intent.size && !draft.deleted.size && !draft.roofTouched)) return null;
      return { flags: { ...draft.flags }, intent: [...draft.intent], deleted: [...draft.deleted], roof: draft.roof === true, roofTouched: draft.roofTouched === true };
    },
    dirty(id) {
      const draft = drafts.get(id);
      return !!draft && (draft.intent.size > 0 || draft.deleted.size > 0 || draft.roofTouched);
    },
    unticked(proposals, picked) {
      const checked = new Map((picked ?? []).map((row) => [row.id, row.checked === true]));
      return (proposals ?? []).filter((proposal) => this.dirty(proposal.id) && !checked.get(proposal.id));
    },
    snapshot() {
      const out = {};
      for (const [id, draft] of drafts) out[id] = { flags: { ...draft.flags }, intent: [...draft.intent], deleted: [...draft.deleted], roof: draft.roof, roofBase: draft.roofBase, roofTouched: draft.roofTouched };
      return out;
    },
    restore(snap) {
      drafts.clear();
      for (const [id, draft] of Object.entries(snap ?? {})) {
        drafts.set(id, { flags: { ...(draft.flags ?? {}) }, intent: new Set(draft.intent ?? []), deleted: new Set(draft.deleted ?? []), roof: draft.roof ?? null, roofBase: draft.roofBase === true, roofTouched: draft.roofTouched === true });
      }
    },
  };
}
