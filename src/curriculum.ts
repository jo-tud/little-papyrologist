import type { QuizItem } from "./types";

/** Retired examples remain available for historical answers, never for a new round. */
export function isActiveItem(item: QuizItem): boolean {
  return !item.retired && !item.simulated && item.degradation === 0
    && item.set !== "harder-images" && item.task !== "detect" && item.truth !== "*";
}

export function isPracticeItem(item: QuizItem, level: number, group?: string): boolean {
  return isActiveItem(item) && item.level === level && item.task !== "study"
    && (item.task !== "read" || item.truth.length <= 4)
    && (!group || item.practice_group === group);
}
