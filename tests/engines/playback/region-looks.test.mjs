import test from 'node:test';
import assert from 'node:assert/strict';
import { regionLook, regionLookWants, syncRegionLooks } from '../../../scripts/engines/playback/region-looks.mjs';

const ID = 'animater';
const reg = (id, look, box) => ({ id, flags: look ? { [ID]: { tokenshade: look } } : {}, box });
const inside = (r, t) => t.x >= r.box[0] && t.x <= r.box[1];

test('a region with an Animater look gives it to the creatures inside; the topmost wins; tokens without actors get none', () => {
  assert.equal(regionLook(reg('a', '  Haunted ground '), ID), 'Haunted ground');
  assert.equal(regionLook(reg('a', ''), ID), null);
  const regions = [reg('low', 'Moonlit', [0, 10]), reg('top', 'Firelit', [5, 10]), reg('plain', null, [0, 100])];
  const tokens = [{ id: 'a', actor: {}, x: 2 }, { id: 'b', actor: {}, x: 7 }, { id: 'c', actor: {}, x: 50 }, { id: 'd', x: 2 }];
  const wants = regionLookWants({ tokens, regions, id: ID, inside });
  assert.deepEqual([...wants], [['a', { region: 'low', preset: 'Moonlit' }], ['b', { region: 'top', preset: 'Firelit' }]]);
  assert.equal(regionLookWants({ tokens, regions: [reg('x', null, [0, 9])], id: ID, inside }).size, 0);
  const broken = { ...reg('bad', 'Moonlit', [0, 10]) };
  assert.equal(regionLookWants({ tokens, regions: [broken], id: ID, inside: () => { throw new Error('x'); } }).size, 0, 'a broken region never throws');
});

test('looks fade out as creatures leave or the region changes, and in as they arrive; unchanged ones stay', () => {
  const shown = new Map(), removed = [], applied = [];
  const apply = (tid, w) => { applied.push(`${tid}:${w.preset}`); return () => removed.push(tid); };
  syncRegionLooks(shown, new Map([['a', { region: 'r', preset: 'Moonlit' }], ['b', { region: 'r', preset: 'Moonlit' }]]), { apply });
  assert.deepEqual(applied, ['a:Moonlit', 'b:Moonlit']);
  syncRegionLooks(shown, new Map([['a', { region: 'r', preset: 'Moonlit' }], ['b', { region: 'q', preset: 'Firelit' }]]), { apply });
  assert.deepEqual(removed, ['b']);
  assert.deepEqual(applied.slice(2), ['b:Firelit'], 'a stays as it was');
  syncRegionLooks(shown, new Map(), { apply });
  assert.deepEqual(removed, ['b', 'a', 'b']);
  assert.equal(shown.size, 0);
  syncRegionLooks(shown, new Map([['z', { region: 'r', preset: 'Gone' }]]), { apply: () => null });
  assert.equal(shown.size, 0, 'a look that could not show is tried again next time');
});

test('fire creatures shimmer and cold ones breathe mist, from traits, else the name', async () => {
  const { natureLook } = await import('../../../scripts/engines/playback/region-looks.mjs');
  assert.equal(natureLook({ traits: ['elemental', 'fire'], name: 'Living Wildfire' }), 'Heat shimmer');
  assert.equal(natureLook({ traits: ['cold'], name: 'x' }), 'Cold mist');
  assert.equal(natureLook({ traits: ['elemental', 'water'], name: 'Ice Mephit?' }), null, 'traits that say otherwise win over the name');
  assert.equal(natureLook({ name: 'Young Red Dragon' }), null);
  assert.equal(natureLook({ name: 'Fire Elemental' }), 'Heat shimmer');
  assert.equal(natureLook({ name: 'Frost Giant' }), 'Cold mist');
  assert.equal(natureLook({ name: 'Firefly' }), null, 'whole words only');
  assert.equal(natureLook(), null);
});
