import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { WINDOW_SETTING_KEYS } from '../../scripts/ui/settings-window.mjs';

// Configure Settings > Animater is a flat list in registration order: a GM scrolling it has no grouping, no search and
// no sign of which of two settings is theirs and which is their players'. The Animater settings window is that list
// done properly, and main.mjs hides from Foundry's own list every setting the window edits (WINDOW_SETTING_KEYS).
// A setting registered with `config: true` and no row in the window falls through that sweep and lands back on the
// pile — which is how twenty-three of them had quietly gathered there. This keeps the pile at nothing: give a new
// setting a row, or register it `config: false` and read it some other way.
const root = new URL('../../scripts/', import.meta.url);
const sources = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const at = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) walk(at);
    else if (entry.name.endsWith('.mjs')) sources.push([at, readFileSync(at, 'utf8')]);
  }
})(root);

// The registration's own object, from the key to the call's closing bracket: `config` is read from that object alone,
// never from a later call's.
function registrations(source) {
  const found = [];
  const call = /(?:registerSetting|settings\.register)\(\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?['"`]([A-Za-z0-9_]+)['"`]\s*,/g;
  let match;
  while ((match = call.exec(source))) {
    let i = call.lastIndex, depth = 0;
    const start = i;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' && depth === 0) break;
      else if (c === ')' || c === '}' || c === ']') depth--;
    }
    found.push([match[1], source.slice(start, i)]);
  }
  return found;
}

test('every setting Foundry would list has a row in the Animater settings window', () => {
  const window = new Set(WINDOW_SETTING_KEYS);
  const stranded = [];
  for (const [at, source] of sources)
    for (const [key, body] of registrations(source))
      if (/config\s*:\s*true/.test(body) && !window.has(key)) stranded.push(`${key} (${at.pathname.split('/scripts/')[1]})`);
  assert.deepEqual(stranded, [], `left in Configure Settings with nowhere else to be set: ${stranded.join(', ')}`);
});

test('the animation quality is the one setting kept in Foundry’s own list', () => {
  // It is asked for before the window can be opened (a slow screen turns it down), so the sweep steps over it.
  const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /for \(const key of WINDOW_SETTING_KEYS\)[\s\S]{0,200}key === "quality" \? null :/);
  assert.ok(WINDOW_SETTING_KEYS.includes('quality'), 'and it still has its row in the window');
});
