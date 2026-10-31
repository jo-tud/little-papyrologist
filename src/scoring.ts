import type { AnswerRecord, Confidence, SaidText } from "./types";

export interface Truth {
  /** Letters as read, "?" for a letter that cannot be decided, or "none" for no text. */
  text: string;
  /** For an undecidable letter: the letters it could be. */
  candidates?: string[];
  /** Positions the edition marks as uncertain. */
  uncertain?: number[];
  /** A source reading does not establish visibility in an artificially altered view. */
  simulated?: boolean;
}

export interface Given {
  said: SaidText;
  letters: string;
  confidence: Confidence;
  /** False when "yes" is implicit in a letter choice, rather than a separate presence answer. */
  presenceAsked?: boolean;
}

export type Verdict =
  | "right" // read correctly
  | "honest" // honest "can't tell" or "no text" where that was right
  | "careful" // "can't tell" on a readable letter: not wrong, but readable
  | "guessed" // named a possible letter where nobody could decide
  | "false-alarm" // saw text on a tile without any
  | "missed" // said "no text" where there was text
  | "wrong";

export type Mark = "ok" | "honest" | "wrong" | "missing";

export interface Score {
  verdict: Verdict;
  text_correct: boolean;
  letters_correct: boolean | null;
  reading: number;
  honesty: number;
  /** One entry per letter of the reading: was it right? Used for the coloured comparison. */
  marks: Mark[];
  /** For all letter tasks: letters read correctly, out of how many, and extra letters typed. */
  letters_ok?: number;
  letters_total?: number;
  extras?: number;
}

/**
 * Lines up a typed reading with the true one, like a diff, so that one missed letter
 * does not make every later letter wrong. "?" may stand for any letter.
 */
export function align(want: string[], got: string[]): { marks: (Mark | null)[]; pairs: (string | null)[]; extras: number } {
  const n = want.length;
  const m = got.length;
  const sub = (i: number, j: number) => (got[j] === want[i] ? 0 : got[j] === "?" ? 0.4 : 1);
  const dp = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = Math.min(dp[i - 1][j - 1] + sub(i - 1, j - 1), dp[i - 1][j] + 1, dp[i][j - 1] + 1);
  const pairs: (string | null)[] = new Array(n).fill(null);
  let i = n;
  let j = m;
  let extras = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + sub(i - 1, j - 1))) < 1e-9) {
      pairs[i - 1] = got[j - 1];
      i--;
      j--;
    } else if (i > 0 && Math.abs(dp[i][j] - (dp[i - 1][j] + 1)) < 1e-9) {
      i--; // letter of the reading not typed
    } else {
      extras++; // typed letter with no counterpart
      j--;
    }
  }
  return { marks: [], pairs, extras };
}

const chars = (s: string) => Array.from(s);

export interface ReadingStats {
  correct: number;
  total: number;
  extras: number;
  /** Missing positions and explicit question marks, including uncertainty in the source. */
  open: number;
  wrong: number;
  complete: boolean;
  /** The saved grade may accept a question mark at an uncertain source position. */
  accepted: boolean;
}

type SavedReading = Pick<AnswerRecord, "truth" | "letters" | "said_text" | "letters_correct" | "task">;

/**
 * Derive displayed counts from the saved reference and response, including old answers
 * without counters. This does not rescore the attempt or change its stored points.
 */
export function readingStats(answer: SavedReading): ReadingStats | null {
  if (answer.truth === "none" || answer.truth === "*" || answer.task === "detect") return null;
  const want = chars(answer.truth);
  const got = answer.said_text === "no" ? [] : chars(answer.letters);
  const { pairs, extras } = align(want, got);
  let correct = 0;
  let open = 0;
  let wrong = extras;
  want.forEach((w, i) => {
    const g = pairs[i];
    if (g === null || g === "?") open++;
    else if (g === w && w !== "?") correct++;
    else wrong++;
  });
  return {
    correct, total: want.length, extras, open, wrong,
    complete: want.length > 0 && correct === want.length && extras === 0 && answer.said_text === "yes",
    accepted: answer.letters_correct === true,
  };
}

/** Separate a full match, a response left open, and an incorrect claim. */
export function answerOutcome(answer: SavedReading): "matched" | "open" | "incorrect" {
  const letters = readingStats(answer);
  if (letters) {
    if (letters.wrong > 0 || answer.said_text === "no") return "incorrect";
    return letters.complete ? "matched" : "open";
  }
  if (answer.said_text === "unsure") return "open";
  const wanted = answer.truth === "none" ? "no" : "yes";
  return answer.said_text === wanted ? "matched" : "incorrect";
}

/**
 * Points: reading points for what you read, honesty points for saying what you could not see.
 * Being sure and wrong costs a point. Unasked confidence (null) never applies that penalty.
 * Nothing else is ever taken away.
 */
export function score(truth: Truth, given: Given): Score {
  const sure = given.confidence === 3;
  const isNull = truth.text === "none";

  if (truth.simulated && given.said === "unsure" && !given.letters.replace(/\?/g, "")) {
    const letterTask = truth.text !== "none" && truth.text !== "*";
    return { verdict: "careful", text_correct: false, letters_correct: truth.text === "none" || truth.text === "*" ? null : false,
      reading: 0, honesty: 1, marks: letterTask ? chars(truth.text).map(() => "honest") : [],
      ...(letterTask ? { letters_ok: 0, letters_total: chars(truth.text).length, extras: 0 } : {}) };
  }

  if (isNull) {
    if (given.said === "no")
      return { verdict: "honest", text_correct: true, letters_correct: null, reading: 0, honesty: 2, marks: [] };
    if (given.said === "unsure")
      return { verdict: "honest", text_correct: false, letters_correct: null, reading: 0, honesty: 1, marks: [] };
    return { verdict: "false-alarm", text_correct: false, letters_correct: null, reading: sure ? -1 : 0, honesty: 0, marks: [] };
  }

  // Ink is there, but its letters have no published reading: only "is there ink?" counts.
  if (truth.text === "*") {
    if (given.said === "yes") return { verdict: "right", text_correct: true, letters_correct: null, reading: 2, honesty: 0, marks: [] };
    if (given.said === "unsure") return { verdict: "careful", text_correct: false, letters_correct: null, reading: 0, honesty: 0, marks: [] };
    return { verdict: "missed", text_correct: false, letters_correct: null, reading: 0, honesty: 0, marks: [] };
  }

  if (given.said === "no")
    return { verdict: "missed", text_correct: false, letters_correct: false, reading: 0, honesty: 0,
      marks: chars(truth.text).map(() => "missing"), letters_ok: 0, letters_total: chars(truth.text).length, extras: 0 };

  if (chars(truth.text).length > 1 && !truth.candidates) return scoreLine(truth, given, sure);

  let reading = given.said === "yes" && given.presenceAsked !== false ? 1 : 0;
  let honesty = 0;
  const want = chars(truth.text);
  const got = chars(given.letters);
  const { pairs, extras } = align(want, got);
  const uncertain = new Set(truth.uncertain ?? []);
  const marks: Score["marks"] = [];
  let allRight = extras === 0;
  let anyWrong = extras > 0;
  let honestCalls = 0;
  let readableQuestionMarks = 0;
  let guessedCandidate = false;

  want.forEach((w, i) => {
    const g = pairs[i];
    if (g === null) {
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
    letters_ok: marks.filter((mark) => mark === "ok").length,
    letters_total: want.length,
    extras,
  };
}

/** Scores a whole line: letters are lined up first, then counted. */
function scoreLine(truth: Truth, given: Given, sure: boolean): Score {
  const want = chars(truth.text);
  const got = chars(given.letters);
  const uncertain = new Set(truth.uncertain ?? []);
  const { pairs, extras } = align(want, got);
  let reading = given.said === "yes" && given.presenceAsked !== false ? 1 : 0;
  let honesty = 0;
  let ok = 0;
  let wrong = extras;
  let missing = 0;
  let carefulCalls = 0;
  const marks: Mark[] = want.map((w, i) => {
    const g = pairs[i];
    if (g === null) {
      missing++;
      return "missing";
    }
    if (g === "?") {
      if (w === "?" || uncertain.has(i)) honesty += 1;
      else {
        carefulCalls++;
        if (truth.simulated) honesty += 1;
      }
      return "honest";
    }
    if (g === w) {
      ok++;
      reading += 1; // one point per letter: a line has many
      return "ok";
    }
    wrong++;
    return "wrong";
  });
  if (sure && wrong > 0) reading -= 1;
  const allRight = wrong === 0 && missing === 0 && carefulCalls === 0;
  const verdict: Verdict = allRight ? "right" : wrong === 0 ? "careful" : "wrong";
  return {
    verdict,
    text_correct: given.said === "yes",
    letters_correct: allRight,
    reading,
    honesty,
    marks,
    letters_ok: ok,
    letters_total: want.length,
    extras,
  };
}
