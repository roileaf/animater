// Lists the files Foundry actually loads: module.json, its esmodules/styles and
// everything they reach through static or dynamic imports, new URL(..., import.meta.url), CSS url()s and
// literal module paths. Audits, docs, tests, tools and previews never ship.
// Usage: node tools/release-files.mjs | zip -@ module.zip
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTRA = ['module.json', 'README.md', 'CHANGELOG.md', 'LICENSE'];

export function releaseFiles(root = ROOT) {
  const read = rel => readFileSync(path.join(root, rel), 'utf8');
  const manifest = JSON.parse(read('module.json'));
  const queue = [...(manifest.esmodules ?? []), ...(manifest.scripts ?? []), ...(manifest.styles ?? []), ...(manifest.languages ?? []).map(l => l.path)];
  const seen = new Set(), missing = [];
  while (queue.length) {
    const rel = path.posix.normalize(queue.shift());
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!existsSync(path.join(root, rel))) { missing.push(rel); continue; }
    if (!/\.(mjs|js|css)$/.test(rel)) continue;
    const source = read(rel), dir = path.posix.dirname(rel);
    for (const m of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(path.posix.join(dir, m[1]));
    for (const m of source.matchAll(/url\(\s*['"]?(\.{1,2}\/[^'")]+)/g)) queue.push(path.posix.join(dir, m[1]));
    // Workers and other files a module reaches as new URL('./file.mjs', import.meta.url).
    for (const m of source.matchAll(/new\s+URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url/g)) queue.push(path.posix.join(dir, m[1]));
    for (const m of source.matchAll(/modules\/animater\/((?:scripts|styles|templates|data|lang|assets|sounds)\/[\w./-]+\.\w+)/g)) queue.push(m[1]);
  }
  if (missing.length) throw Error(`Runtime references missing files: ${missing.join(', ')}`);
  // Sound registries assemble paths from family names and recording IDs. Those
  // paths cannot be discovered by the literal-import scan above. Ship finished
  // bundled recordings and their attribution, leaving review/source data local.
  const bundledSounds = rel => {
    if (!existsSync(path.join(root, rel))) return;
    for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const file = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) bundledSounds(file);
      else if (entry.isFile() && (/\.(ogg|mp3|wav)$/i.test(entry.name) || /^license\.txt$/i.test(entry.name))) seen.add(file);
    }
  };
  bundledSounds('assets/sounds');
  return [...EXTRA.filter(f => existsSync(path.join(root, f))), ...[...seen].filter(f => f !== 'module.json').sort()];
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href) {
  try { console.log(releaseFiles().join('\n')); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
