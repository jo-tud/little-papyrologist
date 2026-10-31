import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { QuizItem } from "../src/types.ts";
import type { State } from "../src/store.ts";

const levels = Array.from({ length: 12 }, (_, index) => ({ level: index + 1, title: `Level ${index + 1}` }));
const sets = levels.map(level => ({ id: `original-${level.level}`, level: level.level, title: level.title, href: `#/quiz/original-${level.level}` }));
const items = levels.map(level => ({ id: `item-${level.level}`, set: `original-${level.level}`, level: level.level,
  task: "read", degradation: 0, truth: "ΚΑΙ" })) as QuizItem[];
const metadata = `data:text/javascript,${encodeURIComponent(`export const LEVELS = ${JSON.stringify(levels)};
export const playSets = ${JSON.stringify(sets)}; export const activeQuizItems = ${JSON.stringify(items)};
export const itemSetVersion = () => "test-items";`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./data" && context.parentURL?.includes("/src/")) return { url: metadata, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.includes("/src/")) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const { learningAction, savedRoundLabel } = await import("../src/learning-action.ts");
hooks.deregister();
const state = (): State => ({ answers: [], setsDone: {}, badges: {}, ranks: {} });

test("The next action follows multi-digit levels and never skips incomplete earlier work automatically", () => {
  assert.equal(learningAction(state()).href, "#/quiz/original-1");
  assert.equal(learningAction({ ...state(), levelOverride: 10 }).href, "#/quiz/original-10");
  const done = Object.fromEntries(sets.filter(set => set.level < 10).map(set => [set.id, 1]));
  assert.equal(learningAction({ ...state(), setsDone: done }).href, "#/quiz/original-10");
  assert.equal(learningAction({ ...state(), setsDone: { ...done, "original-4": 0 } }).href, "#/quiz/original-4");
  const allDone = Object.fromEntries(sets.map(set => [set.id, 1]));
  assert.equal(learningAction({ ...state(), setsDone: allDone }).href, "#/practice/12");
});

test("A practice round above level nine resumes only active short originals", () => {
  const round = { version: "test-items", item_ids: ["item-10"], index: 0, answer_keys: [],
    draft: { letters: [] }, checked: false, help_used: false, elapsed_ms: 0 };
  assert.equal(savedRoundLabel({ ...state(), rounds: { "practice-10": round } }, "practice-10"), "Continue · 0/1");
  assert.equal(savedRoundLabel({ ...state(), rounds: { "practice-10": { ...round, item_ids: ["retired-altered"] } } }, "practice-10"), undefined);
  assert.equal(savedRoundLabel({ ...state(), rounds: { "practice-10": { ...round, item_ids: ["item-1"] } } }, "practice-10"), undefined);
});
