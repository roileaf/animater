# Residual fix report

## Changes
1. `scripts/engines/lighting/light-host.mjs` tick(): when the light map is empty, flush a pending `dirty` (one refreshLighting) before returning. Test: last light ended via onEnded at level 0 -> next tick refreshes once, not again.
2. `scripts/engines/lighting/effect-lights.mjs`: anchor fallback `near[0]` now only for a one-shot group with no mixed spot (`both || lasting ? null : near[0]`). A lasting group anchors only on a lasting tier 0 stage, else no light. Test: lasting wall (tier 1) + non-luminous one-shot tier 0 puff -> no lights; with wall tier 0 -> wall light.

## Test
`node --test "tests/engines/lighting/*.test.mjs" tests/engines/playback/runtime.test.mjs`
tests 115, pass 115, fail 0.
