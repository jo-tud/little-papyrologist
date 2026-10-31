import type { AnswerRecord, QuizItem } from "./types";
import { isPracticeItem } from "./curriculum";

type PracticeItem = QuizItem & { base_item?: string };
type PracticeAnswer = AnswerRecord & { help_used?: boolean | null };

export interface PracticeOptions {
  size?: number;
  /** Focused reading rounds deliberately practise related forms, without detection tasks. */
  group?: string;
  /** Supply a seeded generator when a reproducible round is needed. */
  random?: () => number;
}

export interface PracticeSummary {
  available: number;
  originals: number;
  seen: number;
  seenOriginals: number;
}

function pool(items: readonly PracticeItem[], level: number): PracticeItem[] {
  const unique = new Map<string, PracticeItem>();
  for (const item of items)
    if (isPracticeItem(item, level) && !unique.has(item.id)) unique.set(item.id, item);
  return [...unique.values()];
}

function original(item: PracticeItem, byId: ReadonlyMap<string, PracticeItem>): string {
  const visited = new Set<string>();
  let current = item;
  while (current.base_item && current.base_item !== current.id) {
    if (visited.has(current.id)) return [...visited].sort()[0];
    visited.add(current.id);
    const parent = byId.get(current.base_item);
    if (!parent) return current.base_item;
    current = parent;
  }
  return current.id;
}

function unitRandom(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0.5;
}

/** Exposure counts describe the available material, not mastery or lesson completion. */
export function summarizePractice(
  items: readonly PracticeItem[], answers: readonly PracticeAnswer[], level: number,
): PracticeSummary {
  const byId = new Map(items.map((item) => [item.id, item]));
  const eligible = pool(items, level);
  const answered = new Set(answers.map((answer) => answer.item_id));
  const originals = new Set(eligible.map((item) => original(item, byId)));
  const seenOriginals = new Set<string>();
  for (const id of answered) {
    const item = byId.get(id);
    if (item) seenOriginals.add(original(item, byId));
  }
  return {
    available: eligible.length,
    originals: originals.size,
    seen: eligible.filter((item) => answered.has(item.id)).length,
    seenOriginals: [...originals].filter((id) => seenOriginals.has(id)).length,
  };
}

/**
 * Choose a short round without changing answers, points or completed lessons.
 * New originals and previous difficulties receive more practice. Variants of
 * the same original are spaced apart; they never count as new source material.
 * From level 2, at least a fifth of a round is empty when empty tiles exist.
 * A small pool returns a shorter round, rather than repeating an identical tile.
 */
export function planPractice(
  items: readonly PracticeItem[], answers: readonly PracticeAnswer[], level: number,
  options: PracticeOptions = {},
): QuizItem[] {
  const requested = options.size ?? 12;
  if (!Number.isFinite(requested) || requested < 1) return [];
  const random = options.random ?? Math.random;
  let remaining = pool(items, level);
  if (options.group) {
    const images = new Set<string>();
    remaining = remaining.filter(item => item.practice_group === options.group && item.task === "read" && !item.optional_challenge && item.truth.length <= 6)
      .filter(item => {
        const crop = item.source_crop ? `${item.base_item}:${item.source_crop.join(",")}` : item.image;
        if (images.has(crop)) return false;
        images.add(crop);
        return true;
      });
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const origins = new Map(remaining.map((item) => [item.id, original(item, byId)]));
  const latest = new Map<string, PracticeAnswer>();
  const attempts = new Map<string, number>();
  const seenOriginals = new Set<string>();
  let lastAnswer: PracticeAnswer | undefined;
  for (const answer of answers) {
    attempts.set(answer.item_id, (attempts.get(answer.item_id) ?? 0) + 1);
    const previous = latest.get(answer.item_id);
    if (!previous || answer.answered_at >= previous.answered_at) latest.set(answer.item_id, answer);
    if (!lastAnswer || answer.answered_at >= lastAnswer.answered_at) lastAnswer = answer;
    const item = byId.get(answer.item_id);
    if (item) seenOriginals.add(original(item, byId));
  }

  let size = Math.min(Math.floor(requested), remaining.length);
  const emptyCount = remaining.filter((item) => item.truth === "none").length;
  if (level >= 2 && emptyCount) size = Math.min(size, emptyCount * 5);
  const emptyQuota = level >= 2 && emptyCount ? Math.ceil(size / 5) : 0;
  // Random positions avoid teaching a regular "every fifth tile is empty" pattern.
  const positions = Array.from({ length: size }, (_, index) => index);
  for (let index = positions.length - 1; index > 0; index--) {
    const other = Math.floor(unitRandom(random) * (index + 1));
    [positions[index], positions[other]] = [positions[other], positions[index]];
  }
  const emptyPositions = new Set(positions.slice(0, emptyQuota));
  const selected: PracticeItem[] = [];
  const selectedOriginals = new Set<string>();

  function weight(item: PracticeItem): number {
    const answer = latest.get(item.id);
    let result: number;
    if (!answer) result = seenOriginals.has(origins.get(item.id)!) ? 5 : 12;
    else if (["wrong", "false-alarm", "missed", "guessed"].includes(answer.verdict))
      result = answer.confidence === 3 ? 11 : 8;
    else if (answer.help_used || answer.said_text === "unsure" || answer.letters_correct === false) result = 5;
    else result = answer.confidence === 3 ? 1 : 2;
    result /= Math.sqrt(Math.max(1, attempts.get(item.id) ?? 0));
    if (!selected.length && lastAnswer?.item_id === item.id) result *= 0.35;
    return result;
  }

  for (let index = 0; index < size; index++) {
    // Without enough nonempty tiles, use the remaining empty material as well.
    let candidates = emptyQuota
      ? remaining.filter((item) => (item.truth === "none") === emptyPositions.has(index))
      : remaining;
    if (!candidates.length) candidates = remaining;
    const freshOriginals = candidates.filter((item) => !selectedOriginals.has(origins.get(item.id)!));
    if (freshOriginals.length) candidates = freshOriginals;
    const previous = selected.at(-1);
    if (previous) {
      const differentOriginal = candidates.filter((item) => origins.get(item.id) !== origins.get(previous.id));
      if (differentOriginal.length) candidates = differentOriginal;
      const differentSource = candidates.filter((item) => item.source[0] !== previous.source[0]);
      if (differentSource.length) candidates = differentSource;
    }
    let choice = candidates[0];
    let best = Infinity;
    for (const item of candidates) {
      const draw = -Math.log(Math.max(Number.EPSILON, 1 - unitRandom(random))) / weight(item);
      if (draw < best) { choice = item; best = draw; }
    }
    selected.push(choice);
    selectedOriginals.add(origins.get(choice.id)!);
    remaining.splice(remaining.findIndex((item) => item.id === choice.id), 1);
  }
  return selected;
}
