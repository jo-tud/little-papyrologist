import { badgeDefs, rankDefs } from "./data";
import { allMet, evaluate, type Check } from "./rules";
import type { State } from "./store";
import type { BadgeDef, RankDef } from "./types";

export const BADGES: BadgeDef[] = badgeDefs;

const badgeTitle = (id: string) => badgeDefs.find((b) => b.id === id)?.title ?? id;

export function badgeChecks(b: BadgeDef, s: State): Check[] {
  return evaluate(b.requires, s, badgeTitle);
}

/** Ids of all badges whose conditions are met now. */
export function earnedNow(s: State): string[] {
  return badgeDefs.filter((b) => allMet(badgeChecks(b, s))).map((b) => b.id);
}

/** Answers in a row that were right or honest. Shown as the current streak. */
export function currentStreak(s: State): number {
  let n = 0;
  for (let i = s.answers.length - 1; i >= 0; i--) {
    const v = s.answers[i].verdict;
    if (v !== "right" && v !== "honest" && v !== "careful") break;
    n++;
  }
  return n;
}

export interface RankStatus {
  index: number; // position in the ladder, 0 = first rank
  rank: RankDef;
  next?: RankDef;
  nextChecks: Check[];
}

export function rankChecks(r: RankDef, s: State): Check[] {
  return evaluate(r.requires, s, badgeTitle);
}

/** The highest rank whose conditions are all met. Ranks are ordered lowest first in data/ranks.yaml. */
export function rankStatus(s: State): RankStatus {
  let index = 0;
  rankDefs.forEach((r, i) => {
    if (s.ranks[r.id] || allMet(rankChecks(r, s))) index = i;
  });
  const next = rankDefs[index + 1];
  return { index, rank: rankDefs[index], next, nextChecks: next ? rankChecks(next, s) : [] };
}

export interface ProgressNews {
  badges: BadgeDef[];
  rank?: RankDef;
}

/**
 * Call after every answer and every finished set. Grants new badges and ranks and
 * reports what is new, so the page can celebrate it.
 */
export function updateProgress(s: State, grantBadges: (ids: string[]) => string[], grantRanks: (ids: string[]) => string[]): ProgressNews {
  // Compare with the ranks stored so far. The new answer is already counted in s.answers,
  // so recomputing "before" from the answers would hide the rank-up.
  const before = Math.max(0, ...rankDefs.map((r, i) => (s.ranks[r.id] ? i : 0)));
  const freshBadges = grantBadges(earnedNow(s));
  grantRanks(rankDefs.filter((r) => allMet(rankChecks(r, s))).map((r) => r.id));
  const after = rankStatus(s);
  return {
    badges: badgeDefs.filter((b) => freshBadges.includes(b.id)),
    rank: after.index > before ? after.rank : undefined,
  };
}
