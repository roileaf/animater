import { centerOf } from "../playback/composition.mjs";

export function normalizePreviewArea(area) {
  if (
    !area ||
    ![
      "burst",
      "emanation",
      "circle",
      "cylinder",
      "cone",
      "line",
      "square",
      "cube",
      "rect",
    ].includes(area.type)
  )
    return null;
  const value = Number(area.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  const width = Number(area.width);
  return { type: area.type, value: Math.min(value, 1000),
    ...(area.type === 'line' && Number.isFinite(width) && width > 0
      ? {width:Math.min(width,1000)} : {}) };
}
function coneArea(x, y, length, angle, rotation) {
  if (![x, y, length, angle, rotation].every(Number.isFinite) || length <= 0 || angle <= 0 || angle > 90) return null;
  const radians = rotation * Math.PI / 180;
  return { type: "cone", center: { x, y }, endpoint: { x: x + Math.cos(radians) * length, y: y + Math.sin(radians) * length }, length, angle };
}
export function templateArea(
  template,
  { gridSize = 100, gridDistance = 5, source, spec } = {},
) {
  let doc = template?.document ?? template;
  if (!doc) return null;
  // Foundry 14 stores a MeasuredTemplate as a Region with the same id; the
  // compatibility document's distance assumes a 100px grid (15 ft reads 44.4
  // on a 296px grid). The Region holds the true canvas geometry.
  if (doc.documentName === "MeasuredTemplate") doc = doc.parent?.regions?.get?.(doc.id) ?? doc;
  const scale = gridSize / gridDistance;
  if (doc.documentName === "Region") {
    const shapes = Array.from(doc.shapes ?? []);
    if (shapes.length !== 1) return null;
    const shape = shapes[0];
    // Foundry 14 / PF2e 8.5 store measured shapes directly in canvas pixels.
    // Older Regions use ellipses and polygons, handled below.
    if (shape.type === "cone")
      return coneArea(shape.x, shape.y, shape.radius, shape.angle, Number(shape.rotation ?? 0));
    if (shape.type === "emanation" && shape.base?.type === "token") {
      const base = shape.base;
      const width = Number(base.width) * gridSize, height = Number(base.height) * gridSize;
      if (![base.x, base.y, width, height, shape.radius].every(Number.isFinite) || width <= 0 || height <= 0 || shape.radius <= 0) return null;
      // Circular footage uses the native footprint's outer bounding diameter.
      // It cannot represent a rounded rectangle around a rectangular token.
      return { center: { x: base.x + width / 2, y: base.y + height / 2 }, diameter: 2 * shape.radius + Math.max(width, height) };
    }
    if (shape.type === "circle") {
      if (
        !Number.isFinite(shape.x) ||
        !Number.isFinite(shape.y) ||
        !Number.isFinite(shape.radius) ||
        shape.radius <= 0
      )
        return null;
      return {
        center: { x: shape.x, y: shape.y },
        diameter: shape.radius * 2,
      };
    }
    if (shape.type === "line") {
      const angle = (Number(shape.rotation ?? 0) * Math.PI) / 180;
      if (
        !Number.isFinite(shape.x) ||
        !Number.isFinite(shape.y) ||
        !Number.isFinite(shape.length) ||
        shape.length <= 0 ||
        !Number.isFinite(shape.width) ||
        shape.width <= 0 ||
        !Number.isFinite(angle)
      )
        return null;
      return {
        type: "line",
        center: { x: shape.x, y: shape.y },
        endpoint: {
          x: shape.x + Math.cos(angle) * shape.length,
          y: shape.y + Math.sin(angle) * shape.length,
        },
        length: shape.length,
        width: shape.width,
      };
    }
    if (shape.type === "rectangle" && ["square", "cube"].includes(spec?.type)) {
      const side = Number(shape.width);
      if (
        !Number.isFinite(side) ||
        side <= 0 ||
        Math.abs(side - shape.height) > 0.01 ||
        !Number.isFinite(shape.x) ||
        !Number.isFinite(shape.y) ||
        Math.abs(Number(shape.rotation ?? 0) % 90) > 0.01
      )
        return null;
      return {
        type: "square",
        center: { x: shape.x + side / 2, y: shape.y + side / 2 },
        diameter: side,
        width: side,
      };
    }
    if (
      shape.type === "ellipse" &&
      Math.abs(shape.radiusX - shape.radiusY) < 0.01
    )
      return {
        center: { x: shape.x, y: shape.y },
        diameter: shape.radiusX * 2,
      };
    if (
      !["line", "square", "cube"].includes(spec?.type) ||
      shape.type !== "polygon" ||
      shape.points?.length !== 8
    )
      return null;
    const points = Array.from({ length: 4 }, (_, i) => ({
      x: shape.points[i * 2],
      y: shape.points[i * 2 + 1],
    }));
    if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
      return null;
    for (let i = 0; i < 4; i++) {
      const a = points[i],
        b = points[(i + 1) % 4],
        c = points[(i + 2) % 4];
      if (
        Math.abs((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) > 0.01
      )
        return null;
    }
    const edges = points
      .map((a, i) => {
        const b = points[(i + 1) % 4];
        return {
          length: Math.hypot(b.x - a.x, b.y - a.y),
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          index: i,
        };
      })
      .sort((a, b) => a.length - b.length);
    if (["square", "cube"].includes(spec?.type)) {
      if (
        edges[0].length <= 0 ||
        Math.abs(edges[3].length - edges[0].length) > 0.01
      )
        return null;
      if (
        points.some(
          (p, i) =>
            Math.abs(p.x - points[(i + 1) % 4].x) > 0.01 &&
            Math.abs(p.y - points[(i + 1) % 4].y) > 0.01,
        )
      )
        return null;
      return {
        type: "square",
        center: {
          x: points.reduce((sum, p) => sum + p.x, 0) / 4,
          y: points.reduce((sum, p) => sum + p.y, 0) / 4,
        },
        diameter: edges[0].length,
        width: edges[0].length,
      };
    }
    if (
      edges[0].length <= 0 ||
      Math.abs(edges[0].length - edges[1].length) > 0.01 ||
      Math.abs(edges[0].index - edges[1].index) !== 2
    )
      return null;
    const origin = centerOf(source);
    const ends = edges
      .slice(0, 2)
      .sort(
        (a, b) =>
          Math.hypot(a.center.x - origin.x, a.center.y - origin.y) -
          Math.hypot(b.center.x - origin.x, b.center.y - origin.y),
      );
    return {
      type: "line",
      center: ends[0].center,
      endpoint: ends[1].center,
      length: Math.hypot(
        ends[1].center.x - ends[0].center.x,
        ends[1].center.y - ends[0].center.y,
      ),
      width: ends[0].length,
    };
  }
  if (doc.t === "cone")
    return coneArea(doc.x, doc.y, Number(doc.distance) * scale, Number(doc.angle ?? 90), Number(doc.direction ?? 0));
  if (doc.t === "circle")
    return {
      center: { x: doc.x, y: doc.y },
      diameter: doc.distance * scale * 2,
    };
  if (doc.t === "rect" && ["square", "cube"].includes(spec?.type)) {
    const length = Number(doc.distance) * scale;
    const angle = (Number(doc.direction ?? 45) * Math.PI) / 180;
    const dx = Math.cos(angle) * length,
      dy = Math.sin(angle) * length;
    const side = length / Math.SQRT2;
    if (
      !Number.isFinite(side) ||
      side <= 0 ||
      Math.abs(Math.abs(dx) - Math.abs(dy)) > 0.01
    )
      return null;
    return {
      type: "square",
      center: { x: doc.x + dx / 2, y: doc.y + dy / 2 },
      diameter: side,
      width: side,
    };
  }
  if (doc.t !== "ray") return null;
  const angle = ((doc.direction ?? 0) * Math.PI) / 180,
    length = doc.distance * scale;
  if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(angle))
    return null;
  return {
    type: "line",
    center: { x: doc.x, y: doc.y },
    endpoint: {
      x: doc.x + Math.cos(angle) * length,
      y: doc.y + Math.sin(angle) * length,
    },
    length,
    width: (doc.width ?? gridDistance) * scale,
  };
}

// Preview documents are never embedded in the scene. Their placeables and grid
// highlights exist on this client only, without creation hooks or persistence.
export function previewTemplateData(
  recipe,
  context,
  { gridSize = 100, gridDistance = 5, userId, id } = {},
) {
  const spec = normalizePreviewArea(recipe.previewArea);
  const selected = context.area;
  if (!spec && !recipe.stages.some((s) => s.kind === "template")) return null;
  const source = context.source;
  if (!source && !selected) throw Error("Select a source token first.");
  const type = spec?.type ?? "circle";
  const directional = ["cone", "line"].includes(type);
  const origin =
    selected?.center ??
    centerOf(
      type === "emanation" || directional
        ? source
        : (context.targets?.[0] ?? source),
    );
  const target = centerOf(context.targets?.[0] ?? source);
  const value = spec?.value ?? 15;
  const t = selected
    ? selected.type === "line"
      ? "ray"
      : selected.type === "cone"
        ? "cone"
      : selected.type === "square"
        ? "rect"
        : "circle"
    : type === "cone"
      ? "cone"
      : type === "line"
        ? "ray"
        : ["square", "cube", "rect"].includes(type)
          ? "rect"
          : "circle";
  const side =
    selected?.type === "square"
      ? selected.width
      : (value * gridSize) / gridDistance;
  return {
    _id: id,
    user: userId,
    t,
    x: origin.x - (t === "rect" ? side / 2 : 0),
    y: origin.y - (t === "rect" ? side / 2 : 0),
    distance:
      ["line", "cone"].includes(selected?.type)
        ? (selected.length * gridDistance) / gridSize
        : selected?.type === "square"
          ? (side * gridDistance * Math.SQRT2) / gridSize
          : selected?.diameter
            ? (selected.diameter * gridDistance) / gridSize / 2
            : t === "rect"
              ? value * Math.SQRT2
              : value,
    direction:
      t === "rect"
        ? 45
        : ["line", "cone"].includes(selected?.type) || directional
          ? (Math.atan2(
              (selected?.endpoint ?? target).y - origin.y,
              (selected?.endpoint ?? target).x - origin.x,
            ) *
              180) /
            Math.PI
          : 0,
    angle: selected?.type === "cone" ? selected.angle : 90,
    width:
      selected?.type === "line"
        ? (selected.width * gridDistance) / gridSize
        : spec?.width ?? gridDistance,
    fillColor: recipe.color,
    borderColor: recipe.color,
    flags: { animater: { preview: true } },
  };
}

export async function createCanvasPreviewArea(
  recipe,
  context,
  { canvas, DocumentClass, TemplateClass, userId, randomId },
) {
  const gridSize = canvas.grid.size;
  const gridDistance = canvas.scene.grid.distance;
  const data = previewTemplateData(recipe, context, {
    gridSize,
    gridDistance,
    userId,
    id: randomId(),
  });
  if (!data) return null;
  const document = new DocumentClass(data, { parent: canvas.scene });
  const object = new TemplateClass(document);
  document._object = object;
  object._previewType = "api";
  object.eventMode = "none";
  const container = canvas.templates;
  const cleanup = () => {
    if (object.destroyed) return;
    object.parent?.removeChild(object);
    object.destroy({ children: true });
  };
  try {
    container.addChild(object);
    await object.draw();
    const pixels = (data.distance * gridSize) / gridDistance;
    return {
      context: {
        ...context,
        template: object,
        area:
          ["ray", "cone"].includes(data.t) ||
          (data.t === "rect" &&
            ["square", "cube"].includes(recipe.previewArea?.type))
            ? templateArea(document, {
                gridSize,
                gridDistance,
                spec: recipe.previewArea,
              })
            : {
                center:
                  context.area?.center ??
                  (data.t === "rect"
                    ? {
                        x: data.x + pixels / Math.SQRT2 / 2,
                        y: data.y + pixels / Math.SQRT2 / 2,
                      }
                    : { x: data.x, y: data.y }),
                diameter: data.t === "rect" ? pixels / Math.SQRT2 : pixels * 2,
              },
      },
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
