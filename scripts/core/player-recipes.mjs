// Player-made recipes. Each player keeps their own recipes on their user (a flag
// they may write). The GM's decisions live in a world setting players cannot
// write: {[userId]: {[recipeId]: {status: 'approved'|'declined', hash}}}. A decision
// covers one exact version of a recipe, so any later edit makes it pending again.
import { validateRecipe, matchRecipe } from './model.mjs';

export const PLAYER_RECIPE_LIMIT = 50;

// Stable fingerprint of what a recipe plays (not its enabled switch).
export function recipeHash(recipe) {
  const { enabled, ...rest } = validateRecipe(recipe);
  const text = JSON.stringify(rest);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function approvalState(recipe, decisions = {}) {
  const decision = decisions?.[recipe.id];
  if (!decision || decision.hash !== recipeHash(recipe)) return 'pending';
  return decision.status === 'approved' ? 'approved' : 'declined';
}

export function validatePlayerRecipes(data) {
  if (!Array.isArray(data)) throw Error('Recipes must be a list.');
  if (data.length > PLAYER_RECIPE_LIMIT) throw Error(`Maximum ${PLAYER_RECIPE_LIMIT} recipes per player.`);
  // A player recipe animates the player's own uses; persistent document layers stay GM-made.
  const valid = data.map(r => validateRecipe({ ...r, lifecycle: undefined }));
  if (new Set(valid.map(r => r.id)).size !== valid.length) throw Error('Recipe IDs must be unique.');
  return valid;
}

// The approved recipe of this player that matches the event, when the event is
// one of their own characters' (the GM approves recipes, not other players' items).
export function approvedPlayerRecipe(event, recipes = [], decisions = {}, { owns = () => false } = {}) {
  if (!owns(event?.actor ?? event?.item?.actor)) return null;
  const approved = recipes.filter(r => approvalState(r, decisions) === 'approved').map(validateRecipe);
  return approved.length ? matchRecipe(approved, event) : null;
}

// The GM's review list: every player's recipes with their state, pending first.
export function playerSubmissions(users = [], decisionsByUser = {}) {
  const rows = [];
  for (const user of users) {
    if (user.isGM) continue;
    const recipes = user.getFlag?.('animater', 'playerRecipes')?.recipes ?? [];
    for (const recipe of recipes) rows.push({ userId: user.id, userName: user.name, recipe, state: approvalState(recipe, decisionsByUser[user.id]) });
  }
  const order = { pending: 0, declined: 1, approved: 2 };
  return rows.sort((a, b) => order[a.state] - order[b.state] || a.userName.localeCompare(b.userName) || a.recipe.name.localeCompare(b.recipe.name));
}

// The world setting after the GM decides on one recipe version (null clears it).
export function decide(decisionsByUser = {}, userId, recipe, status) {
  const forUser = { ...(decisionsByUser[userId] ?? {}) };
  if (status) forUser[recipe.id] = { status, hash: recipeHash(recipe) };
  else delete forUser[recipe.id];
  return { ...decisionsByUser, [userId]: forUser };
}
