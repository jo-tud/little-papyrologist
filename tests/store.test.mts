import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { answerKey, canResume } from "../src/round-session.ts";
import type { AnswerRecord } from "../src/types.ts";
import type { RoundSession } from "../src/round-session.ts";

// The browser bundler resolves extensionless imports; give Node the same dependency.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./data" && context.parentURL?.endsWith("/src/store.ts"))
      return { url: `data:text/javascript,export const availableLevelNumbers = ${JSON.stringify(Array.from({ length: 13 }, (_, level) => level))};`, shortCircuit: true };
    if (specifier === "./round-session" && context.parentURL?.endsWith("/src/store.ts"))
      return nextResolve("./round-session.ts", context);
    return nextResolve(specifier, context);
  },
});
const { addAnswer, clearAll, exportPayload, importText, load, saveRound, setLevelOverride, state } = await import("../src/store.ts");
hooks.deregister();

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} } });

const answer: AnswerRecord = {
  item_id: "first-photo", task: "identify", level: 1, degradation: 0, said_text: "yes", letters: "Ε",
  confidence: null, ms: 5000, answered_at: "2026-10-31T12:00:00Z", truth: "Ε",
  text_correct: true, letters_correct: true, verdict: "right", reading_points: 3, honesty_points: 0,
};

test("Backup and browser storage preserve unasked confidence and checked feedback", () => {
  clearAll();
  const round: RoundSession = {
    version: "test-items", item_ids: ["first-photo", "second-photo"], index: 0,
    answer_keys: [answerKey(answer)], draft: { said: "yes", letters: ["Ε"], confidence: null },
    checked: true, help_used: true, elapsed_ms: 5000,
  };
  addAnswer(answer);
  saveRound("first-letters", round);
  assert.equal(load().answers[0].confidence, null);
  assert.equal(load().rounds?.["first-letters"].draft.confidence, null);
  const exported = JSON.stringify(exportPayload("test-version", "test-items"));
  assert.equal(JSON.parse(exported).answers[0].confidence, null);
  clearAll();
  assert.deepEqual(importText(exported, "test-items"), { added: 1, duplicates: 0, skipped: 0 });
  assert.equal(state().answers[0].confidence, null);
  assert.equal(canResume(state().rounds?.["first-letters"], "test-items",
    new Set(round.item_ids), state().answers), true);
  assert.deepEqual(importText(exported, "test-items"), { added: 0, duplicates: 1, skipped: 0 });
  clearAll();
});

test("Import accepts historical ratings and explicit null, but rejects missing or invalid confidence", () => {
  clearAll();
  const values = [null, 1, 2, 3, undefined, 0, 4, "3"];
  const answers = values.map((confidence, index) => ({ ...answer, item_id: `tile-${index}`, confidence }));
  const result = importText(JSON.stringify({ app: "little-papyrologist", answers }));
  assert.deepEqual(result, { added: 4, duplicates: 0, skipped: 4 });
  assert.deepEqual(state().answers.map(a => a.confidence), [null, 1, 2, 3]);
  clearAll();
});

test("Multi-digit manual levels survive backup while old altered-image history stays unchanged", () => {
  clearAll();
  const historical = { ...answer, item_id: "harder-d3-line", level: 3, degradation: 3, simulated: true, reading_points: 7 };
  const modern = { ...answer, item_id: "original-level-10", level: 10, presence_asked: false, reading_points: 2 };
  importText(JSON.stringify({ app: "little-papyrologist", answers: [historical, modern],
    progress: { level_override: 10, sets_done: { "harder-images": 1 } } }));
  assert.equal(state().levelOverride, 10);
  assert.equal(state().setsDone["harder-images"], 1);
  assert.deepEqual(state().answers, [historical, modern]);
  const backup = JSON.stringify(exportPayload("test", "test-items"));
  clearAll();
  importText(backup);
  assert.equal(state().levelOverride, 10);
  assert.deepEqual(state().answers, [historical, modern]);
  setLevelOverride(12);
  assert.equal(load().levelOverride, 12);
  setLevelOverride(999);
  assert.equal(state().levelOverride, 12, "unknown levels must not become selectable");
  setLevelOverride();
  assert.equal(state().levelOverride, undefined);
  clearAll();
});
