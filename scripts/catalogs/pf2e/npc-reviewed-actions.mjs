// Explicit action-level choices from native bestiary descriptions. Keep shards
// separate for review, with one registry used by both the builder and runtime.
import {REVIEWED_ACTIONS as a} from './npc-reviewed-a.mjs';
import {REVIEWED_ACTIONS as b} from './npc-reviewed-b.mjs';
import {REVIEWED_ACTIONS as c} from './npc-reviewed-c.mjs';

export const REVIEWED_NPC_ACTIONS = Object.freeze({...a, ...b, ...c});
export const reviewedNpcAction = id => REVIEWED_NPC_ACTIONS[id] ?? null;
