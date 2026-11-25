import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heardStepMark, heardStepLook, createHeardSteps, MAX_MARKS, MARK_LIFE } from '../../../scripts/engines/motion/heard-steps.mjs';
import { SETTINGS_TABS } from '../../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const registration = (key) => main.match(new RegExp(`registerSetting\\("${key}", \\{[\\s\\S]*?\\n  \\}\\);`))?.[0] ?? '';

test('a mark is a ring of short struck strokes with a foot smudge, the same for the same seed', () => {
  const a = heardStepMark({ seed: 'orc:3', size: 1, grid: 100 }), b = heardStepMark({ seed: 'orc:3', size: 1, grid: 100 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, heardStepMark({ seed: 'orc:4', size: 1, grid: 100 }));
  assert.ok(a.strokes.length >= 7 && a.strokes.length <= 9);
  assert.ok(a.smudge, 'an exact mark shows where the foot came down');
  assert.equal(a.dx, 0); assert.equal(a.dy, 0);
  for (const s of a.strokes) assert.ok(s.len > 0 && s.width > 0 && Number.isFinite(s.angle));
});

test('a bigger creature makes a wider mark with heavier strokes', () => {
  const medium = heardStepMark({ seed: 's', size: 1, grid: 100 }), huge = heardStepMark({ seed: 's', size: 3, grid: 100 });
  assert.ok(huge.radius > medium.radius * 2);
  assert.ok(huge.strokes[0].width > medium.strokes[0].width);
});

test('sneaking: a smaller, fainter mark', () => {
  const loud = heardStepMark({ seed: 's', size: 1, grid: 100, loud: 1 }), quiet = heardStepMark({ seed: 's', size: 1, grid: 100, loud: 1, sneak: true });
  assert.ok(quiet.radius < loud.radius * 0.7);
  assert.ok(quiet.loud < loud.loud * 0.6);
});

test('vague: it lands off the square (half to under one and a half squares), looser, with no foot smudge', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const m = heardStepMark({ seed, size: 1, grid: 100, vague: true }), off = Math.hypot(m.dx, m.dy);
    assert.ok(off >= 50 && off <= 140, `${off}`);
    assert.equal(m.smudge, null);
    assert.ok(m.radius > heardStepMark({ seed, size: 1, grid: 100 }).radius);
  }
});

test('its look through its life: the strokes run outward, in three tones, and are gone at the end', () => {
  const m = heardStepMark({ seed: 'x', size: 1, grid: 100 });
  const early = heardStepLook(m, 0.05), late = heardStepLook(m, 0.8);
  const far = (look) => Math.hypot(look.strokes[0].x1, look.strokes[0].y1);
  assert.ok(far(late) > far(early));
  assert.equal(early.alpha, 1);
  const tones = new Set(); for (let k = 0; k < 1; k += 0.01) tones.add(heardStepLook(m, k).alpha);
  assert.deepEqual([...tones].sort(), [1 / 3, 2 / 3, 1].sort());
  assert.equal(heardStepLook(m, 1).alpha, 0);
  assert.equal(heardStepLook(m, 0.9).smudge, 0, 'the smudge is gone by half its life');
  assert.ok(heardStepLook(m, 0.1).smudge > 0);
  assert.ok(heardStepLook({ ...m, loud: 0.3 }, 0.05).alpha < 1, 'a far or sneaking step is fainter');
});

// The least of PIXI the layer touches.
const fakePIXI = () => {
  const made = [];
  class Graphics { constructor() { this.calls = []; this.eventMode = 'auto'; this.destroyed = false; this.parent = null; made.push(this); }
    clear() { this.calls = []; return this; } lineStyle(o) { this.calls.push(['lineStyle', o]); return this; } moveTo(x, y) { this.calls.push(['moveTo', x, y]); return this; }
    lineTo(x, y) { this.calls.push(['lineTo', x, y]); return this; } beginFill(c, a) { this.calls.push(['beginFill', c, a]); return this; } endFill() { return this; }
    drawEllipse(...a) { this.calls.push(['drawEllipse', ...a]); return this; } destroy() { this.destroyed = true; } }
  const root = { children: [], addChild(c) { this.children.push(c); c.parent = this; }, removeChild(c) { this.children = this.children.filter((o) => o !== c); c.parent = null; } };
  return { PIXI: { Graphics }, root, made };
};

test('the layer: a mark is drawn dark under pale, lives its life, and is cleared away', () => {
  const { PIXI, root, made } = fakePIXI(), layer = createHeardSteps({ PIXI, root: () => root, grid: () => 100 });
  assert.equal(layer.busy, false);
  layer.add({ x: 500, y: 400, size: 1, seed: 'a' });
  assert.equal(layer.busy, true); assert.equal(root.children.length, 1); assert.equal(made[0].eventMode, 'none');
  layer.tick(0.1);
  const styles = made[0].calls.filter((c) => c[0] === 'lineStyle').map((c) => c[1]);
  assert.ok(styles.some((s) => s.color === 0x1a1410) && styles.some((s) => s.color === 0xece0c8), 'a dark line with a pale core');
  const dark = styles.find((s) => s.color === 0x1a1410), pale = styles.find((s) => s.color === 0xece0c8);
  assert.ok(dark.width > pale.width);
  const moves = made[0].calls.filter((c) => c[0] === 'moveTo');
  assert.ok(moves.every((c) => Math.hypot(c[1] - 500, c[2] - 400) < 100), 'round the foot');
  layer.tick(MARK_LIFE);
  assert.equal(layer.busy, false);
  assert.equal(made[0].calls.length, 0, 'nothing left drawn');
  layer.add({ x: 1, y: 1, seed: 'b' }); layer.clear();
  assert.equal(layer.busy, false); assert.equal(root.children.length, 0); assert.ok(made[0].destroyed);
});

test('the layer keeps only the newest marks', () => {
  const { PIXI, root } = fakePIXI(), layer = createHeardSteps({ PIXI, root: () => root, grid: () => 100 });
  for (let i = 0; i < MAX_MARKS + 10; i++) layer.add({ x: i, y: 0, seed: `m${i}` });
  assert.equal(layer.count, MAX_MARKS);
});

test('Heard footsteps: a world switch, an on-my-screen one and where the mark lands, in Ground & movement', () => {
  assert.match(registration('heardSteps'), /name: "Heard footsteps"[\s\S]*scope: "world", config: true, type: Boolean, default: true/);
  assert.match(registration('heardStepsLocal'), /scope: "client", config: false, type: Boolean, default: true/);
  assert.match(registration('heardStepsPlace'), /scope: "world", config: true, type: String, default: "exact"[\s\S]*choices: \{ exact: "Exact square", vague: "Vague" \}/);
  const rows = SETTINGS_TABS.flatMap((t) => t.rows);
  assert.ok(rows.some((r) => r.world === 'heardSteps' && r.local === 'heardStepsLocal' && r.extras?.includes('heardStepsPlace')));
});

test('wired to the footstep beat: only a creature heard and not seen, never the showcase, never when steps are silenced outside combat', () => {
  const step = main.slice(main.indexOf('footstep: (floor, at, token, kind = "step")')), body = step.slice(0, step.indexOf('\n  },'));
  assert.match(body, /const marked = !token\.preview && token\.visible === false && calm\.gain > 0 && heardStepsOn\(\);/);
  assert.match(body, /if \(!\(level > 0\) && !\(mix\.tremor > 0\) && !marked\) return;/, 'a screen with footstep sounds off still gets its marks');
  assert.ok(body.indexOf('if (step === null) return;') < body.indexOf('markHeardStep('), 'on the beat, not on every stride');
  assert.match(body, /if \(marked && walking\) markHeardStep\(at, \{ squares, weight, sneak: !!sneak, range, seed: `\$\{seed\}:\$\{step\}` \}\);/);
});

test('the mark is placed by this screen\'s ears, within the footstep range, and drawn above the fog', () => {
  assert.match(main, /const markHeardStep = [\s\S]{0,400}?footstepReach\(range, weight\) \* \(canvas\.grid\?\.size \?\? 100\)[\s\S]{0,300}?heardFrom\(at, canvas\.sounds\?\.getListenerPositions\?\.\(\) \?\? \[\], reach\)[\s\S]{0,120}?if \(!\(near > 0\)\) return;/);
  assert.match(main, /const heardStepsOn = \(\) => bothSettingsOn\("heardSteps"\);/);
  assert.match(main, /\(canvas\.interface \?\? canvas\.stage\)\.addChild\(heardStepsRoot\)/);
  assert.match(main, /if \(heardSteps\.busy\) heardSteps\.tick\(seconds\);/);
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{ heardSteps\.clear\(\);/);
});
