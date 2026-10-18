// Loaded by tools/build.mjs with `node --import ./tools/build-trace.mjs <builder>`.
// Records which bespoke registry entries a builder reads, so editing one design
// file only rebuilds the catalogs that actually consult its entries.
//
// The BESPOKE export of scripts/catalogs/bespoke/index.mjs is replaced by a frozen
// object with the same keys in the same order whose properties are getters for
// the original values. Reads (BESPOKE[key], Object.entries, spreads, JSON) go
// through a getter and are recorded; key enumeration (Object.keys, `in`) is not
// a read of any design and is covered by the build's key-set hash instead.
import { registerHooks } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const INDEX = new URL("../scripts/catalogs/bespoke/index.mjs", import.meta.url).href;
const SELF = import.meta.url;
const accessed = new Set();
let traced = false;

if (process.env.ANIMATER_BUILD_TRACE) {
  registerHooks({
    load(url, context, nextLoad) {
      if (url !== INDEX) return nextLoad(url, context);
      const original = JSON.stringify(`${INDEX}?untraced`);
      return {
        format: "module",
        shortCircuit: true,
        source: `export * from ${original};\nimport { BESPOKE as original } from ${original};\nimport { traceRegistry } from ${JSON.stringify(SELF)};\nexport const BESPOKE = traceRegistry(original);\n`,
      };
    },
  });
  process.once("exit", () => {
    try { writeFileSync(process.env.ANIMATER_BUILD_TRACE, JSON.stringify({ traced, keys: [...accessed].sort() })); } catch {}
  });
}

export function traceRegistry(original) {
  traced = true;
  const shadow = {};
  for (const key of Reflect.ownKeys(original)) {
    const { enumerable } = Object.getOwnPropertyDescriptor(original, key);
    Object.defineProperty(shadow, key, { enumerable, configurable: false, get() { if (typeof key === "string") accessed.add(key); return original[key]; } });
  }
  return Object.isFrozen(original) ? Object.freeze(shadow) : shadow;
}

export const bespokeIndexPath = fileURLToPath(INDEX);
