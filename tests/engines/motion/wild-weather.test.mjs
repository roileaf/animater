import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherShelter } from '../../../scripts/engines/motion/wildlife.mjs';

test('animals stay out in a shower and go in from a downpour or heavy snow', () => {
  assert.equal(weatherShelter({}), 1);
  assert.equal(weatherShelter({ rain: 0.3 }), 1);
  assert.ok(weatherShelter({ rain: 0.5 }) > 0 && weatherShelter({ rain: 0.5 }) < 1);
  assert.equal(weatherShelter({ rain: 0.8 }), 0);
  assert.equal(weatherShelter({ snow: 0.8 }), 0);
});
