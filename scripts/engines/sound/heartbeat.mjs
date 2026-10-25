// The heartbeat a player hears when their own creature is hit, in step with lens blood's tunnel vision: a few heavy
// beats that slow and fade as the tunnel eases out (harder hits louder, faster, more beats), and while the creature
// stays at or under a quarter of its HP in combat, a quiet lingering beat that quickens the lower it gets.
// Synthesized in WebAudio (no recording): each beat a low "lub" thump (68 -> 45 Hz) with a soft click, then a softer
// "dub" (60 -> 42 Hz) about 0.3 s later. Non-positional: it is the player's own body.

import { qualityRank } from '../../core/quality.mjs';
import { LENS_BLOOD } from '../camera/lens-blood.mjs';

export const HEARTBEAT = Object.freeze({ volume: 0.55 });
const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const lerp = (a, b, t) => a + (b - a) * t;
const r3 = (v) => Math.round(v * 1000) / 1000;

// Whether this screen hears it at all: players only, its own switch, gore not off, quality not Off.
export const heartbeatWanted = ({ isGM = false, on = true, quality = 'full', gore = 'full' } = {}) =>
  !isGM && on !== false && gore !== 'off' && qualityRank(quality) > 0;

/** The beats of one hit at a level 0..1 (the tunnel level): [{ at, gain, dubAt, dubGain }] (ms from now, 0..1). */
export function heartbeatPlan(level, { amount = 'heavy' } = {}) {
  const l = clamp01(level);
  if (l <= 0) return [];
  const subtle = amount === 'subtle';
  const count = Math.min(6, (subtle ? 1 : 2) + Math.round((subtle ? 3 : 4) * l));
  const until = LENS_BLOOD.tunnelMs(l);
  let gap = lerp(900, 520, l), gain = lerp(0.35, 1, l) * (subtle ? 0.6 : 1), at = 0;
  const beats = [];
  for (let i = 0; i < count && at < until; i++) {
    beats.push({ at: Math.round(at), gain: r3(gain), dubAt: Math.round(Math.min(320, Math.max(220, gap * 0.34))), dubGain: r3(gain * 0.6) });
    at += gap;
    gap *= 1.14;
    gain *= 0.78;
  }
  return beats;
}

/**
 * The lingering beat for a creature's HP (hp-state.mjs state) or null: at or under a quarter of max HP, in combat,
 * not down or unconscious, on a player's screen with the switch on. { intervalMs, gain, dubAt, dubGain }. Cinematic, not
 * medical: quick and tense at a quarter HP, then slower, heavier and fainter in its second beat as death nears (about
 * 85 bpm down to 40), as if consciousness is slipping.
 */
export function heartbeatLinger(state, { isGM = false, on = true, inCombat = false, quality = 'full', gore = 'full', amount = 'heavy' } = {}) {
  if (!heartbeatWanted({ isGM, on, quality, gore }) || !inCombat || !state || state.down || state.unconscious || !(state.max > 0)) return null;
  const left = state.marked ? (state.max - state.value) / state.max : state.value / state.max;
  if (left > LENS_BLOOD.lowHp) return null;
  const low = 1 - left / LENS_BLOOD.lowHp;
  const gain = r3((amount === 'subtle' ? 0.1 : 0.18) + 0.06 * low), fade = low;
  return { intervalMs: Math.round(lerp(700, 1500, fade)), gain, dubAt: Math.round(lerp(260, 420, fade)), dubGain: r3(gain * lerp(0.6, 0.3, fade)) };
}

// One thump: a sine falling in pitch under a quick attack and decay, optionally with a short filtered click.
function thump(ctx, out, when, { from, to, gain, decay, click }) {
  const nodes = [];
  const osc = ctx.createOscillator(), env = ctx.createGain();
  osc.frequency.setValueAtTime(from, when);
  osc.frequency.exponentialRampToValueAtTime(to, when + decay * 0.7);
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(gain, when + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  osc.connect(env).connect(out);
  osc.start(when);
  osc.stop(when + decay + 0.05);
  nodes.push(osc, env);
  if (click) {
    const n = Math.max(1, Math.round(ctx.sampleRate * 0.012)), buffer = ctx.createBuffer(1, n, ctx.sampleRate), data = buffer.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; data[i] = ((seed / 2147483647) * 2 - 1) * (1 - i / n); }
    const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), cg = ctx.createGain();
    src.buffer = buffer;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, when);
    cg.gain.setValueAtTime(gain * 0.15, when);
    src.connect(lp).connect(cg).connect(out);
    src.start(when);
    nodes.push(src, lp, cg);
  }
  return nodes;
}

/**
 * Plays a plan on an AudioContext into `destination` at `volume` (0..1, times HEARTBEAT.volume). Answers a stop
 * function, or null when silent.
 */
export function playHeartbeat(ctx, destination, plan, { volume = 1 } = {}) {
  const level = clamp01(volume) * HEARTBEAT.volume;
  if (!ctx || !destination || !plan?.length || level <= 0) return null;
  const master = ctx.createGain();
  master.gain.setValueAtTime(level, ctx.currentTime);
  master.connect(destination);
  const start = ctx.currentTime + 0.02, nodes = [master];
  for (const beat of plan) {
    const t = start + beat.at / 1000;
    nodes.push(...thump(ctx, master, t, { from: 68, to: 45, gain: beat.gain, decay: 0.2, click: true }));
    nodes.push(...thump(ctx, master, t + beat.dubAt / 1000, { from: 60, to: 42, gain: beat.dubGain, decay: 0.16, click: false }));
  }
  return () => {
    for (const n of nodes) { try { n.stop?.(); } catch { /* not started or stopped */ } try { n.disconnect?.(); } catch { /* gone */ } }
  };
}
