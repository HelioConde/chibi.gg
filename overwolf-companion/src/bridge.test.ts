import assert from "node:assert/strict";
import test from "node:test";

import { bridgeRetryDelay } from "./bridge.js";

test("bridge retry delays are bounded and back off", () => {
  assert.deepEqual([0, 1, 2, 3, 99].map(bridgeRetryDelay), [1000, 2000, 5000, 10000, 10000]);
});
