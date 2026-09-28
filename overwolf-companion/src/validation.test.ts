import assert from "node:assert/strict";
import test from "node:test";

import { GepValidationState } from "./validation.js";

test("normalizes documented-shaped updates without promoting them to verified", () => {
  const state = new GepValidationState();
  const result = state.consume({
    info: {
      me: { gold: "42", health: "78", xp: "{\"level\":6,\"current_xp\":12}" },
      match_info: { round_type: "{\"stage\":\"3-2\"}" },
    },
  });
  const snapshot = state.getSnapshot();
  assert.equal(result.changed, true);
  assert.deepEqual(result.first.map((item) => item.feature), ["me", "match_info"]);
  assert.deepEqual(snapshot.me, { gold: 42, health: 78, level: 6, xp: 12 });
  assert.equal(snapshot.stage, "3-2");
  assert.equal(snapshot.sources.me, "observed");
});

test("first payload is captured once and unknown shapes stay tolerated", () => {
  const state = new GepValidationState();
  assert.equal(state.consume({ info: { board: { slot_1: { name: "Unit" } } } }).first.length, 1);
  assert.equal(state.consume({ info: { board: { slot_2: { name: "Unit 2" } } } }).first.length, 0);
  assert.equal(state.getSnapshot().sources.board, "observed");
  assert.equal(state.getSnapshot().sources.store, "not_seen");
});
