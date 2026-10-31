import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";
import { resolveAlphabetExamples } from "../src/alphabet-examples.ts";
import type { QuizItem } from "../src/types.ts";

const { items } = parse(readFileSync(new URL("../data/items.yaml", import.meta.url), "utf8")) as { items: QuizItem[] };

test("Alphabet originals use existing checked readings and retain group context", () => {
  const examples = resolveAlphabetExamples(items);
  assert.deepEqual([...examples].filter(([, list]) => list[0].item.truth.length === 1).map(([char]) => char),
    ["Ε", "Η", "Ι", "Ν", "Ο", "Ρ"]);
  assert.deepEqual([...examples].filter(([, list]) => list[0].item.truth.length > 1).map(([char]) => char),
    ["Γ", "Λ", "Π", "Τ"]);
  assert.equal(examples.get("Λ")![0].item.truth, "ΠΛΗ");
  assert.equal(examples.get("Π")![0].item.truth, "ΠΛΗ");
  assert.equal(examples.get("Τ")![0].item.truth, "ΙΤ");
  for (const [char, list] of examples) {
    assert.equal(new Set(list.map(example => example.item.image)).size, list.length, `${char}: a repeated image is not a new example`);
    for (const { item } of list) {
      assert.ok(item.credit.includes("Vesuvius Challenge"));
      if (item.source.includes("grandprize")) assert.ok(item.credit.includes("EduceLab, University of Kentucky"));
    }
  }
});

test("Alphabet reference rejects altered, uncertain, mismatched or uncredited originals", () => {
  for (const mutation of [
    { degradation: 1 }, { simulated: true }, { uncertain: [0] }, { truth: "Ο" },
    { checked: "" }, { credit: "" }, { source: [] }, { license: "" },
  ]) {
    const changed = items.map(item => item.id === "photo-248-epsilon" ? { ...item, ...mutation } : item);
    assert.throws(() => resolveAlphabetExamples(changed), /Invalid alphabet example: photo-248-epsilon/);
  }
  assert.throws(() => resolveAlphabetExamples(items.filter(item => item.id !== "photo-248-epsilon")), /Invalid alphabet example/);
});
