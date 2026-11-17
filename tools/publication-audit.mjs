import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';

export const POLICY_URL = 'https://foundryvtt.com/article/ai-policy/';
export const POLICY_REVISION = '2026-03-18';
export const MODULE_ROOT = path.resolve(import.meta.dirname, '..');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const forbidden = /^(?:\.cache|node_modules|tools|tests|preview|docs|publication|dist)(?:\/|$)/;
const mediaExtension = /\.(?:png|jpe?g|webp|gif|avif|webm|mp4|mp3|ogg|wav|flac|m4a|svg|woff2?|ttf)$/i;
export const TEXT_ORIGINS = new Set(['human-authored', 'licensed-human-source', 'human-and-licensed-source', 'no-prepared-text']);

function walk(node, visit, parents = []) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node, parents);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end'].includes(key)) continue;
    if (Array.isArray(value)) for (const child of value) walk(child, visit, [...parents, node]);
    else if (value && typeof value === 'object') walk(value, visit, [...parents, node]);
  }
}

const propertyName = (node, parents) => {
  const property = [...parents].reverse().find(p => p.type === 'Property' && p.value !== undefined);
  return property?.key?.name ?? property?.key?.value ?? '';
};
const proseFields = new Set(['rationale', 'notes', 'evidence', 'visualDirection', 'artLimit', 'note', 'description']);
const sourceFields = new Set(['name', 'publication', 'sourceBook', 'plainDescription', 'descriptionText', 'descriptionHtml', 'requirements']);
function textSample(value) {
  const attributes = [...value.matchAll(/(?:aria-label|title|placeholder|alt)\s*=\s*["']([^"']*)["']/gi)].map(m => m[1]);
  return [...attributes, value.replace(/<[^>]*>/g, ' ')].join(' ').replace(/\s+/g, ' ').trim();
}
function textCandidate(value) {
  if (!value || !/[\p{L}]/u.test(value)) return false;
  // Machine references are preserved in the file inventory, even when omitted
  // from the writing worksheet. This heuristic never approves file provenance.
  if (/^(?:https?:|data:|Compendium\.|jb2a\.|(?:modules|systems|icons)\/|\.\.?\/|#[a-f\d]{3,8}$)/i.test(value)) return false;
  if (/^[a-f\d]{32,}$/i.test(value) || /^[a-zA-Z\d]{16}$/.test(value)) return false;
  if (/^\.[\w-]+(?:\s|\[|[.#:])?/.test(value) || /^\[(?:data-|name=)/.test(value)) return false;
  if (/^(?:an-|data-)[\w-]+$/.test(value)) return false;
  return /[\p{L}]/u.test(textSample(value));
}

export function inspectJavaScript(source, file) {
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const imports = [], references = new Set(), candidates = [], findings = [];
  walk(tree, (node, parents) => {
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) imports.push(node.source.value);
    if (node.type === 'ImportExpression') {
      if (node.source.type === 'Literal' && typeof node.source.value === 'string') imports.push(node.source.value);
      else findings.push({ code: 'dynamic-import', file, line: node.loc.start.line });
    }
    if (node.type === 'CallExpression' && node.callee?.name === 'eval' || node.type === 'NewExpression' && node.callee?.name === 'Function') findings.push({ code: 'runtime-code-execution', file, line: node.loc.start.line });
    const value = node.type === 'Literal' && typeof node.value === 'string' ? node.value : node.type === 'TemplateElement' ? node.value.cooked ?? node.value.raw : null;
    if (value === null) return;
    for (const match of value.matchAll(/modules\/animater\/([\w./-]+\.(?:hbs|json|[cm]?js|css|png|jpe?g|webp|gif|avif|svg|webm|mp4|mp3|ogg|wav|flac|m4a|woff2?|ttf))/g)) references.add(match[1]);
    const parent = parents.at(-1);
    if (parent?.source === node || parent?.key === node && !parent.computed) return;
    if (!textCandidate(value)) return;
    const field = propertyName(node, parents);
    candidates.push({ text: value, sample: textSample(value), field, line: node.loc.start.line,
      category: proseFields.has(field) ? 'prepared-prose' : sourceFields.has(field) && file.startsWith('data/') ? 'source-text-or-name' : /(?:-ui|workspace|main)\.mjs$/.test(file) ? 'ui-or-message' : 'string-needs-classification' });
  });
  return { imports, references: [...references], candidates, findings };
}

function inspectJSON(value, field = '', location = '', rows = []) {
  if (typeof value === 'string' && textCandidate(value)) rows.push({ text: value, sample: textSample(value), field, location,
    category: proseFields.has(field) ? 'prepared-prose' : 'metadata-needs-classification' });
  else if (Array.isArray(value)) value.forEach((v, i) => inspectJSON(v, field, `${location}/${i}`, rows));
  else if (value && typeof value === 'object') for (const [key, next] of Object.entries(value)) inspectJSON(next, key, `${location}/${key}`, rows);
  return rows;
}

export async function runtimeInventory(root = MODULE_ROOT, extras = []) {
  root = await realpath(root);
  const manifest = JSON.parse(await readFile(path.join(root, 'module.json'), 'utf8'));
  const pending = ['module.json', ...(manifest.esmodules ?? []), ...(manifest.scripts ?? []), ...(manifest.styles ?? []),
    ...(manifest.languages ?? []).map(l => l.path), ...(manifest.packs ?? []).map(p => p.path), ...extras];
  const seen = new Set(), files = [], text = [], findings = [], externalReferences = new Set();
  while (pending.length) {
    const relative = slash(path.relative(root, path.resolve(root, pending.shift())));
    if (seen.has(relative)) continue;
    seen.add(relative);
    const filename = path.resolve(root, relative);
    if (!inside(root, filename) || forbidden.test(relative)) throw Error(`Unsafe release dependency: ${relative}`);
    const resolved = await realpath(filename);
    if (!inside(root, resolved)) throw Error(`Release dependency leaves module: ${relative}`);
    const info = await stat(resolved);
    if (info.isDirectory()) {
      for (const child of await readdir(resolved)) pending.push(`${relative}/${child}`);
      continue;
    }
    const buffer = await readFile(resolved), digest = sha256(buffer), source = buffer.toString('utf8');
    let candidates = [];
    if (/\.[cm]?js$/.test(relative)) {
      const inspected = inspectJavaScript(source, relative);
      findings.push(...inspected.findings);
      candidates = inspected.candidates;
      for (const specifier of inspected.imports) {
        if (!specifier.startsWith('.')) throw Error(`Unresolved release import in ${relative}: ${specifier}`);
        pending.push(slash(path.relative(root, path.resolve(path.dirname(filename), specifier))));
      }
      pending.push(...inspected.references);
    } else if (/\.json$/.test(relative)) candidates = inspectJSON(JSON.parse(source));
    else if (/\.(?:hbs|html|css|md|txt)$/.test(relative)) {
      candidates = [{ text: source, sample: textSample(source), category: 'document-or-template' }];
      if (/\.css$/.test(relative)) {
        for (const match of source.matchAll(/(?:url\(\s*["']?([^)'"\s]+)|@import\s+["']([^"']+))/g)) {
          const reference = match[1] ?? match[2];
          // A reference that is only a fragment names something inside the document, never a file: `filter: url(#n)`
          // and the same written `url(%23n)` inside a data URI, which is how an inline SVG points at its own filter.
          // Taken for a filename it sends the whole audit looking for a file called "#n" and the run dies there.
          if (/^(?:#|%23)/i.test(reference)) continue;
          if (reference.startsWith('/modules/animater/')) pending.push(reference.slice('/modules/animater/'.length).split(/[?#]/)[0]);
          else if (/^(?:data:|https?:|\/)/.test(reference)) externalReferences.add(reference);
          else pending.push(slash(path.relative(root, path.resolve(path.dirname(filename), reference.split(/[?#]/)[0]))));
        }
      }
    }
    // One worksheet entry for each distinct literal in a file; all locations
    // remain available. It deliberately includes some non-user-facing strings.
    const grouped = new Map();
    for (const candidate of candidates) {
      const id = sha256(`${relative}\0${candidate.text}`).slice(0, 24);
      if (!grouped.has(id)) grouped.set(id, { id, file: relative, fileSha256: digest, text: candidate.text, sample: candidate.sample, category: candidate.category, field: candidate.field ?? '', locations: [] });
      grouped.get(id).locations.push(candidate.line ?? candidate.location ?? 1);
    }
    text.push(...grouped.values());
    files.push({ path: relative, sha256: digest, bytes: buffer.length, kind: mediaExtension.test(relative) ? 'media' : 'code-or-data', textCandidates: grouped.size });
    for (const match of source.matchAll(/(?:https?:\/\/[^\s"'<>`]+|(?:modules|systems|icons)\/[\w./-]+\.(?:png|jpe?g|webp|svg|webm|mp4|ogg|mp3|wav|flac|m4a))/g)) externalReferences.add(match[0]);
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  text.sort((a, b) => a.file.localeCompare(b.file) || a.id.localeCompare(b.id));
  return { manifest, files, text, findings, externalReferences: [...externalReferences].sort(),
    codeDigest: sha256(files.map(f => `${f.path}\0${f.sha256}\n`).join('')) };
}

export function publicationBlockers(inventory, provenance) {
  const blockers = [], records = new Map();
  if (provenance.schemaVersion !== 1 || provenance.policyRevision !== POLICY_REVISION || provenance.policyUrl !== POLICY_URL) blockers.push({ code: 'policy-record' });
  for (const record of provenance.files ?? []) {
    if (records.has(record.path)) blockers.push({ code: 'duplicate-provenance', file: record.path });
    records.set(record.path, record);
  }
  for (const file of inventory.files) {
    const record = records.get(file.path);
    if (!record || record.sha256 !== file.sha256 || !TEXT_ORIGINS.has(record.origin) || !record.author?.trim() || !record.evidence?.trim()) blockers.push({ code: 'text-provenance', file: file.path });
    if (file.kind === 'media' && (record?.humanMade !== true || !record?.licenseEvidence?.trim())) blockers.push({ code: 'media-provenance', file: file.path });
  }
  for (const finding of inventory.findings) blockers.push(finding);
  // External catalog media is prepared content too. Installed dependency status
  // and a familiar pack name do not establish authorship or licensing.
  const dependencyIds = new Set(['foundry-core', 'pf2e', 'dnd5e', 'JB2A_DnD5e', 'jb2a_patreon', 'ggg', 'psfx', 'soundfxlibrary', 'pf2e-creature-sounds']);
  for (const reference of inventory.externalReferences) {
    const id = reference.match(/^(?:modules|systems)\/([^/]+)\//)?.[1];
    if (id && id !== 'animater') dependencyIds.add(id);
    if (/^https?:/.test(reference) && /\.(?:png|jpe?g|webp|svg|webm|mp4|ogg|mp3|wav|flac|m4a)(?:[?#]|$)/i.test(reference)) dependencyIds.add(new URL(reference).origin);
  }
  for (const id of dependencyIds) {
    const record = provenance.thirdParty?.find(r => r.id === id);
    if (record?.humanMade !== true || !record.author?.trim() || !record.source?.trim() || !record.licenseEvidence?.trim() || !record.authorshipEvidence?.trim()) blockers.push({ code: 'third-party-provenance', id });
    if (['pf2e', 'dnd5e'].includes(id) && !record?.aiContextRightsEvidence?.trim()) blockers.push({ code: 'source-context-rights', id });
  }
  const maintainer = provenance.maintainer;
  if (!maintainer?.name?.trim() || maintainer.understandsAndCanMaintainAllCode !== true || maintainer.codeDigest !== inventory.codeDigest || !maintainer.attestedAt || Number.isNaN(Date.parse(maintainer.attestedAt))) blockers.push({ code: 'maintainer-understanding' });
  const manifest = inventory.manifest;
  if (!manifest.description?.trim()) blockers.push({ code: 'manifest-description' });
  for (const field of ['url', 'manifest', 'download']) {
    try { if (new URL(manifest[field]).protocol !== 'https:') throw Error(); }
    catch { blockers.push({ code: 'release-url', field }); }
  }
  if (!provenance.licenseFile || !inventory.files.some(f => f.path === provenance.licenseFile)) blockers.push({ code: 'package-license' });
  // Website copy must also be human-written. No AI-written default is supplied.
  if (provenance.marketing?.origin !== 'human-authored' || !provenance.marketing.author?.trim() || !provenance.marketing.description?.trim() || !provenance.marketing.evidence?.trim()) blockers.push({ code: 'marketing-authorship' });
  if (provenance.marketing?.description !== manifest.description) blockers.push({ code: 'description-source-mismatch' });
  if (provenance.zeroAI === true) blockers.push({ code: 'invalid-zero-ai-claim' });
  return blockers;
}

export function writingCSV(rows) {
  const cell = value => {
    const text = String(value ?? '');
    // Quoting alone does not prevent spreadsheets from evaluating a formula.
    // The JSON inventory retains unmodified text for exact source comparison.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [['id', 'file', 'locations', 'category', 'field', 'current_text', 'human_authored_replacement', 'human_author', 'source_or_authorship_evidence'],
    ...rows.map(r => [r.id, r.file, r.locations.join(';'), r.category, r.field, r.text, '', '', ''])].map(row => row.map(cell).join(',')).join('\n') + '\n';
}
