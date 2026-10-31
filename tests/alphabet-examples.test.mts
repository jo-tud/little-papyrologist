import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { parse } from "yaml";
import type { QuizItem } from "../src/types.ts";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./letter-regions") return nextResolve("./letter-regions.ts", context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".yaml")) return { format: "module", shortCircuit: true,
      source: `export default ${JSON.stringify(parse(readFileSync(new URL(url), "utf8")))};` };
    return nextLoad(url, context);
  },
});
const { resolveAlphabetExamples } = await import("../src/alphabet-examples.ts");
hooks.deregister();

const { items } = parse(readFileSync(new URL("../data/items.yaml", import.meta.url), "utf8")) as { items: QuizItem[] };

test("Alphabet originals use existing checked readings and retain group context", () => {
  const examples = resolveAlphabetExamples(items);
  assert.deepEqual([...examples.keys()].sort(), [..."ΑΓΔΕΗΘΙΚΛΜΝΟΠΡϹΤΥΦΩ"].sort());
  assert.equal(examples.get("Α")![0].item.truth, "ΚΑΙ");
  assert.equal(examples.get("Ω")![0].item.truth, "ΤΩΝ");
  assert.equal(examples.get("Λ")![0].item.truth, "ΠΛΗ");
  assert.equal(examples.get("Π")![0].item.truth, "ΠΛΗ");
  assert.equal(examples.get("Τ")![0].item.truth, "ΙΤ");
  for (const [char, list] of examples) {
    assert.equal(new Set(list.map(example => example.item.image)).size, list.length, `${char}: a repeated image is not a new example`);
    for (const { item } of list) {
      assert.ok(item.truth.includes(char));
      assert.equal(item.degradation, 0);
      assert.equal(item.uncertain?.length ?? 0, 0);
      assert.ok(item.credit.includes("Vesuvius Challenge"));
      if (item.source.includes("grandprize")) assert.ok(item.credit.includes("EduceLab, University of Kentucky"));
    }
  }
  const newlyNamedPhotos = [...examples.values()].flat().filter(example => example.partial);
  assert.ok(newlyNamedPhotos.length >= 6);
  for (const { item } of newlyNamedPhotos) {
    assert.equal(item.task, "study");
    assert.ok(item.answer_image, "partial photographed examples retain the organizer's tracing");
    assert.ok(!items.some(quiz => quiz.id === item.id), "partial alphabet photographs do not become scored questions");
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
