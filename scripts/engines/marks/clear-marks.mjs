// Clearing ground marks on demand (api.clearGroundMarks, the GM's keybinding). Marks are drawn on each
// client, so a GM's clear wipes this screen and asks every other client over Animater's socket to wipe theirs;
// a player only ever clears their own screen. A lasting area's mark goes too and comes back only if the area
// plays again (a new effect): the one still on the board is not re-marked.
export const CLEAR_MARKS_MESSAGE = 'clear-marks';

// `everyone` defaults to true for a GM and is ignored for a player. Returns where it cleared.
export function clearGroundMarks({ everyone } = {}, { isGM, clear, emit, sender, userId }) {
  clear();
  if (!isGM() || everyone === false) return { here: true, everyone: false };
  try { emit({ type: CLEAR_MARKS_MESSAGE, sender, userId }); }
  catch { return { here: true, everyone: false }; }
  return { here: true, everyone: true };
}

// Foundry relays a module event with the sender's user id; only a GM's clear is obeyed.
export function receiveClearMarks(data, senderId, { clear, isGMUser }) {
  if (data?.type !== CLEAR_MARKS_MESSAGE) return false;
  if (!isGMUser(senderId ?? data.userId)) return false;
  clear();
  return true;
}
