import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { POLICY_URL, POLICY_REVISION, inspectJavaScript, publicationBlockers, runtimeInventory, writingCSV } from '../../tools/publication-audit.mjs';
import { checkPublication } from '../../tools/check-publication.mjs';
import { stageRelease } from '../../tools/build-release.mjs';

async function fixture(t) {
  const temporaryBase = await realpath(tmpdir());
  const root = await mkdtemp(path.join(temporaryBase, 'animater-publication-test-'));
  t.after(async () => {
    const resolved = await realpath(root), relative = path.relative(temporaryBase, resolved);
    if (resolved !== root || !path.isAbsolute(resolved) || !relative.startsWith('animater-publication-test-') || relative.includes(path.sep)) throw Error('Unsafe fixture cleanup path');
    await rm(resolved, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'scripts'));
  await mkdir(path.join(root, 'styles'));
  await mkdir(path.join(root, 'templates'));
  await mkdir(path.join(root, 'publication'));
  const manifest = { id: 'animater', version: '1.0.0', title: 'Animater', description: 'Test fixture',
    esmodules: ['scripts/main.mjs'], styles: ['styles/test.css'],
    url: 'https://example.org/source', manifest: 'https://example.org/module.json', download: 'https://example.org/module.zip' };
  await writeFile(path.join(root, 'module.json'), JSON.stringify(manifest));
  await writeFile(path.join(root, 'scripts/main.mjs'), 'import "./child.mjs"; export const template = "modules/animater/templates/workspace.hbs"; export const message = "Ready";');
  await writeFile(path.join(root, 'scripts/child.mjs'), 'export const label = "Test child";');
  await writeFile(path.join(root, 'styles/test.css'), 'div { color: red; }');
  await writeFile(path.join(root, 'templates/workspace.hbs'), '<div></div>');
  await writeFile(path.join(root, 'LICENSE.txt'), 'Test license fixture');
  const inventory = await runtimeInventory(root, ['LICENSE.txt']);
  // These are fabricated assertions for exercising the gate, never provenance
  // records for Animater or claims about the authorship of fixture strings.
  const provenance = { schemaVersion: 1, policyUrl: POLICY_URL, policyRevision: POLICY_REVISION,
    licenseFile: 'LICENSE.txt', zeroAI: false,
    files: inventory.files.map(f => ({ path: f.path, sha256: f.sha256, origin: 'human-authored', author: 'Fixture', evidence: 'Fixture evidence' })),
    maintainer: { name: 'Fixture', understandsAndCanMaintainAllCode: true, codeDigest: inventory.codeDigest, attestedAt: '2026-10-07' },
    marketing: { origin: 'human-authored', author: 'Fixture', description: manifest.description, evidence: 'Fixture evidence' },
    thirdParty: ['foundry-core', 'pf2e', 'dnd5e', 'JB2A_DnD5e', 'jb2a_patreon', 'ggg', 'psfx', 'soundfxlibrary', 'pf2e-creature-sounds'].map(id => ({
      id, humanMade: true, author: 'Fixture', source: 'https://example.org/', licenseEvidence: 'Fixture', authorshipEvidence: 'Fixture', aiContextRightsEvidence: 'Fixture',
    })),
  };
  const save = () => writeFile(path.join(root, 'publication/provenance.json'), JSON.stringify(provenance));
  await save();
  return { root, inventory, provenance, save };
}

test('runtime inventory follows imports and templates, excluding development artifacts', async t => {
  const { root, inventory } = await fixture(t);
  await mkdir(path.join(root, '.cache'));
  await writeFile(path.join(root, '.cache/private.txt'), 'private');
  assert.deepEqual(inventory.files.map(f => f.path).sort(), ['LICENSE.txt', 'module.json', 'scripts/child.mjs', 'scripts/main.mjs', 'styles/test.css', 'templates/workspace.hbs'].sort());
  assert.ok(inventory.text.some(row => row.text === 'Ready'));
});
test('scanner captures template UI, stage labels and prose without executing source', () => {
  const result = inspectJavaScript('throw Error("never execute"); export const html = `<button aria-label="Play">Play</button>`; const s={label:"Cast flash",rationale:"Orb follows source"};', 'scripts/ui/workspace.mjs');
  assert.ok(result.candidates.some(c => c.category === 'prepared-prose'));
  assert.ok(result.candidates.some(c => c.sample.includes('Play')));
  assert.ok(result.candidates.some(c => c.field === 'label' && c.text === 'Cast flash'));
});
test('reviewing AI text cannot be asserted as human authorship', async t => {
  const { inventory, provenance } = await fixture(t);
  provenance.files[0].origin = 'AI-generated-human-reviewed';
  assert.ok(publicationBlockers(inventory, provenance).some(b => b.code === 'text-provenance'));
});
test('missing authorship fails closed', async t => {
  const { inventory, provenance } = await fixture(t);
  provenance.files = [];
  assert.equal(publicationBlockers(inventory, provenance).filter(b => b.code === 'text-provenance').length, inventory.files.length);
});
test('changed runtime text invalidates the file evidence and maintainer digest', async t => {
  const { root, provenance } = await fixture(t);
  await writeFile(path.join(root, 'scripts/child.mjs'), 'export const label = "Changed text";');
  const blockers = publicationBlockers(await runtimeInventory(root, ['LICENSE.txt']), provenance);
  assert.ok(blockers.some(b => b.code === 'text-provenance' && b.file === 'scripts/child.mjs'));
  assert.ok(blockers.some(b => b.code === 'maintainer-understanding'));
});
test('dependency activation and familiar names do not verify third-party media', async t => {
  const { inventory, provenance } = await fixture(t);
  provenance.thirdParty.find(r => r.id === 'psfx').humanMade = false;
  assert.ok(publicationBlockers(inventory, provenance).some(b => b.code === 'third-party-provenance' && b.id === 'psfx'));
  provenance.thirdParty.find(r => r.id === 'psfx').humanMade = 'false';
  assert.ok(publicationBlockers(inventory, provenance).some(b => b.code === 'third-party-provenance' && b.id === 'psfx'));
});
test('new catalog media dependencies cannot bypass provenance checks', async t => {
  const { inventory, provenance } = await fixture(t);
  inventory.externalReferences.push('modules/new-pack/clip.webm', 'https://assets.example.org/illustration.webp');
  const blockers = publicationBlockers(inventory, provenance);
  assert.ok(blockers.some(b => b.code === 'third-party-provenance' && b.id === 'new-pack'));
  assert.ok(blockers.some(b => b.code === 'third-party-provenance' && b.id === 'https://assets.example.org'));
});
test('source context permission must have evidence', async t => {
  const { inventory, provenance } = await fixture(t);
  provenance.thirdParty.find(r => r.id === 'pf2e').aiContextRightsEvidence = '';
  assert.ok(publicationBlockers(inventory, provenance).some(b => b.code === 'source-context-rights'));
});
test('marketing text and understanding attestation are independently required', async t => {
  const { inventory, provenance } = await fixture(t);
  provenance.marketing.origin = 'pending';
  provenance.maintainer.understandsAndCanMaintainAllCode = false;
  const blockers = publicationBlockers(inventory, provenance);
  assert.ok(blockers.some(b => b.code === 'marketing-authorship'));
  assert.ok(blockers.some(b => b.code === 'maintainer-understanding'));
});
test('manifest description cannot inherit evidence for different marketing copy', async t => {
  const { inventory, provenance } = await fixture(t);
  provenance.marketing.description = 'Other text';
  assert.ok(publicationBlockers(inventory, provenance).some(b => b.code === 'description-source-mismatch'));
});
test('bundled animation and absolute CSS artwork references enter the audited package', async t => {
  const { root, provenance } = await fixture(t);
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'assets/movie.webm'), 'fixture bytes');
  await writeFile(path.join(root, 'assets/background.webp'), 'fixture bytes');
  await writeFile(path.join(root, 'scripts/child.mjs'), 'export const film = "modules/animater/assets/movie.webm";');
  await writeFile(path.join(root, 'styles/test.css'), 'div { background: url(/modules/animater/assets/background.webp); }');
  const inventory = await runtimeInventory(root, ['LICENSE.txt']);
  assert.ok(inventory.files.some(f => f.path === 'assets/movie.webm' && f.kind === 'media'));
  assert.ok(inventory.files.some(f => f.path === 'assets/background.webp' && f.kind === 'media'));
  assert.equal(publicationBlockers(inventory, provenance).filter(b => b.code === 'media-provenance').length, 2);
});
test('AI-assisted project cannot claim Zero AI', async t => {
  const { inventory, provenance } = await fixture(t);
  provenance.zeroAI = true;
  assert.ok(publicationBlockers(inventory, provenance).some(b => b.code === 'invalid-zero-ai-claim'));
});
test('nonliteral imports and dynamic execution require further analysis', () => {
  const result = inspectJavaScript('import(path); new Function(code); eval(code);', 'scripts/example.mjs');
  assert.equal(result.findings.filter(f => f.code === 'dynamic-import').length, 1);
  assert.equal(result.findings.filter(f => f.code === 'runtime-code-execution').length, 2);
});
test('module dependency cannot escape root or include a development cache', async t => {
  const { root } = await fixture(t);
  await writeFile(path.join(root, 'scripts/main.mjs'), 'import "../.cache/hidden.mjs";');
  await assert.rejects(runtimeInventory(root), /Unsafe release dependency/);
  await writeFile(path.join(root, 'scripts/main.mjs'), 'import "../../outside.mjs";');
  await assert.rejects(runtimeInventory(root), /Unsafe release dependency/);
  await writeFile(path.join(root, 'scripts/main.mjs'), 'export const ready = true;');
  await assert.rejects(runtimeInventory(root, ['scripts/../.cache/hidden.mjs']), /Unsafe release dependency/);
});
test('writing worksheet preserves exact multiline text and leaves authorship empty', () => {
  const csv = writingCSV([{ id: 'a', file: 'scripts/x.mjs', locations: [2, 3], category: 'ui', field: 'label', text: 'Say "hello"\nNext' }]);
  assert.ok(csv.includes('"Say ""hello""\nNext"'));
  assert.ok(csv.includes('"","",""'));
});
test('writing worksheet prevents source text from becoming spreadsheet formulas', () => {
  const csv = writingCSV([{ id: 'a', file: 'scripts/x.mjs', locations: [2], category: 'ui', field: 'label', text: '=HYPERLINK("https://example.org")' }]);
  assert.ok(csv.includes('"\'=HYPERLINK('));
});
test('audit refresh never overwrites human authoring worksheet', async t => {
  const { root } = await fixture(t);
  await writeFile(path.join(root, 'publication/text-authoring.csv'), 'writer work');
  await checkPublication(root, { write: true });
  assert.equal(await readFile(path.join(root, 'publication/text-authoring.csv'), 'utf8'), 'writer work');
  assert.ok((await readFile(path.join(root, 'publication/text-authoring-current.csv'), 'utf8')).includes('current_text'));
});
test('blocked release creates no staging directory', async t => {
  const { root, provenance, save } = await fixture(t);
  provenance.files = [];
  await save();
  await assert.rejects(stageRelease(root), /Release blocked/);
  assert.ok(!(await readdir(root)).includes('dist'));
});
test('verified fixture stages precisely the reviewed runtime closure and license', async t => {
  const { root, inventory } = await fixture(t);
  await mkdir(path.join(root, '.cache'));
  await writeFile(path.join(root, '.cache/private.txt'), 'private');
  const stage = await stageRelease(root);
  for (const file of inventory.files) assert.deepEqual(await readFile(path.join(stage, file.path)), await readFile(path.join(root, file.path)));
  assert.ok(!(await readdir(stage)).includes('.cache'));
  assert.ok(!(await readdir(stage)).includes('publication'));
  await assert.rejects(stageRelease(root), /dist already exists/);
});
