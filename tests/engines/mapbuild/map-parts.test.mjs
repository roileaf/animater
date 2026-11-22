import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapParts } from '../../../scripts/engines/mapbuild/decor-select.mjs';
import { pathRegion, areaRegion } from '../../../scripts/engines/mapbuild/path-lay.mjs';
import { planDocuments } from '../../../scripts/engines/mapbuild/map-plan.mjs';
import { buildPlan } from '../../../scripts/engines/mapbuild/map-presets.mjs';

// A village built here is twenty regions, and Foundry's own list calls six of them "Fence". The Select tab lists the
// parts of the map by what they are, numbered where they share a name, so one can be picked up, named or taken away.
const bar = readFileSync(new URL('../../../scripts/ui/decor-brush-bar.mjs', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../../scripts/shell/map-painting.mjs', import.meta.url), 'utf8');
const as = (data, id) => ({ id, name: data.name, own: data.flags.animater });

test('each part is told by what it is, and parts of one name are numbered', () => {
  const regions = [
    as(pathRegion('fence', [[0, 0], [800, 0]], { grid: 100 }), 'f1'), as(pathRegion('road', [[0, 500], [900, 500]], { grid: 100 }), 'r1'),
    as(pathRegion('fence', [[0, 900], [800, 900]], { grid: 100 }), 'f2'), as(pathRegion('stream', [[500, 0], [500, 900]], { grid: 100 }), 'w1'),
    as(areaRegion('grass', { box: { x: 0, y: 0, width: 3000, height: 2000 }, whole: true }), 'g'), as(areaRegion('stone', { box: { x: 100, y: 100, width: 300, height: 300 } }), 'p1'),
    { id: 'room', name: 'Tavern furnishings', own: { furnishOf: '0,0,5,5', decor: { on: true, brushed: [{}, {}, {}] } } },
    { id: 'hand', name: 'Decorations', own: { decor: { on: true, brushed: [{}, {}] } } },
    { id: 'plain', name: 'A GM region', own: {} }, { id: 'none', name: 'Scatter only', own: { decor: { on: true, brushed: [] } } },
  ];
  assert.deepEqual(mapParts(regions).map((p) => [p.id, p.name, p.sort, p.count > 0]), [
    ['g', 'Ground', 'ground', false], ['f1', 'Fence 1', 'run', true], ['r1', 'Dirt road', 'path', false], ['f2', 'Fence 2', 'run', true], ['w1', 'Stream', 'water', false],
    ['p1', 'Ground patch', 'floor', false], ['room', 'Tavern furnishings', 'room', true], ['hand', 'Decorations', 'things', true],
  ]);
  assert.deepEqual(mapParts(), []); assert.equal(mapParts([{ id: 'x', name: '  ', own: { floor: 'grass' } }])[0].name, 'Region');
});

test('a built map lists as its parts: ground first, then what was laid', () => {
  const docs = planDocuments(buildPlan('village', { x: 0, y: 0, width: 3000, height: 2000, grid: 100, seed: 3 }), { grid: 100 });
  const parts = mapParts(docs.regions.map((r, i) => as(r, `r${i}`)));
  assert.equal(parts.length, docs.regions.length, 'every region the builder makes is a part');
  assert.equal(parts[0].sort, 'ground'); assert.ok(parts.some((p) => p.sort === 'floor' && p.name === 'Road') && parts.some((p) => p.sort === 'things' && p.count > 20));
  assert.equal(new Set(parts.map((p) => p.name)).size, parts.length, 'no two parts answer to one name');
});

test('the Select tab lists the parts; a click picks one up, a double-click names it, its cross takes it away', () => {
  assert.match(bar, /pick\.addEventListener\('click', \(\) => \{ remembered\.part = p\.id; for \(const other of side\.querySelectorAll\('\.an-mp-part'\)\) other\.classList\.toggle\('an-db-on', other === c\); onPart\('pick', p\.id\); \}\);/);
  assert.match(bar, /pick\.addEventListener\('dblclick', \(\) => onPart\('rename', p\.id\)\);/);
  assert.match(bar, /del\.addEventListener\('click', \(\) => onPart\('delete', p\.id\)\);/);
  const act = shell.slice(shell.indexOf('const partAct = '), shell.indexOf('const selectAct = '));
  assert.match(act, /sl\.picked = sl\.all\.filter\(\(it\) => it\.id === id\)\.map\(\(it\) => \(\{ id: it\.id, i: it\.i \}\)\); sl\.part = id;/, 'all of its pieces, and the part itself held');
  assert.match(act, /rememberDecorStep\(\{ kind: "floor", updates: \[\], creates: \[\], removes: \[\{ id, data \}\] \}\)/, 'taken away, it can be put back');
  // The list is asked for as the bar opens: by something set up before the bar is.
  assert.ok(shell.indexOf('const partsList = ') < shell.indexOf('state.bar = openBrushBar({'));
  assert.match(shell, /parts: partsList, onPart: \(act, id\) => partAct\(act, id\),/);
  assert.match(shell, /if \(key !== sl\.partsKey\) \{ sl\.partsKey = key; state\.bar\?\.refresh\?\.\(\); \}/, 'and drawn afresh when the parts change');
});
