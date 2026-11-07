// Whether where you are looking is underground (pure): a level can say, on or off ("Underground" in its own settings), and otherwise goes by its scene's Underground, or its Cave or Hall acoustics. `sceneFlags` and `levelFlags` the two's Animater flags.
export function undergroundOf(sceneFlags = {}, levelFlags = {}) {
  const choice = levelFlags?.underground;
  if (choice === 'on') return true;
  if (choice === 'off') return false;
  return sceneFlags?.underground === true || sceneFlags?.acoustics === 'cave' || sceneFlags?.acoustics === 'hall';
}
// The level's own choices, as its settings offer them, the first saying what its scene would give it.
export const undergroundChoices = (sceneIs) => [['', `As the scene (${sceneIs ? 'underground' : 'above ground'})`], ['on', 'Underground'], ['off', 'Above ground']];
