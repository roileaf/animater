import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLAST_TYPES } from '../../scripts/engines/motion/energy-blast.mjs';
import { energyBlastTargets } from '../../scripts/engines/props/prop-blast.mjs';
import { handBreaker } from '../../scripts/engines/props/prop-material.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const slice = (from, to) => {
  const at = main.indexOf(from);
  assert.ok(at > 0, from);
  const end = main.indexOf(to, at);
  assert.ok(end > at, to);
  return main.slice(at, end);
};

test('an energy blast breaks what it catches, and it is the engine that says what', () => {
  assert.ok(main.includes('energyBlastTargets'), 'the engine decides, the shell only writes');
  assert.ok(main.includes('import { blastTargets, energyBlastTargets,'), 'taken from the one place blasts are reasoned about');
  const block = slice('async function breakWithBlast', '\r\n}\r\n');
  assert.ok(block.includes('game.users.activeGM?.isSelf'), 'one GM writes it, never every screen');
  assert.ok(block.includes('propsOn(scene)'), 'and only where this scene has breakable props at all');
  assert.ok(block.includes('energyBlastTargets({ centre, radius, damageType'), 'the targets come from the engine');
  assert.ok(/const cause = \{ kind: "area", damageType, at:/.test(block), 'an area of the GM’s own: what the material rules are written for');
  assert.ok(!block.includes('areaUuid'), 'it names no template, which is what makes it the GM’s own word');
  assert.ok(!block.includes('kind: "blast"'), 'and never a keg’s blast, which would break everything regardless');
});

test('every energy kind is a damage type the material rules already know', () => {
  // The blast picker and the break rules share one vocabulary; a kind nothing yields to simply breaks nothing.
  for (const t of BLAST_TYPES) assert.equal(typeof t.id, 'string');
  const breaks = BLAST_TYPES.filter((t) => handBreaker('wood') && energyBlastTargets({
    centre: { x: 0, y: 0 }, radius: 100, damageType: t.id, grid: 100, scene: { id: 's', flags: { animater: { breakableProps: true } } }, levels: [],
    tiles: [{ id: 'c', x: -50, y: -50, width: 100, height: 100, rotation: 0, hidden: false, texture: { src: 'Crate_Wood.webp' }, flags: {}, levels: [] }],
  }).length > 0).map((t) => t.id);
  assert.ok(breaks.includes('fire') && breaks.includes('force'), 'fire and force take a crate');
  assert.ok(!breaks.includes('psychic'), 'psychic takes nothing');
});

test('the blast breaks on the GM’s screen only, and goes by the look the GM chose', () => {
  const block = slice('const fireBlast = (p, kind, radius, variant = null) => {', '\r\nlet blastSquares');
  assert.ok(block.includes('game.user.isGM && blastsBreak()'), 'the GM’s own write, and only when it is turned on');
  assert.ok(block.includes('damageType: variant?.base ?? kind'), 'a blast of the GM’s own breaks as the kind it is built on');
  assert.ok(block.includes('breakWithBlast(canvas.scene'), 'on the scene it went off on');
});

test('breaking is a setting of the world, on until the GM says otherwise', () => {
  const at = main.indexOf('registerSetting("blastBreaks"');
  assert.ok(at > 0, 'it is a setting at all');
  const line = main.slice(at, main.indexOf('\r\n', at));
  assert.ok(line.includes('scope: "world"'), 'one answer for the table');
  assert.ok(line.includes('config: true'), 'and the GM can find it');
  assert.ok(line.includes('default: true'), 'blasts break by default');
  assert.ok(main.includes('const blastsBreak = () =>'), 'read through one place');
  assert.ok(main.includes('hotSetting("blastBreaks") !== false'), 'and a world without the setting still breaks');
});

test('fire from a blast reaches the powder a keg spilled earlier, as a fire area does', () => {
  const block = slice('async function breakWithBlast', '\r\n}\r\n');
  assert.ok(block.includes('if (damageType !== "fire") return;'), 'only fire');
  assert.ok(block.includes('ignitableInArea(tiles, reaches)'), 'the same engine the fire areas use');
  assert.ok(block.includes('kind: "ignite"'), 'and the same cause');
});

test('a GM can break a prop from its own HUD, or put it back', () => {
  const block = slice('const propHudButton = (hud, element) =>', '\r\n};\r\n');
  assert.ok(block.includes('game.user?.isGM !== true) return'), 'a player never sees it');
  assert.ok(block.includes('scene.flags?.[ID]?.breakableProps !== true'), 'nor a scene whose props do not break');
  assert.ok(block.includes('if (material === "none") return'), 'nor a tile that is not a prop at all');
  assert.ok(block.includes('handBreaker(material'), 'what breaks it is the engine’s answer, not a guess');
  assert.ok(block.includes('doc.update({ hidden: false })'), 'put back by being shown again, which is what runs the undo');
  assert.ok(!block.includes('undoPropBreak(doc)'), 'never the undo alone, which would leave the prop hidden');
  assert.ok(block.includes('requestPropBreak(doc, { kind: "area", damageType'), 'broken through the usual relay, which checks it again');
  assert.ok(block.includes('button.disabled = true'), 'and asked for once, however many times it is clicked');
  assert.ok(block.includes('.animater-prop-break'), 'known by name, so a re-render does not stack two of them');
  assert.ok(block.includes('.col.right'), 'beside Foundry’s own HUD buttons');
  assert.match(main, /Hooks\.on\("renderTileHUD", \(hud, element\) => propSafe\("tile hud", \(\) => propHudButton\(hud, element\)\)\)/);
});

test('main.mjs is still CRLF throughout', () => {
  assert.equal((main.match(/(?<!\r)\n/g) || []).length, 0);
});
