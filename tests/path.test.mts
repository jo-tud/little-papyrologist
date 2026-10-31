import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { parse } from "yaml";
import type { AnswerRecord, QuizItem, QuizSet } from "../src/types.ts";
import type { State } from "../src/store.ts";

const data = parse(readFileSync(new URL("../data/items.yaml", import.meta.url), "utf8")) as { sets: QuizSet[]; items: QuizItem[] };
const realSets = data.sets.filter(set => !set.practice_only && data.items.some(item => item.set === set.id && !item.practice_only));
const metadata = `data:text/javascript,${encodeURIComponent(`export const LEVELS = []; export const playSets = ${JSON.stringify(realSets)};`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith("/src/rules.ts")) {
      if (specifier === "./data") return { url: metadata, shortCircuit: true };
      if (specifier === "./scoring") return nextResolve("./scoring.ts", context);
    }
    return nextResolve(specifier, context);
  },
});
const { canStartFirstLine, levelAvailable } = await import("../src/rules.ts");
hooks.deregister();

const firstThree = data.items.filter(item => item.set === "first-letters-500p2" && !item.practice_only && item.task === "identify");
const response = (item: QuizItem): AnswerRecord => ({
  item_id: item.id, level: item.level, degradation: item.degradation, task: "identify",
  said_text: "unsure", letters: "?", confidence: null, ms: 1000,
  answered_at: "2026-10-31T12:00:00Z", truth: item.truth, text_correct: false,
  letters_correct: false, verdict: "unsure", reading_points: 0, honesty_points: 0,
});
const state = (answers: AnswerRecord[] = []): State => ({ answers, setsDone: {}, badges: {}, ranks: {} });

test("Three distinct introductory originals open the first reading regardless of correctness", () => {
  assert.deepEqual(firstThree.map(item => item.id), ["photo-248-epsilon", "photo-250-omicron", "photo-500p2-iota-tau"]);
  const answers = firstThree.map(response);
  assert.equal(canStartFirstLine(state()), false);
  assert.equal(canStartFirstLine(state(answers.slice(0, 2))), false);
  assert.equal(canStartFirstLine(state([answers[0], answers[0], answers[1]])), false);
  assert.equal(canStartFirstLine(state([...answers.slice(0, 2), { ...answers[2], item_id: "photo-250-rho" }])), false);
  const tried = state(answers);
  const before = JSON.stringify(tried);
  assert.equal(canStartFirstLine(tried), true, "not-sure responses count as trying the originals");
  assert.equal(levelAvailable(tried, 2), false, "other level 2 material remains locked");
  assert.equal(levelAvailable(tried, 3), false);
  assert.equal(JSON.stringify(tried), before, "early access does not complete the first lesson or change history");
});

test("First-reading access respects explicit manual levels and completed first lessons", () => {
  const tried = state(firstThree.map(response));
  assert.equal(canStartFirstLine({ ...tried, levelOverride: 0 }), false);
  assert.equal(canStartFirstLine({ ...tried, levelOverride: 1 }), false);
  assert.equal(canStartFirstLine({ ...state(), levelOverride: 2 }), true);
  assert.equal(canStartFirstLine({ ...state(), levelOverride: 3 }), true);
  const finished = { ...state(), setsDone: Object.fromEntries(realSets.filter(set => set.level === 1).map(set => [set.id, 1])) };
  assert.equal(canStartFirstLine(finished), true, "existing completed lessons retain access without the new answers");
  assert.equal(canStartFirstLine({ ...finished, levelOverride: 1 }), false);
  assert.equal(levelAvailable(state(), 1), true);
});
