import assert from "node:assert/strict";
import test from "node:test";
import { score } from "../src/scoring.ts";

test("An unreadable simulated image rewards restraint without claiming a correct ink detection", () => {
  const result = score({ text: "*", simulated: true }, { said: "unsure", letters: "", confidence: 2 });
  assert.equal(result.verdict, "careful");
  assert.equal(result.honesty, 1);
  assert.equal(result.reading, 0);
  assert.equal(result.text_correct, false);
  assert.equal(result.letters_correct, null);
});

test("Partial simulated readings reward visible letters and admitted gaps separately", () => {
  const result = score({ text: "ΚΑΙ", simulated: true }, { said: "yes", letters: "Κ?Ι", confidence: 2 });
  assert.equal(result.verdict, "careful");
  assert.equal(result.letters_correct, false);
  assert.equal(result.letters_ok, 2);
  assert.equal(result.letters_total, 3);
  assert.equal(result.honesty, 1);
  assert.deepEqual(result.marks, ["ok", "honest", "ok"]);
  const complete = score({ text: "ΚΑΙ", simulated: true }, { said: "yes", letters: "ΚΑΙ", confidence: 2 });
  assert.ok(result.reading < complete.reading, "a question mark must not award a reading point");
});

test("A wholly uncertain simulated line never counts as a completed reading", () => {
  const result = score({ text: "ΚΑΙ", simulated: true }, { said: "unsure", letters: "???", confidence: 1 });
  assert.equal(result.reading, 0);
  assert.equal(result.honesty, 1);
  assert.equal(result.letters_correct, false);
  assert.equal(result.text_correct, false);
  assert.ok(result.marks.every((mark) => mark === "honest"));
  const lettersOnly = score({ text: "ΚΑΙ", simulated: true }, { said: "yes", letters: "???", confidence: 1 });
  assert.equal(lettersOnly.letters_ok, 0);
  assert.equal(lettersOnly.letters_correct, false);
});

test("An edition's explicit uncertainty accepts a question mark without counting a read letter", () => {
  const result = score({ text: "ΚΑΙ", uncertain: [1] }, { said: "yes", letters: "Κ?Ι", confidence: 2 });
  assert.equal(result.letters_correct, true);
  assert.equal(result.letters_ok, 2);
  assert.equal(result.honesty, 1);
  assert.deepEqual(result.marks, ["ok", "honest", "ok"]);
  const certainSource = score({ text: "ΚΑΙ" }, { said: "yes", letters: "Κ?Ι", confidence: 2 });
  assert.equal(certainSource.letters_correct, false);
  assert.equal(certainSource.letters_ok, 2);
});

test("A source with an undecidable position does not turn its question mark into a read letter", () => {
  const result = score({ text: "Α?Ν" }, { said: "yes", letters: "Α?Ν", confidence: 2 });
  assert.equal(result.letters_ok, 2);
  assert.equal(result.letters_correct, true);
  assert.equal(result.honesty, 1);
  assert.deepEqual(result.marks, ["ok", "honest", "ok"]);
});

test("A missing or extra letter does not make every following letter incorrect", () => {
  const exact = score({ text: "ΚΑΙΝ" }, { said: "yes", letters: "ΚΑΙΝ", confidence: 2 });
  assert.equal(exact.letters_correct, true);
  assert.equal(exact.letters_ok, 4);
  const missing = score({ text: "ΚΑΙΝ" }, { said: "yes", letters: "ΚΙΝ", confidence: 2 });
  assert.equal(missing.letters_correct, false);
  assert.equal(missing.letters_ok, 3);
  assert.equal(missing.extras, 0);
  assert.deepEqual(missing.marks, ["ok", "missing", "ok", "ok"]);
  const extra = score({ text: "ΚΑΙΝ" }, { said: "yes", letters: "ΚΑΕΙΝ", confidence: 2 });
  assert.equal(extra.letters_correct, false);
  assert.equal(extra.letters_ok, 4);
  assert.equal(extra.extras, 1);
  assert.deepEqual(extra.marks, ["ok", "ok", "ok", "ok"]);
});

test("Ink-only labels never grade invented letter identities", () => {
  const first = score({ text: "*" }, { said: "yes", letters: "ΚΑΙ", confidence: 2 });
  const second = score({ text: "*" }, { said: "yes", letters: "ΟΝ", confidence: 2 });
  assert.equal(first.letters_correct, null);
  assert.deepEqual(first, second);
});

test("Correct empty answers earn honesty; a confident false alarm costs one reading point", () => {
  const empty = score({ text: "none" }, { said: "no", letters: "", confidence: 3 });
  assert.equal(empty.text_correct, true);
  assert.equal(empty.letters_correct, null);
  assert.equal(empty.honesty, 2);
  const falseAlarm = score({ text: "none" }, { said: "yes", letters: "Ν", confidence: 3 });
  assert.equal(falseAlarm.verdict, "false-alarm");
  assert.equal(falseAlarm.reading, -1);
  assert.equal(falseAlarm.letters_correct, null);
  const uncertain = score({ text: "none" }, { said: "unsure", letters: "", confidence: 1 });
  assert.equal(uncertain.reading, 0);
  assert.equal(uncertain.honesty, 1);
});
