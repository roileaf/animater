import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { starterRecipes } from "../scripts/core/presets.mjs";
import { orbRecipe, ORB_ELEMENTS } from "../scripts/catalogs/shared/orb-builder.mjs";
import { resolveAsset } from "../scripts/core/model.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
async function entries(source, initializer, exportName) {
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
  await mod[initializer]("modules");
  const catalog = [];
  const walk = (v, key) => {
    if (typeof v === "string") {
      if (v.endsWith(".webm")) catalog.push({ key, file: v });
      return;
    }
    if (Array.isArray(v)) {
      if (typeof v[0] === "string") walk(v[0], key);
      return;
    }
    if (!v || typeof v !== "object") return;
    const pairs = Object.entries(v).filter(([k]) => !k.startsWith("_"));
    if (pairs.some(([k]) => /^\d+ft$/.test(k))) {
      walk(v["15ft"] ?? pairs[0][1], key);
      return;
    }
    for (const [k, value] of pairs) walk(value, `${key}.${k}`);
  };
  walk(mod[exportName], "jb2a");
  return catalog.sort((a, b) => a.key.localeCompare(b.key));
}
const patreon = await entries(
  await readFile(
    resolve(root, "jb2a_patreon/scripts/jb2a_sequencer.js"),
    "utf8",
  ),
  "jb2aPatreonDatabase",
  "patreonDatabase",
);
const response = await fetch(
  "https://raw.githubusercontent.com/Jules-Bens-Aa/JB2A_DnD5e/main/scripts/jb2a_sequencer.js",
);
if (!response.ok)
  throw Error(`Free database download failed: ${response.status}`);
const free = await entries(
  await response.text(),
  "jb2aFreeDatabase",
  "freeDatabase",
);
let failed = false;
for (const [label, catalog] of [
  ["Patreon installed", patreon],
  ["Free official current", free],
]) {
  console.log(`${label}: ${catalog.length} variants`);
  for (const recipe of [
    ...starterRecipes(),
    ...Object.keys(ORB_ELEMENTS).map((element) =>
      orbRecipe({ element }, "orb", catalog),
    ),
  ]) {
    const missing = recipe.stages.filter(
      (s) => s.kind !== "motion" && !resolveAsset(s, catalog),
    );
    console.log(
      `  ${missing.length ? "MISSING" : "OK"} ${recipe.name}${missing.length ? `: ${missing.map((s) => s.assets.join(" | ")).join("; ")}` : ""}`,
    );
    if (missing.length) failed = true;
    if (recipe.id === "orb" && recipe.name.endsWith("Fire"))
      console.log(
        `    orb media: ${recipe.stages.map((s) => resolveAsset(s, catalog)).join(" | ")}`,
      );
  }
}
if (failed) process.exitCode = 1;
