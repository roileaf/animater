// Draws a flash screen as DOM: a backdrop plus positioned layers, each driven by
// Web Animations spanning the whole screen, so the editor can scrub any moment
// (seek) and the live overlay plays the same frames. Sizes use container units, so
// a small editor frame and the full window look alike.
import { fillText, portraitPeople, MOMENT_KINDS } from "./flash-model.mjs";

const VIDEO = /\.(webm|mp4)$/i;
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const VISUAL = (l) => !MOMENT_KINDS.includes(l.kind);
const BLEND = { screen: "screen", add: "plus-lighter", multiply: "multiply", overlay: "overlay" };
// Repeatable "random" for drawn effects: the same layer looks the same every time it plays.
function seeded(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
let uid = 0;

// Off-stage state for an entrance (or, mirrored, the exit continuing the same way).
function offstage(motion, exit) {
  const flip = exit ? -1 : 1;
  switch (motion) {
    case "fade": return { opacity: 0 };
    case "slide-left": return { dx: `${-70 * flip}cqw` };
    case "slide-right": return { dx: `${70 * flip}cqw` };
    case "slide-up": return { dy: `${60 * flip}cqh` };
    case "slide-down": return { dy: `${-60 * flip}cqh` };
    case "zoom": return { scale: exit ? 1.6 : 0.2, opacity: 0 };
    case "slam": return { scale: exit ? 0.4 : 3, opacity: 0 };
    case "blur": return { blur: "1.8cqh", scale: exit ? 1.08 : 1.18, opacity: 0 };
    default: return {};
  }
}
// Type on / wipe reveal the content itself (it never moves inside its own box, so keyframes can't push it out of the clip).
const OPEN = "inset(-25% -25% -25% -25%)";
const CLIP = { type: { from: "inset(-25% 100% -25% -25%)", to: "inset(-25% -25% -25% 100%)" }, wipe: { from: "inset(100% -25% -25% -25%)", to: "inset(-25% -25% 100% -25%)" } };
const frame = (layer, state = {}, offset, easing) => ({
  offset,
  ...(easing ? { easing } : {}),
  opacity: state.opacity ?? layer.opacity,
  filter: `blur(${state.blur ?? "0px"})`,
  transform: `translate(-50%, -50%) translate(${state.dx ?? "0px"}, ${state.dy ?? "0px"}) rotate(${layer.rotate}deg) scale(${state.scale ?? 1})`,
});
const endOf = (layer, total) => (layer.duration > 0 ? Math.min(total, layer.start + layer.duration) : total);
const sorted = (frames) => { frames.sort((a, b) => a.offset - b.offset); return frames; };

// Keyframes for one layer over the whole screen (offsets are fractions of it).
export function layerKeyframes(layer, total) {
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const start = layer.start, end = endOf(layer, total);
  const shown = Math.min(end, start + layer.enterMs), leave = Math.max(shown, end - layer.exitMs);
  const hidden = { ...offstage(layer.enter, false), opacity: 0 };
  if (CLIP[layer.enter]) hidden.opacity = layer.opacity;
  const frames = [frame(layer, hidden, 0), frame(layer, { ...offstage(layer.enter, false), opacity: layer.enter === "none" ? layer.opacity : offstage(layer.enter, false).opacity ?? layer.opacity }, o(start), "cubic-bezier(.2,.8,.2,1)")];
  if (layer.enter === "slam") frames.push(frame(layer, { scale: 0.92 }, o(start + layer.enterMs * 0.7)));
  frames.push(frame(layer, {}, o(shown)));
  if (layer.shake) for (const [i, d] of [[1, 1], [2, -1], [3, 1], [4, -0.5]]) frames.push(frame(layer, { dx: `${d * 0.8}cqw`, dy: `${-d * 0.5}cqh` }, o(Math.min(leave, shown + i * 60))));
  frames.push(frame(layer, {}, o(leave), "cubic-bezier(.6,0,.8,.2)"));
  const gone = offstage(layer.exit, true);
  frames.push(frame(layer, { ...gone, opacity: layer.exit === "none" ? 0 : gone.opacity ?? layer.opacity }, o(end)));
  frames.push(frame(layer, { ...gone, opacity: CLIP[layer.exit] ? layer.opacity : 0 }, 1));
  // Offsets must never go backwards.
  for (let i = 1; i < frames.length; i++) frames[i].offset = Math.max(frames[i].offset, frames[i - 1].offset);
  return frames;
}

export function revealKeyframes(layer, total) {
  if (!CLIP[layer.enter] && !CLIP[layer.exit]) return null;
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const start = layer.start, end = endOf(layer, total);
  const shown = Math.min(end, start + layer.enterMs), leave = Math.max(shown, end - layer.exitMs);
  const from = CLIP[layer.enter]?.from ?? OPEN, to = CLIP[layer.exit]?.to ?? OPEN;
  return [{ offset: 0, clipPath: from }, { offset: o(start), clipPath: from }, { offset: o(shown), clipPath: OPEN }, { offset: o(leave), clipPath: OPEN }, { offset: o(end), clipPath: to }, { offset: 1, clipPath: to }];
}
// Letters one by one: each slams in after the one before.
export function letterKeyframes(layer, index, total) {
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const t = layer.start + index * layer.letters, from = "translateY(-0.35em) scale(2.4)";
  return [{ offset: 0, opacity: 0, transform: from }, { offset: o(t), opacity: 0, transform: from, easing: "cubic-bezier(.2,.9,.3,1.3)" }, { offset: o(t + 260), opacity: 1, transform: "none" }, { offset: 1, opacity: 1, transform: "none" }];
}
// Words one by one: each rises into place after the one before.
export function wordKeyframes(layer, index, total) {
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const t = layer.start + index * layer.words, from = "translateY(0.45em) scale(0.85)";
  return [{ offset: 0, opacity: 0, transform: from, filter: "blur(0.15em)" }, { offset: o(t), opacity: 0, transform: from, filter: "blur(0.15em)", easing: "cubic-bezier(.2,.8,.2,1)" }, { offset: o(t + 320), opacity: 1, transform: "none", filter: "blur(0)" }, { offset: 1, opacity: 1, transform: "none", filter: "blur(0)" }];
}
// Portraits pop up one after another; a slash cut-in tears in from the side instead.
export function popKeyframes(layer, index, total) {
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const slash = layer.shape === "slash";
  const t = layer.start + index * layer.stagger, from = slash ? "translateX(-45cqw) skewX(-18deg)" : "translateY(35%) scale(0.6)";
  return [{ offset: 0, opacity: 0, transform: from }, { offset: o(t), opacity: 0, transform: from, easing: slash ? "cubic-bezier(.15,.95,.25,1.1)" : "cubic-bezier(.2,.9,.3,1.25)" }, { offset: o(t + (slash ? 260 : 320)), opacity: 1, transform: "none" }, { offset: 1, opacity: 1, transform: "none" }];
}
const textGlow = (layer, glow) => {
  if (!(layer.glowSize > 0)) return layer.gradient ? { filter: "none" } : { textShadow: "none" };
  const parts = [1, 2, 3].map((k) => (layer.glowSize * 0.5 * k).toFixed(2));
  return layer.gradient ? { filter: parts.slice(0, 2).map((g) => `drop-shadow(0 0 ${g}cqh ${glow})`).join(" ") } : { textShadow: parts.map((g) => `0 0 ${g}cqh ${glow}`).join(",") };
};
// Text colour and glow changing between keyframes (keys without them keep the layer's own).
export function colorKeyframes(layer, total) {
  const keys = layer.kind === "text" ? layer.keys ?? [] : [];
  if (!keys.some((k) => k.color || k.glow)) return null;
  const easing = layer.keyEase === "linear" ? "linear" : "ease-in-out";
  const at = (k, offset) => ({ offset, easing, ...(layer.gradient ? {} : { color: k.color ?? layer.color }), ...textGlow(layer, k.glow ?? layer.glow) });
  return [at(keys[0], 0), ...keys.map((k) => at(k, Math.min(1, k.at / total))), at(keys.at(-1), 1)];
}
// Outline, then fill: the letters' outline sweeps across, then the fill pours in.
export function outlineKeyframes(layer, total) {
  if (layer.kind !== "text" || layer.enter !== "outline") return null;
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const start = layer.start, draw = start + layer.enterMs * 0.6, filled = start + layer.enterMs;
  return {
    line: [{ offset: 0, clipPath: "inset(-25% 100% -25% -25%)", opacity: 1 }, { offset: o(start), clipPath: "inset(-25% 100% -25% -25%)", opacity: 1, easing: "ease-in-out" }, { offset: o(draw), clipPath: "inset(-25% -25% -25% -25%)", opacity: 1 }, { offset: o(filled), clipPath: "inset(-25% -25% -25% -25%)", opacity: 1 }, { offset: o(filled + 250), clipPath: "inset(-25% -25% -25% -25%)", opacity: 0 }, { offset: 1, clipPath: "inset(-25% -25% -25% -25%)", opacity: 0 }],
    fill: [{ offset: 0, opacity: 0 }, { offset: o(draw - layer.enterMs * 0.1), opacity: 0, easing: "ease-out" }, { offset: o(filled), opacity: 1 }, { offset: 1, opacity: 1 }],
  };
}
// Keyframed motion, relative to the layer's own place: position, scale, rotation, opacity.
export function motionKeyframes(layer, total) {
  const keys = layer.keys ?? [];
  if (!keys.length) return null;
  const easing = layer.keyEase === "linear" ? "linear" : "ease-in-out";
  const at = (k, offset) => ({ offset, easing, opacity: k.opacity, transform: `translate(${(k.x - layer.x).toFixed(2)}cqw, ${(k.y - layer.y).toFixed(2)}cqh) rotate(${k.rotate}deg) scale(${k.scale})` });
  return [at(keys[0], 0), ...keys.map((k) => at(k, Math.min(1, k.at / total))), at(keys.at(-1), 1)];
}
// A repeating effect while the layer is on screen.
const LOOPS = {
  pulse: [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
  glow: [{ filter: "brightness(1)" }, { filter: "brightness(1.6)" }, { filter: "brightness(1)" }],
  heartbeat: [{ offset: 0, transform: "scale(1)" }, { offset: 0.14, transform: "scale(1.12)" }, { offset: 0.28, transform: "scale(1)" }, { offset: 0.42, transform: "scale(1.07)" }, { offset: 0.6, transform: "scale(1)" }, { offset: 1, transform: "scale(1)" }],
  glitch: [{ offset: 0, transform: "none", filter: "none" }, { offset: 0.04, transform: "translate(-0.8cqw, 0) skewX(-14deg)", filter: "hue-rotate(90deg) saturate(2)" }, { offset: 0.08, transform: "translate(0.7cqw, 0.3cqh)", filter: "hue-rotate(-70deg)" }, { offset: 0.12, transform: "none", filter: "none" }, { offset: 1, transform: "none", filter: "none" }],
  flicker: [{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }, { opacity: 0.8 }, { opacity: 1 }],
  wobble: [{ transform: "rotate(0deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(3deg)" }, { transform: "rotate(0deg)" }],
  float: [{ transform: "translateY(0)" }, { transform: "translateY(-1.2cqh)" }, { transform: "translateY(0)" }],
  spin: [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
};
export function loopTiming(layer, total) {
  if (!LOOPS[layer.loop]) return null;
  const end = endOf(layer, total);
  return { keyframes: LOOPS[layer.loop], options: { delay: layer.start, duration: layer.loopMs, iterations: Math.max(1, (end - layer.start) / layer.loopMs), easing: layer.loop === "glitch" ? "linear" : "ease-in-out", fill: "none" } };
}
// A full-screen flash: up fast, then fading.
export function screenFlashKeyframes(layer, total) {
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const peak = layer.start + Math.min(60, layer.duration / 4);
  return [{ offset: 0, opacity: 0 }, { offset: o(layer.start), opacity: 0 }, { offset: o(peak), opacity: layer.strength, easing: "ease-out" }, { offset: o(layer.start + layer.duration), opacity: 0 }, { offset: 1, opacity: 0 }];
}
// Screen shakes jolt every visual layer together, fading out over each shake.
export function shakeKeyframes(layers, total) {
  const shakes = layers.filter((l) => l.kind === "shake" && l.duration > 0);
  if (!shakes.length) return null;
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const X = [1, -0.8, 0.6, -1, 0.9, -0.5], Y = [-0.6, 0.9, -1, 0.4, -0.7, 1];
  const frames = [{ offset: 0, transform: "none" }, { offset: 1, transform: "none" }];
  for (const s of shakes) {
    frames.push({ offset: o(s.start), transform: "none" });
    for (let t = s.start + 35, k = 0; t < s.start + s.duration; t += 35, k++) {
      const amp = s.strength * (1 - (t - s.start) / s.duration);
      frames.push({ offset: o(t), transform: `translate(${(X[k % 6] * amp).toFixed(2)}cqh, ${(Y[k % 6] * amp).toFixed(2)}cqh)` });
    }
    frames.push({ offset: o(s.start + s.duration), transform: "none" });
  }
  return sorted(frames);
}

// Camera punches: the whole card zooms in hard, then eases back.
export function punchKeyframes(layers, total) {
  const punches = layers.filter((l) => l.kind === "punch" && l.duration > 0);
  if (!punches.length) return null;
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const frames = [{ offset: 0, transform: "none" }, { offset: 1, transform: "none" }];
  for (const p of punches) {
    frames.push({ offset: o(p.start), transform: "scale(1)", easing: "cubic-bezier(.1,.9,.3,1)" });
    frames.push({ offset: o(p.start + p.duration * 0.22), transform: `scale(${p.strength})`, easing: "cubic-bezier(.5,0,.3,1)" });
    frames.push({ offset: o(p.start + p.duration), transform: "scale(1)" });
  }
  return sorted(frames);
}

// Drawn effects: speed lines, a light burst, a slash, particles.
function linesHTML(layer, index) {
  const rnd = seeded(layer.id + "lines"), clear = layer.clear * 0.5, groups = [[], []];
  for (let n = 0; n < layer.density; n++) {
    const a = rnd() * Math.PI * 2, w = (0.004 + rnd() * 0.012) * Math.PI, r0 = clear * (0.8 + rnd() * 0.5), r1 = 75;
    const p = (r, ang) => `${(Math.cos(ang) * r).toFixed(2)},${(Math.sin(ang) * r).toFixed(2)}`;
    groups[n % 2].push(`<polygon points="${p(r0, a)} ${p(r1, a - w)} ${p(r1, a + w)}" opacity="${(0.45 + rnd() * 0.55).toFixed(2)}"/>`);
  }
  return `<svg class="an-flash-drawn" viewBox="-50 -50 100 100" style="width:${layer.width}cqw;height:${layer.width}cqw" fill="${layer.color}">${groups.map((g, i) => `<g data-flash-flick="${i}">${g.join("")}</g>`).join("")}</svg>`;
}
function burstHTML(layer) {
  const rnd = seeded(layer.id + "burst"), id = `an-burst-${++uid}`, rays = [];
  for (let n = 0; n < layer.density; n++) {
    const a = (n / layer.density + rnd() * 0.4 / layer.density) * Math.PI * 2, w = (0.012 + rnd() * 0.03) * Math.PI;
    const p = (ang) => `${(Math.cos(ang) * 50).toFixed(2)},${(Math.sin(ang) * 50).toFixed(2)}`;
    rays.push(`<polygon points="0,0 ${p(a - w)} ${p(a + w)}" opacity="${(0.5 + rnd() * 0.5).toFixed(2)}"/>`);
  }
  return `<svg class="an-flash-drawn" viewBox="-50 -50 100 100" style="width:${layer.width}cqw;height:${layer.width}cqw"><defs><radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="50"><stop offset="0" stop-color="${layer.color}" stop-opacity="1"/><stop offset="0.35" stop-color="${layer.color}" stop-opacity="0.55"/><stop offset="1" stop-color="${layer.color}" stop-opacity="0"/></radialGradient></defs><g data-flash-spin fill="url(#${id})">${rays.join("")}</g><circle r="9" fill="url(#${id})"/></svg>`;
}
function slashHTML(layer) {
  return `<span class="an-flash-slash" style="width:${layer.width}cqw;height:${layer.height}cqh;background:linear-gradient(90deg, transparent 0%, ${layer.color} 30%, #ffffff 50%, ${layer.color} 70%, transparent 100%);box-shadow:0 0 ${(layer.height * 1.6).toFixed(2)}cqh ${layer.color}"></span>`;
}
// The slash draws across fast, then thins away.
export function slashKeyframes(layer, total) {
  const o = (ms) => Math.min(1, Math.max(0, ms / total));
  const end = endOf(layer, total), drawn = Math.min(end, layer.start + 160);
  return [{ offset: 0, clipPath: "inset(0 100% 0 0)", transform: "scaleY(1)" }, { offset: o(layer.start), clipPath: "inset(0 100% 0 0)", transform: "scaleY(1)", easing: "cubic-bezier(.2,.9,.2,1)" }, { offset: o(drawn), clipPath: "inset(0 0 0 0)", transform: "scaleY(1)", easing: "ease-in" }, { offset: o(end), clipPath: "inset(0 0 0 0)", transform: "scaleY(0.25)" }, { offset: 1, clipPath: "inset(0 0 0 0)", transform: "scaleY(0.25)" }];
}
const PARTICLES = {
  embers: { w: 0.55, h: 0.55, round: "50%", glow: 1, sway: 2.2, base: 3200 },
  sparks: { w: 0.22, h: 1.9, round: "40%", glow: 0.6, sway: 0.5, base: 1100 },
  snow: { w: 0.7, h: 0.7, round: "50%", glow: 0.4, sway: 3, base: 5200 },
  ash: { w: 0.6, h: 0.42, round: "25%", glow: 0, sway: 3, base: 4600, spin: true },
  petals: { w: 1.4, h: 0.85, round: "100% 0", glow: 0, sway: 3.5, base: 4300, spin: true },
  blood: { w: 0.38, h: 1.5, round: "50% 50% 50% 50% / 65% 65% 35% 35%", glow: 0, sway: 0, base: 900 },
};
// One particle's path across the stage (repeats while the layer shows).
export function particleKeyframes(layer, p) {
  const kind = PARTICLES[layer.ptype], vertical = ["up", "down"].includes(layer.direction);
  const forward = ["down", "right"].includes(layer.direction);
  const frames = [];
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const along = forward ? -6 + 112 * t : 106 - 112 * t, cross = Math.sin((t + p.phase) * Math.PI * 2) * kind.sway * p.sway;
    const [x, y] = vertical ? [`${cross.toFixed(2)}cqw`, `${along.toFixed(2)}cqh`] : [`${along.toFixed(2)}cqw`, `${cross.toFixed(2)}cqh`];
    frames.push({ offset: t, opacity: t === 0 || t === 1 ? 0 : p.alpha, transform: `translate(${x}, ${y}) rotate(${(kind.spin ? p.spin * t : 0).toFixed(0)}deg)` });
  }
  frames[1].opacity = p.alpha;
  return frames;
}
export function particleSpecs(layer, total) {
  const rnd = seeded(layer.id + layer.ptype), kind = PARTICLES[layer.ptype];
  return Array.from({ length: layer.count }, () => {
    const cycle = (kind.base / layer.speed) * (0.75 + rnd() * 0.5);
    return { at: rnd() * 100, scale: layer.size * (0.6 + rnd() * 0.8), alpha: 0.55 + rnd() * 0.45, sway: 0.4 + rnd() * 0.8, phase: rnd(), spin: (rnd() > 0.5 ? 1 : -1) * (200 + rnd() * 340), cycle, delay: -rnd() * cycle, iterations: Math.ceil(total / cycle) + 2 };
  });
}
function particlesHTML(layer, specs) {
  const kind = PARTICLES[layer.ptype], vertical = ["up", "down"].includes(layer.direction);
  return `<span class="an-flash-particles">${specs.map((p) => {
    const [w, h] = vertical ? [kind.w, kind.h] : [kind.h, kind.w];
    const place = vertical ? `left:${p.at.toFixed(1)}%;top:0` : `top:${p.at.toFixed(1)}%;left:0`;
    return `<i data-flash-particle style="${place};width:${(w * p.scale).toFixed(2)}cqh;height:${(h * p.scale).toFixed(2)}cqh;border-radius:${kind.round};background:${layer.color};${kind.glow ? `box-shadow:0 0 ${(kind.glow * p.scale).toFixed(2)}cqh ${layer.color};` : ""}"></i>`;
  }).join("")}</span>`;
}

function textHTML(layer, vars) {
  const glowParts = [1, 2, 3].map((k) => (layer.glowSize * 0.5 * k).toFixed(2));
  // A gradient fill needs the glow as a filter (a text shadow would show through the clear letters).
  const glow = layer.glowSize > 0 ? (layer.gradient ? `filter:${glowParts.slice(0, 2).map((g) => `drop-shadow(0 0 ${g}cqh ${layer.glow})`).join(" ")};` : `text-shadow:${glowParts.map((g) => `0 0 ${g}cqh ${layer.glow}`).join(",")};`) : "";
  const fill = layer.gradient ? `background:linear-gradient(180deg, ${layer.color} 15%, ${layer.gradientTo} 85%);-webkit-background-clip:text;background-clip:text;color:transparent;` : `color:${layer.color};`;
  const text = fillText(layer.text, vars);
  const split = layer.letters > 0 || layer.words > 0;
  let word = 0;
  const body = layer.letters > 0
    ? [...text].map((c, i) => (c === " " || c === "\n" ? esc(c) : `<span class="an-flash-char" data-flash-char="${i}"${layer.gradient ? ` style="${fill}"` : ""}>${esc(c)}</span>`)).join("")
    : layer.words > 0
      ? text.split(/(\s+)/).map((w) => (!w || /^\s+$/.test(w) ? esc(w) : `<span class="an-flash-word" data-flash-word="${word++}"${layer.gradient ? ` style="${fill}"` : ""}>${esc(w)}</span>`)).join("")
      : esc(text);
  const font = `font-family:'${esc(layer.font)}',Signika,sans-serif;font-size:${layer.size}cqh;font-weight:${layer.bold ? 800 : 400};font-style:${layer.italic ? "italic" : "normal"};letter-spacing:${layer.spacing}em`;
  const main = `<span class="an-flash-text" data-flash-fill style="${font};${layer.gradient && split ? `color:${layer.color};` : fill}-webkit-text-stroke:${(layer.size * 0.035).toFixed(2)}cqh ${layer.outline};${glow}">${body}</span>`;
  if (layer.enter !== "outline") return main;
  // The outline that draws itself sits over the text, in the text's own colour.
  const line = layer.gradient ? layer.gradientTo : layer.color;
  return `<span class="an-flash-outline-wrap">${main}<span class="an-flash-text is-outline" data-flash-line aria-hidden="true" style="${font};color:transparent;-webkit-text-stroke:${Math.max(0.12, layer.size * 0.03).toFixed(2)}cqh ${line};filter:drop-shadow(0 0 ${(layer.size * 0.06).toFixed(2)}cqh ${line})">${esc(text)}</span></span>`;
}
function portraitsHTML(layer, vars, editing) {
  const people = portraitPeople(layer, vars.combatants, vars.actor);
  // Nobody to show: a note in the editor, nothing at the table.
  if (!people.length && !editing) return "";
  if (!people.length) return `<span class="an-flash-missing">${layer.side === "actor" ? "No one is using an action" : `No ${layer.side === "enemies" ? "enemies" : layer.side === "party" ? "party members" : "combatants"} in this encounter`}</span>`;
  const wide = layer.shape === "slash" ? 1.7 : 1;
  const face = (p, n) => `<span class="an-flash-person" data-flash-pop="${n}"><span class="an-flash-face is-${layer.shape}" style="width:${(layer.size * wide).toFixed(2)}cqh;height:${layer.size}cqh;border-color:${layer.ring};${layer.shape === "slash" ? `filter:drop-shadow(0.6cqh 0 0 ${layer.ring}) drop-shadow(-0.6cqh 0 0 ${layer.ring})` : ""}"><img src="${esc(layer.art === "portrait" ? p.portrait || p.img : p.img || p.portrait)}" alt=""></span>${layer.names ? `<span class="an-flash-name" style="font-size:${(layer.size * 0.13).toFixed(2)}cqh">${esc(p.name)}</span>` : ""}</span>`;
  // Rows of perRow (0 = one line); each row is centred, so a short last row sits in the middle.
  const per = layer.perRow > 0 ? layer.perRow : people.length, rows = [];
  for (let i = 0; i < people.length; i += per) rows.push(people.slice(i, i + per).map((p, k) => face(p, i + k)).join(""));
  return `<span class="an-flash-portraits" style="gap:${layer.gap}cqw">${rows.map((r) => `<span class="an-flash-portrait-row" style="gap:${layer.gap}cqw">${r}</span>`).join("")}</span>`;
}
function layerHTML(layer, { resolveMedia, vars, specs, editing }) {
  if (layer.kind === "text") return textHTML(layer, vars);
  if (layer.kind === "lines") return linesHTML(layer);
  if (layer.kind === "burst") return burstHTML(layer);
  if (layer.kind === "slash") return slashHTML(layer);
  if (layer.kind === "particles") return particlesHTML(layer, specs);
  if (layer.kind === "portraits") return portraitsHTML(layer, vars, editing);
  if (layer.kind === "image") {
    const src = resolveMedia?.(layer.src) ?? layer.src;
    if (!src) return !editing ? "" : `<span class="an-flash-missing" style="width:${layer.width}cqw">Choose an image</span>`;
    return VIDEO.test(src) ? `<video src="${esc(src)}" muted autoplay loop playsinline style="width:${layer.width}cqw"></video>` : `<img src="${esc(src)}" alt="" style="width:${layer.width}cqw">`;
  }
  return `<span class="an-flash-band" style="width:${layer.width}cqw;height:${layer.height}cqh;background:${layer.color};transform:skewX(${layer.skew}deg)"></span>`;
}

// container: the element to draw into. Returns { el, seek(ms), play(), stop() }.
// skip: layer indexes muted in the editor (kept in place, but not drawn, flashed, shaken or heard).
export function createFlash(container, screen, { resolveMedia, vars = {}, editing = false, playSound, skip = new Set() } = {}) {
  const el = document.createElement("div");
  el.className = `an-flash${editing ? " is-editing" : ""}`;
  const b = screen.backdrop;
  const bg = b.media ? resolveMedia?.(b.media) ?? b.media : "";
  const total = screen.duration;
  const specs = screen.layers.map((l) => (l.kind === "particles" ? particleSpecs(l, total) : null));
  // The backdrop sits inside the stage (camera), so blend modes mix with it and punches zoom it too.
  el.innerHTML = `<div class="an-flash-stage"><div class="an-flash-camera"><div class="an-flash-backdrop" style="background:${b.color}"></div>${bg ? (VIDEO.test(bg) ? `<video class="an-flash-bg" src="${esc(bg)}" muted autoplay loop playsinline></video>` : `<img class="an-flash-bg" src="${esc(bg)}" alt="">`) : ""}${b.vignette ? `<div class="an-flash-vignette"></div>` : ""}`
    + `${screen.layers.map((l, i) => (VISUAL(l) ? `<div class="an-flash-layer is-${l.kind}${skip.has(i) ? " is-muted" : ""}" data-flash-layer="${i}" style="left:${l.x}%;top:${l.y}%;${BLEND[l.blend] ? `mix-blend-mode:${BLEND[l.blend]}` : ""}"><div class="an-flash-motion"><div class="an-flash-fx">${layerHTML(l, { resolveMedia, vars, specs: specs[i], editing })}</div></div></div>` : "")).join("")}</div></div>`
    + screen.layers.map((l, i) => (l.kind === "flash" && !skip.has(i) ? `<div class="an-flash-fill" data-flash-fill="${i}" style="background:${l.color}"></div>` : "")).join("")
    + (b.bars ? `<div class="an-flash-bar is-top" style="height:${b.barSize}cqh"></div><div class="an-flash-bar is-bottom" style="height:${b.barSize}cqh"></div>` : "");
  container.append(el);
  const timing = { duration: total, fill: "both" };
  const fadeIn = Math.min(300, total / 4), fadeOut = Math.min(400, total / 4), slide = Math.min(450, total / 4);
  const shake = shakeKeyframes(screen.layers.filter((l, i) => !skip.has(i)), total);
  const punch = punchKeyframes(screen.layers.filter((l, i) => !skip.has(i)), total);
  const animations = [
    ...[el.querySelector(".an-flash-backdrop"), el.querySelector(".an-flash-vignette")].filter(Boolean).map((node, i) => node.animate([
      { offset: 0, opacity: 0 }, { offset: fadeIn / total, opacity: i ? 1 : b.opacity },
      { offset: 1 - fadeOut / total, opacity: i ? 1 : b.opacity }, { offset: 1, opacity: 0 }], timing)),
    ...[el.querySelector(".an-flash-bg")].filter(Boolean).map((node) => node.animate([
      { offset: 0, opacity: 0 }, { offset: fadeIn / total, opacity: b.mediaOpacity }, { offset: 1 - fadeOut / total, opacity: b.mediaOpacity }, { offset: 1, opacity: 0 }], timing)),
    ...[...el.querySelectorAll(".an-flash-bar")].map((bar) => {
      const away = bar.classList.contains("is-top") ? "translateY(-100%)" : "translateY(100%)";
      return bar.animate([{ offset: 0, transform: away }, { offset: slide / total, transform: "translateY(0)", easing: "ease-in" }, { offset: 1 - slide / total, transform: "translateY(0)", easing: "ease-in" }, { offset: 1, transform: away }], timing);
    }),
    ...(shake ? [el.querySelector(".an-flash-stage").animate(shake, timing)] : []),
    ...(punch ? [el.querySelector(".an-flash-camera").animate(punch, timing)] : []),
    ...screen.layers.flatMap((l, i) => {
      if (l.kind === "flash") return skip.has(i) ? [] : [el.querySelector(`[data-flash-fill="${i}"]`).animate(screenFlashKeyframes(l, total), timing)];
      if (!VISUAL(l)) return [];
      const node = el.querySelector(`[data-flash-layer="${i}"]`), motion = motionKeyframes(l, total), loop = loopTiming(l, total), reveal = revealKeyframes(l, total);
      const colors = colorKeyframes(l, total), outline = outlineKeyframes(l, total);
      const repeat = (duration) => ({ duration, iterations: Math.ceil(total / duration) + 1 });
      return [
        ...(colors ? [node.querySelector("[data-flash-fill]").animate(colors, timing)] : []),
        ...(outline ? [node.querySelector("[data-flash-line]").animate(outline.line, timing), node.querySelector("[data-flash-fill]").animate(outline.fill, timing)] : []),
        ...[...node.querySelectorAll("[data-flash-word]")].map((w, n) => w.animate(wordKeyframes(l, n, total), timing)),
        ...[...node.querySelectorAll("[data-flash-flick]")].map((g, n) => g.animate(n ? [{ opacity: 0 }, { offset: 0.5, opacity: 0 }, { offset: 0.5, opacity: 1 }, { opacity: 1 }] : [{ opacity: 1 }, { offset: 0.5, opacity: 1 }, { offset: 0.5, opacity: 0 }, { opacity: 0 }], repeat(140))),
        ...[...node.querySelectorAll("[data-flash-spin]")].map((g) => g.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(30deg)" }], timing)),
        ...(l.kind === "slash" ? [node.querySelector(".an-flash-slash").animate(slashKeyframes(l, total), timing)] : []),
        ...[...node.querySelectorAll("[data-flash-particle]")].map((p, n) => { const s = specs[i][n]; return p.animate(particleKeyframes(l, s), { duration: s.cycle, delay: s.delay, iterations: s.iterations, easing: "linear" }); }),
        node.animate(layerKeyframes(l, total), timing),
        ...(motion ? [node.querySelector(".an-flash-motion").animate(motion, timing)] : []),
        ...(loop ? [node.querySelector(".an-flash-fx").animate(loop.keyframes, loop.options)] : []),
        ...(reveal && node.querySelector(".an-flash-fx > *") ? [node.querySelector(".an-flash-fx > *").animate(reveal, timing)] : []),
        ...[...node.querySelectorAll("[data-flash-char]")].map((c, n) => c.animate(letterKeyframes(l, n, total), timing)),
        ...[...node.querySelectorAll("[data-flash-pop]")].map((p, n) => p.animate(popKeyframes(l, n, total), timing)),
      ];
    }),
  ];
  for (const a of animations) a.pause();
  const timers = [];
  return {
    el,
    seek(ms) { for (const a of animations) { a.pause(); a.currentTime = Math.max(0, Math.min(total, ms)); } },
    // Where playback is now (ms).
    time: () => Number(animations[0]?.currentTime ?? 0),
    play() {
      for (const a of animations) { a.currentTime = 0; a.play(); }
      // Sound layers fire at their start times.
      for (const [i, l] of screen.layers.entries()) // A trimmed sound (duration) stops there; otherwise the whole file plays.
      if (l.kind === "sound" && l.file && playSound && !skip.has(i)) timers.push(setTimeout(() => playSound(l.file, l.volume, l.duration > 0 ? l.duration : 0), l.start));
      return animations[0] ? animations[0].finished.catch(() => {}) : Promise.resolve();
    },
    stop() { for (const t of timers) clearTimeout(t); timers.length = 0; for (const a of animations) a.cancel(); el.remove(); },
  };
}
