# Grounding: region-panel settings + preview in Floor regions creator

## Goal

Let the GM access and preview the Cave/Cavern (and related) region-panel settings inside the Floor regions creator, without bouncing to the floating Stone 2 panel. Ship on a new branch.

## How (condensed)

Two editors:
- Region panel: immediate `doc.update` of `flags.animater`; live Foundry canvas via hooks (~600ms for cavern).
- Floor regions window: draft form until Save; 2D preview of textures only today.

Section builders `SECTIONS.*` are pure given context `c`. Panel already injects `flagsOf`, `save`, `roof`.

Cave draw spec: `caveLook(stepFlags(own))`. Fungus/crystal placement (`fungusIn` / `crystalsIn`) is pure polygon math and can paint in 2D without GPU or a Region doc.

Gotchas:
1. No cave/`''` floor in `AREA_FLOORS` — saved caves reload as water.
2. `savedChoices` stale if panel edits while window open.
3. Roof is a RegionBehavior, not only a flag.
4. Animals/drips need a real Region for live play.
5. Panel save uses Foundry merge/`-=key` syntax.
6. Panel closes on outside click (including creator map).
7. Live in-scene preview is mostly hidden under the creator window.
8. Active steps can override cavern via `stepFlags`.

## Explainer's recommended smallest seams (default product direction)

1. Reuse `createRegionPanel` with a draft-backed or saved-doc target (do not clone sections).
2. `toRegionData` / create path accepts extra animater flags (+ roof behavior).
3. Add cave bare-rock floor (`''`) through `isAreaFloor` / proposals / choices / `toRegionData`.
4. 2D cave preview in `paintAreaPreview` via `caveLook(stepFlags(draft))` + `fungusIn`/`crystalsIn` (still frames). Full `cavern.snapshot` later optional.
5. UI copy: saved = "changes apply now"; new = "applies on Save". Refresh `savedChoices` after panel saves on saved rows.

## Preserve / Change / Avoid / Risk

Preserve:
- Tick-and-Save flow for geometry/floor/water/texture.
- Sparse updates that leave unrelated flags alone.
- Existing region panel when right-clicked on the canvas.
- Generated-only editable set in the window.

Change:
- Selected-area access to cavern/drips/air/animals/look in the creator.
- Preview of fungus/crystals (and simple mist/lava/drip/animal badges) on the creator map.
- Cave floor representation so caves are not mislabeled as water.

Avoid:
- Cloning panel HTML/CSS into a second Cave UI.
- Relying on live Foundry canvas preview behind a nearly full-screen window as the primary feedback.
- Making animals/drips pretend to be live on unsaved drafts.

Risk:
- Stale `savedChoices` undoing panel edits on Save.
- Step-effect overrides diverging from what the UI shows if preview skips `stepFlags`.
- Scope creep into full GPU snapshot parity.

## Files

- `scripts/ui/region-panel.mjs`, `region-panel-model.mjs`, `region-panel-sections.mjs`
- `scripts/ui/floor-regions-ui.mjs`
- `scripts/engines/regions/floor-detect.mjs`
- `scripts/engines/motion/region-steps.mjs`, `cavern.mjs`
- `scripts/main.mjs` (panel wiring, cavePreview, rebuildCavern)
