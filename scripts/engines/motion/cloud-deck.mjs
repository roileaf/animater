// The cloud deck's pattern, one for everything the sun falls on: the sky's shadows (sky-light.mjs) and the trees' flecks (canopy-light.mjs) must agree on where a cloud is.
// How thick it is over a point. It goes with the wind: a stronger wind carries it faster, stretches it along its way and tears its edges. Rounded heads with creases between them make its edge read as a cloud's.
export const CLOUD_DECK = `
float deckNoise(vec2 p){ vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453), c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float deckRidge(vec2 p){ return 1.0 - abs(2.0 * deckNoise(p) - 1.0); }
// t: the clock its shapes change by. run: how far it has gone, kept up with the wind, so a change of wind carries on from where it is.
float cloudDeck(vec2 px, float t, float run, vec2 dir, float wind, float grid){
  vec2 w = px / grid, a = vec2(dot(w, dir) / (1.0 + 0.9 * wind), dot(w, vec2(-dir.y, dir.x)));
  vec2 q = a / 13.0 - vec2(run, 0.0);
  vec2 warp = vec2(deckNoise(q * 1.3 + vec2(1.7, 9.2) + t * 0.006), deckNoise(q * 1.3 + vec2(8.3, 2.8) - t * 0.007)) - 0.5;
  vec2 b = q + warp * 0.9, h = q * 2.6 + warp * 1.4 + t * 0.004;
  float body = (0.5 * deckNoise(b) + 0.25 * deckNoise(b * 2.03 + 17.0) + 0.125 * deckNoise(b * 4.12 + 51.5) + 0.0625 * deckNoise(b * 8.36 + 121.0)) / 0.9375;
  float heads = (0.5 * deckRidge(h) + 0.25 * deckRidge(h * 2.1 + 9.0) + 0.125 * deckRidge(h * 4.4 + 21.0)) / 0.875;
  return body * 0.7 + heads * 0.34 - 0.03 + (deckNoise(q * 16.0 + warp * 5.0) - 0.5) * 0.03 * (1.0 + 2.0 * wind);
}
// Where the deck stands over a point, 0 clear sky to 1 under cloud. deck: its look (cloudLook in sky-light.mjs).
float deckShade(float thick, vec4 deck){ float edge = mix(0.74, 0.3, deck.x), gap = 0.03 + 0.1 * deck.z; return smoothstep(edge - gap, edge + gap, thick); }`;
