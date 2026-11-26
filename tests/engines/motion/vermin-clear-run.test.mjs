import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ratStep, RAT_CLEAR } from '../../../scripts/engines/motion/vermin.mjs';

// A rat running straight on: speed 200 px/s at 100 fps is 2 px a frame.
const running = () => ({ x: 0, y: 0, angle: 0, speed: 200, wait: 5 });
const run = (rat, frames, opts) => { let r = rat; for (let i = 0; i < frames; i++) r = ratStep(r, { dt: 0.01, grid: 100, random: () => 0.5, ...opts }); return r; };

test('a rat running straight asks about the walls once for a stretch, not every frame', () => {
  let asked = 0, cheap = 0, whole = 0;
  const opts = { ahead: () => { asked++; return false; }, shut: () => { cheap++; return false; }, blocked: () => { whole++; return false; } };
  const r = run(running(), 20, opts);
  assert.equal(asked, 1, 'one look ahead covers twenty frames of 2 px');
  assert.equal(cheap, 20, 'the cheap part is asked every frame');
  assert.equal(whole, 0);
  assert.ok(Math.abs(r.x - 40) < 1e-6, 'and it runs as far as it did');
  // The stretch is half a square: at 2 px a frame it lasts 25 frames, then it looks again.
  asked = 0; run(running(), 60, opts);
  assert.equal(asked, Math.ceil(60 / (100 * RAT_CLEAR / 2 + 1)));
});

test('a wall anywhere in the stretch ahead: it asks about its snout every frame, as before, and stops at the wall', () => {
  // A wall at x = 60. The snout is 25 px ahead of its middle.
  const wall = (a, b) => (a.x < 60) !== (b.x < 60);
  let whole = 0;
  const opts = { ahead: wall, shut: () => false, blocked: (a, b) => { whole++; return wall(a, b); } };
  const plain = run(running(), 40, { blocked: wall }), memo = run(running(), 40, opts);
  assert.ok(whole > 0);
  assert.equal(memo.x, plain.x, 'it stops just where it does without the look ahead');
  assert.ok(memo.x + 25 < 60 + 2 + 1e-6 && memo.speed === 0);
});

test('a turn, or a place it keeps out of, ends the stretch', () => {
  let asked = 0;
  const opts = { ahead: () => { asked++; return false; }, shut: () => false, blocked: () => false };
  let r = run(running(), 3, opts);
  r = run({ ...r, angle: 1 }, 3, opts);
  assert.equal(asked, 2, 'a new heading is looked along afresh');
  // The cheap part still stops it mid-stretch.
  const kept = run(running(), 30, { ...opts, shut: (a, b) => b.x > 50 });
  assert.ok(kept.x + 25 <= 52 + 1e-6 && kept.speed === 0);
});

test('the map hands the rats both parts, and the look ahead has none of the walls\' allowances', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const ratAhead = \(a, b\) => wallOnlyBlocks\(a, b\) \|\| cliffBlocks\(a, b\);/);
  assert.match(main, /const ratShut = \(a, b\) => keptOut\("rats", b\) && !keptOut\("rats", a\);/);
  assert.match(main, /vermin\.tick\(step, \{[^}]*blocked: ratBlocks, ahead: ratAhead, shut: ratShut/);
});

test('what the ticker reads every frame is not looked up afresh every frame', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  // The carriers' ticker reads its settings through the hot cache (a raw read of an unsaved world setting scans them all).
  assert.match(main, /const carriersOn = \(\) => \{ try \{ return hotSetting\("carriers"\) !== false;/);
  assert.match(main, /const carrierVolume = \(\) => \{ try \{ const n = Number\(hotSetting\("carrierVolume"\)\);/);
  assert.match(main, /globalWeatherHeld \?\?= \(game\.settings\.get\(ID, "globalWeather"\)/);
  // Who is where is made once a frame.
  assert.match(main, /const creaturesNow = \(\) => \{ const frame = frameOf\(\); if \(frame === creaturesAt\) return creaturesHeld;/);
  assert.match(main, /const tokensOnFloor = \(\) => \{ const frame = frameOf\(\); if \(frame === floorTokensAt\) return floorTokensHeld;/);
});
