import assert from "node:assert/strict";
import test from "node:test";

import { sanitizePayload } from "./sanitize.js";

test("sanitizes bridge debug payloads", () => {
  assert.deepEqual(sanitizePayload({ token: "secret", board: [{ id: "unit" }] }), {
    token: "[redacted]",
    board: [{ id: "unit" }]
  });
});
