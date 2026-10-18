// Who may see a roll. A GM's private roll (Private GM Roll mode, secret NPC rolls) still happens on
// the table: it animates for everyone, without the outcome that would give the hidden result away.
// Blind rolls and a player's own private rolls stay hidden, and Activity says why (hiddenReason).
// "public" | "gm" (GM private: plays, outcome stripped) | "private" | "blind" (both hidden).
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
