import glyphData from "../data/glyphs.yaml";
import stage0Data from "../data/stage0.yaml";
import sourceData from "../data/sources.yaml";
import itemData from "../data/items.yaml";
import type { Drill, Fact, Glyph, Group, Hero, QuizItem, Source } from "./types";

export const glyphs = (glyphData as { letters: Glyph[] }).letters;
export const glyphByChar = new Map(glyphs.map((g) => [g.char, g]));

const stage0 = stage0Data as { hero: Hero; facts: Fact[]; groups: Group[]; drills: Drill[] };
export const hero = stage0.hero;
export const facts = stage0.facts;
export const groups = stage0.groups;
export const drills = stage0.drills;

export const sources = (sourceData as { sources: Source[] }).sources;
export const sourceById = new Map(sources.map((s) => [s.id, s]));

export const quizItems = ((itemData as { items: QuizItem[] | null }).items ?? []) as QuizItem[];

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
  { level: 1, title: "Ink you can see", text: "Infrared photos of opened fragments, where the ink is physically visible." },
  { level: 2, title: "Ink revealed by a model", text: "Images of closed scrolls, with readings checked by papyrologists." },
  { level: 3, title: "Harder", text: "Blur, noise, low contrast and coarse resolution. First: is there text at all?" },
] as const;
