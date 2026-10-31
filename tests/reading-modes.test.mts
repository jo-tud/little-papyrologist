import assert from "node:assert/strict";
import test from "node:test";
import { browserModuleHooks } from "./browser-module-hooks.mjs";
import type { AnswerRecord } from "../src/types.ts";

const hooks = browserModuleHooks();
const { readingModes } = await import("../src/reading-modes.ts");
hooks.deregister();

function answer(truth: string, letters: string, rest: Partial<AnswerRecord> = {}): AnswerRecord {
  return { item_id: "example", task: "read", help_used: false, level: 3, degradation: 0,
    truth, letters, said_text: "yes", confidence: null, ms: 100, answered_at: "2026-10-31T12:00:00Z",
    text_correct: true, letters_correct: true, verdict: "right", reading_points: 3, honesty_points: 0, ...rest };
}

test("A perfect mixed reading round includes correct blank answers in fully matched results", () => {
  for (const help_used of [false, true]) {
    const records = [answer("ΚΑΙ", "ΚΑΙ", { help_used }), answer("none", "", {
      help_used, said_text: "no", letters_correct: null, verdict: "honest", reading_points: 0, honesty_points: 2,
    })];
    const before = JSON.stringify(records);
    const row = readingModes(records)[help_used ? 1 : 2];
    assert.equal(row.answers, 2);
    assert.equal(row.matched, 2);
    assert.equal(JSON.stringify(records), before, "display calculations never alter saved answers");
  }
});

test("False alarms and open readings stay in the denominator without counting as matches", () => {
  const row = readingModes([
    answer("ΚΑΙ", "ΚΑΙ"),
    answer("none", "", { said_text: "no", letters_correct: null }),
    answer("none", "Ν", { letters_correct: null }),
    answer("none", "?", { said_text: "unsure", letters_correct: null }),
    answer("ΚΑΙ", "Κ?Ι"),
    answer("ΚΑΙ", "ΚΙ"),
    answer("ΚΑΙ", "", { said_text: "no" }),
  ])[2];
  assert.equal(row.answers, 7);
  assert.equal(row.matched, 2);
});

test("Unrecorded help and earlier detection tasks do not migrate into reading-mode groups", () => {
  const rows = readingModes([
    answer("ΚΑΙ", "ΚΑΙ", { help_used: undefined }),
    answer("none", "", { task: "detect", said_text: "no" }),
    answer("Ε", "Ε", { task: "drawn", level: 0 }),
    answer("Ε", "Ε", { task: "identify", help_used: true }),
  ]);
  assert.deepEqual(rows.map(row => [row.answers, row.matched]), [[1, 1], [0, 0], [0, 0]]);
});
