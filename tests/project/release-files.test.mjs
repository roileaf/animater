import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { releaseFiles } from '../../tools/release-files.mjs';
import { gaitStepFiles, bodyStepFiles, FOOTSTEP_FILES, MOVE_SOUND_FILES, THUD_FILES } from '../../scripts/engines/motion/movement-feel.mjs';

test('release includes every bundled movement recording and its attribution', () => {
  const files = new Set(releaseFiles());
  const sounds = [...gaitStepFiles(), ...bodyStepFiles(), ...Object.values(FOOTSTEP_FILES).flat(), ...Object.values(MOVE_SOUND_FILES).flat(), ...THUD_FILES];
  for (const file of sounds.filter(f => f.startsWith('modules/animater/'))) {
    assert.ok(files.has(file.replace('modules/animater/', '')), `Missing release sound: ${file}`);
  }
  for (const folder of ['creatures/reviewed', 'creatures/completed', 'creatures/wood', 'surfaces/freesound', 'surfaces/kenney']) {
    assert.ok(files.has(`assets/sounds/${folder}/License.txt`), `Missing attribution: ${folder}`);
  }
});

test('bundled sound packaging excludes local catalogs, audit reports and source recordings', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'animater-release-'));
  try {
    mkdirSync(path.join(root, 'assets/sounds/creatures'), { recursive: true });
    writeFileSync(path.join(root, 'module.json'), JSON.stringify({ esmodules: [] }));
    for (const name of ['step.ogg', 'License.txt', 'catalog.json', 'audit.csv', 'README.md', 'source.flac']) {
      writeFileSync(path.join(root, 'assets/sounds/creatures', name), 'fixture');
    }
    const files = releaseFiles(root);
    assert.ok(files.includes('assets/sounds/creatures/step.ogg'));
    assert.ok(files.includes('assets/sounds/creatures/License.txt'));
    for (const name of ['catalog.json', 'audit.csv', 'README.md', 'source.flac']) {
      assert.ok(!files.includes(`assets/sounds/creatures/${name}`));
    }
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});
