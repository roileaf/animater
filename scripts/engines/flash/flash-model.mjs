import { uuid } from "../../core/uuid.mjs";
// Flash screens: full-screen title cards played to everyone when combat starts
// or ends ("Roll for Initiative!", "Victory"). The GM builds them from text,
// image and band layers, each with a position, timing, entrance and exit.
export const FLASH_EVENTS = Object.freeze({
  initiated: "Combat initiated", start: "Combat start", end: "Combat end", any: "Combat start or end", action: "Before an animation",
  round: "New round", crit: "Critical hit", enemyDown: "Enemy defeated", lastEnemy: "Last enemy standing", finalEnemy: "Last enemy falls", partyDown: "Party member down",
});
// Moments around combat (not start or end): one default each, set on the Flash screens page.
// "initiated" plays when an encounter gets its first combatants, before the GM begins it.
export const MOMENT_EVENTS = ["initiated", "round", "crit", "enemyDown", "lastEnemy", "finalEnemy", "partyDown"];
// Animated backgrounds: JB2A loops that fill the screen behind the layers.
export const FLASH_BACKGROUNDS = Object.freeze({
  "": "None", "jb2a.screen_overlay.01.bad_omen": "Bad omen", "jb2a.ambient_fog.001.loop.large.white": "Fog",
  "jb2a.ambient_fog.001.loop.large.purplered": "Crimson fog", "jb2a.ambient_fog.001.loop.large.orangeyellow": "Ember fog", "jb2a.call_lightning.low_res.blue": "Storm", "jb2a.darkness.black": "Darkness",
  "jb2a.fireflies.many.01": "Fireflies", "jb2a.sleet_storm.01.blue": "Sleet", "jb2a.magic_signs.circle.02": "Runes", "jb2a.energy_field.01.blue": "Energy field",
});
export const FLASH_MOTIONS = Object.freeze({
  none: "None", fade: "Fade", "slide-left": "Slide from left", "slide-right": "Slide from right",
  "slide-up": "Rise from below", "slide-down": "Drop from above", zoom: "Zoom", slam: "Slam",
  type: "Type on / wipe off", wipe: "Wipe", blur: "Blur in / out", outline: "Outline, then fill (text)",
});
// Effects that repeat while a layer is on screen.
export const FLASH_LOOPS = Object.freeze({ none: "None", pulse: "Pulse", glow: "Glow pulse", heartbeat: "Heartbeat", glitch: "Glitch", flicker: "Flicker", wobble: "Wobble", float: "Float", spin: "Spin" });
export const KEY_LIMIT = 12;
export const FLASH_KINDS = Object.freeze({
  text: "Text", image: "Image or video", portraits: "Portraits", band: "Color band",
  lines: "Speed lines", burst: "Light burst", slash: "Slash streak", particles: "Particles",
  sound: "Sound", flash: "Screen flash", shake: "Screen shake", punch: "Camera punch",
});
// Layers that are moments for the whole screen (no place on the stage).
export const MOMENT_KINDS = Object.freeze(["sound", "flash", "shake", "punch"]);
// How a layer mixes with what is under it (Screen and Add make black-backed JB2A videos glow).
export const FLASH_BLENDS = Object.freeze({ normal: "Normal", screen: "Screen", add: "Add (glow)", multiply: "Multiply", overlay: "Overlay" });
export const PARTICLE_TYPES = Object.freeze({ embers: "Embers", sparks: "Sparks", snow: "Snow", ash: "Ash", petals: "Petals", blood: "Blood" });
const PARTICLE_DEFAULTS = { embers: ["up", "#ff8a2a"], sparks: ["up", "#ffe27a"], snow: ["down", "#ffffff"], ash: ["up", "#9a9a9a"], petals: ["down", "#ff9ec4"], blood: ["down", "#8a0000"] };
export const PARTICLE_DIRECTIONS = Object.freeze({ up: "Up", down: "Down", left: "Left", right: "Right" });
// The game scene behind the card while it shows (on each player's own screen).
export const SCENE_LOOKS = Object.freeze({ normal: "As is", grey: "Frozen grey", dark: "Darkened", sepia: "Old photo" });
// Portraits fill in from the encounter when the screen plays.
export const PORTRAIT_SIDES = Object.freeze({ actor: "The one using the action (cut-in)", party: "The party", enemies: "The enemies", boss: "The boss (strongest enemy)", all: "Everyone in the encounter" });
export const PORTRAIT_SHAPES = Object.freeze({ circle: "Circle", square: "Rounded square", slash: "Slash (cut-in)", none: "No frame" });
// Screen-wide moments (a flash, a shake) are short by default.
const MOMENT = { flash: 300, shake: 450, punch: 350 };
const safeAudio = (v) => { const s = text(v, 300).trim(); return s && !/^[a-z]+:/i.test(s) && !s.includes("..") && /\.(ogg|mp3|wav|flac|webm|m4a)$/i.test(s) ? s : ""; };
export const FLASH_LIMIT = 40, LAYER_LIMIT = 12;
const num = (v, min, max, fallback) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
const text = (v, max, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const color = (v, fallback) => (/^#[\da-f]{6}$/i.test(v ?? "") ? v : fallback);
const pick = (v, choices, fallback) => (Object.hasOwn(choices, v) ? v : fallback);
// Media must be a relative Foundry path to an image/video, or a Sequencer database key.
const safeMedia = (v) => {
  const s = text(v, 300).trim();
  if (!s) return "";
  if (/^[a-z0-9_]+(\.[A-Za-z0-9_-]+)+$/i.test(s) && !/\.(webm|mp4|png|jpe?g|webp|gif|svg)$/i.test(s)) return s;
  return !/^[a-z]+:/i.test(s) && !s.includes("..") && /\.(webm|mp4|png|jpe?g|webp|gif|svg)$/i.test(s) ? s : "";
};
const id = (v) => (/^[A-Za-z0-9-]{1,40}$/.test(v ?? "") ? v : (uuid() ?? Math.random().toString(36).slice(2)).slice(0, 12));

// Where a sound layer stops (ms into the screen): its trimmed length, else the whole file, never past
// the file's own end or the screen's. Without a measured length, it runs to the end of the screen.
export function soundEnd(l, total) {
  const file = l.soundMs > 0 && l.soundSrc === l.file ? l.soundMs : Infinity;
  const length = Math.min(l.duration > 0 ? l.duration : Infinity, file);
  return Math.min(total, Number.isFinite(length) ? l.start + length : total);
}
export function validateLayer(l = {}, duration = 4000) {
  const kind = pick(l.kind, FLASH_KINDS, "text");
  const start = num(l.start, 0, duration, 0);
  return {
    id: id(l.id), kind, name: text(l.name, 60),
    x: num(l.x, -20, 120, 50), y: num(l.y, -20, 120, 50),
    start, duration: num(l.duration, 0, duration, MOMENT[kind] ?? 0),
    enter: pick(l.enter, FLASH_MOTIONS, "fade"), enterMs: num(l.enterMs, 0, 4000, 400),
    exit: pick(l.exit, FLASH_MOTIONS, "fade"), exitMs: num(l.exitMs, 0, 4000, 400),
    opacity: num(l.opacity, 0, 1, 1), rotate: num(l.rotate, -180, 180, 0), shake: l.shake === true,
    blend: pick(l.blend, FLASH_BLENDS, "normal"),
    // Keyframes: where the layer is (position, scale, rotation, opacity) at moments of the screen.
    keys: (Array.isArray(l.keys) ? l.keys : []).slice(0, KEY_LIMIT).map((k) => ({
      at: Math.round(num(k?.at, 0, duration, 0)), x: num(k?.x, -20, 120, 50), y: num(k?.y, -20, 120, 50),
      scale: num(k?.scale, 0.05, 10, 1), rotate: num(k?.rotate, -720, 720, 0), opacity: num(k?.opacity, 0, 1, 1),
      // Text can also change colour and glow between keyframes.
      ...(color(k?.color, "") ? { color: k.color } : {}), ...(color(k?.glow, "") ? { glow: k.glow } : {}),
    })).sort((a, b) => a.at - b.at),
    keyEase: pick(l.keyEase, { smooth: 1, linear: 1 }, "smooth"),
    loop: pick(l.loop, FLASH_LOOPS, "none"), loopMs: num(l.loopMs, 150, 5000, 900),
    ...(kind === "text" ? {
      text: text(l.text, 200, "Roll for Initiative!"), font: text(l.font, 60, "Signika"), size: num(l.size, 1, 40, 9),
      color: color(l.color, "#ffffff"), outline: color(l.outline, "#000000"), glow: color(l.glow, "#ff7a1a"),
      glowSize: num(l.glowSize, 0, 10, 2), bold: l.bold !== false, italic: l.italic === true, spacing: num(l.spacing, -0.1, 1, 0.04),
      // A second colour fades the letters top to bottom; letters can arrive one after another.
      gradient: l.gradient === true, gradientTo: color(l.gradientTo, "#ffd34d"), letters: num(l.letters, 0, 400, 0), words: num(l.words, 0, 1500, 0),
    } : kind === "image" ? {
      src: safeMedia(l.src), width: num(l.width, 1, 150, 40),
    } : kind === "sound" ? {
      // soundMs: the file's own length, measured when it was chosen (soundSrc says for which file).
      file: safeAudio(l.file), volume: num(l.volume, 0, 1, 0.7),
      soundMs: Math.round(num(l.soundMs, 0, 600000, 0)), soundSrc: text(l.soundSrc, 300),
    } : kind === "portraits" ? {
      side: pick(l.side, PORTRAIT_SIDES, "party"), art: pick(l.art, { token: 1, portrait: 1 }, "token"), shape: pick(l.shape, PORTRAIT_SHAPES, "circle"),
      size: num(l.size, 3, 60, 18), gap: num(l.gap, 0, 20, 2), max: Math.round(num(l.max, 1, 12, 6)), stagger: num(l.stagger, 0, 1000, 120),
      names: l.names !== false, ring: color(l.ring, "#ffffff"),
      // How many per row: 0 keeps everyone in one line, 2 makes "2 above 2", 1 a column.
      perRow: Math.round(num(l.perRow, 0, 12, 0)),
    } : kind === "lines" ? {
      color: color(l.color, "#ffffff"), density: Math.round(num(l.density, 6, 90, 36)), clear: num(l.clear, 0, 80, 30), width: num(l.width, 20, 300, 220),
    } : kind === "burst" ? {
      color: color(l.color, "#fff3c4"), density: Math.round(num(l.density, 6, 60, 18)), width: num(l.width, 20, 300, 160),
    } : kind === "slash" ? {
      color: color(l.color, "#ffffff"), width: num(l.width, 10, 300, 140), height: num(l.height, 0.3, 30, 2.5),
    } : kind === "particles" ? (() => {
      const ptype = pick(l.ptype, PARTICLE_TYPES, "embers"), [dir, tint] = PARTICLE_DEFAULTS[ptype];
      return { ptype, count: Math.round(num(l.count, 5, 150, 50)), direction: pick(l.direction, PARTICLE_DIRECTIONS, dir), speed: num(l.speed, 0.3, 3, 1), size: num(l.size, 0.3, 3, 1), color: color(l.color, tint) };
    })() : kind === "punch" ? {
      strength: num(l.strength, 1.02, 1.6, 1.15),
    } : kind === "flash" ? {
      color: color(l.color, "#ffffff"), strength: num(l.strength, 0.05, 1, 0.85),
    } : kind === "shake" ? {
      strength: num(l.strength, 0.2, 5, 1.5),
    } : {
      color: color(l.color, "#7a1010"), width: num(l.width, 1, 150, 120), height: num(l.height, 1, 100, 22), skew: num(l.skew, -45, 45, -8),
    }),
  };
}
export function validateFlash(s = {}) {
  const duration = num(s.duration, 1000, 12000, 3500);
  return {
    id: id(s.id), name: text(s.name, 80, "Untitled flash").trim() || "Untitled flash",
    event: pick(s.event, FLASH_EVENTS, "start"), duration,
    backdrop: { color: color(s.backdrop?.color, "#000000"), opacity: num(s.backdrop?.opacity, 0, 1, 0.55), vignette: s.backdrop?.vignette !== false,
      // Cinematic letterbox bars.
      bars: s.backdrop?.bars === true, barSize: num(s.backdrop?.barSize, 2, 25, 11),
      // An animated background behind the layers (JB2A key or file), and how strongly it shows.
      media: safeMedia(s.backdrop?.media), mediaOpacity: num(s.backdrop?.mediaOpacity, 0, 1, 0.6),
      freeze: pick(s.backdrop?.freeze, SCENE_LOOKS, "normal") },
    // Playing music dips while the screen shows.
    duck: s.duck !== false,
    sound: { file: text(s.sound?.file, 300).trim(), volume: num(s.sound?.volume, 0, 1, 0.6) },
    layers: (Array.isArray(s.layers) ? s.layers : []).slice(0, LAYER_LIMIT).map((l) => validateLayer(l, duration)),
  };
}
export const validateFlashes = (list) => (Array.isArray(list) ? list : []).slice(0, FLASH_LIMIT).map(validateFlash);

// A layer's keyframed values at a moment (between keyframes, eased; outside them, held).
export function keyValueAt(layer, t) {
  const keys = layer.keys ?? [];
  const base = { x: layer.x, y: layer.y, scale: 1, rotate: 0, opacity: 1 };
  if (!keys.length) return base;
  if (t <= keys[0].at) return { ...keys[0] };
  if (t >= keys.at(-1).at) return { ...keys.at(-1) };
  const i = keys.findIndex((k) => k.at > t), a = keys[i - 1], b = keys[i];
  let f = (t - a.at) / Math.max(1, b.at - a.at);
  if (layer.keyEase !== "linear") f = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
  const mix = (p) => a[p] + (b[p] - a[p]) * f;
  return { at: Math.round(t), x: mix("x"), y: mix("y"), scale: mix("scale"), rotate: mix("rotate"), opacity: mix("opacity") };
}
// Who appears in a portraits layer: the encounter's visible combatants on that side.
export function portraitPeople(layer, combatants = [], actor = null) {
  if (layer.side === "actor") return actor ? [actor] : [];
  if (layer.side === "boss") return bossOf(combatants) ? [bossOf(combatants)] : [];
  return combatants.filter((c) => layer.side === "all" || c.side === layer.side).slice(0, layer.max);
}
// The strongest enemy: highest level (or CR), first in initiative order on a tie.
export const bossOf = (combatants = []) => combatants.filter((c) => c.side === "enemies").reduce((best, c) => (!best || Number(c.level) > Number(best.level) ? c : best), null);
// {scene} in text becomes the scene's name, {round} the combat round.
// {boss} is the strongest enemy's name, {name} the creature of the moment (who crit, who fell, who
// used the action), {action} the attack, spell or ability a screen plays before.
// {party} (or {partyname}) is the party's name. {manual} is typed by the GM as the screen plays; {manual:Enemy side}
// asks with that label, so one screen can ask for several names.
const VARS = /\{(scene|round|boss|name|action|party|partyname|manual)(?::([^{}]{1,40}))?\}/g;
export const fillText = (value, vars = {}) => String(value ?? "").replace(VARS, (whole, k, label = "") => {
  if (k === "manual") return vars.manual?.[label.trim()] ?? (vars.manualSample ? label.trim() || "Typed by the GM" : "");
  if (label) return whole;
  return (k === "boss" ? bossOf(vars.combatants)?.name : k === "partyname" ? vars.party : vars[k]) ?? "";
});
// The names a screen asks the GM for as it plays: one per distinct {manual} label, in order.
export function manualPrompts(screen) {
  const labels = [];
  for (const layer of screen?.layers ?? []) for (const [, k, label = ""] of String(layer?.text ?? "").matchAll(VARS)) if (k === "manual" && !labels.includes(label.trim())) labels.push(label.trim());
  return labels;
}

// The screen to play: the combat's own choice, else the world default, for this event.
// A choice is a screen id, "random" (any screen for the event) or "none".
// The screens switched on for an event. "Combat initiated" and "Combat start" may have several
// (the GM picks one when it happens); every other moment has one, or "none".
export const MULTI_FLASH_EVENTS = ["initiated", "start"];
export const flashesOn = (value) => (Array.isArray(value) ? value : [value]).filter((v) => typeof v === "string" && v && !["none", "random"].includes(v));
export const flashOn = (defaults, event, id) => flashesOn(defaults?.[event]).includes(id);
export function toggleFlashOn(defaults, event, id) {
  const on = flashesOn(defaults?.[event]);
  if (!MULTI_FLASH_EVENTS.includes(event)) return on.includes(id) ? "none" : id;
  return on.includes(id) ? on.filter((x) => x !== id) : [...on, id];
}
export function chooseFlash(screens, event, choice, fallback, random = Math.random) {
  // "Combat start or end" screens fit only those two moments.
  const fits = screens.filter((s) => s.event === event || (s.event === "any" && ["start", "end"].includes(event)));
  const resolve = (c) => (c === "none" ? null : c === "random" ? fits[Math.floor(random() * fits.length)] ?? null : screens.find((s) => s.id === c) ?? undefined);
  const picked = choice ? resolve(choice) : undefined;
  return picked !== undefined ? picked : fallback ? resolve(fallback) ?? null : null;
}

export const STARTER_FLASHES = [
  { id: "start-initiative", name: "Roll for Initiative!", event: "start", duration: 3400, backdrop: { color: "#140303", opacity: 0.65, bars: true, barSize: 11 },
    layers: [
      { kind: "band", name: "Band", y: 50, height: 24, color: "#7a0d0d", enter: "slide-left", enterMs: 320, exit: "slide-right", exitMs: 320 },
      { kind: "text", name: "Title", text: "ROLL FOR INITIATIVE!", y: 48, size: 10, gradient: true, color: "#ffffff", gradientTo: "#ffb13b", glow: "#ff4a12", glowSize: 3, enter: "none", letters: 40, start: 150, loop: "glow", loopMs: 900 },
      { kind: "flash", name: "Impact flash", start: 950, duration: 260, strength: 0.8 },
      { kind: "shake", name: "Impact shake", start: 950, duration: 450, strength: 1.8 },
      { kind: "text", name: "Scene", text: "{scene}", y: 62, size: 3.5, bold: false, italic: true, glow: "#000000", glowSize: 0, start: 1150, enter: "blur", enterMs: 500 },
    ] },
  { id: "start-boss", name: "Boss Battle", event: "start", duration: 4200, backdrop: { color: "#05000d", opacity: 0.8, bars: true, barSize: 14 },
    layers: [
      { kind: "text", name: "Warning", text: "WARNING", y: 34, size: 4, color: "#ff3b3b", glow: "#ff0000", glowSize: 2, spacing: 0.6, enter: "fade", enterMs: 200, loop: "flicker", loopMs: 350 },
      { kind: "text", name: "Title", text: "BOSS BATTLE", y: 50, size: 15, gradient: true, color: "#f2f6ff", gradientTo: "#7a8cff", glow: "#4b2bff", glowSize: 4, enter: "slam", enterMs: 420, start: 700, loop: "heartbeat", loopMs: 1100,
        keys: [{ at: 1100, x: 50, y: 50, scale: 1 }, { at: 3600, x: 50, y: 50, scale: 1.12 }] },
      { kind: "flash", name: "Impact flash", start: 950, duration: 300, color: "#d9d4ff", strength: 0.9 },
      { kind: "shake", name: "Impact shake", start: 950, duration: 600, strength: 2.6 },
      { kind: "text", name: "Subtitle", text: "{scene}", y: 64, size: 3.2, italic: true, bold: false, color: "#c9c3ff", glowSize: 0, start: 1500, enter: "type", enterMs: 700, loop: "glitch", loopMs: 1600 },
    ] },
  { id: "start-faceoff", name: "Face Off", event: "start", duration: 4200, backdrop: { color: "#06030c", opacity: 0.78, bars: true, barSize: 10 },
    layers: [
      { kind: "band", name: "Party side", x: 22, y: 50, width: 60, height: 52, color: "#123a6b", skew: -10, enter: "slide-left", enterMs: 350, exit: "slide-left", exitMs: 300 },
      { kind: "band", name: "Enemy side", x: 78, y: 50, width: 60, height: 52, color: "#6b1212", skew: -10, enter: "slide-right", enterMs: 350, exit: "slide-right", exitMs: 300 },
      { kind: "portraits", name: "Party", side: "party", x: 24, y: 50, size: 14, gap: 1.2, max: 4, start: 300, stagger: 130, ring: "#9fd0ff", enter: "none" },
      { kind: "portraits", name: "Enemies", side: "enemies", x: 76, y: 50, size: 14, gap: 1.2, max: 4, start: 450, stagger: 130, ring: "#ff9a9a", enter: "none" },
      { kind: "text", name: "VS", text: "VS", x: 50, y: 50, size: 16, gradient: true, color: "#ffffff", gradientTo: "#ffcf4a", glow: "#ff6a00", glowSize: 4, enter: "slam", enterMs: 380, start: 1200, loop: "heartbeat", loopMs: 1000 },
      { kind: "flash", name: "Impact flash", start: 1450, duration: 260, strength: 0.75 },
      { kind: "shake", name: "Impact shake", start: 1450, duration: 450, strength: 2 },
    ] },
  // Two blades sweep in from the lower corners and clash in the middle; the call slams in under them.
  { id: "start-crossed-swords", name: "Crossed Swords", event: "start", duration: 3600, backdrop: { color: "#0b0605", opacity: 0.72, bars: true, barSize: 10, vignette: true },
    layers: [
      { kind: "burst", name: "Clash light", x: 50, y: 44, color: "#ff9a3c", density: 16, width: 95, start: 700, duration: 2600, enter: "zoom", enterMs: 250, opacity: 0.4, blend: "add", loop: "spin", loopMs: 6000 },
      { kind: "image", name: "Left blade", src: "icons/svg/sword.svg", width: 34, enter: "none", exit: "fade", exitMs: 400,
        keys: [{ at: 0, x: 8, y: 92, rotate: -25, opacity: 0 }, { at: 150, x: 14, y: 84, rotate: -25, opacity: 1 }, { at: 700, x: 50, y: 44, rotate: 0 }, { at: 760, x: 49, y: 45, rotate: 3 }, { at: 3600, x: 50, y: 44, rotate: 0 }] },
      { kind: "image", name: "Right blade", src: "icons/svg/sword.svg", width: 34, enter: "none", exit: "fade", exitMs: 400,
        keys: [{ at: 0, x: 92, y: 92, rotate: -65, opacity: 0 }, { at: 150, x: 86, y: 84, rotate: -65, opacity: 1 }, { at: 700, x: 50, y: 44, rotate: -90 }, { at: 760, x: 51, y: 45, rotate: -93 }, { at: 3600, x: 50, y: 44, rotate: -90 }] },
      { kind: "particles", name: "Sparks", ptype: "sparks", count: 60, speed: 1.6, size: 1.2, start: 700, duration: 1400, enter: "none", exit: "fade", exitMs: 500 },
      { kind: "flash", name: "Clash flash", start: 700, duration: 240, color: "#fff1cc", strength: 0.85 },
      { kind: "shake", name: "Clash shake", start: 700, duration: 450, strength: 2.2 },
      { kind: "punch", name: "Camera punch", start: 700, duration: 350, strength: 1.1 },
      { kind: "text", name: "Title", text: "TO ARMS!", y: 80, size: 10, gradient: true, color: "#ffffff", gradientTo: "#ffc04a", glow: "#ff5a12", glowSize: 3, spacing: 0.12, enter: "slam", enterMs: 360, start: 950, loop: "glow", loopMs: 1000 },
      { kind: "text", name: "Scene", text: "{scene}", y: 90, size: 3.2, italic: true, bold: false, color: "#e8d9c4", glowSize: 0, start: 1350, enter: "blur", enterMs: 450 },
    ] },
  { id: "start-ambush", name: "Ambush!", event: "start", duration: 2600, backdrop: { color: "#000000", opacity: 0.7 },
    layers: [
      { kind: "text", name: "Title", text: "AMBUSH!", y: 50, size: 16, color: "#ffe1c2", glow: "#d10000", glowSize: 4, enter: "zoom", enterMs: 300, exit: "zoom", shake: true },
      { kind: "flash", name: "Red flash", start: 250, duration: 260, color: "#ff2a2a", strength: 0.55 },
    ] },
  { id: "action-signature", name: "Signature Move", event: "action", duration: 2600, backdrop: { color: "#0a0303", opacity: 0.7, bars: true, barSize: 10, media: "jb2a.ambient_fog.001.loop.large.orangeyellow", mediaOpacity: 0.55 },
    layers: [
      { kind: "band", name: "Band", y: 48, height: 22, color: "#7a1400", skew: -10, enter: "slide-left", enterMs: 280, exit: "slide-right", exitMs: 260 },
      { kind: "text", name: "Action", text: "{action}", y: 47, size: 11, gradient: true, color: "#fff6dc", gradientTo: "#ffb13b", glow: "#ff4a12", glowSize: 3, enter: "none", letters: 35, start: 120 },
      { kind: "flash", name: "Impact flash", start: 650, duration: 220, strength: 0.6 },
      { kind: "shake", name: "Impact shake", start: 650, duration: 350, strength: 1.4 },
      { kind: "text", name: "Who", text: "{name}", y: 63, size: 3.4, italic: true, bold: false, glowSize: 0, start: 750, enter: "blur", enterMs: 350 },
    ] },
  { id: "action-cutin", name: "Cut-in", event: "action", duration: 2600, backdrop: { color: "#05030a", opacity: 0.55, bars: true, barSize: 8, freeze: "grey" },
    layers: [
      { kind: "lines", name: "Speed lines", x: 32, y: 50, color: "#ffffff", density: 48, clear: 26, width: 240, enter: "fade", enterMs: 120, opacity: 0.55 },
      { kind: "band", name: "Band", x: 50, y: 50, width: 120, height: 38, color: "#1a1030", skew: -14, enter: "slide-left", enterMs: 220, exit: "slide-right", exitMs: 240, opacity: 0.9 },
      { kind: "portraits", name: "Who", side: "actor", shape: "slash", art: "portrait", x: 30, y: 50, size: 34, max: 1, ring: "#ffd34d", enter: "none", start: 60 },
      { kind: "slash", name: "Slash", x: 58, y: 50, width: 120, height: 1.6, color: "#ffd34d", rotate: -14, start: 380, duration: 700, enter: "none", exit: "fade", exitMs: 300 },
      { kind: "text", name: "Action", text: "{action}", x: 66, y: 46, size: 9, gradient: true, color: "#ffffff", gradientTo: "#ffd34d", glow: "#ff7a00", glowSize: 2.5, words: 140, enter: "none", start: 420 },
      { kind: "text", name: "Name", text: "{name}", x: 66, y: 60, size: 3.4, italic: true, bold: false, glowSize: 0, start: 750, enter: "blur", enterMs: 300 },
      { kind: "punch", name: "Camera punch", start: 420, duration: 380, strength: 1.12 },
      { kind: "flash", name: "Impact flash", start: 420, duration: 200, strength: 0.5 },
    ] },
  { id: "round-next", name: "Next Round", event: "round", duration: 1800, backdrop: { color: "#000000", opacity: 0.3, vignette: true },
    layers: [
      { kind: "text", name: "Round", text: "ROUND {round}", y: 50, size: 9, color: "#ffffff", glow: "#7aa7ff", glowSize: 2.5, enter: "blur", enterMs: 350, exit: "blur", exitMs: 350, spacing: 0.15 },
    ] },
  { id: "crit-hit", name: "Critical!", event: "crit", duration: 1500, backdrop: { color: "#000000", opacity: 0.25, vignette: false },
    layers: [
      { kind: "text", name: "Crit", text: "CRITICAL!", y: 45, size: 13, gradient: true, color: "#ffffff", gradientTo: "#ff5a1a", glow: "#ff2a00", glowSize: 3, enter: "slam", enterMs: 260, exit: "zoom", exitMs: 250, rotate: -6 },
      { kind: "text", name: "Who", text: "{name}", y: 60, size: 3.5, italic: true, bold: false, glowSize: 0, start: 250, enter: "fade" },
      { kind: "flash", name: "Flash", start: 200, duration: 200, strength: 0.6 },
      { kind: "shake", name: "Shake", start: 200, duration: 350, strength: 1.4 },
    ] },
  { id: "last-enemy", name: "Last One Standing", event: "lastEnemy", duration: 2400, backdrop: { color: "#140000", opacity: 0.55, bars: true, barSize: 9 },
    layers: [
      { kind: "portraits", name: "Survivor", side: "enemies", y: 42, size: 22, max: 1, ring: "#ff5a5a", names: true, enter: "zoom", enterMs: 400 },
      { kind: "text", name: "Title", text: "LAST ONE STANDING", y: 70, size: 6, color: "#ffd2d2", glow: "#ff0000", glowSize: 2, spacing: 0.2, start: 400, enter: "type", enterMs: 600 },
    ] },
  // Fighting-game style: the world freezes, a red burst, and the call booms in with a camera hit.
  { id: "last-finish", name: "Finish Him!", event: "finalEnemy", duration: 2600, backdrop: { color: "#0a0000", opacity: 0.6, vignette: true, freeze: "dark" },
    layers: [
      { kind: "burst", name: "Red burst", y: 48, color: "#ff3a12", density: 22, width: 150, opacity: 0.38, start: 280, enter: "zoom", enterMs: 260, exit: "fade", exitMs: 400 },
      { kind: "particles", name: "Embers", ptype: "embers", count: 40, speed: 1.2, start: 280, enter: "fade", enterMs: 300, exit: "fade", exitMs: 400 },
      { kind: "text", name: "Finish him", text: "FINISH HIM!", y: 48, size: 17, font: "Modesto Condensed", bold: true, spacing: 0.04, gradient: true, color: "#fff4b0", gradientTo: "#d11a00", outline: "#2a0000", glow: "#ff2a00", glowSize: 3.5, enter: "slam", enterMs: 300, start: 300, exit: "zoom", exitMs: 300, loop: "heartbeat", loopMs: 900 },
      { kind: "punch", name: "Camera punch", start: 470, duration: 380, strength: 1.14 },
      { kind: "flash", name: "Red flash", start: 470, duration: 240, color: "#ff2a2a", strength: 0.6 },
      { kind: "shake", name: "Impact shake", start: 470, duration: 500, strength: 2.4 },
    ] },
  { id: "end-victory", name: "Victory", event: "end", duration: 3600, backdrop: { color: "#1a1404", opacity: 0.5, bars: true, barSize: 9 },
    layers: [
      { kind: "band", name: "Band", y: 50, height: 20, color: "#a7801c", skew: 0, enter: "fade", exit: "fade" },
      { kind: "text", name: "Title", text: "VICTORY", y: 49, size: 12, gradient: true, color: "#fffbe8", gradientTo: "#ffcc33", glow: "#ffd34d", glowSize: 3, enter: "blur", enterMs: 600, start: 200, letters: 70, loop: "glow", loopMs: 1400 },
    ] },
  { id: "end-over", name: "Battle Over", event: "end", duration: 2800, backdrop: { color: "#000000", opacity: 0.45 },
    layers: [
      { kind: "text", name: "Title", text: "The battle is over", y: 50, size: 7, italic: true, bold: false, glow: "#7aa7ff", glowSize: 2, enter: "blur", enterMs: 800, exit: "blur", exitMs: 700 },
    ] },
].map(validateFlash);
