# Synthesized design: Cave settings in Floor regions creator

## Synthesis decision

**Base:** Codex candidate B (`AreaDraft` + embedded panel, Save-only in creator).  
**Cross-judge:** Codex (also authored B; declared that). Independent reading agrees on B for one save clock, reuse, and preview fidelity without deleting the working inspector.

**Grafts**
- From A: extract shared `mountRegionSettings` (or equivalent body fill) behind floating vs embedded presentation; show when world/client cave settings disable an effect.
- From C/D: nonempty creator picker id `cavern`, translated to wire `floor: ''` only at save/load boundaries (do not store `floor: ''` as the picker value; memory truthiness rejects empty floor).
- From D: keep quick creator controls + manual tick; unticked-settings warning and Leave unchanged.

**Rejected**
- Dual-clock immediate write for saved rows.
- A's wholesale inspector deletion and auto-tick.
- D's incomplete preview cache keys and shared `pendingRoof`.

## Product shape (for implementer)

1. **Core type `AreaDraft`:** per-area draft owning settings intent + roof intent; geometry stays on proposals. One owner for inspector + embedded panel.
2. **UI:** Select area → existing inspector (floor/water/texture/step/tools) + **Effects** (or equivalent) hosting region panel sections. Line: "Preview. Applies on Save." Saved and new share that clock. Canvas right-click panel still immediate.
3. **Cave floor:** picker/swatch `cavern`; wire `flags.animater.floor = ""` + cavern growth at `toRegionData` / load via `shownFloorOf` / `displayFloor`. Fix floor-memory to learn/recall caves without relying on truthy `floor`.
4. **Panel:** extend `createRegionPanel` for `{ target, presentation: floating|embedded }`. Embedded: no outside-click dismiss. Floating: unchanged. `target.read` / `target.apply` hide draft vs live doc.
5. **Preview:** `stepFlags` → `caveLook` → `fungusIn`/`crystalsIn` in scene space into `paintAreaPreview`; badges for mist/lava/drips/animals/roof. Cache keys include amount, scale, walls, transforms.
6. **Save:** checked drafts only; sparse updates from explicit intent (not stale snapshot diffs); create carries full resolved flags + roof behavior; acknowledge create identities before roof retry.
7. **Steps:** do not open live Steps editor that writes the document from the creator; either disable Edit steps in embedded mode or a draft-safe path. Decide draft-safe before shipping.

## Throughput

One implementer on `feat/creator-cave-settings-preview`. Serial edits to `floor-regions-ui`, `region-panel*`, `floor-detect`, `floor-memory`, preview paint, tests.

## Verification

- Unit: draft apply/patch, cavern load≠water, planFloorCreate sparse cave flags, fungus preview count changes with amount, memory learn/recall cave.
- UI tests: Effects mount, Save applies, unticked warning, Leave unchanged.
- Manual Foundry: open Floor regions on cave map, select Stone/cave area, set violet fungus, see caps on creator map, Save, confirm live canvas.
