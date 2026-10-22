// Hashes of Sequencer's animation engine methods, as the installed bundle ships them, for
// SEQUENCER_ENGINE_HASHES in scripts/integrations/sequencer-turbo/engine.mjs.
// `node tools/hash-sequencer-engine.mjs [path/to/sequencer/dist/sequencer.js]`
// A method's toString() in the browser is its exact source text, from its name to its closing brace.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { ENGINE_METHODS, hashSource } from '../scripts/integrations/sequencer-turbo/engine.mjs';

const bundle = process.argv[2] ?? fileURLToPath(new URL('../../sequencer/dist/sequencer.js', import.meta.url));
const source = readFileSync(bundle, 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });

let engine = null;
for (const node of ast.body) {
  if (node.type !== 'VariableDeclaration') continue;
  for (const d of node.declarations)
    if (d.id.name === 'SequencerAnimationEngine' && d.init?.type === 'ObjectExpression') engine = d.init;
}
if (!engine) throw Error(`No SequencerAnimationEngine object in ${bundle}`);

const hashes = {};
for (const name of ENGINE_METHODS) {
  const prop = engine.properties.find((p) => p.method && p.key?.name === name);
  if (!prop) throw Error(`SequencerAnimationEngine.${name} not found`);
  hashes[name] = hashSource(source.slice(prop.start, prop.end));
}
console.log(JSON.stringify(hashes, null, 2));
