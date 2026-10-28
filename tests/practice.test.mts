import assert from "node:assert/strict";
import test from "node:test";
import { planPractice, summarizePractice } from "../src/practice.ts";
import type { AnswerRecord, QuizItem } from "../src/types.ts";

type Item = QuizItem & { base_item?: string };
function item(id: string, extra: Partial<Item> = {}): Item {
  return {
    id, set: "practice", level: 1, degradation: 0, image: `${id}.webp`, alt: "Sample",
    truth: "Ε", task: "identify", source: ["source-a"], license: "CC BY-NC 4.0",
    credit: "Vesuvius Challenge", checked: "2026-10-28", explain: "Source-labelled example.",
    ...extra,
  };
}
function answer(id: string, extra: Partial<AnswerRecord> & { help_used?: boolean } = {}): AnswerRecord {
  return {
    item_id: id, level: 1, degradation: 0, said_text: "yes", letters: "Ε", confidence: 3,
    ms: 1000, answered_at: "2026-10-27T12:00:00Z", truth: "Ε", text_correct: true,
    letters_correct: true, verdict: "right", reading_points: 3, honesty_points: 0, ...extra,
  };
}
function seeded(seed: number): () => number {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
test("Practice rounds are varied, adaptive, balanced and reproducible without changing progress", () => {
  const latestElsewhere = answer("elsewhere", { answered_at: "2026-10-28T12:00:00Z" });
  const many = Array.from({ length: 24 }, (_, i) => item(`letter-${i}`));
  const originalJson = JSON.stringify(many);
  Object.freeze(many);
  for (const tile of many) Object.freeze(tile);
  const round = planPractice(many, [], 1, { random: seeded(123) });
  assert.equal(round.length, 12);
  assert.equal(new Set(round.map((tile) => tile.id)).size, 12);
  assert.equal(JSON.stringify(many), originalJson, "selection must not mutate available material");
  assert.deepEqual(round, planPractice(many, [], 1, { random: seeded(123) }), "seed reproduces a round");
  assert.equal(planPractice([item("one"), item("one"), item("study", { task: "study" }), item("later", { level: 2 })], [], 1).length, 1);
  assert.deepEqual(planPractice(many, [], 1, { size: 0 }), []);
  assert.deepEqual(planPractice(many, [], 1, { size: Infinity }), []);
  assert.deepEqual(planPractice(many, [], 3), []);

  const variants = [
    item("base", { task: "study" }), item("variant-a", { base_item: "base" }),
    item("variant-b", { base_item: "variant-a" }), item("variant-c", { base_item: "base" }),
    item("other"), item("third"), item("fourth"),
  ];
  for (let seed = 1; seed <= 100; seed++) {
    const selected = planPractice(variants, [], 1, { size: 4, random: seeded(seed) });
    assert.equal(selected.filter((tile) => tile.base_item).length, 1, "use distinct originals before more variants");
  }
  assert.deepEqual(summarizePractice(variants, [answer("variant-a"), answer("variant-b")], 1), {
    available: 6, originals: 4, seen: 2, seenOriginals: 1,
  });
  assert.deepEqual(summarizePractice([
    item("original", { task: "study" }), item("changed", { level: 3, base_item: "original" }),
  ], [answer("original")], 3), { available: 1, originals: 1, seen: 0, seenOriginals: 1 });

  const mixedSources = Array.from({ length: 8 }, (_, i) => item(`source-${i}`, { source: [i < 4 ? "a" : "b"] }));
  const alternating = planPractice(mixedSources, [], 1, { size: 8, random: seeded(789) });
  assert.ok(alternating.every((tile, i) => !i || tile.source[0] !== alternating[i - 1].source[0]), "alternate available source families");

  function selectedFirstRate(items: Item[], answers: AnswerRecord[], preferred: string): number {
    let selected = 0;
    const random = seeded(314159);
    for (let n = 0; n < 1000; n++) {
      if (planPractice(items, answers, 1, { size: 1, random })[0].id === preferred) selected++;
    }
    return selected / 1000;
  }
  const difficultyRate = selectedFirstRate([item("difficult"), item("comfortable")], [
    answer("difficult", { verdict: "wrong", letters_correct: false }), answer("comfortable"), latestElsewhere,
  ], "difficult");
  assert.ok(difficultyRate > 0.8, `previous errors should receive more practice: ${difficultyRate}`);
  const unseenRate = selectedFirstRate([item("unseen"), item("comfortable")], [answer("comfortable"), latestElsewhere], "unseen");
  assert.ok(unseenRate > 0.8, `unseen material should receive more practice: ${unseenRate}`);
  const assistedRate = selectedFirstRate([item("assisted"), item("independent")], [
    answer("assisted", { help_used: true }), answer("independent"), latestElsewhere,
  ], "assisted");
  assert.ok(assistedRate > 0.7, `assisted answers should be revisited: ${assistedRate}`);
  const recoveredRate = selectedFirstRate([item("recovered"), item("difficult")], [
    answer("recovered", { verdict: "wrong", letters_correct: false }),
    answer("recovered", { answered_at: "2026-10-28T09:00:00Z" }),
    answer("difficult", { verdict: "wrong", letters_correct: false }), latestElsewhere,
  ], "difficult");
  assert.ok(recoveredRate > 0.8, `use the latest answer instead of a lifetime error label: ${recoveredRate}`);

  const withEmpties = Array.from({ length: 30 }, (_, i) => item(`mixed-${i}`, {
    level: 2, task: "detect", truth: i < 6 ? "none" : "*",
  }));
  const layouts = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) {
    const selected = planPractice(withEmpties, [], 2, { random: seeded(seed) });
    assert.equal(selected.length, 12);
    assert.equal(selected.filter((tile) => tile.truth === "none").length, 3);
    assert.equal(new Set(selected.map((tile) => tile.id)).size, 12);
    layouts.add(selected.map((tile) => tile.truth === "none" ? "0" : "1").join(""));
  }
  assert.ok(layouts.size > 20, "empty tiles must not occupy fixed or regularly alternating positions");
  const scarceEmpties = withEmpties.filter((tile) => tile.id === "mixed-0" || tile.truth !== "none");
  const balancedShortRound = planPractice(scarceEmpties, [], 2, { random: seeded(47) });
  assert.equal(balancedShortRound.length, 5, "shorten a round to retain a fifth empty tiles without duplicates");
  assert.equal(balancedShortRound.filter((tile) => tile.truth === "none").length, 1);

});
