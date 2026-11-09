# Image planes

A region belongs to one picture. The picture is the map, or one tile. The riverboat scene has no scene foreground. The map is grass, stone, and water. The red ship is two tiles.

This is the design to build. Codex is the base. Two grafts are folded in. The projection-repair machine and the all-at-once renderer move are not.

## Usage

The Floor regions window lists the map and each visible tile. The map still traces Water, Grass, and Stone by color. A tile traces opaque islands in that tile's image. The deck offers a wood floor. Each awning offers a cover, and a cover has no floor.

Footsteps, weather, and light ask one function.

```js
const planes = planesFrom({ levelId, sceneRect, backgroundSrc, tiles });
const here = surfaceAt(point, { elevation, regions, planes, contains });
// on the hull at elevation 0: { floor: "wood", blocksWeather: false, blocksLight: false, source: deck }
// under an awning at elevation 0: { floor: "wood", blocksWeather: true, blocksLight: true, source: deck }
// on the grass at any height: { floor: "grass", blocksWeather: false, blocksLight: false, source: map }
// above an awning at elevation 25, off the hull: { floor: "water", blocksWeather: false, blocksLight: false, source: map }
```

`contains(region, point)` is the 2D polygon test. Elevation is decided here, from the live plane, not from a copy on the region.

## Data shape

```js
// Map, or one tile. Elevation and restrictions are read from the tile document
// at planesFrom. They are not stored on the region.
// role is derived, never stored beside the restrictions.
//   map                              → floor, elevation null (unbounded)
//   tile, neither restriction        → floor, slab at the tile elevation
//   tile, either restriction         → overhead, top at the tile elevation
//
// @typedef {{
//   id: { kind: "map", levelId: string } | { kind: "tile", tileId: string },
//   src: string,
//   frame: { x: number, y: number, width: number, height: number },
//   role: "floor" | "overhead",
//   elevation: number | null,
//   blocksLight: boolean,
//   blocksWeather: boolean,
// }} Plane

// Stored at flags.animater.imageRegion. Absent means a legacy region.
// loops are normalized 0..1 in that picture, origin top-left.
// @typedef {{
//   source: Plane["id"],
//   loops: { hole: boolean, points: number[] }[],
// }} Binding
```

A floor region also keeps today's floor flags. An overhead region has no floor flag. Water, Grass, and Stone have no binding and keep null elevation.

Opaque means alpha at least 200. Below that, the deck's wake and hull shadow, and the awnings' black painted shadow, are not part of a region and do not block light or weather. The map is fully opaque, so it stays on the color tracer. A tile uses the solid mask. Share is counted over solid pixels, so one awning is about half of the cloth, not one percent of the tile rectangle.

Before the Smart model calls `.rgb()`, clear and soft pixels are painted a flat matte. `scripts/ui/smart-model.mjs` drops alpha at `.rgb()`, and a transparent black shadow would otherwise become a black object.

## Query

`surfaceAt` returns `{ floor, blocksWeather, blocksLight, source }`.

A legacy region with null elevation matches every height and keeps its floor. A bound floor matches when the polygon contains the point and the query elevation is the plane's elevation. A tile floor beats an unbounded map floor on the same point, which is why the hull is wood and the water region underneath still exists. An overhead region never supplies a floor. It blocks light or weather only when the polygon contains the point and the query elevation is below the plane. A token at 20 standing on cloth is not sheltered by that cloth. A token at 0 under the cloth is.

`floorAt` stays the name callers use and returns `surfaceAt(...).floor`. It holds no rule of its own.

## Draw order, later

Floor looks and floor textures are created at sort 410 and 400. Tiles sort at 500, and the comment in `scripts/main.mjs` says a bush stands over blood on the ground. Deck looks must sort just above that deck tile. They must not stay on the fixed 400 and 410 layers. That wiring is a later unit. The pure query does not draw.

## What was rejected

Grok copied elevation and restrictions onto the region. Editing one copy and not the other is the bug. The tile document stays the authority. The binding stores the outline and which picture it came from.

Gemini's stack let an overhead region become a floor at elevation 20 and above, and its detector defaulted every tile proposal to wood, including the awnings. A cover has no floor. Gemini's solid threshold of 200 and the draw-order fact are kept.

Codex's elected-GM repair loop, and the move of every effect onto a new renderer in one delivery, are cut. Runtime answers come from the binding plus the live plane. Native region shapes are written when the GM saves. Moving a tile and rewriting those shapes is a later unit.

## Units

1. `scripts/engines/regions/image-plane.mjs` and its test. `planesFrom`, `solidMask`, `rgbForModel`, `project`, `bindingFromProposal`, `surfaceAt`. Fixtures for the unbounded map, the hull at elevation 0, and a cover whose top is 20. Alpha 199 is outside. Alpha 200 is inside.
2. The Floor regions window lists planes and saves a binding through the existing save path. One window. Map regions stay on the map image.
3. Footsteps, weather, and light read `surfaceAt`. One consumer at a time.
4. Deck effects sort above the deck tile.

## Synthesis decision

Base is Codex. The judge scored it 25, Grok 20, Gemini 19. I agree on the base. Grok's one query replaces Codex's separate contact and exposure calls. Gemini's alpha 200 and the sort-500 draw fact are grafted. The rest of those two sketches stays out.
