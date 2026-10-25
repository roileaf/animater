// Live check, run inside a Foundry world (never shipped): does a creature's stealth decide what another creature's
// view shows and hears of its movement? Select the OBSERVER token (the one whose eyes and ears this screen uses), then
// in the browser console (F12), with audio unlocked by a click on the board:
//
//   const live = await import('/modules/animater/tools/live/hidden-footsteps.mjs');
//   await live.run({ target: 'Ed' });            // a token name or id
//
// The target is walked across the floor at several distances from the observer, on this screen only (its position is
// changed locally and put back; nothing is saved). For each distance it records what Animater perceives, how many
// footsteps were asked for and how many Foundry actually played to the observer, and how many tracks were laid and
// shown, then compares that with what the rules say for the observer's PF2e Visioner state (or the target's
// conditions). A GM needs "GM perceives movement" set to As my selected token.

// How aware the observer is of the target: 'seen' (tracks show, steps heard in earshot), 'heard' (no tracks, steps
// heard in earshot) or 'unknown' (nothing). Visioner's state from observer to target first, else the target's
// conditions, else seen.
export function awarenessOf({ state, conditions = [] } = {}) {
  if (state === 'observed' || state === 'concealed') return 'seen';
  if (state === 'hidden') return 'heard';
  if (state === 'undetected' || state === 'unnoticed') return 'unknown';
  const has = (slug) => conditions.includes(slug);
  if (has('undetected') || has('unnoticed')) return 'unknown';
  if (has('hidden') || has('invisible')) return 'heard';
  return 'seen';
}

// What should happen at `distance` squares when steps carry `reach` squares: tracks shown (true/false) and steps heard
// (true/false, or null within a square of the edge of earshot, where either is fine).
export function expectedFor(awareness, distance, reach) {
  const shown = awareness === 'seen';
  if (awareness === 'unknown') return { shown, heard: false };
  if (Math.abs(distance - reach) <= 1) return { shown, heard: null };
  return { shown, heard: distance < reach };
}

// PASS, or FAIL with what went wrong, for one distance: `got` is { shown (tracks this view shows), played (steps
// Foundry played) }.
export function verdict(expected, got) {
  const problems = [];
  if (expected.shown === true && !(got.shown > 0)) problems.push('no tracks shown');
  if (expected.shown === false && got.shown > 0) problems.push('tracks shown');
  if (expected.heard === true && !(got.played > 0)) problems.push('no step heard');
  if (expected.heard === false && got.played > 0) problems.push('steps heard');
  return problems.length ? `FAIL: ${problems.join(', ')}` : 'PASS';
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isStep = (src) => /\/sounds\/surfaces\/|\/psfx\//.test(String(src));

// Walks `target` locally for `ms`, from `from` to `to` (canvas pixels, token top-left), on the canvas ticker.
async function walk(target, from, to, ms) {
  const doc = target.document, start = performance.now();
  const step = () => {
    const p = Math.min(1, (performance.now() - start) / ms);
    doc.updateSource({ x: Math.round(from.x + (to.x - from.x) * p), y: Math.round(from.y + (to.y - from.y) * p) });
    target.renderFlags.set({ refreshPosition: true });
  };
  canvas.app.ticker.add(step, undefined, PIXI.UPDATE_PRIORITY.HIGH);
  await wait(ms + 400);
  canvas.app.ticker.remove(step);
}

export async function run({ target: targetRef, distances = [2, 4, 6, 8, 12], walkSquares = 3, walkMs = 1500 } = {}) {
  const api = game.modules.get('animater')?.api;
  if (!api?.debug?.movementPerception) throw new Error('Animater with live-check support (2.1.8+) is not active.');
  const observer = canvas.tokens.controlled[0];
  if (!observer) throw new Error('Select the observer token first (the one whose view this screen uses).');
  const target = canvas.tokens.get(targetRef) ?? canvas.tokens.placeables.find((t) => t.name === targetRef);
  if (!target || target === observer) throw new Error(`No target token "${targetRef}" (other than the observer).`);
  if (game.audio.locked) ui.notifications.warn('Audio is locked: click the board once, then run again (steps cannot play).');
  if (game.user.isGM && game.settings.get('animater', 'movementGmPerception') !== 'token') {
    ui.notifications.warn('GM perceives movement is Everything: set it to As my selected token for this check.');
  }

  const grid = canvas.grid.size, distanceUnit = canvas.dimensions.distance || 5;
  const squares = (target.document.width ?? 1);
  // Steps carry the "Footstep hearing range" (Normal 6 squares), half as far again for Huge and bigger.
  const range = game.settings.get('animater', 'footstepRange') ?? 'normal';
  const reach = ({ close: 3, normal: 6, far: 10, veryFar: 15 }[range] ?? 6) * (squares >= 3 ? 1.5 : 1);
  const visioner = game.modules.get('pf2e-visioner')?.active ? game.modules.get('pf2e-visioner').api : null;
  const state = visioner?.getVisibility?.(observer.document.id, target.document.id) ?? null;
  const conditions = [...Array.from(target.actor?.statuses ?? []), ...(target.actor?.itemTypes?.condition?.map((c) => c.slug) ?? [])];
  const awareness = awarenessOf({ state, conditions });
  const home = { x: target.document.x, y: target.document.y };

  // Count the steps asked for and the ones Foundry played (it resolves to null when no listener is in earshot).
  const calls = [];
  const original = canvas.sounds.playAtPosition;
  canvas.sounds.playAtPosition = function (src, ...rest) {
    const promise = original.call(this, src, ...rest);
    if (isStep(src)) { const entry = { src, played: false }; calls.push(entry); Promise.resolve(promise).then((s) => { entry.played = !!s; }).catch(() => {}); }
    return promise;
  };

  const rows = [];
  try {
    for (const d of distances) {
      const cx = observer.center.x + d * grid, cy = observer.center.y;
      const from = { x: cx - target.w / 2, y: cy - (walkSquares / 2) * grid - target.h / 2 };
      const to = { x: from.x, y: from.y + walkSquares * grid };
      target.document.updateSource(from); target.renderFlags.set({ refreshPosition: true });
      await wait(400);
      calls.length = 0;
      const before = api.debug.movementMarks(target.id)?.total ?? 0;
      await walk(target, from, to, walkMs);
      await wait(300);
      const perceived = api.debug.movementPerception(target) ?? {};
      const marks = api.debug.movementMarks(target.id) ?? { laid: 0, shown: 0 };
      // Marks laid during this walk (a running total, so marks fading meanwhile do not count against it); shown if this
      // view shows the target's marks at all.
      const laid = Math.max(0, (marks.total ?? 0) - before);
      const got = { asked: calls.length, played: calls.filter((c) => c.played).length, laid, shown: marks.shown > 0 ? laid : 0 };
      const expected = expectedFor(awareness, d, reach);
      rows.push({ distance: `${d} sq (${d * distanceUnit} ft)`, perceived: `${perceived.visible ? 'seen' : '-'} / ${perceived.audible ? 'heard' : '-'}`,
        'steps asked': got.asked, 'steps played': got.played, 'tracks laid': got.laid, 'tracks shown': got.shown,
        expected: `${expected.shown ? 'tracks' : 'no tracks'}, ${expected.heard === null ? 'edge of earshot' : expected.heard ? 'heard' : 'silent'}`,
        result: verdict(expected, got) });
    }
  } finally {
    canvas.sounds.playAtPosition = original;
    target.document.updateSource(home); target.renderFlags.set({ refreshPosition: true });
  }

  console.log(`Animater live check: ${observer.name} watching ${target.name} — Visioner: ${state ?? 'n/a'}, conditions: ${conditions.join(', ') || 'none'} → ${awareness}; steps carry ${reach} squares.`);
  console.table(rows);
  const failed = rows.filter((r) => r.result !== 'PASS').length;
  const summary = `Animater live check: ${rows.length - failed}/${rows.length} passed (${target.name} is "${awareness}" to ${observer.name}). Details in the console.`;
  if (failed) ui.notifications.error(summary); else ui.notifications.info(summary);
  return { observer: observer.name, target: target.name, state, conditions, awareness, reach, rows };
}
