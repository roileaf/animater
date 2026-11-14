import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ROLL_SOUNDS, KNOCK_SOUNDS, IDLE_SOUNDS, OAR_SOUNDS, HOOF_SOUNDS, rollSurface, rollFile, rollShape, jingleGap, jingle, strokeGap, paceGap, paceVoice, lapFile, lapShape, knocksFor, knocksOf, hasTeam, isRowed, teamCall, callGap, carrierSoundFiles, hoofFile, hoofShape, hasHooves, mountPace, MOUNT_PACES, PACE_AT } from '../../../scripts/engines/sound/carrier-sound.mjs';

const catalog = JSON.parse(readFileSync(new URL('../../../assets/sounds/vehicles/catalog.json', import.meta.url)));

test('every sound it can ask for is a file that ships, and every file that ships is CC0 and auditioned', () => {
  const files = carrierSoundFiles();
  assert.equal(new Set(files).size, files.length, 'no file is listed twice');
  for (const file of files) {
    const rel = file.replace(/^modules\/animater\//, '');
    assert.ok(existsSync(new URL(`../../../${rel}`, import.meta.url)), file);
    const clip = catalog.clips.find((c) => c.path === rel);
    assert.ok(clip, `${file} is in the catalogue`);
    assert.equal(clip.license, 'http://creativecommons.org/publicdomain/zero/1.0/', file);
    assert.ok(clip.url.startsWith('https://freesound.org/people/'), file);
    assert.ok(clip.peakDb <= -1, `${file} keeps its headroom`);
  }
  assert.equal(catalog.clips.length, files.length, 'the catalogue holds exactly what the engine uses');
});

test('what is under the wheels picks the rims; nothing rolls on water', () => {
  assert.equal(rollSurface('dirt'), 'dirt');
  assert.equal(rollSurface('stone'), 'dirt', 'iron on hard ground, until a cobbles recording exists');
  assert.equal(rollSurface('wood'), 'wood');
  assert.equal(rollSurface('ice'), 'snow');
  assert.equal(rollSurface('water'), null);
  assert.equal(rollSurface('nonsense'), 'dirt', 'an unknown floor is still ground');
});

test('each carrier keeps one voice, and the kinds that do not roll are silent', () => {
  const a = rollFile('wagon', 'dirt', 'w1');
  assert.ok(ROLL_SOUNDS.dirt.includes(a));
  assert.equal(rollFile('wagon', 'dirt', 'w1'), a, 'the same wagon sounds the same all the way down the road');
  const voices = new Set(Array.from({ length: 40 }, (_, i) => rollFile('wagon', 'dirt', `w${i}`)));
  assert.ok(voices.size > 1, 'two wagons on a scene are not the same recording');
  assert.ok(ROLL_SOUNDS.wood.includes(rollFile('wagon', 'wood', 'w1')));
  assert.ok(ROLL_SOUNDS.barrow.includes(rollFile('cart', 'dirt', 'c1')), 'a hand cart has its own lighter one');
  assert.ok(ROLL_SOUNDS.wash.includes(rollFile('boat', 'water', 'b')), 'a boat holds the wash along its hull');
  assert.equal(rollFile('mount', 'dirt', 'm'), null, 'a mount has no rims: it has hooves, which are their own thing');
  assert.equal(rollFile('party', 'dirt', 'p'), null);
  assert.equal(rollFile('wagon', 'water', 'w1'), null, 'a wagon in the water is not rolling');
});

test('the rims come up with the pace and never shout', () => {
  assert.deepEqual(rollShape({ speed: 0 }), { volume: 0, rate: 1 }, 'standing still it is silent');
  const slow = rollShape({ speed: 0.4 }), quick = rollShape({ speed: 1.6 });
  assert.ok(slow.volume > 0 && slow.volume < quick.volume, 'it comes up as it goes faster');
  assert.ok(quick.rate > slow.rate);
  assert.ok(rollShape({ speed: 6 }).rate <= 1.45 && rollShape({ speed: 6 }).volume <= 1, 'and is held inside sane bounds');
  assert.ok(rollShape({ speed: 1.5, rough: 1 }).volume > rollShape({ speed: 1.5, rough: 0 }).volume, 'a rough track is louder');
  assert.ok(rollShape({ speed: 1.5, load: 1 }).volume > rollShape({ speed: 1.5, load: 0 }).volume, 'a laden wagon is heavier');
  assert.ok(rollShape({ speed: 1.5, load: 1 }).rate < rollShape({ speed: 1.5, load: 0 }).rate, 'and a shade slower');
  assert.ok(rollShape({ speed: 1.5, kind: 'cart' }).volume < rollShape({ speed: 1.5, kind: 'wagon' }).volume, 'a hand cart is quieter than a wagon');
});

test('the harness jingles with the pace, within reason', () => {
  assert.ok(jingleGap(2) < jingleGap(0.6), 'a faster team jingles more often');
  assert.ok(jingleGap(10) >= 620, 'but never turns into a rattle');
  assert.ok(jingleGap(0) <= 2600, 'and a crawling one still speaks now and then');
  // It is the chains that ring, not the axle: this was the bug — the jingle was built from a jolt and came out a creak.
  const ring = jingle({ speed: 1.4, seed: 'w', n: 0 });
  assert.equal(ring.kind, 'harness');
  assert.ok(KNOCK_SOUNDS.harness.includes(ring.file));
  assert.ok(!KNOCK_SOUNDS.creak.includes(ring.file));
  assert.ok(ring.volume > 0 && ring.volume < 0.2, 'it rings under the wagon, not over it');
  assert.ok(jingle({ speed: 2, seed: 'w' }).volume > jingle({ speed: 0, seed: 'w' }).volume, 'louder at a trot');
  const over = Array.from({ length: 12 }, (_, n) => jingle({ seed: 'w', n }).file);
  assert.ok(new Set(over).size > 1, 'and not the same chain every time');
});

test('a wheel dropping creaks the axle, and shifts the load only if there is one', () => {
  const quiet = knocksFor({ jolt: 0 });
  assert.deepEqual(quiet, [], 'rolling smoothly, nothing knocks');
  const small = knocksFor({ jolt: 0.4, load: 1, seed: 'w' });
  assert.deepEqual(small.map((k) => k.kind), ['creak'], 'a small drop is only the axle');
  const big = knocksFor({ jolt: 0.9, load: 1, seed: 'w' });
  assert.deepEqual(big.map((k) => k.kind), ['creak', 'load']);
  assert.deepEqual(knocksFor({ jolt: 0.9, load: 0, seed: 'w' }).map((k) => k.kind), ['creak'], 'an empty wagon has nothing to shift');
  assert.ok(big[0].volume > small[0].volume, 'the harder the drop the louder it creaks');
  assert.ok(big.every((k) => k.volume <= 1 && k.rate > 0));
  assert.ok(KNOCK_SOUNDS.creak.includes(big[0].file));
});

// Roi: "what about sounds to all others?" Every kind was creaking an axle and jingling a harness it has not got, because
// the one-offs never asked what they were coming from.
test('a carrier only makes the sounds its own kind has', () => {
  const hard = { jolt: 0.9, load: 1, stopping: true, covered: true, swing: 0.9, seed: 'x' };
  assert.deepEqual(knocksFor({ ...hard, kind: 'wagon' }).map((k) => k.kind), ['creak', 'load', 'brake', 'canvas']);
  assert.deepEqual(knocksFor({ ...hard, kind: 'cart' }).map((k) => k.kind), ['creak', 'load'], 'a hand cart has no brake and no canvas');
  assert.deepEqual(knocksFor({ ...hard, kind: 'sled' }).map((k) => k.kind), ['load'], 'runners have no axle to creak');
  assert.deepEqual(knocksFor({ ...hard, kind: 'boat' }).map((k) => k.kind), ['hull', 'bump'], 'a boat works its timbers and knocks its hull');
  for (const kind of ['mount', 'party', 'nonsense']) {
    assert.deepEqual(knocksFor({ ...hard, kind }), [], `${kind} makes none of them`);
    assert.equal(jingle({ speed: 1.4, seed: 'x', kind }), null, `${kind} has nothing in harness`);
  }
  assert.equal(jingle({ speed: 1.4, seed: 'x', kind: 'boat' }), null, 'a boat has nothing in harness either');
  assert.ok(hasTeam('wagon') && !hasTeam('cart'));
  assert.ok(jingle({ speed: 1.4, seed: 'x', kind: 'wagon' }), 'a wagon still rings');
});

// Roi kept the wash, the oars, the lapping, the timbers and the hull knock, so a boat is no longer silent: its wash
// stands in for the rims, its oars for the harness, and it is the only kind with anything to say standing still.
test('a boat is the wagon over again in water, and is the only one that speaks at rest', () => {
  assert.ok(isRowed('boat') && !isRowed('wagon'));
  // The wash is what it is afloat on; a boat somehow on dry land makes none of it.
  assert.equal(rollFile('boat', 'dirt', 'b'), null);
  assert.equal(rollFile('boat', 'water', 'b'), rollFile('boat', 'water', 'b'), 'one boat keeps one voice');
  assert.ok(rollShape({ speed: 1.5, kind: 'boat' }).volume < rollShape({ speed: 1.5, kind: 'wagon' }).volume, 'water is quieter than iron on stone');
  // The oars: with the pace, like the harness, but slower — it is a stroke, not a rattle.
  const pull = paceVoice({ kind: 'boat', speed: 1.2, seed: 'b', n: 0 });
  assert.equal(pull.kind, 'oar');
  assert.ok(OAR_SOUNDS.includes(pull.file));
  assert.ok(pull.volume > 0 && pull.volume < 0.25);
  assert.ok(paceVoice({ kind: 'boat', speed: 2, seed: 'b' }).volume > paceVoice({ kind: 'boat', speed: 0, seed: 'b' }).volume, 'a harder pull is louder');
  assert.equal(paceVoice({ kind: 'wagon', speed: 1, seed: 'b' }).kind, 'harness', 'a wagon still jingles instead');
  assert.equal(paceVoice({ kind: 'cart', speed: 1, seed: 'b' }), null, 'nobody is drawing or rowing a hand cart');
  assert.ok(strokeGap(1.5) > jingleGap(1.5), 'a stroke of the oars is a slower thing than a chain');
  assert.ok(strokeGap(2) < strokeGap(0.5), 'and comes round faster as the boat goes faster');
  assert.equal(paceGap('boat', 1.5), strokeGap(1.5));
  assert.equal(paceGap('wagon', 1.5), jingleGap(1.5));
  assert.equal(paceGap('party', 1.5), null);
  // The lapping: the idle voice, and it crosses over with the wash rather than taking turns with it.
  assert.ok(IDLE_SOUNDS.boat.includes(lapFile('boat', 'water', 'b')));
  assert.equal(lapFile('boat', 'dirt', 'b'), null, 'no water, no lapping');
  assert.equal(lapFile('wagon', 'dirt', 'w'), null, 'a standing wagon says nothing at all');
  assert.ok(lapShape({ speed: 0 }).volume > 0, 'loudest at rest');
  assert.ok(lapShape({ speed: 0.3 }).volume < lapShape({ speed: 0 }).volume, 'fading as it gets under way');
  assert.equal(lapShape({ speed: 1.2 }).volume, 0, 'and gone once it is moving, where the wash has taken over');
  assert.ok(rollShape({ speed: 1.2, kind: 'boat' }).volume > 0, 'which it has');
});

// Roi: "can he sometime raise his head and neigh from time to time?"
test('a horse waiting in the shafts calls now and then, head up, and nothing else does', () => {
  const call = teamCall({ kind: 'wagon', standing: true, headUp: true, seed: 'w' });
  assert.equal(call.kind, 'call');
  assert.ok(call.file.endsWith('.ogg') && call.file.includes('farm'), 'the horse voice the module already ships');
  assert.ok(existsSync(new URL(`../../../${call.file.replace(/^modules\/animater\//, '')}`, import.meta.url)), call.file);
  assert.ok(call.volume > 0 && call.volume < 0.4 && call.rate > 0.8 && call.rate < 1.2);
  assert.equal(teamCall({ kind: 'wagon', standing: true, headUp: false, seed: 'w' }), null, 'not with its nose in the grass');
  assert.equal(teamCall({ kind: 'wagon', standing: false, headUp: true, seed: 'w' }), null, 'nor while it is pulling');
  // A mount is itself the horse, so it calls too (Roi: "i cant hear any neigh for mount").
  assert.ok(teamCall({ kind: 'mount', standing: true, headUp: true, seed: 'w' }), 'a mount is a horse and calls');
  for (const kind of ['cart', 'sled', 'boat', 'party']) assert.equal(teamCall({ kind, standing: true, headUp: true, seed: 'w' }), null, `${kind} has no horse about it`);
  const pitches = new Set(Array.from({ length: 12 }, (_, n) => teamCall({ seed: 'w', n }).rate));
  assert.ok(pitches.size > 1, 'and not the same call every time');
  // Long gaps, never the same twice running: a wagon parked in a square is not a nuisance.
  const gaps = Array.from({ length: 10 }, (_, n) => callGap('w', n));
  assert.ok(gaps.every((g) => g >= 26000 && g <= 60000));
  assert.ok(new Set(gaps).size > 5);
  assert.ok(!carrierSoundFiles().includes(call.file), 'it is an animal voice, not one of the vehicle clips');
});

// Roi: "horse(mount) sfx doesnt match galloping horse". It did not: a ridden horse made no sound of its own, and what
// was heard was its footstep, a coconut clop paced by the creature's size and never by how fast it was going.
test('a mount holds the hooves of the pace it has worked up to', () => {
  assert.deepEqual(MOUNT_PACES, ['walk', 'trot', 'gallop']);
  // The journey decides the pace: out of the gate at a walk, into a trot, galloping across a field.
  assert.equal(mountPace(0), 'walk');
  assert.equal(mountPace(PACE_AT.trot - 0.01), 'walk');
  assert.equal(mountPace(PACE_AT.trot), 'trot');
  assert.equal(mountPace(PACE_AT.gallop - 0.01), 'trot');
  assert.equal(mountPace(PACE_AT.gallop), 'gallop');
  assert.equal(mountPace(40), 'gallop');
  assert.equal(mountPace(-5), 'walk', 'and nonsense is a standing start');
  // Each pace is its own recording of a real horse, one kept voice per mount.
  for (const pace of MOUNT_PACES) {
    const file = hoofFile('mount', pace, 'm1');
    assert.ok(HOOF_SOUNDS[pace].includes(file), pace);
    assert.equal(hoofFile('mount', pace, 'm1'), file, 'the same horse sounds the same all the way');
  }
  const walks = new Set(Array.from({ length: 40 }, (_, i) => hoofFile('mount', 'walk', `m${i}`)));
  assert.ok(walks.size > 1, 'two horses on a scene are not the same recording');
  assert.notEqual(hoofFile('mount', 'gallop', 'm1'), hoofFile('mount', 'walk', 'm1'), 'and a gallop is not a walk');
  for (const kind of ['cart', 'sled', 'boat', 'party']) {
    assert.equal(hoofFile(kind, 'gallop', 'x'), null, `${kind} has no horse about it`);
  }
  // It comes up with the horse and is never pitched far off its own pace.
  assert.deepEqual(hoofShape({ speed: 0, pace: 'gallop' }), { volume: 0, rate: 1 }, 'standing still it is silent');
  const easy = hoofShape({ speed: 0.3, pace: 'walk', seed: 'm' }), full = hoofShape({ speed: 1.4, pace: 'walk', seed: 'm' });
  assert.ok(easy.volume > 0 && easy.volume < full.volume, 'it comes up as the horse gets going');
  assert.ok(hoofShape({ speed: 2, pace: 'gallop', seed: 'm' }).volume > hoofShape({ speed: 2, pace: 'walk', seed: 'm' }).volume,
    'a gallop carries further than a walk');
  const rates = new Set(Array.from({ length: 20 }, (_, i) => hoofShape({ speed: 1, seed: `m${i}` }).rate));
  assert.ok(rates.size > 1, 'two horses abreast do not fall into step');
  for (const rate of rates) assert.ok(rate >= 0.97 && rate <= 1.03, 'and none of them is a recording run off its pace');
  assert.ok(Array.from({ length: 20 }, (_, i) => hoofShape({ speed: 6, pace: 'gallop', seed: `m${i}` }).volume).every((v) => v <= 1));
});

// Roi: "i think wagon should combine wagon and horse sfx no?" A wagon was its rims, its chains and its axle with
// nothing pulling them: the team was drawn into the picture and into the tracks, and heard nowhere.
test('a wagon is heard as its rims and the team in the shafts at once', () => {
  assert.ok(hasHooves('wagon') && hasHooves('mount'));
  for (const kind of ['cart', 'sled', 'boat', 'party']) assert.ok(!hasHooves(kind), `nobody is in ${kind}'s shafts`);
  const team = hoofFile('wagon', 'trot', 'w1');
  assert.ok(HOOF_SOUNDS.trot.includes(team), 'the same recordings a mount uses');
  assert.equal(hoofFile('wagon', 'trot', 'w1'), team, 'one wagon keeps one team');
  // Both voices answer for the same wagon at the same moment, which is what makes it a wagon and horses.
  const at = { speed: 1.4, seed: 'w1' };
  assert.ok(rollFile('wagon', 'dirt', 'w1') && rollShape({ ...at, kind: 'wagon' }).volume > 0, 'the rims are still there');
  assert.ok(hoofShape({ ...at, pace: 'trot', kind: 'wagon' }).volume > 0, 'and so are the hooves');
  // The rims and the chains are nearer than the horses, so the team sits under them rather than over them.
  assert.ok(hoofShape({ ...at, pace: 'trot', kind: 'wagon' }).volume < hoofShape({ ...at, pace: 'trot', kind: 'mount' }).volume,
    'a team pulling is heard under its own wagon, a mount is the whole of what you hear');
  assert.ok(hoofShape({ ...at, pace: 'trot', kind: 'wagon' }).volume < rollShape({ ...at, kind: 'wagon' }).volume, 'and under the rims');
  assert.ok(carrierSoundFiles().includes(team), 'and the team ships with the rest');
});

test('the brake goes on when it stops short; the canvas speaks only on a covered wagon at full swing', () => {
  assert.deepEqual(knocksFor({ stopping: true, seed: 'w' }).map((k) => k.kind), ['brake']);
  assert.deepEqual(knocksFor({ covered: true, swing: 0.9, seed: 'w' }).map((k) => k.kind), ['canvas']);
  assert.deepEqual(knocksFor({ covered: false, swing: 0.9, seed: 'w' }), [], 'an open wagon has no canvas');
  assert.deepEqual(knocksFor({ covered: true, swing: 0.3, seed: 'w' }), [], 'nor does a gentle sway pull on it');
});
