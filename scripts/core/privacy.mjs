// Who may see a roll. A GM's private roll (Private GM Roll mode, secret NPC rolls) still happens on
// the table: it animates for everyone, with its real hit or miss unless the world hides private
// results (hidesResult). A player's own private action plays only for its audience (audienceOf); blind
// rolls stay hidden, and Activity says why (hiddenReason).
// "public" | "gm" (GM private: plays) | "private" | "blind" (both hidden).
export function rollPrivacy(message, { isGM } = {}) {
  if (message?.blind || message?.data?.blind) return "blind";
  if (!Array.from(message?.whisper ?? message?.data?.whisper ?? []).length) return "public";
  return ((message?.author ?? message?.user)?.isGM ?? isGM) === true ? "gm" : "private";
}
// The same from a roll or message mode (dnd5e's rollMode, Daggerheart's selectedMessageMode):
// v14 message modes and their legacy roll-mode names.
export function modePrivacy(mode, isGM) {
  if (!mode || ["publicroll", "public", "roll"].includes(mode)) return "public";
  if (["blind", "blindroll"].includes(mode)) return "blind";
  return ["gm", "gmroll"].includes(mode) && isGM === true ? "gm" : "private";
}
// The more hidden of two answers.
const RANK = { public: 0, gm: 1, private: 2, blind: 3 };
export const stricter = (a, b) => (RANK[b] > RANK[a] ? b : a);
export const hidden = (privacy) => privacy === "private" || privacy === "blind";
export const hiddenReason = (name, privacy) => `${name || "Roll"}: ${privacy === "blind" ? "a blind roll" : "a private roll"} stays hidden from the table.`;
// A player's private roll (Private GM Roll, Self Roll) of an attack, spell or action still plays, only for those who
// can read its message: the roller and its whisper recipients, the GMs when it names none. null: everyone.
export function audienceOf(privacy, message, { userId = globalThis.game?.user?.id, gmIds } = {}) {
  if (privacy !== "private") return null;
  const id = (u) => (typeof u === "string" ? u : u?.id);
  const whisper = Array.from(message?.whisper ?? message?.data?.whisper ?? []).map(id);
  const gms = gmIds ?? Array.from(globalThis.game?.users ?? []).filter((u) => u?.isGM).map(id);
  const author = id(message?.author ?? message?.user) ?? userId;
  return [...new Set([author, ...(whisper.length ? whisper : gms)].filter(Boolean))];
}
// The world setting "Hide the result of private GM rolls" (off by default: most tables announce a
// monster's hit or miss anyway, and the numbers stay private). Set from main.mjs on every client.
let hidePrivateResults = false;
export const setHidePrivateResults = (on) => { hidePrivateResults = on === true; };
// A GM's private roll whose result the animation must not show (it plays neutrally instead).
export const hidesResult = (privacy) => privacy === "gm" && hidePrivateResults;
