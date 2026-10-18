import test from "node:test";
import assert from "node:assert/strict";
import { registerAATakeover } from "../../scripts/integrations/automated-animations.mjs";
test("the Automated Animations takeover stops AA for a condition Animater covers", () => {
  let handler;
  const hooks = { on: (_, fn) => { handler = fn; } };
  registerAATakeover({ hooks, enabled: () => true, resolve: (event) => (event.type === "effect" ? true : null), context: () => ({ systemId: "pf2e" }) });
  const data = { item: { name: "Frightened" }, activeEffect: true, token: {} };
  handler(data);
  assert.equal(data.stopWorkflow, true);
});
