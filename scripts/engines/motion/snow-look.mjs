// How lying snow looks, in GLSL, for every shader that draws it: the ground's (sky-light.mjs, its pale pass) and the
// decorations' (decorations.mjs), so snow on a rock is the same snow as on the ground beside it. Where it lies in patches
// (the same pattern as sky-light.mjs's snowPatchAt, a hash without sine so the GPU and the creatures' tracks agree on it),
// and its colour: a bright face toward the sun or moon, blue away from it.
export const SNOW_LOOK = `
float patchHash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float patchNoise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f);
  return mix(mix(patchHash(i), patchHash(i + vec2(1, 0)), f.x), mix(patchHash(i + vec2(0, 1)), patchHash(i + vec2(1, 1)), f.x), f.y); }
float snowFieldAt(vec2 px, float grid){
  vec2 p = px / (grid * 4.0); float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * patchNoise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return s;
}
// Its colour: lit 0 (facing away, blue) - 1 (toward the light, the sun or moon's own colour as much as it reaches, sunZ), with its grain.
vec3 snowTone(float lit, float speck, vec3 sunColor, float sunZ){ return mix(vec3(0.62, 0.7, 0.86), mix(vec3(1.0, 0.99, 0.97), sunColor, 0.6 * sunZ), lit) * (0.95 + 0.05 * speck); }
// How lit a face of it is: its slope (uphill), the way to the sun or moon, how much reaches (sunZ) and how low it is (low).
float snowLit(vec2 slope, vec2 toSun, float sunZ, float low){ return clamp(0.7 - dot(slope, toSun) * (0.26 + sunZ * (0.26 + 0.2 * low)), 0.0, 1.0); }
`;
