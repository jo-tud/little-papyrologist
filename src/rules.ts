/**
 * Conditions for ranks and badges, written in data/ranks.yaml and data/badges.yaml.
 * Each condition knows how far the player is, so the page can show progress.
 * New conditions are added here once; new ranks and badges then need only data.
 */
import { LEVELS, playSets } from "./data";
import type { State } from "./store";
import type { AnswerRecord } from "./types";

export interface Requirements {
  answers?: number;
  points?: number;
  honesty_points?: number;
  sets_done?: number;
  levels_done?: number[];
  honest_calls?: number;
  letters_right?: { letters: string[]; count: number };
  empty_streak?: number;
  clean_streak?: number;
  false_alarms?: { max_share: number; min_tiles: number };
  calibration?: { sure_answers: number; right_share: number };
  badges?: string[];
}

export const REQUIREMENT_KEYS = [
  "answers",
  "points",
  "honesty_points",
  "sets_done",
  "levels_done",
  "honest_calls",
  "letters_right",
  "empty_streak",
  "clean_streak",
  "false_alarms",
  "calibration",
  "badges",
] as const;

export interface Check {
  text: string;
  have: number;
  need: number;
  met: boolean;
}

const isEmptyTile = (a: AnswerRecord) => a.truth === "none";
const isUndecidable = (a: AnswerRecord) => a.truth.includes("?");
const good = (a: AnswerRecord) => a.verdict === "right" || a.verdict === "honest" || a.verdict === "careful";
const confidentWrong = (a: AnswerRecord) => a.confidence === 3 && (a.verdict === "wrong" || a.verdict === "guessed");

function longestRun(list: AnswerRecord[], ok: (a: AnswerRecord) => boolean): number {
  let best = 0;
  let run = 0;
  for (const a of list) {
    run = ok(a) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function totalPoints(s: State): { reading: number; honesty: number } {
  return {
    reading: Math.max(0, s.answers.reduce((n, a) => n + a.reading_points, 0)),
    honesty: s.answers.reduce((n, a) => n + a.honesty_points, 0),
  };
}

export function levelName(level: number): string {
  return level === 0 ? "stage 0" : `level ${level}`;
}

/** A level is done when it has exercise sets and every one of them was finished at least once. */
export function levelDone(s: State, level: number): boolean {
  const sets = playSets.filter((p) => p.level === level);
  return sets.length > 0 && sets.every((p) => (s.setsDone[p.id] ?? 0) > 0);
}

export function levelHasSets(level: number): boolean {
  return playSets.some((p) => p.level === level);
}

const count = (text: string, have: number, need: number): Check => ({ text, have: Math.min(have, need), need, met: have >= need });

/** Checks every condition of a rank or badge. An empty list means it is always reached. */
export function evaluate(req: Requirements, s: State, badgeTitle: (id: string) => string): Check[] {
  const out: Check[] = [];
  const answers = s.answers;
  const pts = totalPoints(s);

  if (req.answers) out.push(count(`Answer ${req.answers} tiles`, answers.length, req.answers));
  if (req.points) out.push(count(`Collect ${req.points} points`, pts.reading + pts.honesty, req.points));
  if (req.honesty_points) out.push(count(`Collect ${req.honesty_points} honesty points`, pts.honesty, req.honesty_points));
  if (req.sets_done) {
    const done = playSets.filter((p) => (s.setsDone[p.id] ?? 0) > 0).length;
    out.push(count(`Finish ${req.sets_done} exercise ${req.sets_done === 1 ? "set" : "sets"}`, done, req.sets_done));
  }
  for (const level of req.levels_done ?? []) {
    const sets = playSets.filter((p) => p.level === level);
    const done = sets.filter((p) => (s.setsDone[p.id] ?? 0) > 0).length;
    const title = LEVELS.find((l) => l.level === level)?.title;
    const name = `Finish ${levelName(level)}${title ? ` (${title})` : ""}`;
    out.push(
      sets.length
        ? { text: name, have: done, need: sets.length, met: done === sets.length }
        : { text: `${name}, coming soon`, have: 0, need: 1, met: false },
    );
  }
  if (req.honest_calls)
    out.push(
      count(
        `Answer “can't tell” ${req.honest_calls} times where nobody could tell`,
        answers.filter((a) => isUndecidable(a) && a.letters.includes("?")).length,
        req.honest_calls,
      ),
    );
  if (req.letters_right) {
    const { letters, count: need } = req.letters_right;
    const have = answers.filter((a) => letters.includes(a.truth) && a.letters === a.truth).length;
    out.push(count(`Read ${letters.join(" or ")} correctly ${need} times`, have, need));
  }
  if (req.empty_streak)
    out.push(
      count(
        `Say “no letter” on ${req.empty_streak} empty tiles in a row`,
        longestRun(answers.filter(isEmptyTile), (a) => a.said_text === "no"),
        req.empty_streak,
      ),
    );
  if (req.clean_streak)
    out.push(
      count(
        `${req.clean_streak} good or honest answers in a row`,
        longestRun(answers, (a) => good(a) && !confidentWrong(a)),
        req.clean_streak,
      ),
    );
  if (req.false_alarms) {
    const { max_share, min_tiles } = req.false_alarms;
    const empty = answers.filter(isEmptyTile);
    const alarms = empty.filter((a) => a.said_text === "yes").length;
    const share = empty.length ? alarms / empty.length : 1;
    const text = `At most ${Math.round(max_share * 100)} % false alarms, over at least ${min_tiles} empty tiles`;
    out.push({ text, have: Math.min(empty.length, min_tiles), need: min_tiles, met: empty.length >= min_tiles && share <= max_share });
  }
  if (req.calibration) {
    const { sure_answers, right_share } = req.calibration;
    const sure = answers.filter((a) => a.confidence === 3);
    const right = sure.filter((a) => a.verdict === "right" || a.verdict === "honest").length;
    const text = `At least ${sure_answers} answers marked “sure”, and ${Math.round(right_share * 100)} % of them right`;
    out.push({ text, have: Math.min(sure.length, sure_answers), need: sure_answers, met: sure.length >= sure_answers && right / Math.max(1, sure.length) >= right_share });
  }
  for (const id of req.badges ?? []) {
    const has = !!s.badges[id];
    out.push({ text: `Earn the badge “${badgeTitle(id)}”`, have: has ? 1 : 0, need: 1, met: has });
  }
  return out;
}

export const allMet = (checks: Check[]) => checks.every((c) => c.met);
