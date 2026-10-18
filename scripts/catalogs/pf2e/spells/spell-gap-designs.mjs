import {GAP_A_MOTIFS,GAP_A_DESIGNS,gapALayers} from './spell-gap-a.mjs';
import {GAP_B_MOTIFS,GAP_B_DESIGNS,gapBLayers} from './spell-gap-b.mjs';
import {GAP_C_MOTIFS,GAP_C_DESIGNS,gapCLayers} from './spell-gap-c.mjs';

export const GAP_SPELL_MOTIFS={...GAP_A_MOTIFS,...GAP_B_MOTIFS,...GAP_C_MOTIFS};
export const GAP_SPELL_DESIGNS={...GAP_A_DESIGNS,...GAP_B_DESIGNS,...GAP_C_DESIGNS};
export function gapSpellLayers(spell,helpers){
 return gapALayers(spell,helpers)??gapBLayers(spell,helpers)??gapCLayers(spell,helpers);
}
