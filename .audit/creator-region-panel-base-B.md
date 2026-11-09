# Floor region settings as one draft

Core data shape: `AreaDraft`, one draft per area, with either a new-area seed or a saved-region identity and a sparse settings edit. Selection and ticking remain separate.

## Usage (caller's view)

Select an area on the creator map or in the list. Its inspector retains Floor, Step, water, texture, and outline tools. An **Effects** disclosure mounts the existing region panel below those controls, inside the inspector. The disclosure summary uses the panel's existing summaries. Cave/Cavern, Drips, Air, Animals, and Look stay reachable through the existing section model and More sections.

Every creator setting says **Preview. Applies on Save.** This includes saved regions. Selecting Cave changes the draft floor to bare rock and shows Cavern controls. Fungus colour, stage, size, and amount repaint the selected polygon on the creator map. Crystals also show a static placement preview. Labels identify mist, lava, drips, animals, and other effects that this map does not simulate. Animals and drips become live only after Save creates or updates a real Region.

Changing a control does not change the checkbox. An unticked edited area shows **Not included in Save** beside its preview status. Tick the area and Save to write its outline and settings together. Closing the creator discards its drafts. The canvas right-click panel continues to apply changes immediately.

The panel stays mounted while the GM clicks the map. Selecting another area switches its target. Collapse Effects to give the map and list more room. Escape keeps the creator's current outline-editing precedence; the embedded panel installs no global outside-click or Escape listener. Its scrollable body cannot push the Save button outside the window.

Proposed usage, with intentionally unimplemented APIs:

```js
// floor-regions-ui.mjs, when detection opens or an area is added.
const drafts = createAreaDrafts({ proposals, readSaved, context });
const panel = createRegionPanel(panelDependencies);

// floor-regions-ui.mjs, selecting an area. The row and panel share this draft.
const target = drafts.target(selectedId);
renderInspector(drafts.view(selectedId));
panel.open({ target, presentation: { kind: 'embedded', host: effectsSlot } });
paintAreaPreview(ctx, rgba, width, height, proposals, selectedId, floors, {
	...view,
	effects: drafts.previews(),
});

// floor-regions-ui.mjs, the existing tick-and-Save action.
const plan = planFloorCreate({ ...geometryInputs, areas: drafts.forSave() });
await commitFloorPlan(plan, existingCommitDependencies);
```

Existing canvas usage adopts the same panel target contract:

```js
// main.mjs. This target writes immediately and retains document-only actions.
regionPanel.open({
	target: liveRegionTarget(doc),
	presentation: { kind: 'floating', client },
	at,
	regions: regions.map(({ doc }) => liveRegionTarget(doc)),
});
```

These are three consumers of one editing contract. There is no draft-shaped Foundry document and no second collection of Cave controls.

## Problem

The GM needs region-panel settings and useful feedback without leaving Floor regions. Currently `createRegionPanel` saves immediately, whereas the creator collects choices until Save. Copying the panel or attaching it directly to saved documents would introduce competing writers and edit lifetimes. Some panel actions also change several coupled fields. `kindFlags('cave')` writes `floor: ''`, and `caveKindFlags` can reset lava steps. One draft must receive that whole action before either preview or persistence reads it.

The proposal deliberately changes the grounding's default immediate-write direction for saved areas. It preserves the creator's tick-and-Save contract for geometry, floors, water, and textures, and extends that contract to the newly exposed effects. Canvas editing remains immediate.

## Shape

### Grounded runtime and ownership

The following facts were rechecked in this worktree:

- `scripts/ui/region-panel.mjs` owns panel lifecycle, fold state, asynchronous actions, and outside-click closure. Its injected `flagsOf`, `save`, and `roof` dependencies already separate most document access from controls. `draw()` builds a context for `SECTIONS`.
- `scripts/ui/region-panel-sections.mjs` owns the controls. Most use `own`, `act`, `toFloor`, and `setRoof`. The Steps section also reaches `c.doc` for the full step-list editor. That document action needs an explicit capability.
- `scripts/ui/region-panel-model.mjs` owns kind transitions, section ordering, summaries, and roof behavior helpers. `setRoof` modifies Suppress Weather behaviors, not just `flags.animater.roof`.
- `scripts/ui/floor-regions-ui.mjs` owns selection, DOM-derived choices, `savedChoices`, geometry history, the save planner, and 2D painting. `planFloorCreate` emits sparse saved-region changes against the opening choices. `paintAreaPreview` currently paints floor textures and polygon highlights, without cavern decoration.
- `scripts/engines/regions/floor-detect.mjs` lists accepted floors and converts proposal loops into Region shapes. `AREA_FLOORS` excludes `''`, and `toRegionData` falls back to water for an unrecognized floor. A cave's empty floor therefore cannot round-trip through this path today.
- `scripts/engines/motion/region-steps.mjs` owns effective step and cave semantics. `caveLook(stepFlags(own))` resolves the drawn cave effect, including active-step overrides and stage-adjusted amount and scale. `caveMenu` already suppresses conflicting tone controls for a step-controlled effect.
- `scripts/engines/motion/cavern.mjs` exports deterministic `fungusIn` and `crystalsIn`. Both accept polygons with holes and scene grid units. `crystalsIn` optionally accepts movement-blocking walls. `scripts/main.mjs` builds the live effect with scene settings, walls, lighting-derived floor predicates, and a scene seed. A static editor drawing cannot claim lighting or GPU parity.

The new ownership decision is local to the creator. It owns draft settings alongside its geometry. The panel owns how controls express edits, and the existing engines own how those settings resolve into effects. This is a design proposal grounded in source inspection, not a runtime verification verdict.

### Types and signatures

The notation below sketches contracts for the existing JavaScript modules. It does not propose a TypeScript migration. `RegionSettings`, `SettingsValue`, and `SettingPath` are parsed domain values owned by the settings module. They do not include Foundry dotted update keys or `-=key` deletion syntax. Their full field definitions are TODOs derived from the existing builders, rather than a separately maintained list of controls.

```ts
type AreaId = string;
type SavedRegionKey = { sceneId: string; regionId: string; levelId: string };
type AreaOrigin =
	| { kind: 'new'; initial: RegionSettings }
	| { kind: 'saved'; key: SavedRegionKey };

type SettingChange =
	| { kind: 'set'; path: SettingPath; value: SettingsValue }
	| { kind: 'remove'; path: SettingPath };
type RoofIntent = { kind: 'inherit' } | { kind: 'set'; enabled: boolean };

type AreaDraft = {
	id: AreaId;
	origin: AreaOrigin;
	checked: boolean;
	settings: readonly SettingChange[]; // Canonical latest intent per path.
	roof: RoofIntent;
};

type SettingsEdit =
	| { kind: 'settings'; changes: readonly SettingChange[] }
	| { kind: 'roof'; enabled: boolean };

type SettingsView = {
	name: string;
	own: RegionSettings;
	roofed: boolean;
};

type RegionSettingsTarget = {
	key: string;
	read(): SettingsView;
	apply(edit: SettingsEdit): Promise<void>;
	actions: {
		editSteps?: () => void;
		configure?: () => void;
	};
};

type PanelPresentation =
	| { kind: 'floating'; client: { x: number; y: number } }
	| { kind: 'embedded'; host: HTMLElement };

type AreaSave =
	| { kind: 'new'; id: AreaId; settings: RegionSettings; roof: boolean }
	| { kind: 'saved'; id: AreaId; key: SavedRegionKey;
		changes: readonly SettingChange[]; roof: RoofIntent };
```

`AreaDraft` is the organising structure, per Model the Domain. Saved drafts retain identity and explicit intent, not a copied document. Geometry remains in the existing proposal structure, joined by area ID. A checked area need not be the selected area. A removed draft disappears from the map and save input together.

`RegionSettingsTarget` hides document I/O and draft edits behind `read` and `apply`. Its domain settings use the existing names such as `floor`, `cavern`, and `steps`, so `stepFlags` consumes them without a competing cave schema. The settings adapter parses external flags and converts storage patches at its boundaries, per Boundary Discipline.

```js
// New scripts/ui/area-settings.mjs. Owns creator settings and panel adapters.
export function createAreaDrafts({ proposals, readSaved, context }) {
	// TODO Own Map<AreaId, AreaDraft>; never retain the selected DOM row as data.
	// TODO readSaved(key) resolves against the scene captured when the creator opened.
	// TODO Provide target(id), view(id), previews(), forSave(), and history snapshots.
	throw new Error('not implemented');
}

// Same module's public live adapter. Foundry details stay inside this function.
export function liveRegionTarget(doc, dependencies) {
	// TODO Parse current settings and roof behaviors on every read.
	// TODO Encode sparse edits and reuse hasRoof/setRoof for live writes.
	throw new Error('not implemented');
}

// Private helpers in area-settings.mjs. They are not importable exports.
function resolveArea(draft, saved) {
	// TODO Read latest saved settings, or the new-area seed, then apply local intent.
	// TODO Return own flags, effective roof, and the existing inspector choices.
	throw new Error('not implemented');
}
function previewArea(resolved, proposal, context) {
	// TODO Derive effective = stepFlags(resolved.own), then caveLook(effective).
	// TODO Convert loops via worldAreas, sample clusters in scene coordinates.
	throw new Error('not implemented');
}

// Private to region-panel.mjs. Existing builders retain their internal patch protocol.
function normalisePanelPatch(patch) {
	// TODO Translate section-builder patches, including nested deletion,
	// into SettingsEdit. Preserve replacement vs leaf-merge semantics.
	throw new Error('not implemented');
}

// region-panel.mjs, replacing the current document-specific open contract.
export function createRegionPanel(dependencies) {
	// TODO open({target, presentation, at, regions}), refresh(), close().
	// TODO A single draw implementation uses target.read() and target.apply().
	// TODO Section act/toFloor adapt to one atomic SettingsEdit through the codec.
	// TODO Floating mode retains dragging, tabs, dismissal, and canvas outline.
	// TODO Embedded mode mounts in host and adds no document-level dismissal.
	throw new Error('not implemented');
}

// floor-regions-ui.mjs. Extend the existing planner, not a second save pipeline.
export function planFloorCreate({ proposals, areas, ...context }) {
	// TODO areas contains only checked drafts; keep current geometry validation.
	// TODO New area: convert complete resolved settings through toRegionData.
	// TODO Saved area: encode only explicit changes, not differences of snapshots.
	// TODO Validate saved identities remain generated-only and on the captured level.
	throw new Error('not implemented');
}
```

The codec belongs to the panel rather than each section. `normalisePanelPatch` stays private to `region-panel.mjs`. The draft controller receives semantic edits only. `SECTIONS` remains the one control registry, and both panel presentations use it. Remove `c.doc` from section context. Render the full step-list action only when `target.actions.editSteps` exists. In the creator show **Save first to edit the step list**, including on saved rows, because that editor currently writes directly to the document. Current step selection remains available and draft-backed.

### Draft edits and save behavior

Use the same target for the inspector's existing Floor, Step, water, texture, and edge controls. Replace DOM reads as authoritative settings storage. DOM helpers may read an input event, but `drawRows`, paint, save, and redraw restoration read the controller. Remove `savedChoices` as the planner's settings authority in this migration. Keep its compatibility projection only while assembling old row HTML, then remove that projection when the renderer takes `drafts.view(id)` directly. The final design has one settings source.

Each compound panel action applies atomically to one draft. A cave transition cannot update `floor` without its accompanying cavern and step changes. Nested changes preserve siblings. A parent removal absorbs earlier child edits; a subsequent child edit explicitly recreates that child. New drafts apply deletion instructions locally and send no deletion marker in create data. Saved drafts retain explicit deletions until the planner encodes them for Foundry.

On saved rows, every resolution reads the latest document and overlays only this creator's edited paths. Hook-driven refresh repaints untouched settings changed by the canvas panel or another client. Local intent wins on a path edited here. Save writes those paths sparsely and leaves unrelated flags alone. Do not refresh `savedChoices` and then recompute a full diff, which would make an unrelated external change look like a local edit. No full object replacement is allowed for nested texture styles. No mutation occurs before Save.

Ticking controls inclusion of effects as well as geometry. Split copies the resolved settings and roof into a new draft; its origin is new. The saved side retains its original identity and sparse intent. Combine keeps the existing target area's settings, matching the existing target selection rule, and discards source drafts. Undo restores draft intent together with existing geometry/choice history, without reverting external document changes. Slider gestures produce one history entry. These operations do not share mutable nested settings between areas.

Add `''` as the canonical bare-rock entry to `AREA_FLOORS` and `FLOOR_LOOK`, with label **Cave / bare rock**. Continue to use `cavern` only as the panel's shown-floor classification, not a second persisted floor value. Audit truthiness defaults such as `if (!proposal.floor)` in the creator; use membership or explicit missing-value checks so an empty floor survives add, split, memory, reopen, preview, and save. Selecting this entry applies the existing cave transition once. Reopening a bare cave does not invent fungus or water. `floorFlags('')` must not add water flags, and bare rock must not expose dock controls or request a texture tile.

Extend `toRegionData` with a resolved settings input and roof intent. It keeps ownership of generated markers, geometry, levels, and naming. Merge settings as structured values after existing floor defaults, so explicit choices win, then enforce generator-owned identity fields. Include a Suppress Weather behavior in new Region create data when roof is on. For saved rows, plan existing behavior enable/disable operations through the current roof helpers. Preserve disabled and manually named behavior objects. Write the matching roof flag only after successful behavior application and keep the window open on failure.

Foundry does not provide a transaction across every document operation. A partial save must record successful creates and updates before allowing retry, so retry does not create duplicate Regions. Convert successful new drafts to saved identities and clear only acknowledged intent. Failed drafts stay ticked with their edits. A retry rebuilds a plan for the remaining work. Preserve the current successful-save close behavior when the whole plan finishes.

### Preview contract

Resolve one settings view for the inspector, row summary, texture preview, cave preview, and save input. Compute `stepFlags` before every cave look or badge. Show **Effect controlled by current step** when applicable, using the existing cave-menu policy. Never preview raw `own.cavern` independently of the current step.

Sample in scene coordinates using `worldAreas`, the scene grid, the captured scene's walls, and a stable scene-plus-area seed. Convert output back to read-image coordinates independently on x and y. Clip the final 2D drawing with the polygon's even-odd path so caps, shards, and threads cannot spill into holes. Keep the seed stable across hover, selection, redraw, and slider changes. A draft can change arrangement when it first joins the live scene's grouped renderer; call the preview **Static layout preview** rather than promising exact placement parity.

Paint base image and texture first, decoration second, selection outlines and numbered badges last. Preserve the existing painted-area fast path, but ensure its `continue` cannot skip effects. Fungus uses the existing colour table and stage-adjusted glow, amount, and scale. Crystals use the existing stone colours and cluster geometry, drawn as a still frame. Other cave effects and live systems get compact labelled badges on the map and a readable inspector summary. No moving animal, drip simulation, GPU snapshot, live light, or token interaction is part of this candidate.

Cache per-area static layout by geometry identity, effective cave specification, grid, wall revision, and seed. Repaint camera movement without resampling. Coalesce rapid slider changes into animation-frame painting. Dispose caches, panel mount, and hook subscriptions when the creator closes. Scene or level switches invalidate editing against the captured target and require reopening, rather than redirecting writes to the newly active scene.

### Interface depth and red-flag screen

The target contract hides merge/deletion syntax, immediate versus draft persistence, roof representation, and document-only actions. The controller hides selection-independent settings storage, preview derivation, and sparse save intent. Callers provide an area identity and consume a view or save selection. They never coordinate flag copies with `savedChoices`.

The expected trace for a normal setting is section control, target/controller, then preview or existing save planner. Engine geometry remains behind the preview helper. There are no separate load, validate, transform, and save services, no plugin registry, and no generic transaction framework.

The design-red-flags screen yields these concrete constraints:

- Prevent shallow wrappers by keeping resolution, edit ownership, and sparse intent in the controller. Do not add a method per Cavern field.
- Prevent information leakage by translating Foundry patch syntax at the adapter. Draft callers receive no Region document or synthetic document methods.
- Prevent split ownership by migrating DOM-derived choices and panel edits to the same draft owner.
- Prevent two ways to edit settings by using one panel target contract in `main.mjs` and the creator, with one section registry.
- Prevent hand-synced control lists by deriving section availability and summaries from `panelSections` and `moreSections`.
- Keep the patch codec and preview layout private. Export only the controller factory and live adapter, not importable implementation helpers.

## Synthesis decision

pending arena pick

## Tradeoffs accepted

- We accept deferring saved-region effect changes in exchange for one predictable Save contract inside the creator.
- We accept migrating existing creator settings ownership in exchange for eliminating stale snapshots and two settings writers.
- We accept static fungus and crystal drawings in exchange for immediate feedback without GPU rendering or hidden-canvas dependence.
- We accept withholding the full step-list editor until after Save in exchange for preventing a document editor from bypassing draft ownership.
- We accept explicit same-field local precedence in exchange for sparse edits that preserve concurrent unrelated changes.

## Alternatives considered

A saved-document target plus a new-area draft target was the strongest alternative. It reuses the panel with fewer creator changes and makes saved effects live immediately. It loses because a Cave or Lava action also writes the floor and steps. Callers must then coordinate immediate panel writes, pending creator fields, `savedChoices` refresh, and preview precedence. Its small adapter hides less policy than it exposes to the creator. Splitting each compound action into immediate and deferred parts makes the user-visible behavior worse.

A full GPU snapshot preview hides rendering differences but introduces live scene state, asynchronous GPU resource ownership, and invalidation rules into every draft edit. It exceeds the needed still-layout feedback and does not solve settings ownership. It is rejected for this candidate.

## Open questions and risks

- Will arena choose the single draft lifetime over the grounding's immediate-write default for saved effects? This candidate commits to drafts and requires no secondary product decision to implement that shape.
- Can the implementation preserve every nested merge and deletion case used by the panel builders, including None and kind transitions? Codec probes against real builder outputs must settle this before wiring the UI.
- Can partial Region creation return enough acknowledged identities to avoid duplicate creates after retry? If Foundry's failure contract cannot establish this, failed ambiguous creates must require reconciliation before another Save.
- Does static placement remain responsive on large multi-part areas at the scene's grid size? Measure realistic polygons before adding sampling limits that change visible density.

## Next implementation step

Build the draft controller and patch codec against the existing kind-transition outputs, then connect both the inspector controls and embedded panel to that one owner.

Implementation evidence must cover saved cave round trips, active-step effect precedence, nested deletions, roof behavior creation and toggling, unticked edits, external unrelated edits, Add/Split/Undo settings retention, holes and non-square transforms, and partial-save retry. Native Foundry verification and an independent review belong to implementation after arena selects a candidate. Neither is claimed by this document.
