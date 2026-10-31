import assert from "node:assert/strict";
import test from "node:test";
import { answerOutcome, readingStats, score } from "../src/scoring.ts";
import type { AnswerRecord } from "../src/types.ts";

test("Direct letter choices earn credit for matched letters, not for implicit presence", () => {
  const cases = [
    { truth: "Ε", letters: "Ε", reading: 2, verdict: "right" },
    { truth: "Ε", letters: "Ο", reading: 0, verdict: "wrong" },
    { truth: "ΙΤ", letters: "ΙΤ", reading: 2, verdict: "right" },
    { truth: "ΙΤ", letters: "ΟΘ", reading: 0, verdict: "wrong" },
    { truth: "ΙΤ", letters: "ΙΓ", reading: 1, verdict: "wrong" },
  ];
  for (const { truth, letters, reading, verdict } of cases) {
    const given = { said: "yes", letters, confidence: null } as const;
    const direct = score({ text: truth }, { ...given, presenceAsked: false });
    const historical = score({ text: truth }, given);
    assert.equal(direct.reading, reading);
    assert.equal(direct.verdict, verdict);
    assert.equal(direct.honesty, 0);
    assert.deepEqual(direct, { ...historical, reading: historical.reading - 1 },
      "only the implicit-presence point is removed; grades and letter counters are unchanged");
    assert.deepEqual(score({ text: truth }, { ...given, presenceAsked: true }), historical,
      "omitting the flag preserves the previous presence question behavior");
  }
});

test("Not-sure direct choices receive no presence credit and preserve honest uncertainty", () => {
  for (const text of ["Ε", "ΙΤ"]) {
    const given = { said: "unsure", letters: "?".repeat(text.length), confidence: null } as const;
    const direct = score({ text }, { ...given, presenceAsked: false });
    assert.equal(direct.reading, 0);
    assert.equal(direct.verdict, "careful");
    assert.equal(direct.letters_ok, 0);
    assert.equal(direct.letters_correct, false);
    assert.deepEqual(direct, score({ text }, given));
  }
});

test("Unasked confidence preserves reading credit without applying a sure-but-wrong penalty", () => {
  const correct = score({ text: "Ε" }, { said: "yes", letters: "Ε", confidence: null });
  assert.equal(correct.verdict, "right");
  assert.equal(correct.reading, 3);
  assert.equal(correct.honesty, 0);
  assert.equal(correct.letters_ok, 1);
  for (const [truth, letters] of [["Ε", "Ο"], ["ΙΤ", "ΙΓ"], ["none", "Ε"]]) {
    const unasked = score({ text: truth }, { said: "yes", letters, confidence: null });
    const rated = score({ text: truth }, { said: "yes", letters, confidence: 3 });
    assert.equal(unasked.reading, rated.reading + 1);
    assert.equal(unasked.verdict, rated.verdict);
    assert.equal(unasked.honesty, 0);
    assert.equal(unasked.letters_correct, rated.letters_correct);
  }
  const unsure = score({ text: "Ε" }, { said: "unsure", letters: "?", confidence: null });
  assert.equal(unsure.verdict, "careful");
  assert.equal(unsure.letters_ok, 0);
  assert.equal(unsure.reading, 0);
});

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
  assert.equal(result.letters_ok, 0);
  assert.equal(result.letters_total, 3);
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

test("Single-letter feedback has consistent counters for correct, unknown and missing readings", () => {
  for (const letter of ["Η", "Ν", "Ε"]) {
    const correct = score({ text: letter }, { said: "yes", letters: letter, confidence: 3 });
    assert.equal(correct.letters_correct, true);
    assert.equal(correct.letters_ok, 1);
    assert.equal(correct.letters_total, 1);
    const unknown = score({ text: letter }, { said: "yes", letters: "?", confidence: 1 });
    assert.equal(unknown.letters_ok, 0);
    assert.equal(unknown.letters_total, 1);
    const missing = score({ text: letter }, { said: "no", letters: "", confidence: 2 });
    assert.equal(missing.letters_ok, 0);
    assert.equal(missing.letters_total, 1);
  }
});

test("An omitted line stays in the letter denominator for no-writing and unsure responses", () => {
  const read = score({ text: "ΓΕΙ" }, { said: "yes", letters: "ΓΕΙ", confidence: 2 });
  for (const said of ["no", "unsure"] as const) {
    const skipped = score({ text: "ΓΕΙΝΕϹΘΑΙΠΑΡΑΠΛΗ", simulated: true }, { said, letters: "", confidence: 1 });
    assert.equal(skipped.letters_ok, 0);
    assert.equal((read.letters_total ?? 0) + (skipped.letters_total ?? 0), 19);
  }
});

const saved = (truth: string, letters: string, extra: Partial<AnswerRecord> = {}): AnswerRecord => ({
  item_id: "saved-example", task: "read", level: 2, degradation: 0,
  said_text: "yes", letters, truth, confidence: 2, ms: 100, answered_at: "2026-10-28T12:00:00Z",
  text_correct: true, letters_correct: false, verdict: "wrong", reading_points: 0, honesty_points: 0, ...extra,
});

test("Historical answers derive display counts without rewriting saved scores", () => {
  const historic = saved("Η", "Η", { letters_correct: true, verdict: "right", reading_points: 3 });
  const before = JSON.stringify(historic);
  assert.equal(readingStats(historic)?.correct, 1);
  assert.equal(readingStats(historic)?.complete, true);
  const unsure = saved("ΓΕΙΝΕϹΘΑΙΠΑΡΑΠΛΗ", "", { said_text: "unsure", verdict: "careful", honesty_points: 1 });
  assert.equal(readingStats(unsure)?.total, 16);
  assert.equal(readingStats(unsure)?.correct, 0);
  assert.equal(answerOutcome(unsure), "open");
  assert.equal(JSON.stringify(historic), before);
  assert.equal("letters_total" in historic, false);
});

test("Accepted uncertain positions count as open, never as a fully read tile", () => {
  const accepted = saved("ΟΚΑΙΥΠΑΛΛΩΝΔΟΚΕΙ", "ΟΚ?ΙΥΠΑΛΛΩΝΔΟΚΕΙ", {
    verdict: "right", letters_correct: true, letters_ok: 15, letters_total: 16, honesty_points: 1,
  });
  const counts = readingStats(accepted)!;
  assert.equal(counts.accepted, true);
  assert.equal(counts.correct, 15);
  assert.equal(counts.complete, false);
  assert.equal(counts.open, 1);
  assert.equal(answerOutcome(accepted), "open");
  const oldUnknown = saved("Α?Ν", "Α?Ν", { letters_correct: true, letters_ok: 3, letters_total: 3 });
  assert.equal(readingStats(oldUnknown)?.correct, 2, "old question-mark counts are not displayed as read letters");
});

test("Results distinguish matches, uncertainty and incorrect claims across task types", () => {
  assert.equal(answerOutcome(saved("ΚΑΙ", "ΚΑΙ")), "matched");
  assert.equal(answerOutcome(saved("ΚΑΙ", "Κ?Ι")), "open");
  assert.equal(answerOutcome(saved("ΚΑΙ", "ΚΙ")), "open");
  assert.equal(answerOutcome(saved("ΚΑΙ", "Κ?Ν")), "incorrect");
  assert.equal(answerOutcome(saved("ΚΑΙ", "ΚΑΙΝ")), "incorrect");
  assert.equal(answerOutcome(saved("ΚΑΙ", "", { said_text: "no" })), "incorrect");
  assert.equal(answerOutcome(saved("none", "", { task: "detect", said_text: "no" })), "matched");
  assert.equal(answerOutcome(saved("none", "", { task: "detect", said_text: "unsure", honesty_points: 1 })), "open");
  assert.equal(answerOutcome(saved("none", "Η", { task: "detect" })), "incorrect");
  assert.equal(answerOutcome(saved("*", "invented letters", { task: "detect" })), "matched");
  assert.equal(readingStats(saved("*", "invented letters", { task: "detect" })), null);
});

test("Extra letters before or after a single match use the same alignment in scores and results", () => {
  const exact = score({ text: "Η" }, { said: "yes", letters: "Η", confidence: 3 });
  for (const letters of ["ΝΗ", "ΗΝ", "ΗΗ"]) {
    for (const confidence of [2, 3] as const) {
      const result = score({ text: "Η" }, { said: "yes", letters, confidence });
      const counts = readingStats(saved("Η", letters, { letters_correct: result.letters_correct }))!;
      assert.equal(result.letters_ok, 1);
      assert.equal(result.letters_total, 1);
      assert.equal(result.extras, 1);
      assert.deepEqual(result.marks, ["ok"]);
      assert.equal(result.verdict, "wrong");
      assert.equal(result.letters_correct, false);
      assert.equal(result.reading, confidence === 3 ? exact.reading - 1 : exact.reading);
      assert.equal(counts.correct, result.letters_ok);
      assert.equal(counts.total, result.letters_total);
      assert.equal(counts.extras, result.extras);
      assert.equal(counts.complete, false);
      assert.equal(answerOutcome(saved("Η", letters)), "incorrect");
    }
  }
  const historical = saved("Η", "ΝΗ", { letters_ok: 0, letters_total: 1, reading_points: 0 });
  const before = JSON.stringify(historical);
  assert.equal(readingStats(historical)?.correct, 1);
  assert.equal(JSON.stringify(historical), before, "display alignment never rewrites historical points or counters");
});

test("An undecidable single letter stays undecidable after alignment, including candidate guesses", () => {
  const truth = { text: "?", candidates: ["Η", "Ν"] };
  for (const letter of truth.candidates) {
    const guessed = score(truth, { said: "yes", letters: letter, confidence: 3 });
    assert.equal(guessed.verdict, "guessed");
    assert.equal(guessed.letters_correct, false);
    assert.equal(guessed.letters_ok, 0);
    assert.equal(guessed.letters_total, 1);
    assert.equal(guessed.extras, 0);
    assert.equal(guessed.reading, 0);
    assert.deepEqual(guessed.marks, ["wrong"]);
    assert.equal(readingStats(saved("?", letter))?.complete, false);
    assert.equal(answerOutcome(saved("?", letter)), "incorrect");
  }
  const open = score(truth, { said: "yes", letters: "?", confidence: 2 });
  assert.equal(open.verdict, "honest");
  assert.equal(open.letters_correct, true);
  assert.equal(open.letters_ok, 0);
  assert.equal(open.honesty, 2);
  assert.equal(readingStats(saved("?", "?", { letters_correct: true }))?.complete, false);
  assert.equal(answerOutcome(saved("?", "?")), "open");
  for (const letters of ["Η?", "?Η"]) {
    const extra = score(truth, { said: "yes", letters, confidence: 3 });
    const counts = readingStats(saved("?", letters))!;
    assert.equal(extra.verdict, "wrong");
    assert.equal(extra.letters_correct, false);
    assert.equal(extra.letters_ok, counts.correct);
    assert.equal(extra.extras, counts.extras);
    assert.equal(extra.extras, 1);
    assert.equal(counts.complete, false);
  }
  assert.equal(score(truth, { said: "yes", letters: "Α", confidence: 2 }).verdict, "wrong");
});
