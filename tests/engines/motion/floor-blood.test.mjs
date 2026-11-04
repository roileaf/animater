import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitMarks, bleedStep, standingDrip, woundShape, poolGleam, POOL_DRIES, bloodSheen, bloodShines } from '../../../scripts/engines/motion/floor-blood.mjs';
import { bloodTones } from '../../../scripts/engines/motion/blood-art.mjs';

const at = { x: 500, y: 500 }, from = { x: 300, y: 500 };

test('a hit throws blood away from the attacker', () => {
  const marks = hitMarks({ at, from, type: 'slashing', seed: 'a' }), spray = marks.find((m) => m.art === 'slash');
  assert.ok(spray.x > at.x, 'beyond the target');
  assert.ok(Math.abs(spray.rot) < 1e-9, 'pointing on the way the blow went');
  const drops = marks.filter((m) => m.art === 'drop');
  assert.ok(drops.length >= 6 && drops.every((d) => d.x > at.x - 60));
  assert.ok(drops.every((d) => d.fromX === at.x), 'flying from the wound');
  assert.deepEqual(hitMarks({ at, from, type: 'slashing', seed: 'a' }), marks, 'the same seed, the same marks');
});

test('each wound has its shape: a slash a fan, a point a jet, a blow all round', () => {
  const spreadOf = (type) => { const list = hitMarks({ at, from, type, seed: 'b' }).filter((m) => m.art === 'drop').map((m) => Math.abs(Math.atan2(m.y - at.y, m.x - at.x))); return Math.max(...list); };
  assert.ok(spreadOf('piercing') < spreadOf('slashing'));
  assert.ok(spreadOf('bludgeoning') > spreadOf('slashing'));
  assert.equal(hitMarks({ at, from, type: 'piercing', seed: 'b' })[0].art, 'pierce');
  assert.equal(hitMarks({ at, from, type: 'bludgeoning', seed: 'b' })[0].art, 'blunt');
});

test('a crit is bigger and further; a kill leaves a pool spreading', () => {
  const plain = hitMarks({ at, from, type: 'slashing', seed: 'c' }), crit = hitMarks({ at, from, type: 'slashing', seed: 'c', crit: true });
  assert.ok(crit.filter((m) => m.art === 'drop').length > plain.filter((m) => m.art === 'drop').length);
  assert.ok(crit.find((m) => m.art === 'slash').r > plain.find((m) => m.art === 'slash').r);
  const pool = hitMarks({ at, from, type: 'slashing', seed: 'c', kill: true }).find((m) => m.art === 'pool');
  assert.ok(pool.spreads > 0);
  assert.equal(plain.some((m) => m.art === 'pool'), false);
});

test('damage that draws no blood throws none, though a kill still pools', () => {
  assert.equal(woundShape('fire'), null);
  assert.deepEqual(hitMarks({ at, from, type: 'psychic', seed: 'd' }), []);
  assert.equal(hitMarks({ at, from, type: 'fire', seed: 'd', kill: true })[0].art, 'pool');
  assert.ok(hitMarks({ at, type: null, seed: 'd' }).length > 0, 'unknown damage bleeds like a blow');
});

const strides = (opts, n = 60) => { const run = {}, all = []; for (let index = 0; index < n; index++) all.push(bleedStep({ at, heading: 0, index, seed: 's', run, ...opts })); return all; };

test('on its feet a creature drops blood and drags nothing, more the worse it is hurt', () => {
  const hurt = strides({ tier: 1 }).flat(), bad = strides({ tier: 2 }).flat();
  assert.ok(bad.length > hurt.length * 2, `${bad.length} against ${hurt.length}`);
  assert.equal([...hurt, ...bad].some((m) => m.art === 'patch'), false);
});

test('prone and moving it drags a broken trail: blotches with gaps between them', () => {
  const list = strides({ tier: 1, prone: true });
  const dragged = list.map((marks) => marks.some((m) => m.art === 'patch'));
  assert.ok(dragged.filter(Boolean).length > 15, 'blotches');
  assert.ok(dragged.filter((d) => !d).length > 10, 'gaps');
  assert.ok(list.flat().some((m) => m.art === 'drop'), 'drops beside them');
  assert.ok(list.flat().find((m) => m.art === 'patch').x < at.x, 'behind it');
});

test('standing still it drips, sooner the worse it is hurt', () => {
  const steady = () => 0.5;
  const bad = standingDrip({ at, tier: 2, random: steady }), hurt = standingDrip({ at, tier: 1, random: steady });
  assert.ok(bad.nextIn < hurt.nextIn);
  assert.ok(Math.hypot(bad.mark.x - at.x, bad.mark.y - at.y) <= 30, 'under it');
});

test('a creature\'s own colour, darkened for the floor', () => {
  const t = bloodTones(0x4a7a1c);
  assert.ok(t.wet[1] > t.deep[1] && t.deep[1] > t.rim[1]);
  assert.ok(t.wet[1] < 0x7a, 'never as bright as the colour itself');
});

test('a wet pool catches the light on its near side, less as it dries, none in the dark', () => {
  const pool = { x: 0, y: 0, r: 50 }, light = { x: 300, y: 0, strength: 0.8 };
  const fresh = poolGleam(pool, light, 0);
  assert.ok(fresh.x > 0, 'toward the light');
  assert.ok(fresh.alpha > 0.2);
  assert.ok(poolGleam(pool, light, POOL_DRIES / 2).alpha < fresh.alpha, 'drying');
  assert.equal(poolGleam(pool, light, POOL_DRIES), null, 'dry');
  assert.equal(poolGleam(pool, null, 0), null, 'no light');
  assert.equal(poolGleam(pool, { ...light, strength: 0 }, 0), null);
});

test('any wound bleeds a little: a scratch drops less than a hurt creature and waits longer standing', () => {
  const marks = (tier) => { let n = 0; for (let i = 0; i < 400; i++) n += bleedStep({ at: { x: 0, y: 0 }, index: i, tier, seed: 's' }).length; return n; };
  assert.ok(marks(0.5) > 0, 'a scratch leaves some');
  assert.ok(marks(0.5) < marks(1) && marks(1) < marks(2));
  const wait = (tier) => standingDrip({ at: { x: 0, y: 0 }, tier, random: () => 0.5 }).nextIn;
  assert.ok(wait(0.5) > wait(1) && wait(1) > wait(2));
});

test('wet stains shine by the light on them and stop as they dry; drops do not', () => {
  assert.ok(bloodShines('slash') && bloodShines('pool') && !bloodShines('drop'));
  assert.equal(bloodSheen(null), 0, 'no light');
  assert.ok(bloodSheen({ strength: 1 }) > bloodSheen({ strength: 0.3 }));
  assert.ok(bloodSheen({ strength: 1 }, POOL_DRIES / 2) < bloodSheen({ strength: 1 }));
  assert.equal(bloodSheen({ strength: 1 }, POOL_DRIES), 0, 'dry');
});
