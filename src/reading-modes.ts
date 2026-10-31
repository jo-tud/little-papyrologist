import { answerOutcome } from "./scoring";
import type { AnswerRecord } from "./types";

/** A complete response can be a letter reading or a correct “No letters” decision. */
export function readingModes(answers: readonly AnswerRecord[]) {
  const originals = answers.filter(answer => answer.level > 0);
  return [
    { title: "Recognition with choices", list: originals.filter(answer => answer.task === "identify") },
    { title: "Reading with clues or a guide", list: originals.filter(answer => answer.task === "read" && answer.help_used) },
    { title: "Reading without opening extra help", list: originals.filter(answer => answer.task === "read" && answer.help_used === false) },
  ].map(({ title, list }) => ({
    title,
    answers: list.length,
    matched: list.filter(answer => answerOutcome(answer) === "matched").length,
  }));
}
