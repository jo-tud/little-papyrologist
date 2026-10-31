import glyphData from "../data/glyphs.yaml";
import stage0Data from "../data/stage0.yaml";
import sourceData from "../data/sources.yaml";
import itemData from "../data/items.yaml";
import badgeData from "../data/badges.yaml";
import rankData from "../data/ranks.yaml";
import type { BadgeDef, Drill, Fact, Glyph, Group, Hero, PlaySet, QuizItem, QuizSet, RankDef, Source } from "./types";
import { applyLetterRegions } from "./letter-regions";

export const glyphs = (glyphData as { letters: Glyph[] }).letters;
export const glyphByChar = new Map(glyphs.map((g) => [g.char, g]));

const stage0 = stage0Data as { hero: Hero; facts: Fact[]; fieldnotes: Fact[]; groups: Group[]; drills: Drill[] };
export const hero = stage0.hero;
export const facts = stage0.facts;
export const fieldnotes = [stage0.fieldnotes[0], ...stage0.facts, ...stage0.fieldnotes.slice(1)];
export const groups = stage0.groups;
export const drills = stage0.drills;

export const sources = (sourceData as { sources: Source[] }).sources;
export const sourceById = new Map(sources.map((s) => [s.id, s]));

const itemFile = itemData as { sets?: QuizSet[]; items?: QuizItem[] };
export const quizItems = (itemFile.items ?? []).map(applyLetterRegions);
export const quizSets = itemFile.sets ?? [];

/** Short fingerprint of the exercise set, stored with exported results. */
export function itemSetVersion(): string {
  const text = JSON.stringify([drills, quizItems]);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const LEVELS = [
  { level: 1, title: "First real letters", text: "Start with clearer shapes and a letter pair, then explore unfamiliar handwriting with named examples." },
  { level: 2, title: "Your first lines", text: "Build a line a few letters at a time, find ink, and try reading with less help." },
  { level: 3, title: "When the image gets harder", text: "Try controlled blur, noise and missing detail. Compare with the original and learn when to stop guessing." },
] as const;

export const badgeDefs = (badgeData as { badges: BadgeDef[] }).badges;
export const rankDefs = (rankData as { ranks: RankDef[] }).ranks;

/**
 * Every playable set, from all levels. Stage 0 sets are the look-alike groups; quiz sets come
 * from the "set" field of the quiz items. Progress, levels and ranks are all counted over this
 * list, so new material counts automatically.
 */
export const playSets: PlaySet[] = [
  ...groups.map((g) => ({ id: g.id, level: 0, title: g.title, href: `#/drill/${g.id}` })),
  ...quizSets
    .filter((s) => !s.practice_only && quizItems.some((i) => i.set === s.id && !i.practice_only))
    .map((s) => ({ id: s.id, level: s.level, title: s.title, href: `#/quiz/${s.id}` })),
];
