import { groups } from "./data";
import type { State } from "./store";
import type { AnswerRecord } from "./types";

export interface Badge {
  id: string;
  title: string;
  how: string;
  earned: (s: State) => boolean;
}

const isNull = (a: AnswerRecord) => a.truth === "none";
const isUndecidable = (a: AnswerRecord) => a.truth.includes("?");
const falseAlarm = (a: AnswerRecord) => a.verdict === "false-alarm";
const confidentWrong = (a: AnswerRecord) => a.confidence === 3 && (a.verdict === "wrong" || a.verdict === "guessed");
const good = (a: AnswerRecord) => a.verdict === "right" || a.verdict === "honest" || a.verdict === "careful";

function longestRun(list: AnswerRecord[], ok: (a: AnswerRecord) => boolean): number {
  let best = 0;
  let run = 0;
  for (const a of list) {
    run = ok(a) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export const BADGES: Badge[] = [
  {
    id: "first-set",
    title: "First set",
    how: "Finish any exercise set.",
    earned: (s) => groups.some((g) => (s.setsDone[g.id] ?? 0) > 0),
  },
  {
    id: "apprentice",
    title: "Alphabet apprentice",
    how: "Finish all five look-alike sets.",
    earned: (s) => groups.every((g) => (s.setsDone[g.id] ?? 0) > 0),
  },
  {
    id: "sigma-spotter",
    title: "Sigma spotter",
    how: "Tell Ϲ and Ε apart correctly three times.",
    earned: (s) => s.answers.filter((a) => (a.truth === "Ϲ" || a.truth === "Ε") && a.letters === a.truth).length >= 3,
  },
  {
    id: "no-false-alarms",
    title: "No false alarms in a row",
    how: "Say “no letter” on five empty tiles in a row.",
    earned: (s) => longestRun(s.answers.filter(isNull), (a) => a.said_text === "no") >= 5,
  },
  {
    id: "honest-eye",
    title: "Honest eye",
    how: "Answer “can't tell” five times where nobody could tell.",
    earned: (s) => s.answers.filter((a) => isUndecidable(a) && a.letters === "?").length >= 5,
  },
  {
    id: "steady-hand",
    title: "Steady hand",
    how: "Ten answers in a row without a false alarm and without being sure and wrong.",
    earned: (s) => longestRun(s.answers, (a) => !falseAlarm(a) && !confidentWrong(a)) >= 10,
  },
  {
    id: "calibrated",
    title: "Well calibrated",
    how: "At least 20 answers marked “sure”, and nine in ten of them right.",
    earned: (s) => {
      const sure = s.answers.filter((a) => a.confidence === 3);
      const right = sure.filter((a) => a.text_correct && a.letters_correct !== false);
      return sure.length >= 20 && right.length / sure.length >= 0.9;
    },
  },
];

export function earnedNow(s: State): string[] {
  return BADGES.filter((b) => b.earned(s)).map((b) => b.id);
}

/** Answers in a row that were right or honest. Shown as the current streak. */
export function currentStreak(s: State): number {
  let n = 0;
  for (let i = s.answers.length - 1; i >= 0 && good(s.answers[i]); i--) n++;
  return n;
}
