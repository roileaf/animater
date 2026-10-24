// How much of every installed PF2e bestiary animates: each NPC's Strikes, abilities and spells,
// resolved the way play resolves them (catalogs on, no saved recipes). Reads the Actor and Adventure
// packs of the pf2e system and every installed module, copied first so a running Foundry keeps its locks.
//
//   node tools/audit-npc-coverage.mjs [--data <Foundry Data>] [--foundry <Foundry resources/app>] [--write] [--fixture]
//
// --write    saves the summary and top misses of the pf2e system's own packs to data/npc-coverage-audit.json
// --fixture  saves the most common Strikes, abilities and spells to tests/fixtures/npc-coverage.json
//            (names, traits, damage types and compendium links only) from the pf2e system's own packs, which are
//            open game data; paid modules stay out of the repo. tests/project/npc-coverage.test.mjs checks it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { twoeCatalogRecipe } from '../scripts/systems/twoe-crossover.mjs';
import { findCatalogSpell } from '../scripts/catalogs/pf2e/spells/spell-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const DATA = arg('--data', path.resolve(root, '../..'));
const APP = arg('--foundry', process.env.FOUNDRY_APP ?? 'C:/Program Files/Foundry Virtual Tabletop/resources/app');

// The Actor and Adventure packs every manifest declares.
function actorPacks() {
  const manifests = [path.join(DATA, 'systems/pf2e/system.json'),
    ...fs.readdirSync(path.join(DATA, 'modules')).map((m) => path.join(DATA, 'modules', m, 'module.json'))].filter((f) => fs.existsSync(f));
  return manifests.flatMap((file) => {
    let manifest; try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
    if (manifest.id !== 'pf2e' && !(manifest.relationships?.systems ?? manifest.systems ?? []).some?.((s) => (s.id ?? s) === 'pf2e')) return [];
    return (manifest.packs ?? []).filter((p) => ['Actor', 'Adventure'].includes(p.type ?? p.entity) && (!p.system || p.system === 'pf2e'))
      .map((p) => ({ name: `${manifest.id}.${p.name}`, dir: path.join(path.dirname(file), p.path.replace(/\.db$/, '')) })).filter((p) => fs.existsSync(p.dir));
  });
}

const ranged = (it) => Boolean(it.system?.range) || (it.system?.traits?.value ?? []).some((t) => /^range|^thrown/.test(t));
function rowOf(pack, actor, it) {
  if (actor?.type !== 'npc' || !['melee', 'action', 'spell'].includes(it.type)) return null;
  const text = it.system?.description?.value ?? '';
  return { pack, type: it.type, name: it.name, slug: it.system?.slug ?? null, actionType: it.system?.actionType?.value ?? null,
    traits: it.system?.traits?.value ?? [], source: it._stats?.compendiumSource ?? it.flags?.core?.sourceId ?? null, ranged: it.type === 'melee' && ranged(it),
    damageTypes: [...Object.values(it.system?.damageRolls ?? {}).map((r) => r.damageType),
      ...[...text.matchAll(/@Damage\[((?:[^[\]]|\[[^[\]]*\])*)\]/g)].flatMap((m) => m[1].match(/[a-z]+/g) ?? [])],
    template: text.match(/@Template\[(?:type:)?([a-z]+)/i)?.[1]?.toLowerCase() ?? null, hasDamage: /@Damage\[|\[\[\/r/.test(text) };
}
async function readPacks() {
  const require = createRequire(path.join(APP, 'main.js'));
  const { ClassicLevel } = require('classic-level');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'animater-npc-'));
  const rows = [];
  try {
    for (const pack of actorPacks()) {
      const copy = path.join(tmp, pack.name);
      fs.cpSync(pack.dir, copy, { recursive: true, filter: (f) => path.basename(f) !== 'LOCK' });
      const db = new ClassicLevel(copy, { keyEncoding: 'utf8', valueEncoding: 'json' });
      try { await db.open(); } catch { continue; }
      const actors = new Map(), items = [];
      for await (const [key, value] of db.iterator()) {
        if (key.startsWith('!actors!')) actors.set(value._id, value);
        else if (key.startsWith('!actors.items!')) items.push([key.split('!')[2].split('.')[0], value]);
        else if (key.startsWith('!adventures!')) for (const a of value.actors ?? []) for (const it of a.items ?? []) rows.push(rowOf(pack.name, a, it));
      }
      for (const [id, it] of items) rows.push(rowOf(pack.name, actors.get(id), it));
      await db.close();
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return rows.filter(Boolean);
}

// The item a row stands for, as play would see it.
export function itemOf(row) {
  const text = `${row.template ? `@Template[${row.template}] ` : ''}${row.hasDamage ? `@Damage[2d6[${row.damageTypes.find((t) => t !== 'persistent') ?? 'untyped'}]]` : ''}`;
  return { type: row.type, name: row.name, slug: row.slug, actor: { type: 'npc' }, sourceId: row.source, _stats: { compendiumSource: row.source },
    system: { slug: row.slug, traits: { value: row.traits }, description: { value: text },
      damageRolls: Object.fromEntries((row.type === 'melee' ? row.damageTypes : []).map((damageType, i) => [i, { damageType }])) } };
}
const ON = { enabled: true, scope: 'all', independent: true };
// Does play animate this row? An ability is tried as it is used and as its area is placed.
export function animates(row) {
  const item = itemOf(row), resolve = (type, extra = {}) => {
    try { return twoeCatalogRecipe('pf2e', { type, systemId: 'pf2e', item, actor: item.actor, ...extra }, [], { customEnabled: false, stateFor: () => ON }); } catch { return null; }
  };
  if (row.type === 'spell') return Boolean(findCatalogSpell({ type: 'use', item }));
  if (row.type === 'melee') return Boolean(resolve('attack', { weaponMode: row.ranged ? 'ranged' : 'melee' }));
  return Boolean(resolve('use') ?? resolve('template'));
}
export const kindOf = (row) => row.type === 'spell' ? 'spells' : row.type === 'melee' ? (row.ranged ? 'ranged strikes' : 'melee strikes')
  : row.actionType === 'passive' ? 'passive abilities' : row.hasDamage || row.template ? 'offensive abilities' : 'other active abilities';

function summarize(rows) {
  const kinds = {}, misses = {};
  for (const row of rows) {
    const kind = kindOf(row), k = kinds[kind] ??= { total: 0, animated: 0 };
    k.total++;
    if (kind === 'passive abilities') continue;
    if (animates(row)) k.animated++;
    else { const name = `${kind}: ${row.name.replace(/\s*\([^)]*\)/g, '')}`; misses[name] = (misses[name] ?? 0) + 1; }
  }
  for (const k of Object.values(kinds)) k.percent = Number((100 * k.animated / k.total).toFixed(1));
  return { kinds, misses: Object.entries(misses).sort((a, b) => b[1] - a[1]).slice(0, 150) };
}
// The most common distinct rows of each kind, with how often each appears.
function fixtureOf(rows) {
  const keep = { 'melee strikes': 400, 'ranged strikes': 200, 'offensive abilities': 400, 'other active abilities': 300, spells: 300 };
  const out = {};
  for (const [kind, limit] of Object.entries(keep)) {
    const seen = new Map();
    for (const row of rows.filter((r) => kindOf(r) === kind)) {
      const { pack, ...rest } = row, key = JSON.stringify(rest);
      seen.set(key, { ...rest, count: (seen.get(key)?.count ?? 0) + 1 });
    }
    out[kind] = [...seen.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rows = await readPacks();
  const { kinds, misses } = summarize(rows);
  console.log(`${rows.length} NPC items in ${new Set(rows.map((r) => r.pack)).size} packs`);
  for (const [kind, k] of Object.entries(kinds)) console.log(`${kind.padEnd(22)} ${String(k.animated).padStart(6)} / ${String(k.total).padEnd(6)} ${kind === 'passive abilities' ? '(not animated)' : `${k.percent}%`}`);
  console.log('Most common misses:', misses.slice(0, 40).map(([n, c]) => `${n} ×${c}`).join(', '));
  // What is saved in the repo comes from the pf2e system's own packs only (open game data).
  const open = rows.filter((r) => r.pack.startsWith('pf2e.'));
  if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, 'data/npc-coverage-audit.json'), `${JSON.stringify(summarize(open), null, 1)}\n`);
  if (process.argv.includes('--fixture')) { fs.mkdirSync(path.join(root, 'tests/fixtures'), { recursive: true }); fs.writeFileSync(path.join(root, 'tests/fixtures/npc-coverage.json'), `${JSON.stringify(fixtureOf(open))}\n`); }
}
