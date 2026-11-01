import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// Foundry fires these with Hooks.call, not Hooks.callAll: a listener returning false stops every listener after it.
// (Foundry v14's client; the pre* hooks are left out, where a false is how a listener vetoes on purpose.) Reverb's
// `() => reverb.ready()` returned false until audio was unlocked, so right after a reload every later canvasReady
// listener — the lasting effects' redraw among them — was skipped. Animater's listeners on these hooks have a block
// body, so they never hand a value back by accident.
const CALLED = new Set(['activateNote', 'applyActiveEffect', 'canvasReady', 'chatBubble', 'chatBubbleHTML', 'chatMessage',
  'configureCanvasEnvironment', 'dealCards', 'dropActorSheetData', 'dropCanvasData', 'dropItemSheetData',
  'dropRollTableSheetData', 'hotReload', 'hotbarDrop', 'modifyTokenAttribute', 'passCards', 'returnCards']);

const root = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? files(join(dir, f.name)) : f.name.endsWith('.mjs') ? [join(dir, f.name)] : []));
// A listener that cannot return a value by accident: an arrow with a block body, or a function expression.
const blockBodied = (text) => /^(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>\s*\{/.test(text) || /^(?:async\s+)?function\b/.test(text);

test('listeners on hooks Foundry fires with Hooks.call never return a value by accident', () => {
  const offenders = [];
  for (const file of files(join(root, 'scripts'))) {
    const source = readFileSync(file, 'utf8'), at = relative(root, file);
    for (const m of source.matchAll(/Hooks\.(?:on|once)\(\s*["'`]([A-Za-z]+)["'`]\s*,\s*([^\n]{0,120})/g))
      if (CALLED.has(m[1]) && !blockBodied(m[2].trim())) offenders.push(`${at}: ${m[1]} → ${m[2].trim().slice(0, 60)}`);
    // Loops: for (const hook of ["canvasReady", …]) Hooks.on(hook, …)
    for (const m of source.matchAll(/for\s*\(const (\w+) of \[([^\]]*)\]\)\s*\{?\s*Hooks\.(?:on|once)\(\s*\1\s*,\s*([^\n]{0,120})/g)) {
      const hooks = [...m[2].matchAll(/["'`]([A-Za-z]+)["'`]/g)].map((x) => x[1]).filter((h) => CALLED.has(h));
      if (hooks.length && !blockBodied(m[3].trim())) offenders.push(`${at}: ${hooks.join(', ')} → ${m[3].trim().slice(0, 60)}`);
    }
  }
  assert.deepEqual(offenders, []);
});
