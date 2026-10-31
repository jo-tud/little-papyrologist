import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { AnswerRecord } from "../src/types.ts";
import type { State } from "../src/store.ts";

// Calibration needs saved answers only, not the YAML-backed level catalogue.
const metadata = "data:text/javascript,export const LEVELS = []; export const playSets = [];";
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith("/src/rules.ts")) {
      if (specifier === "./data") return { url: metadata, shortCircuit: true };
      if (specifier === "./scoring") return nextResolve("./scoring.ts", context);
    }
    return nextResolve(specifier, context);
  },
});
const { evaluate } = await import("../src/rules.ts");
hooks.deregister();

const answer = (confidence: AnswerRecord["confidence"], correct: boolean): AnswerRecord => ({
  item_id: "example", level: 1, degradation: 0, task: "identify", said_text: "yes",
  letters: correct ? "Ε" : "Ο", confidence, ms: 1000, answered_at: "2026-10-31T12:00:00Z",
  truth: "Ε", text_correct: true, letters_correct: correct, verdict: correct ? "right" : "wrong",
  reading_points: correct ? 3 : 1, honesty_points: 0,
});
const progress = (answers: AnswerRecord[]): State => ({ answers, badges: {}, ranks: {}, setsDone: {} });

test("Unasked confidence never contributes to a confidence award or its accuracy denominator", () => {
  const requirements = { calibration: { sure_answers: 2, right_share: 0.5 } };
  const check = (answers: AnswerRecord[]) => evaluate(requirements, progress(answers), id => id);
  const unasked = [answer(null, true), answer(null, false), answer(null, true)];
  const noRatings = check(unasked)[0];
  assert.equal(noRatings.have, 0);
  assert.equal(noRatings.met, false);
  const rated = [answer(3, true), answer(3, false), answer(1, true), answer(2, false)];
  assert.equal(check(rated)[0].met, true);
  assert.deepEqual(check([...rated, ...unasked]), check(rated));
  const exact = { calibration: { sure_answers: 2, right_share: 1 } };
  const strictCheck = evaluate(exact, progress([...rated, ...unasked]), id => id)[0];
  assert.equal(strictCheck.met, false, "unasked correct answers cannot dilute a sure-but-wrong answer");
});
