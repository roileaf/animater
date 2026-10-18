import test from "node:test";
import assert from "node:assert/strict";
import {
  createCanvasPreviewArea,
  previewTemplateData,
  templateArea,
} from "../../../scripts/engines/preview/canvas-preview-area.mjs";
import { PF2E_SPELLS, spellRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";

const context = {
  source: { center: { x: 100, y: 100 } },
  targets: [{ center: { x: 500, y: 100 } }],
};
const options = { gridSize: 100, gridDistance: 5, userId: "u", id: "preview" };
test('reviewed rectangular passage keeps its full length and two-square width', () => {
  const recipe = validateRecipe({id:'safe-passage',name:'Safe passage',trigger:'manual',stages:[{kind:'template',assets:['jb2a.test']}],previewArea:{type:'line',value:60,width:10}});
  assert.deepEqual(recipe.previewArea,{type:'line',value:60,width:10});
  const data = previewTemplateData(recipe,context,options);
  assert.equal(data.t,'ray');assert.equal(data.distance,60);assert.equal(data.width,10);
  const area = templateArea(data,options);
  assert.equal(area.length,1200);assert.equal(area.width,200);
});
test("native PF2e cones retain vertex, reach and aperture instead of becoming circles", () => {
  const region = { documentName: "Region", shapes: [{ type: "cone", x: 300, y: 400, radius: 600, angle: 90, rotation: 90 }] };
  for (const area of [templateArea(region, options), templateArea({ t: "cone", x: 300, y: 400, distance: 30, angle: 90, direction: 90 }, options)]) {
    assert.equal(area?.type, "cone");
    assert.deepEqual(area.center, { x: 300, y: 400 });
    assert.ok(Math.abs(area.endpoint.x - 300) < 1e-8);
    assert.equal(area.endpoint.y, 1000);
    assert.equal(area.length, 600);
    assert.equal(area.angle, 90);
  }
  for (const bad of [{ radius: 0 }, { angle: 180 }, { rotation: NaN }])
    assert.equal(templateArea({ ...region, shapes: [{ ...region.shapes[0], ...bad }] }), null);
});
test("Foundry 14 template documents read their Region's canvas geometry, not the 100px-grid distance", () => {
  // A 15 ft cone on a 296px grid: the Region holds 888px, the template document reports 44.4.
  const region = { documentName: "Region", shapes: [{ type: "cone", x: 300, y: 400, radius: 888, angle: 53.13, rotation: 0 }] };
  const template = { documentName: "MeasuredTemplate", id: "t1", t: "cone", x: 300, y: 400, distance: 44.4, angle: 53.13, direction: 0, parent: { regions: new Map([["t1", region]]) } };
  const area = templateArea(template, { gridSize: 296, gridDistance: 5 });
  assert.equal(area.length, 888);
  assert.deepEqual(area.endpoint, { x: 1188, y: 400 });
});
test("private cone preview preserves selected aperture and cleans up its own footprint", async () => {
  const recipe = { previewArea: { type: "cone", value: 30 }, stages: [{ kind: "template" }] };
  const f = fixture();
  const result = await createCanvasPreviewArea(recipe, context, f.host);
  assert.equal(result.context.area.type, "cone");
  assert.equal(result.context.area.length, 600);
  assert.deepEqual(result.context.area.center, context.source.center);
  result.cleanup();
  assert.equal(f.objects.length, 0);
  const selected = { type: "cone", center: { x: 300, y: 400 }, endpoint: { x: 300, y: 700 }, length: 300, angle: 60 };
  const data = previewTemplateData(recipe, { ...context, area: selected }, options);
  assert.deepEqual([data.t, data.distance, data.direction, data.angle], ["cone", 15, 90, 60]);
});
test("native emanations include their token base rather than ignoring the Region", () => {
  const area = templateArea({ documentName: "Region", shapes: [{ type: "emanation", radius: 200, base: { type: "token", x: 300, y: 400, width: 2, height: 1 } }] }, options);
  assert.deepEqual(area, { center: { x: 400, y: 450 }, diameter: 600 });
});
test("Foundry 14 measured circle and rotated line Regions preserve pixel geometry", () => {
  const region = (shape) => ({ documentName: "Region", shapes: [shape] });
  assert.deepEqual(
    templateArea(region({ type: "circle", x: 600, y: 300, radius: 400 }), options),
    { center: { x: 600, y: 300 }, diameter: 800 },
  );
  const shape = {
    type: "line",
    x: 150,
    y: 200,
    length: 2400,
    width: 100,
    rotation: 90,
  };
  const line = templateArea(region(shape), { ...options, gridSize: 200 });
  assert.deepEqual(line.center, { x: 150, y: 200 });
  assert.ok(Math.abs(line.endpoint.x - 150) < 1e-8);
  assert.equal(line.endpoint.y, 2600);
  assert.equal(line.length, 2400);
  assert.equal(line.width, 100);
  const reverse = templateArea(region({ ...shape, rotation: 180 }), options);
  assert.equal(reverse.endpoint.x, -2250);
  assert.ok(Math.abs(reverse.endpoint.y - 200) < 1e-8);
  for (const bad of [{ radius: 0 }, { x: NaN }, { radius: Infinity }])
    assert.equal(
      templateArea(region({ type: "circle", x: 0, y: 0, radius: 100, ...bad })),
      null,
    );
  for (const bad of [{ length: -1 }, { width: 0 }, { rotation: NaN }])
    assert.equal(templateArea(region({ ...shape, ...bad })), null);
});
test("catalog area dimensions survive editable recipe validation", () => {
  const fireball = spellRecipe(PF2E_SPELLS.find((s) => s.name === "Fireball"));
  assert.deepEqual(validateRecipe(fireball).previewArea, {
    type: "burst",
    value: 20,
  });
  const data = previewTemplateData(fireball, context, options);
  assert.deepEqual(
    [data.t, data.x, data.y, data.distance],
    ["circle", 500, 100, 20],
  );
});
test("cone, line, emanation and square footprints use their native shape and size", () => {
  for (const [type, t] of [
    ["cone", "cone"],
    ["line", "ray"],
    ["emanation", "circle"],
    ["cube", "rect"],
  ]) {
    const data = previewTemplateData(
      { previewArea: { type, value: 15 }, stages: [], color: "#abcdef" },
      context,
      options,
    );
    assert.equal(data.t, t);
    assert.equal(data.x, t === "rect" ? 350 : 100);
    assert.equal(data.direction, t === "rect" ? 45 : 0);
    assert.equal(data.distance, t === "rect" ? 15 * Math.SQRT2 : 15);
    assert.equal(data.width, 5);
  }
});
test("custom area stages use selected area or a 15-foot sample; ordinary recipes create no template", () => {
  const recipe = { stages: [{ kind: "template" }] };
  const data = previewTemplateData(
    recipe,
    { ...context, area: { center: { x: 700, y: 400 }, diameter: 1200 } },
    options,
  );
  assert.deepEqual([data.x, data.y, data.distance], [700, 400, 30]);
  assert.equal(previewTemplateData(recipe, context, options).distance, 15);
  assert.equal(
    previewTemplateData({ stages: [{ kind: "cast" }] }, context, options),
    null,
  );
  assert.throws(() => previewTemplateData(recipe, {}, options), /source token/);
});
function fixture({ fail = false } = {}) {
  const objects = [],
    destroyed = [];
  const container = {
    addChild(object) {
      objects.push(object);
      object.parent = this;
    },
    removeChild(object) {
      objects.splice(objects.indexOf(object), 1);
      object.parent = null;
    },
  };
  class Document {
    constructor(data, options) {
      Object.assign(this, data);
      this.parent = options.parent;
    }
  }
  class Template {
    constructor(document) {
      this.document = document;
    }
    async draw() {
      if (fail) throw Error("draw failed");
    }
    destroy() {
      this.destroyed = true;
      destroyed.push(this);
    }
  }
  return {
    objects,
    destroyed,
    host: {
      canvas: {
        grid: { size: 100 },
        scene: { grid: { distance: 5 } },
        templates: container,
      },
      DocumentClass: Document,
      TemplateClass: Template,
      userId: "u",
      randomId: () => "preview",
    },
  };
}
test("temporary template is a local placeable; cleanup destroys only its own object", async () => {
  const f = fixture();
  const existing = {};
  f.objects.push(existing);
  const area = await createCanvasPreviewArea(
    { previewArea: { type: "burst", value: 20 }, stages: [] },
    context,
    f.host,
  );
  assert.equal(f.objects.length, 2);
  assert.equal(area.context.template.eventMode, "none");
  assert.deepEqual(area.context.area, {
    center: { x: 500, y: 100 },
    diameter: 800,
  });
  area.cleanup();
  area.cleanup();
  assert.deepEqual(f.objects, [existing]);
  assert.equal(f.destroyed.length, 1);
});
test("failed template drawing removes partial local footprint", async () => {
  const f = fixture({ fail: true });
  await assert.rejects(
    () =>
      createCanvasPreviewArea(
        { stages: [{ kind: "template" }] },
        context,
        f.host,
      ),
    /draw failed/,
  );
  assert.equal(f.objects.length, 0);
  assert.equal(f.destroyed.length, 1);
});
test("line preview preserves selected origin, endpoint and width, then removes its own footprint", async () => {
  const selected = {
    type: "line",
    center: { x: 300, y: 400 },
    endpoint: { x: 300, y: 1000 },
    length: 600,
    width: 200,
  };
  const recipe = {
    previewArea: { type: "line", value: 120 },
    stages: [{ kind: "template" }],
  };
  const data = previewTemplateData(
    recipe,
    { ...context, area: selected },
    options,
  );
  assert.deepEqual(
    [data.t, data.x, data.y, data.distance, data.direction, data.width],
    ["ray", 300, 400, 30, 90, 10],
  );
  const f = fixture();
  const preview = await createCanvasPreviewArea(
    recipe,
    { ...context, area: selected },
    f.host,
  );
  assert.equal(preview.context.area.type, "line");
  assert.deepEqual(preview.context.area.center, selected.center);
  assert.ok(
    Math.abs(preview.context.area.endpoint.x - selected.endpoint.x) < 1e-8,
  );
  assert.equal(preview.context.area.endpoint.y, 1000);
  assert.equal(preview.context.area.width, 200);
  preview.cleanup();
  assert.equal(f.objects.length, 0);
});
test("native rectangular PF2e Regions resolve line endpoints without accepting arbitrary polygons", () => {
  const opts = { source: context.source, spec: { type: "line" } };
  const region = {
    documentName: "Region",
    shapes: [
      { type: "polygon", points: [100, 50, 700, 50, 700, 150, 100, 150] },
    ],
  };
  assert.deepEqual(templateArea(region, opts), {
    type: "line",
    center: { x: 100, y: 100 },
    endpoint: { x: 700, y: 100 },
    length: 600,
    width: 100,
  });
  assert.equal(
    templateArea(
      {
        ...region,
        shapes: [
          { type: "polygon", points: [100, 50, 700, 70, 700, 150, 100, 150] },
        ],
      },
      opts,
    ),
    null,
  );
  assert.equal(
    templateArea(
      { ...region, shapes: [...region.shapes, ...region.shapes] },
      opts,
    ),
    null,
  );
  assert.equal(templateArea(region, { ...opts, spec: { type: "cone" } }), null);
  assert.equal(templateArea({ t: "ray", distance: -1 }), null);
});

test("native square spell Regions keep their center and side in private preview", async () => {
  const square = {
    documentName: "Region",
    shapes: [
      { type: "polygon", points: [450, 50, 550, 50, 550, 150, 450, 150] },
    ],
  };
  const area = templateArea(square, { ...options, spec: { type: "square" } });
  assert.deepEqual(area, {
    type: "square",
    center: { x: 500, y: 100 },
    diameter: 100,
    width: 100,
  });
  assert.deepEqual(
    templateArea(
      {
        documentName: "Region",
        shapes: [
          {
            type: "rectangle",
            x: 450,
            y: 50,
            width: 100,
            height: 100,
            rotation: 0,
          },
        ],
      },
      { ...options, spec: { type: "square" } },
    ),
    area,
  );
  const recipe = spellRecipe(PF2E_SPELLS.find((s) => s.name === "Force Rain"));
  const data = previewTemplateData(recipe, { ...context, area }, options);
  assert.deepEqual(
    [data.t, data.x, data.y, data.distance],
    ["rect", 450, 50, 5 * Math.SQRT2],
  );
  const f = fixture();
  const preview = await createCanvasPreviewArea(
    recipe,
    { ...context, area },
    f.host,
  );
  assert.deepEqual(preview.context.area, area);
  preview.cleanup();
  assert.equal(f.objects.length, 0);
  assert.equal(
    templateArea(
      {
        ...square,
        shapes: [
          { type: "polygon", points: [450, 50, 650, 50, 650, 150, 450, 150] },
        ],
      },
      { ...options, spec: { type: "square" } },
    ),
    null,
  );
});
