import type { SaidText } from "./types";

export interface Truth {
  /** Letters as read, "?" for a letter that cannot be decided, or "none" for no text. */
  text: string;
  /** For an undecidable letter: the letters it could be. */
  candidates?: string[];
  /** Positions the edition marks as uncertain. */
  uncertain?: number[];
}

export interface Given {
  said: SaidText;
  letters: string;
  confidence: 1 | 2 | 3;
}

export type Verdict =
  | "right" // read correctly
  | "honest" // honest "can't tell" or "no text" where that was right
  | "careful" // "can't tell" on a readable letter: not wrong, but readable
  | "guessed" // named a possible letter where nobody could decide
  | "false-alarm" // saw text on a tile without any
  | "missed" // said "no text" where there was text
  | "wrong";

export interface Score {
  verdict: Verdict;
  text_correct: boolean;
  letters_correct: boolean | null;
  reading: number;
  honesty: number;
  /** One entry per position: was it right? Used for the coloured comparison. */
  marks: ("ok" | "honest" | "wrong" | "missing")[];
}

const chars = (s: string) => Array.from(s);

/**
 * Points: reading points for what you read, honesty points for saying what you could not see.
 * Being sure and wrong costs a point. Nothing else is ever taken away.
 */
export function score(truth: Truth, given: Given): Score {
  const sure = given.confidence === 3;
  const isNull = truth.text === "none";

  if (isNull) {
    if (given.said === "no")
      return { verdict: "honest", text_correct: true, letters_correct: null, reading: 0, honesty: 2, marks: [] };
    if (given.said === "unsure")
      return { verdict: "honest", text_correct: false, letters_correct: null, reading: 0, honesty: 1, marks: [] };
    return { verdict: "false-alarm", text_correct: false, letters_correct: null, reading: sure ? -1 : 0, honesty: 0, marks: [] };
  }

  if (given.said === "no")
    return { verdict: "missed", text_correct: false, letters_correct: false, reading: 0, honesty: 0, marks: chars(truth.text).map(() => "missing") };

  let reading = given.said === "yes" ? 1 : 0;
  let honesty = 0;
  const want = chars(truth.text);
  const got = chars(given.letters);
  const uncertain = new Set(truth.uncertain ?? []);
  const marks: Score["marks"] = [];
  let allRight = got.length === want.length;
  let anyWrong = false;
  let honestCalls = 0;
  let readableQuestionMarks = 0;
  let guessedCandidate = false;

  want.forEach((w, i) => {
    const g = got[i];
    if (g === undefined) {
      marks.push("missing");
      allRight = false;
      return;
    }
    const undecidable = w === "?" || uncertain.has(i);
    if (g === "?") {
      if (undecidable) {
        honesty += 2;
        honestCalls++;
        marks.push("honest");
      } else {
        honesty += 1;
        readableQuestionMarks++;
        allRight = false;
        marks.push("honest");
      }
    } else if (g === w && w !== "?") {
      reading += 2;
      marks.push("ok");
    } else {
      allRight = false;
      if (w === "?" && truth.candidates?.includes(g)) guessedCandidate = true;
      else anyWrong = true;
      marks.push("wrong");
    }
  });
  if (got.length > want.length) {
    anyWrong = true;
    allRight = false;
  }
  if (sure && (anyWrong || guessedCandidate)) reading -= 1;

  let verdict: Verdict;
  if (anyWrong) verdict = "wrong";
  else if (guessedCandidate) verdict = "guessed";
  else if (allRight) verdict = honestCalls > 0 && honestCalls === want.length ? "honest" : "right";
  else if (readableQuestionMarks > 0) verdict = "careful";
  else verdict = "wrong";

  return {
    verdict,
    text_correct: given.said === "yes",
    letters_correct: allRight,
    reading,
    honesty,
    marks,
  };
}
