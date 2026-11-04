// The regions that count on the level being viewed (pure): a region drawn only on the basement means nothing on the floors above. Foundry's `viewed` says so for a region
// on a level of the scene shown; a region without it (an older Foundry) counts everywhere.
export const viewedRegions = (regions) => Array.from(regions ?? []).filter((region) => region?.viewed !== false);
