import test from "node:test";
import assert from "node:assert/strict";
import { finishersPageHTML, finisherGlyphSVG } from "../../../scripts/ui/finisher-ui.mjs";
import { studioContextMenu } from "../../../scripts/ui/studio.mjs";
import { FINISHER_PRESETS } from "../../../scripts/engines/finishers/finisher-presets.mjs";
import { validateRecipe, normalizeFinisher } from "../../../scripts/core/model.mjs";

const CARD_SELECTOR = '.an-card[data-action="select"][data-id]';
const fin = (id) => ({ id, name: `Fin ${id}`, color: "#c0392b", match: "X", category: "Finisher", trigger: "manual", enabled: true, finisher: normalizeFinisher({}), stages: [] });
const pageOf = (recipes) => finishersPageHTML({ studio: false, listedRecipes: () => recipes, host: { recipes: () => recipes, defaultFinisher: () => "", players: () => [] } });
// Does an element's opening tag match the context-menu selector (class an-card + data-action=select + data-id)?
const matchesCardSelector = (tag) => /class="[^"]*\ban-card\b/.test(tag) && /data-action="select"/.test(tag) && /data-id="[^"]+"/.test(tag);

test("a finisher card matches the context-menu card selector", () => {
  const html = pageOf([fin("a")]);
  const article = html.match(/<article[^>]*>/)[0];
  assert.ok(matchesCardSelector(article), article);
  assert.match(article, /data-id="a"/);
  // The Edit / Duplicate buttons keep their own actions (closest("[data-action]") finds them first).
  assert.match(html, /data-action="recipe-menu-duplicate" data-id="a" class="an-fcard-quick"/);
  assert.match(html, /<button type="button" data-action="select" data-id="a" class="an-fcard-open"/);
});

test("studioContextMenu opens the recipe card menu for a finisher card", () => {
  const html = pageOf([fin("a")]);
  const article = html.match(/<article[^>]*>/)[0];
  const card = { dataset: { id: "a" } };
  const menus = [];
  const saved = globalThis.document;
  globalThis.document = { createElement: () => ({ style: {}, setAttribute() {}, offsetParent: null, querySelector: () => null }) };
  Object.defineProperty(globalThis.document, "body", { value: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) } });
  try {
    const w = { busy: false, listedRecipes: () => [fin("a")], host: { recipes: () => [] }, root: { querySelector: () => null, append: (m) => menus.push(m) } };
    let prevented = false;
    const e = { clientX: 10, clientY: 10, preventDefault() { prevented = true; }, target: { closest: (sel) => (sel === CARD_SELECTOR && matchesCardSelector(article) ? card : null) } };
    studioContextMenu(w, e);
    assert.equal(menus.length, 1);
    assert.ok(prevented);
    assert.match(menus[0].innerHTML, /recipe-menu-open[^>]*data-id="a"/);
    assert.match(menus[0].innerHTML, /recipe-menu-delete/);
  } finally { globalThis.document = saved; }
});

test("the real Slice in half preset, saved as a copy, renders a visible glyph on its card and tile", () => {
  const saved = validateRecipe({ ...FINISHER_PRESETS["slice-in-half"].build(), id: "slice-copy" });
  const html = pageOf([saved]);
  const art = html.match(/<div class="an-art an-fcard-art">(<svg[\s\S]*?<\/svg>)/)?.[1];
  assert.ok(art, "card art has an svg");
  const pieces = art.match(/<polygon class="an-glyph-piece"[^>]*>/g) ?? [];
  assert.ok(pieces.length >= 2, "both halves drawn");
  for (const p of pieces) {
    assert.match(p, /points="[^"]*\d/);
    // Visible even when the stylesheet misses: explicit fill and a light outline, not the bare default.
    assert.match(p, /fill="[^"]+"/);
    assert.match(p, /stroke="[^"]+"/);
  }
  assert.match(art, /an-glyph-ghost/, "a faint whole-token outline stays behind while the halves fly");
  const tile = html.match(/data-preset="slice-in-half"[^>]*>(<svg[\s\S]*?<\/svg>)/)?.[1];
  assert.match(tile ?? "", /an-glyph-piece/);
});

test("the halves never fade out completely in the animation", () => {
  const svg = finisherGlyphSVG(validateRecipe({ ...FINISHER_PRESETS["slice-in-half"].build(), id: "s" }), { live: true });
  assert.match(svg, /<animate attributeName="opacity"/);
  for (const m of svg.matchAll(/<animate attributeName="opacity" values="([^"]+)"/g)) assert.ok(Math.min(...m[1].split(";").map(Number)) >= 0.2, m[1]);
});
